# Confetti Agent Guide

## Project goal

Confetti is a small, local-first VS Code extension for detecting, highlighting, and formatting common configuration files.

Keep the product focused on:

1. Configuration type detection
2. TextMate syntax highlighting
3. Format Document support
4. Lightweight editor features that run only on open, activate, and save: folding ranges, outline symbols, duplicate-key diagnostics, snippets, and the status bar detection indicator

Do not add AI features, accounts, cloud services, telemetry, Webviews, validation, or completion unless the user explicitly expands the product scope.

## Design principles

- Keep the implementation simple, fast, reliable, and easy to extend.
- Keep core logic independent from the VS Code API so it can later be reused by a CLI or other editors.
- Prefer format-specific detectors, grammars, and formatters over a generic rule that changes semantics.
- Never hard-code syntax colors. Use standard TextMate scopes and let the active theme choose colors.
- Do not add runtime npm dependencies unless there is a strong, documented reason.
- Do not scan the full document on every edit. Detection, diagnostics, and status bar updates belong on open, active-editor change, save, or explicit command execution — never while typing.
- Keep editor features (folding, symbols, diagnostics) as pure computations in `src/features/`, adapted to VS Code API objects only in `src/extension.ts`.
- Preserve compatibility with canonical VS Code language IDs for YAML, INI, and Java Properties.

## Supported formats

- Nginx
- Apache config (`httpd.conf`, `apache2.conf`, `.htaccess`)
- SSH config
- Environment variables / dotenv
- INI / EditorConfig
- MySQL config (`my.cnf`, `.my.cnf`)
- pip config (`pip.conf`)
- setup.cfg
- Python tooling INI files (`tox.ini`, `.flake8`, `pytest.ini`, `mypy.ini`, `.coveragerc`, `.isort.cfg`)
- Java Properties
- TOML
- YAML
- Caddyfile
- Git Config
- npm config / npmrc
- Yarn config / classic `.yarnrc`
- Ignore files (`.gitignore`, `.cursorignore`, any `.*ignore`, and related files)
- Git Attributes
- Browserslist
- Tool version files (`.nvmrc`, `.node-version`, `.python-version`, `.ruby-version`, `.tool-versions`)
- Hosts
- Filesystem table / fstab
- Crontab
- tmux config (`tmux.conf`)
- GNU screen config (`.screenrc`)
- GNU Readline config (`.inputrc`)
- systemd unit files (`.service`, `.socket`, `.timer`, `.path`, `.mount`, `.target`, and drop-in directories)

Redis is intentionally not supported.

YAML, Ignore files, and tool version files are detection and highlighting only. Confetti intentionally does not register formatters where a dedicated formatter is preferable or formatting could change semantics.

## Repository layout

- `src/core/`: editor-independent registry, detection, formatting, and shared types
- `src/configs/`: one `ConfigDefinition` per supported format
- `src/formatters/`: one formatter per format with formatting support, plus carefully scoped shared helpers
- `src/features/`: editor-independent computations for folding ranges, outline symbols, and duplicate-key diagnostics
- `src/tokenizers/`: editor-independent token types and safe lexical scanning primitives
- `src/extension.ts`: thin VS Code adapter, commands, providers, events, logging, and cache lifecycle
- `syntaxes/`: self-contained TextMate grammar JSON files
- `snippets/`: per-format snippet JSON files
- `language-configurations/`: format-specific VS Code editor behavior
- `examples/`: realistic files for manual Extension Development Host testing
- `test/`: unit, integration, grammar-tokenization, manifest, example, performance-baseline, and VS Code adapter tests
- `scripts/benchmark.mjs`: reproducible detection, formatting, package-size, and heap benchmark

## Required behavior

Detection:

- Use filename, normalized path, extension, and content signals. Content signals only boost files that already match a filename, path pattern, or extension — never detect a file on content alone, so a README containing a config snippet is never hijacked.
- Support POSIX and Windows paths.
- Return the highest-confidence definition only when confidence is at least the fixed `MIN_CONFIDENCE` value.
- Do not force a language mode for an unreliable result.
- Keep detection within the documented performance targets.

Formatting:

