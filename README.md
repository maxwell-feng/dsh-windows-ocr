# windows-ocr

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) plugin that lets **text-only models** accept attached images: every image is recognized **locally** with the built-in Windows OCR engine (`Windows.Media.Ocr`) and only the recognized **text** is sent to the model API.

**Privacy default:** image bytes are OCR'd locally and not sent to the provider. Set `passthrough: true` only if you intentionally want genuine vision models to receive original image bytes.

- No configuration changes to your models — no `input: [text, image]` hacks in `settings.yaml`.
- Works with any provider/model in dsh; by default every attached image is OCR'd before the request leaves the machine.
- Vision-model passthrough is **opt-in** (`passthrough: true`).
- Fail-closed: if the plugin is not loaded, models stay text-only and image attachments are refused — nothing can silently leak. Missing attachments are replaced with a refusal text block (never left as raw `image`).

## Quick install via an AI agent

Hand this repository to any AI agent, or paste the instruction below, and the
agent will install and verify the plugin for you:

> Please install the dsh plugin in this repository by following
> <https://github.com/maxwell-feng/dsh-windows-ocr/blob/main/agents-install.md>.
> Run every preflight check, choose an install mode, then complete the
> mandatory verification: attach an image to a text-only model session and
> confirm the model answers with the recognized text.

[`agents-install.md`](./agents-install.md) is a step-by-step guide written for
AI agents: preflight checks, both install modes (permanent profile patch /
temporary `--patch` overlay), mandatory functional verification, and
troubleshooting for the failure modes you are likely to hit. Manual install
instructions are below.

## Why a plugin (not a skill)

dsh skills are Markdown instruction files injected into the model context — they cannot execute code, cannot hook the request pipeline, and cannot stop an image from being serialized. This feature needs exactly that, so it is a cordis plugin that hooks two public seams of the `llm` service:

1. **Capability shim** — `ctx.llm.resolveModelInfo` (also `listModels`). The host gates image attachments on `inputModalities.includes("image")` at three places: message admission, model switching, and the `read_image` tool. The shim answers "yes", so text models admit images.
2. **Request rewrite** — `registration.adapter.stream` (the single choke point both `ctx.llm.stream` and `prepareCall().stream` funnel through). Every `image` content block is replaced with an OCR text block before the adapter serializes the request, so the adapter's own image check never fires, no attachment bytes are read for the wire, and no `image_url` is ever built.

```
you attach an image
  → admission asks ctx.llm.resolveModelInfo (shimmed: "image" ✓)
  → image stored in the local attachment store (session log, UI preview)
  → agent builds the request → adapter.stream (wrapped)
  → image block read locally (ctx.attachments.readImage) → Windows OCR
  → block replaced with <image_ocr>…text…</image_ocr>
  → adapter serializes a text-only request → provider
```

## Requirements

- Windows 10/11 (Windows PowerShell 5.1+ ships with the OS; no install needed)
- A Windows OCR-capable language pack for your language (Settings → Time & language → Language). English is usually present; Chinese requires the Chinese language pack (OCR-capable).
- `dsh` with a profile (tested against dsh `0.1.0-rc.6`)

## Install

### Installing via an AI agent

[`agents-install.md`](./agents-install.md) in this repository is a
step-by-step installation guide written **for AI agents** (and careful
humans). Give it to an agent — e.g. "install this plugin per
`agents-install.md` from https://github.com/maxwell-feng/dsh-windows-ocr" —
and the agent can perform the preflight checks, install, verification, and
troubleshooting on its own. The guide covers both install modes, the
mandatory functional verification (attach an image → model answers with the
OCR text), and the failure modes you are likely to hit.

### Manual install

Two official ways to load this plugin, both referencing the plugin file by
**absolute path** (see `docs/user/develop/basic`). On Windows the path must be
a `file://` URL — a bare `C:/...` path is parsed as the `c:` URL scheme and
the loader rejects it.

### Permanent: profile patch layer

Append to your profile's `cordis.patch.yml` (e.g. `~/.dsh/profiles/web/cordis.patch.yml`):

