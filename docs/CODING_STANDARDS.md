# SmartVend coding standards

Use these rules for the active React frontend, Express backend, scripts, tests,
and project configuration. The archived Supabase implementation in `legacy/`
is retained as historical reference and is excluded from formatting.

## Indentation and line length

- Indent with **2 spaces**; do not use tabs.
- Aim for **100 characters per line**. Break long function calls, objects,
  conditions, and JSX into multiple lines.
- Keep one statement on each line. Expand function bodies and error handling
  so each step is easy to follow.
- Put nested JSX on separate indented lines. Let Prettier wrap attributes.
- Use single quotes in JavaScript, double quotes for JSX attributes, semicolons,
  and trailing commas in multiline lists, as enforced by Prettier.
- Save files as UTF-8 with LF line endings and a final newline.

The 100-character limit is a formatting target, not a strict truncation rule.
An indivisible URL, regular expression, SVG path, or string may exceed it.
Never insert line breaks that change a string's value or a program's behavior.
Use multiline SQL for longer queries where whitespace is insignificant.

## Readable changes

- Use descriptive names for functions and variables. Keep existing API fields
  and database column names stable unless a migration explicitly changes them.
- Use braces when adding or changing control-flow blocks.
- Separate validation, state changes, and response handling with blank lines
  when it helps the reader follow the operation.
- Comment the purpose or constraint of a step, rather than restating the code.
- Keep payment amounts, transaction boundaries, retry rules, and encryption
  behavior explicit. Formatting must not change those rules.

## Commands

After installing dependencies with `npm ci`, format the active code:

```sh
npm run format
```

Before committing, run:

```sh
npm run format:check
npm test
npm run build
```

GitHub Actions runs the same checks. Prettier is pinned in `package.json` and
`package-lock.json` so contributors use the same formatter version.

## Editor configuration

`.editorconfig` supplies the indentation and line-ending settings to editors
that support EditorConfig. `.prettierrc.json` supplies the formatter rules.
If you use VS Code, install the Prettier extension and select it as the default
formatter for this project; format-on-save is optional.

`.prettierignore` excludes generated files, private configuration, local data,
the archive, and prose documents. Documentation can be edited separately
without producing unrelated code-formatting changes.

Reference: [Prettier options](https://prettier.io/docs/options).
