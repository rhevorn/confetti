# Confetti

为 VS Code 提供 nginx、dotenv、gitignore、hosts、TOML、YAML 等 16+ 种配置文件的智能识别、语法高亮和格式化能力。

[English documentation](https://github.com/rhevorn/confetti/blob/main/README.md)

## 安装

从 [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=rhevorn.confetti) 安装 **Confetti**，也可以在 VS Code 扩展视图中搜索 `Confetti`、`config formatter`、`gitignore`、`nginx format` 或 `dotenv`。

## 为什么选择 Confetti？

配置文件支持非常碎片化。一个项目中可能同时存在 `nginx.conf`、`.env.local`、`.npmrc`、`.gitconfig`、`ssh_config`、`pyproject.toml` 和多个含义不同的 `.conf` 文件，通常需要分别安装不同插件。

Confetti 用一个插件提供统一体验：

- 根据文件名、路径和内容智能识别配置类型
- 使用 TextMate Grammar 提供兼容不同主题的语法高亮
- 使用每种格式独立的规则支持 Format Document
- 不需要账号、AI 服务、云端服务或网络连接

无法可靠识别文件时，Confetti 不会强制修改语言模式。

## 性能与资源占用

Confetti 不会在每次输入时持续扫描整个文档。检测只发生在打开、切换、保存文件或手动执行检测时；格式化只在 VS Code 或用户明确请求时执行。

使用生成的 Nginx 配置进行核心基准测试：

| 文件大小 | 检测 p95 | 格式化 p95 |
| -------- | -------: | ---------: |
| 100 KB   |    ≤3 ms |      ≤8 ms |
| 1 MB     |   ≤30 ms |     ≤80 ms |

资源占用情况：

- 1.2.0 的 VSIX 约为 **137 KB**，没有运行时 npm 依赖。
- 检测 1 MB 示例后，保留检测结果时堆内存增量约 **0.06 MB**；释放结果并执行 GC 后约为 **0.02 MB**。
- 格式化 1 MB Nginx 示例后，立即测得的临时堆内存增量最高约 **75 MB**；释放结果并执行 GC 后，增量回到接近零。Tokenization 和格式化会处理完整文档，因此临时内存会随文件大小增长。
- 检测缓存只保存很小的结果对象，并在文档关闭时删除。
- 没有轮询任务、后台索引、网络客户端、遥测客户端、Webview 或 Language Server。

以上数据测量的是 Confetti 核心逻辑，不是 VS Code Extension Host 的总内存。VS Code 会让多个扩展共享 Extension Host 进程，并自行管理 TextMate Grammar 内存，因此无法准确分离单个扩展的空闲 RSS。实际结果会随硬件和文件内容变化。

测试环境：Apple Silicon（`darwin arm64`）、Node.js 24.14.1；预热 10 次，100 KB 测量 100 次，1 MB 测量 30 次。表格对多次本地运行中较慢的 p95 向上取整，其中包括紧接完整测试和构建流程之后的运行。可以运行 `npm run benchmark` 复现。

## 支持的格式

| 格式               | 场景文件                                            | 高亮 | 格式化 |
| ------------------ | --------------------------------------------------- | :--: | :----: |
| Nginx              | `nginx.conf`，以及根据内容识别的 Nginx `.conf` 文件 |  ✅  |   ✅   |
| SSH                | `~/.ssh/config`、`ssh_config`、`sshd_config`        |  ✅  |   ✅   |
| 环境变量           | `.env`、`.env.local`、`.env.production`、`*.env`    |  ✅  |   ✅   |
| INI / EditorConfig | `.ini`、`.cfg`、`.editorconfig`                     |  ✅  |   ✅   |
| Java Properties    | `.properties`                                       |  ✅  |   ✅   |
| TOML               | `.toml`，包括 `pyproject.toml`                      |  ✅  |   ✅   |
| YAML               | `.yaml`、`.yml`、Docker Compose 和工作流文件        |  ✅  |   —    |
| Git Config         | `.gitconfig`、`.gitmodules`、`.git/config`          |  ✅  |   ✅   |
| npm Config         | `.npmrc`                                            |  ✅  |   ✅   |
| Ignore 文件        | `.gitignore`、`.dockerignore`、`.npmignore` 等      |  ✅  |   —    |
| Git Attributes     | `.gitattributes`、`.git/info/attributes`            |  ✅  |   ✅   |
| Browserslist       | `.browserslistrc`、`browserslist`                   |  ✅  |   ✅   |
| 工具版本文件       | `.nvmrc`、`.node-version`、`.tool-versions` 等      |  ✅  |   —    |
| Hosts              | `hosts`，包括 `/etc/hosts`                          |  ✅  |   ✅   |
| 文件系统挂载表     | `fstab`，包括 `/etc/fstab`                          |  ✅  |   ✅   |
| Crontab            | `crontab`、`/etc/cron.d/*`、cron spool 文件         |  ✅  |   ✅   |

## 快速开始

1. 在 VS Code 扩展视图中搜索并安装 **Confetti**。
2. 打开一个支持的配置文件。
3. 当识别置信度达到内置安全阈值时，Confetti 会自动使用合适的语言模式。
4. 可以在编辑器右下角查看当前语言名称。

对于 `production.conf` 这类有歧义的文件，Confetti 会结合路径和文件内容进行判断，而不是只依赖扩展名。

对于 YAML、INI 和 Java Properties，如果 VS Code 已经使用标准语言模式，Confetti 会保留它，以兼容其他扩展提供的校验、补全等语言能力。

## 语法高亮

Confetti 会根据不同格式高亮：

- 注释和指令
- Key 和 Value
- Section 和 Subsection
- 字符串、数字和布尔值
- 变量和环境变量插值
- 路径、代码块、Anchor、Alias 和 Tag 等格式特有元素

Grammar 使用标准 TextMate scope，最终颜色由当前 VS Code 主题决定，Confetti 不会硬编码颜色。

## 格式化

可以通过以下方式使用：

- 打开命令面板，执行 **Confetti: Format Config**。
- 执行 VS Code 标准的 **Format Document** 命令。

上表中支持格式化的类型都有独立的 tokenizer formatter。Confetti 根据结构 token 进行格式化，而不是执行大范围正则替换，同时保留注释、字符串内容、转义空格和续行内容。

Confetti 有意不为 YAML、Ignore 文件和工具版本文件注册 formatter。YAML 交给 Prettier 等专用工具；Ignore 规则对字节内容和顺序敏感；工具版本文件也不需要结构化改写。这三类文件仍然支持自动识别和语法高亮。

格式化满足幂等性：连续执行两次，第二次不应产生新的修改。

如果安装了多个 formatter，可以执行 **Format Document With...** 并选择 Confetti，也可以直接使用 **Confetti: Format Config**，确保调用 Confetti。

## 命令

使用 `Ctrl+Shift+P` 或 `Cmd+Shift+P` 打开命令面板，然后搜索：

| 命令                                | 说明                               |
| ----------------------------------- | ---------------------------------- |
| **Confetti: Detect Config Type**    | 识别当前文件并应用对应语言模式     |
| **Confetti: Format Config**         | 直接使用 Confetti 格式化当前文件   |
| **Confetti: Show Detection Info**   | 显示识别类型和置信度               |
| **Confetti: Show Formatter Output** | 查看 Confetti formatter 的调用日志 |

## 设置

打开 VS Code 设置并搜索 `Confetti`。

| 设置                     | 默认值 | 说明                                   |
| ------------------------ | ------ | -------------------------------------- |
| `confetti.autoDetect`    | `true` | 打开、切换或保存文件时自动识别配置类型 |
| `confetti.format.enable` | `true` | 启用 Confetti 文档格式化               |

两个设置都可以直接在 VS Code Settings UI 中通过复选框修改。

## 确认使用了哪个 formatter

执行 **Confetti: Show Formatter Output**。每次 Confetti formatter 被调用时，都会记录触发来源、识别格式、处理结果、耗时和文件路径。

例如：

```text
Format Document provider | Nginx | edit produced | 0.23ms | /path/nginx.conf
Confetti: Format Config | Nginx | edit applied
```

如果没有出现新的 Confetti 日志，说明本次格式化由其他 formatter 处理。

## 常见问题

### 文件没有被识别

执行 **Confetti: Detect Config Type**，然后执行 **Confetti: Show Detection Info**。为了避免误判，Confetti 会主动忽略低置信度文件。

### Format Document 没有反应

确认 `confetti.format.enable` 已启用。可以直接执行 **Confetti: Format Config**，然后查看 **Confetti: Show Formatter Output**。

### 不同主题下的高亮颜色不同

这是正常现象。Confetti 负责提供标准 TextMate scope，具体颜色由当前主题决定。

## 隐私

Confetti 完全在本地运行，不需要账号，不会上传配置文件，也不会发送遥测数据。

## 环境要求

- VS Code 1.90 或更高版本

## 相关链接

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=rhevorn.confetti)
- [源代码](https://github.com/rhevorn/confetti)
- [反馈问题](https://github.com/rhevorn/confetti/issues)
- [更新日志](https://github.com/rhevorn/confetti/blob/main/CHANGELOG.md)

## 开源协议

MIT
