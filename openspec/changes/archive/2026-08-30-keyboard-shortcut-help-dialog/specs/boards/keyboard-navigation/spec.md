# boards/keyboard-navigation Delta

## ADDED Requirements

### Requirement: Shortcut help dialog
Pressing `?` on the board page — in the kanban view or the table view,
including the embedded catalog-entity tab — SHALL open a compact dialog
listing the available keyboard shortcuts with their keys and a short
description, grouped into navigation and focused-item actions. The
dialog SHALL close via `Escape` and via its close control. `?` SHALL
NOT open the dialog while the user is typing in a text input or inline
editor, or while a menu, another dialog, or the item drawer is open.
Entries that do not apply SHALL be omitted: the priority picker and
priority digit entries on boards without priorities, and the mutating
actions (move, select, pickers, archive) for users without write
access.

#### Scenario: Open and close the help
- **WHEN** a user presses `?` while viewing a board and then presses
  `Escape`
- **THEN** a dialog listing the keyboard shortcuts opens, and closes
  again

#### Scenario: Works with an item focused
- **WHEN** a board card or table row has the keyboard focus and the
  user presses `?`
- **THEN** the shortcut dialog opens (the key is not treated as an item
  shortcut)

#### Scenario: Typing is never hijacked
- **WHEN** a user types `?` into the item search field or an inline
  title editor
- **THEN** no dialog opens — the character is simply typed

#### Scenario: Irrelevant entries are omitted
- **WHEN** a user opens the shortcut help on a board without
  priorities, or as a read-only visitor
- **THEN** the priority picker and digit entries are missing in the
  first case, and the mutating actions are missing in the second,
  while the navigation entries always remain
