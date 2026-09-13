# 更新日志

[English](CHANGELOG.md) | 中文

本项目的所有重要变更均记录于此。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/)，并遵循 [语义化版本规范](https://semver.org/lang/zh-CN/)。

## [0.8.1] - 2026-09-13

### 移除与清理

- **清理仓库死产物与冗余文件**：
  - 从版本控制中彻底移除了遗留的历史 tarball 产物包（`dsh-windows-ocr-0.4.0.tgz`、`dsh-windows-ocr-0.5.0.tgz`、`dsh-windows-ocr-0.6.0.tgz`）以及冗余的 `package-lock.json`（统一使用 pnpm）。
- **文档与 0.1.5-rc.2 同步**：
  - 全面刷新双语文档体系（`INSTALL.md`, `INSTALL.zh.md`, `UPDATE.md`, `UPDATE.zh.md`, `USAGE.md`, `USAGE.zh.md`, `CONFIG.md`, `CONFIG.zh.md`, `UNINSTALL.md`, `UNINSTALL.zh.md`, `README.md`, `README.zh.md`），明确标注经 DeepSeek Harness `0.1.5-rc.2` 全面验证。

---

## [0.8.0] - 2026-09-11

### 变更

- **纯 TypeScript 架构重构（零 JavaScript 残留）**：
  - 遵循 DeepSeek Harness 官方规范全面重构为纯 TypeScript 代码库；
  - 移除了所有旧的 `.mjs` / `.js` 文件；
  - 测试套件转为纯 TypeScript（`test/standalone-test.test.ts`），由 Node `--experimental-strip-types` 原生运行；
  - 细化模块职责分工，100% 测试通过。
