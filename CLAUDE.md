# CLAUDE.md

Project guide for every Claude session in this repo. Read this first, then the
spec for your feature in `docs/features/`. Do not explore the repo beyond what
the spec names.

> The product name isn't chosen yet. The repo and package use the codename
> `tabletop`. The display name lives in ONE constant, `APP_NAME` in
> `src/config/app.ts` (currently "Tabletop"). Never hard-code the name
> anywhere else: UI, emails, meta tags and tests all import the constant, so
> renaming later is a one-line change.

## What this is

APP_NAME is a catalog for tabletop wargaming miniatures. Users log figurines
(2 photos each), keep a paint library, organize figurines into their own
game systems → factions → unit templates, build decks (army lists) with
points totals, and share read-only links.

**No third-party IP, ever.** No publisher, game, faction or unit names, logos
or art in code, seed data, fixtures, tests, screenshots or copy. Use invented
names (e.g. "Ironvale Skirmish", "Brass Wardens") in examples and tests.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | TanStack Start 1.x (React, Vite 8, server functions) |
| Routing / data | TanStack Router, TanStack Query |
| Forms / tables | TanStack Form + Zod, TanStack Table |
| UI | shadcn/ui, Tailwind CSS v4 |
| DB | PostgreSQL 16+, Drizzle ORM, drizzle-kit migrations |
| Auth | Better Auth (email/password, Google; Apple later) |
| Files | Cloudflare R2, presigned uploads |
| Hosting | Cloudflare Workers + Hyperdrive (Node host fallback) |
| Tests | Vitest + Testing Library, Playwright |
| Tooling | pnpm, TypeScript strict, Biome |

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Production build (SSR) |
| `pnpm build:spa` | Client-only static build (used by mobile in Phase 5) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` / `pnpm format` | Biome check / Biome format --write |
| `pnpm test` | Vitest (unit + integration) |
| `pnpm e2e` | Playwright |
| `pnpm db:up` / `pnpm db:migrate` / `pnpm db:seed` | Local Postgres (from F02) |

Run `pnpm typecheck && pnpm lint && pnpm test` before every commit.

## Layout

```
src/
  routes/            TanStack Router file routes (UI only, no business logic)
  server/            server functions, one file per feature (figurines.ts, paints.ts…)
  db/                Drizzle schema (schema/*.ts), client, migrations
  lib/               pure logic shared by client and server (points math, validation)
  schemas/           Zod schemas shared by forms and server functions
  components/ui/     shadcn components (generated; edit sparingly)
  components/        app components
  env.ts             the ONLY place that reads environment variables
tests/
  e2e/               Playwright specs
docs/features/       one spec per feature ID
```

## Rules

1. **Authorization on every query.** Every row has `owner_id`. Every server
   function reads the session user and filters by it. Another user's resource
   returns 404, never 403 (don't confirm it exists).
2. **Validate at the boundary.** Server functions parse input with the shared
   Zod schema from `src/schemas/`.
3. **Client-renderable routes.** Every route must work in the SPA build. No
   business logic in SSR-only code; loaders call server functions.
4. **Web-standard APIs on the server.** fetch, Request/Response, Web Crypto.
   No Node-only modules (`fs`, `crypto` from node, etc.) outside build scripts.
5. **Env via `src/env.ts` only.** Zod-validated; never `process.env` elsewhere.
6. **Migrations are forward-only.** Never edit a merged migration.
7. **Limits live in the database where possible** (e.g. unique
   `(figurine_id, slot)` for the 2-photo limit), and are also checked in code.
8. **No secrets in the repo.** `.env.example` lists names only.

## Working conventions

| Thing | Format | Example |
| --- | --- | --- |
| Feature ID | `F` + two digits | `F08` |
| Branch | `feat/F08-slug`, `fix/…`, `chore/…` | `chore/F00-repo-bootstrap` |
| Session name | `[F08] slug · plan` / `build` / `review` / `fix-N` | `[F00] repo-bootstrap · build` |
| Spec | `docs/features/F08-slug.md` | |
| Commit | Conventional Commits with scope | `feat(figurines): add status filter` |
| PR title | `F08: Title` | One PR per branch, squash merge |

One branch = one feature = one PR. Touch only files the spec names plus
shared code it explicitly calls out. Work you notice outside the spec goes in
the spec's **Follow-ups** list, not in the PR.

### Session loop

1. **Plan**: write the spec (scope, out of scope, data changes, routes,
   acceptance criteria as test names, risks). The user approves it.
2. **Build**: read this file and the spec only. Write the tests first, then
   implement until they pass. Open the PR.
3. **Review**: fresh session reads the spec and the diff, not the build chat.
   Look for authz holes, missing tests, spec drift.
4. **Fix-N**: address review, merge, update this file if a convention changed.

## Definition of done

- [ ] Every acceptance criterion maps to a named, passing test
- [ ] Typecheck, lint, format clean; no new `any` or `@ts-ignore`
- [ ] Integration tests hit real Postgres, not mocks
- [ ] Authz test: user B gets 404 on user A's new resources
- [ ] Server functions validate input with the shared Zod schema
- [ ] Migrations run cleanly from empty and on a copy of staging data
- [ ] One Playwright happy-path test for the feature
- [ ] Keyboard navigation and labels checked on new UI
- [ ] Deployed to staging and smoke-tested (from F03 on)
- [ ] Spec Follow-ups updated; this file updated if conventions changed
