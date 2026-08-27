# Design

`BoardActions` gains `deleteItem(itemId)`; BoardPage implements it with
the existing guarded `boardsApi.deleteItem` (soft delete). `ItemMenu`
appends a `color="danger"` "Delete item" entry for non-readonly items —
appearing in the card menu, the table row menu, and both context menus
automatically.
