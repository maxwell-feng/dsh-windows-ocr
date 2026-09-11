import Schema from "@deepseek-ai/schemastery";
import { fileURLToPath } from "node:url";
import type { Config as PluginConfig } from "./types.js";

export const EXT_BY_MEDIA: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const TEMP_PREFIX = "windows-ocr-";
export const DEFAULT_OCR_SCRIPT = fileURLToPath(new URL("./ocr.ps1", import.meta.url));

export const MISSING_ATTACHMENT_TEXT = "(OCR: missing attachment — image refused)";

/**
 * Loader-time configuration schema (docs/user/develop/basic/config). The
 * loader validates and fills defaults before apply() runs; apply() keeps its
 * defensive fallbacks so direct callers (tests) see identical behavior.
 */
export const Config: Schema<PluginConfig> = Schema.object({
  language: Schema.string().default(""),
  passthrough: Schema.boolean().default(false),
  ocrScript: Schema.string().default(DEFAULT_OCR_SCRIPT),
  timeoutMs: Schema.number().default(60000),
  maxCacheEntries: Schema.number().default(200),
});
