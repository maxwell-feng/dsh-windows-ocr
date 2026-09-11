import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXT_BY_MEDIA, TEMP_PREFIX } from "./config.js";
import { removeTempDir, terminateChild } from "./temp-cleanup.js";
import type { AttachmentStore, ImageAttachmentRef } from "./types.js";

export interface OcrEngineOptions {
  language: string;
  ocrScript: string;
  timeoutMs: number;
  maxCacheEntries: number;
  getAttachmentStore: () => AttachmentStore | undefined;
  warn?: (message: string, ...args: unknown[]) => void;
}

export class WindowsOcrEngine {
  private language: string;
  private ocrScript: string;
  private timeoutMs: number;
  private maxCacheEntries: number;
  private getAttachmentStore: () => AttachmentStore | undefined;
  private warn?: (message: string, ...args: unknown[]) => void;
  private ocrCache = new Map<string, Promise<string>>();

  constructor(options: OcrEngineOptions) {
    this.language = options.language;
    this.ocrScript = options.ocrScript;
    this.timeoutMs = options.timeoutMs;
    this.maxCacheEntries = options.maxCacheEntries;
    this.getAttachmentStore = options.getAttachmentStore;
    this.warn = options.warn;
  }

  public clear(): void {
    this.ocrCache.clear();
  }

  public async ocrText(ref: ImageAttachmentRef): Promise<string> {
    const key = String(ref.attachmentId);
    let pending = this.ocrCache.get(key);
    if (pending) return pending;

    pending = (async () => {
      const store = this.getAttachmentStore();
      if (!store) throw new Error("attachment service unavailable");
      const stored = await store.readImage(ref);
      const text = await this.runOcr(stored.data, ref.mediaType);
      return text.trim().length > 0 ? text : "(OCR: no text recognized)";
    })().catch((error: unknown) => {
      this.ocrCache.delete(key);
      this.warn?.(
        "[windows-ocr] OCR failed for %s: %s",
        key,
        error instanceof Error ? error.message : String(error),
      );
      return "(OCR: failed to recognize this image)";
    });

    this.ocrCache.set(key, pending);
    if (this.ocrCache.size > this.maxCacheEntries) {
      const oldest = this.ocrCache.keys().next().value;
      if (oldest !== undefined) this.ocrCache.delete(oldest);
    }
    return pending;
  }

  private async runOcr(bytes: Uint8Array, mediaType: string): Promise<string> {
    const dir = await fs.mkdtemp(join(tmpdir(), TEMP_PREFIX));
    const imagePath = join(dir, `input.${EXT_BY_MEDIA[mediaType] ?? "png"}`);
    const outPath = join(dir, "out.txt");
    let child: ChildProcess | undefined;

    try {
      await fs.writeFile(imagePath, bytes);
      await new Promise<void>((resolve, reject) => {
        const args = [
          "-NoProfile",
          "-ExecutionPolicy", "Bypass",
          "-File", this.ocrScript,
          "-ImagePath", imagePath,
          "-OutFile", outPath,
        ];
        if (this.language) args.push("-Language", this.language);

        child = spawn("powershell.exe", args, {
          windowsHide: true,
          stdio: ["ignore", "ignore", "pipe"],
        });

        let stderr = "";
        let settled = false;
        const settle = (fn: (value: void) => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          fn();
        };
        const settleErr = (error: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        };

        child.stderr?.on("data", (chunk: Buffer) => {
          stderr += chunk;
        });

        const timer = setTimeout(() => {
          void terminateChild(child!).then(() => {
            settleErr(new Error("OCR timed out"));
          });
        }, this.timeoutMs);

        child.on("error", (error: Error) => {
          settleErr(error);
        });

        child.on("close", (code: number | null) => {
          if (code === 0) settle(resolve);
          else {
            settleErr(
              new Error(`OCR exited with code ${code}: ${stderr.trim().slice(0, 500)}`),
            );
          }
        });
      });

      return await fs.readFile(outPath, "utf8");
    } finally {
      if (child) await terminateChild(child);
      await removeTempDir(dir, this.warn);
    }
  }
}
