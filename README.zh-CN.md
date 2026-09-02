# windows-ocr

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）插件：让**纯文本模型**也能"看"附件图片——图片在**本机**用 Windows 自带 OCR 引擎（`Windows.Media.Ocr`）识别，只有识别出的**文字**会发给模型 API。

**隐私默认**：图片字节在本机 OCR，不会发给服务商。只有当你明确想让真正的视觉模型接收原图时，才设置 `passthrough: true`。

- 不需要改任何模型配置——不用在 `settings.yaml` 里给模型加 `input: [text, image]`。
- 对 dsh 里的任何 provider/模型通用；默认所有附件图片在出站前都会先 OCR。
- 视觉模型透传是**可选开启**的（`passthrough: true`）。
- 默认安全（fail-closed）：插件没加载时，模型保持纯文本，图片附件会被拒绝——不存在静默泄漏；缺失 attachment 的图片块会被替换为拒绝文本，绝不会以原始 `image` 块保留。

## npm 安装

```bash
dsh plugin --profile web add dsh-windows-ocr
```

（把 `web` 换成你的 profile，如 `tui`。）预编译发布（含 Sigstore provenance），无需源码构建或 `allowBuilds` 授权。从本仓库源码安装仍可用下方 agent 指南或手动步骤。

或者从仓库 / tarball 安装：

```bash
dsh plugin --profile web add ./dsh-windows-ocr        # 源码目录
dsh plugin --profile web add ./dsh-windows-ocr-0.3.2.tgz
dsh plugin --profile web add github:maxwell-feng/dsh-windows-ocr
```

> Git 安装拿到的是源码而非构建产物：包的 `prepare` 脚本会运行 `tsc` 从源码
> 重建 `lib/`，并且 pnpm ≥ 10 需要一次性允许构建（它会打印确切的
> `pnpm-workspace.yaml` 片段）。

> **npm 安装会自行注册 `windows-ocr` 这一行。** 该包自带 bundle 补丁（`dsh.bundle` + 它自己的 `cordis.patch.yml`），已经插入了 `windows-ocr` 这个 loader 条目。请**不要**再往 profile 里手动 `- insert:` 一行同 id 的条目——dsh `0.1.2-alpha.5`会拒绝重复的 loader 条目 id，`dsh web` 会以 `duplicate loader entry id: windows-ocr` 启动失败。

## 让 AI agent 快速安装

把这个仓库交给任何 AI agent，或直接粘贴下面的指令，agent 会替你完成安装与验证：

> 请按照 <https://github.com/maxwell-feng/dsh-windows-ocr/blob/main/agents-install.md> 安装本仓库的 dsh 插件。执行每一项前置检查，选择一种安装方式，然后完成强制验证：在纯文本模型会话里附加一张图片，确认模型能答出图片中的文字。

[`agents-install.md`](./agents-install.md) 是一份写给 AI agent 的分步手册：前置检查、两种安装方式（profile 永久 / `--patch` 临时）、强制功能验证，以及常见失败模式的排查。手动安装说明见下文。

## 为什么是插件而不是 skill

dsh 的 skill 只是注入模型上下文的 Markdown 指令：不能执行代码、不能钩住请求管线、更拦不住图片被序列化上传。这个功能恰好需要这些，所以它是一个 cordis 插件，钩住 `llm` 服务的两个公开接缝：

1. **能力声明（shim）**——包装 `ctx.llm.resolveModelInfo`（以及 `listModels`）。宿主在三处用 `inputModalities.includes("image")` 拦截图片：发送准入、切换模型、`read_image` 工具。shim 让回答变成"支持"，文本模型即可收图。
2. **步前改写**——`agent/pre-step`，官方提供的、用于替换进入模型调用的消息的接缝（"拒绝一个即将开始的 step，或替换进入它的消息"）。请求构建前，所有 `image` 内容块已被替换成 OCR 文本块，附件字节永远不会被序列化，也永远不会生成 `image_url`。它覆盖所有派发路径——`ctx.llm.stream` 和 `prepareCall().stream` 都从该 step 的消息构建请求；包装 `adapter.stream` 已不再有效，因为内置适配器重写了 `prepareCall()`，通过绑定代的闭包派发。

