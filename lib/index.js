// windows-ocr: DeepSeek Harness (dsh) plugin.
//
// Goal: when a user attaches an image while a text-only model is selected,
// recognize the image with the built-in Windows OCR engine (Windows.Media.Ocr)
// and send only the recognized text to the model. The image bytes are read
// from the local attachment store and never leave the machine.
//
// Two seams are used, both on the public `llm` service:
//
//  1. resolveModelInfo / listModels shim — the host gates image attachments on
//     `inputModalities.includes("image")` (api-proxy admission, model switch,
//     and the read_image tool all query this one method). We answer "yes" so
//     text models admit images; the config stays untouched and fail-closed:
//     if this plugin is not loaded, models stay text-only and images are
//     refused, never uploaded.
//
//  2. adapter.stream wrap — both streaming call paths (ctx.llm.stream and
//     prepareCall().stream) funnel into registration.adapter.stream, the last
//     stop before the wire. We replace image blocks with OCR text here, so the
//     adapter's own image check (`containsImage`) is false, no attachment
//     bytes are serialized, and no image_url is ever built.
//
// Genuine vision models (whose *unshimmed* capabilities include "image") pass
// through untouched unless `passthrough: false`.
//
// Temp-file hygiene: every OCR run writes its image and output into a fresh
// temporary directory (windows-ocr-*) that is removed in `finally` — on
// success, on error, and on timeout. At plugin start we also sweep orphaned
// windows-ocr-* directories left behind by a crashed process.
import { spawn } from "node:child_process";
import { readdirSync, promises as fs, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
export const name = "windows-ocr";
// Official dependency declaration: the loader guarantees these services are
// ready before apply() runs (docs/user/develop/basic: "Required dependencies
// are ready before apply runs").
export const inject = ["llm", "attachments"];
const EXT_BY_MEDIA = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
};
const TEMP_PREFIX = "windows-ocr-";
const DEFAULT_OCR_SCRIPT = fileURLToPath(new URL("./ocr.ps1", import.meta.url));
/** Remove temp directories left behind by a previously crashed process. */
function sweepOrphanTempDirs() {
    let entries;
    try {
        entries = readdirSync(tmpdir());
    }
    catch {
        return;
    }
    for (const entry of entries) {
        if (entry.startsWith(TEMP_PREFIX)) {
            try {
                rmSync(join(tmpdir(), entry), { recursive: true, force: true });
            }
            catch {
                // A concurrent OCR may own it; its own finally will clean up.
            }
        }
    }
}
export function apply(ctx, config = {}) {
    const language = typeof config.language === "string" ? config.language : "";
    const passthrough = config.passthrough !== false;
    const ocrScript = typeof config.ocrScript === "string" && config.ocrScript.length > 0
        ? config.ocrScript
        : DEFAULT_OCR_SCRIPT;
    const timeoutMs = typeof config.timeoutMs === "number" && config.timeoutMs > 0
        ? config.timeoutMs
        : 60000;
    const maxCacheEntries = typeof config.maxCacheEntries === "number" && config.maxCacheEntries > 0
        ? config.maxCacheEntries
        : 200;
    const llm = ctx.get("llm");
    if (!llm) {
        ctx.logger?.warn?.("[windows-ocr] llm service unavailable at apply time; plugin disabled");
        return;
    }
    sweepOrphanTempDirs();
    // --- 1. Capability shim --------------------------------------------------
    const origResolveModelInfo = llm.resolveModelInfo.bind(llm);
    llm.resolveModelInfo = async function (provider, model, signal) {
        const info = await origResolveModelInfo(provider, model, signal);
        if (info?.inputModalities && !info.inputModalities.includes("image")) {
            return { ...info, inputModalities: [...info.inputModalities, "image"] };
        }
        return info;
    };
    const origListModels = llm.listModels.bind(llm);
    llm.listModels = async function (provider) {
        const models = await origListModels(provider);
        return models.map((model) => model?.inputModalities && !model.inputModalities.includes("image")
            ? { ...model, inputModalities: [...model.inputModalities, "image"] }
            : model);
    };
    // Pre-shim truth, used to decide OCR vs passthrough.
    async function nativeImageSupport(provider, model) {
        try {
            const info = await origResolveModelInfo(provider, model);
            return Boolean(info?.inputModalities?.includes("image"));
        }
        catch {
            return false; // unresolvable route -> treat as text model (OCR)
        }
    }
    // --- 2. OCR ---------------------------------------------------------------
    // attachmentId -> Promise<string>; failed results are evicted so a later
    // request can retry, and a failure degrades to a placeholder instead of
    // failing the conversation.
    const ocrCache = new Map();
    async function ocrText(ref) {
        const key = String(ref.attachmentId);
        let pending = ocrCache.get(key);
        if (pending)
            return pending;
        pending = (async () => {
            const store = ctx.get("attachments");
            if (!store)
                throw new Error("attachment service unavailable");
            const stored = await store.readImage(ref);
            const text = await runOcr(stored.data, ref.mediaType);
            return text.trim().length > 0 ? text : "(OCR: no text recognized)";
        })().catch((error) => {
            ocrCache.delete(key);
            ctx.logger?.warn?.("[windows-ocr] OCR failed for %s: %s", key, error instanceof Error ? error.message : String(error));
            return "(OCR: failed to recognize this image)";
        });
        ocrCache.set(key, pending);
        if (ocrCache.size > maxCacheEntries) {
            const oldest = ocrCache.keys().next().value;
            if (oldest !== undefined)
                ocrCache.delete(oldest);
        }
        return pending;
    }
    async function runOcr(bytes, mediaType) {
        // Fresh temp dir per OCR run; removed in finally (success, error, timeout).
        const dir = await fs.mkdtemp(join(tmpdir(), TEMP_PREFIX));
        const imagePath = join(dir, `input.${EXT_BY_MEDIA[mediaType] ?? "png"}`);
        const outPath = join(dir, "out.txt");
        try {
            await fs.writeFile(imagePath, bytes);
            await new Promise((resolve, reject) => {
                const args = [
                    "-NoProfile",
                    "-ExecutionPolicy", "Bypass",
                    "-File", ocrScript,
                    "-ImagePath", imagePath,
                    "-OutFile", outPath,
                ];
                if (language)
                    args.push("-Language", language);
                const child = spawn("powershell.exe", args, {
                    windowsHide: true,
                    stdio: ["ignore", "ignore", "pipe"],
                });
                let stderr = "";
                child.stderr.on("data", (chunk) => {
                    stderr += chunk;
                });
                const timer = setTimeout(() => {
                    child.kill();
                    reject(new Error("OCR timed out"));
                }, timeoutMs);
                child.on("error", (error) => {
                    clearTimeout(timer);
                    reject(error);
                });
                child.on("close", (code) => {
                    clearTimeout(timer);
                    if (code === 0)
                        resolve();
                    else
                        reject(new Error(`OCR exited with code ${code}: ${stderr.trim().slice(0, 500)}`));
                });
            });
            return await fs.readFile(outPath, "utf8");
        }
        finally {
            await fs.rm(dir, { recursive: true, force: true }).catch(() => { });
        }
    }
    // --- 3. Message rewriting --------------------------------------------------
    function escapeAttr(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll('"', "&quot;")
            .replaceAll("<", "&lt;");
    }
    function hasImageBlock(content) {
        return (Array.isArray(content) &&
            content.some((block) => block?.type === "image" ||
                (block?.type === "tool-result" && hasImageBlock(block.content))));
    }
    async function rewriteContent(content) {
        let out = null;
        for (let i = 0; i < content.length; i++) {
            const block = content[i];
            if (block?.type === "image") {
                if (!out)
                    out = [...content];
                const ref = block.attachment;
                if (!ref)
                    continue;
                const nameAttr = ref.name ? ` name="${escapeAttr(ref.name)}"` : "";
                out[i] = {
                    type: "text",
                    text: `<image_ocr${nameAttr}>\n${await ocrText(ref)}\n</image_ocr>`,
                };
            }
            else if (block?.type === "tool-result" && block.content && hasImageBlock(block.content)) {
                if (!out)
                    out = [...content];
                out[i] = { ...block, content: await rewriteContent(block.content) };
            }
        }
        return out ?? content;
    }
    async function rewriteMessages(messages, provider, model) {
        if (!Array.isArray(messages))
            return messages;
        if (passthrough && provider && model && (await nativeImageSupport(provider, model))) {
            return messages; // genuine vision model: images go through untouched
        }
        let out = null;
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            if (message && message.content && hasImageBlock(message.content)) {
                if (!out)
                    out = [...messages];
                out[i] = { ...message, content: await rewriteContent(message.content) };
            }
        }
        return out ?? messages;
    }
    // --- 4. Adapter stream wrap ------------------------------------------------
    // The single choke point both streaming paths funnel through
    // (stream() and prepareCall().stream() -> streamWithRegistration ->
    // adapterStream -> adapter.stream).
    const wrappedAdapters = new Set();
    function wrapAdapter(adapter) {
        if (!adapter || typeof adapter.stream !== "function" || wrappedAdapters.has(adapter)) {
            return;
        }
        const origStream = adapter.stream.bind(adapter);
        adapter.stream = async function* (options) {
            const messages = await rewriteMessages(options?.messages, options?.provider, options?.model);
            yield* origStream(messages === options?.messages ? options : { ...options, messages });
        };
        wrappedAdapters.add(adapter);
    }
    for (const registration of llm.adapters.values()) {
        wrapAdapter(registration.adapter);
    }
    // Late registration / HMR replacement: wrap any adapter that appears later.
    const disposeListener = ctx.on("llm/adapters-updated", () => {
        for (const registration of llm.adapters.values()) {
            wrapAdapter(registration.adapter);
        }
    });
    ctx.effect(() => () => {
        disposeListener();
        ocrCache.clear();
    });
}
