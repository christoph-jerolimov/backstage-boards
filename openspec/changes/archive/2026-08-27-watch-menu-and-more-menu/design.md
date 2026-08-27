# Design

## Context

See proposal. Existing pieces: `watches` table (`user_ref, target_type, target_id`), `Switch`-based watch toggles in `BoardPage`/`ItemDrawer`, flat Share/Delete buttons on the board header, BUI `MenuTrigger`/`Menu`/`MenuItem` already used in `KanbanView`.

## Goals / Non-Goals

**Goals:** shared `WatchButton` (toggle + watchers dropdown), watcher list endpoints, three-dot more menu using Remix Icons.
**Non-Goals:** watcher counts in list views; notification changes.

## Decisions

- Backend: `GET /boards/:boardId/watchers` and `GET /boards/:boardId/items/:itemId/watchers` return `{ watchers: string[] }` (user entity refs), guarded by read access via the existing resolver.
- `WatchButton` component in `plugins/boards/src/components/WatchButton.tsx`: a `Flex` of a toggle `Button` ("Watch"/"Watching") and a `MenuTrigger` + chevron `ButtonIcon` whose `Menu` loads watchers on open (`useAsyncData`) and renders read-only `MenuItem`s with `RefDisplay`.
- More menu: `@remixicon/react` `RiMore2Fill` inside a BUI `ButtonIcon` + `MenuTrigger`; menu items Share… and Delete… open the existing dialogs. Admin-only items hidden for non-admins; the menu is hidden entirely if it would be empty.

## Risks / Trade-offs

- [Watcher lists reveal user activity] → restricted to principals that can already read the board; consistent with comment authorship visibility.