```yaml
- insert:
    - id: windows-ocr
      name: 'file:///C:/absolute/path/to/windows-ocr/lib/index.js'
      config:
        language: ''
        passthrough: false
```

Then restart `dsh web`. Remove the rows to uninstall — the plugin restores the original `llm` / adapter methods on unload.

### Temporary: `--patch` overlay

Put the same rows in an overlay file and boot with it; your profile stays untouched:

```bash
dsh --profile web --patch C:/path/to/overlay.yml
```

### Notes

- `dsh web` fails with `EADDRINUSE` on port 3080 when an older instance is
  still running: find it with `netstat -ano | findstr :3080` and stop it
  (taskkill /PID <pid> /F) before starting a new one.
- For a packaged install (npm / tarball / `github:user/repo`), package the
  plugin as a bundle (`dsh.bundle` + `cordis.patch.yml`, see
  `docs/user/develop/basic/publish`); a git install additionally needs a
  `prepare` build script and pnpm `allowBuilds` consent.

To verify the plugin loaded, look for `windows-ocr` in the boot logs, or check the OCR smoke test below.

## Configuration

All settings live in the patch row `windows-ocr` (`cordis.patch.yml` here) and can be overridden from your profile's `cordis.patch.yml`:

| Key | Default | Meaning |
|---|---|---|
| `language` | `""` | BCP-47 tag for Windows OCR, e.g. `zh-Hans`, `en-US`. Empty = user profile languages. |
| `passthrough` | `false` | `false` (default): OCR every image. `true`: genuine vision models receive images untouched. |
| `ocrScript` | bundled `lib/ocr.ps1` | Absolute path override for the PowerShell OCR script. |
| `timeoutMs` | `60000` | Per-image OCR timeout. |
| `maxCacheEntries` | `200` | Bound on the per-run OCR cache (keyed by attachment id). |

Example override in `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- update:
    - id: windows-ocr
      config:
        language: zh-Hans
```

## How the model sees the image

Each image block becomes a text block (local filenames are **not** forwarded):

```
<image_ocr>
…recognized lines…
</image_ocr>
```

Recognition text is cached per attachment id for the lifetime of the dsh process, so repeated turns do not re-run OCR.

## Temp-file hygiene

Every OCR run writes its input image and output text into a **fresh temporary
directory** (`windows-ocr-*` under the system temp dir). The directory is
removed automatically in `finally` — on success, on OCR error, and on timeout —
so no per-run script, image, or output file survives. At plugin start, any
orphaned `windows-ocr-*` directories left behind by a previously crashed
process are swept as well. Nothing is written outside the plugin's own
temporary directory and the dsh attachment store.

## Smoke test (no dsh needed)

```powershell
# 1x1 PNG — exercises WinRT loading, language availability, recognition
powershell.exe -NoProfile -ExecutionPolicy Bypass -File lib/ocr.ps1 -ImagePath test.png -OutFile out.txt
Get-Content out.txt
```

Exit code 0 with an empty/whitespace `out.txt` means the OCR engine works (a 1×1 image has no text). Exit 2/3 means a language pack is missing.

## Verification inside dsh

1. Attach an image to a text-model session and send a message — the model should answer using the recognized text.
2. Confirm the image never goes out: open DevTools → Network in the web UI, inspect the request to your provider base URL, and verify the payload contains only `text` content parts (no `image_url` / data URI).

## Limitations

- OCR language availability depends on installed Windows language packs (script exits 2/3 and the plugin degrades to a placeholder text).
- GIFs: Windows OCR recognizes the first frame.
- Cache is per process; a long-lived session keeps OCR text cached, bounded by `maxCacheEntries`.
- Hot reload (HMR) replaces adapters; the plugin re-wraps new adapters on `llm/adapters-updated`, but a full restart is the safe path after any dsh update.
- The model picker may show text models without an "image" badge (cosmetic only — `listModels` is shimmed consistently).
- If the OCR plugin is removed, image attachments to text models are refused again (fail-closed), not uploaded.

## License

MIT