- Preserve comments and quoted content.
- Preserve escaped characters, continuation lines, and TOML multiline strings.
- Do not modify configuration semantics.
- Preserve whether the input has a final newline.
- Normalize CRLF safely.
- Be idempotent: `format(format(input)) === format(input)`.
- Prefer a small state machine or tokenizer over broad regular-expression replacement when syntax state matters.

Extension behavior:

- Keep `confetti.autoDetect`, `confetti.autoDetectFormats`, `confetti.diagnostics.enable`, `confetti.format.enable`, and `confetti.format.formats` available in the VS Code Settings UI. Empty format lists mean all formats. Do not declare a `confetti.autoDetect.formats` child key because VS Code treats it as conflicting with the boolean `confetti.autoDetect` parent key.
- Keep the confidence threshold internal rather than user-configurable.
- Release cached detection results when documents close, and clear diagnostics for closed documents.
- Log formatter invocation, selected format, result, elapsed time, and path to the Confetti output channel.
- Keep the explicit **Confetti: Format Config** command so users can distinguish Confetti from other formatters.
- Keep exactly one event handler per VS Code event (open, save, close, active-editor change, document change); new features wire into the existing handlers instead of registering more listeners. The document-change handler must stay O(1) — it only drops stale diagnostics, and never rescans content while typing.
- Wire folding, symbols, diagnostics, and the status bar through the existing handlers so nothing runs while typing.

## Adding or changing a format

When adding a format:

1. Add a `ConfigDefinition` in `src/configs/`.
2. Register it in `src/configs/index.ts`.
3. Add a dedicated formatter in `src/formatters/` when formatting is supported.
4. Extend the pure computations in `src/features/` when the format should fold, appear in the outline, or receive duplicate-key diagnostics.
5. Add a TextMate grammar in `syntaxes/` using standard scopes, and snippets in `snippets/` when they help.
6. Add a format-specific language configuration when editor behavior differs.
7. Update `package.json` language and grammar contributions.
8. Add realistic examples.
9. Add detector, formatter, idempotency, malformed-input, real TextMate tokenization, manifest, and example tests.
10. Update both `README.md` and `README.zh-CN.md`.

Do not claim support until detection, highlighting, formatting, examples, and tests are all present where applicable.

## Development commands

```bash
npm install
npm test
npm run test:coverage
npm run test:vscode
npm run typecheck
npm run lint
npm run format:check
npm run check
npm run benchmark
npm run package
```

Use `npm run check` as the normal quality gate. Use `npm run package` before release-related changes.
Use `npm run test:vscode` for the real Extension Development Host integration
suite before a release; it is intentionally separate from the fast unit-test gate.

## Test requirements

- All tests must pass.
- Statements, branches, functions, and lines must remain at 100% for the configured source set.
- Every formatter needs semantic-preservation and idempotency coverage.
- Every grammar must be parsed by the real `vscode-textmate` and `vscode-oniguruma` tokenizer, not only checked as JSON text.
- Manifest tests must keep config definitions, language contributions, grammars, commands, settings, and packaged assets synchronized.
- Performance tests and README performance claims must use measured, reproducible data. Report conservative values and state the environment and methodology.

## Manual VS Code testing

Press `F5` in VS Code to launch the Extension Development Host. Open files under `examples/`, then verify:

- The language mode is detected correctly.
- Keys, values, sections, directives, strings, numbers, variables, and comments receive useful highlighting.
- Folding, the outline view, the status bar indicator, and duplicate-key warnings work for the formats that support them.
- Nginx snippets expand and insert variables such as `$host` literally.
- **Format Document With...** lists Confetti where expected.
- **Confetti: Format Config** applies the Confetti formatter directly.
- **Confetti: Show Formatter Output** records the invocation.
- Formatting twice produces no second change.

Installing a VSIX is not required for each development iteration. Use `F5` during development and install the packaged VSIX only for final installation testing.

## Documentation and release hygiene

- Keep `README.md` and `README.zh-CN.md` aligned and written for Marketplace users rather than contributors.
- Do not publish unsupported performance or memory claims.
- Do not include stale build output in the VSIX; the build must clean `dist` first.
- Preserve unrelated user changes in the working tree.
- When Codex creates a commit, include:

```text
Co-authored-by: Codex <codex@openai.com>
```
