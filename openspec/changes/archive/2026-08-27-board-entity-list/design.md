# Design

- Migration `20260827_07_board_entities`: new `board_entities` table
  (`board_id` FK cascade, `entity_ref`, unique pair), existing
  `boards.entity_ref` values copied in, then the column dropped. Down
  recreates the column from the first reference.
- `Board.entityRefs: string[]` replaces `entityRef`;
  `BoardUpdate.entityRefs?: string[]` replaces the whole list on update
  (admin-gated like other board updates). Create accepts
  `entityRefs?: string[]`. Refs validated with `parseEntityRef`.
- Reads batch-load refs (`board_entities` whereIn board ids) for
  `listBoards` and `getBoard`; the `entityRef` listing filter becomes a
  `whereExists` subquery. Cascade delete needs no change (FK).
- Actions `create-board`/`update-board` switch to `entityRefs` arrays.
- Frontend: new `EntityPicker` (all-kinds variant of `PrincipalPicker`)
  and `BoardSettingsDialog` (current refs with remove buttons + picker;
  saves via `updateBoard({ entityRefs })`). More menu gains "Board
  settings…" (`RiSettings3Line`) for admins; the header renders
  `Entities: <links>` (or `none`) without inline editing.
