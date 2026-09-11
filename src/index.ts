// windows-ocr: DeepSeek Harness (dsh) plugin.
//
// Goal: when a user attaches an image while a text-only model is selected,
// recognize the image with the built-in Windows OCR engine (Windows.Media.Ocr)
// and send only the recognized text to the model.

import type { Context } from "@deepseek-ai/cordis";
import { installCapabilityShim } from "./capability-shim.ts";
import { Config, DEFAULT_OCR_SCRIPT } from "./config.ts";
import { WindowsOcrEngine } from "./ocr-engine.ts";
import { rewriteMessages } from "./pre-step.ts";
import { sweepOrphanTempDirs } from "./temp-cleanup.ts";
import type { AttachmentStore, Config as PluginConfig, LlmService } from "./types.ts";

export const name = "windows-ocr";

export const inject = ["llm", "attachments"];

export { Config, DEFAULT_OCR_SCRIPT, EXT_BY_MEDIA, MISSING_ATTACHMENT_TEXT, TEMP_PREFIX } from "./config.ts";
export { installCapabilityShim } from "./capability-shim.ts";
export { WindowsOcrEngine } from "./ocr-engine.ts";
export { currentRoute, hasImageBlock, rewriteContent, rewriteMessages } from "./pre-step.ts";
export { removeTempDir, sleep, sweepOrphanTempDirs, terminateChild } from "./temp-cleanup.ts";
export * from "./types.ts";

export function apply(ctx: Context, config: PluginConfig = {}): void {
  const language = typeof config.language === "string" ? config.language : "";
  const passthrough = config.passthrough === true;
  const ocrScript =
    typeof config.ocrScript === "string" && config.ocrScript.length > 0
      ? config.ocrScript
      : DEFAULT_OCR_SCRIPT;
  const timeoutMs =
    typeof config.timeoutMs === "number" && config.timeoutMs > 0
      ? config.timeoutMs
      : 60000;
  const maxCacheEntries =
    typeof config.maxCacheEntries === "number" && config.maxCacheEntries > 0
      ? config.maxCacheEntries
      : 200;

  const llm = ctx.get("llm") as LlmService | undefined;
  if (!llm) {
    ctx.logger?.warn?.("[windows-ocr] llm service unavailable at apply time; plugin disabled");
    return;
  }

  sweepOrphanTempDirs();

  const shim = installCapabilityShim(llm);

  const ocrEngine = new WindowsOcrEngine({
    language,
    ocrScript,
    timeoutMs,
    maxCacheEntries,
    getAttachmentStore: () => ctx.get("attachments") as AttachmentStore | undefined,
    warn: ctx.logger?.warn?.bind(ctx.logger),
  });

  ctx.on(
    "agent/pre-step",
    async (payload, next) => {
      const decision = await next();
      if (decision.kind === "reject") return decision;
      const messages = await rewriteMessages(
        decision.messages,
        payload.agent,
        passthrough,
        shim.nativeImageSupport,
        ocrEngine,
      );
      return messages === undefined || messages === decision.messages
        ? decision
        : { ...decision, messages };
    },
    { prepend: true },
  );

  ctx.effect(() => () => {
    ocrEngine.clear();
    shim.restore();
  });
}
