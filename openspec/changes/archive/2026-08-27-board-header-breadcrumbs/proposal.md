# Board Page Header Breadcrumbs

## Why

The board page navigates back through a custom "← Boards" button while the app's plugin header supports proper breadcrumbs; using the platform mechanism gives consistent navigation.

## What Changes

- The board page registers breadcrumb entries ("Boards" → list page, board name → itself) via the new frontend system's `BreadcrumbEntry`, which the app shell's `PluginHeader` renders through its `breadcrumbs` prop.
- The custom "← Boards" back button is removed.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

<!-- none — navigation presentation, no spec-level behavior changes (skip_specs) -->

## Impact

- `plugins/boards/src/components/BoardPage.tsx` only.
