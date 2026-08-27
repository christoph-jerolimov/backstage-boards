# Live Updates via Signals

## Why

A board only refreshes after the viewer's own actions; changes by others appear on reload. The signals plugin (already installed) gives us push-based refresh so open boards stay current.

## What Changes

- The backend publishes a signal on the `boards` channel after every board-content mutation (items, comments, columns, board updates/deletes), carrying only `{ boardId, itemId? }`.
- The board page subscribes to the channel and silently refreshes when a signal for its board arrives; the board list refreshes on any boards signal.
- Access is unaffected: signals carry ids only, all data still flows through the permission-checked API.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/watching-and-notifications`: open board views update automatically when another user changes the board.

## Impact

- `plugins/boards-backend`: optional `SignalsService` dependency, `emit` calls in `BoardsService`, tests.
- `plugins/boards`: `useSignal` subscription in `BoardPage`/`BoardListPage`; new deps `@backstage/plugin-signals-react` and `@backstage/plugin-signals-node`.
