import type { KeyboardEvent } from 'react';
import {
  BoardColumn,
  BoardItem,
  BoardPriority,
} from '@internal/plugin-boards-common';
import type { ItemActions } from './ItemMenu';
import type { ItemSubmenuKind } from './RowMenu';
import type { SelectionHandle } from './useItemSelection';

/** What a shortcut opens: the full item menu or one of its submenus. */
export type ItemMenuRequest = ItemSubmenuKind | 'menu';

/**
 * Everything the focused-item shortcuts act through. Board cards and
 * table rows build one of these per item, so both views share the exact
 * same key handling.
 */
export interface ItemShortcutContext {
  /** The board's columns in display order — Ctrl+Arrow moves along them. */
  columns: BoardColumn[];
  priorities: BoardPriority[];
  /** Read-only surface or externally managed item: mutations stay inert. */
  readonly: boolean;
  actions: ItemActions;
  selection?: SelectionHandle;
  openMenu: (kind: ItemMenuRequest) => void;
  /** Runs before Delete archives, so the view can pick a focus successor. */
  onBeforeArchive?: () => void;
  /** Runs when a Ctrl+Arrow move was issued, so the view can re-focus. */
  onAfterMove?: () => void;
}

/**
 * The keyboard actions on a focused item (board card or table row):
 * Ctrl+Left/Right moves the item one column, Space toggles the bulk
 * selection, Enter opens the item menu, s/c/m/a/d/p open its submenus,
 * digits set the priority with that order (0 = 10), Delete archives.
 * Arrow navigation stays with the views, which call this first.
 *
 * Returns true when the event was handled (and its default prevented).
 * Callers MUST only invoke this while the item element itself is the
 * event target — keys typed into a child editor or an open menu must
 * never reach the shortcuts. The board view checks the card element,
 * the table view the row element, before calling.
 */
export function handleItemShortcut(
  event: KeyboardEvent<HTMLElement>,
  item: BoardItem,
  ctx: ItemShortcutContext,
): boolean {
  const handled = () => {
    event.preventDefault();
    event.stopPropagation();
    return true;
  };
  const ctrlOnly =
    event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
  const plain =
    !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;

  if (ctrlOnly && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    if (!ctx.readonly) {
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const index = ctx.columns.findIndex(
        column => column.id === item.columnId,
      );
      const target = index >= 0 ? ctx.columns[index + delta] : undefined;
      if (target) {
        // no position: the item lands at the end of the target column
        ctx.actions.moveItem(item.id, { columnId: target.id });
        ctx.onAfterMove?.();
      }
    }
    // swallowed even at the edges, so the browser never navigates
    return handled();
  }
  if (!plain) {
    return false;
  }
  switch (event.key) {
    case ' ':
      if (!ctx.readonly) {
        ctx.selection?.toggleItem(item.id);
      }
      // always ours: Space must never scroll while an item is focused
      return handled();
    case 'Enter':
      // the menu itself offers what the access level allows
      ctx.openMenu('menu');
      return handled();
    case 'Delete':
      if (ctx.readonly) {
        return false;
      }
      ctx.onBeforeArchive?.();
      ctx.actions.deleteItem(item.id);
      return handled();
    case 's':
    case 'c':
    case 'm':
      if (ctx.readonly) {
        return false;
      }
      ctx.openMenu('move');
      return handled();
    case 'a':
      if (ctx.readonly) {
        return false;
      }
      ctx.openMenu('assignee');
      return handled();
    case 'd':
      if (ctx.readonly) {
        return false;
      }
      ctx.openMenu('due');
      return handled();
    case 'p':
      if (ctx.readonly || ctx.priorities.length === 0) {
        return false;
      }
      ctx.openMenu('priority');
      return handled();
    default: {
      if (!/^[0-9]$/.test(event.key)) {
        return false;
      }
      if (ctx.readonly || ctx.priorities.length === 0) {
        return false;
      }
      const order = event.key === '0' ? 10 : Number(event.key);
      const priority = ctx.priorities.find(entry => entry.order === order);
      if (priority && item.priorityId !== priority.id) {
        ctx.actions.setItemPriority(item.id, priority.id);
      }
      // a digit without a matching priority deliberately does nothing
      return handled();
    }
  }
}
