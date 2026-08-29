# Design: Add Permission Framework Support

## Context

See `proposal.md` for motivation. Constraints that shape the approach:

- The backend (`packages/backend/src/index.ts`) already installs `@backstage/plugin-permission-backend` with the allow-all policy, and `app-config.yaml` sets `permission.enabled: true`. Nothing in the boards plugins uses the framework yet.
- The boards router is deliberately reachable unauthenticated (`httpRouter.addAuthPolicy({ path: '/', allow: 'unauthenticated' })`) because of public boards. `resolvePrincipal` in `plugins/boards-backend/src/router.ts` yields `user | service | anonymous` principals, so the `boards.use` gate must work for anonymous credentials too.
- Board and item mutations are reachable through two doors with credentials in hand: the Express router and the actions registry (`plugins/boards-backend/src/actions.ts`), which calls `BoardsService` directly. `GET /service/entity-references` is service-to-service only; reminders and purge are scheduled tasks with no user credentials.
- The app uses the New Frontend System: no `App.tsx` routes to wrap, the sidebar item is derived automatically from the `page:boards` extension by the app-owned nav module (`packages/app/src/modules/nav/Sidebar.tsx`), and the entity tab is an `EntityContentBlueprint` extension.
- Verified against `@backstage/plugin-catalog-react@3.2.1` / `@backstage/plugin-catalog@2.0.8`: the entity content `filter` param only accepts `string | FilterPredicate | (entity: Entity) => boolean`, and tab routes are filtered synchronously against the entity (`filterEntityLayoutRoutes`). There is no hook/permission context, so the tab *header* cannot be permission-gated today — only its content can.
- Per-board access (`read`/`write`/`admin`, visibilities) is enforced in the service layer (`BoardsService.requireBoard` etc.) and must stay untouched.

## Goals / Non-Goals

**Goals:**

- Define, register, and enforce `boards.use` and `boards.new.create` with zero behavior change under the allow-all policy or with `permission.enabled: false`.
- One authoritative enforcement point per door (router, actions) so no user-invoked path bypasses the check.
- Frontend gating is UX-only (hide what the user cannot use); the backend remains the authority.

**Non-Goals:**

- No resource permissions, conditional decisions, or permission rules for individual boards — per-board access stays with the share feature.
- No plugin-specific on/off config; the framework's own `permission.enabled` is the toggle.
- No change to service-to-service surfaces, scheduled tasks, signals, or the catalog module.

## Decisions

### 1. Permission definitions live in `@internal/plugin-boards-common`

New `plugins/boards-common/src/permissions.ts` exporting:

```ts
export const boardsUsePermission = createPermission({
  name: 'boards.use',
  attributes: {},
});
export const boardsNewCreatePermission = createPermission({
  name: 'boards.new.create',
  attributes: { action: 'create' },
});
export const boardsPermissions = [boardsUsePermission, boardsNewCreatePermission];
```

Adds a dependency on `@backstage/plugin-permission-common` (already resolved at 0.9.10 in the lockfile). Common is the right home because the frontend (gating), backend (enforcement), and integrator policies all import the same objects. `boards.use` is a basic permission with no action attribute — it is a capability flag, not a CRUD verb; `boards.new.create` carries `action: 'create'` so attribute-based policies work.

*Alternative considered:* defining them in the backend package and re-exporting — rejected; frontend must not depend on the backend package.

### 2. Backend wiring: `coreServices.permissions` + `coreServices.permissionsRegistry`

`plugins/boards-backend/src/plugin.ts` adds both deps, calls `permissionsRegistry.addPermissions(boardsPermissions)` so the framework can enumerate boards permissions, and passes the permissions service to the router and actions. Requires `@backstage/plugin-permission-node` (types) — Backstage 1.54 supports the registry service.

*Alternative considered:* `createPermissionIntegrationRouter` mounted manually — the registry service is the current replacement for exactly this; no reason to use the legacy path.

### 3. A single `BoardsPermissionGuard` shared by router and actions

A small helper wrapping `PermissionsService`:

- `requireUse(credentials)` — authorizes `boards.use`; throws `NotAllowedError` on DENY.
- `requireCreate(credentials)` — authorizes `boards.new.create`; throws on DENY.
- The guard authorizes signed-in callers and lets the permissions service decide the rest: `ServerPermissionClient` (verified at `@backstage/plugin-permission-node@0.11.3`) short-circuits service principals itself — ALLOW, while still honoring their access restrictions, which an explicit bypass in the guard would have ignored — and returns ALLOW for everything when `permission.enabled` is false. Anonymous (`none`) credentials are exempted by the guard: the client sends their authorize request token-less and the permission backend rejects tokenless requests with 401 (verified against the running app), so evaluating them is not possible — anonymous access stays governed by the share feature's public visibilities, exactly as without the framework.

