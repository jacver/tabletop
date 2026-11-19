# F02: Database foundation

- **Branch:** `chore/F02-database`
- **Sessions:** `[F02] database · plan`, `· build`, `· review`
- **Status:** Built and merged 2026-11-19 ([PR #4](https://github.com/jacver/tabletop/pull/4), squash `5d90ecd`). Drift canary run in [PR #5](https://github.com/jacver/tabletop/pull/5).

Items marked **Assumed** are defaults chosen by the plan session for the owner
to confirm or change. Items marked **Verify** were checked against current
docs or by running the tool; findings and sources are under Verified facts.

## Goal

A local Postgres that any session can start with one command, a Drizzle
schema and forward-only migrations in `src/db/`, a seed command, and
integration tests that run against real Postgres locally and in the one `ci`
job. One small app table proves the whole path (generate → migrate → seed →
query → test) end to end, so F04 onward only add tables.

## Scope

### 1. Dependencies (exact versions, like the rest of `package.json`)

| Package | Version | Where | Why |
| --- | --- | --- | --- |
| `drizzle-orm` | `0.45.4` | dependencies | ORM. Current `latest` dist-tag (1.0 is still `rc`) |
| `pg` | `8.23.1` | dependencies | node-postgres driver: Cloudflare's recommended driver for Hyperdrive, also the Drizzle default (see Verified facts) |
| `drizzle-kit` | `0.31.11` | devDependencies | Migrations CLI. Current `latest` |
| `@types/pg` | `8.23.1` | devDependencies | Types for `pg` |

**Assumed:** stay on the stable 0.x line, not `1.0.0-rc.5`. Move to 1.0 in a
`chore/` branch once it is `latest` (see Follow-ups). No `tsx` and no
`dotenv`: Node runs the seed script's TypeScript natively, and `.env` loading
uses Node's built-in `--env-file-if-exists` / `process.loadEnvFile()`.

Every version above was published at least 24 hours ago (oldest 2026-08-17,
newest 2026-10-08), so pnpm 12's `minimumReleaseAge` (1440 minutes) doesn't
block them. If `pnpm install` reports a transitive dependency as too new or
an ignored build script, add the narrowest entry to `pnpm-workspace.yaml`
(`minimumReleaseAgeExclude` or `allowBuilds`) and say so in the PR.

### 2. Local Postgres: `compose.yaml` (new, repo root)

- One service `postgres`, image **`postgres:18-alpine`** (**Assumed**: Postgres 18,
  the newest major. `CLAUDE.md` says 16+, and Hyperdrive supports 9.0 to 18.x).
  The same tag is used in CI (Scope 7). F03 must provision staging on the
  same major.
- `environment`: `POSTGRES_USER: tabletop`, `POSTGRES_PASSWORD: tabletop`,
  `POSTGRES_DB: tabletop`. These are throwaway local credentials for a
  container bound to localhost, not secrets (rule 8 covers real secrets).
- `ports: ["127.0.0.1:5432:5432"]` (localhost only).
- Named volume `tabletop-pgdata` mounted at **`/var/lib/postgresql`** (not
  `/var/lib/postgresql/data`: the 18 image moved `PGDATA` to
  `/var/lib/postgresql/18/docker` and declares the parent as its volume).
- `healthcheck`: `test: ["CMD-SHELL", "pg_isready -U tabletop -d tabletop"]`,
  `interval: 2s`, `timeout: 5s`, `retries: 15`, so `--wait` works.

### 3. Scripts (`package.json`)

| Script | Command |
| --- | --- |
| `db:up` | `docker compose up -d --wait postgres` |
| `db:down` | `docker compose down` (keeps the volume; README shows `docker compose down -v` to wipe it) |
| `db:generate` | `drizzle-kit generate` |
| `db:migrate` | `drizzle-kit migrate` |
| `db:seed` | `node --env-file-if-exists=.env src/db/cli/seed.ts` |
| `test:unit` | `vitest run --project unit` |
| `test:int` | `vitest run --project integration` |

`test` stays `vitest run` and runs **both** projects, so `pnpm typecheck &&
pnpm lint && pnpm test` keeps meaning "everything" and needs Postgres up.
`test:unit` is for quick loops without a database.

### 4. Env (`src/env.ts`, `.env.example`)

- Add `DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional()` to
  `envSchema`. **Assumed: optional in the schema.** On Workers the
  connection string comes from the Hyperdrive binding
  (`env.HYPERDRIVE.connectionString`, wired in F03), not from
  `DATABASE_URL`. Also, the F00 test `env parses an empty environment without
  throwing` must stay green.
- Add `export function requireDatabaseUrl(env: Env): string`, which returns
  `env.DATABASE_URL` or throws
  `Error("DATABASE_URL is not set. Start Postgres with \`pnpm db:up\` and copy .env.example to .env (see README).")`.
  Tooling, tests and the seed CLI call it; app code in F03 reads the
  Hyperdrive binding instead.
- `.env.example`: replace `# (none yet)` with a comment line naming the
  local value's shape (`# DATABASE_URL: postgres://USER:PASSWORD@HOST:5432/DB; local value in README`)
  and then `DATABASE_URL=` (name only, rule 8).
- README gives the local value: `DATABASE_URL=postgres://tabletop:tabletop@localhost:5432/tabletop`.

### 5. Drizzle layout (`src/db/`, `drizzle.config.ts`)

```
drizzle.config.ts           drizzle-kit config (root, Node types)
src/db/
  client.ts                 createDb(): typed Drizzle instance over a pg Pool or Client
  schema/
    index.ts                re-exports every table (the `schema` object)
    game-systems.ts         first table (Scope 6)
  migrations/               generated by drizzle-kit: NNNN_name.sql + meta/ (committed)
  seed.ts                   export async function seed(db): idempotent sample data
  cli/
    seed.ts                 CLI entry for `pnpm db:seed` (Node only)
src/test/
  db-global-setup.ts        Vitest globalSetup: per-run test database
  db.ts                     test helpers: testDb(), newOwnerId()
```

- **`drizzle.config.ts`:** `defineConfig({ dialect: "postgresql", schema:
  "./src/db/schema/index.ts", out: "./src/db/migrations", casing:
  "snake_case", strict: true, verbose: true, migrations: { schema:
  "drizzle", table: "__drizzle_migrations" }, ...(url && { dbCredentials:
  { url } }) })`. It loads `.env` with `try { process.loadEnvFile(); } catch {}`
  and reads the URL through `parseEnv(process.env).DATABASE_URL` from
  `src/env.ts` (rule 5: it still goes through the one Zod schema). When
  the URL is absent, `generate` still works, and `migrate` fails with
  drizzle-kit's own `url: undefined` error. The `migrations` values are
  drizzle-kit's defaults, written out so that the programmatic migrator
  (tests) and the CLI provably use the same table.
- **`src/db/client.ts`:** exports `createDb(client: Pool | Client)` returning
  `drizzle({ client, schema, casing: "snake_case" })`, and `type Database =
  ReturnType<typeof createDb>`. Passing the pg client in (instead of a URL)
  lets F03 follow Cloudflare's pattern (a new `pg.Client` per request over
  Hyperdrive) and use a `Pool` on the Node host and in tests, with one typed
  API. No module-level connection, no env reads (rule 5).
- **`casing: "snake_case"`** in both places: TypeScript keys are camelCase
  (`ownerId`), SQL columns snake_case (`owner_id`), and column names aren't
  repeated by hand.
- **Relative imports in `src/db/` and `src/test/db*.ts` carry the `.ts`
  extension** (`./schema/index.ts`), because `pnpm db:seed` runs under Node's
  native type stripping, which doesn't resolve extensionless paths.
  `allowImportingTsExtensions` is already on. No path aliases (`@/`), enums
  or parameter properties in files the seed CLI imports.
- **Typecheck split:** add `"src/db/cli"` to `exclude` in `tsconfig.app.json`
  (it uses `process`). `tsconfig.node.json` already includes all of `src`, so
  the CLI is type-checked with Node types there. `src/test/` is already
  excluded from the app config.
- **Migrations are generated, never hand-written,** and are forward-only once
  merged (rule 6). The build generates the first one with
  `pnpm db:generate --name init` → `src/db/migrations/0000_init.sql`.

### 6. First table: `game_systems` (**Assumed** scope)

**Recommendation: one table, `game_systems`, and nothing else.** It is the
smallest thing that exercises every part of F02 for real: a generated
migration, `owner_id` on every row (rule 1), a DB-enforced limit (rule 7),
a seed with invented names, and an owner-filtered query in an integration
test. It is the root of the product's own hierarchy (game systems → factions
→ unit templates) and references no other app table, so it doesn't commit
F02 to factions or figurines design. The alternative, infrastructure only, leaves the
migrate and seed commands with nothing to do and the integration-test path
unproven until F04. Auth tables are F04's (Better Auth generates them).

