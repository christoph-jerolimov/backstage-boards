# Design

`duplicateBoard` options become `{ name?, copyColumns, copyItems,
copyEntities, copyPermissions }`. `copyItems && !copyColumns` throws an
InputError. Item copying walks the source columns in order (the created
columns match by index), selects non-archived items per column, and
inserts new rows (fresh ids, actor as creator, `external_manager`
null) plus assignee/label/tag associations and one `created` change
each; no notifications. `copyEntities` clones the `board_entities`
rows. The dialog adds the two checkboxes — "Copy items" auto-unchecks
and disables when "Copy columns" is off.
