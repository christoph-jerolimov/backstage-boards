# boards/comments-and-history Specification (delta)

## MODIFIED Requirements

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

## ADDED Requirements

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
