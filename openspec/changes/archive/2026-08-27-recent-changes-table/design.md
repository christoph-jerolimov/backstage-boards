# Design

The entry list renders as a BUI `TableRoot` with `onRowAction` opening
the item (closing the dialog first). Columns: Item (row header), Actor
(RefDisplay), Change (`changeSummary`), When (`formatDate`). Loading and
empty states unchanged.
