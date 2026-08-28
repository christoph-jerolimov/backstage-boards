# Item Management

## ADDED Requirements

### Requirement: Item checklist

Items SHALL support an optional checklist: an ordered list of entries,
each consisting of a short text and a done flag. The checklist SHALL be
settable and clearable by any user with write access, exposed through the
REST API and the item actions, and changes to it SHALL be recorded in the
item change history. An item with no checklist SHALL be indistinguishable
from an item with an empty one. Entries whose text is empty SHALL be
dropped, and malformed or oversized checklists SHALL be rejected.

#### Scenario: Set, tick, and clear a checklist

- **WHEN** a user with write access sets an item's checklist to three
  entries
- **THEN** the item stores them in the given order, all unchecked, and a
  change entry records the update
- **WHEN** the user marks the second entry done
- **THEN** the item's checklist keeps its order with that entry checked
  and a change entry records the update
- **WHEN** the user sets the checklist to an empty list
- **THEN** the item has no checklist entries and a change entry records
  the removal

#### Scenario: Blank entries dropped

- **WHEN** a caller submits a checklist containing an entry whose text is
  blank or only whitespace
- **THEN** that entry is not stored and the remaining entries keep their
  relative order

#### Scenario: Invalid checklist rejected

- **WHEN** a caller submits a checklist whose entry text is not a string,
  exceeds the maximum text length, or whose list exceeds the maximum
  number of entries
- **THEN** the request fails with an input error and the item is
  unchanged

#### Scenario: Checklist survives board duplication

- **WHEN** a board holding items with checklists is duplicated
- **THEN** the copied items carry the same checklist entries, order, and
  done flags

### Requirement: Checklist progress display

The kanban card, the table view, and the my-items view SHALL show an
item's checklist progress as the number of done entries out of the total
(for example `1/3`). Items without a checklist SHALL show no progress
indicator, and a checklist whose entries are all done SHALL be visually
marked as complete.

#### Scenario: Card shows partial progress

- **WHEN** an item has three checklist entries of which one is done
- **THEN** its card, its table row, and its my-items row show `1/3`

#### Scenario: No checklist shows nothing

- **WHEN** an item has no checklist entries
- **THEN** its card and rows show no checklist progress indicator

#### Scenario: Completed checklist marked

- **WHEN** every entry of an item's checklist is done
- **THEN** the progress indicator shows the full count and is styled as
  complete

### Requirement: Checklist editing in details view

The item details drawer SHALL let users with write access add an entry
to the end of the checklist, edit an entry's text, toggle an entry
between done and not done, and remove an entry. Users with only read
access, and any user viewing an externally managed item, SHALL see the
checklist without editing controls.

#### Scenario: Add and tick entries

- **WHEN** a user with write access adds two checklist entries in the
  drawer and ticks one of them
- **THEN** both entries are persisted in the order added, the ticked one
  is done, and the item's card shows `1/2`

#### Scenario: Remove an entry

- **WHEN** a user with write access removes a checklist entry
- **THEN** the entry is gone from the item and the remaining entries keep
  their order

#### Scenario: Read-only checklist

- **WHEN** a user with only read access, or any user on an externally
  managed item, opens the item details
- **THEN** the checklist entries and their done state are shown without
  any control to add, edit, toggle, or remove them
