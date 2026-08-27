## 1. Implementation

- [x] 1.1 Add `@tanstack/react-query`, `queries.ts` (client, query hooks, invalidation helpers, optimistic `useMoveItem`/`useRenameItem`) and providers in `BoardsPage`/`EntityBoardsContent`
- [x] 1.2 Refactor `BoardListPage`, `BoardPage` (incl. signal handler and `guarded`) to the query hooks with targeted invalidation; drawer `onChanged` invalidates items+board only

## 2. Verification

- [x] 2.1 tsc, lint, tests green; Playwright smoke: move via menu appears instantly (UI updated before server reconcile is observable), views still consistent after mutations, live signals still refresh
