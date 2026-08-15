# windows-ocr — Agent Installation Guide

This document is written for an **AI agent** (or a careful human) that must
install this plugin into a DeepSeek Harness (dsh) installation. Follow the
steps in order and verify each stage before moving on. Do not skip the
verification section — an install is not done until the model answers from an
attached image.

## 0. What this plugin does (30-second summary)

- Lets **text-only models** accept attached images: each image is recognized
  **locally** with the built-in Windows OCR engine (`Windows.Media.Ocr`), and
  only the recognized text is sent to the model API.
- **Image bytes never leave the machine.** Fail-closed: if the plugin is not
  loaded, image attachments are refused (never uploaded).
- Genuine vision models pass images through untouched by default
  (`passthrough: true`).
- Do **not** enable together with `tesseract-ocr` on the same machine — both
  would OCR the same image.

## 1. Preflight checks (run all, confirm all)

| Check | Command | Must see |
|---|---|---|
| dsh installed | `dsh --version` | a version like `0.1.0-rc.6` |
| profile exists | `ls ~/.dsh/profiles` | at least one profile (e.g. `web`) |
| profile boots/composes | `dsh --profile web --dump-config` | succeeds, prints rows |
| OS | `ver` or PowerShell `$PSVersionTable` | Windows 10/11 |
| plugin row not already present | `dsh --profile web --dump-config \| findstr windows-ocr` | nothing (or you must **update** that row instead of inserting a duplicate) |

If `dsh` is missing, install it first (e.g. `npm install -g @deepseek-ai/dsh`),
then create/verify the profile. If the machine has no `~/.dsh`, the first
`dsh web` run initializes it.

## 2. Install — choose one mode

Both modes reference the plugin file by **absolute path**. On Windows the path
in the YAML **must be a `file://` URL** — a bare `C:/...` path is parsed as
the `c:` URL scheme and the loader rejects it with
`ERR_UNSUPPORTED_ESM_URL_SCHEME`.

### Mode A — permanent (recommended): profile patch layer

1. Edit the profile's user patch file: `~/.dsh/profiles/web/cordis.patch.yml`.
2. Append (adjust the path to the real checkout location):

   ```yaml
   - insert:
       - id: windows-ocr
         name: 'file:///C:/absolute/path/to/windows-ocr/lib/index.js'
         config:
           language: ''
           passthrough: true
           timeoutMs: 60000
           maxCacheEntries: 200
   ```

   If `dsh --profile web --dump-config | findstr windows-ocr` already shows a
   `windows-ocr` row, do **not** insert a second one (the loader rejects
   duplicate ids) — use an `- update:` entry for that id instead.
3. Verify composition: `dsh --profile web --dump-config` — the row must appear
   under the `# == .../cordis.patch.yml` layer.
4. Restart the dsh web server: stop any running instance, then `dsh web`.

### Mode B — temporary: `--patch` overlay

Put the same rows into an overlay file (e.g. `dev.patch.yml` next to the
checkout) and boot with it; the profile stays untouched:

```
dsh --profile web --patch C:/absolute/path/to/dev.patch.yml
```

## 3. Verify the install (mandatory)

1. The server is up: `dsh web` prints `dsh web: http://127.0.0.1:3080`.
2. OCR engine smoke test (no dsh needed):

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File lib/ocr.ps1 `
     -ImagePath C:\path\to\1x1.png -OutFile C:\path\to\out.txt
   ```

   Exit 0 = engine OK. Exit 2 = the configured language is not installed
   (install the language pack); exit 3 = no OCR language available.
3. Functional test (the real proof):

   - Open the UI at `http://127.0.0.1:3080`, pick a **text-only** model, attach
     an image with text, send a message asking what the text is.
   - Expected: the message is **accepted** (no "model does not support images"
     error) and the model replies with the recognized text.
   - If the UI is not reachable from your environment, drive the API instead
     (see `session.prompt` with an `image` content part containing base64
     data; expect `accepted: true`, then poll `session.history` for an
     `assistant/message` whose text contains the OCR content).
