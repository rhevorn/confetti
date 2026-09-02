# Confetti manual test workspace

These files are intentionally messy. They cover detection, TextMate scopes, formatting, comment preservation, string preservation, and formatter idempotence.

## Start the extension

1. Open the Confetti repository in VS Code.
2. Select **Run Confetti with examples** in **Run and Debug**.
3. Press `F5`. The Extension Development Host opens this directory with third-party extensions disabled.
4. Open a sample and run `Confetti: Show Detection Info`.
5. Run `Developer: Inspect Editor Tokens and Scopes`, then click representative keys and values.
6. Run `Confetti: Format Config` and inspect the editor diff.
7. Run it again. The second run must report `no changes` in `Confetti: Show Formatter Output`.
8. Check folding, the outline view, and the status bar indicator on block- and section-based samples; `env/.env.local` must show a duplicate-key warning.

## Coverage matrix

| Sample | Detection | Highlight and formatting checks |
| --- | --- | --- |
| `nginx/nginx.conf` | Exact filename | Directives, blocks, variables, strings containing `#` and braces, nested indentation |
| `nginx/site.conf` | Ambiguous `.conf` by content | `server`, `location`, `proxy_pass` signals |
| `nginx/spacing.conf` | Ambiguous `.conf` by content | Horizontal spacing, semicolons, braces, quoted and escaped spaces |
| `.ssh/config` | `.ssh` path | Global options, `Host`, `Match`, paths, `%` tokens, block indentation |
| `apache/httpd.conf` | Exact filename | Directives, XML-style section tags, strings containing spaces, booleans, nested indentation |
| `apache/.htaccess` | Exact filename | Rewrite rules and flags, `Files` blocks, `Order`/`Require` |
| `apache/site.conf` | Ambiguous `.conf` by content | `VirtualHost` tags, `ServerName` signals beating Nginx |
| `ssh/sshd_config` | Exact filename | Server directives, numbers, booleans, paths |
| `env/.env.local` | `.env.*` filename | Keys versus values, `export`, empty values, quotes, interpolation, booleans, numbers, duplicate-key warning |
| `ini/settings.ini` | `.ini` extension | Sections, `=` and `:` assignments, URLs containing `=`, comments, empty values |
| `ini/.editorconfig` | Exact filename | Glob sections and normalized `key = value` spacing |
| `mysql/my.cnf` | Exact filename and `mysql`/`mariadb` paths | Sections, assignments, socket paths, booleans, numbers |
| `pip/pip.conf` | Exact filename and `.config/pip` path | Sections, URLs, booleans, numbers |
| `python/setup.cfg` | Exact filename beating the generic INI extension | Sections, `attr:` and `file:` directives, multiline classifier and requirement lists preserved |
| `properties/messages.properties` | `.properties` extension | Escapes, Unicode escapes, interpolation, continuation lines |
| `toml/pyproject.toml` | `.toml` extension | Tables, array tables, dotted keys, dates, arrays, inline tables, multiline strings |
| `git/.gitconfig` | Exact filename | Sections, subsections, aliases, paths, booleans |
| `npm/.npmrc` | Exact filename | Scoped registries, auth keys, URLs, variables, booleans, numbers |
| `tmux/tmux.conf` | Exact filename | Commands, `-g` flags, `#{...}` format variables, quoted strings |
| `screen/.screenrc` | Exact filename | Directives, status format strings, escapes |
| `inputrc/.inputrc` | Exact filename | `set` options, quoted key sequences, function names, `$if` conditionals |
| `yaml/compose.yaml` | `.yaml` extension | Maps, sequences, anchors, aliases, tags, flow collections, block scalars |
| `unknown/application.conf` | None expected | Must remain outside all Confetti language modes |

## Important invariants

- Comments must remain present.
- Quoted text and block scalar content must not change.
- A second format must produce no edit.
- `unknown/application.conf` must remain unknown.
- TextMate inspection should show a root scope beginning with `source.confetti.`.

Installing the VSIX is not required during development. Stop the debug session and press `F5` again after changing extension source.
