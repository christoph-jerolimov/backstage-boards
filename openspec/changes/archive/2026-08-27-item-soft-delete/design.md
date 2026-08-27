# Design

## Context

See proposal. `deleteItem` currently hard-deletes with FK cascades; the change feed and timelines lose deleted items' history entirely. The backend has the scheduler core service available.

## Goals / Non-Goals

**Goals:** archive-on-delete, archived list + restore, scheduled purge, unchanged external API names.
**Non-Goals:** configurable retention (fixed 30 days for now), board-level archive, hard-delete UI.

## Decisions

- Migration `items.archived_at` / `items.archived_by` (nullable strings). `listItems` gains `whereNull('archived_at')`; new `listArchivedItems` (write access — restoring is the purpose) and `restoreItem` (write; external items restorable only by services, same rule as other mutations).
- `deleteItem` becomes archival: sets the columns, records change type `archived`, keeps the existing watcher notification (reworded). `restoreItem` clears them and records `restored`. Change types extended accordingly.
- Purge: `purgeArchivedItems(olderThan)` deletes matching items (cascades clean the rest) and their watches, returns the count. The plugin schedules it via `coreServices.scheduler` every 6 hours with `olderThan = now - 30 days`.
- Routes: `GET /boards/:id/items/archived`, `POST /boards/:id/items/:itemId/restore`; DELETE keeps its path. Frontend: "Archived items…" in the more menu (shown with write access) opening a dialog with restore buttons.
- The board change feed joins `items` regardless of archival so archived items' history stays visible until purge.

## Risks / Trade-offs

- [Existing tests assume hard delete] → updated to assert archival semantics instead.
- [Archived items keep FK to columns; column deletion re-targets them silently] → acceptable: restored items land in the re-target column.
