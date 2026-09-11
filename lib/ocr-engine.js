import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXT_BY_MEDIA, TEMP_PREFIX } from "./config.js";
import { removeTempDir, terminateChild } from "./temp-cleanup.js";
export class WindowsOcrEngine {
    language;
    ocrScript;
    timeoutMs;
    maxCacheEntries;
    getAttachmentStore;
    warn;
    ocrCache = new Map();
    constructor(options) {
        this.language = options.language;
        this.ocrScript = options.ocrScript;
        this.timeoutMs = options.timeoutMs;
        this.maxCacheEntries = options.maxCacheEntries;
        this.getAttachmentStore = options.getAttachmentStore;
        this.warn = options.warn;
    }
    clear() {
        this.ocrCache.clear();
    }
    async ocrText(ref) {
        const key = String(ref.attachmentId);
        let pending = this.ocrCache.get(key);
        if (pending)
            return pending;
        pending = (async () => {
            const store = this.getAttachmentStore();
            if (!store)
                throw new Error("attachment service unavailable");
            const stored = await store.readImage(ref);
            const text = await this.runOcr(stored.data, ref.mediaType);
            return text.trim().length > 0 ? text : "(OCR: no text recognized)";
        })().catch((error) => {
            this.ocrCache.delete(key);
            this.warn?.("[windows-ocr] OCR failed for %s: %s", key, error instanceof Error ? error.message : String(error));
            return "(OCR: failed to recognize this image)";
        });
        this.ocrCache.set(key, pending);
        if (this.ocrCache.size > this.maxCacheEntries) {
            const oldest = this.ocrCache.keys().next().value;
            if (oldest !== undefined)
                this.ocrCache.delete(oldest);
        }
        return pending;
    }
    async runOcr(bytes, mediaType) {
        const dir = await fs.mkdtemp(join(tmpdir(), TEMP_PREFIX));
        const imagePath = join(dir, `input.${EXT_BY_MEDIA[mediaType] ?? "png"}`);
        const outPath = join(dir, "out.txt");
        let child;
        try {
            await fs.writeFile(imagePath, bytes);
            await new Promise((resolve, reject) => {
                const args = [
                    "-NoProfile",
                    "-ExecutionPolicy", "Bypass",
                    "-File", this.ocrScript,
                    "-ImagePath", imagePath,
                    "-OutFile", outPath,
                ];
                if (this.language)
                    args.push("-Language", this.language);
                child = spawn("powershell.exe", args, {
                    windowsHide: true,
                    stdio: ["ignore", "ignore", "pipe"],
                });
                let stderr = "";
                let settled = false;
                const settle = (fn) => {
                    if (settled)
                        return;
                    settled = true;
                    clearTimeout(timer);
                    fn();
                };
                const settleErr = (error) => {
                    if (settled)
                        return;
                    settled = true;
                    clearTimeout(timer);
                    reject(error);
                };
                child.stderr?.on("data", (chunk) => {
                    stderr += chunk;
                });
                const timer = setTimeout(() => {
                    void terminateChild(child).then(() => {
                        settleErr(new Error("OCR timed out"));
                    });
                }, this.timeoutMs);
                child.on("error", (error) => {
                    settleErr(error);
                });
                child.on("close", (code) => {
                    if (code === 0)
                        settle(resolve);
                    else {
                        settleErr(new Error(`OCR exited with code ${code}: ${stderr.trim().slice(0, 500)}`));
                    }
                });
            });
            return await fs.readFile(outPath, "utf8");
        }
        finally {
            if (child)
                await terminateChild(child);
            await removeTempDir(dir, this.warn);
        }
    }
}
