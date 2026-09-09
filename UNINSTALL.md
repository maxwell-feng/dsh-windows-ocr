# Uninstall Guide

English | [简体中文](UNINSTALL.zh.md)

This document explains how to completely uninstall `dsh-windows-ocr` from your DeepSeek Harness profiles.

---

## 1. Remove the Plugin Bundle

```bash
dsh plugin --profile web remove dsh-windows-ocr
```

This uninstalls the npm package from the profile and purges the active bundle layer.

---

## 2. Clean Up Custom Config (Optional)

Remove the patch row from `$DSH_HOME/profiles/<profile>/cordis.patch.yml`:

```yaml
# Remove this block
- id: windows-ocr
  config:
    ...
```

---

## 3. Verification

Start `dsh web` and verify text-only models safely refuse image attachments as expected when no OCR plugin is loaded.
