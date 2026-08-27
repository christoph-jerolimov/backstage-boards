# Show the Catalog "Boards" Tab Only for Entities a Board References

## Why

The "Boards" tab is rendered on every catalog entity, so almost every entity
shows a tab that resolves to "No boards are assigned to this entity." The tab
should only appear where it has something to show: on entities that at least
one board references.

## What Changes

- A new backend module package `@internal/plugin-catalog-backend-module-boards`
  registers a `BoardsCatalogProcessor` that, in `postProcessEntity`, sets the
  label `boards/is-referenced: "auto-detected"` on entities referenced by at
  least one board and
  removes it otherwise. The label is always derived, never taken from the
  source entity (`catalog-info.yaml` cannot forge it).
- boards-backend gains a service-to-service-only endpoint that answers whether
  a given entity ref is referenced by any non-archived board. Requests from
  users or unauthenticated callers are rejected — this is not a way to probe
  boards a user cannot read.
- boards-backend triggers a catalog refresh for every entity ref that gains or
  loses a board reference (board created, entity assignment changed, board
  archived, unarchived, duplicated with entities, or hard-deleted), so the
  label converges without waiting for the next full processing sweep.
- The `entityBoardsContent` extension gets a default filter on that label, so
  the tab is only mounted on entities carrying it. The filter stays overridable
  through app-config extension config.
- The tab's empty state says the entity has no boards *the current user can
  access* — with the filter in place, an empty tab now means missing access to
  the referencing board rather than "no boards at all".
- READMEs for the boards frontend, boards backend, and the new module explain
  the mechanism and the required backend wiring.

## Capabilities

### New Capabilities

- `boards/catalog-entity-tab`: when the catalog "Boards" tab is shown for an
  entity — the derived `boards/is-referenced` label, the service-only reference
  lookup, the
  refresh trigger that keeps the label current, and the access-aware empty
  state.

### Modified Capabilities

<!-- none: existing board management, sharing, and item requirements are unchanged -->

## Impact

- New package `plugins/catalog-backend-module-boards` (processor, tests,
  README), added to `packages/backend` dependencies and `src/index.ts`.
- `plugins/boards-backend`: new service-only route, a refresh hook on
  `BoardsService` wired to `catalogServiceRef` in `plugin.ts`, README.
- `plugins/boards-common`: exported label constant shared by processor and
  frontend.
- `plugins/boards`: filter on `entityBoardsContent`, empty-state wording,
  README.
- Catalog data: every processed entity referenced by a board carries a
  `boards/is-referenced: "auto-detected"` label, visible through the catalog
  API and usable in other entity filters.
