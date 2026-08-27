## 1. Backend

- [x] 1.1 Add optional `SignalsService` to `BoardsService`, emit `{ boardId, itemId? }` on the `boards` channel after each mutation, wire `signalsServiceRef` in the plugin; unit tests assert emission on item and column mutations

## 2. Frontend

- [x] 2.1 Subscribe with `useSignal` in `BoardPage` (matching board only) and `BoardListPage`; verify with two browser sessions that a change in one appears in the other without reload

## 3. Verification

- [x] 3.1 tsc, lint, tests green; two-page Playwright check of live refresh
