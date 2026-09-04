# Changelog

## [0.3.8] - 2026-09-04

### Compatibility / 兼容性

- **Verified against deepseek-harness `0.1.3-alpha.1` (latest release).** No seam changes since `0.1.2-rc.1`: the `ctx.llm.resolveModelInfo` shim and the `agent/pre-step` message rewrite remain the stable integration points, and `ctx.attachments.readImage` is source-identical between the two tags (0.1.3's new file-attachment types are additive and untouched by this plugin). The vendored `@deepseek-ai/cordis` `4.0.2` and the loader/bundle patch mechanism are unchanged, so no code migration is required. 0.1.3's headline changes (environment-proxy support, Session persistence rework) do not touch any service this plugin consumes. README requirements and bundle notes now reference `0.1.3-alpha.1`; tests ALL PASS. / **已在 deepseek-harness `0.1.3-alpha.1` 最新发行版上验证。** 自 `0.1.2-rc.1` 以来无缝接口变更：`ctx.llm.resolveModelInfo` 能力补丁 + `agent/pre-step` 消息改写仍为稳定集成点，`ctx.attachments.readImage` 在两个 tag 之间源码完全一致（0.1.3 新增的文件附件类型为纯增量，本插件不涉及）。内置 `@deepseek-ai/cordis` `4.0.2` 与 loader / bundle 补丁机制均未变化，无需代码迁移。0.1.3 的主要变更（环境代理支持、Session 持久化重构）均不涉及本插件消费的任何服务。README 环境要求与 bundle 说明现已引用 `0.1.3-alpha.1`；测试全部通过。

## [0.3.7] - 2026-09-03

### Compatibility / 兼容性

- **Verified against deepseek-harness `0.1.2-rc.1` (latest `master`).** No seam changes since `0.1.2-alpha.5` (`ctx.llm.resolveModelInfo` shim + `agent/pre-step` rewrite remain the stable integration points); the vendored `@deepseek-ai/cordis` `4.0.2` and the loader/bundle patch mechanism are unchanged, so no code migration is required. README requirements and bundle notes now reference `0.1.2-rc.1`; tests ALL PASS. / **已在 deepseek-harness `0.1.2-rc.1` 最新 `master` 上验证。** 自 `0.1.2-alpha.5` 以来无缝接口变更（`ctx.llm.resolveModelInfo` 能力补丁 + `agent/pre-step` 改写仍为稳定集成点）；内置 `@deepseek-ai/cordis` `4.0.2` 与 loader / bundle 补丁机制均未变化，无需代码迁移。README 环境要求与 bundle 说明现已引用 `0.1.2-rc.1`；测试全部通过。

## [0.3.6] - 2026-09-02

### Compatibility / 兼容性

- **Verified against deepseek-harness `0.1.2-alpha.5` (latest `master`).** No seam changes since `0.1.2-alpha.4` (`ctx.llm.resolveModelInfo` shim + `agent/pre-step` rewrite remain the stable integration points). README requirements and bundle notes now reference `0.1.2-alpha.5`; no code migration required. / **已在 deepseek-harness `0.1.2-alpha.5` 最新 `master` 上验证。** 自 `0.1.2-alpha.4` 以来无缝接口变更（`ctx.llm.resolveModelInfo` 能力补丁 + `agent/pre-step` 改写仍为稳定集成点）。README 环境要求与 bundle 说明现已引用 `0.1.2-alpha.5`；无需代码迁移。

## [0.3.5] - 2026-09-02

### Compatibility / 兼容性

- **Verified against deepseek-harness `0.1.2-alpha.4` (latest `master`).** No seam changes since `0.1.2-alpha.3` (`ctx.llm.resolveModelInfo` shim + `agent/pre-step` rewrite remain the stable integration points). Bumped tarball reference to `0.3.5` and completed bilingual six-section coverage (Release / Changelog / Install / Uninstall / Usage / Config). No code migration required. / **已在 deepseek-harness `0.1.2-alpha.4` 最新 `master` 上验证。** 自 `0.1.2-alpha.3` 以来无缝接口变更（`ctx.llm.resolveModelInfo` 能力补丁 + `agent/pre-step` 改写仍为稳定集成点）。安装包引用升级至 `0.3.5`，并补齐双语六项覆盖（发行版 / 更新说明 / 安装 / 卸载 / 使用 / 配置）。无需代码迁移。

## [0.3.3] - 2026-08-31

### Compatibility / 兼容性

- **Adapted to deepseek-harness `0.1.2-alpha.2` (master)**: the `agent/pre-step`
  waterfall payload and `PreStepDecision`, the `resolveModelInfo` /
  `listModels` capability shim, and `attachments.readImage` are unchanged
  from `0.1.2-alpha.1`, so no plugin code changes were required.
  `@deepseek-ai/cordis` moves to `4.0.2`.
- **适配 deepseek-harness `0.1.2-alpha.2`（master）**：`agent/pre-step`
  瀑布事件的载荷与 `PreStepDecision`、`resolveModelInfo` / `listModels`
  能力 shim 以及 `attachments.readImage` 均与 `0.1.2-alpha.1` 一致，因此
  无需改动插件代码。`@deepseek-ai/cordis` 升至 `4.0.2`。

### Added / 新增

- The plugin now exports the documented `Config` Schemastery schema
  (docs/user/develop/basic/config), so the loader validates configuration and
  fills defaults (including the bundled `ocr.ps1` path) before `apply()` runs;
  invalid config fails the boot loudly instead of being silently ignored.
  `@deepseek-ai/schemastery` `3.18.2` is pinned and a `@deepseek-ai/cordis`
  peer range (`>=4.0.0 <5.0.0`) declares the supported framework floor.
- 插件现在按文档导出 `Config` Schemastery schema
  （docs/user/develop/basic/config）：加载器在 `apply()` 之前校验配置并填充
  默认值（含随包 `ocr.ps1` 的路径），非法配置会大声地启动失败，而不再被
  静默忽略。锁定 `@deepseek-ai/schemastery` `3.18.2`，并新增
  `@deepseek-ai/cordis` 的 peer 区间（`>=4.0.0 <5.0.0`）以声明所支持的
  框架下限。

## [0.3.2] - 2026-08-30

### Changed

- README: install section aligned with the `dsh-tinyfish-search` layout —
  `dsh plugin add` plus repository / tarball / `github:` alternatives
  (README.md and README.zh-CN.md).

## [0.3.1] - 2026-08-30

### Changed

- **npm package renamed back to unscoped `dsh-windows-ocr`** (dropped the
  `@maxwell-feng/` scope, aligned with the `dsh-tinyfish-search` convention).
  Install commands, badges and docs use the new name; the scoped package is
  deprecated on npm. No code, config or behavior changes otherwise.

## [0.3.0] - 2026-08-29

### Compatibility

- **Adapted to deepseek-harness `0.1.2-alpha.1` (master)**: the image→OCR
  rewrite moved from the `adapter.stream` monkey-patch to the official
  `agent/pre-step` waterfall ("Reject a proposed step or replace the messages
  that enter it"). The bundled adapters now override `prepareCall()` and
  dispatch through generation-bound closures that bypass `adapter.stream`, so
  the old seam no longer intercepted anything; `agent/pre-step` covers every
  dispatch path because both `ctx.llm.stream` and `prepareCall().stream`
  build from the step's messages. `@deepseek-ai/cordis` stays `4.0.1`.
- The `resolveModelInfo` / `listModels` capability shim and the
  `attachments.readImage` usage are unchanged and remain compatible.
- Registration is now a single fiber-scoped `agent/pre-step` listener
  (`prepend`), replacing the `llm/adapters-updated` re-wrap machinery; the
  standalone test drives the rewrite through the pre-step seam.

All notable changes to this project are documented in this file.

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
