# Theme key-color fixtures

`theme-key-colors.json` contains the relevant TextMate token-color rules from
Microsoft VS Code 1.135.0's bundled `theme-defaults/themes` files:
`2026-dark.json`, `2026-light.json`, `dark_plus.json`, and `light_plus.json`.
Includes are resolved in parent-first order. Only property, variable, string,
support, and tag rules (plus defaults) are retained. These are test data, not
colors contributed by Confetti or overrides of users' themes.

`key-highlighting.test.ts` runs the actual TextMate theme matcher and checks the
resolved foreground metadata, rather than assuming that a scope has a color.
Fixtures make those regressions reproducible without a local VS Code install.
They do not model semantic-token providers or user color customizations.

Upstream: https://github.com/microsoft/vscode/tree/main/extensions/theme-defaults/themes

## Upstream license

Copyright (c) Microsoft Corporation. All rights reserved.

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
