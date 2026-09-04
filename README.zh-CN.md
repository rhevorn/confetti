# Confetti

为 VS Code 提供 `env`、`ini`、`toml`、`yml`、`conf`、nginx、Apache、MySQL、tmux、gitignore、SSH 等 15+ 种配置文件的智能识别、语法高亮和格式化能力，并提供代码折叠、大纲、snippets 和重复键诊断。

[English documentation](https://github.com/rhevorn/confetti/blob/main/README.md)

## 安装

从 [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=rhevorn.confetti) 安装 **Confetti**，也可以在 VS Code 扩展视图中搜索 `Confetti`、`env`、`ini`、`toml`、`yml`、`conf`、`config formatter` 或 `nginx format`。

## 为什么选择 Confetti？

配置文件支持非常碎片化。一个项目中可能同时存在 `nginx.conf`、`.env.local`、`.npmrc`、`.gitconfig`、`ssh_config`、`pyproject.toml` 和多个含义不同的 `.conf` 文件，通常需要分别安装不同插件。

Confetti 用一个插件提供统一体验：

- 根据文件名、路径和内容智能识别配置类型
- 使用 TextMate Grammar 提供兼容不同主题的语法高亮
- 使用每种格式独立的规则支持 Format Document
- 提供代码折叠、大纲符号、snippets、重复键警告和状态栏识别指示器
- 不需要账号、AI 服务、云端服务或网络连接

无法可靠识别文件时，Confetti 不会强制修改语言模式。

## 性能与资源占用

Confetti 不会在每次输入时持续扫描整个文档。检测、诊断和状态栏更新只发生在打开、切换、保存文件或手动执行检测时——绝不会在输入过程中运行；格式化只在 VS Code 或用户明确请求时执行。

使用生成的 Nginx 配置进行核心基准测试：

| 文件大小 | 检测 p95 | 格式化 p95 |
| -------- | -------: | ---------: |
| 100 KB   |    ≤3 ms |      ≤8 ms |
| 1 MB     |   ≤30 ms |     ≤80 ms |

资源占用情况：

- 1.4.0 的 VSIX 约为 **204 KB**，没有运行时 npm 依赖。
- 检测 1 MB 示例后，保留检测结果时堆内存增量约 **0.06 MB**；释放结果并执行 GC 后约为 **0.02 MB**。
- 格式化 1 MB Nginx 示例后，立即测得的临时堆内存增量最高约 **75 MB**；释放结果并执行 GC 后，增量回到接近零。Tokenization 和格式化会处理完整文档，因此临时内存会随文件大小增长。
- 检测缓存只保存很小的结果对象，并在文档关闭时删除。
- 没有轮询任务、后台索引、网络客户端、遥测客户端、Webview 或 Language Server。

以上数据测量的是 Confetti 核心逻辑，不是 VS Code Extension Host 的总内存。VS Code 会让多个扩展共享 Extension Host 进程，并自行管理 TextMate Grammar 内存，因此无法准确分离单个扩展的空闲 RSS。实际结果会随硬件和文件内容变化。

测试环境：Apple Silicon（`darwin arm64`）、Node.js 24.14.1；预热 10 次，100 KB 测量 100 次，1 MB 测量 30 次。表格对多次本地运行中较慢的 p95 向上取整，其中包括紧接完整测试和构建流程之后的运行。可以运行 `npm run benchmark` 复现。

## 支持的格式

| 格式               | 场景文件                                                | 高亮 | 格式化 |
| ------------------ | ------------------------------------------------------- | :--: | :----: |
| Nginx              | `nginx.conf`，以及根据内容识别的 Nginx `.conf` 文件     |  ✅  |   ✅   |
| Caddyfile          | `Caddyfile`，支持代码块、matcher 和 heredoc             |  ✅  |   ✅   |
| Apache             | `httpd.conf`、`apache2.conf`、`.htaccess`、vhost 文件   |  ✅  |   ✅   |
| SSH                | `~/.ssh/config`、`ssh_config`、`sshd_config`            |  ✅  |   ✅   |
| 环境变量           | `.env`、`.env.local`、`.env.production`、`*.env`        |  ✅  |   ✅   |
| INI / EditorConfig | `.ini`、`.cfg`、`.editorconfig`                         |  ✅  |   ✅   |
| MySQL              | `my.cnf`、`.my.cnf`、`mysql`/`mariadb` 配置路径         |  ✅  |   ✅   |
| pip                | `pip.conf`、`~/.pip/pip.conf`、`~/.config/pip/pip.conf` |  ✅  |   ✅   |
| setup.cfg          | Python `setup.cfg`，保留多行值内容                      |  ✅  |   ✅   |
| Python 工具链 INI  | `tox.ini`、`.flake8`、`pytest.ini`、`mypy.ini` 等       |  ✅  |   ✅   |
| Java Properties    | `.properties`                                           |  ✅  |   ✅   |
| TOML               | `.toml`，包括 `pyproject.toml`                          |  ✅  |   ✅   |
| YAML               | `.yaml`、`.yml`、Docker Compose 和工作流文件            |  ✅  |   —    |
| Git Config         | `.gitconfig`、`.gitmodules`、`.git/config`              |  ✅  |   ✅   |
| npm Config         | `.npmrc`                                                |  ✅  |   ✅   |
| Yarn Config        | 经典 `.yarnrc`（不含 `.yarnrc.yml`）                    |  ✅  |   ✅   |
| Ignore 文件        | `.gitignore`、`.cursorignore`、`.*ignore` 等            |  ✅  |   —    |
| Git Attributes     | `.gitattributes`、`.git/info/attributes`                |  ✅  |   ✅   |
| Browserslist       | `.browserslistrc`、`browserslist`                       |  ✅  |   ✅   |
| 工具版本文件       | `.nvmrc`、`.node-version`、`.tool-versions` 等          |  ✅  |   —    |
| Hosts              | `hosts`，包括 `/etc/hosts`                              |  ✅  |   ✅   |
| 文件系统挂载表     | `fstab`，包括 `/etc/fstab`                              |  ✅  |   ✅   |
| Crontab            | `crontab`、`/etc/cron.d/*`、cron spool 文件             |  ✅  |   ✅   |
| tmux               | `tmux.conf`、`~/.config/tmux/tmux.conf`                 |  ✅  |   ✅   |
| GNU screen         | `.screenrc`                                             |  ✅  |   ✅   |
| Readline           | `.inputrc`                                              |  ✅  |   ✅   |
| systemd unit       | `.service`、`.socket`、`.timer`、`systemd/system/*`     |  ✅  |   ✅   |

## 快速开始

1. 在 VS Code 扩展视图中搜索并安装 **Confetti**。
2. 打开一个支持的配置文件。
3. 当识别置信度达到内置安全阈值时，Confetti 会自动使用合适的语言模式。
4. 可以在编辑器右下角查看当前语言名称，或查看显示识别格式和置信度的 Confetti 状态栏项。

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

赋值 key 使用属性名 scope，兼容 Dark/Light 2026 和 Dark+/Light+。TOML 内联表中的 key、npmrc 的 registry/认证和数组 key，以及 YAML 列表映射中的 key 也会高亮。

YAML 的字面量块（`|`）和折叠块（`>`）会跨行保持字符串高亮，支持缩进标记和末尾换行控制标记；退出正文后恢复 key、注释等高亮。YAML 格式化仍保持禁用。

## 编辑器功能

除了识别、高亮和格式化之外，Confetti 还提供：

- **代码折叠**：Nginx 和 Apache 代码块、INI 系 section、SSH `Host`/`Match` 块
- **大纲符号**：Nginx 代码块、SSH 主机、TOML table、INI 系 section
- **重复键警告**：dotenv、INI 系 section 和 TOML table 中的重复键会以警告标出，让悄悄覆盖前值的键一目了然
- **Nginx snippets**：server 块、location、反向代理、upstream、HTTPS server 和跳转
- **状态栏指示器**：显示识别的格式和置信度，点击可查看完整识别详情

折叠、大纲和诊断只在打开、切换、保存文件或手动检测时计算。Provider 请求只读取缓存；编辑会使缓存失效，但不会扫描文档。保存、切回该文件或执行 **Confetti: Detect Config Type** 可刷新这些功能。Snippet 中的 Nginx 变量（如 `$host`）会原样插入。

重复警告会区分格式语义：dotenv 引号内的多行值和 Python INI 续行不会被当成键；TOML 子表属于当前数组元素。systemd 只检查少量已知的单值配置项，不会对 `Environment`、`ExecStart` 等可重复指令报警。这些检查不等同于完整配置校验。

## 格式化

保留 Caddy 引号字符串和 heredoc 正文、dotenv 多行值、Python INI 值的内容。Python INI 的 key 统一顶格、续行统一缩进 4 个空格，保留值内部的空格、注释和空行。tox 的 `[testenv]` / `[testenv:...]` 中，包含同级裸包名的明显错误 `deps` 列表可恢复缺失的续行缩进；不会仅凭合法同级赋值看起来像版本约束，就把它改成依赖项。遇到未闭合的 Caddy 字符串、heredoc 或反斜杠续行时，保持原样，不猜测其布局。

包含跨行引号值的 Nginx 文档会保持原样，不执行格式化。Nginx 和 Caddy 的折叠、大纲不会把字符串正文中的大括号当成代码块；Caddy 高亮也会保留跨行字符串和 heredoc 的字面量状态。TOML 大纲会忽略多行字符串中形似表头的文本。

在 `[flake8]` 中，`max-complexity` 等整数配置项之后误缩进的赋值行，会恢复为独立 key。此恢复规则不会应用到 `exclude`、`per-file-ignores` 等多行配置值内部。

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

| 设置                          | 默认值 | 说明                                          |
| ----------------------------- | ------ | --------------------------------------------- |
| `confetti.autoDetect`         | `true` | 打开、切换或保存文件时自动识别配置类型        |
| `confetti.autoDetect.formats` | `[]`   | 限制自动识别的格式 id；空列表表示支持全部格式 |
| `confetti.diagnostics.enable` | `true` | 高亮重复键；只在打开、切换和保存时运行        |
| `confetti.format.enable`      | `true` | 启用 Confetti 文档格式化                      |
| `confetti.format.formats`     | `[]`   | 限制格式化的格式 id；空列表表示支持全部格式   |

两个 `boolean` 设置可以直接在 VS Code Settings UI 中通过复选框修改；两个 `.formats` 设置接受格式 id 列表（例如 `["nginx", "ssh"]`），空列表表示启用全部格式。

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
