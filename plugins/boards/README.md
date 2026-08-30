# @internal/plugin-boards

Frontend for the boards plugin, built exclusively on the Backstage new
frontend system. Provides:

- `/boards` — paginated "Favorites"/"All" board list with per-status item
  counts, search/entity/creator filters, and row context menus
- `/boards/my-items` — everything assigned to you across boards, with its own
  filter bar and grouping
- `/boards/:boardId` — kanban and table views with drag & drop (a drop
  indicator shows the exact insertion point), full keyboard navigation and
  item shortcuts in both views, inline editing, grouping by assignee or
  priority, a filter bar, sortable and configurable table columns,
  multi-select with bulk actions shared between the views, and the
  assignee × status and status × priority matrix dialogs
- an item detail drawer with combined status/priority/due-date badge editors,
  description, checklist, and a unified comments + change history timeline
  with per-user drafts
- a share dialog for user/group permissions and public visibility modes
- a "Boards" tab on catalog entities listing the boards assigned to them
- "Assigned items" and "Boards" cards for the Backstage home page

UI is composed from Backstage UI components with react-aria used where no
Backstage UI component exists (drag & drop, the drawer overlay).

## Important notes

1. **Catalog users** — the sign-in resolver must map signed-in users to
   catalog user entities, or assignments and the "my" features (My items,
   the Assigned items card, reminders) have nothing to attach to.
2. **Security** — board access granted to a group follows the catalog's
   group membership: anyone who can create or edit group entities in the
   catalog can add themselves to a group and thereby gain access to every
   board shared with that group. Restrict who can register and modify
   catalog org data accordingly.
3. **Database** — all boards, items, comments, and history live in the
   backend plugin's own database. Point `backend.database` at a persistent
   database with backups: unlike catalog data, board content cannot be
   re-ingested from anywhere if it is lost.

## Features

The behaviour specs behind every feature live in `openspec/specs/boards/` in
the repository. The backend counterpart is
`@internal/plugin-boards-backend`.

### Boards

- **Board list** — paginated "Favorites" and "All" tabs, with per-status item
  counts on every row.
- **Board filters** — filter the list by free-text search, referenced entity,
  and creator, with the filter options scoped to your own boards.
- **Favorites** — per-user, toggled from the row menu.
- **Configurable columns** — add, rename, reorder, and remove columns per
  board, and insert a column at any position.
- **Column colors** — shown as a dot in the kanban header and as the status
  badge color everywhere else.
- **Duplicate a board** — optionally copying items and entity references.
- **Archived boards** — read-only, with an alert stating the purge date and
  offering "Unarchive" and "Delete now" to admins.
- **Row and context menus** — board rows carry an actions menu that also opens
  at the pointer on right-click.

### Items

- **Kanban and table views** — two switchable views over the same items.
- **Drag & drop** — an insertion line shows exactly where the card will
  land: between two cards, after the last card, or in an empty column,
  also inside grouped lanes.
- **Keyboard navigation** — arrow keys walk the cards (and table rows,
  across groups) with a visible focus; shortcuts on the focused item move
  it between columns (`Ctrl+←`/`Ctrl+→`), select it (`Space`), open the
  item menu (`Enter`) and the status/assignee/due-date/priority pickers
  (`s`, `a`, `d`, `p`), set a priority by digit, and archive (`Delete`).
- **Optimistic updates** — moves and edits apply instantly and roll back on
  failure.
- **Filter bar** — free-text search plus tag (all must match) and assignee
  (any must match) filters, applied to both views.
- **Grouping** — group the board by assignee or by priority.
- **Table sorting.**
- **Configurable table columns** — choose which columns the table shows.
- **Utility columns** — the table's leading selection and trailing actions
  columns stay put regardless of configuration.
- **Selection and bulk actions** — multi-select items with the table's
  checkboxes or `Space` in either view; the selection is shared between
  the kanban and table views, with bulk status, priority, assignee,
  due-date, and archive actions.
