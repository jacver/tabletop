# tabletop

A catalog for tabletop wargaming miniatures: figurines, a paint library, your
own game systems and army lists. `tabletop` is a codename; the display name
lives in `src/config/app.ts` (`APP_NAME`).

Contributors (human or Claude) start with [`CLAUDE.md`](CLAUDE.md), then the
feature spec in [`docs/features/`](docs/features/).

## Setup

Requirements: Node 26 LTS (see `.nvmrc`) and pnpm (the version pinned in
`package.json` under `packageManager`).

```bash
nvm use                                # or install Node 26 another way
npm install -g pnpm@12.18.0            # or: corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install chromium  # once, for end-to-end tests
cp .env.example .env                   # nothing to fill in yet
pnpm dev                               # http://localhost:3000
```

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server on port 3000 |
| `pnpm build` | Production build (SSR) into `dist/` |
| `pnpm build:spa` | Client-only static build into `dist-spa/client/` |
| `pnpm preview` | Serve the production build |
| `pnpm typecheck` | TypeScript check of app code, configs and tests |
| `pnpm lint` | Biome lint + format check |
| `pnpm lint:fix` | Biome lint + format, applying fixes (incl. import order) |
| `pnpm format` | Biome format, writing changes |
| `pnpm test` | Vitest unit tests |
| `pnpm e2e` | Playwright against the production build |
| `pnpm e2e:spa` | Playwright against the SPA build on a static server |

Before every commit: `pnpm typecheck && pnpm lint && pnpm test`.
