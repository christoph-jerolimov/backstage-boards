## ADDED Requirements

### Requirement: Board description
A board MAY carry a markdown description, rendered under the board
header for everyone who can read the board. Users with write access
SHALL be able to edit it in place with the same markdown editing block
items use: saving stores the new text, saving empty text clears the
description, and every saved edit SHALL retain a version with its author
and timestamp. Once more than one version exists, the edit block SHALL
offer the version history. The board payload SHALL carry the current
description and its version count, and a versions endpoint SHALL return
the history to readers. Readers without write access SHALL see the
rendered description but no edit affordance, and a board without a
description SHALL show nothing to readers.

#### Scenario: Write a description
- **WHEN** a user with write access adds the description "Sprint board
  for team X" under the board header and saves
- **THEN** the rendered markdown appears under the header for every
  visitor, and the stored version count becomes 1

#### Scenario: History after edits
- **WHEN** the description is edited a second time
- **THEN** the versions endpoint lists both versions with author and
  timestamp, and the edit block offers the history

#### Scenario: Clearing the description
- **WHEN** a user with write access saves an empty description
- **THEN** the board shows no description text to readers while the
  edit affordance remains for writers

#### Scenario: Read-only view
- **WHEN** a user with only read access views a board with a
  description
- **THEN** they see the rendered description but cannot edit it

## MODIFIED Requirements

### Requirement: Duplicate copies items and entity references on request

Board duplication SHALL optionally copy the source board's non-archived
items — titles, positions, descriptions, due dates, assignees, and
tags — into the corresponding copied columns. Copying items SHALL
require copying columns; a request to copy items without columns SHALL
be rejected. Comments, item history, watches, and external-manager
flags SHALL NOT be copied. Duplication SHALL also optionally copy the
board's entity reference list. Copied columns SHALL keep their colors
and WIP limits. The board's current description text
SHALL be copied to the duplicate (as its first version, attributed to
the duplicator); the description's version history SHALL NOT be copied.

#### Scenario: Items copied with columns

- **WHEN** a board is duplicated with copy columns and copy items
- **THEN** each new column contains copies of the source column's
  active items with their fields and associations, and the copies have
  no comments or history beyond their creation

#### Scenario: Items require columns

- **WHEN** a duplicate request asks for items without columns
- **THEN** the request fails with an input error

#### Scenario: Entity references copied

- **WHEN** a board referencing two entities is duplicated with copy
  entity references
- **THEN** the copy references the same two entities

#### Scenario: Description copied

- **WHEN** a board with a description is duplicated
- **THEN** the copy carries the same description text with a version
  count of 1
