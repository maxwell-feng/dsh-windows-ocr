import { spawn, type ChildProcess } from "node:child_process";
import { lstatSync, readdirSync, promises as fs, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEMP_PREFIX } from "./config.ts";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Remove temp directories left behind by a previously crashed process. */
export function sweepOrphanTempDirs(): void {
  let entries: string[];
  try {
    entries = readdirSync(tmpdir());
  } catch {
    return;
  }
  for (const entry of entries) {
    const suffix = entry.slice(TEMP_PREFIX.length);
    if (suffix.length !== 6 || !/^[A-Za-z0-9]{6}$/.test(suffix)) continue;
    const full = join(tmpdir(), entry);
    try {
      if (!lstatSync(full).isDirectory()) continue;
      rmSync(full, { recursive: true, force: true });
    } catch {
      // Concurrent OCR may own it; its own finally will clean up.
    }
  }
}

/** Wait for a child to exit after timeout/kill, so temp files can be unlinked. */
export async function terminateChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;

  const closed = new Promise<void>((resolve) => {
    child.once("close", () => resolve());
  });

  try {
    if (process.platform === "win32" && typeof child.pid === "number") {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        windowsHide: true,
        stdio: "ignore",
      }).unref();
    } else {
      try {
        child.kill("SIGTERM");
      } catch {
        // already gone
      }
      void sleep(500).then(() => {
        if (child.exitCode === null && child.signalCode === null) {
          try {
            child.kill("SIGKILL");
          } catch {
            // already gone
          }
        }
      });
    }
  } catch {
    // best-effort
  }

  await Promise.race([closed, sleep(2000)]);
}

export async function removeTempDir(
  dir: string,
  warn?: (message: string, ...args: unknown[]) => void,
): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
    return;
  } catch (error) {
    warn?.(
      "[windows-ocr] temp dir remove failed (retrying): %s (%s)",
      dir,
      error instanceof Error ? error.message : String(error),
    );
  }
  await sleep(200);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    warn?.(
      "[windows-ocr] temp dir remove failed: %s (%s)",
      dir,
      error instanceof Error ? error.message : String(error),
    );
  }
}