```
你附加图片
  → 准入层问 ctx.llm.resolveModelInfo（shim 返回含 "image" ✓）
  → 图片存入本地附件库（会话日志、UI 预览）
  → agent 循环提出 step → agent/pre-step（改写）
  → 本地读取图片字节（ctx.attachments.readImage）→ Windows OCR
  → 图片块替换为 <image_ocr>…识别文字…</image_ocr>
  → 用 OCR 后的消息构建请求 → 适配器只序列化文本 → 发给服务商
```

## 环境要求

- Windows 10/11（自带 Windows PowerShell 5.1，无需安装任何东西）
- 你所用语言对应的 OCR 语言包（设置 → 时间和语言 → 语言）。英文一般自带；中文需要安装中文语言包（含 OCR 能力）。
- 已安装 `dsh` 及 profile（在 dsh `0.1.2-alpha.5` 上验证）

## 安装

### 让 AI agent 安装

本仓库的 [`agents-install.md`](./agents-install.md) 是一份**写给 AI agent**（也适合细心的人工）的分步安装手册。把这份文档交给 agent——例如对它说"按照 https://github.com/maxwell-feng/dsh-windows-ocr 的 `agents-install.md` 安装这个插件"——agent 就能自主完成前置检查、安装、验证和故障排查。手册涵盖两种安装方式、必须做的功能验证（附加图片 → 模型回答 OCR 文字）以及常见的失败模式。

### 手动安装

两种官方加载方式，patch 行都用**绝对路径**指向插件文件（见 `docs/user/develop/basic`）。Windows 上路径必须是 `file://` URL——裸写 `C:/...` 会被解析成 `c:` URL scheme 而被 loader 拒绝。

### 永久安装：profile 补丁层

在 profile 的 `cordis.patch.yml`（如 `~/.dsh/profiles/web/cordis.patch.yml`）追加：

```yaml
- insert:
    - id: windows-ocr
      name: 'file:///C:/绝对路径/windows-ocr/lib/index.js'
      config:
        language: ''
        passthrough: false
```

然后重启 `dsh web`。删掉这几行即卸载——插件在卸载时会恢复被替换的 `llm`/adapter 原方法。

> **两种加载方式二选一**：npm bundle（上文）**或**这里的手动 insert——绝不能同时用。两者注册的是同一个 `windows-ocr` 条目 id，而 dsh `0.1.2-alpha.5` 在行重复出现时会以 `duplicate loader entry id: windows-ocr` 拒绝启动。如果这一行已经存在（例如已按 npm bundle 方式安装），请用下方的按 id 覆盖方式改配置，而不是再插入一行。

### 临时加载：`--patch` overlay

把同样的行写进一个 overlay 文件，启动时带上；profile 保持不动：

```bash
dsh --profile web --patch C:/path/to/overlay.yml
```

### 注意事项

- `dsh web` 报 `EADDRINUSE`（3080 被占用）说明有旧实例还在跑：用 `netstat -ano | findstr :3080` 找到 PID，`taskkill /PID <pid> /F` 关掉再启动。
- 打包分发（npm / tarball / `github:user/repo`）时按组合包方式打包（`dsh.bundle` + `cordis.patch.yml`，见 `docs/user/develop/basic/publish`）；git 安装还需要 `prepare` 构建脚本和 pnpm `allowBuilds` 授权。

确认插件已加载：启动日志里应有 `windows-ocr`；或者直接跑下面的冒烟测试。

## 配置

所有配置都在 `windows-ocr` 这一行（本目录 `cordis.patch.yml`），可在你 profile 的 `cordis.patch.yml` 里覆盖。配置会在加载时校验（Schemastery `Config` schema）——非法取值会带着可定位的错误启动失败，而不是被静默忽略：

