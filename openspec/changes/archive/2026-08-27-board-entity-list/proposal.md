# Board Entity Reference List

## Why

A board can currently be assigned to exactly one catalog entity, but a
board often belongs to several — a component and the owning team, for
example. The single ref also made the header's inline assign/clear UI
cramped.

## What Changes

- The board's single `entityRef` becomes an `entityRefs` list stored in
  a new `board_entities` table (existing refs are migrated). Boards can
  reference any number of catalog entities.
- The catalog-filtered board listing (`GET /boards?entityRef=` and the
  entity page tab) matches boards that reference the entity.
- A new "Board settings" dialog, opened from the board's more menu,
  lets admins add entities via a catalog-backed picker and remove them.
  The board header shows the referenced entities as links and no longer
  hosts the inline assign/clear controls.
- REST (`entityRefs` on create/update) and the create-board /
  update-board actions move to the list form; updates replace the whole
  list.

## Impact

- `boards-common`: `Board.entityRefs`, `BoardUpdate.entityRefs`.
- `boards-backend`: migration, service read/write/filter paths, router,
  actions.
- `plugins/boards`: header rendering, new `BoardSettingsDialog` +
  `EntityPicker`, board list page, API client.
