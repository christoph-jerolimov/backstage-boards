# Design: Add Item Checklist

## Context

See `proposal.md` — Why. The boards plugin already has a well-worn pattern for optional item attributes stored in child tables and hydrated onto `BoardItem`: `item_assignees` and `item_tags` are written wholesale on update via `writeAssociations`, surfaced through `ItemUpdate`, recorded in change history, and copied by `copyItemsInto` during board duplication. `item-priorities` is the closest precedent for "optional attribute + card badge". The checklist follows the same rails; the only new twist is that entries carry two values (text + done) and order matters.

## Goals / Non-Goals

**Goals:**

- Checklist as a first-class item field on the existing item endpoints — no new REST routes, no new API client methods.
- Reuse the existing hydration, association-write, change-history, signal, and duplication mechanics.
- Keep the card badge cheap: computed from data already on `BoardItem`, no extra queries.

**Non-Goals:**

- Drag-and-drop reordering of entries (order is insertion order; edits preserve it).
- Per-entry metadata (assignees, due dates), entry→item conversion, multiple named checklists.
- Exposing the checklist through the agent actions surface (`actions.ts`) — can be a follow-up change.
- A dedicated "toggle one entry" endpoint; toggling PATCHes the whole list (see Decisions).

## Decisions

### 1. Wire shape: `ChecklistEntry { text: string; checked: boolean }[]`, replaced wholesale

`BoardItem.checklist?: ChecklistEntry[]` (hydrated as `[]`-or-entries like `tags`), and `NewItem.checklist?` / `ItemUpdate.checklist?` accept the full list, which replaces the stored one — exactly the tags/assignees contract. Array index is the order; no client-visible entry ids.

- *Why not entry ids + granular add/toggle/remove endpoints?* Checklists are small (a handful of strings, per the request). Wholesale replace keeps the router allowlist, client, and optimistic-update story identical to tags, and avoids id-generation and conflict semantics. React keys can use index (list is small and replaced atomically on save).
- *Why not a JSON column on `items`?* A child table matches every other multi-valued item attribute here, keeps migrations symmetric (`down` drops the table), and stays queryable if we ever want counts server-side.

### 2. Storage: new `item_checklist_entries` table

`item_checklist_entries(item_id → items.id ON DELETE CASCADE, position integer, text, checked boolean)`, primary key `(item_id, position)`. Written delete-then-insert inside the same transaction as the item patch (a two-column variant of `writeAssociations`; a small dedicated helper `writeChecklist` is fine since `writeAssociations` is single-column). Hydration joins in `hydrateItems` alongside tags/assignees, ordered by `position`. Migration appended to `migrations` in `migrations.ts` (name `20260828_02_item_checklists` following the existing convention) plus a `ChecklistEntryRow` type and `Tables` registry entry in `tables.ts`.

### 3. Validation and history in `BoardsService.updateItem` / `createItem`

- Reject entries with empty/whitespace-only `text` (trim before store) with the same input-error type used for other field validation; router adds `checklist` to the explicit body allowlists of `POST /boards/:boardId/items` and `PATCH .../items/:itemId`.
- `updateItem` records one change record with field `checklist`, old/new values serialized like tags are today (JSON of the entry list), then emits the existing board signal and watcher notifications — no new machinery.
- `requireMutableItem` already blocks externally managed and archived items; nothing extra needed.
- `copyItemsInto` copies `item_checklist_entries` rows the same way it copies `item_tags`.

### 4. Frontend: `ChecklistEditor` in the drawer, badge in `ItemCard`

- New `ChecklistEditor` component (modeled on `TagsEditor.tsx`): renders MUI checkboxes + labels, an inline "add entry" input, per-entry edit/remove; calls `onChange(next)` → `patchItem({ checklist })` in `ItemDrawer.tsx` under a `DrawerField label="Checklist"`. Readonly mode renders disabled checkboxes and no add/remove affordances (`readonly` is already derived in the drawer).
- `ItemCard` in `BoardView.tsx` computes `done/total` from `item.checklist` and renders a small chip next to `PriorityChip`/`DueDateBadge` when `total > 0`; "complete" styling (e.g. success color) when `done === total`. Purely presentational — no new queries or props plumbing beyond the field already on `BoardItem`.
- Test fixtures: `testItem` in `testHelpers.tsx` gains `checklist: []`; `testBoardsApi()` unchanged (no new methods).

### 5. Toggling from the drawer saves via the normal PATCH

Ticking a checkbox in the drawer issues `patchItem({ checklist: next })` and relies on the existing `changed()` invalidation; no optimistic mutation added initially. If checkbox latency feels bad in practice, wrap it with `useOptimisticItemMutation` later — that is an implementation refinement, not a contract change.

## Risks / Trade-offs

- [Wholesale replace can lose a concurrent edit (last write wins)] → Same semantics as tags/assignees today; checklists are small and single-editor in practice. Acceptable; granular endpoints remain possible later without breaking the wire shape.
- [Change history stores the full list as old/new JSON, so a single toggle produces a verbose diff] → Matches how tags render today; the history UI already renders such values. If it reads poorly, a nicer renderer for the `checklist` field is a UI-only follow-up.
- [Hydrating checklists for every board load adds one batched query per item-list fetch] → Same cost profile as tags/assignees hydration, batched by item ids in `hydrateItems`; negligible.
- [Index-as-key in the editor could misbehave with rapid edits] → List is replaced atomically per save and is small; if it becomes an issue, generate ephemeral client-side keys inside `ChecklistEditor` only.

## Migration Plan

Additive only: run the new migration (creates the empty child table), deploy backend then frontend in any order — old frontends ignore the new field; old backends never receive `checklist` because the router allowlist gates it. Rollback = migration `down` (drops the table); no data transformation of existing items.
