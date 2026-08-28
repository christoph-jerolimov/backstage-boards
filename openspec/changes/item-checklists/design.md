# Design

## Data model

- `ChecklistEntry { text: string; done: boolean }` in `boards-common`.
  Deliberately flat: no ids, no assignees, no due dates on entries — a
  checklist is a memory aid inside one item, and anything richer is a
  second item.
- `BoardItem.checklist: ChecklistEntry[]`, non-optional and empty when
  unused, following `tags` rather than `dueDate`. "Optional" is then a
  property of the data (`length === 0`), not of the field, so the card,
  table, and drawer never branch on `undefined`.
- `NewItem.checklist?: ChecklistEntry[]` and
  `ItemUpdate.checklist?: ChecklistEntry[]`. The whole list is replaced
  on every write, like `tags` and `assignees`; there is no per-entry
  endpoint. Clearing is `[]` — no `null` overload is needed, since an
  empty list already means "no checklist".
- Migration `20260827_09_item_checklists` creates
  `item_checklist_items`: `id` (uuid pk), `item_id` (FK →`items.id`,
  `onDelete('CASCADE')`), `position` (double), `text` (string),
  `done` (boolean, default false), indexed on `item_id`. A table rather
  than a JSON column, matching `item_tags`; ordering uses the same
  `POSITION_STEP` spacing as items, written as `(index + 1) * step` on
  each full rewrite.

## Shared helpers (`boards-common/src/checklist.ts`)

- `normalizeChecklist(entries)`: trims each text, drops entries whose
  text is empty after trimming, coerces `done` to a boolean, and
  preserves order (no dedupe — "call Bob" twice may be two real steps).
- `isValidChecklist(entries)`: every entry is an object with a string
  `text` of at most `CHECKLIST_TEXT_MAX` (200) characters, and the list
  holds at most `CHECKLIST_MAX` (50) entries. Longer lists are a sign
  the work wants to be split into items.
- `checklistProgress(entries)`: `{ done, total }`, with
  `complete = total > 0 && done === total` derived at the call site.
- Exported from the `src/index.ts` barrel.

## Backend

- `hydrateItems` gains a fourth batch load —
  `item_checklist_items whereIn('item_id', ids).orderBy('position')` —
  and maps each item's rows to `checklist`, keeping DB order.
- `writeAssociations` handles `checklist` with the same
  delete-all-then-reinsert shape as `tags`, so `createItem` and
  `updateItem` both get it for free.
- `updateItem` validates with `isValidChecklist` and throws
  `InputError` on a malformed or oversized list, then diffs
  `JSON.stringify(normalized)` against the item's current checklist —
  compared in order, since reordering is a real change — and pushes a
  `{ field: 'checklist', oldValue, newValue }` change entry. As with
  tags, no `patch` entry is written: the association write does the
  work. Mutability goes through the existing `requireMutableItem`, so
  externally managed and archived items reject checklist writes with no
  extra code.
- `copyItemsInto` re-links `item_checklist_items` through the existing
  `links()` helper, or board duplication silently drops checklists.
- Router: `PATCH /boards/:boardId/items/:itemId` and
  `POST /boards/:boardId/items` pass `checklist` through.

## Actions

- New `set-item-checklist` action taking
  `{ boardId, itemId, checklist: z.array(z.object({ text: z.string(),
  done: z.boolean() })) }`, mirroring `set-item-tags`; list-valued
  fields get their own action rather than a key on `update-item`.
- `list-items` adds `checklist` to its output projection so automation
  can read progress without a second call.

## Frontend

- `ChecklistBadge` (`components/Checklist.tsx`), modelled on
  `DueDateBadge`: returns `null` when the checklist is empty, otherwise
  renders a `RiCheckboxLine` icon and `Text variant="body-x-small"`
  reading `1/3`, with `data-checklist-complete="true|false"` for tests
  and e2e. Complete lists use `var(--bui-fg-positive)`, partial ones the
  secondary foreground.
- Placement: the card's badge stack in `BoardView.tsx` (next to
  `DueDateBadge`), a non-sortable "Checklist" column in `TableView.tsx`,
  and the same column in `MyItemsPage.tsx` — the three places tags and
  due dates already appear together.
- `ChecklistField` in `ItemDrawerFields.tsx`, rendered between the
  description and the tags editor: one row per entry with a BUI
  `Checkbox`, an inline-editable text, and a remove `ButtonIcon`, plus
  an "Add item" input that appends on Enter. Every mutation rebuilds the
  whole array and calls `patchItem({ checklist })`, matching
  `TagsEditor`. Read-only users and externally managed items get the
  same list without controls.
- No quick menu on the card: unlike a due date there is no small set of
  useful presets, and ticking entries needs the text in view.
- `changeSummary` in `common.tsx` special-cases `field === 'checklist'`
  to read `checklist: 1/3 done` instead of dumping two JSON arrays.

## Testing

- Unit: `checklist.test.ts` for normalization (trimming, empty drop,
  order preserved), validation limits, and progress counting;
  `Checklist.test.tsx` for the badge (hidden when empty, `1/3`, complete
  styling).
- Service: set a checklist, tick one entry, clear with `[]`, assert the
  `checklist` change entries, reject an oversized list and a non-string
  text, and assert a duplicated board carries checklists over. Add
  `item_checklist_items` to the migrations table assertion.
- Playwright: add two entries in the drawer, tick one, and assert the
  card badge reads `1/2`.
