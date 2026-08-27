## 1. Workflow skeleton

- [x] 1.1 Create `.github/workflows/ci.yml` triggered on `pull_request`
      against `main` and `push` to `main`, with `permissions: contents:
      read` and a `concurrency` group keyed on the ref with
      `cancel-in-progress: true`; verify by running
      `yarn prettier --check .github/workflows/ci.yml` and confirming the
      file parses as YAML (`python3 -c "import yaml,sys;
      yaml.safe_load(open('.github/workflows/ci.yml'))"`)
- [x] 1.2 Define the shared setup used by every job — `actions/checkout@v4`,
      `actions/setup-node@v4` pinned to Node 22 with `cache: 'yarn'`, then
      `yarn install --immutable`; verify the Node version matches the
      `engines` range in the root `package.json`

## 2. Check jobs

- [x] 2.1 Add the `verify` job running `yarn prettier:check`,
      `yarn lint:all` and `yarn tsc:full` as separate steps; verify each
      command passes locally from a clean checkout
- [x] 2.2 Add the `test` job running `yarn test:all`; verify it passes
      locally and reports the backend, common and frontend suites
- [x] 2.3 Add the `build` job running `yarn tsc` then `yarn build:all`;
      verify `yarn build:all` succeeds locally and produces
      `packages/app/dist`

## 3. End-to-end job

- [x] 3.1 Add the `e2e` job that builds the repo (`yarn tsc` +
      `yarn build:all`), caches `~/.cache/ms-playwright` keyed on the
      `@playwright/test` version resolved in `yarn.lock`, and runs
      `yarn playwright install --with-deps chrome`; verify the cache key
      changes when that version changes and not on unrelated lockfile edits
- [x] 3.2 Start the built backend in the background against
      `app-config.yaml` with `APP_CONFIG_app_baseUrl` and
      `APP_CONFIG_backend_cors_origin` set to `http://localhost:7007`, and
      poll that origin until it answers before continuing; verify the same
      command sequence serves the app locally at `http://localhost:7007`
- [x] 3.3 Run `yarn test:e2e` against the started backend and upload
      `e2e-test-report/` via `actions/upload-artifact@v4` with
      `if: failure()`; verify both Playwright projects (`app` and
      `@internal/plugin-boards`) are collected and pass

## 4. Repository script fix

- [x] 4.1 Change the root `lint` script's base ref from `origin/master` to
      `origin/main`; verify `yarn lint` runs against changed files instead
      of failing to resolve the ref

## 5. Verification

- [x] 5.1 Push the branch and confirm all four jobs run and pass on the
      pull request. Done: run 33111504858, all four green on the first
      attempt, ~3m20s wall clock. Job independence is by construction —
      no job declares `needs:` — rather than demonstrated with a
      deliberately broken commit, which was not pushed to a PR under
      review
- [x] 5.2 Record the follow-up (not automated here): mark `verify`,
      `test`, `build` and — per the design's open question — optionally
      `e2e` as required checks in the branch-protection settings for
      `main`. Recorded in the workflow commit message and the pull
      request description
