# Changelog

All notable changes to this project are documented in this file.

## [0.2.6] - 2026-08-21

### Compatibility

- **Adapted to deepseek-harness `0.1.1-rc.2`**: plugin code verified against
  the rc.2 `llm` service (`resolveModelInfo` / `listModels` /
  `adapter.stream` / `llm/adapters-updated`) and `attachments` service
  (`readImage`) — unchanged from rc.1, as is the vendored cordis (`4.0.1`) —
  no code changes required. Configuration and install docs now target
  `0.1.1-rc.2`.
- rc.2 verification: the streaming call path still funnels through
  `registration.adapter.stream` (the single choke point this plugin wraps), so
  attached image blocks are still rewritten to OCR text before any bytes reach
  the wire; `resolveModelInfo` / `listModels` still expose `inputModalities`,
  and `readImage` still returns `{ ref, data }`.

### Docs

- **Image routing guide (`passthrough`)**: documented how `passthrough` decides
  whether an attached image is OCR'd locally or passed through to a vision model,
  including the decision matrix and the fail-closed behaviour for text-only
  models. Added to README.md and README.zh-CN.md.

## [0.2.5] - 2026-08-21

### Compatibility

- **Adapted to deepseek-harness `0.1.1-rc.1`**: plugin code verified against
  the rc.1 `llm` service (`resolveModelInfo` / `listModels` /
  `adapter.stream` / `llm/adapters-updated`) and `attachments` service
  (`readImage`) — unchanged from rc.8, as is the vendored cordis (`4.0.1`) —
  no code changes required. Configuration and install docs now target
  `0.1.1-rc.1`.
- rc.1 verification: the streaming call path still funnels through
  `registration.adapter.stream` (the single choke point this plugin wraps), so
  attached image blocks are still rewritten to OCR text before any bytes reach
  the wire; `resolveModelInfo` / `listModels` still expose `inputModalities`,
  and `readImage` still returns `{ ref, data }`.

## [0.2.4] - 2026-08-20

### Compatibility

- **Adapted to deepseek-harness `0.1.0-rc.8`**: plugin code verified against
  the rc.8 `llm` service (`resolveModelInfo` / `listModels` /
  `adapter.stream` / `llm/adapters-updated`) and `attachments` service
  (`readImage`) — all unchanged from rc.7, as are the vendored cordis
  (`4.0.1`) and cordis-plugin-loader (`1.0.2`) — no code changes required.
  Configuration and install docs now target `0.1.0-rc.8`.
- rc.8 additions verified as non-interfering: the local attachment store's
  new per-side admission limit (`maxImageDimension`, default 2000px) and
  reduced default image byte limit (3.5MB) only gate what is admitted to the
  store; the harness-side request image offload (`offloadRequestImages`) only
  applies to vision-model passthrough, which this plugin leaves untouched by
  default.

## [0.2.3] - 2026-08-17

### Compatibility

- **Adapted to deepseek-harness `0.1.0-rc.7`**: plugin code verified against
  the rc.7 `llm` service (`resolveModelInfo` / `listModels` /
  `adapter.stream` / `llm/adapters-updated`) and `attachments` service
  (`readImage`) — both unchanged from rc.6 — no code changes required.
  Configuration and install docs now target `0.1.0-rc.7`.

### Fixed

- **Duplicate loader entry id trap**: dsh `0.1.0-rc.7` (cordis-plugin-loader
  `1.0.2`) rejects two composed rows sharing one loader entry id, failing the
  boot with `duplicate loader entry id: windows-ocr`. The docs previously let
  users install the plugin **both** as an npm bundle **and** as a manual
  `cordis.patch.yml` insert (same id, twice). Install modes are now documented
  as mutually exclusive.
- **Broken config-override example**: the documented `- update:` patch form is
  not part of the dsh patch dialect and was silently skipped. The READMEs and
  agents-install now show the correct id-targeted override row
  (`- id: windows-ocr` + `config:`), which replaces the existing row's config
  without registering a second entry.

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
