# Add Permission Framework Support

## Why

Adopters need to control who can see and use the Boards plugin, and whether board creation is open to everyone or reserved for an admin team. Backstage's permission framework is the standard way to express such policies, and this repo's backend already wires it up (currently with the allow-all policy). Adopting it lets integrators write their own policy for boards without the plugin inventing a bespoke authorization mechanism.

## What Changes

- Define two plugin permissions in `@internal/plugin-boards-common` so both frontend and backend can reference them:
  - `boards.use` — a basic permission that acts as a feature flag. It is a condition for everything: the Boards page, the catalog entity tab, and every user-invoked API call are only available when the user is granted it.
  - `boards.new.create` — a create permission deciding whether a user may create a new board (including via duplicate). This lets an installation choose between admin-managed boards and open creation.
- Backend: register the permissions with the permission framework and check `boards.use` on all user-invoked endpoints and actions; check `boards.new.create` additionally wherever a new board is created. Service-to-service endpoints (catalog processor's entity-reference lookup) and scheduled tasks are exempt.
- Frontend: hide the Boards page (and its nav item), the catalog entity tab, and the homepage widgets when `boards.use` is not granted.
- Using the permission framework remains **optional**: with the framework disabled (`permission.enabled: false`) or the default allow-all policy, the plugin behaves exactly as today. This might change in the future.
- Everything *within* a board stays governed by the plugin's existing share feature (per-board read/write/admin levels and visibilities); the new permissions sit above it and do not replace it.

## Capabilities

### New Capabilities

- `boards/permission-framework`: Plugin-level permissions (`boards.use`, `boards.new.create`), their registration with the permission framework, backend enforcement on user-invoked calls, page/nav visibility gating, and the optional-by-default behavior.

### Modified Capabilities

- `boards/board-management`: Creating a board (create and duplicate) additionally requires the `boards.new.create` permission decision; user-invoked board endpoints require `boards.use`.
- `boards/catalog-entity-tab`: The Boards tab is shown only when the user is granted `boards.use`, in addition to the existing entity-marker filter.
- `boards/homepage-widgets`: The homepage widgets render nothing when the user is not granted `boards.use`.
- `boards/actions`: Registered actions enforce the same permission decisions as the REST endpoints (`boards.use` for all, `boards.new.create` for board creation).

## Impact

- `plugins/boards-common`: new `permissions.ts` export; new dependency on `@backstage/plugin-permission-common`.
- `plugins/boards-backend`: `plugin.ts` gains `coreServices.permissions` + permissions registry deps; `router.ts` gains permission checks for user-invoked routes; `actions.ts` gains the same checks; new dependency on `@backstage/plugin-permission-node`.
- `plugins/boards`: page, entity tab, and widget extensions gated by `usePermission`/`RequirePermission`; new dependency on `@backstage/plugin-permission-react`.
- No change to the board sharing model, database schema, or the service-to-service `/service/entity-references` endpoint.
- Default deployments (allow-all policy or permissions disabled) see no behavior change.
