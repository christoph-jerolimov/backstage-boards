## Context

See `proposal.md` — Why. The constraints that shape the workflow are all
already in the repository:

- **Yarn 4.13.0** with `nodeLinker: node-modules`, vendored at
  `.yarn/releases/yarn-4.13.0.cjs` via `yarnPath`. No Corepack download
  is needed; `yarn` resolves through the checked-in release.
- `.yarnrc.yml` sets `npmMinimalAgeGate: 3d`, which only affects
  resolution — an `--immutable` install from the committed lockfile does
  not re-resolve.
- **Node `22 || 24`** per the root `engines` field. `.nvmrc` is
  gitignored, so the version has to be pinned in the workflow.
- The root `package.json` already defines every check the workflow
  needs: `prettier:check`, `lint:all`, `tsc:full`, `test:all`,
  `build:all`, `test:e2e`. The workflow should call those scripts rather
  than re-spelling the underlying commands, so local and CI runs cannot
  drift.
- `playwright.config.ts` branches on `process.env.CI`: it drops its
  `webServer` entries, sets `forbidOnly`, retries twice, and points
  `baseURL` at `http://localhost:7007`. Under CI the workflow is
  therefore responsible for starting a server on 7007 itself.
- `generateProjects()` from `@backstage/e2e-test-utils` emits projects
  with `use: { channel: 'chrome' }` — real Google Chrome, not the
  bundled Chromium build.
- The dev config (`app-config.yaml`) uses `better-sqlite3` at `:memory:`
  and the guest auth provider, so the backend needs no service
  containers. The production config switches to Postgres and is not
  wanted here.

## Goals / Non-Goals

**Goals:**

- One workflow file, readable end to end, that a contributor can map
  onto the commands they run locally.
- A failure names what broke: format, lint, types, unit tests, build, or
  e2e — not one opaque "ci" job.
- Cold-cache correctness first; cache hits are an optimisation, never a
  correctness requirement.

**Non-Goals:**

- Publishing, releasing, or building/pushing container images. The repo
  has a `build-image` script; wiring it to a registry needs credentials
  and a decision about where images go.
- Testing across the whole `22 || 24` engines range. See Decisions.
- Configuring branch protection or required checks — those are
  repository settings, not files, and cannot be committed here.
- Coverage reporting to an external service (Codecov and friends), which
  would need a token.

## Decisions

**Split into four jobs, not one.**
`verify` (format + lint + types), `test`, `build`, and `e2e` run in
parallel off the same install. The alternative — a single sequential job
— is cheaper in runner minutes but tells a contributor only that "CI
failed", and a formatting slip would mask a genuine test failure behind
it. Four jobs cost more minutes but give four independent signals, and
on a repo this size each job is minutes, not tens of minutes.

**Call the root `package.json` scripts.**
Every step is `yarn <script>`. Re-spelling `backstage-cli repo test
--coverage` inside the workflow would let CI and local checks drift
apart silently. The one place this bites is `lint`: its
`--since origin/master` base ref does not exist in a repo whose default
branch is `main`. CI uses `lint:all` and so would not notice, but the
script is broken for contributors today, so this change fixes the ref as
part of the same commit rather than leaving a trap next to a workflow
that appears to bless it.

**`tsc:full`, not `tsc`.**
`tsc` is incremental and passes `--skipLibCheck`; on a clean CI checkout
the incremental cache is empty anyway, and `--skipLibCheck false` is the
check that catches a dependency shipping types that disagree with ours.
It is slower, which is the right trade for a job that runs unattended.

**Node 22 only, no version matrix.**
`engines` allows `22 || 24`. A matrix doubles every job for a signal
this repo does not currently need: nothing here is version-sensitive,
and the local toolchain is 22. Adding `24` later is a one-line change if
a Node-version bug ever surfaces.

**Let `actions/setup-node` own the Yarn cache.**
`setup-node` with `cache: 'yarn'` resolves Yarn 4's global cache folder
and keys it on the lockfile. A hand-rolled `actions/cache` over
`.yarn/cache` would be wrong here — with `nodeLinker: node-modules` and
no `enableGlobalCache: false`, the packages live in the user-level
global cache, not in the repo. Installs use `--immutable` so a stale or
missing cache can only cost time, never change what is installed.

