# Usage Guide

English | [简体中文](USAGE.zh.md)

Attach any image to a **text-only** model session and send a message — the
plugin OCRs the image locally via `Windows.Media.Ocr` and replaces the
`image` block with a text block before the request is built. No code or
model-config changes needed; every provider/model in dsh benefits.

---

## 1. Basic usage

1. Open a text-only model session (e.g. DeepSeek-V3 / DeepSeek-R1).
2. Attach an image containing text and send a message asking what it says.
3. The model answers using the recognized text. The image bytes never leave
   the machine (unless you opt into vision passthrough, §3).

---

## 2. OCR parameters

These `windows-ocr` config keys control recognition. Defaults match
`cordis.patch.yml` and the loader-validated `Config` schema in `src/index.ts`:

| Key | Default | Meaning |
|---|---|---|
| `language` | `""` | BCP-47 tag for Windows OCR, e.g. `zh-Hans`, `en-US`. Empty = user profile languages. |
| `passthrough` | `false` | `false` (default): OCR every image. `true`: genuine vision models receive images untouched (§3). |
| `ocrScript` | bundled `lib/ocr.ps1` | Absolute path override for the PowerShell OCR script. |
| `timeoutMs` | `60000` | Per-image OCR timeout in milliseconds. |
| `maxCacheEntries` | `200` | Bound on the per-run OCR cache (keyed by attachment id). |

Example override in `~/.dsh/profiles/web/cordis.patch.yml` — an id-targeted
row (not `insert:`) replaces the existing `windows-ocr` row's config:

```yaml
- id: windows-ocr
  config:
    language: zh-Hans
    timeoutMs: 30000
```

An invalid value fails the boot with an actionable error instead of being
silently ignored. Full details: [Configuration Guide](CONFIG.md).

---

## 3. What the model sees

Each image block becomes a text block (local filenames are **not** forwarded):

```
<image_ocr>
…recognized lines…
</image_ocr>
```

- Recognition text is cached per attachment id for the lifetime of the dsh
  process (bounded by `maxCacheEntries`), so repeated turns do not re-run OCR.
- Empty recognition degrades to `(OCR: no text recognized)`; engine errors
  degrade to `(OCR: failed to recognize this image)`; an image block without
  an attachment reference degrades to a refusal text block — a raw `image`
  block is never left for the adapter (fail-closed).

### Passthrough matrix

| `passthrough` | Text-only model | Genuine vision model |
|---|---|---|
| `false` (default) | OCR text | OCR text |
| `true` | OCR text | Original image bytes |

---

## 4. Windows-only notes

- Windows 10/11 only. The bundled `lib/ocr.ps1` drives the inbox
  `Windows.Media.Ocr` WinRT API through Windows PowerShell 5.1 — no install
  needed, but there is no Linux/macOS path.
- OCR language availability depends on installed Windows language packs
  (Settings → Time & language → Language; the language needs its OCR
  component). A missing configured language exits 2; no OCR-capable language
  at all exits 3 — both degrade to placeholder text, never an upload.
- GIFs: Windows OCR recognizes the first frame.
- Every OCR run writes its input image and output text into a **fresh
  temporary directory** (`windows-ocr-*` under the system temp dir), removed
  automatically on success, error, and timeout. Orphaned directories from a
  crashed process are swept at plugin start.

---

## 5. Examples

OCR engine smoke test (no dsh needed):

```powershell
# 1x1 PNG — exercises WinRT loading, language availability, recognition
powershell.exe -NoProfile -ExecutionPolicy Bypass -File lib/ocr.ps1 -ImagePath test.png -OutFile out.txt
Get-Content out.txt
```

Conversation example — user attaches a photo of a receipt and sends:

```
What is the total on this receipt?
```

The model receives the recognized lines inside `<image_ocr>` tags instead of
the photo, and answers with the total.

Chinese recognition — set `language: zh-Hans` (see §2), attach a screenshot
with Chinese text, and the model answers with the recognized Chinese lines.
Requires the Chinese language pack with its OCR component installed.
