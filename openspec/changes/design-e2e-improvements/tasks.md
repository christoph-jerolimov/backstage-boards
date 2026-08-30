# Tasks

## 1. Layout fixes (no spec delta)

- [ ] 1.1 Make the board content padding in `BoardPage.tsx`'s content wrapper (`padding: 16`, incl. the loading state) conditional on `!embedded`, and verify the standalone board page keeps its padding while `EntityBoardsContent` renders flush (unit tests still pass, manual/screenshot check of the catalog tab).
- [ ] 1.2 Remove the `style={{ width: '800px', maxWidth: '95%' }}` from the create-board dialog in `BoardListPage.tsx` and verify the dialog opens at default width with the name field intact (existing BoardListPage tests pass).

## 2. Home widgets

- [ ] 2.1 Left-align row content in `BoardsWidget.tsx` and `AssignedItemsWidget.tsx` (per design decision 3: `align="start"` on the row containers, buttons no longer stretching/centering their labels) and verify via updated widget unit tests/rendered output that titles start at the leading edge.
- [ ] 2.2 Flip the `showCounts` default to on in `BoardsWidget.tsx` (destructuring default) and the widget settings schema in `plugin.tsx`, updating `BoardsWidget.test.tsx` and `plugin.test.tsx` expectations; verify tests cover "never configured → counts shown" and "explicit off → no counts requested".

## 3. Markdown bare-URL autolinking

- [ ] 3.1 Add a bare `http(s)://` URL pass to the inline tokenizer in `markdown.ts` emitting the existing `link` token (trailing-punctuation trimming per design decision 5), without touching mention/entity-ref scanning.
- [ ] 3.2 Update `markdown.test.ts`: replace the "bare URL stays plain text" expectation with link cases (bare URL linked, trailing punctuation trimmed, URL in inline code stays plain, markdown-form link unchanged, URL not parsed as entity ref) and verify `yarn workspace @internal/plugin-boards test markdown` (or repo equivalent) passes.

## 4. Column menu into the actions header

- [ ] 4.1 Render `ColumnsMenu` in the trailing actions column header of `ItemsTable` (`TableView.tsx`), remove the above-table `columnsMenu` block, and verify the board table view shows the configure-columns button in the header and no floating control (component tests updated).
- [ ] 4.2 Do the same for the my-items tables in `MyItemsPage.tsx` (menu out of the toolbar, into each table's actions header driving the shared `'my-items'` column set) and verify column toggling still persists across reload per existing tests.

## 5. e2e seed data and baselines

- [ ] 5.1 Extend the "Design login flow" seed description in `plugins/boards/e2e-tests/screenshots.test.ts` with an `@component:default/example-website` mention and a bare `https://` URL, and assert in the drawer test that both render as links.
- [ ] 5.2 Run the full unit test suite and lint (`yarn test`, `yarn lint:all`, `yarn tsc`) and verify green.
- [ ] 5.3 Regenerate affected screenshot baselines (light and dark) with the screenshot e2e project `--update-snapshots`, eyeball `catalog-tab.png`, `create-board.png`, `home.png`, `item-drawer.png`, and the table-view/my-items shots for the intended changes (no double padding, narrower dialog, left-aligned widgets with counts, mention+URL links, header menu button), and verify a subsequent plain e2e run passes.
