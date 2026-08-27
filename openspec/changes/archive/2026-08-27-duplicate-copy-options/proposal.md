# Duplicate Options: Copy Items and Entity References

## Why

Duplicating a board copies at most columns and share settings; teams
that want a true working copy (e.g. a template board with prepared
items) or the same catalog context must recreate those by hand.

## What Changes

- New "Copy items" option in the duplicate dialog, placed between "Copy
  columns" and "Copy share settings". It is disabled (and off) unless
  "Copy columns" is enabled — items only make sense inside their
  columns. The backend copies non-archived items with their fields and
  associations into the matching new columns; comments, history,
  watches, and external-manager flags are not copied.
- New "Copy entity references" option before "Copy share settings"; the
  backend copies the board's entity reference list.

## Impact

- `boards-backend`: `duplicateBoard` gains `copyItems` (rejected without
  `copyColumns`) and `copyEntities`; service tests.
- `plugins/boards`: dialog checkboxes + API client options.
