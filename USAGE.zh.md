# 使用说明文档 (Usage Guide)

[English](USAGE.md) | 简体中文

附加任意图片到**纯文本**模型会话并发送——插件在本地经 `Windows.Media.Ocr`
识别，并在请求构建前将 `image` 块替换为文本块。无需改动任何代码或模型配置；
dsh 中所有 provider/模型均受益。

---

## 1. 基本用法

1. 打开一个纯文本模型会话（如 DeepSeek-V3 / DeepSeek-R1）。
2. 附加一张带文字的图片，发送消息询问图片内容。
3. 模型引用识别出的文字作答。图片字节不会离开本机（除非你按第 3 节主动
   开启视觉透传）。

---

## 2. OCR 参数

以下 `windows-ocr` 配置项控制识别行为。默认值与 `cordis.patch.yml` 以及
`src/index.ts` 中经加载器校验的 `Config` schema 一致：

| 键 | 默认 | 含义 |
|---|---|---|
| `language` | `""` | Windows OCR 的 BCP-47 语言标签，如 `zh-Hans`、`en-US`；空 = 用户配置文件语言 |
| `passthrough` | `false` | `false`（默认）：所有图片一律走 OCR；`true`：真视觉模型图片原样透传（见第 3 节） |
| `ocrScript` | 自带 `lib/ocr.ps1` | PowerShell OCR 脚本的绝对路径覆盖 |
| `timeoutMs` | `60000` | 单张图片 OCR 超时（毫秒） |
| `maxCacheEntries` | `200` | 单次运行 OCR 缓存上限（按附件 id） |

覆盖示例（`~/.dsh/profiles/web/cordis.patch.yml`）——用**按 id 覆盖**的行
（不是 `insert:`）替换 `windows-ocr` 这一行的 config：

```yaml
- id: windows-ocr
  config:
    language: zh-Hans
    timeoutMs: 30000
```

非法取值会带着可定位的错误启动失败，而不是被静默忽略。完整说明见
[配置说明文档](CONFIG.zh.md)。

---

## 3. 模型看到什么

每个图片块变成一个文本块（**不转发本地文件名**）：

```
<image_ocr>
…识别出的文字行…
</image_ocr>
```

- 识别结果按附件 id 在 dsh 进程生命周期内缓存（受 `maxCacheEntries` 限制），
  重复轮次不会重复 OCR。
- 空识别结果降级为 `(OCR: no text recognized)`；引擎报错降级为
  `(OCR: failed to recognize this image)`；缺失 attachment 引用的图片块降级
  为拒绝文本——绝不会给适配器留下原始 `image` 块（fail-closed）。

### 透传矩阵

| `passthrough` | 纯文本模型 | 真视觉模型 |
|---|---|---|
| `false`（默认） | OCR 文字 | OCR 文字 |
| `true` | OCR 文字 | 原始图片字节 |

---

## 4. 仅 Windows 说明

- 仅支持 Windows 10/11。自带的 `lib/ocr.ps1` 通过 Windows PowerShell 5.1
  驱动系统内置 `Windows.Media.Ocr` WinRT API——无需安装任何东西，也没有
  Linux/macOS 路径。
- OCR 语言取决于系统安装的语言包（设置 → 时间和语言 → 语言；该语言需要带
  OCR 组件）。配置的语言缺失时退出码为 2；系统完全没有可用 OCR 语言时退出
  码为 3——两种情况都降级为占位文本，绝不会上传原图。
- GIF：Windows OCR 只识别第一帧。
- 每次 OCR 都会把输入图片和输出文本写入系统临时目录下**新建的临时目录**
  （`windows-ocr-*`），成功、报错、超时都会自动删除。插件启动时还会清扫
  上次进程崩溃遗留的孤儿目录。

---

## 5. 示例

OCR 引擎冒烟测试（不需要 dsh）：

```powershell
# 1x1 PNG——验证 WinRT 加载、语言包可用性、识别链路
powershell.exe -NoProfile -ExecutionPolicy Bypass -File lib/ocr.ps1 -ImagePath test.png -OutFile out.txt
Get-Content out.txt
```

对话示例——用户附加一张收据照片并发送：

```
What is the total on this receipt?
```

模型收到的不是照片，而是 `<image_ocr>` 标签包裹的识别文字行，并据此答出
总金额。

中文识别——按第 2 节设置 `language: zh-Hans`，附加一张中文截图，模型即引用
识别出的中文作答。需要系统安装带 OCR 组件的中文语言包。
