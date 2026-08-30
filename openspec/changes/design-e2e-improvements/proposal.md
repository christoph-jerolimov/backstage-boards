# Design & e2e improvements

## Why

A design pass over the current screenshots surfaced six small but visible UI issues — double padding on the catalog Boards tab, an oversized create-board dialog, centered home-widget rows, item counts hidden by default on the Boards widget, and a column-configure button floating outside the table it configures — plus an e2e/demo gap: the item-drawer example never shows an `@` catalog reference or an `https://` link, so the screenshots don't demonstrate that linking works (and bare web URLs in fact don't link today).

## What Changes

- The catalog "Boards" tab renders the embedded board flush inside the catalog page's own content area, without the board page's extra `padding: 16` wrapper (fixes the doubled margin seen in `catalog-tab.png`).
- The create-board dialog drops its forced `width: 800px` and uses the default dialog width — it only holds a single name field.
- Both home widgets (Boards, Assigned items) left-align their row content instead of rendering full-width buttons with centered labels.
- The Boards home widget shows per-status item counts by default — the existing `showCounts` setting flips its default from off to on.
- The comment/description markdown subset auto-links bare `http(s)://` URLs, alongside the existing markdown-form links, entity refs, and `@`-mentions.
- The e2e screenshot seed data gives the drawer example item a description containing an `@` catalog entity reference and an `https://` link, so `item-drawer.png` demonstrates both render as links.
- The column-configure menu button moves from above the board table view / the my-items toolbar into the trailing actions column header of the table itself, which is currently visually empty.
- Screenshot baselines under `docs/screenshots/{light,dark}` are regenerated for the affected pages.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `boards/homepage-widgets`: widget rows must render left-aligned (not stretched/centered), and the Boards widget item count setting's default changes from off to on.
- `boards/comments-and-history`: the rendered markdown subset additionally auto-links bare `http(s)://` URLs (descriptions inherit this via the shared subset).
- `boards/item-management`: the column show/hide menu of the board table view and the my-items listing is offered from the trailing actions column header instead of a control above the table.

The catalog-tab padding and create-board dialog width are presentational-only fixes with no requirement-level behavior change, so they carry no spec delta; likewise the e2e seed-data update is test tooling.

## Impact

- `plugins/boards/src/components/BoardPage.tsx` — embedded rendering without extra padding.
- `plugins/boards/src/components/BoardListPage.tsx` — create-dialog width.
- `plugins/boards/src/components/BoardsWidget.tsx`, `AssignedItemsWidget.tsx`, `plugin.tsx` — widget alignment and `showCounts` default (runtime default and settings schema).
- `plugins/boards/src/components/markdown.ts` (+ `markdown.test.ts`, `common.tsx` renderer) — bare-URL autolinking.
- `plugins/boards/src/components/tableColumns.tsx`, `TableView.tsx`, `MyItemsPage.tsx` — `ColumnsMenu` placement in the actions column header.
- `plugins/boards/e2e-tests/screenshots.test.ts` — seed description with mention + URL; regenerated baselines in `docs/screenshots/`.
- Unit tests touching defaults/placement: `BoardsWidget.test.tsx`, `plugin.test.tsx`, `markdown.test.ts`, table-related tests.
- No backend, API, or storage changes.
