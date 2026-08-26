# Backstage Boards Plugin

## Why

Teams using Backstage have no built-in way to organize and track work items in a shared, flexible way tied to their catalog. This change introduces a first-class "Boards" plugin — shareable kanban-style boards with configurable columns, fine-grained permissions, and catalog integration — laying the foundation for later syncing external items (GitHub PRs, Jira tickets) into the same boards.

## What Changes

- New frontend plugin `@internal/plugin-boards` built exclusively on the Backstage **new frontend system (NFS)**, using Backstage UI components (falling back to react-aria where no Backstage UI component exists), with inline editing wherever possible.
- New backend plugin `@internal/plugin-boards-backend` with its own database (Knex migrations) storing boards, columns, items, comments (versioned), changes (audit log), permissions, favorites, and watches.
- New common package `@internal/plugin-boards-common` with shared types, permission definitions, and the REST API contract.
- Boards: named, with per-board UI-configurable columns (a column = a status; there is no built-in "done" status), optional assignment to a catalog entity.
- Sharing: per-board access for users and groups with permission levels **admin / write / read**, plus board-wide visibility for any logged-in user or anyone (public read-only and public writable), managed from the UI.
- Board list view showing favorited boards and all accessible boards.
- Items: title, status (column), labels (key-value pairs), tags, created by / created at and similar audit fields, optional creator, one or more assignees. Creator/assignees are catalog refs, or `text:<anything>` for non-catalog identities.
- Comments: markdown subset with auto-linking of catalog entity refs (e.g. `system:default/example`, `user:christoph`); editable, with previous versions retained in the comments table. All other item changes recorded in a changes table. Item detail view (drawer/modal) shows comments and changes in one unified timeline.
- Board view (kanban) and table view for a board's items, both with an option to group items by assignee.
- Actions for the Backstage **actions registry**: create/modify/delete boards, add/remove board permissions, add/update/move/delete items, add/change comments, labels, and tags.
- Watching: users can watch a board or an item; the backend sends a notification (via the Backstage notifications service) when a watched item changes.
- Items carry an external-management marker so future sync modules (GitHub PRs, Jira) can create read-only items through the same actions/REST API.

## Capabilities

### New Capabilities

- `boards/board-management`: Creating, listing, updating, deleting boards; configurable columns; favorites; optional catalog entity assignment.
- `boards/board-sharing`: Per-user/per-group permission levels (admin/write/read), public access modes (logged-in users, public read-only, public writable), permission management from the UI.
- `boards/item-management`: CRUD and move for items; fields (title, status, labels, tags, creator, assignees, audit fields); read-only externally-managed items; board and table views with group-by-assignee.
- `boards/comments-and-history`: Editable versioned comments with entity auto-linking, change audit log, unified comment+change timeline in the item detail view.
- `boards/actions`: Actions registry actions for boards, permissions, items, comments, labels, and tags.
- `boards/watching-and-notifications`: Watch a board or item; notifications on changes to watched items.

### Modified Capabilities

<!-- none — this is a greenfield plugin; no existing specs -->

## Impact

- New workspace packages: `plugins/boards`, `plugins/boards-backend`, `plugins/boards-common`.
- `packages/app`: register the boards frontend plugin (NFS `createApp` picks it up via feature discovery or explicit import).
- `packages/backend`: add the boards backend plugin.
- New backend database schema (plugin-scoped, via Knex migrations) — no impact on other plugins' data.
- Dependencies: Backstage UI (`@backstage/ui`), `react-aria`, `@backstage/plugin-notifications-node` (already present in the app), catalog client for entity validation/display, actions registry (`@backstage/backend-plugin-api` alpha actions support).
- Integrates with existing permissions/auth: uses Backstage identity for user/group resolution (ownership groups for group-level shares).
