## ADDED Requirements

### Requirement: Shareable view state in the URL
The board page SHALL encode its view state in URL query parameters:
the free-text search, selected tags, assignees, and priorities, the
overdue toggle, the grouping mode, the active view (kanban, table, or
insights), and the table sort. Opening a board URL carrying these
parameters SHALL restore exactly that view, so the URL is shareable.
Changing any of these controls SHALL update the URL in place without
growing the browser history per keystroke. Default values SHALL be
omitted from the URL, unknown or invalid parameter values SHALL be
ignored, and the filter bar's clear action SHALL also remove the
filter parameters from the URL.

#### Scenario: A shared link restores the view
- **WHEN** a user opens a board URL with `?view=table&group=assignee&tag=bug&q=login`
- **THEN** the table view opens grouped by assignee with the tag
  filter `bug` and the search text `login` applied

#### Scenario: Changing controls updates the URL
- **WHEN** a user toggles a tag filter and switches to the table view
- **THEN** the URL reflects both (`tag=…`, `view=table`) and can be
  copied to reproduce the state

#### Scenario: Defaults keep the URL clean
- **WHEN** no filters are active, the kanban view is shown ungrouped,
  and no sort is set
- **THEN** the URL carries none of the view-state parameters

#### Scenario: Clearing filters cleans the URL
- **WHEN** filters are active and the user clears them
- **THEN** the filter parameters disappear from the URL while the view
  and grouping parameters stay

#### Scenario: Invalid values are ignored
- **WHEN** a user opens a board URL with `?view=bogus&group=nope`
- **THEN** the board renders with its defaults
