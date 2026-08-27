# Title Area Opens the Item Details

## Why

A card has three click zones: the card (opens the details drawer), the
title text (starts inline editing), and the area around the title text
inside the title row — which currently does nothing, because that
wrapper stops propagation so inline-edit clicks don't also open the
drawer.

## What Changes

- Clicking the empty area of the title row now opens the details drawer,
  matching the rest of the card. Clicking the title text itself still
  starts inline editing.

## Impact

- `plugins/boards`: `ItemCard` title wrapper in `KanbanView.tsx`.
