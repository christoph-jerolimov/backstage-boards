## 1. Backend

- [x] 1.1 Add `listBoardWatchers`/`listItemWatchers` to `BoardsService` (read access required) with unit tests, plus GET routes and router tests incl. access rejection
- [x] 1.2 Expose both on the frontend `BoardsApi` client

## 2. Frontend

- [x] 2.1 Add `@remixicon/react` dependency and a shared `WatchButton` component (toggle segment + watchers dropdown) and use it on the board header and in the item drawer; verify toggle still round-trips and the dropdown lists watchers
- [x] 2.2 Replace the header Share/Delete buttons with a three-dot (`RiMore2Fill`) more menu; verify share and delete dialogs still open and non-admins see no admin items

## 3. Verification

- [x] 3.1 Run tsc, lint, and tests for the workspace; UI smoke test of watch dropdown and more menu
