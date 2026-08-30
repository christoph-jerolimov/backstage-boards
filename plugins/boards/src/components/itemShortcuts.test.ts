import type { KeyboardEvent } from 'react';
import {
  handleItemShortcut,
  ItemShortcutContext,
  ItemMenuRequest,
} from './itemShortcuts';
import {
  testActions,
  testColumn,
  testItem,
  testPriorities,
} from './__testUtils__/testHelpers';

const columns = [
  testColumn({ id: 'column-1', title: 'Todo', position: 1000 }),
  testColumn({ id: 'column-2', title: 'Doing', position: 2000 }),
  testColumn({ id: 'column-3', title: 'Done', position: 3000 }),
];

function keyEvent(
  key: string,
  mods: Partial<
    Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>
  > = {},
) {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...mods,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  } as unknown as KeyboardEvent<HTMLElement> & {
    preventDefault: jest.Mock;
  };
}

function makeCtx(over: Partial<ItemShortcutContext> = {}) {
  const openedMenus: ItemMenuRequest[] = [];
  const ctx: ItemShortcutContext = {
    columns,
    priorities: testPriorities(),
    readonly: false,
    actions: testActions(),
    selection: {
      selected: new Set<string>(),
      toggleItem: jest.fn(),
      setMany: jest.fn(),
      clear: jest.fn(),
    },
    openMenu: kind => openedMenus.push(kind),
    ...over,
  };
  return { ctx, openedMenus };
}

const item = testItem({ id: 'item-1', columnId: 'column-2' });