Enforcement points:

- **Router:** an Express middleware mounted before all user-facing routes calls `requireUse` with the credentials from the existing `httpAuth.credentials(req, { allow: ['user','service','none'] })` resolution. `GET /service/entity-references` is mounted before the middleware (or exempted by path) — it already re-checks for a service principal itself. The `POST /boards` and `POST /boards/:boardId/duplicate` handlers additionally call `requireCreate`.
- **Actions:** every action handler in `registerActions` calls `requireUse(ctx.credentials)` first; `create-board` also calls `requireCreate`. This closes the non-HTTP door.

*Alternative considered:* checks inside `BoardsService` methods — rejected: the service works with `BoardsPrincipal`, not credentials; scheduled tasks (reminders, purge) call the service without a user; and mixing framework permissions into the share-model layer would blur the "sharing stays authoritative within a board" boundary.

### 4. Deny semantics: `NotAllowedError` (HTTP 403)

A DENY for `boards.use` returns 403 before any handler logic runs — it does not masquerade as 404. The share model's existing "unreadable board looks like NotFound" behavior is unchanged because the guard runs before it and is orthogonal to it.

### 5. Frontend gating with `@backstage/plugin-permission-react`

Add the dependency to `plugins/boards` and gate at three places, all UX-only:

- **Boards page:** the top of `BoardsPage` uses `usePermission(boardsUsePermission)`; while loading render nothing/progress, on DENY render an access-error page, on ALLOW render as today.
- **Sidebar item:** `packages/app/src/modules/nav/Sidebar.tsx` (app-owned) filters the `page:boards` nav target through `usePermission(boardsUsePermission)`. The New Frontend System derives nav items from page extensions with no built-in permission filter, so this lives in the app; the docs tell adopters with their own app to do the same.
- **Entity tab and home widgets:** wrap `EntityBoardsContent` and both widget components with the same check. Tab content shows an access-restricted state; widgets render nothing. The tab *header* stays visible on marked entities — a documented framework limitation (see Risks).
- **Create/duplicate affordances:** the board list's create button and the duplicate menu entry check `boardsNewCreatePermission` and hide/disable on DENY.

**Fail-open on the frontend:** if the permission API errors or is unavailable, render as if allowed — the backend is authoritative, and failing open preserves "the plugin works completely without the framework". The backend guard never fails open.

*Alternative considered:* `RequirePermission` from permission-react — it targets the old frontend system's routing; a small local gate component around `usePermission` fits the blueprint loaders better and implements the fail-open rule.

### 6. Optionality via the framework itself

With `permission.enabled: false`, `ServerPermissionClient` (backend) and the frontend permission API short-circuit to ALLOW without network calls; with the allow-all policy every decision is ALLOW. Either way behavior is byte-for-byte today's. No plugin config key is added — one toggle, owned by the framework. This might change in the future (e.g. plugin-level default policies), which is why the permissions live in the common package where they can grow.

## Risks / Trade-offs

- [Tab header still visible to denied users on marked entities] → Content is gated and issues no API calls; revisit when `EntityContentBlueprint` filters become permission-aware. The existing spec already allows an "empty tab" state for users without access to any referencing board, so the UX is consistent.
- [Permission API might not be among the New Frontend System's default APIs] → Verify during implementation; if missing, register the permission API factory in `packages/app`. The fail-open rule keeps the UI working either way.
- [One `authorize()` round-trip per request] → Single basic permission per request against the local permission backend; negligible. Batch the create check into the same `authorize` call on the two create routes.
- [Anonymous callers cannot be policy-controlled] → The permission backend rejects tokenless authorize requests, so the guard exempts anonymous credentials rather than breaking public boards; a policy therefore cannot hide public boards from anonymous visitors. Accepted: that is today's behavior, and an installation can disable unauthenticated access outright if it needs to.
- [Denying `boards.use` does not hide catalog labels] → The `boards/is-referenced` entity label is written by the catalog processor regardless of viewer; it leaks only "some board references this entity", no board data. Accepted.

## Migration Plan

1. Ship permissions + backend enforcement + frontend gating in one change; no database migration, no config change required.
2. Default deployments (allow-all or disabled framework) see no change — safe to deploy directly.
3. Adopters opting in write a policy (e.g. deny `boards.new.create` unless member of an admin group) per the new docs page; rollback is reverting to allow-all.

## Open Questions

- None blocking. Whether `boards.use` should later become a resource-less *read* vs. keep basic semantics can be decided when (if) resource permissions for boards are introduced.
