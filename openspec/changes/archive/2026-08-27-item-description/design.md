# Design

## Context

See proposal. Comments already implement the target UX (markdown render, edit with retained versions, history toggle) in `CommentBlock`; descriptions reuse that UI. Migrations run from an in-code migration list.

## Goals / Non-Goals

**Goals:** versioned description end-to-end (DB → service → REST/action → drawer UI) reusing the comment editing UI.
**Non-Goals:** description on the card/table views (drawer only for now); diffing between versions.

## Decisions

- Schema: nullable `description` text column on `items` (current value, cheap to read with the item) plus `item_description_versions` (`id, item_id FK cascade, text, edited_by, edited_at`) appended on every change, as a second migration in the migration list.
- `BoardsService.updateItem` handles `description`: skip when unchanged; empty string clears (stored as null, recorded as a version with empty text is skipped — clearing appends a version with `''`). A change record `type: 'updated', field: 'description'` is written WITHOUT old/new values (descriptions can be long); the timeline renders value-less changes as "changed <field>".
- New endpoint `GET .../items/:itemId/description/versions` mirroring comment versions; `update-item` action gains `description`.
- UI: extract the display/edit/history body of `CommentBlock` into a shared `EditableMarkdown` component; `CommentBlock` and the new drawer description section both use it.

## Risks / Trade-offs

- [Unbounded version growth] → same trade-off as comments; purge policies can come later for both.
