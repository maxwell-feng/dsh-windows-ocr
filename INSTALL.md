# Install Guide

English | [简体中文](INSTALL.zh.md)

> Verified against DeepSeek Harness **0.1.5-rc.2**. Requires Windows 10/11.
> Source builds require Node.js **>=22**.

---

## 1. Install modes (pick one)

Replace `web` with your profile name (e.g. `tui`) in every command.

### From npm (recommended)

```bash
dsh plugin --profile web add dsh-windows-ocr
```

Prebuilt and published with Sigstore provenance — no source build or
`allowBuilds` approval needed.

### From a release tarball (offline)

```bash
dsh plugin --profile web add ./dsh-windows-ocr-0.7.0.tgz
```

The tarball is attached to each GitHub release.

### From GitHub

```bash
dsh plugin --profile web add github:maxwell-feng/dsh-windows-ocr
```

> Git installs fetch sources, not built artifacts: the package's `prepare`
> script runs `tsc` to rebuild `lib/` from source, and pnpm ≥ 10 requires you
> to allow the build once (it prints the exact `pnpm-workspace.yaml` snippet).

### From a source checkout

```bash
cd C:/path/to/dsh-windows-ocr
npm install
npm run build
dsh plugin --profile web add ./dsh-windows-ocr
```

> **npm install registers the `windows-ocr` row by itself.** The package ships
> a bundle patch (`dsh.bundle` + its own `cordis.patch.yml`) that inserts the
> `windows-ocr` loader entry. Do **not** also add a manual `- insert:` row with
> the same id to your profile — dsh `0.1.5-rc.2` rejects duplicate loader entry
> ids and `dsh web` fails to boot with
> `duplicate loader entry id: windows-ocr`.

---

## 2. Manual install (without npm)

Two official ways to load this plugin, both referencing the plugin file by
**absolute path**. On Windows the path must be a `file://` URL — a bare
`C:/...` path is parsed as the `c:` URL scheme and the loader rejects it.

### Permanent: profile patch layer

Append to your profile's `cordis.patch.yml`
(e.g. `~/.dsh/profiles/web/cordis.patch.yml`):

```yaml
- insert:
    - id: windows-ocr
      name: 'file:///C:/absolute/path/to/windows-ocr/lib/index.js'
      config:
        language: ''
        passthrough: false
        timeoutMs: 60000
        maxCacheEntries: 200
```

Then restart `dsh web`.

> Choose **one** way to load the plugin: the npm bundle (§1) **or** this
> manual insert — never both. Both register the same `windows-ocr` entry id.
> If the row already exists (for example after an npm bundle install),
> configure it with an id-targeted override instead of inserting a second row:

```yaml
- id: windows-ocr
  config:
    language: zh-Hans
```

### Temporary: `--patch` overlay

Put the same `- insert:` rows in an overlay file and boot with it; your
profile stays untouched:

```bash
dsh --profile web --patch C:/path/to/overlay.yml
```

---

## 3. Verify the install (mandatory)

1. Composition check:

   ```bash
   dsh --profile web --dump-config
   ```

   The `windows-ocr` row must appear in the output.
2. OCR engine smoke test (no dsh needed):

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File lib/ocr.ps1 -ImagePath test.png -OutFile out.txt
   Get-Content out.txt
   ```

   Exit code 0 with an empty/whitespace `out.txt` means the OCR engine works
   (a 1×1 image has no text). Exit 2/3 means a language pack is missing.
3. Functional test (the real proof): attach an image with text to a
   **text-only** model session and ask what the text says. Expected: the
   message is **accepted** (no "model does not support images" error) and the
   model replies with the recognized text.
4. Privacy check: in DevTools → Network, the request to the provider base URL
   must contain only `text` content parts — no image data URIs.

`EADDRINUSE` on port 3080 means an older `dsh web` instance is still running:
find it with `netstat -ano &#124; findstr :3080` and stop it
(`taskkill /PID <pid> /F`) before starting a new one.

---

## 4. Next steps

- [Usage Guide](USAGE.md) — OCR parameters, Windows-only notes, examples.
- [Configuration Guide](CONFIG.md) — every option with types and defaults.
- [Update Guide](UPDATE.md) — upgrading between releases.
- [Uninstall Guide](UNINSTALL.md) — clean removal.
