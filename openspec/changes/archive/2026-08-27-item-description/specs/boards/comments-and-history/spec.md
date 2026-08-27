## ADDED Requirements

### Requirement: Description version history
Every edit to an item's description SHALL retain the previous version, viewable from the item detail view, and SHALL add an entry to the item's change history noting that the description changed.

#### Scenario: Description edit keeps history
- **WHEN** a user edits an existing description
- **THEN** the new text is displayed, prior versions remain accessible with editor and timestamp, and the item's timeline shows a "description changed" entry

#### Scenario: Versions ordered chronologically
- **WHEN** a user opens the description history
- **THEN** versions are listed with editor and timestamp in chronological order
