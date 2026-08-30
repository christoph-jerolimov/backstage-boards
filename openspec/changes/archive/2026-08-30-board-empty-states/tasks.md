## 1. Client and shared block

- [x] 1.1 Add `BoardsRequestError` with `status` to the client and a
      404-skipping retry predicate; verify with an api test.
- [x] 1.2 Add the shared `EmptyState` component; verify rendering via
      its adopters' tests.

## 2. Adoption

- [x] 2.1 Board page: not-found state (404) with Back to boards, error
      state with Retry; verify with BoardPage tests for both.
- [x] 2.2 Reader's column-less board empty state in `BoardView`;
      verify with a BoardView test.
- [x] 2.3 Board list empty tabs use the block; verify existing list
      tests still pass (wording unchanged).

## 3. Docs

- [x] 3.1 Mention the friendlier not-found/empty states in the README
      feature list and verify wording.
