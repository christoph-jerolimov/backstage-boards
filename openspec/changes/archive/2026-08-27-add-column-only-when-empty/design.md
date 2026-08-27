# Design

The add-column button/field in `KanbanView` gains
`board.columns.length === 0` to its `canWrite` condition. Column
management otherwise stays available (rename/color/delete via the
column menu).
