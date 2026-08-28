# boards/item-checklists Delta Specification

## Purpose

Lets a board item optionally carry a simple checklist — an ordered list of plain-text entries that can be ticked off — edited in the item details drawer and summarized as a done-count progress badge on the kanban card.

## ADDED Requirements

### Requirement: Optional item checklist

An item SHALL optionally carry a checklist: an ordered list of entries, each consisting of a required non-empty plain-text label and a done flag that is either done or not done. Entries SHALL keep the order in which they were added. An item with no checklist SHALL behave exactly as before this capability existed.

The checklist SHALL be exposed on the item through the REST API. Item create and update SHALL accept the checklist as a whole list that replaces the previous one, like tags and assignees. An entry with an empty or whitespace-only label SHALL be rejected with an input error, leaving the item unchanged. Users with write access SHALL be able to change the checklist; externally managed items SHALL be read-only as for other fields.

#### Scenario: Item without a checklist

- **WHEN** an item is created without checklist entries
- **THEN** the item has an empty checklist and no checklist-related UI beyond the drawer's add affordance is shown for it

#### Scenario: Checklist round-trips through the API

- **WHEN** a user with write access updates an item with the checklist ["write docs" (not done), "update tests" (done)]
- **THEN** reading the item returns those two entries in that order with their done states

#### Scenario: Empty entry label rejected

- **WHEN** a caller submits a checklist containing an entry whose label is empty or only whitespace
- **THEN** the request fails with an input error and the item's checklist is unchanged

#### Scenario: Externally managed items stay read-only

- **WHEN** a user attempts to change the checklist of an externally managed item through the UI or the item update endpoint
- **THEN** the mutation is rejected

### Requirement: Checklist changes in item history

A change to an item's checklist — adding, removing, renaming, or toggling entries — SHALL be recorded in the item's change history as a change of the checklist field, like other item field changes.

#### Scenario: Toggle appears in history

- **WHEN** a user marks the entry "update tests" as done
- **THEN** the item's history gains a checklist change entry attributed to that user

### Requirement: Checklist editing in the item details drawer

The item details drawer SHALL show the item's checklist entries in order, each with a checkbox reflecting its done state and its label. Users with write access SHALL be able to add an entry by typing its text, toggle an entry's checkbox, edit an entry's label, and remove an entry. Users without write access, and any user on an externally managed item, SHALL see the checklist but SHALL NOT be offered editing controls. Adding an entry with an empty label SHALL not create an entry.

#### Scenario: Add and toggle an entry

- **WHEN** a user with write access adds the entry "announce" and then ticks its checkbox
- **THEN** the drawer shows "announce" as done and the change is persisted

#### Scenario: Remove an entry

- **WHEN** a user with write access removes the entry "announce"
- **THEN** the entry disappears from the checklist and the remaining entries keep their order

#### Scenario: Read-only viewer

- **WHEN** a user with read-only access opens an item that has a checklist
- **THEN** the entries and their done states are visible but no add, edit, toggle, or remove controls are usable

### Requirement: Checklist progress on cards

The kanban card SHALL show a progress badge with the number of done entries over the total number of entries (for example `1/3`) when the item has at least one checklist entry. An item with no checklist entries SHALL show no badge. The badge SHALL be visually distinguished when all entries are done. The badge SHALL update when the checklist changes.

#### Scenario: Card shows progress

- **WHEN** an item has three checklist entries and one is done
- **THEN** its card shows a badge reading "1/3"

#### Scenario: No checklist, no badge

- **WHEN** an item has no checklist entries
- **THEN** its card shows no checklist badge

#### Scenario: All done

- **WHEN** all three entries of an item's checklist are done
- **THEN** the card's badge reads "3/3" and is styled as complete

### Requirement: Checklist survives board duplication

Duplicating a board SHALL copy each item's checklist entries, including their order and done states, onto the corresponding items of the new board.

#### Scenario: Duplicate copies checklists

- **WHEN** a board containing an item with the checklist ["write docs" (done), "update tests" (not done)] is duplicated
- **THEN** the corresponding item on the new board has the same two entries with the same order and done states
