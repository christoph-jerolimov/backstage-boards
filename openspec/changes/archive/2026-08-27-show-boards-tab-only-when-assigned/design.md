# Design

## Context

See `proposal.md` — Why. What shapes the approach:

- `entityBoardsContent` (`plugins/boards/src/plugin.tsx`) is an
  `EntityContentBlueprint` extension. Its params accept
  `filter?: string | FilterPredicate | ((entity: Entity) => boolean)`, and the
  extension's config schema accepts a `FilterPredicate`, so a default set in
  params stays overridable from `app-config.yaml`. A `FilterPredicate` is an
  object of dot-separated paths, e.g.
  `{ 'metadata.labels.boards/is-referenced': 'auto-detected' }` — only `.`
  separates path segments, so a prefixed label key stays one segment. Matching
  is case-insensitive.
- Boards store their entity assignments in `board_entities` (many refs per
  board). `listBoards` already filters by `entityRef` and excludes archived
  boards (`whereNull('archived_at')`) — the tab therefore only ever shows
  non-archived boards, and "referenced" must mean the same thing.
- `boards-backend` registers `httpRouter.addAuthPolicy({ path: '/', allow:
  'unauthenticated' })` so public-visibility boards work without login. Auth is
  enforced per handler through `resolvePrincipal`, so a new route cannot rely on
  the router-level policy to keep users out — it must demand service
  credentials itself.
- `plugin.ts` already depends on `catalogServiceRef` (used by reminders) and on
  `coreServices.auth`; `CatalogService.refreshEntity(entityRef, { credentials })`
  is available with `auth.getOwnServiceCredentials()`.
- `BoardsService` takes its collaborators through its constructor
  (`notifications`, `signals`) and has no catalog dependency — tests construct
  it with fakes (`service/testUtils.ts`).
- A `CatalogProcessor` implements
  `postProcessEntity(entity, location, emit, cache)` and returns the entity that
  gets stitched; it is registered from a backend module through
  `catalogProcessingExtensionPoint.addProcessor(...)`.

## Goals / Non-Goals

**Goals:**

- The label is a pure function of board data, recomputed by the catalog, never
  authored by entity owners.
- A boards-backend outage degrades to "tab keeps its last state", not "every
  entity fails processing" and not "the tab disappears everywhere".
- The reference lookup can never become a way for a user to enumerate boards
  they cannot read.

**Non-Goals:**

- Per-user tab visibility. Access is checked when the tab's content loads, not
  when the tab is rendered; the catalog entity is shared by all viewers, so a
  label cannot encode per-user access. The empty state carries that caveat.
- Reacting to catalog entity deletions (a board keeps a ref to a deleted
  entity; nothing to label).
- A `boards`-label-driven catalog filter, search collator, or entity card. Only
  the tab consumes the label for now.

## Decisions

**A separate module package, `@internal/plugin-catalog-backend-module-boards`.**
The processor must be registered into the catalog plugin, not the boards
plugin, so it belongs in a `backend-plugin-module` package with `pluginId:
catalog`. Putting it inside `boards-backend` would mean that package exports
two backend features and pulls catalog-processing types into the boards plugin
for no gain. The module depends on `@internal/plugin-boards-common` for the
shared label constant and on nothing from `boards-backend` — it talks HTTP.

**Label `boards/is-referenced: "auto-detected"`, always derived.**
`postProcessEntity` sets `metadata.labels['boards/is-referenced'] =
'auto-detected'` when referenced and deletes the key otherwise — including when the source declared it. Deleting
unconditionally on the negative path is what makes the label unforgeable and
what makes removal work when the last board reference goes away. An annotation
(`boards.backstage.io/...`) was the alternative; a label is the right kind
because it is a small, filterable, closed-vocabulary value, and label paths are
what the frontend filter predicate reads. Both key and value stay within the
Kubernetes-style label rules the catalog enforces (`boards` prefix +
`is-referenced` name; a value of letters and dashes).

**One lookup per entity, not a cached full set.**
The endpoint answers a single ref: `GET /service/entity-references?entityRef=…`
→ `{ referenced: boolean }`. The alternative — one endpoint returning every
referenced ref, cached in the processor for a TTL — would cut the request count
of a full processing sweep to one, but it trades correctness for it: after a
board change triggers a refresh, the processor would answer from a stale set
and the label would flip a TTL later, or not at all. The per-entity query is an
indexed lookup on `board_entities` joined against non-archived boards; a sweep
of a catalog this size is not a load concern, and the boards backend is
in-process reachable through discovery.

