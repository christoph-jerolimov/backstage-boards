## ADDED Requirements

### Requirement: Duplicate an item
Users with write access SHALL be able to duplicate an item from the
item menu. The duplicate SHALL be created on the same board in the same
column, positioned directly after the original, with the original's
title suffixed with " (copy)", its description (stored as the copy's
first description version), tags, assignees, due date, priority, and
checklist with every entry unchecked. Comments, history, watches, and
the external-manager flag SHALL NOT be copied; the duplicating user
SHALL be the copy's creator, and the copy's history SHALL start with a
creation record. Duplicating into a column at its hard WIP limit SHALL
be rejected like any other addition. Externally managed items MAY be
duplicated; the copy is an ordinary item.

#### Scenario: Duplicate an item
- **WHEN** a writer duplicates an item titled "Weekly report" that has
  a description, two tags, an assignee, a due date, a priority, and a
  checklist with one checked entry
- **THEN** a new item "Weekly report (copy)" appears directly after it
  in the same column carrying the same description, tags, assignee,
  due date, and priority, with the checklist entries present but
  unchecked, no comments, and a history containing only its creation

#### Scenario: Read-only users cannot duplicate
- **WHEN** a user with read access opens the item menu
- **THEN** no Duplicate entry is offered, and a direct API call is
  rejected

#### Scenario: WIP limit blocks the duplicate
- **WHEN** an item's column is at its hard WIP limit
- **THEN** duplicating the item fails with a conflict error
