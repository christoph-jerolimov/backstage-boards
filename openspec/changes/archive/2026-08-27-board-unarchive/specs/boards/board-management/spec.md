# Board Management

## MODIFIED Requirements

### Requirement: Board archival, grace window, and purge
Deleting a board SHALL archive it rather than remove it. Archived boards SHALL not appear in any listing (board list, favorites, entity assignments) and SHALL only be reachable via their direct link, read-only. The board page SHALL show an alert stating when the board will be permanently deleted, offering admins an "Unarchive" action that restores the board and a "Delete now" action that removes it immediately. A scheduled backend task SHALL permanently delete boards archived more than 30 days ago, including all their data.

#### Scenario: Delete archives the board
- **WHEN** a board admin confirms deletion
- **THEN** the board is archived, disappears from all listings, and remains reachable via its link

#### Scenario: Alert with deletion date and delete-now
- **WHEN** an admin opens an archived board via its link
- **THEN** an alert explains that the board is read-only and names the permanent-deletion date, with a "Delete now" action that hard-deletes the board after confirmation

#### Scenario: Unarchive restores the board
- **WHEN** an admin presses "Unarchive" on an archived board
- **THEN** the board returns to listings and becomes writable again; unarchiving a board that is not archived is rejected

#### Scenario: Purge after 30 days
- **WHEN** the purge task runs and a board has been archived for more than 30 days
- **THEN** the board and all its data are permanently removed, while more recently archived boards remain
