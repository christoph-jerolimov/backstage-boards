# Restore the Drag Drop-Target Indicator

## Why

Dropping a card onto another card inserts it before that card, and the
target used to show a highlighted top border during the drag. The
indicator disappeared: the card style mixes the `border` shorthand with
a conditional `borderTop` longhand in one React style object, which
React serializes into a broken style attribute (empty
`border-right-color:` etc.) — the cards lose their borders and the
indicator never renders.

## What Changes

- The card keeps a constant `border`; the drop-target indicator becomes
  a `boxShadow` bar above the card edge (`0 -3px 0 0` in the link
  color), which reads as a line between the cards and causes no layout
  shift.

## Impact

- `plugins/boards`: `ItemCard` style in `KanbanView.tsx` only.
