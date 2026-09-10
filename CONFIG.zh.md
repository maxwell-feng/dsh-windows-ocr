# 配置说明文档 (Configuration Guide)

[English](CONFIG.md) | 简体中文

本文档详细说明 `dsh-windows-ocr` 插件在 DeepSeek Harness 中的全部配置项、默认值与高级场景。

---

## 1. 字段配置列表

| 配置字段 | 类型 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- |
| `language` | `string` | `""` | OCR 识别语言标记（如 `"zh-Hans-CN"`, `"en-US"`）。留空表示自动使用 Windows 系统首选语言。 |
| `passthrough` | `boolean` | `false` | **视觉模型原图透传开关**。默认为 `false`（所有附件图片均强制在本地进行 OCR 转换，文本发往模型，保护隐私）；设为 `true` 时，原生支持图像的视觉模型将接收原始图片字节，纯文本模型依然自动 OCR。 |
| `timeoutMs` | `number` | `60000` | 单张图片 OCR 处理的最长等待超时时间（毫秒）。超时后将自动终止进程并清理临时文件。 |
| `maxCacheEntries` | `number` | `200` | 内存中 OCR 结果的缓存条目上限（按附件 id 索引，避免在多轮对话中重复识别相同图片；超限时淘汰最早条目）。 |
| `ocrScript` | `string` | 内置 `ocr.ps1` | Windows Media OCR 底层 PowerShell 驱动脚本路径，一般无需更改。 |

---

## 2. 静态配置示例 (`cordis.patch.yml`)

在 Profile 的 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 中添加配置：

```yaml
- id: windows-ocr
  config:
    language: "zh-Hans-CN"    # 强制优先使用简体中文 OCR 识别包
    passthrough: false        # 严格隐私模式：不向任何模型上传图片原图
    timeoutMs: 30000          # 30 秒超时
    maxCacheEntries: 500      # 扩大内存缓存容量
```

---

## 3. 语言包安装建议

Windows OCR 依赖系统已安装的语言包 OCR 组件。若识别特定语言效果不佳，请在 Windows 设置中：
- 打开 **设置 -> 时间和语言 -> 语言和区域**
- 在目标语言选项中，确保已勾选并下载安装 **“光学字符识别 (OCR)”** 功能。
