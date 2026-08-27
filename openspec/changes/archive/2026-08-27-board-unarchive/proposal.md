# Unarchive Boards

## Why

Archiving is meant as a safety net, but there is no way back short of
waiting for support: the archived alert only offers permanent deletion.

## What Changes

- Admins can unarchive an archived board: a new "Unarchive" button in
  the archived alert (before "Delete now") restores the board to its
  normal listed, writable state.
- Backend: `POST /boards/:boardId/unarchive` and
  `BoardsService.unarchiveBoard` (admin only, archived boards only).

## Impact

- `boards-backend`: service method, route, tests.
- `plugins/boards`: API client method, alert button.
