## 1. Boards backend

- [x] 1.1 Export a shared `BOARDS_ENTITY_LABEL = 'boards/is-referenced'` constant (and its `'auto-detected'` value) from `@internal/plugin-boards-common`; verify it is re-exported from the package index and consumed by the later tasks rather than string literals
- [x] 1.2 Add `isEntityReferenced(entityRef)` to `BoardsService` (join `board_entities` with non-archived boards) and unit test it for referenced, unreferenced, and archived-board-only entities
- [x] 1.3 Add `GET /service/entity-references?entityRef=…` to the router, gated by `httpAuth.credentials(req, { allow: ['service'] })`, returning `{ referenced: boolean }`; router tests cover service caller (both answers), a logged-in user (rejected), an unauthenticated caller (rejected), and a private board still counting as a reference
- [x] 1.4 Add the optional `onEntityRefsChanged` hook to `BoardsService` and call it from `createBoard`, `updateBoard` (old ∪ new refs), `deleteBoard`, `unarchiveBoard`, and `hardDeleteBoard`; service tests assert the refs passed for each operation and that duplication with copied entities reports through `createBoard`
- [x] 1.5 Wire the hook in `plugin.ts` to `catalog.refreshEntity` with own service credentials, logging and swallowing failures; verify with a test (or a run against the dev backend) that a failing refresh leaves the board operation successful

## 2. Catalog backend module

- [x] 2.1 Scaffold `plugins/catalog-backend-module-boards` (`@internal/plugin-catalog-backend-module-boards`, role `backend-plugin-module`, `pluginId: catalog`) with package.json, tsconfig-consistent layout, and an index that exports the module as default; verify `yarn tsc` resolves the new workspace package
- [x] 2.2 Implement `BoardsCatalogProcessor` (`getProcessorName`, `postProcessEntity`): resolve the boards backend through discovery, authenticate with a plugin request token targeting `boards`, set `metadata.labels['boards/is-referenced'] = 'auto-detected'` when referenced and delete the key otherwise, persist the answer in the processor cache and reuse it (with a warning) when the request fails
- [x] 2.3 Unit test the processor: label added when referenced, label removed when not, source-declared label stripped, cached value reused on backend failure and the entity returned unchanged-in-that-respect, and no throw on failure
- [x] 2.4 Register the processor from the module via `catalogProcessingExtensionPoint` and add the module to `packages/backend` dependencies and `src/index.ts`; verify the backend starts and an entity referenced by a board shows the label in `/api/catalog/entities`

## 3. Frontend

- [x] 3.1 Set `filter: { 'metadata.labels.boards/is-referenced': 'auto-detected' }` on `entityBoardsContent`; extend `plugin.test.tsx` to assert the extension carries the filter and that it matches a labelled entity but not an unlabelled one
- [x] 3.2 Reword the `EntityBoardsContent` empty state to "No boards are assigned to this entity that you can access." and update `EntityBoardsContent.test.tsx` to the new text

## 4. Documentation

- [x] 4.1 Write `plugins/catalog-backend-module-boards/README.md`: what the module does, the label it owns, the service-to-service endpoint it calls, and the `backend.add(...)` wiring snippet
- [x] 4.2 Update `plugins/boards-backend/README.md` (service-only reference endpoint, catalog refresh on assignment changes) and `plugins/boards/README.md` (tab appears only on labelled entities, requires the catalog module, config override for the filter, access-aware empty state)

## 5. Verification

- [x] 5.1 `yarn prettier:check`, `yarn lint:all`, `yarn tsc:full`, `yarn test:all` green
- [x] 5.2 End-to-end check against the dev app: an entity with no board shows no Boards tab; assigning it to a board makes the tab appear without a restart; removing the assignment makes it disappear again; the endpoint returns 403-class errors for a browser session
