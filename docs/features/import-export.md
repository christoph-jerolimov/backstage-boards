# Import and export

Boards can leave the system and come back: the board menu exports a
board, and the boards page imports one.

## Exporting

**Export board…** in the board menu offers two downloads:

- **JSON** — the whole board as a portable document: name, markdown
  description, columns (with colors and WIP limits), priorities, and
  every non-archived item with its status, description, tags,
  assignees, due date, priority, and checklist. Comments, history,
  watches, and archived items are not exported.
- **CSV** — one row per item (`title, status, priority, dueDate,
assignees, tags, description`; lists joined with `;`), for
  spreadsheets.

Read access suffices — exporting changes nothing.

## Importing

**Import board** on the boards page takes a JSON document and creates
a **new board owned by you**: columns, priorities, description, and
items are recreated (you become the items' creator), and the new board
opens. Malformed documents — or items referencing a status the
document does not define — are rejected before anything is created.

## The document format

```json
{
  "format": "backstage-boards",
  "version": 1,
  "board": {
    "name": "Sprint planning",
    "description": "What this board is for…",
    "columns": [{ "title": "Todo", "color": "blue", "wipHardLimit": 5 }],
    "priorities": [{ "name": "critical", "color": "red" }]
  },
  "items": [
    {
      "title": "Design login flow",
      "status": "Todo",
      "description": "Markdown…",
      "tags": ["frontend"],
      "assignees": ["user:default/alice"],
      "dueDate": "2026-09-04",
      "priority": "critical",
      "checklist": [{ "text": "Wireframes", "checked": false }]
    }
  ]
}
```

Statuses and priorities are referenced by name, so the document is
instance-independent. To bring work in from GitHub issues, Jira, or
Trello, convert their exports into this shape with a small script —
only `format`, `version`, `board.name`, `board.columns`, and each
item's `title` and `status` are required.
