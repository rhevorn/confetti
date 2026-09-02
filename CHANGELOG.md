# Change Log

All notable changes to Confetti are documented in this file.

## Unreleased

- Add detection, highlighting, and formatting for Apache `httpd.conf`, `apache2.conf`, and `.htaccess` files, including content-based disambiguation from Nginx for ambiguous `.conf` files.
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
