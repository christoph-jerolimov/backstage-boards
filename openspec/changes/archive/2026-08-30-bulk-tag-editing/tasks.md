## 1. Bulk tags menu

- [x] 1.1 Add a `tagPool` prop to `BulkActionsBar` and render a Tags
      menu (between Due date and Archive) listing the pool
      alphabetically with ✓/– markers from `stateOf`; verify via
      component render in existing test file setup.
- [x] 1.2 Implement the toggle action (add to items missing the tag;
      remove everywhere when all have it) and "Remove all tags" via
      `bulk.updateItems`; verify with unit tests covering mixed and
      uniform selections.
- [x] 1.3 Implement "Add tag…" with an inline input, normalizing via
      `normalizeTags` and applying to all selected items; verify with a
      unit test typing a new tag.
- [x] 1.4 Pass `filter.allTags` from `BoardPage` to the bar; verify the
      board page test suite still passes.

## 2. Tests and docs

- [x] 2.1 Extend `BulkActionsBar` tests (or table view tests) with the
      new scenarios from the spec delta and verify `yarn test
      plugins/boards` passes.
- [x] 2.2 Update the README bulk-actions feature bullet to mention tags
      and verify the wording matches the shipped behavior.
