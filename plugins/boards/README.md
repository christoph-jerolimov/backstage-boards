# @internal/plugin-boards

Frontend for the boards plugin, built exclusively on the Backstage new
frontend system. Provides:

- `/boards` — paginated "Favorites"/"All" board list with per-status item
  counts, search/entity/creator filters, and row context menus
- `/boards/my-items` — everything assigned to you across boards, with its own
  filter bar and grouping
- `/boards/:boardId` — kanban and table views with drag & drop (plus an
  accessible "Move to column" menu fallback), inline editing, grouping by
  assignee or priority, a filter bar, sortable and configurable table
  columns, row multi-select with bulk actions, and the assignee × status and
  status × priority matrix dialogs
- an item detail drawer with combined status/priority/due-date badge editors,
  description, checklist, and a unified comments + change history timeline
  with per-user drafts
- a share dialog for user/group permissions and public visibility modes
- a "Boards" tab on catalog entities listing the boards assigned to them
- "Assigned items" and "Boards" cards for the Backstage home page

The repository README's Features section lists every behaviour in detail;
the specs behind them live in `openspec/specs/boards/`.

UI is composed from Backstage UI components with react-aria used where no
Backstage UI component exists (drag & drop, the drawer overlay).

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
