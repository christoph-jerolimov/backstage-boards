# Playwright E2E for Drag Gestures

## Why

The kanban drag & drop is the one interaction never exercised by automated tests — moves were only verified through the menu fallback and the API. A real browser drag test protects the gesture against regressions.

## What Changes

- New `plugins/boards/e2e-tests/board-drag.test.ts` picked up by the existing root Playwright config (per-package project discovery, reusing the dev servers).
- Tests: dragging a card to another column persists the move (survives reload), dropping a card onto another card inserts it before that card, and the accessible "Move to column" menu fallback still works.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

<!-- none — test-only change, no spec-level behavior changes -->

## Impact

- `plugins/boards`: new e2e test folder; no production code changes.
