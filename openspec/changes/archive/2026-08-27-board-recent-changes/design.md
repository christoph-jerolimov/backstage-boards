# Design

## Context

See proposal. The `changes` table is already keyed by `board_id`; deleted items cascade their changes away, so the feed only covers existing items (consistent with the per-item timeline). The change-summary wording lives inline in the drawer's timeline today.

## Goals / Non-Goals

**Goals:** read-access change feed endpoint, modal from the more menu, shared summary wording.
**Non-Goals:** including comments in the feed (comments are content, not audit records), pagination beyond a simple limit (default 50).

## Decisions

- `GET /boards/:boardId/changes?limit=` → `{ changes: BoardChangeEntry[] }` where `BoardChangeEntry = { change: ChangeRecord; itemTitle: string }`, ordered by `at` desc, limit clamped to 200.
- Extract `changeSummary(change)` into the frontend `common` module; drawer timeline and the new dialog both use it.
- More menu becomes visible to all users with access: "Recent changes…" always; Share…/Delete… only for admins.
- Dialog rows render actor (`RefDisplay`), summary, item title as a button that closes the dialog and sets `?item=`.

## Risks / Trade-offs

- [Changes of deleted items are absent] → inherent to the cascade design; acceptable until soft-delete lands.