| 键 | 默认 | 含义 |
|---|---|---|
| `language` | `""` | Windows OCR 的 BCP-47 语言标签，如 `zh-Hans`、`en-US`；空 = 用户配置文件语言 |
| `passthrough` | `false` | `false`（默认）：所有图片一律走 OCR；`true`：真视觉模型图片原样透传 |
| `ocrScript` | 自带 `lib/ocr.ps1` | PowerShell OCR 脚本的绝对路径覆盖 |
| `timeoutMs` | `60000` | 单张图片 OCR 超时（毫秒） |
| `maxCacheEntries` | `200` | 单次运行 OCR 缓存上限（按附件 id） |

覆盖示例（`~/.dsh/profiles/web/cordis.patch.yml`）——用**按 id 覆盖**的行（不是 `insert:`）替换 `windows-ocr` 这一行的 config：

```yaml
- id: windows-ocr
  config:
    language: zh-Hans
```

## 使用说明

附加任意图片到文本模型会话并发送——插件在 `agent/pre-step` 拦截，本地经 `Windows.Media.Ocr` 识别，并在请求构建前将 `image` 块替换为文本块。无需改动任何代码或模型配置；dsh 中所有 provider/模型均受益。

## 模型看到什么

每个图片块变成一个文本块（**不转发本地文件名**）：

```
<image_ocr>
…识别出的文字行…
</image_ocr>
```

识别结果按附件 id 在 dsh 进程生命周期内缓存，重复轮次不会重复 OCR。

## 临时文件自动清理

每次 OCR 都会把输入图片和输出文本写入系统临时目录下**新建的临时目录**（`windows-ocr-*`）。该目录在 `finally` 中自动删除——成功、OCR 报错、超时都会删——每次产生的脚本、图片和输出文件都不会残留。插件启动时还会清扫上次进程崩溃遗留的孤儿 `windows-ocr-*` 目录。除插件自己的临时目录和 dsh 附件库外，不写任何其他位置。

## 冒烟测试（不需要 dsh）

```powershell
# 1x1 PNG——验证 WinRT 加载、语言包可用性、识别链路
powershell.exe -NoProfile -ExecutionPolicy Bypass -File lib/ocr.ps1 -ImagePath test.png -OutFile out.txt
Get-Content out.txt
```

退出码 0 且 `out.txt` 为空/空白，说明 OCR 引擎正常（1×1 图本来就没有文字）。退出码 2/3 说明缺语言包。

## 在 dsh 里验证

1. 在文本模型会话里附加一张图片并发送——模型应能引用识别出的文字作答。
2. 确认图片没出站：web UI 打开 DevTools → Network，查看发往服务商 baseURL 的请求，确认 payload 里只有 `text` 内容块（没有 `image_url`/data URI）。

## 卸载说明

```bash
dsh plugin --profile web remove dsh-windows-ocr
```

手动安装时，从 profile 的 `cordis.patch.yml` 删除 `windows-ocr` 行并重启 `dsh --profile web`。插件卸载时恢复原始 `llm` shim；卸载后文本模型的图片附件将重新被拒绝（fail-closed）。

## 已知限制

- OCR 语言取决于系统安装的语言包（脚本退出码 2/3 时，插件降级为占位文本）。
- GIF：Windows OCR 只识别第一帧。
- 缓存按进程存活；长会话的 OCR 文本会缓存，受 `maxCacheEntries` 限制。
- 插件注册一个 fiber 作用域的 `agent/pre-step` 监听器，卸载时恢复 `llm` 能力 shim。dsh 升级后仍建议完整重启。
- 模型选择 UI 上文本模型可能不带"图片"徽标（纯外观，`listModels` 已一致地 shim）。
- 移除插件后，文本模型的图片附件会重新被拒绝（fail-closed），不会被上传。

## License

MIT
