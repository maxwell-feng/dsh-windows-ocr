# Configuration Guide

English | [简体中文](CONFIG.zh.md)

This document describes all configuration options, type contracts, and defaults for `dsh-windows-ocr`.

---

## 1. Options Reference

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `language` | `string` | `""` | BCP-47 language tag (e.g. `"en-US"`, `"zh-Hans-CN"`). Empty string defaults to Windows system language. |
| `passthrough` | `boolean` | `false` | When `false` (default), all images are OCR'd locally and never leave the machine. When `true`, genuine multimodal models receive image bytes while text-only models are still OCR'd. |
| `timeoutMs` | `number` | `60000` | Maximum time in milliseconds to wait for a single OCR execution before aborting. |
| `maxCacheEntries` | `number` | `200` | Maximum number of OCR results cached in memory by attachment hash. |
| `ocrScript` | `string` | Bundled `ocr.ps1` | Path to the helper PowerShell script that executes `Windows.Media.Ocr`. |

---

## 2. Profile Patch Example (`cordis.patch.yml`)

Add to `$DSH_HOME/profiles/<profile>/cordis.patch.yml`:

```yaml
- id: windows-ocr
  config:
    language: "en-US"
    passthrough: false
    timeoutMs: 30000
    maxCacheEntries: 500
```
