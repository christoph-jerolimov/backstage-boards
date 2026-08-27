# Server-Side Entity Filter for Board Listing

## Why

The catalog entity tab fetches every accessible board and filters client-side; with many boards that is wasteful. Filtering by assigned entity belongs on the server, and API/action consumers benefit too.

## What Changes

- `listBoards` accepts an `entityRef` filter (SQL `where entity_ref = ?` before the access check loop); exposed as `?entityRef=` on the boards endpoint and on the frontend client.
- The entity "Boards" tab requests only boards assigned to the shown entity.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/board-management`: the board listing supports filtering by assigned catalog entity server-side.

## Impact

- `plugins/boards-backend`: `listBoards` option, router param, test.
- `plugins/boards`: client param, `useBoardsQuery` variant, `EntityBoardsContent` uses it.
