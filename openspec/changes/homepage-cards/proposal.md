## Why

The boards plugin is only reachable by navigating to `/boards`. Everything
a user actually needs at a glance — what is assigned to them, what is
overdue, which boards they care about — is two clicks away behind a page
they have to remember to visit. Backstage's home page is where users
already start their day, and the app in this repository already renders a
widget grid (`packages/app/src/modules/home`), but the boards plugin
contributes nothing to it.

## What Changes

- The boards frontend plugin exposes two homepage widgets through
  `HomePageWidgetBlueprint` (`@backstage/plugin-home-react/alpha`), so a
  user can add either card to their home page and configure it per card
  instance through the grid's built-in settings dialog.

- **"Assigned items"** — the current user's assigned items across every
  board they can read, with two settings:
  1. *Scope*: **all** assigned items, or only items that are **due** —
     due date today or in the past. Items with no due date are not "due"
     and are hidden in that mode.
  2. *Group by*: **board**, **status**, or **due date**.

- **"Boards"** — the boards the user can reach, with two settings:
  1. *Scope*: **favorites** only, or **all** accessible boards.
  2. *Show counts*: when on, each board row shows the number of items per
     status (per column), using the board's column colors.

- To make the counts affordable from a homepage card, `GET /boards` gains
  an opt-in `counts=true` mode that returns each board's columns with
  their item counts in the same response. Without it the widget would
  need one extra request per board on every home page load.

- Both widgets link into the existing boards pages rather than
  reimplementing item or board interaction: a click opens the item on its
  board, or opens the board.

## Capabilities

### New Capabilities

- `boards/homepage-widgets`: the two home page cards the plugin
  contributes, their per-instance settings, the content each renders, and
  their empty/error/loading behavior.

### Modified Capabilities

- `boards/board-management`: the board listing gains an opt-in mode that
  returns per-status (per-column) item counts alongside each board.

## Impact

- **`boards-common`**: `BoardStatusCount` type; `BoardListEntry` gains an
  optional `statusCounts` field (additive, no breaking change).
- **`boards-backend`**: `listBoards` accepts `withCounts`; one grouped
  count query over the boards the caller may read; `GET /boards` reads
  `?counts=true`. Existing callers are unaffected — the field is absent
  unless asked for.
- **`boards`** (frontend): two new extensions in `plugin.tsx`, two new
  widget components, `boardsApi.listBoards` gains a `withCounts` option,
  and a new dependency on `@backstage/plugin-home-react` (already a
  dependency of `packages/app`).
- **`packages/app` / `app-config.yaml`**: no code change — widgets are
  discovered through the plugin and users can add them from the home
  page's "Add widget" dialog. The demo app's `page:home` `defaultConfig`
  gains both cards so they are visible out of the box and reachable from
  an end-to-end test.
- **No change** to the existing `/boards` pages, the entity tab, or any
  permission behavior: both widgets read through endpoints that already
  enforce access.
