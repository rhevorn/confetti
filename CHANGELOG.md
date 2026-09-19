# Change Log

All notable changes to Confetti are documented in this file.

## 1.5.1 - 2026-09-19

- Explain every successful detection with its filename, path pattern, extension, content, or user-association evidence, plus up to five alternative candidates in the Confetti output channel.
- Add `confetti.associations` for mapping project-specific filename patterns to supported format ids, with workspace-relative and cross-platform path matching and more-specific patterns taking precedence.
- Add **Confetti: Preview Formatting**, which opens a native VS Code diff without modifying the source document.
- Refresh cached detection, folding, symbols, diagnostics, and the status indicator when associations change, while keeping document-edit handling O(1).
- Extend unit and real VS Code Extension Host tests for detection evidence, association precedence, invalid ids, settings refresh, and formatting previews.
- Improve Marketplace discovery metadata for TOML, YAML, ENV, config, conf, syntax-highlighting, and formatter searches while staying within the 30-keyword publishing limit.

## 1.4.1 - 2026-09-11

- Let the explicit **Confetti: Detect Config Type** command apply a detected language even when that format is excluded from automatic detection.
- Apply Confetti setting changes immediately, including clearing and restoring duplicate-key diagnostics without waiting for another file event.
- Invalidate stale folding ranges as soon as a document changes while keeping the typing-path handler O(1).
- Use path-aware `*` and `**` matching for detectors, including relative paths and nested systemd drop-in files.
- Rename the non-functional `confetti.autoDetect.formats` setting to `confetti.autoDetectFormats`; VS Code treats a child setting as conflicting with the boolean `confetti.autoDetect` key.
- Add a real VS Code Extension Host integration test command for detection, formatting, folding, symbols, diagnostics, and settings behavior.

## 1.4.0 - 2026-09-04

- Add detection, highlighting, and formatting for systemd unit files (`.service`, `.socket`, `.timer`, `.path`, `.mount`, `.target`, and drop-in directories), with backslash line continuations preserved during formatting.
- Add detection, highlighting, and formatting for Python tooling INI files (`tox.ini`, `.flake8`, `pytest.ini`, `mypy.ini`, `.coveragerc`, `.isort.cfg`), with indented multiline values preserved during formatting.
- Add detection, highlighting, and formatting for Caddyfiles, with brace-depth indentation, inline `{...}` placeholders left untouched, and heredoc bodies preserved byte-for-byte.
- Harden Caddy, TOML, YAML, npmrc, and Python tooling grammars and formatters with shared tokenizers and broader semantic regression tests.

## 1.3.0 - 2026-09-02

- Add detection, highlighting, and formatting for Apache `httpd.conf`, `apache2.conf`, and `.htaccess` files, including content-based disambiguation from Nginx for ambiguous `.conf` files.
- Add detection, highlighting, and formatting for MySQL `my.cnf`, pip `pip.conf`, and Python `setup.cfg` files, with setup.cfg multiline values preserved during formatting.
- Add detection, highlighting, and formatting for tmux (`tmux.conf`), GNU screen (`.screenrc`), and GNU Readline (`.inputrc`) configuration files.
- Add folding range providers for Nginx and Apache blocks, INI-family sections (INI, Git Config, MySQL, pip, setup.cfg), and SSH `Host`/`Match` blocks.
- Add document symbol providers powering the outline view for Nginx blocks, SSH hosts, TOML tables, and INI-family sections.
- Add duplicate-key diagnostics for dotenv files, INI-family sections (INI, Git Config, MySQL, pip, setup.cfg), and TOML tables, reported as warnings when files are opened, activated, or saved — never while typing. Controlled by `confetti.diagnostics.enable`.
- Add Nginx snippets for server blocks, locations, reverse proxies, upstreams, HTTPS servers, and HTTP-to-HTTPS redirects.
- Add a status bar indicator showing the detected format and confidence, clickable to open detection details.
- Add per-format settings (then named `confetti.autoDetect.formats` and `confetti.format.formats`) to restrict detection and formatting to specific format ids; an empty list keeps every format enabled.
- Expand Ignore detection to any `.*ignore` filename, including `.cursorignore`, `.vscodeignore`, `.vercelignore`, and related files.
- Add detection, highlighting, and formatting for classic Yarn `.yarnrc` files.

## 1.2.0 - 2026-08-27

- Add detection and TextMate highlighting for Ignore files and tool version files.
- Add detection, highlighting, and conservative formatting for Git Attributes, Browserslist, hosts, fstab, and crontab.
- Add realistic examples and tokenizer-backed tests for all newly supported formats.
- Expand Marketplace description and keywords so Confetti is easier to find for common config-file searches.

## 1.1.0 - 2026-08-27

- Replace broad formatter rewrites with tokenizer and state-machine based processing where syntax context matters.
- Improve Nginx, TOML, Properties, SSH, Git Config, INI, dotenv, and npmrc formatting accuracy.
- Preserve TOML multiline strings, continued values, quoted content, comments, and malformed input more safely.
- Keep YAML detection and highlighting while leaving YAML formatting to dedicated tools such as Prettier.
- Expand formatter, tokenizer, extension, example, and malformed-input tests with 100% configured coverage.

## 1.0.0 - 2026-08-27

First stable release.

- Detect Nginx, SSH, dotenv, INI, Java Properties, TOML, YAML, Git Config, and npmrc files from filenames, paths, extensions, and content.
- Add theme-compatible TextMate syntax highlighting for every supported format.
- Add dedicated, idempotent formatters that preserve comments and configuration semantics.
- Add Format Document integration, direct Confetti formatting, detection details, and formatter output commands.
- Add configurable automatic detection and formatting switches in VS Code Settings.
- Add realistic examples, full core test coverage, grammar tokenization tests, and reproducible performance benchmarks.
- Keep all processing local with no runtime dependencies, telemetry, accounts, or network requests.

## 0.1.0 - 2026-08-27

- Initial Marketplace preview.
