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
cp .env.example .env                   # then set DATABASE_URL (see Database)
pnpm db:up && pnpm db:migrate          # see Database
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
| `pnpm test` | Vitest: unit and integration tests (needs Postgres) |
| `pnpm test:unit` | Unit tests only (no database) |
| `pnpm test:int` | Integration tests only (`*.int.test.ts`, real Postgres) |
| `pnpm e2e` | Playwright against the production build |
| `pnpm e2e:spa` | Playwright against the SPA build on a static server |
| `pnpm db:up` | Start local Postgres (Docker Compose) and wait until healthy |
| `pnpm db:down` | Stop local Postgres, keeping its data |
| `pnpm db:generate` | Generate a migration from `src/db/schema/` |
| `pnpm db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `pnpm db:seed` | Insert sample data (local databases only; safe to rerun) |

Before every commit: `pnpm typecheck && pnpm lint && pnpm test`.

## Database

PostgreSQL with Drizzle ORM. Requirements: Docker (with Compose), or a local
Postgres 16+ you manage yourself.

```bash
cp .env.example .env   # if you haven't already
```

Set the local connection string in `.env`:

```bash
DATABASE_URL=postgres://tabletop:tabletop@localhost:5432/tabletop
```

Then:

```bash
pnpm db:up        # Postgres 18 in Docker on localhost:5432
pnpm db:migrate   # apply migrations
pnpm db:seed      # sample data; refuses non-local hosts, safe to rerun
```

These are throwaway local credentials for a container bound to localhost.
If port 5432 is already taken (e.g. by a Postgres installed on your machine),
stop that one, or change the host port in `compose.yaml` and `.env` together.

**Changing the schema:** edit `src/db/schema/`, run
`pnpm db:generate --name <slug>`, and commit the generated SQL and `meta/`
files in `src/db/migrations/` as they are. Migrations are forward-only: never
edit or delete a migration that has been merged; add a new one instead. CI
fails when the schema and the migrations disagree.

**Tests:** `pnpm test` needs Postgres running and `DATABASE_URL` set; it
fails with a clear message otherwise. `pnpm test:unit` needs no database.
Integration tests (`*.int.test.ts`) create a fresh `tabletop_test_*`
database per run and drop it afterwards; your dev database is never touched.
A crashed run can leave one behind; it's harmless, and you can drop it with
`docker compose exec postgres psql -U tabletop -c 'DROP DATABASE "<name>"'`.

**Wiping everything:** `docker compose down -v` deletes the data volume.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs the same commands as the
table above on every pull request and on every push to `main`: install,
typecheck, lint, the migration checks (`pnpm db:generate` must change
nothing, then `pnpm db:migrate` and `pnpm db:seed` against a Postgres 18
service container), unit and integration tests, both builds, then `pnpm e2e`
and `pnpm e2e:spa`.

- The check is called `ci`. It is **advisory**: this plan can't enforce it,
  so **never merge a PR unless `ci` is green on its latest commit and the
  branch is up to date with `main`**.
- When an e2e step fails, the run uploads a `playwright-report` artifact.
  Download it from the run's Summary page, unzip it and open `index.html`
  (`playwright-report/` for `pnpm e2e`, `playwright-report-spa/` for
  `pnpm e2e:spa`).
- Installs use `--frozen-lockfile`. pnpm 12 refuses versions published less
  than 24 hours ago (`minimumReleaseAge`, default 1440 minutes), so a lockfile
  bump to a brand-new release fails until that release is a day old.
