# boards/comments-and-history Specification

## Purpose
Provides editable, versioned comments on items with catalog-entity auto-linking, an audit log of every other item change, and a unified timeline of both in the item detail view.

## Requirements

### Requirement: Comments on items
Users with write access SHALL be able to add comments to an item. A comment SHALL record its author and creation time and SHALL render a markdown subset (at minimum: emphasis, bold, inline code, code blocks, links, and lists; raw HTML SHALL NOT be rendered).

#### Scenario: Add a comment
- **WHEN** a user with write access submits a comment on an item
- **THEN** the comment is persisted with author and timestamp and appears in the item's timeline

#### Scenario: Read-only user cannot comment
- **WHEN** a user with only read access attempts to add a comment
- **THEN** the request is rejected with a permission error

### Requirement: Catalog entity auto-linking in comments
When rendering comments, entity refs of the form `[kind:][namespace/]name` appearing in the text (e.g. `system:default/example`, `user:christoph`) SHALL be automatically rendered as links to the corresponding catalog entity page. Refs using the `text:` prefix SHALL NOT be linked.

#### Scenario: Entity ref becomes a link
- **WHEN** a comment contains the text `please check system:default/example`
- **THEN** the rendered comment shows `system:default/example` as a link to that entity's catalog page

### Requirement: Editable comments with version history
A comment's author (or a board admin) SHALL be able to edit or delete the comment. On every edit, the previous comment text SHALL be retained as an older version in the comments store, and the UI SHALL indicate that the comment was edited with access to prior versions.

#### Scenario: Edit a comment keeps history
- **WHEN** a comment author edits their comment text
- **THEN** the new text is displayed, the comment is marked as edited, and the previous version remains stored and viewable

#### Scenario: Only author or admin can edit
- **WHEN** a user with write access who is not the comment's author attempts to edit the comment
- **THEN** the request is rejected with a permission error

### Requirement: Change history for items
Every change to an item other than comments — creation, field updates (title, labels, tags, assignees, creator), status/column moves, and deletion-relevant events — SHALL be recorded in a changes store with who made the change, when, and what changed (field, old value, new value).

#### Scenario: Field change is recorded
- **WHEN** a user changes an item's title from "A" to "B"
- **THEN** a change record is stored capturing the actor, timestamp, field `title`, old value "A", and new value "B"

#### Scenario: Move is recorded
- **WHEN** an item is moved from column "Todo" to "Doing"
- **THEN** a change record captures the status transition

### Requirement: Unified timeline in item detail view
The item detail view (opened as a drawer or modal from the board or table view) SHALL display comments and change records interleaved chronologically in a single unified timeline, alongside the item's fields.

#### Scenario: Unified timeline
- **WHEN** a user opens an item's detail view
- **THEN** they see the item's fields plus one chronological stream containing both comments and change entries, each with actor and timestamp
