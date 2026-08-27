# @internal/plugin-boards-backend

Backend for the boards plugin. Stores boards, columns, items, versioned
comments, a change audit log, permissions, favorites, and watches in the
plugin's own database. Exposes a REST API under `/api/boards`, registers
actions in the actions registry, and sends notifications to watchers via the
Backstage notifications service.

Sharing model: per-user/per-group grants with `read`/`write`/`admin` levels
plus board visibility modes (`private`, `logged-in-read`, `logged-in-write`,
`public-read`, `public-write`). All checks are enforced server-side.

Items with an `externalManager` marker (created by service callers such as
sync integrations) are read-only for regular users.
