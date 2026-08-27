# Item Description with History

## Why

Items only have a title and comments; there is no place for the actual content of a work item. A markdown description — rendered and edited exactly like comments, with prior versions retained — closes the biggest content gap.

## What Changes

- Items get an optional markdown description (same markdown subset and entity auto-linking as comments).
- Every description edit keeps the previous version in a description-versions store, viewable from the UI like comment history; a change record marks that the description changed.
- The item drawer renders the description with the same editable-markdown component as comments (edit, save/cancel, history toggle).
- REST API and `update-item` action accept a `description` field; a versions endpoint lists prior versions.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/item-management`: items carry an optional versioned markdown description.
- `boards/comments-and-history`: description edits appear in the change history and prior description versions are retained and viewable.

## Impact

- `plugins/boards-backend`: migration (`items.description` column + `item_description_versions` table), service/router/action updates, tests.
- `plugins/boards-common`: `BoardItem.description`, `ItemUpdate.description`, version type reuse.
- `plugins/boards`: shared `EditableMarkdown` component extracted from the comment block, description section in the drawer.
