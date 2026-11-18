# F01: CI pipeline

- **Branch:** `chore/F01-ci-pipeline`
- **Sessions:** `[F01] ci-pipeline · plan`, `· build`, `· review`
- **Status:** Done, merged via PR #2

## Goal

Every pull request is checked automatically with the same commands a developer
runs locally, so a red branch can't be merged by accident. Later features add
steps or jobs to this one workflow instead of inventing their own.

## Scope

1. **One workflow**, `.github/workflows/ci.yml`, named `CI`, triggered on
   `pull_request` (any base branch) and on `push` to `main`. One job, id and
   name `ci`. The repo is private on GitHub Free, so `ci` is **advisory**
   (GitHub can't enforce it; see Decision). Keep the job name stable anyway:
   it is what the merge rule below checks, and what protection would require
   if the plan ever changes.
2. **Steps, in this order, in the one job** (sequential steps are cheaper than
   several jobs that each install):
   1. `actions/checkout` with `persist-credentials: false`
   2. `pnpm/action-setup` with **no** `version` input (it reads
      `packageManager` from `package.json`, currently `pnpm@12.18.0`)
   3. `actions/setup-node` with `node-version-file: .nvmrc`, `cache: pnpm`,
      `cache-dependency-path: pnpm-lock.yaml`
   4. `pnpm install --frozen-lockfile`
   5. `pnpm typecheck`
   6. `pnpm lint`
   7. `pnpm test`
   8. `pnpm build`
   9. `pnpm build:spa`
   10. `pnpm exec playwright install --with-deps chromium`
   11. `pnpm e2e` (step `id: e2e`)
   12. `pnpm e2e:spa` (separate step after `e2e`, never in parallel: the two
       web servers use ports 4310 and 4311 and never reuse a running server)
   13. Upload Playwright reports with `actions/upload-artifact`, only
       `if: failure()`, artifact name `playwright-report`, paths
       `playwright-report/` and `playwright-report-spa/`,
       `if-no-files-found: ignore`, `retention-days: 14`.
3. **No version written twice.** The workflow contains no Node or pnpm version
   number. Node comes from `.nvmrc` (`26.13.1`), pnpm from `packageManager`.
4. **pnpm store cache** via `setup-node`'s `cache: pnpm`, keyed on
   `pnpm-lock.yaml`. `node_modules` is not cached (setup-node doesn't).
5. **Playwright browsers are not cached** (see Verified facts: Playwright's
   docs advise against it, and the `--with-deps` OS packages can't be cached
   anyway).
6. **HTML report on CI.** Today both Playwright configs use only the `github`
   reporter on CI, which writes no report folder, so there would be nothing to
   upload. Change the CI reporter in both configs to
   `[["github"], ["html", { open: "never", outputFolder: … }]]`:
   `playwright-report` for `playwright.config.ts`, `playwright-report-spa` for
   `playwright.spa.config.ts` (separate folders so the second run can't wipe
   the first). Local reporter stays `list`. Add `playwright-report-spa` to
   `.gitignore` next to `playwright-report`.
7. **Concurrency:** `group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}`,
   `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`. A new
   push to a PR branch cancels its older run; runs on `main` are never
   cancelled, so every merge commit gets a full result (F03 will deploy from
   them).
8. **Least privilege:** top-level `permissions: contents: read`, nothing
   per job. Every action (first- and third-party) pinned to a full commit SHA
   with the tag in a trailing comment, e.g.
   `uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`.
9. **Runner and limits:** `runs-on: ubuntu-24.04` (pinned, so the image
   Playwright's `--with-deps` targets doesn't move under us),
   `timeout-minutes: 20` on the job.
10. **README:** a short "CI" section: the workflow runs the same commands as
    the Commands table on every PR and push to `main`; the check is `ci` and
    it is advisory (not enforced on this plan), so **never merge a PR unless
    `ci` is green on its latest commit and the branch is up to date with
    `main`**; a failed e2e run uploads the `playwright-report` artifact (download
    it from the run's Summary page and open `index.html`); installs use
    `--frozen-lockfile`, and pnpm 12 refuses versions published less than
    24 hours ago (`minimumReleaseAge`, default 1440 minutes), so a lockfile
    bump to a brand-new release fails until the release is a day old.

### Action pins (resolved 2026-11-16 with `git ls-remote`)

| Action | Tag | Commit SHA |
| --- | --- | --- |
| `actions/checkout` | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `pnpm/action-setup` | v6.1.1 | `73e46992e05b19abd31f2f3c20e0e7370d762115` (peeled; the annotated tag object is `9bbca1e…`, don't use that) |
| `actions/setup-node` | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| `actions/upload-artifact` | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |

The build session re-resolves each before committing, using the commit the
tag points to (`git ls-remote https://github.com/<owner>/<repo>.git
'refs/tags/<tag>' 'refs/tags/<tag>^{}'`; take the `^{}` line when present).
If a newer patch tag exists, use it. Release dates could not be checked from
the plan session (GitHub's API was blocked); if a tag is less than a week old,
prefer the previous patch, in the same spirit as pnpm's release-age policy.

### Files the build touches

`.github/workflows/ci.yml` (new), `playwright.config.ts`,
`playwright.spa.config.ts`, `.gitignore`, `README.md`, and this spec (status
line and Follow-ups). Nothing else.

## Out of scope

- Postgres service and integration-test step (F02)
- Deploy job and staging smoke test (F03)
- Dependency update bots (Dependabot/Renovate), coverage reporting, preview
  deployments
- Caching Playwright browsers
- Bumping `@playwright/test` / `jsdom` (see Follow-ups)
- Changing repository settings or visibility (owner only; see Human steps)

## Verified facts

Checked 2026-11-16. `docs.github.com`, `playwright.dev` and `pnpm.io` don't
resolve from Claude cloud sessions, so the GitHub and Playwright docs were
read from their source repos (`github/docs`, `microsoft/playwright`,
`pnpm/pnpm.io`, `main` branch); the action READMEs were read on github.com.

| Item | Finding | Source |
| --- | --- | --- |
| setup-node | Latest major v7. `node-version-file` accepts `.nvmrc`. `cache: pnpm` is supported, but "Package manager should be pre-installed", so `pnpm/action-setup` must run first. The default lockfile search doesn't name `pnpm-lock.yaml`, so set `cache-dependency-path` explicitly. Auto-caching from `packageManager` applies to npm only. | github.com/actions/setup-node README and `docs/advanced-usage.md` |
| pnpm/action-setup | Latest major v6; "supports pnpm v12 and earlier". `version` is optional when `package.json` declares `packageManager`. `run_install` defaults to off. It doesn't set up Node. The README also points to a newer `pnpm/setup@v1` for pnpm 11+; we stay on `action-setup` + `setup-node`, which the README says remains supported. | github.com/pnpm/action-setup README |
| Playwright on GitHub Actions | Install with `playwright install --with-deps`. "Caching browser binaries is not recommended, since the amount of time it takes to restore the cache is comparable to the time it takes to download the binaries. Especially under Linux, operating system dependencies need to be installed, which are not cacheable." Their sample uploads `playwright-report/` with `if: ${{ !cancelled() }}` and `retention-days: 30`; we upload only on failure, as the ticket asks, and keep 14 days to save storage. | `microsoft/playwright` `docs/src/ci.md`, `ci-intro.md` |
| pnpm release age | `minimumReleaseAge` default **1440** minutes, applies to all dependencies including transitive. Exceptions go in `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`. In CI, install fails if the lockfile needs an update. | `pnpm/pnpm.io` `docs/settings/dependency-resolution.md`, `docs/supply-chain-security.md`, `docs/cli/install.md` |
| Branch protection | "Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations. Protected branches are also available in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server." | `github/docs` `data/reusables/gated-features/protected-branches.md` |
| Rulesets | Same split: public repos on Free; public and private on Pro, Team, Enterprise Cloud. | `github/docs` `data/reusables/gated-features/repo-rules.md` |
| Actions billing | Standard GitHub-hosted runners are free in public repos. Private repos draw on a monthly included compute amount: GitHub Free **$12**, Pro **$18** (at $0.006/min for standard Linux, roughly 2,000 and 3,000 minutes). | `github/docs` `content/billing/concepts/product-billing/github-actions.md`, `data/reusables/billing/actions-included-quotas.md` |

### Decision: private repo on GitHub Free, CI advisory

**Decided by the owner on 2026-11-16: option C.** The repo goes private and
stays on GitHub Free. Branch protection and rulesets are not available for
private repos on Free (see Verified facts), so the `ci` check is advisory:
GitHub shows it on every PR but does not block merging a red one. The owner
changes visibility; no session does.

Options that were considered:

| Option | Branch protection | Actions minutes | Notes |
| --- | --- | --- | --- |
| A. Stay public | Yes, free | Free, unmetered for standard runners | Code is visible. The no-third-party-IP rule already keeps the repo clean of others' IP. |
| B. Go private and upgrade to GitHub Pro | Yes | ~3,000 Linux min/month included | Paid plan; price not verified here, check GitHub's plans page. |
| C. Go private on Free, CI advisory | **No** (red PRs can be merged; discipline only) | ~2,000 Linux min/month | The `main cannot be merged into while the ci check is red` criterion is dropped. |

What C means in practice:

- **Merge rule (replaces enforcement):** a PR is squash-merged only when `ci`
  is green on its head commit and the branch is up to date with `main` (use
  **Update branch** and wait for the new run if it's behind). Sessions never
  merge, or propose merging, a red or pending PR. Follow-up below adds this to
  `CLAUDE.md`'s Definition of done.
- **Minutes budget:** about $12/month of included compute, roughly 2,000
  standard Linux minutes. The run time is not yet measured; the build session
  records the first green run's duration in the PR so the monthly headroom is
  known. Superseded PR runs are cancelled, which matters more now.
- **Revisit** if a collaborator joins or a red merge ever slips through:
  option B (Pro) turns on enforcement with no workflow change; the Human
  steps then add the ruleset.

## Acceptance criteria (test names)

No app code changes, so the checks are observable workflow results on the
F01 PR. "Throwaway" commits are pushed to the PR, observed, then reverted
with a follow-up commit (no force-push; squash merge removes them from
`main`).

Static checks (review reads `ci.yml`):
- `workflow pins every action to a full commit sha`: every `uses:` is
  `owner/repo@<40 hex chars> # vX.Y.Z`
- `workflow writes no node or pnpm version`: no version number for Node or
  pnpm appears in `ci.yml`
- `workflow grants only contents read`: top-level `permissions` is exactly
  `contents: read`, no job-level overrides

Workflow runs:
- `ci passes on a pull request with no code changes`: the PR's first run is
  green with every step from Scope 2 executed (upload step skipped)
- `ci fails when a unit test fails`: throwaway `src/ci-canary.test.ts` with
  one failing `expect`; the `pnpm test` step fails
- `ci fails when biome reports a lint error`: throwaway `src/ci-canary.ts`
  containing a `debugger;` statement (`noDebugger`, recommended preset); the
  `pnpm lint` step fails
- `a failing e2e run uploads the playwright report artifact`: throwaway
  `tests/e2e/ci-canary.spec.ts` with one failing assertion; the `pnpm e2e`
  step fails and the run has a `playwright-report` artifact containing
  `playwright-report/index.html`
- `a second push to the same branch cancels the first run`: two pushes to the
  PR branch less than a minute apart; the first run shows "Cancelled"
- `ci runs on push to main`: after merge, a run of `CI` appears for the
  merge commit on `main` and passes (checked by the fix/merge session)
- `a red ci run shows as a failed check on the pull request`: with the lint
  canary pushed, the PR's checks list and merge box show `CI / ci` as failed.
  This replaces the ticket's `main cannot be merged into while the ci check is
  red`, which is **dropped**: the owner chose a private repo on GitHub Free,
  where branch protection and rulesets can't be enforced, so no merge block
  exists to observe. It comes back if the plan changes to Pro (option B).

## Human steps (owner)

Repository → **Settings**. Any time, before or after the F01 PR:

1. **General → Danger Zone → Change repository visibility → Make private.**
   From then on Actions runs draw on the Free plan's included compute.
2. **General → Pull Requests:** tick **Allow squash merging** only; untick
   **Allow merge commits** and **Allow rebase merging**. Optionally tick
   **Automatically delete head branches**, and **Always suggest updating pull
   request branches** (helps the up-to-date part of the merge rule). These are
   repository settings, not branch protection.

**Not now (only if you move to Pro later):** after a CI run exists so `ci`
shows in the picker,
**Rules → Rulesets → New ruleset → New branch ruleset** (or the classic
**Branches → Add branch protection rule**; either works):
   - Name `main`, Enforcement status **Active**
   - Target branches: **Include default branch**
   - Tick **Require a pull request before merging** (0 required approvals is
     fine for a solo repo)
   - Tick **Require status checks to pass**, tick **Require branches to be up
     to date before merging**, then **Add checks** → `ci` (source: GitHub
     Actions)
   - Tick **Block force pushes**; keep **Restrict deletions** ticked
   - Leave the bypass list empty (or add yourself if you want an emergency
     override; that also lets you merge a red PR, so prefer empty)
   Then rename the replaced acceptance criterion back to `main cannot be
   merged into while the ci check is red` and prove it.

## Steps for the build session

1. Re-resolve the action SHAs (see Action pins).
2. Write `ci.yml` exactly per Scope; update both Playwright configs,
   `.gitignore` and the README.
3. Run `pnpm typecheck && pnpm lint && pnpm test` locally. Don't try `pnpm e2e`
   in a Claude cloud session (the pinned browser can't be downloaded there);
   CI is the e2e check for this branch.
4. Commit (`ci: add CI workflow`, `docs(readme): add CI section`, etc.), push,
   open PR `F01: CI pipeline`.
5. Confirm the first run is green. If it isn't, see the first-run risk below.
6. Run each throwaway check in turn (unit, lint, e2e), reverting each before
   the next; then the double-push cancel check.
7. Confirm with the owner that steps 1–2 of the Human steps are done (the
   squash-only setting decides how the PR is merged). Note the first green
   run's duration in the PR description.
8. Record each criterion's run URL in the PR description. Update this spec's
   status and Follow-ups.

## Risks

| Risk | Mitigation |
| --- | --- |
| **First real run of e2e with the pinned browser.** F00's e2e passed only with the container's pre-installed Chromium via an uncommitted config; the lockfile's Playwright browser has never run these suites. | Read the failed step's log and the report artifact. Environment causes (browser download, missing OS deps, port in use, webServer timeout) are fixed in `ci.yml` or the Playwright configs within F01. A genuine test or app failure on the pinned browser is **not** fixed by skipping, retrying more, or marking CI advisory: if the fix is outside the files this spec names, stop, report to the owner, and record it in Follow-ups for a `fix/` branch. |
| pnpm release-age policy fails an install after a lockfile bump | Keep `--frozen-lockfile`; README explains it; wait a day or add a narrow `minimumReleaseAgeExclude` entry in that bump's branch. |
| Port clash between suites | Separate sequential steps; `reuseExistingServer: false` already makes a clash fail loudly. |
| Actions minutes on a private Free repo (~2,000 Linux min/month) | One job, pnpm store cache, Chromium only, cancel superseded PR runs, 20-minute timeout. Each e2e webServer runs its own build, so the app is built twice more after the explicit build steps; acceptable now (see Follow-ups). |
| Pinned SHAs go stale with no update bot | Follow-up: add an update bot later (out of scope here). |
| `pnpm/action-setup` support ends at pnpm 12 | Fine for `pnpm@12.18.0`. On a pnpm 13 bump, move to `pnpm/setup`. |
| **CI is advisory: a red PR can be merged** (private repo on Free) | Merge rule in Decision; added to `CLAUDE.md` via Follow-up; sessions never merge red or pending PRs. |
| Minutes run out mid-month on the private repo | One job, store cache, cancel superseded PR runs, 20-minute timeout; first run's duration recorded; if headroom is thin, the duplicate-builds follow-up is the first saving. |
| Renaming the `ci` job | Scope 1 keeps the name fixed so the merge rule (and any future ruleset) keeps pointing at it. |

## Follow-ups

- **`@playwright/test` 1.65.0 and `jsdom` 31.0.0 bump: stays a follow-up,
  not in F01.** F01's first CI run is already the first run of e2e on the
  pinned browser; changing the Playwright version in the same branch would
  make any failure ambiguous. Do it in a small `chore/` branch after F01 is
  merged, so CI checks the bump.
- **Done:** ~~F00 spec status line still says "Built, in review"; set it to
  "Merged" in the next branch that touches `docs/`.~~ Set to "Merged" in the
  F01 docs follow-up PR.
- **Duplicate builds in CI.** `pnpm e2e` and `pnpm e2e:spa` rebuild via their
  `webServer` commands. Later: let the webServer skip the build when CI has
  already built (e.g. a `CI`-gated command), saving a few minutes per run.
- **More jobs later (F02, F03).** F02 can add the Postgres `services:` block
  to the same `ci` job, which keeps one check to look at. A separate job
  would also have to be green under the merge rule.
- **Done:** ~~`CLAUDE.md` merge rule.~~ Added to the Definition of done and
  the Session loop in the F01 docs follow-up PR.
- **PR #2 landed as a merge commit** (`92b947a`), not a squash, because
  squash-only wasn't yet enforced in the repository settings; the canary
  commits and their reverts are therefore in `main`'s history. Squash is now
  the only merge method. The `CI` run on the merge commit passed
  (https://github.com/jacver/tabletop/actions/runs/44421362718), meeting
  `ci runs on push to main`.
- **Action update bot** (Dependabot or Renovate) for the pinned SHAs.
- **Cloud sessions can't read `docs.github.com`, `playwright.dev`, `pnpm.io`**,
  or download Playwright browsers. Consider allowing those hosts in the
  `tabletop` cloud environment. The build session also couldn't download a
  run's artifact zip (the Actions artifact storage host is refused), so the
  `playwright-report/index.html` check relied on the upload step's log.
- **First run's environment risk didn't materialise.** CI's first run passed
  both e2e suites on the lockfile's Chromium (Chrome for Testing 158) with no
  config changes. A green run's job takes about 1.5 minutes (billed as 2,
  since jobs round up to the minute), so roughly 1,000 runs a month fit in the
  Free plan's ~2,000 included minutes; the duplicate-builds follow-up is not
  urgent.
