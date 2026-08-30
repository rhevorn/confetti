# Confetti

Smart detection, syntax highlighting, and formatting for nginx, dotenv, gitignore, hosts, TOML, YAML, and 16+ configuration file types in VS Code.

[中文文档](https://github.com/rhevorn/confetti/blob/main/README.zh-CN.md)

## Install

Install **Confetti** from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=rhevorn.confetti), or search in the VS Code Extensions view for `Confetti`, `config formatter`, `gitignore`, `nginx format`, or `dotenv`.

## Why Confetti?

Configuration-file support is fragmented. A project may contain `nginx.conf`, `.env.local`, `.npmrc`, `.gitconfig`, `ssh_config`, `pyproject.toml`, and several ambiguous `.conf` files, each requiring a different extension.

Confetti provides one consistent experience:

- Content-aware configuration type detection
- Theme-compatible TextMate syntax highlighting
- Format Document support with format-specific rules
- No account, AI service, cloud service, or network connection required

Confetti does not force a language mode when a file cannot be identified reliably.

## Performance and resource use

Confetti is designed to stay out of the typing path. It does not continuously rescan a document on every edit. Detection runs when a file is opened, activated, saved, or explicitly detected; formatting runs only when requested by VS Code or the user.

Core benchmark results for the generated Nginx sample:

| Input  | Detection p95 | Formatting p95 |
| ------ | ------------: | -------------: |
| 100 KB |         ≤3 ms |          ≤8 ms |
| 1 MB   |        ≤30 ms |         ≤80 ms |

Resource characteristics:

- The 1.2.0 VSIX is approximately **137 KB** and has no runtime npm dependencies.
- Detection retained about **0.06 MB** of additional heap for a 1 MB sample; after releasing the result and running GC, the measured delta was about **0.02 MB**.
- Formatting a 1 MB Nginx sample temporarily increased heap usage by up to **75 MB** immediately after the operation. The measured delta returned to approximately zero after the result was released and GC ran. Tokenization and formatting work on a complete document, so temporary allocation grows with file size.
- Detection cache entries are small and are removed when their documents close.
- Confetti has no polling loop, background index, network client, telemetry client, Webview, or language server.

These are core-library measurements, not total VS Code Extension Host memory. VS Code hosts multiple extensions in a shared process and manages TextMate grammar memory itself, so per-extension idle RSS cannot be isolated accurately. Results are indicative and vary by hardware and file content.

Method: Apple Silicon (`darwin arm64`), Node.js 24.14.1, 10 warm-up runs; 100 measured iterations for 100 KB and 30 for 1 MB. The table rounds up the slower p95 values observed across repeated local runs, including a run immediately after the complete test and build pipeline. Reproduce it with `npm run benchmark`.

## Supported formats

| Format                | Typical files / scenarios                               | Highlighting | Formatting |
| --------------------- | ------------------------------------------------------- | :----------: | :--------: |
| Nginx                 | `nginx.conf`, Nginx `.conf` files detected from content |      ✅      |     ✅     |
| SSH                   | `~/.ssh/config`, `ssh_config`, `sshd_config`            |      ✅      |     ✅     |
| Environment variables | `.env`, `.env.local`, `.env.production`, `*.env`        |      ✅      |     ✅     |
| INI / EditorConfig    | `.ini`, `.cfg`, `.editorconfig`                         |      ✅      |     ✅     |
| Java Properties       | `.properties`                                           |      ✅      |     ✅     |
| TOML                  | `.toml`, including `pyproject.toml`                     |      ✅      |     ✅     |
| YAML                  | `.yaml`, `.yml`, Docker Compose and workflow files      |      ✅      |     —      |
| Git Config            | `.gitconfig`, `.gitmodules`, `.git/config`              |      ✅      |     ✅     |
| npm Config            | `.npmrc`                                                |      ✅      |     ✅     |
| Yarn Config           | classic `.yarnrc` (not `.yarnrc.yml`)                   |      ✅      |     ✅     |
| Ignore files          | `.gitignore`, `.cursorignore`, `.*ignore`, and others   |      ✅      |     —      |
| Git Attributes        | `.gitattributes`, `.git/info/attributes`                |      ✅      |     ✅     |
| Browserslist          | `.browserslistrc`, `browserslist`                       |      ✅      |     ✅     |
| Tool versions         | `.nvmrc`, `.node-version`, `.tool-versions`, and others |      ✅      |     —      |
| Hosts                 | `hosts`, including `/etc/hosts`                         |      ✅      |     ✅     |
| Filesystem table      | `fstab`, including `/etc/fstab`                         |      ✅      |     ✅     |
| Crontab               | `crontab`, `/etc/cron.d/*`, spool cron files            |      ✅      |     ✅     |

