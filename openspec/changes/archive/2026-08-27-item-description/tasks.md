## 1. Backend

- [x] 1.1 Add migration (items.description + item_description_versions), extend `updateItem` with versioned description handling and change record, add versions endpoint and query; unit tests for version retention, unchanged skip, external-item rejection
- [x] 1.2 Extend common types (`BoardItem.description`, `descriptionVersionCount`, `ItemUpdate.description`) and the `update-item` action schema; test action parity

## 2. Frontend

- [x] 2.1 Extract shared `EditableMarkdown` from `CommentBlock` and reuse it for both comments and the new description section in the drawer; verify comments still edit with history
- [x] 2.2 Description section in drawer: render markdown, edit for writers, read-only for readers/external items, history toggle; verify via UI smoke

## 3. Verification

- [x] 3.1 tsc, lint, tests green; Playwright smoke: add + edit description, history shows both versions, timeline notes the change
