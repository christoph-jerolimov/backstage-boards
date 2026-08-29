# boards/comments-and-history Specification (delta)

## MODIFIED Requirements

### Requirement: Unified timeline in item detail view
The item detail view (opened as a drawer or modal from the board or table view) SHALL display an activity block containing the item's comments and change records, alongside the item's fields.

The activity block SHALL offer three tabs: "Combined" showing comments and change records interleaved chronologically in a single unified timeline, "Comments" showing only comments, and "Changes" showing only change records. "Combined" SHALL be the default tab. Each entry SHALL name its actor and timestamp.

Entries SHALL be ordered newest first by default. The activity block SHALL offer a control to switch the ordering between newest first and oldest first; the chosen ordering SHALL apply to all three tabs.

The comment composer (for users allowed to comment) SHALL be placed above the activity tabs and timeline, so adding a comment never requires scrolling past the history.

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

#### Scenario: Composer above the timeline
- **WHEN** a user who may comment opens an item with a long history
- **THEN** the comment composer is visible above the activity tabs and timeline, and a submitted comment appears in the timeline without the composer moving below the history