**Service credentials required in the handler.**
The handler calls `httpAuth.credentials(req, { allow: ['service'] })`, which
rejects user and unauthenticated principals with `NotAllowedError` — the
router-level `allow: 'unauthenticated'` policy only decides what reaches the
router. This route deliberately does not go through `resolvePrincipal`: it must
not be reachable as a user at all, rather than reachable with a per-board
access check, because the honest answer ("a board you cannot see references
this entity") is itself the leak. The processor authenticates with
`auth.getPluginRequestToken({ onBehalfOf: await auth.getOwnServiceCredentials(),
targetPluginId: 'boards' })`.

**Refresh through a service-level hook, not a catalog dependency in
`BoardsService`.**
`BoardsService` gains an optional constructor option
`onEntityRefsChanged?: (entityRefs: string[]) => void`, called with the union of
the affected refs after `createBoard`, `updateBoard` (old ∪ new refs),
`deleteBoard`, `unarchiveBoard`, and `hardDeleteBoard`. `duplicateBoard` routes
through `createBoard` and needs no separate call. `plugin.ts` wires the hook to
`catalog.refreshEntity(ref, { credentials: await auth.getOwnServiceCredentials() })`,
fire-and-forget with a `logger.warn` on failure — an entity ref pointing at
something the catalog does not know is normal and must not fail the board
write. Keeping the catalog out of `BoardsService` preserves its
fake-in-constructor test setup and lets the tests assert the hook's arguments
instead of stubbing a catalog client.

`purgeArchivedBoards` deliberately does not refresh: those boards were already
archived and therefore already counted as unreferenced.

**Fall back to the per-entity processor cache when the lookup fails.**
`postProcessEntity` writes the resolved boolean into the `CatalogProcessorCache`
and, when the HTTP call fails, reuses the cached value and logs a warning
rather than throwing. Throwing would mark every entity in the catalog as errored
during a boards outage; returning "not referenced" would silently strip the tab
from every entity and then need a full sweep to come back. With the cache, an
outage freezes the label at its last known value; only entities never processed
before are left unlabelled.

**Frontend: a default filter param, still config-overridable.**
`entityBoardsContent` gets
`filter: { 'metadata.labels.boards/is-referenced': 'auto-detected' }` in its
params. Because `EntityContentBlueprint` exposes `filter` in its config schema,
an operator can override it under
`extensions: - entity-content:boards/entity: config: filter: …` — which is the
escape hatch if the module is not installed and the label therefore never
appears.

**Empty-state wording.**
"No boards are assigned to this entity that you can access." — the tab is now
only reachable when a board references the entity, so the honest reading of an
empty list is missing access (or a label that is briefly stale). It says
nothing about how many boards exist, which keeps the message from leaking board
existence beyond what the tab's presence already implies.

## Risks / Trade-offs

- [The tab's presence itself reveals that *some* board references the entity, to
  any user who can see the entity] → Accepted, and it is the point of the
  feature; no board name, count, or content is exposed, and the empty state is
  worded to avoid confirming details.
- [Label lag: a board change is visible in the tab only once the catalog has
  re-processed the entity] → The refresh hook makes this seconds rather than a
  processing interval; a missed refresh self-heals on the next sweep.
- [Deployments that install the frontend plugin but not the catalog module see
  the tab nowhere] → Called out in all three READMEs, with the backend wiring
  snippet and the config override as the escape hatch.
- [One HTTP request per entity per processing run] → Local, indexed, and
  bounded by the catalog size; the full-set endpoint stays available as a later
  optimisation if a large catalog ever makes it matter.
- [The label key is owned outright: whatever an entity declares under
  `boards/is-referenced` is overwritten or deleted] → The `boards/` prefix
  keeps it clear of unprefixed deployment conventions, the value
  `auto-detected` says the platform wrote it, and the READMEs document the
  ownership.

## Migration Plan

Deploy in one step: the module, the endpoint, and the frontend filter ship
together. On first startup the catalog labels entities as they are processed;
`refreshEntity` covers subsequent changes, so no backfill job is needed —
existing referencing boards converge within one processing interval, and
touching a board converges its entities immediately. Rollback is removing the
module from `packages/backend/src/index.ts` (labels then stop updating) or
reverting the frontend filter (tab returns everywhere); the two are independent.