- **Archived items** — a table of archived items with who archived them and
  when, and a restore action.
- **Externally managed items** — items owned by an integration render
  read-only and marked as such.
- **Item detail drawer** — structured into fields, description, checklist,
  and activity sections, and openable in place from any view.
- **Combined badges** — status, priority, and due date in the drawer are
  badges that double as their own keyboard-operable editors.
- **Assignee avatars** — stacked on cards, with display name and full entity
  ref in the tooltip.
- **Assignee × status matrix** — a per-board dialog counting items per
  assignee and column, with clickable headers and sum rows.
- **"Add another"** — the create dialog can stay open to add several items in
  a row.
- **Card and row context menus** — the item menu also opens at the pointer on
  right-click.

### Due dates

- **Urgency colors** — due-date badges color by how close (or past) the date
  is.
- **Quick due-date menu** — Today, Tomorrow, and This week directly on the
  card.
- **Arbitrary dates** — a full date picker in the details drawer, plus a
  remove entry.
- **Group by due date** — overdue first, then by date, undated last.

### Priorities

- **Board settings editor** — admins manage up to ten ordered priorities
  with name and color.
- **Everywhere they matter** — priorities appear on cards, in the table, as a
  filter, as a grouping, and in the home page widget.
- **Status × priority matrix** — a dialog counting items per column and
  priority, with toggleable headers and sums.
- **Graceful absence** — a board without priorities shows no priority UI at
  all.

### Checklists

- **Per-item checklist** — plain-text entries ticked off in the details
  drawer.
- **Progress badge** — cards show a done count like `1/3`, styled when
  complete.

### My items

- **Cross-board page** — everything assigned to you, across all boards you
  can access.
- **Own filter bar and grouping** — including grouping by due date and by
  tags.
- **Menu parity** — the same item actions as on the board itself.

### Comments and history

- **Comments** — editable, with full version history.
- **Auto-linking** — catalog entity refs in comment text become links.
- **Mentions** — `@`-mention users in comments; mentions render as entity
  links.
- **Unified timeline** — comments and the item's change history merged in
  the detail view.
- **Description history** — the item description is versioned too.
- **Drafts survive reload** — unsent comment and description edits are stored
  per user until saved or cancelled.
- **Recent changes** — a board-wide view of the latest activity.

### Sharing

- **Share dialog** — grant `read`, `write`, or `admin` per user or group,
  and pick one of the five public visibility modes.
- **Catalog-backed pickers** — share with users and groups picked from the
  catalog.

### Catalog integration

- **Entity "Boards" tab** — shown only on entities at least one board
  references (see below).
- **Display names** — assignees and creators show their catalog display
  name, with the raw ref in a tooltip.

### Watching and live updates

- **Watching** — watch a whole board or a single item; watchers are listed.
- **Live refresh** — open board views refresh automatically on Backstage
  signals.

### Home page

- **Assigned items card** — your due work at a glance, with scope and
  grouping settings.
- **Boards card** — your favorite (or all) boards, with an item-count
  setting.
- **Well-behaved cards** — defined loading, empty, and failure states, and
  they refresh on board signals.

## When the entity "Boards" tab appears

The tab is not offered on every entity. It is filtered on the label
`boards/is-referenced: "auto-detected"`, which
`@internal/plugin-catalog-backend-module-boards` derives for entities that at
least one non-archived board references — so **that module must be installed
in the backend**, or the tab appears nowhere.

Because the label says "a board references this entity" and not "this viewer
may read that board", the tab can be empty for a user without access to the
referencing board. That is why its empty state reads "No boards are assigned
to this entity that you can access."

The filter is a default, not a fixture. A deployment can replace it through
the extension's config, for instance to show the tab on every component:

```yaml
app:
  extensions:
    - entity-content:boards/entity:
        config:
          filter: { kind: component }
```
