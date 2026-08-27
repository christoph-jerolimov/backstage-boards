# Design

`ItemMenu` gains an `assigneePool: string[]` prop; KanbanView and
TableView compute it from all their items' assignees and thread it to
the row/card menus and both context menus. Inside the menu the current
user's ref comes from `identityApiRef` (`useAsyncData`, cached).
Entries: "Me" (current user), then pool minus the current user, sorted;
labels use the ref's name segment (or the `text:` display). Clicking
toggles via a new `BoardActions.setAssignees(itemId, assignees)` backed
by `updateItem`.