describe('handleItemShortcut', () => {
  it('moves the item one column with Ctrl+Arrow and reports the move', () => {
    const onAfterMove = jest.fn();
    const { ctx } = makeCtx({ onAfterMove });
    const event = keyEvent('ArrowRight', { ctrlKey: true });
    expect(handleItemShortcut(event, item, ctx)).toBe(true);
    expect(ctx.actions.moveItem).toHaveBeenCalledWith('item-1', {
      columnId: 'column-3',
    });
    expect(onAfterMove).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();

    const left = keyEvent('ArrowLeft', { ctrlKey: true });
    expect(handleItemShortcut(left, item, ctx)).toBe(true);
    expect(ctx.actions.moveItem).toHaveBeenCalledWith('item-1', {
      columnId: 'column-1',
    });
  });

  it('swallows Ctrl+Arrow at the edge without moving', () => {
    const { ctx } = makeCtx();
    const edge = testItem({ id: 'item-1', columnId: 'column-3' });
    expect(
      handleItemShortcut(keyEvent('ArrowRight', { ctrlKey: true }), edge, ctx),
    ).toBe(true);
    expect(ctx.actions.moveItem).not.toHaveBeenCalled();
  });

  it('never moves a read-only item', () => {
    const { ctx } = makeCtx({ readonly: true });
    expect(
      handleItemShortcut(keyEvent('ArrowRight', { ctrlKey: true }), item, ctx),
    ).toBe(true);
    expect(ctx.actions.moveItem).not.toHaveBeenCalled();
  });

  it('ignores Ctrl+Arrow with extra modifiers', () => {
    const { ctx } = makeCtx();
    const event = keyEvent('ArrowRight', { ctrlKey: true, shiftKey: true });
    expect(handleItemShortcut(event, item, ctx)).toBe(false);
    expect(ctx.actions.moveItem).not.toHaveBeenCalled();
  });

  it('toggles the selection with Space, and swallows it read-only', () => {
    const { ctx } = makeCtx();
    expect(handleItemShortcut(keyEvent(' '), item, ctx)).toBe(true);
    expect(ctx.selection!.toggleItem).toHaveBeenCalledWith('item-1');

    const { ctx: readonlyCtx } = makeCtx({ readonly: true });
    // handled (no page scroll) but no selection change
    expect(handleItemShortcut(keyEvent(' '), item, readonlyCtx)).toBe(true);
    expect(readonlyCtx.selection!.toggleItem).not.toHaveBeenCalled();
  });

  it('opens the item menu with Enter', () => {
    const { ctx, openedMenus } = makeCtx();
    expect(handleItemShortcut(keyEvent('Enter'), item, ctx)).toBe(true);
    expect(openedMenus).toEqual(['menu']);
  });

  it('opens the pickers with s/c/m, a, d, and p', () => {
    const { ctx, openedMenus } = makeCtx();
    for (const key of ['s', 'c', 'm', 'a', 'd', 'p']) {
      expect(handleItemShortcut(keyEvent(key), item, ctx)).toBe(true);
    }
    expect(openedMenus).toEqual([
      'move',
      'move',
      'move',
      'assignee',
      'due',
      'priority',
    ]);
  });

  it('opens no mutation menu read-only or without priorities', () => {
    const { ctx, openedMenus } = makeCtx({ readonly: true });
    for (const key of ['s', 'a', 'd', 'p']) {
      expect(handleItemShortcut(keyEvent(key), item, ctx)).toBe(false);
    }
    expect(openedMenus).toEqual([]);

    const { ctx: noPrio, openedMenus: opened } = makeCtx({ priorities: [] });
    expect(handleItemShortcut(keyEvent('p'), item, noPrio)).toBe(false);
    expect(opened).toEqual([]);
  });

  it('ignores letters with a modifier held', () => {
    const { ctx, openedMenus } = makeCtx();
    expect(
      handleItemShortcut(keyEvent('s', { ctrlKey: true }), item, ctx),
    ).toBe(false);
    expect(
      handleItemShortcut(keyEvent('a', { shiftKey: true }), item, ctx),
    ).toBe(false);
    expect(openedMenus).toEqual([]);
  });

  it('sets the priority with that order on a digit, 0 meaning 10', () => {
    const { ctx } = makeCtx();
    expect(handleItemShortcut(keyEvent('2'), item, ctx)).toBe(true);
    expect(ctx.actions.setItemPriority).toHaveBeenCalledWith(
      'item-1',
      'priority-2',
    );

    // no priority with order 7 or 10 on this board: handled, no change
    (ctx.actions.setItemPriority as jest.Mock).mockClear();
    expect(handleItemShortcut(keyEvent('7'), item, ctx)).toBe(true);
    expect(handleItemShortcut(keyEvent('0'), item, ctx)).toBe(true);
    expect(ctx.actions.setItemPriority).not.toHaveBeenCalled();
  });

  it('skips the priority call when the item already has it', () => {
    const { ctx } = makeCtx();
    const prioritized = testItem({ id: 'item-1', priorityId: 'priority-3' });
    expect(handleItemShortcut(keyEvent('3'), prioritized, ctx)).toBe(true);
    expect(ctx.actions.setItemPriority).not.toHaveBeenCalled();
  });

  it('does nothing on digits read-only or without priorities', () => {
    const { ctx } = makeCtx({ readonly: true });
    expect(handleItemShortcut(keyEvent('1'), item, ctx)).toBe(false);
    const { ctx: noPrio } = makeCtx({ priorities: [] });
    expect(handleItemShortcut(keyEvent('1'), item, noPrio)).toBe(false);
    expect(noPrio.actions.setItemPriority).not.toHaveBeenCalled();
  });

  it('archives with Delete, announcing it first for the focus successor', () => {
    const calls: string[] = [];
    const { ctx } = makeCtx({
      onBeforeArchive: () => calls.push('before'),
    });
    (ctx.actions.deleteItem as jest.Mock).mockImplementation(async () => {
      calls.push('delete');
    });
    expect(handleItemShortcut(keyEvent('Delete'), item, ctx)).toBe(true);
    expect(calls).toEqual(['before', 'delete']);
    expect(ctx.actions.deleteItem).toHaveBeenCalledWith('item-1');
  });

  it('never archives read-only items', () => {
    const { ctx } = makeCtx({ readonly: true });
    expect(handleItemShortcut(keyEvent('Delete'), item, ctx)).toBe(false);
    expect(ctx.actions.deleteItem).not.toHaveBeenCalled();
  });

  it('leaves unrelated keys alone', () => {
    const { ctx, openedMenus } = makeCtx();
    for (const key of ['x', 'Escape', 'Tab', 'ArrowDown', 'F2']) {
      expect(handleItemShortcut(keyEvent(key), item, ctx)).toBe(false);
    }
    expect(openedMenus).toEqual([]);
  });
});
