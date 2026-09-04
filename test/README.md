# Testing semantic preservation

Run the normal suite with `npm test`, or include source coverage with
`npm run test:coverage`. These tests never start a server or execute configuration
commands, and do not install tools automatically.

## Native parser comparisons

`native-parsers.test.ts` compares parsed configuration values before and after
formatting, not just whitespace or snapshots:

- Node `util.parseEnv`: 300 seeded dotenv documents, always run.
- Python 3.11+ `configparser`: 180 combinations of indentation, blank/comment
  continuation lines, line endings, and final newlines across setup.cfg, Python
  tooling INI, and pip formatters.
- Python 3.11+ `tomllib`: 120 generated TOML documents with Unicode, escaped
  strings, multiline strings, inline tables, and arrays of tables.
- Git `config --no-includes --file - --null --list`: 40 generated configurations
  with quoted values, repeated entries, and continuations. Only the supplied
  stdin configuration is read; includes are disabled.

Python and Git cases are explicitly marked skipped if the required executable
is unavailable. For a full local run, install Python 3.11+ and Git, then run:

```sh
npx vitest run test/native-parsers.test.ts
```

The Python comparison is batched through stdin. All subprocesses have timeouts.
No runtime dependencies are added to the extension. Native Nginx/Caddy parser
comparisons and a real VS Code Extension Host suite are not included here.

## Reproducible generated inputs

Generators use fixed seeds. Assertion messages identify the format, seed, case,
and (for malformed input) source text. Valid generated documents are checked for
semantic equivalence and formatting idempotency. Caddy additionally has 160
generated quoted-token cases checked against exact expected layouts (not a
native-parser oracle). Every registered formatter also
receives 80 mixed-syntax inputs to check that malformed input does not crash.
Malformed inputs are not asserted to have meaningful configuration semantics.

When a generated case fails, reduce it and retain the reduced example as an
explicit regression test. Tests do not silently update golden results or write
generated files to the repository.

## Multiline state

`review-regressions.test.ts` also guards the 1 MB short-line dotenv case against
the former seconds-long scan, checks TOML four/eight-digit Unicode key escapes,
and verifies equivalent table names across array instances. The coarse runtime
ceiling is a regression guard, not a product latency guarantee. Reproduce
dotenv scan measurements with `npm run benchmark`.

`grammars.test.ts` uses real TextMate and Oniguruma tokenization, carrying rule
state across lines. Tests verify both literal-body scopes and recovery after
closing delimiters. `multiline-features.test.ts` checks physical line ranges and
outline entries independently of the lexer, including braces or table headers
inside strings, heredocs, incomplete constructs, and escaped newlines.
