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
Every change to an item other than comments — creation, field updates (title, tags, assignees, creator), status/column moves, and deletion-relevant events — SHALL be recorded in a changes store with who made the change, when, and what changed (field, old value, new value).

#### Scenario: Field change is recorded
- **WHEN** a user changes an item's title from "A" to "B"
- **THEN** a change record is stored capturing the actor, timestamp, field `title`, old value "A", and new value "B"

#### Scenario: Move is recorded
- **WHEN** an item is moved from column "Todo" to "Doing"
- **THEN** a change record captures the status transition

### Requirement: Unified timeline in item detail view
The item detail view (opened as a drawer or modal from the board or table view) SHALL display an activity block containing the item's comments and change records, alongside the item's fields.

The activity block SHALL offer three tabs: "Combined" showing comments and change records interleaved chronologically in a single unified timeline, "Comments" showing only comments, and "Changes" showing only change records. "Combined" SHALL be the default tab. Each entry SHALL name its actor and timestamp.

Entries SHALL be ordered newest first by default. The activity block SHALL offer a control to switch the ordering between newest first and oldest first; the chosen ordering SHALL apply to all three tabs.

The comment composer (for users allowed to comment) SHALL be part of the activity block's "Combined" and "Comments" tabs and SHALL NOT be shown on the "Changes" tab. Within those tabs it SHALL sit adjacent to where a new comment will appear: before the timeline when the ordering is newest first, after it when the ordering is oldest first.

#### Scenario: Unified timeline
- **WHEN** a user opens an item's detail view
- **THEN** they see the item's fields plus one stream containing both comments and change entries, each with actor and timestamp, with the newest entry at the top

#### Scenario: Comments tab shows only comments
- **WHEN** the user switches the activity block to the "Comments" tab
- **THEN** only comments are listed, in the currently selected ordering

#### Scenario: Changes tab shows only change records
- **WHEN** the user switches the activity block to the "Changes" tab
- **THEN** only change records are listed, in the currently selected ordering

#### Scenario: Switch ordering
- **WHEN** the user switches the ordering control from newest first to oldest first
- **THEN** the visible list reverses so the oldest entry is at the top, and the ordering persists when switching between tabs

#### Scenario: Composer next to where the comment lands
- **WHEN** a user who may comment opens an item with a long history (Combined tab, newest first)
- **THEN** the comment composer is visible before the timeline, and a submitted comment appears directly beside it at the top of the timeline
- **WHEN** the user switches the ordering to oldest first
- **THEN** the composer moves after the timeline, beside where the new comment will land

#### Scenario: No composer on the Changes tab
- **WHEN** the user switches the activity block to the "Changes" tab
- **THEN** no comment composer is shown

### Requirement: Description version history
Every edit to an item's description SHALL retain the previous version, viewable from the item detail view, and SHALL add an entry to the item's change history noting that the description changed.

#### Scenario: Description edit keeps history
- **WHEN** a user edits an existing description
- **THEN** the new text is displayed, prior versions remain accessible with editor and timestamp, and the item's timeline shows a "description changed" entry

#### Scenario: Versions ordered chronologically
- **WHEN** a user opens the description history
- **THEN** versions are listed with editor and timestamp in chronological order

### Requirement: Board-wide recent changes
Users with read access SHALL be able to open a recent-changes view for a board from the board's more menu, listing the most recent change records across all items (newest first) with actor, change summary, affected item, and timestamp. Selecting an entry SHALL open the affected item's detail view.

#### Scenario: View recent board changes
- **WHEN** a user with read access opens "Recent changes" from the board's more menu
- **THEN** they see the latest changes across all items of the board, newest first, each naming the actor and the item

#### Scenario: Jump to the item
- **WHEN** a user selects an entry in the recent-changes view
- **THEN** the corresponding item's detail view opens

#### Scenario: Requires read access
- **WHEN** a principal without read access requests a board's change feed
- **THEN** the request is rejected

### Requirement: Mention rendering
@-mentions in comments and descriptions SHALL render as links to the mentioned catalog entity, alongside the existing bare entity-ref auto-linking. `text:` refs remain unlinked.

#### Scenario: Mention renders as entity link
- **WHEN** a comment containing `@user:default/jane` or `@jane` is rendered
- **THEN** the mention appears as a link to that user's catalog page

### Requirement: Comment and description drafts survive reload
While a user is composing a new comment or editing the item description in the item detail view, the in-progress text SHALL be persisted per user through the Backstage storage (user settings) API, keyed to the item, so that closing the detail view or reloading the browser restores it. The stored draft SHALL be cleared once the comment is added, the description saved, or the edit explicitly cancelled.

#### Scenario: Comment draft survives a reload
- **WHEN** a user types a comment into the composer without submitting it and reloads the browser tab
- **THEN** reopening the item's detail view shows the composer prefilled with the typed text

#### Scenario: Adding the comment clears the draft
- **WHEN** the user submits the comment
- **THEN** the stored draft is cleared and reopening the detail view shows an empty composer

#### Scenario: Description draft survives closing the drawer
- **WHEN** a user edits the description, and closes the detail view without saving
- **THEN** reopening the item and editing the description again offers the unsaved text

#### Scenario: Saving the description clears the draft
- **WHEN** the user saves the edited description
- **THEN** the stored draft is cleared and a later edit starts from the saved text
