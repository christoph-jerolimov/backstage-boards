# Remove Item Labels

## Why

Items carry both key-value labels and flat tags; in practice tags cover
the use cases and the duplication confuses the UI (two similar filters,
two editing surfaces). Labels are removed entirely.

## What Changes

- The item labels feature is removed end to end: the `item_labels`
  table (dropped by migration), the `labels` field on item types,
  create/update inputs, the label filter (UI and API), the drawer's
  Labels section, the table's Labels column, and the `set-item-labels`
  action.

## Impact

- `boards-common`, `boards-backend`, `plugins/boards`: all label code
  paths and tests; spec updated.
