# Contributing

Thanks for your interest in improving `withings-node-oauth2`! Contributions of
all kinds are welcome — bug reports, docs, tests, and features.

## Getting started

This project uses [pnpm](https://pnpm.io) and requires **Node.js 18+**.

```sh
git clone https://github.com/desirekaleba/withings-node-oauth2.git
cd withings-node-oauth2
pnpm install
```

## Development workflow

| Command              | What it does                                       |
| -------------------- | -------------------------------------------------- |
| `pnpm build`         | Build ESM + CJS + type declarations with `tsc`.    |
| `pnpm dev`           | Rebuild on change.                                 |
| `pnpm typecheck`     | Type-check with `tsc --noEmit`.                    |
| `pnpm lint`          | Lint with ESLint.                                  |
| `pnpm format`        | Format with Prettier.                              |
| `pnpm test`          | Run the Vitest suite.                              |
| `pnpm test:coverage` | Run tests with coverage (thresholds enforced).     |
| `pnpm check`         | Typecheck + lint + test + build (run before a PR). |

## Guidelines

- **Tests**: add or update tests for any behavior change. The suite mocks
  `fetch` (see `test/helpers.ts`) — no network access is needed or allowed.
- **Types**: keep the public API fully typed. Response body models live in
  `src/models/`; cross-cutting types in `src/types/`. New endpoints go in a
  resource under `src/resources/` over the layered core (`src/core`, `src/auth`).
- **Style**: ESLint + Prettier are enforced via a pre-commit hook.
- **Commits**: this repo uses
  [Conventional Commits](https://www.conventionalcommits.org/) (validated by a
  dependency-free `commit-msg` git hook), e.g. `feat: add glucose measure type`
  or `fix: encode state`.
- **API accuracy**: when touching endpoints, cite the relevant
  [Withings API reference](https://developer.withings.com/api-reference) page in
  your PR. Note that `getmeas` lives at `/measure`, not `/v2/measure`.

## Submitting a pull request

1. Fork and create a feature branch.
2. Run `pnpm check` and make sure it passes.
3. Open a PR describing the change and linking any related issue.

By contributing you agree that your contributions are licensed under the MIT
License.
