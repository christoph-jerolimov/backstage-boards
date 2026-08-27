## ADDED Requirements

### Requirement: Item archival, restore, and purge
Deleting an item SHALL archive it rather than remove it: the item disappears from the board, table, and filter views but retains its fields, comments, and history. Users with write access SHALL be able to view a board's archived items (with who archived them and when) and restore them; archival and restore SHALL be recorded in the item's change history. Items archived more than 30 days ago SHALL be permanently removed by a scheduled backend task, including their comments, versions, changes, and watches.

#### Scenario: Delete archives
- **WHEN** a user with write access deletes an item
- **THEN** the item disappears from all board views but appears in the archived-items view with actor and timestamp

#### Scenario: Restore an archived item
- **WHEN** a user with write access restores an archived item
- **THEN** the item reappears in its column with all fields, comments, and history intact, and the timeline shows the archive and restore entries

#### Scenario: Read-only users cannot restore
- **WHEN** a user with only read access attempts to restore an archived item
- **THEN** the request is rejected

#### Scenario: Purge after 30 days
- **WHEN** the purge task runs and an item has been archived for more than 30 days
- **THEN** the item and all its data are permanently removed, while more recently archived items remain restorable
