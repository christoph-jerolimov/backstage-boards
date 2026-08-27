# Design

## Context

See proposal. The root Playwright config discovers `e2e-tests` folders in all packages (`generateProjects()`), reuses running dev servers, and targets the guest-auth app at `localhost:3000`.

## Goals / Non-Goals

**Goals:** real-browser coverage of the drag gesture (cross-column, insert-before) and the menu fallback.
**Non-Goals:** CI wiring changes; keyboard-only drag coverage (the menu fallback is the accessible path and is covered).

## Decisions

- Tests seed their own board via the REST API using a guest token from `/api/auth/guest/refresh` (unique board name per run), so they are independent of existing data.
- Dragging uses Playwright's `locator.dragTo`, which drives the HTML5 drag events react-aria's `useDrag` listens to; persistence is asserted by reloading the page after the drop.
- Card locators use the stable `aria-label` (item title) and lane assertions use the `"<column> (n)"` header counts.

## Risks / Trade-offs

- [E2e depends on running dev servers] → the existing config already starts/reuses them (`webServer`), matching the repo's e2e setup.
