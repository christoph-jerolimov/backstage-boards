# Design

`BoardPage` becomes a thin wrapper reading `:boardId` and rendering
`BoardPageContent`. In embedded mode the content skips the
BreadcrumbEntry wrapper and, after archiving, stays in place (the
archived alert renders) instead of navigating. Delete-now and duplicate
navigate to the absolute boards path (`useRouteRef(rootRouteRef)`), so
they behave correctly from `/catalog/...` as well.
`EntityBoardsContent` loads the entity's boards and renders one
embedded board directly, or BUI Tabs with a panel per board.
