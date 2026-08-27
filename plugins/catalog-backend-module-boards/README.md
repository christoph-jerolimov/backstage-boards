# @internal/plugin-catalog-backend-module-boards

A catalog backend module that marks the catalog entities a board references,
so the entity "Boards" tab can be shown only where it has something to show.

## What it does

`BoardsCatalogProcessor` runs in `postProcessEntity` for every entity the
catalog processes. It asks the boards backend whether any non-archived board
references that entity and then:

- sets the label `boards/is-referenced: "auto-detected"` on the entity if one
  does, or
- removes that label if none does.

The label is always derived, never read from the entity's own description: an
entity that declares `boards/is-referenced: "auto-detected"` in its
`catalog-info.yaml` has the label stripped again unless a board really
references it.

The lookup goes to `GET /api/boards/service/entity-references?entityRef=…`
with a plugin request token targeting the `boards` plugin. That endpoint only
accepts service-to-service credentials, because its answer ignores board
visibility — a user must not be able to ask it directly.

If the boards backend cannot be reached, the processor does **not** fail the
entity. It reuses the last answer it cached for that entity (so the label
freezes rather than disappearing catalog-wide during an outage) and logs a
warning. An entity processed for the first time during an outage stays
unlabelled until the next run.

Board changes do not wait for the next processing sweep: the boards backend
requests a catalog refresh for every entity ref whose set of referencing
boards changed.

## Installation

```ts
// packages/backend/src/index.ts
backend.add(import('@internal/plugin-catalog-backend-module-boards'));
```

The module needs `@internal/plugin-boards-backend` in the same backend (it is
the plugin it calls). Without this module no entity ever gets the label, and
the "Boards" tab therefore appears nowhere — see
`@internal/plugin-boards` for the config override if you want the tab
regardless.
