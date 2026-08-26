# Confetti

为 VS Code 提供配置文件的智能识别、语法高亮和格式化能力。

English documentation: `README.md`

## 为什么选择 Confetti？

配置文件支持非常碎片化。一个项目中可能同时存在 `nginx.conf`、`.env.local`、`.npmrc`、`.gitconfig`、`ssh_config`、`pyproject.toml` 和多个含义不同的 `.conf` 文件，通常需要分别安装不同插件。

Confetti 用一个插件提供统一体验：

- 根据文件名、路径和内容智能识别配置类型
- 使用 TextMate Grammar 提供兼容不同主题的语法高亮
- 使用每种格式独立的规则支持 Format Document
- 不需要账号、AI 服务、云端服务或网络连接

无法可靠识别文件时，Confetti 不会强制修改语言模式。

## 支持的格式

| 格式               | 常见文件                                            |
| ------------------ | --------------------------------------------------- |
| Nginx              | `nginx.conf`，以及根据内容识别的 Nginx `.conf` 文件 |
| SSH                | `~/.ssh/config`、`ssh_config`、`sshd_config`        |
| 环境变量           | `.env`、`.env.local`、`.env.production`、`*.env`    |
| INI / EditorConfig | `.ini`、`.cfg`、`.editorconfig`                     |
| Java Properties    | `.properties`                                       |
| TOML               | `.toml`，包括 `pyproject.toml`                      |
| YAML               | `.yaml`、`.yml`                                     |
| Git Config         | `.gitconfig`、`.gitmodules`、`.git/config`          |
| npm Config         | `.npmrc`                                            |

## 快速开始

1. 在 VS Code 扩展视图中搜索并安装 **Confetti**。
2. 打开一个支持的配置文件。
3. 当识别置信度达到内置安全阈值时，Confetti 会自动应用对应的语言模式。
4. 可以在编辑器右下角查看当前语言名称。

对于 `production.conf` 这类有歧义的文件，Confetti 会结合路径和文件内容进行判断，而不是只依赖扩展名。

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

每种格式都有独立 formatter。Confetti 会整理缩进和安全的结构空格，同时尽量保留注释、字符串内容、转义空格、续行内容和 YAML block scalar 内容。

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

## 开源协议

MIT
