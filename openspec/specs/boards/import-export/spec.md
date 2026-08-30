# boards/import-export Specification

## Purpose
Taking boards in and out of the system: a documented JSON board
document for export and import, and a CSV item export for
spreadsheets.

## Requirements

### Requirement: Board export
Users with read access SHALL be able to export a board. The JSON
export SHALL contain the board's name and description, its columns in
order (title, color, WIP limits), its priorities in order (name,
color), and its non-archived items (title, status as the column title,
description, tags, assignees, due date, priority name, and checklist
with checked state), and SHALL carry a format marker and version. The
CSV export SHALL contain one row per non-archived item with the
columns title, status, priority, due date, assignees, tags, and
description, correctly escaped. Comments, history, watches, and
archived items SHALL NOT be exported. The UI SHALL offer both from the
board menu as file downloads.

#### Scenario: JSON round-trip content
- **WHEN** a board with columns, priorities, a description, and items
  carrying every field is exported as JSON
- **THEN** the document contains all of them, statuses and priorities
  referenced by name, and a format version

#### Scenario: CSV escaping
- **WHEN** an item title contains a comma and a double quote
- **THEN** the CSV row remains parseable, with the field quoted and
  the quote doubled

#### Scenario: Read access suffices
- **WHEN** a user with read-only access exports a board
- **THEN** the export succeeds

### Requirement: Board import
Authenticated users SHALL be able to import a board JSON document (as
produced by the export), creating a new board owned by the importer:
the name (an optional override MAY be given), description, columns
with colors and WIP limits, priorities, and items with their fields,
statuses and priorities resolved by name against the imported
definitions, and items created by the importer. A document that is
malformed, carries an unsupported format version, or references an
unknown status SHALL be rejected with an input error and no board
SHALL be created. The UI SHALL offer the import from the board list
page, taking a file, and SHALL open the created board.

#### Scenario: Import an exported board
- **WHEN** a user imports the JSON export of a board
- **THEN** a new board owned by them appears with the same columns,
  priorities, description, and items (fields, tags, assignees, due
  dates, checklists), the items created by the importer

#### Scenario: Malformed document
- **WHEN** a user imports a JSON document without the format marker or
  with an item whose status matches no imported column
- **THEN** the import fails with an input error and no board is
  created