| Column (SQL) | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK, default `gen_random_uuid()` | Built in since PG 13. **Assumed:** UUID ids for app tables, so ids in share links can't be guessed. |
| `owner_id` | `text not null` | **Assumed `text`:** Better Auth's user id is a string. No FK yet: `user` doesn't exist until F04, which adds the FK in a new migration. |
| `name` | `text not null` | |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | Drizzle `$onUpdate(() => new Date())` |

Constraint: unique index `game_systems_owner_name_uq` on `(owner_id, name)`
(one owner can't have two systems with the same name; two owners can).
Index on `owner_id` alone is unnecessary: the unique index leads with it.

Drizzle: `uuid().primaryKey().defaultRandom()`, `text().notNull()`,
`timestamp({ withTimezone: true }).notNull().defaultNow()`. Export the table
as `gameSystems` and the row types `GameSystem` / `NewGameSystem`
(`$inferSelect` / `$inferInsert`).

**Not in F02:** server functions, Zod schemas in `src/schemas/`, routes or UI
for game systems. The feature that builds them extends the table with new
migrations.

### 7. CI: the same `ci` job (`.github/workflows/ci.yml`)

Add to the existing `ci` job (no new job, still one check):

```yaml
    services:
      postgres:
        image: postgres:18-alpine
        env:
          POSTGRES_USER: tabletop
          POSTGRES_PASSWORD: tabletop
          POSTGRES_DB: tabletop
        options: >-
          --health-cmd "pg_isready -U tabletop -d tabletop"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
        ports:
          - 5432:5432
    env:
      DATABASE_URL: postgres://tabletop:tabletop@localhost:5432/tabletop
```

New steps, in this order, between `pnpm lint` and `pnpm test`:

1. `pnpm db:generate` then a step named `migrations match schema` running
   `test -z "$(git status --porcelain -- src/db/migrations)"` (fails when
   someone changed `schema/` without generating, or edited a migration;
   on failure, `git status` and `git diff` the folder in the same step so
   the log shows what changed).
2. `pnpm db:migrate`: proves the CLI applies all migrations to an empty
   database.
3. `pnpm db:seed`: proves the seed CLI against the migrated database.

Then the existing `pnpm test`, which now includes the integration project.
The job runs directly on the runner, so the service is reached at
`localhost:5432` via the `ports` mapping. The credentials are the same
throwaway values as `compose.yaml`, not secrets. Images are tags, not
digests, and the action pins are untouched.

### 8. Integration tests (**Assumed** isolation)

- **Separation:** `vite.config.ts` `test` becomes two Vitest projects (both
  `extends: true` so they inherit the root config):
  - `unit`: today's settings (`environment: "jsdom"`, `setupFiles`), `include:
    ["src/**/*.test.{ts,tsx}"]`, `exclude: ["src/**/*.int.test.ts"]`.
  - `integration`: `environment: "node"`, `include: ["src/**/*.int.test.ts"]`,
    `globalSetup: ["./src/test/db-global-setup.ts"]`.
  Naming rule: a test that touches Postgres is `*.int.test.ts`.
- **A fresh database per run:** the global setup loads `.env` (`try {
  process.loadEnvFile(); } catch {}`), gets the server URL with
  `requireDatabaseUrl(parseEnv(process.env))` (fails loudly with the message
  from Scope 4 when it's missing; never skips), creates
  `tabletop_test_<timestamp>_<random>`, applies migrations with
  `migrate()` from `drizzle-orm/node-postgres/migrator` (`migrationsFolder:
  "src/db/migrations"`, same `migrationsSchema`/`migrationsTable` as the
  config), `provide`s the test database URL to the workers
  (`project.provide("testDatabaseUrl", url)`, with the `ProvidedContext` type
  declared), and in teardown drops it with `DROP DATABASE … WITH (FORCE)`.
  The dev database is never touched by tests. Requires `CREATEDB`, which the
  `POSTGRES_USER` superuser has, locally and in CI.
- **Isolation between files and tests: data scoped by owner, no truncation.**
  `src/test/db.ts` exports `testDb()` (one `Pool` per test file on
  `inject("testDatabaseUrl")`, closed in `afterAll`) and `newOwnerId()`
  (`crypto.randomUUID()`, the Web Crypto global). Every test writes rows under
  a fresh owner id and asserts only on that owner's rows, so files can run in
  parallel (Vitest's default) with no cleanup. Production queries filter by
  owner anyway (rule 1), so the tests use the same pattern. Tests that need
  their own empty database (migrations, seed) create and drop one themselves
  with a helper in `src/test/db.ts`.
- `pnpm test` without Postgres fails in the integration project with the
  clear message. That's intended: the definition of done requires real
  Postgres.

### 9. Seed (`src/db/seed.ts`, `src/db/cli/seed.ts`)

- `seed(db: Database)` inserts the sample game systems for the fixed owner
  id `SEED_OWNER_ID = "seed-owner"` (exported), with
  `onConflictDoNothing({ target: [ownerId, name] })`, so running it twice
  changes nothing. **Assumed:** a placeholder owner until F04. F04 replaces it
  with a real dev user (Follow-up).
- **Invented names only:** `"Ironvale Skirmish"`, `"Gloamreach Wars"`,
  `"Cinderfall Tactics"`. No real game, publisher, faction or paint names
  anywhere (seed, tests, README).
- The CLI: `requireDatabaseUrl(parseEnv(process.env))`, then
  `assertLocalDatabaseUrl(url)`, which **refuses** unless
  the URL's hostname is `localhost`, `127.0.0.1` or `[::1]` (WHATWG `URL` keeps the brackets for IPv6) (**Assumed**
  safety guard so a mistyped URL can't seed staging; exits 1 with a message),
  opens a `Pool`, runs `seed`, logs how many rows were inserted, and closes the
  pool. Exit code 1 on any error.

### 10. Rule 4 guard (lint)

`@types/pg` declares `/// <reference types="node" />`, so once app code
imports `pg`, Node globals become visible to the app typecheck that F00 kept
web-only. To keep rule 4 enforced, enable Biome's **`noNodejsModules`** rule
(error) in `biome.json` with an `overrides` entry that turns it off for
`*.config.ts`, `src/db/cli/**`, `src/test/**` and `tests/**`. (Verify the
rule's group and the `overrides` syntax against Biome 2.6's schema in
`node_modules/@biomejs/biome/configuration_schema.json`.) Importing `pg`
itself is allowed: it's a package, and on Workers it runs under
`nodejs_compat` (F03).

### 11. README

A "Database" section: requirements (Docker, or a local Postgres 16+); `cp
.env.example .env` and the local `DATABASE_URL`; `pnpm db:up`, `pnpm
db:migrate`, `pnpm db:seed`; changing the schema means editing
`src/db/schema/`, then `pnpm db:generate --name <slug>`, then committing the
generated SQL and `meta/`, and never editing a merged migration; `pnpm test`
needs Postgres, `pnpm test:unit` doesn't; wipe with `docker compose down -v`.
Add the new scripts to the Commands table.

### Files the build touches

New: `compose.yaml`, `drizzle.config.ts`, `src/db/client.ts`,
`src/db/schema/index.ts`, `src/db/schema/game-systems.ts`,
`src/db/migrations/0000_init.sql` and `src/db/migrations/meta/*` (generated),
`src/db/seed.ts`, `src/db/seed.test.ts`, `src/db/cli/seed.ts`, `src/test/db-global-setup.ts`,
`src/test/db.ts`, and the test files under Acceptance criteria.

Changed: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (only if
Scope 1 needs it), `src/env.ts`, `src/env.test.ts`, `.env.example`,
`vite.config.ts`, `tsconfig.app.json`, `biome.json`,
`.github/workflows/ci.yml`, `README.md`, `CLAUDE.md` (only the Commands row:
add `pnpm db:generate`, `pnpm db:down`, `pnpm test:unit` / `test:int`, and
drop "(from F02)"), and this spec (status, Follow-ups).

## Out of scope

- Auth tables, `user` FK on `owner_id`, a real seed user (F04)
- Server functions, `src/schemas/`, routes or UI for game systems (its own feature)
- Wrangler config, Hyperdrive binding, staging database, deploy (F03)
- Row-level security in Postgres (authz stays in server functions per rule 1; see Follow-ups)
- Drizzle 1.0 upgrade; Drizzle Studio script
- Cleaning up leftover `tabletop_test_*` databases from crashed local runs
  (see Follow-ups)

## Verified facts

Checked 2026-11-18. `orm.drizzle.team`, `developers.cloudflare.com` and
`docs.github.com` don't resolve from Claude cloud sessions; their docs were
read from source on `raw.githubusercontent.com` (`cloudflare/cloudflare-docs`
branch `production`, `drizzle-team/drizzle-orm-docs` and `github/docs`,
branch `main`). Versions came from the npm registry (`npm view`). Behaviour
marked "ran" was run by the plan session in a scratch directory against a
real Postgres (apt Postgres 16.15 and Docker `postgres:18-alpine` 18.7) on
Node 22.23.

| Item | Finding | Source |
| --- | --- | --- |
| Drizzle versions | `drizzle-orm` `latest` = 0.45.4 (2026-10-08), `drizzle-kit` `latest` = 0.31.11 (2026-09-21). `1.0.0-rc.5` is on the `rc` tag only. `drizzle-orm` peer-accepts `pg >=8` and `postgres >=3`. | npm registry |
| Driver on Workers + Hyperdrive | node-postgres (`pg`) "is the recommended driver for connecting to your Postgres database from JavaScript or TypeScript Workers". Minimum `pg` for Hyperdrive is **8.16.3**. Needs the `nodejs_compat` compatibility flag. Create **a new `Client` per request** ("Hyperdrive maintains the underlying database connection pool"). | cloudflare-docs `src/content/partials/hyperdrive/node-postgres-recommendation.mdx`, `use-node-postgres-to-make-query.mdx`, `hyperdrive-node-compatibility-requirement.mdx` |
| Drizzle + Postgres.js on Hyperdrive | "Pairing Drizzle ORM with the Postgres.js driver over Hyperdrive is not currently supported. Switch your driver to node-postgres (`pg`)". This rules out `postgres` (porsager), whose `latest` is a new 4.x line anyway (4.0.0 on 2026-10-29). | cloudflare-docs `hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/drizzle-orm.mdx` (reviewed 2026-10-01) |
| Drizzle with node-postgres | `drizzle-orm/node-postgres` accepts `{ client: pool }` (or a `Client`). The Drizzle get-started guide uses `pg` + `@types/pg`. | drizzle-orm-docs `src/mdx/get-started/postgresql/ConnectPostgreSQL.mdx`, `src/content/docs/get-started/postgresql-new.mdx` |
| `pg` version | `latest` = 8.23.1 (2026-09-30), above the 8.16.3 Hyperdrive minimum. `@types/pg` 8.23.1 (2026-08-17). | npm registry |
| Hyperdrive local dev | `wrangler dev` uses `localConnectionString` or the env var `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING>`; pooling and caching don't apply locally. Relevant to F03, recorded here. | cloudflare-docs `hyperdrive/configuration/local-development.mdx` |
| Hyperdrive Postgres versions | "Known supported versions `9.0` to `18.x`". | cloudflare-docs `hyperdrive/reference/supported-databases-and-features.mdx` |
| drizzle-kit behaviour (ran) | With 0.31.11 + `pg` 8.23.1: `generate --name init` writes `0000_init.sql`, `meta/_journal.json`, `meta/0000_snapshot.json`; `casing: "snake_case"` turns `ownerId` into `"owner_id"`; `migrate` reports "Using 'pg' driver" and records migrations in `drizzle.__drizzle_migrations`; a second `generate` with no schema change prints "No schema changes, nothing to migrate" and writes nothing (the CI drift check relies on this); `generate` works without `DATABASE_URL`, `migrate` fails with `url: undefined`. | Ran locally |
| Programmatic migrator (ran) | `migrate(db, { migrationsFolder })` from `drizzle-orm/node-postgres/migrator` applies the same files to a freshly created database. A unique violation surfaces as an error whose `cause.code` is `"23505"` (drizzle wraps the pg error), so tests check `cause.code`. | Ran locally |
| Vitest projects (ran) | Vitest 5.1.0 supports `test.projects` with inline `{ extends: true, test: { name, include, environment, globalSetup } }`, `--project <name>` filtering, and `project.provide()` / `inject()` from a global setup. | Ran locally; `vitest/dist` types |
| zod URL check (ran) | zod 4.6.7 `z.url({ protocol: /^postgres(ql)?$/ })` accepts `postgres://…` and `postgresql://…`, rejects `http://…` and non-URLs. | Ran locally |
| Node native TypeScript (ran) | Node 22.23 runs a `.ts` file importing `zod` with no flags (type stripping); Node 26 does too. Relative imports need explicit `.ts` extensions. | Ran locally |
| GitHub Actions service container | For jobs on the runner (not in a container), map ports (`- 5432:5432`) and connect to `localhost`. Health check via `options: --health-cmd pg_isready --health-interval … --health-timeout … --health-retries …`. "You must use a Linux environment when using service containers." | github/docs `content/actions/tutorials/use-containerized-services/create-postgresql-service-containers.md` |
| `postgres:18` image | `PGDATA=/var/lib/postgresql/18/docker`, declared volume `/var/lib/postgresql`; `pg_isready -U tabletop` works with a custom `POSTGRES_USER`. | `docker image inspect` and a test run |
| pnpm release age | Default `minimumReleaseAge` 1440 minutes for all deps including transitive (as F01 verified). Every pick in Scope 1 is weeks old. | F01 Verified facts (`pnpm/pnpm.io`) |
| `@types/pg` pulls in Node types | `index.d.ts` line 1: `/// <reference types="node" />` and imports from `"tls"`. Hence Scope 10. | `node_modules/@types/pg/index.d.ts` |
| Docker in cloud sessions | The `docker` CLI and Compose v5.7.1 are installed but the daemon isn't running at start. `dockerd` started in the background works, and Docker Hub pulls succeed (`postgres:18-alpine` pulled). An apt Postgres 16 cluster is also installed (stopped). | Ran in this container |

## Acceptance criteria (test names)

Unit (`src/env.test.ts`, project `unit`):
- `env parses an empty environment without throwing` (existing, must stay green)
- `env accepts a postgres DATABASE_URL`
- `env rejects a DATABASE_URL that is not a postgres url`
- `requireDatabaseUrl throws a helpful error when DATABASE_URL is missing`

Unit (`src/db/seed.test.ts`, project `unit`): the host check lives in
`src/db/seed.ts` as `export function assertLocalDatabaseUrl(url: string)`
(web-standard `URL`, no I/O), and the CLI calls it. That way the test doesn't
import the CLI module, which runs on import:
- `seed cli refuses a non-local database host`
- `seed cli accepts localhost, 127.0.0.1 and ::1`

Integration (`src/db/migrations.int.test.ts`):
- `migrations apply cleanly to an empty database`: own fresh database; after
  `migrate`, `game_systems` exists and `drizzle.__drizzle_migrations` has one
  row per `meta/_journal.json` entry
- `running migrations twice is a no-op`

Integration (`src/db/schema/game-systems.int.test.ts`):
- `game_systems rejects a duplicate name for the same owner` (`cause.code === "23505"`)
- `game_systems allows the same name for different owners`
- `game_systems requires owner_id`
- `game_systems fills id and timestamps by default`
- `querying game_systems by owner returns only that owner's rows`

Integration (`src/db/seed.int.test.ts`, own fresh database):
- `seed inserts the sample game systems for the seed owner`
- `seed is idempotent when run twice`

Command and CI checks (review reads them in the PR's `ci` log):
- `pnpm db:up` then `pnpm db:migrate` then `pnpm db:seed` succeed on a clean
  clone with `.env` copied from the README value (build session, locally)
- `ci` runs `migrations match schema`, `pnpm db:migrate`, `pnpm db:seed` and
  the integration project against the service container, and is green
- `ci fails when the schema changes without a migration`: throwaway commit
  adding a column to `game-systems.ts` without generating; the `migrations
  match schema` step fails. Revert it with a follow-up commit (no force-push).
- First green run's job duration noted in the PR (was ~1.5 min before F02)

Definition-of-done items that don't apply to F02, and why: **authz 404
test** (no server functions or resources reachable by users yet; the owner
query test stands in for the pattern), **Playwright happy path** and
**keyboard/labels** (no UI), **staging deploy and staging-data migration**
(no staging until F03; the migration is checked from empty).

## Steps for the build session

1. **Postgres for this session.** Cloud sessions have Docker but no running
   daemon: start it with `sudo dockerd > /tmp/dockerd.log 2>&1 &` (drop
   `sudo` if already root), wait for `docker info` to succeed, then use
   `pnpm db:up` as documented. If Docker won't start, the fallback is the
   preinstalled apt Postgres 16: `service postgresql start`, then
   `su postgres -c "psql -c \"create role tabletop login superuser password 'tabletop'\""`
   and `su postgres -c "createdb -O tabletop tabletop"`; the same
   `DATABASE_URL` then works. Either way, CI (Postgres 18) is the reference.
2. Node: the container has Node 22, the project pins 26. Everything here
   ran on 22. Use 26 if it's available, but don't spend time installing it.
3. `cp .env.example .env` and set the local `DATABASE_URL` (`.env` is
   gitignored; check before committing).
4. Add the dependencies (Scope 1) and scripts (Scope 3).
5. Write the tests first (Acceptance criteria) plus `src/test/db*.ts` and the
   Vitest projects; they should fail.
6. `src/env.ts`, `compose.yaml`, `drizzle.config.ts`, `src/db/schema/*`,
   `src/db/client.ts`, then `pnpm db:generate --name init` and commit the
   generated files untouched.
7. `src/db/seed.ts`, `src/db/cli/seed.ts`, tsconfig exclude, Biome rule.
8. `pnpm typecheck && pnpm lint && pnpm test` all green, with integration
   tests running against the local Postgres. Run `pnpm db:migrate` and
   `pnpm db:seed` twice by hand.
9. CI changes (Scope 7), README and the `CLAUDE.md` Commands row.
10. Commit in small Conventional Commits (`build(deps): add drizzle and pg`,
    `feat(db): add game_systems table and first migration`,
    `test(db): add integration test setup`, `ci: add postgres service and
    migration checks`, `docs(readme): add database section`), push, open PR
    `F02: Database foundation`.
11. Confirm `ci` is green, run the drift canary (push, see red, revert),
    record run URLs and the job duration in the PR description, and update
    this spec's status and Follow-ups.

## Risks

| Risk | Mitigation |
| --- | --- |
| `pg` imported into a client bundle (breaks `build:spa` or ships the driver to browsers) | Only server code imports `src/db/`; F02 adds no route that does. `pnpm build:spa` in CI catches a leak. Server functions (later) import `src/db/` only inside handlers. |
| `@types/pg` leaks Node globals into the app typecheck | Biome `noNodejsModules` (Scope 10) still blocks `node:`/built-in imports in app code. Using globals such as `process` in app code isn't caught by the linter; review watches for it. |
| Drizzle 1.0 lands soon after F02 and changes the migration folder format (main-branch docs already show folder-per-migration) | Pin exact 0.x versions; upgrade in its own branch with drizzle-kit's upgrade path; never rewrite merged migrations. |
| drizzle-kit wasn't run on Node 26 by the plan session (container has 22) | CI runs on Node 26 (`.nvmrc`); a failure shows up on the first run. |
| Port 5432 already in use locally (e.g. a host Postgres) | README says to stop it or change the host port in `compose.yaml` and `.env` together. |
| Parallel integration tests interfere | Fresh database per run plus owner-scoped data; tests that need an empty database create their own. |
| Crashed local runs leave `tabletop_test_*` databases behind | Harmless; README shows how to drop them. Follow-up for automatic cleanup. |
| CI time and minutes | Service container starts while checkout/install run; three short steps plus a few seconds of integration tests. Expect about +30 s. The duration is recorded. |
| Docker Hub pull rate limits on CI | GitHub-hosted runners rarely hit them for one small image. If they do, switch to the `public.ecr.aws/docker/library/postgres` mirror in a `fix/` branch. |

## Follow-ups

- **Build results (2026-11-19):** first green `ci` run
  [44426343193](https://github.com/jacver/tabletop/actions/runs/44426343193),
  job **1 min 9 s** (was ~1.5 min before F02; about 2 s added for the
  migration steps and integration tests, plus ~12 s for the service container
  to start, which overlapped other work). Migration checks, `db:migrate`,
  `db:seed` and the integration project ran against Postgres 18.7 on Node 26.
  drizzle-kit 0.31.11 worked on Node 26 unchanged.
- **Drift canary (run in PR #5):** PR #4 was merged at its green head
  seconds after its canary commit was pushed, so the check ran on the
  follow-up PR #5 instead. Canary `71b0c8a` added a column to
  `game-systems.ts` without `pnpm db:generate`;
  [run 44427048192](https://github.com/jacver/tabletop/actions/runs/44427048192)
  failed at `migrations match schema` with the error annotation, `git status`
  (new `0001_*.sql` and snapshot) and the `_journal.json` diff in the log,
  and every later step was skipped. Reverted in `cdee15c` (no force-push).
- **Build deviation, empty `DATABASE_URL`:** `.env.example` ships
  `DATABASE_URL=` (empty), which failed Zod's URL check with a raw error. The
  schema now treats `""` as unset, so `requireDatabaseUrl` shows its message.
  Covered by an extra assertion in the existing `requireDatabaseUrl…` test.
- **Build deviation, Biome ignores `src/db/migrations`:** drizzle-kit writes
  `meta/*.json` with 2-space indent, which fails Biome's formatter, and
  generated files must stay untouched.
- **Verified in build:** Biome 2.6.7 rule is `correctness/noNodejsModules`;
  `overrides[].includes` + `linter.rules` is the override syntax. A probe
  importing `node:fs` under `src/lib/` fails lint.

- **F01 follow-up picked up:** "F02 can add the Postgres `services:` block to
  the same `ci` job, which keeps one check to look at." Done in Scope 7.
- **F00 follow-up noted for F03:** server code calls `parseEnv(source)` per
  request; F03 builds the per-request `pg.Client` from
  `env.HYPERDRIVE.connectionString` and passes it to `createDb`, adds
  `nodejs_compat` and the Hyperdrive binding to the Wrangler config, and
  provisions staging Postgres on major 18.
- **F04:** add the FK `game_systems.owner_id → user.id` (`on delete cascade`)
  in a new migration once Better Auth's tables exist, and replace
  `SEED_OWNER_ID` with a seeded dev user.
- **Drizzle 1.0** upgrade in a `chore/` branch once `1.0.0` is `latest`.
- **Leftover test databases:** optional cleanup of `tabletop_test_*` older
  than a day in the global setup.
- **Postgres row-level security** as defense in depth behind rule 1: worth
  a decision before sharing (read-only links) ships.
- **Cloud environment:** a setup script that starts `dockerd`, and allowing
  `orm.drizzle.team` and `developers.cloudflare.com` (both unreachable from
  cloud sessions today) would save future sessions time.
