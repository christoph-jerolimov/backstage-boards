## Why

The repository has no `.github/` directory at all: every check (`tsc`,
`lint:all`, `prettier:check`, `test:all`, the Playwright e2e suite) only
ever runs when someone remembers to run it locally. The last twelve pull
requests were merged on the strength of a manual "I ran the tests"
claim. Now that the unit suite is substantial — 264 frontend tests, 34
common tests, 90+ backend tests, with the frontend at 92% statement
coverage — it is worth something only if it runs on every push.

## What Changes

- Add a GitHub Actions workflow that runs on pull requests targeting
  `main` and on pushes to `main`.
- Run the repo's existing checks as parallel jobs so a failure names the
  thing that broke:
  - **verify** — `prettier:check`, `lint:all`, `tsc:full`
  - **test** — `test:all` (unit tests with coverage, all workspaces)
  - **build** — `build:all`
  - **e2e** — `test:e2e` (Playwright) against the built backend
- Cache the Yarn 4 download cache and the Playwright browser download so
  reruns do not re-fetch the whole dependency tree.
- Upload the Playwright HTML report as an artifact when e2e fails.
- Pin the Node version to the `engines` range already declared in
  `package.json` (22).
- Fix the `lint` script's `--since origin/master`: the repository's
  default branch is `main`, so the incremental lint currently resolves
  against a ref that does not exist.

## Capabilities

### New Capabilities

None. This change adds repository tooling; it introduces no
user-observable behavior and therefore no spec.

### Modified Capabilities

None. No requirement in `openspec/specs/boards/**` changes.

This change sets `skip_specs: true` in its `.openspec.yaml`.

## Impact

- **New files**: `.github/workflows/ci.yml`
- **Modified files**: `package.json` (the `lint` script's base ref)
- **No production code touched** — no plugin, package, or config used at
  runtime changes.
- **External dependencies**: GitHub-maintained actions only
  (`actions/checkout`, `actions/setup-node`, `actions/cache`,
  `actions/upload-artifact`), each pinned to a major version tag.
- **Repository settings**: the new checks can be made required for
  merging into `main`; that is a branch-protection setting outside this
  repository's files and is called out as a follow-up, not automated
  here.
