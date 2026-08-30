# Design

## Context

See proposal.md for motivation. Current state, per code inspection:

- `BoardPage.tsx:309` wraps the board content in `<Flex direction="column" gap="3" style={{ padding: 16 }}>`; the `embedded` prop (used by `EntityBoardsContent.tsx`) only skips the breadcrumb wrapper, not the padding, so the catalog tab stacks the catalog page's own content padding on top of it.
- `BoardListPage.tsx:372-376` gives the create-board dialog `style={{ width: '800px', maxWidth: '95%' }}` although its body is a single name field.
- `BoardsWidget.tsx` (`BoardRow`, list at line 113) and `AssignedItemsWidget.tsx` (`ItemRow`, list at line 142) render each row as a BUI `Button variant="tertiary"` that stretches to full card width under the column-flex default `align-items: stretch`, and the button centers its label — hence the "centered" look. The empty state already uses `align="start"` (`BoardsWidget.tsx:95`).
- The Boards widget count option is `showCounts`: runtime default `showCounts = false` at `BoardsWidget.tsx:68`, schema default `false` at `plugin.tsx:139-143`.
- Markdown rendering: `markdown.ts` tokenizes markdown-form links only (`[label](https://…)`, line 103); `mentions.ts` (boards-common) already excludes `http`/`https`/`mailto` from entity-mention kinds. Bare URLs render as plain text (asserted in `markdown.test.ts:75-77`). Inline rendering happens in `common.tsx` `InlineTokens` (`case 'link'` → `<a target="_blank" rel="noopener noreferrer">`).
- Column-select control: `ColumnsMenu` (`tableColumns.tsx:107`) renders above the table in `TableView.tsx:245-253/389` and in the my-items toolbar (`MyItemsPage.tsx:379-383`). All item tables end with a 56px utility column whose header holds only a `VisuallyHidden` "Actions" label (`TableView.tsx:161-163`, `MyItemsPage.tsx:224-226`).
- e2e drawer seed: `screenshots.test.ts:154-159` sets the "Design login flow" description; the seeded catalog entity is `component:default/example-website` (`ENTITY_REF`, line 41). Screenshot baselines live in `docs/screenshots/{light,dark}`.

## Goals / Non-Goals

**Goals:**

- Fix all six issues frontend-only; no backend, API, or storage changes.
- Keep screenshot baselines in sync with the new visuals.

**Non-Goals:**

- No redesign of the widgets beyond alignment (rows keep being activatable buttons unless a table turns out simpler — see Decisions).
- No change to entity-mention semantics or to the backend mention scanner; URL autolinking is render-side only.
- No column-select for the boards list table (its columns stay hardcoded).

## Decisions

1. **Catalog tab padding**: make the board page's outer `padding: 16` conditional on `!embedded` (and mirror for the loading state) rather than restyling `EntityBoardsContent`. Alternative — negative margins in the entity content — rejected as fragile. The multi-board `Tabs` case in `EntityBoardsContent` gets the same benefit automatically since it passes `embedded`.

2. **Create dialog width**: drop the inline `style` entirely so BUI's default dialog sizing applies, matching the other dialogs in the plugin (ShareDialog etc. pass no width). Alternative — a smaller fixed width — rejected: no other dialog hardcodes one.

3. **Widget alignment — fix alignment, don't switch to a table.** Set `align="start"` on the row containers (and stop the row buttons from stretching), so labels left-align while rows stay single activatable buttons with their existing keyboard/click behavior. The user floated "maybe use a table"; a table would complicate the Assigned items grouping headings and lose nothing we can't get from `align="start"`. If button hover affordance looks odd left-aligned, constrain the button to fit-content width — the hit target shrinks to the content, which matches how the widget headings behave.

4. **Counts default**: flip both defaults (`showCounts = true` destructuring default in `BoardsWidget.tsx`, `default: true` in the `plugin.tsx` settings schema) so stored-settings-empty and schema documentation agree. Existing users who explicitly turned the setting off keep their stored `false`.

5. **Bare-URL autolinking**: extend the inline tokenizer in `markdown.ts` with a bare-URL pass (`https?://` up to whitespace/closing punctuation, trimming trailing `.,;:)!?`) producing the existing `link` token type, so `InlineTokens` needs no new case. Run it after markdown-link and mention/entity scanning so it never splits an existing token; code spans already bypass inline tokenizing. Alternative — a full markdown library — out of scope for this subset renderer.

6. **ColumnsMenu placement**: render `<ColumnsMenu>` inside the actions `<Column>` header of `ItemsTable` (`TableView.tsx`) and the my-items table (`MyItemsPage.tsx`), replacing the `VisuallyHidden`-only header (keep an accessible name on the column via the button's own `aria-label`, and keep `utilityColumnStyle`'s 56px width — one icon button fits). Remove the old above-table/toolbar renderings. Where a view renders several stacked tables (my-items grouped by board), each table's header carries the menu; they all drive the same stored column set, which is consistent rather than confusing, and beats a special "first table only" rule.

7. **e2e drawer example**: extend the seeded description of "Design login flow" to include `@component:default/example-website` and a bare `https://` URL (e.g. `Follow-up notes at https://example.com/login-flow.`), demonstrating both the mention link and the new URL autolinking in `item-drawer.png`. Also extend `markdown.test.ts` for the new URL cases.

8. **Baselines**: regenerate only the affected screenshots (`catalog-tab.png`, `create-board.png`, `home.png`, `item-drawer.png`, and the table-view/my-items shots that show the moved menu) via the screenshot projects with `--update-snapshots`, light and dark.

## Risks / Trade-offs

- [Removing embedded padding could leave the board flush against tab edges if the catalog page padding differs across Backstage versions] → visually verified via the `catalog-tab.png` screenshot test in both themes.
- [URL trailing-punctuation trimming can misjudge unusual URLs (e.g. ending in `)`)] → accept the common-case heuristic; markdown-form links remain the escape hatch and the tests document the behavior.
- [Flipping `showCounts` default turns on extra count queries for existing widget placements] → counts come from the existing `withCounts` listing parameter, one request as before; users can still turn it off per card.
- [Moving ColumnsMenu into a header cell may affect table semantics/a11y] → the actions column header gains a real, labelled control ("Configure columns"), which screen readers announce; keyboard reach is verified in existing table tests.
