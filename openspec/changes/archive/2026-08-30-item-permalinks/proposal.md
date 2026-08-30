## Why

An item can only be pointed at by telling someone where to click: the
drawer's `?item=` URL exists but nothing surfaces it. A "Copy link"
action makes every item linkable in one click — in chat, in commits, in
docs.

## What Changes

- Every item menu (card, table row, drawer, my-items) gains a **Copy
  link** entry that puts the item's permalink on the clipboard: the
  item's board page URL with the `item` parameter
  (`…/boards/<boardId>?item=<itemId>`), absolute, so it can be pasted
  anywhere.
- The entry confirms briefly (label flips to "Link copied") and is
  available to readers — linking is not a mutation.
- Opening such a link keeps working as today: the board page opens with
  the item's drawer on top (and the not-found state if the item is
  gone, the drawer simply not opening).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/item-management`: the "Item menu" behavior gains the Copy
  link entry (new requirement "Item permalinks").

## Impact

- `plugins/boards/src/components/ItemMenu.tsx` — the entry.
- Frontend only. Docs: `docs/features/items.md` menu list, README.
