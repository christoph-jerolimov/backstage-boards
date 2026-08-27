# Submenu Menu Placement

## Why

Menus that contain submenu items open below their trigger, so the
flyout submenus can collide with the viewport edge and cover the menu.
Opening such menus to the right-top keeps the submenu chain readable.

## What Changes

- All menus containing submenu items get `placement="right top"`: the
  shared item menu and the column menu.

## Impact

- `plugins/boards`: `ItemMenu.tsx`, column menu in `KanbanView.tsx`.
