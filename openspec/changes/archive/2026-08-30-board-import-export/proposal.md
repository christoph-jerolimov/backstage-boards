## Why

Boards are silos: there is no way to take a board along, back it up,
hand it to another instance, or bring existing work in from another
tool. A documented JSON format plus CSV export closes the loop.

## What Changes

- **Export**: the board menu gains an Export dialog offering the whole
  board as a **JSON** document (board name, description, columns with
  colors and WIP limits, priorities, and the non-archived items with
  status, description, tags, assignees, due date, priority, and
  checklist) or the items as a **CSV** file, both downloaded from a new
  read-gated endpoint.
- **Import**: the board list page gains an Import action taking such a
  JSON document and creating a **new board** owned by the importer,
  with the columns, priorities, description, and items recreated
  (items created by the importer, statuses and priorities resolved by
  name). Invalid documents are rejected with a clear error.
- The JSON format is documented, so exports from other tools (GitHub
  issues, Jira, Trello) can be converted into it with a small script;
  direct third-party importers stay out of scope.

## Capabilities

### New Capabilities

- `boards/import-export`: board export (JSON/CSV) and JSON import.

### Modified Capabilities

None.

## Impact

- `plugins/boards-backend` — `exportBoard`/`importBoard` service
  methods, two routes.
- `plugins/boards` — API methods, Export dialog in the board menu,
  Import dialog on the board list.
- Docs: new `docs/features/import-export.md`, README.
