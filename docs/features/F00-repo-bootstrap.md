# F00: Repo bootstrap

- **Branch:** `chore/F00-repo-bootstrap`
- **Sessions:** `[F00] repo-bootstrap · build`, `· review`
- **Status:** Draft, awaiting approval

## Goal

An empty but complete project skeleton: every tool from `CLAUDE.md` is
installed, configured and proven by one passing check, so every later branch
only adds features.

## Scope

1. **Project:** TanStack Start 1.x app created with the official starter (Vite 8),
   TypeScript `strict: true` plus `noUncheckedIndexedAccess`.
2. **Package manager:** pnpm, with the version pinned in `package.json` (`packageManager`)
   and Node pinned to the current LTS in `.nvmrc` and `engines`.
3. **Styling:** Tailwind CSS v4 through its Vite plugin; `shadcn` initialized
   (components in `src/components/ui/`) with `Button` added.
4. **Lint and format:** Biome configured for lint + format, with
   `src/components/ui/` and generated route files excluded from lint.
5. **Unit tests:** Vitest + Testing Library + jsdom, with config shared with Vite.
6. **End-to-end tests:** Playwright (Chromium only for now), using `webServer`
   config that starts the app.
7. **SPA build:** a `build:spa` script producing a client-only static build
   (TanStack Start SPA mode) that can be served by any static server.
8. **Env:** `src/env.ts` with an empty Zod schema plus `.env.example`.
9. **Home route:** `/` shows the `APP_NAME` constant as its heading, plus a shadcn `Button`
   labelled "Get started" (no action yet).
10. **Scripts:** `dev`, `build`, `build:spa`, `preview`, `typecheck`, `lint`,
    `format`, `test`, `e2e`.
11. **Repo hygiene:** `.gitignore`, `.editorconfig`, a README with the setup steps,
    `CLAUDE.md` and this spec committed.
12. **Name:** the repo and package are named `tabletop` (codename).
    `src/config/app.ts` exports `APP_NAME = "Tabletop"`, and every
    use of the display name imports it (including the page `<title>` and the tests).

## Out of scope

- Database, Docker Compose, Drizzle (F02)
- CI workflow (F01)
- Deploy config, Cloudflare, Wrangler (F03)
- Auth, layout shell, dark mode (F04, F07)

## Acceptance criteria (test names)

Unit (`src/routes/index.test.tsx`):
- `home route renders the APP_NAME constant as the page heading`
- `document title includes APP_NAME`
- `home route renders a "Get started" button`

Unit (`src/env.test.ts`):
- `env parses an empty environment without throwing`

End-to-end (`tests/e2e/home.spec.ts`):
- `home page loads with status 200 and shows the app name`
- `tailwind styles are applied to the home heading`: assert one computed style
  set by a Tailwind class (e.g. `font-weight: 700` from `font-bold`)

End-to-end against the SPA build (`tests/e2e/spa.spec.ts`, run with `pnpm e2e:spa`):
- `spa build serves the home page from a static server`

Command checks (run by hand in review, by CI from F01):
- `pnpm install --frozen-lockfile` succeeds on a clean clone
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm e2e`, `pnpm build`,
  `pnpm build:spa` all exit 0

## Steps for the build session

1. Write the test files above first; they should fail.
2. Scaffold with the official TanStack Start starter, then strip demo routes.
3. Add Tailwind v4, then `shadcn init`, then `shadcn add button`.
4. Add Biome, Vitest, Playwright configs and scripts.
5. Configure SPA mode for `build:spa`, and add an `e2e:spa` Playwright project
   that serves the static output.
6. Make all tests pass; run every command check.
7. Commit in small Conventional Commits; open PR `F00: Repo bootstrap`.

## Risks

| Risk | Mitigation |
| --- | --- |
| Tutorials predate 1.0 (Vite 7, `.inputValidator()`) | Follow the current TanStack Start docs only; 1.0 renamed it to `.validator()` |
| shadcn init assumes a different framework layout | Pick the Vite/manual path; set aliases to `@/` → `src/` |
| SPA mode needs config that differs from the SSR build | Keep it in one place in `vite.config.ts`, switched by an env flag |
| Biome flags generated files | Exclude `routeTree.gen.ts` and `src/components/ui/` |

## Follow-ups

- (add anything found during build that is out of scope)
