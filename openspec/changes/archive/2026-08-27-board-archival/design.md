# Design

## Context

See proposal. All access flows through `requireBoard`; item archival + purge already established the pattern (columns, scheduled task, dialogs).

## Goals / Non-Goals

**Goals:** archive-on-delete, strict archived access gate, alert + delete-now, purge.
**Non-Goals:** board restore/unarchive (delete-now is the only exit; restore can come later), archived-board listing UI.

## Decisions

- Migration `boards.archived_at/archived_by`. `requireBoard` gains the gate: on an archived board, non-admin effective levels resolve to not-found; `required` above `read` throws `ConflictError('Board is archived…')` for everyone (admins and services included).
- `deleteBoard` archives (signal emitted); new `hardDeleteBoard` (admin, only valid on an archived board) performs the previous cascade delete; the purge task calls `purgeArchivedBoards(olderThan)` next to the item purge with the same 30-day retention.
- `listBoards` adds `whereNull('archived_at')`; favorites/entity tab inherit it.
- REST: `DELETE /boards/:id` archives; `POST /boards/:id/delete-now` hard-deletes. The `delete-board` action now archives (description updated).
- UI: `BoardWithContext.archivedAt/archivedBy`; the board page computes `archived` and forces `canWrite`/`isAdmin`-gated write UI off; a danger `Alert` names the deletion date (`archivedAt` + 30 days) and carries the admin "Delete now" button (confirm dialog). The menu entry wording becomes "Archive board…" with the dialog explaining the grace window.

## Risks / Trade-offs

- [No restore] → deliberate scope; the data survives 30 days and a restore endpoint can be added without schema changes.
- [Existing flows assumed hard delete] → tests updated to the archival semantics; hard delete still covered via delete-now.
