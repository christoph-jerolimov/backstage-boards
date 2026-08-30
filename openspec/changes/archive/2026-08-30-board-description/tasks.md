## 1. Backend

- [x] 1.1 Migration adding `boards.description` and
      `board_description_versions`, plus row/type updates; verify the
      migration test suite passes (update the rollback test to the new
      latest migration).
- [x] 1.2 `updateBoardDescription` (write access, version row per
      change, clear on empty) and `listBoardDescriptionVersions`
      (read access) with routes; verify with service tests for edit,
      clear, history, and read-only rejection.
- [x] 1.3 Copy the description text (one version, duplicator-attributed)
      in `duplicateBoard`; verify with a duplicate service test.

## 2. Frontend

- [x] 2.1 API client methods and board payload types; verify `tsc`.
- [x] 2.2 Render `EditableMarkdown` under the board header (writers
      edit, readers render-only, hidden when empty for readers); verify
      with BoardPage tests for writer edit, reader render, and empty
      board.

## 3. Docs

- [x] 3.1 Update README boards section and `docs/features/board.md`
      (and duplicate docs mention) and verify wording matches.