## Getting started

1. Install **Confetti** from the VS Code Extensions view.
2. Open a supported configuration file.
3. Confetti detects the type and applies a suitable language mode when confidence reaches the built-in safety threshold.
4. Check the language name in the lower-right corner of the editor.

For ambiguous files such as `production.conf`, Confetti examines both the path and content instead of relying only on the extension.

For YAML, INI, and Java Properties, Confetti keeps VS Code's canonical language mode when it is already active. This preserves compatibility with validation, completion, and other language tooling from installed extensions.

## Syntax highlighting

Confetti highlights format-specific elements such as:

- Comments and directives
- Keys and values
- Sections and subsections
- Strings, numbers, and booleans
- Variables and environment interpolation
- Paths, blocks, anchors, aliases, and tags where applicable

The grammars use standard TextMate scopes, so colors follow your active VS Code theme. Confetti does not hard-code colors.

## Formatting

Use either of these methods:

- Open the Command Palette and run **Confetti: Format Config**.
- Run VS Code's standard **Format Document** command.

Formats marked as supported above have dedicated tokenizer-backed formatters. Confetti formats structural tokens instead of applying broad regular-expression replacements, while preserving comments, quoted content, escaped spaces, and continuation lines.

Confetti intentionally does not register formatters for YAML, Ignore files, or tool version files. YAML is left to dedicated tools such as Prettier; Ignore rules remain byte-sensitive and order-sensitive; version files do not benefit from structural rewriting. Detection and syntax highlighting remain available for all three.

Formatting is designed to be idempotent: running it a second time should produce no additional changes.

If multiple formatters are installed, run **Format Document With...** and select Confetti, or use **Confetti: Format Config** to invoke Confetti directly.

## Commands

Open the Command Palette with `Ctrl+Shift+P` or `Cmd+Shift+P` and search for:

| Command                             | Description                                                 |
| ----------------------------------- | ----------------------------------------------------------- |
| **Confetti: Detect Config Type**    | Detect the active file and apply the detected language mode |
| **Confetti: Format Config**         | Format the active file directly with Confetti               |
| **Confetti: Show Detection Info**   | Show the detected type and confidence                       |
| **Confetti: Show Formatter Output** | Open logs showing when the Confetti formatter was invoked   |

## Settings

Open VS Code Settings and search for `Confetti`.

| Setting                  | Default | Description                                                      |
| ------------------------ | ------- | ---------------------------------------------------------------- |
| `confetti.autoDetect`    | `true`  | Detect supported files when they are opened, activated, or saved |
| `confetti.format.enable` | `true`  | Enable Confetti document formatting                              |

Both settings are available as checkboxes in the VS Code Settings UI.

## Confirm which formatter ran

Run **Confetti: Show Formatter Output**. Every Confetti formatting invocation records the trigger, detected format, result, elapsed time, and file path.

Example:

```text
Format Document provider | Nginx | edit produced | 0.23ms | /path/nginx.conf
Confetti: Format Config | Nginx | edit applied
```

If no new Confetti entry appears, another formatter handled the document.

## Troubleshooting

### The file was not detected

Run **Confetti: Detect Config Type**, then **Confetti: Show Detection Info**. Confetti intentionally leaves low-confidence files unchanged.

### Format Document does nothing

Make sure `confetti.format.enable` is enabled. Run **Confetti: Format Config** directly and check **Confetti: Show Formatter Output**.

### Highlighting looks different between themes

This is expected. Confetti defines semantic TextMate scopes, while the active theme chooses their colors.

## Privacy

Confetti runs locally. It does not require an account, upload configuration files, or send telemetry.

## Requirements

- VS Code 1.90 or later

## Links

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=rhevorn.confetti)
- [Source code](https://github.com/rhevorn/confetti)
- [Report an issue](https://github.com/rhevorn/confetti/issues)
- [Change log](https://github.com/rhevorn/confetti/blob/main/CHANGELOG.md)

## License

MIT