4. Privacy check: in DevTools → Network, the request to the provider base URL
   must contain only `text` content parts — **no `image_url` / data URI**.

## 4. Troubleshooting (errors you will actually hit)

| Symptom | Cause | Fix |
|---|---|---|
| `EADDRINUSE` on 127.0.0.1:3080 | an older dsh instance still runs | `netstat -ano \| findstr :3080`, stop that PID (`taskkill /PID <pid> /F`), start again |
| `duplicate loader entry id: windows-ocr` | the row already exists (profile patch + `--patch` overlay both add it) | use `- update:` for the existing id, or drop the overlay |
| `ERR_UNSUPPORTED_ESM_URL_SCHEME ... Received protocol 'c:'` | Windows path written as `C:/...` instead of a URL | use `file:///C:/...` in the `name:` field |
| `MISSING_CREDENTIAL: no API key for provider route ...` | the provider has no key | store `DEEPSEEK_API_KEY` (or the route's key) via the web Models page, or export it in the launching environment |
| `dsh` refuses to start: `credentials-local: ... .credentials.yaml is readable beyond its owner (mode 664)` | credential file permissions | `chmod 600 ~/.dsh/.credentials.yaml` (on Windows, ensure the file is owner-only) |
| `Authentication Fails ... 401` | the key belongs to a different gateway than the provider route | check the route's `baseURL`/`apiKeyEnv` in settings (e.g. an opencode.ai gateway key is not a DeepSeek-official key) |
| model replies `(OCR: no text recognized)` | empty image, or language pack mismatch | use a text-bearing image; check `language` config |
| model replies `(OCR: failed to recognize this image)` | OCR engine error (logged with `[windows-ocr]` prefix) | check the dsh log line for the underlying error |

## 5. Uninstall

Remove the `windows-ocr` rows from `cordis.patch.yml` (or stop passing the
overlay) and restart dsh. Nothing else is touched; models return to
text-only and image attachments are refused again (fail-closed).

## 6. Configuration reference

| Key | Default | Meaning |
|---|---|---|
| `language` | `""` | BCP-47 tag for Windows OCR (`zh-Hans`, `en-US`, …); empty = user profile languages |
| `passthrough` | `true` | `true`: vision models receive images untouched; `false`: OCR everything |
| `ocrScript` | bundled `lib/ocr.ps1` | absolute path to the PowerShell OCR script |
| `timeoutMs` | `60000` | per-image OCR timeout |
| `maxCacheEntries` | `200` | OCR cache bound (keyed by attachment id) |

## 7. Temp-file hygiene

Every OCR run writes its image/output into a fresh `windows-ocr-*` temp
directory that is removed automatically on success, error, and timeout.
Orphaned directories from a crashed process are swept at plugin start.

## 8. Submitting to dsh.so — scan-report note

The dsh.so submission checker (https://www.dsh.so/zh/submit) runs automated
static heuristics and attaches the report to the submission Issue for human
review. It is expected to flag this plugin with 2 Critical
(`node:child_process`) and 2 Warning (`fs.writeFile`) findings. Those are
**existence checks, not vulnerabilities in context**; paste the note below
into the submission so the reviewer can close them:

> **Security note for the automated scan findings (2 Critical / 2 Warning):**
> Both findings are static existence checks, not vulnerabilities in context:
> - `node:child_process` (Critical): the plugin must spawn the OCR engine
>   (`powershell.exe`). The spawn call uses an **argv array without a shell**,
>   so there is no command-injection surface; the binary and all arguments
>   come from admin-controlled config and `mkdtemp`-generated temp paths —
>   never from model or attachment content.
> - `fs.writeFile` (Warning): the plugin writes the image to a fixed filename
>   inside a **fresh `mkdtemp` directory**; the extension comes from a
>   whitelist map with a `png` fallback. No user-controlled path reaches the
>   write.
> Every temp directory is removed in `finally` (success/error/timeout) and
> orphaned dirs are swept at startup. The plugin makes **no network requests**
> and has **zero runtime dependencies**. Independent deep audit (Mimosa):
> 0 findings, 0 vulnerable packages.
