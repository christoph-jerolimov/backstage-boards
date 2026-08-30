## Why

Items have markdown descriptions with retained version history; boards
have only a name. Boards shared across teams badly need a place to say
"what this board is for, how we use the columns" — right under the
board header, where every visitor sees it.

## What Changes

- Boards gain an optional **markdown description** shown under the board
  header, rendered like item descriptions.
- Users with write access can edit it in place, reusing the shared
  `EditableMarkdown` block: markdown editing, cleared by saving empty
  text, and retained version history with author and timestamp once the
  description has been edited more than once.
- The description is stored server-side with a version row per edit,
  exposed through the board payload and a versions endpoint.
- Duplicating a board copies the current description text (not its
  history) to the copy, and copied columns now keep their WIP limits
  alongside their colors.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/board-management`: new "Board description" requirement; the
  "Duplicate a board" requirement's copy now includes the description.

## Impact

- `plugins/boards-common` — `description` / `descriptionVersionCount`
  on the board payload, `description` on the update type.
- `plugins/boards-backend` — migration (`boards.description` +
  `board_description_versions`), service methods, two routes.
- `plugins/boards` — description block in the board page under the
  header, API client methods.
- Docs: board features in README and `docs/features/board.md`.
