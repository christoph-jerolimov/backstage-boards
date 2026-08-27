# Recent Changes as a Table

## Why

The recent-changes dialog renders free-form rows where item, actor,
change, and time run together; a table aligns them into scannable
columns.

## What Changes

- The dialog's content becomes a table with Item, Actor, Change, and
  When columns. Clicking a row (or the item cell) still opens the item.

## Impact

- `plugins/boards`: `RecentChangesDialog` rendering.
