# Design

Straight removal, no compatibility shims:
- Migration `20260827_08_drop_item_labels` drops `item_labels` (down
  recreates the empty table).
- Types lose `labels`; the filter helper drops label matching; the
  `set-item-labels` action is unregistered and `list-items`/`add-item`
  lose their label inputs/outputs; the router drops the `label` query
  parsing and body pass-through; the service drops the label
  association/diff/hydration/filter/copy code.
- UI: label filter menu and state, drawer Labels section (and
  `parseLabels`), table Labels column removed.