**Cache the Playwright browser download separately, keyed on the
resolved `@playwright/test` version.**
Browser binaries live in `~/.cache/ms-playwright`, outside anything the
Yarn cache covers, and are the single largest download in the e2e job.
Keying on the version string from `yarn.lock` rather than on the whole
lockfile hash means an unrelated dependency bump does not evict a
perfectly good browser.

**Install the `chrome` channel, not bundled Chromium.**
`generateProjects()` pins `channel: 'chrome'`, so `playwright install
chromium` would install the wrong browser and the run would fail looking
for Chrome. `yarn playwright install --with-deps chrome` installs the
Google Chrome build Playwright expects. The `PLAYWRIGHT_CHROMIUM_PATH`
escape hatch already in `playwright.config.ts` stays for container
environments and is not used by CI.

**Serve e2e from the built backend on 7007, with env overrides rather
than `app-config.production.yaml`.**
The CI branch of `playwright.config.ts` already expects
`http://localhost:7007`, which is the app-backend shape:
`yarn build:all` bundles the frontend into `packages/app/dist` and the
backend serves it. Loading `app-config.production.yaml` would give the
right base URLs but would also switch the database to Postgres and
demand a service container for no gain. Instead the job runs the backend
against `app-config.yaml` — in-memory SQLite, guest auth, no services —
with `APP_CONFIG_app_baseUrl` and `APP_CONFIG_backend_cors_origin`
overridden to `http://localhost:7007` so the served app talks to the
origin it is served from.

Rejected alternative: run `yarn start` (the dev servers on 3000 and
7007) in CI and point `PLAYWRIGHT_URL` at 3000. It is closer to how the
suite is usually run by hand, but it tests the dev bundler rather than
the artifact a deployment would ship, and watch-mode servers are a poor
fit for an unattended job.

**Start the backend as an explicit background step with a health-check
wait.**
`playwright.config.ts` deliberately empties `webServer` under CI, so the
workflow cannot delegate startup to Playwright without editing that
config. An explicit step that backgrounds the process and polls
`/api/catalog/health` (or the root) until it answers keeps the
responsibility visible in the workflow and gives a clean failure — "the
backend never came up" — instead of a wall of navigation timeouts.

**Upload the Playwright HTML report only on failure.**
`e2e-test-report/` is already gitignored and is only interesting when
something broke. `if: failure()` keeps green runs from carrying a
multi-megabyte artifact.

**`concurrency` with `cancel-in-progress` on the PR ref.**
Pushing three times to a PR in five minutes should leave one running
job, not three.

**Pin actions to major version tags** (`actions/checkout@v4` and
friends). Full SHA pinning is stricter, but for GitHub-owned actions in
a repository with no secrets exposed to CI the readability of a tag wins
against a monthly Dependabot churn of opaque hashes.

## Risks / Trade-offs

- **The e2e job is the fragile one** (build + backend startup + a real
  browser). → It is a separate job, so a flaky e2e run never hides a
  unit-test or type failure. `playwright.config.ts` already retries
  twice under CI, and the failure artifact makes a red run diagnosable
  without a local repro.
- **`npmMinimalAgeGate: 3d` could reject an install** if a lockfile
  update lands within three days of a dependency's publication. →
  `--immutable` installs do not re-resolve, so this can only surface on
  a PR that intentionally changes `yarn.lock`, where it is a true
  positive worth seeing.
- **In-memory SQLite gives e2e a fresh, empty database every run**, so
  the e2e suite can never depend on seeded state. → That is already true
  of local runs; it is a constraint on the tests, and the current two
  specs respect it.
- **Four parallel jobs each pay the install cost.** → With a warm Yarn
  cache the install is the cheap part; the alternative (one job, shared
  install, sequential checks) trades that back for a worse signal.
- **`tsc:full` is slower than the incremental `tsc`** contributors run
  locally, so CI can be red on a lib-check error that a local `yarn tsc`
  passed. → That is the point of running it, and the error message names
  the offending declaration file.

## Migration Plan

The workflow only reads the repository, so there is nothing to roll
back beyond deleting the file. It goes live on the pull request that
adds it — the first run is on the PR itself, which is the intended
smoke test.

After merge, the checks have to be marked required in the repository's
branch-protection settings for `main` before they actually gate merges.
That is a settings change in the GitHub UI, outside these files, and is
listed as a follow-up task rather than automated.

## Open Questions

- Whether the `e2e` job should be a required check or advisory. This can
  be decided from the first weeks of run history without changing the
  workflow, since requiring a check is a repository setting.
