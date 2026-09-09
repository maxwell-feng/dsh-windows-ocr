# 卸载说明文档 (Uninstall Guide)

[English](UNINSTALL.md) | 简体中文

本文档指导如何从 DeepSeek Harness 的指定 Profile 中完整卸载 **dsh-windows-ocr** 插件。

---

## 1. 移除插件包 (Bundle)

```bash
dsh plugin --profile web remove dsh-windows-ocr
```

该命令将从目标 profile 依赖中移除该包，并清除 `dsh.profile.bundles` 中的补丁层。

---

## 2. 清理自定义配置 (可选)

如果你曾在 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 中添加过覆盖项，请移除对应的条目：

```yaml
# 移除此配置块
- id: windows-ocr
  config:
    ...
```

---

## 3. 验证卸载

启动 DeepSeek Harness：
```bash
dsh web
```
此时纯文本模型将恢复默认行为（若上传图片附件，系统准入层将安全拒绝，不会发生 OCR 拦截）。
