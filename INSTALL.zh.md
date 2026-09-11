# 安装说明文档 (Install Guide)

[English](INSTALL.md) | 简体中文

> 本版本已在 DeepSeek Harness **0.1.5-rc.2** 上验证。需要 Windows 10/11。
> 从源码构建需要 Node.js **>=22**。

---

## 1. 安装方式（四选一）

以下命令中的 `web` 请替换为你的 profile 名（如 `tui`）。

### 从 npm 安装（推荐）

```bash
dsh plugin --profile web add dsh-windows-ocr
```

预编译发布（含 Sigstore provenance），无需源码构建或 `allowBuilds` 授权。

### 从 release tarball 安装（离线）

```bash
dsh plugin --profile web add ./dsh-windows-ocr-0.6.0.tgz
```

每个 GitHub release 都附带对应版本的 tarball。

### 从 GitHub 安装

```bash
dsh plugin --profile web add github:maxwell-feng/dsh-windows-ocr
```

> Git 安装拿到的是源码而非构建产物：包的 `prepare` 脚本会运行 `tsc` 从源码
> 重建 `lib/`，并且 pnpm ≥ 10 需要一次性允许构建（它会打印确切的
> `pnpm-workspace.yaml` 片段）。

### 从源码目录安装

```bash
cd C:/path/to/dsh-windows-ocr
npm install
npm run build
dsh plugin --profile web add ./dsh-windows-ocr
```

> **npm 安装会自行注册 `windows-ocr` 这一行。** 该包自带 bundle 补丁
> （`dsh.bundle` + 它自己的 `cordis.patch.yml`），已经插入了 `windows-ocr`
> 这个 loader 条目。请**不要**再往 profile 里手动 `- insert:` 一行同 id
> 的条目——dsh `0.1.5-rc.2` 会拒绝重复的 loader 条目 id，`dsh web` 会以
> `duplicate loader entry id: windows-ocr` 启动失败。

---

## 2. 手动安装（不用 npm）

两种官方加载方式，patch 行都用**绝对路径**指向插件文件。Windows 上路径
必须是 `file://` URL——裸写 `C:/...` 会被解析成 `c:` URL scheme 而被
loader 拒绝。

### 永久安装：profile 补丁层

在 profile 的 `cordis.patch.yml`
（如 `~/.dsh/profiles/web/cordis.patch.yml`）追加：

```yaml
- insert:
    - id: windows-ocr
      name: 'file:///C:/绝对路径/windows-ocr/lib/index.js'
      config:
        language: ''
        passthrough: false
        timeoutMs: 60000
        maxCacheEntries: 200
```

然后重启 `dsh web`。

> **两种加载方式二选一**：npm bundle（第 1 节）**或**这里的手动 insert——
> 绝不能同时用。两者注册的是同一个 `windows-ocr` 条目 id。
> 如果这一行已经存在（例如已按 npm bundle 方式安装），请用按 id 覆盖方式
> 改配置，而不是再插入一行：

```yaml
- id: windows-ocr
  config:
    language: zh-Hans
```

### 临时加载：`--patch` overlay

把同样的 `- insert:` 行写进一个 overlay 文件，启动时带上；profile 保持不动：

```bash
dsh --profile web --patch C:/path/to/overlay.yml
```

---

## 3. 验证安装（必须做）

1. 组合检查：

   ```bash
   dsh --profile web --dump-config
   ```

   输出中必须出现 `windows-ocr` 这一行。
2. OCR 引擎冒烟测试（不需要 dsh）：

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File lib/ocr.ps1 -ImagePath test.png -OutFile out.txt
   Get-Content out.txt
   ```

   退出码 0 且 `out.txt` 为空/空白，说明 OCR 引擎正常（1×1 图本来就没有
   文字）。退出码 2/3 说明缺语言包。
3. 功能验证（真正的证明）：在**纯文本**模型会话里附加一张带文字的图片，
   问模型图片里写了什么。预期：消息被**接受**（没有"模型不支持图片"报错），
   且模型能答出识别到的文字。
4. 隐私检查：在 DevTools → Network 里查看发往服务商 baseURL 的请求，确认
   payload 里只有 `text` 内容块——没有图片 data URI。

`EADDRINUSE`（3080 被占用）说明有旧的 `dsh web` 实例还在跑：用
`netstat -ano &#124; findstr :3080` 找到 PID，`taskkill /PID <pid> /F`
关掉再启动。

---

## 4. 下一步

- [使用说明文档](USAGE.zh.md)——OCR 参数、仅 Windows 说明、示例。
- [配置说明文档](CONFIG.zh.md)——全部选项的类型与默认值。
- [更新说明文档](UPDATE.zh.md)——版本间升级。
- [卸载说明文档](UNINSTALL.zh.md)——干净卸载。
