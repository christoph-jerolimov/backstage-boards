# boards/item-checklists Specification (delta)

## MODIFIED Requirements

### Requirement: Checklist editing in the item details drawer

The item details drawer SHALL show the item's checklist entries in order, each with a checkbox reflecting its done state and its label. Users with write access SHALL be able to add an entry by typing its text into an entry field that is offered directly — without first pressing a button to reveal it — toggle an entry's checkbox, edit an entry's label, and remove an entry. Users without write access, and any user on an externally managed item, SHALL see the checklist but SHALL NOT be offered editing controls. Adding an entry with an empty label SHALL not create an entry.

#### Scenario: Add and toggle an entry

- **WHEN** a user with write access adds the entry "announce" and then ticks its checkbox
- **THEN** the drawer shows "announce" as done and the change is persisted

#### Scenario: Entry field offered directly

- **WHEN** a user with write access views the checklist in the drawer
- **THEN** the field for adding an entry is immediately available for typing, with no button press required first

#### Scenario: Remove an entry

- **WHEN** a user with write access removes the entry "announce"
- **THEN** the entry disappears from the checklist and the remaining entries keep their order

#### Scenario: Read-only viewer

- **WHEN** a user with read-only access opens an item that has a checklist
- **THEN** the entries and their done states are visible but no add, edit, toggle, or remove controls are usable
