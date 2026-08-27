# Filter Bar Layout

## Why

The search field stretches across the filter bar, pushing the tag
filter far right, and the "x of y items" status sits directly beside
the buttons so the clear button's position jumps around.

## What Changes

- The search field gets a fixed compact width instead of stretching.
- When a filter is active, the "x of y items" message takes the free
  space so "Clear filters" is pinned to the right edge.

## Impact

- `plugins/boards`: filter bar styles in `BoardPage.tsx`.
