# @internal/plugin-boards-backend

Backend for the boards plugin. Stores boards, columns, priority definitions,
items (with tags, assignees, due dates, and checklists), versioned comments
and descriptions, a change audit log, permissions, favorites, and watches in
the plugin's own database. Exposes a REST API under `/api/boards` and
registers actions in the actions registry, both enforcing the same
permission rules.

Beyond request handling it also:

- sends notifications to watchers and mentioned users via the Backstage
  notifications service, grouped per user
- publishes ids-only signals on board changes so open board views refresh
  live
- runs optional scheduled reminders about due and overdue items (see
  `config.d.ts`)
- purges boards and items 30 days after their soft delete via scheduled
  tasks

Sharing model: per-user/per-group grants with `read`/`write`/`admin` levels
plus board visibility modes (`private`, `logged-in-read`, `logged-in-write`,
`public-read`, `public-write`). All checks are enforced server-side.

Items with an `externalManager` marker (created by service callers such as
sync integrations) are read-only for regular users.

## Catalog entity references

`GET /service/entity-references?entityRef=…` answers `{ referenced: boolean }`
for the catalog processor in
`@internal/plugin-catalog-backend-module-boards`, which turns that answer into
the `boards/is-referenced: "auto-detected"` label deciding where the entity
"Boards" tab appears.

The endpoint accepts **service-to-service credentials only**: its answer
deliberately ignores board visibility, so letting a user call it would reveal
that a board they cannot read references an entity. The plugin's router lets
unauthenticated requests through (public boards need that), so the handler
demands service credentials itself.

Whenever an entity gains or loses its board references — a board is created,
its assigned entities change, or it is archived, unarchived, duplicated with
entities, or permanently deleted — the plugin asks the catalog to refresh the
affected entity refs, so the label is re-derived within seconds instead of at
the next processing sweep. Refresh failures (an entity ref the catalog does
not know, for example) are logged and never fail the board operation.
