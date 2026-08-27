# Duplicate Board

## Why

Teams often want a new board shaped like an existing one (same columns/colors, sometimes the same sharing) without rebuilding it by hand.

## What Changes

- New "Duplicate board…" entry in the board more menu opening a modal that asks for the new name and whether to copy the columns (with colors) and/or the share settings.
- Backend `duplicateBoard` creates the new board accordingly; items are never copied. The caller becomes admin of the copy; share settings can only be copied by admins of the source board.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/board-management`: boards can be duplicated with optional column and permission copying.

## Impact

- `plugins/boards-backend`: `duplicateBoard` service method + route + tests.
- `plugins/boards`: `DuplicateBoardDialog` + more-menu entry, API client method.
