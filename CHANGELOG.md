# Changelog

All notable changes to this project are documented in this file.

## [0.2.2] - 2026-08-17

### Changed

- **npm release + Trusted Publishing**: first npm release (`@maxwell-feng/dsh-windows-ocr`, public, `0.2.2`); future releases publish from GitHub Actions `publish.yml` via OIDC with automatic provenance — no long-lived npm tokens.

## [0.2.1] - 2026-08-16

First tagged release. Applies the same standard as the tesseract-ocr backend
of the dshoneys/awesome-dshoneys review.

### Changed

- **Privacy-first default**: `passthrough` now defaults to `false` — every
  attached image is OCR'd locally before the request leaves the machine;
  genuine vision models receive original image bytes only with an explicit
  `passthrough: true`.
- **No filename forwarding**: local attachment filenames are no longer written
  into the outbound `<image_ocr>` text block.
- **Fail-closed missing attachments**: an image block without an attachment
  reference is replaced with a refusal text block instead of being left as a
  raw `image` block for the adapter.
- **Unload/HMR restore**: unloading the plugin restores the original
  `resolveModelInfo`, `listModels`, and `adapter.stream` methods (only when
  our shim is still the installed one, so later replacements are never
  clobbered). Covered by new standalone tests.
- **Awaited child cleanup**: on timeout/teardown the OCR child process is
  terminated and awaited (`taskkill /t /f` on Windows) before the temp
  directory is removed; removal failures retry once and are logged instead of
  silently swallowed.
- **Sweep tightening**: the startup temp-dir sweep only removes directories
  matching our own `mkdtemp` shape (prefix + 6 random chars), never unrelated
  files or symlinks.

### Reproducibility & CI

- Package renamed to the scoped `@maxwell-feng/dsh-windows-ocr`.
- Dev dependencies pinned; `package-lock.json` committed.
- Added GitHub Actions CI: Ubuntu compile job + Windows job running the
  standalone suite (real `powershell.exe` with a mock OCR script, no language
  pack needed).

### Docs

- README, README.zh-CN, agents-install, and cordis.patch.yml aligned with the
  new privacy defaults and accurate claim scope.
