# Update Guide

English | [简体中文](UPDATE.zh.md)

> Verified against DeepSeek Harness **0.1.5-alpha.1**.

This document outlines how to upgrade `dsh-windows-ocr` to the latest release and verify compatibility.

---

## 1. Upgrade Instructions

### Upgrading via npm
```bash
dsh plugin --profile web update dsh-windows-ocr@latest
```
or pin version:
```bash
dsh plugin --profile web add dsh-windows-ocr@0.4.0
```

### Upgrading via Git Checkout
```bash
cd /path/to/dsh-windows-ocr
git pull origin main
pnpm install
npm run build
```
or refresh via GitHub link:
```bash
dsh plugin --profile web add github:maxwell-feng/dsh-windows-ocr
```

### Upgrading via Tarball
```bash
dsh plugin --profile web add ./dsh-windows-ocr-0.4.0.tgz
```

---

## 2. Verification and Rollback

Launch the profile:
```bash
dsh web
```
In a text-only model session (e.g. DeepSeek-V3 / DeepSeek-R1), attach an image containing text and confirm the model answers based on the recognized text.

To roll back:
```bash
dsh plugin --profile web add dsh-windows-ocr@0.3.8
```
