import type { KeyboardEvent } from 'react';
import { screen } from '@testing-library/react';
import {
  ITEM_SHORTCUT_ROWS,
  NAVIGATION_SHORTCUT_ROWS,
  ShortcutHelpDialog,
  visibleShortcutRows,
} from './ShortcutHelpDialog';
import { handleItemShortcut, ItemShortcutContext } from './itemShortcuts';
import {
  renderWithProviders,
  testActions,
  testColumn,
  testItem,
  testPriorities,
} from './__testUtils__/testHelpers';

function renderDialog(
  over: Partial<{ canWrite: boolean; hasPriorities: boolean }> = {},
) {
  renderWithProviders(
    <ShortcutHelpDialog
      open
      onClose={jest.fn()}
      canWrite={over.canWrite ?? true}
      hasPriorities={over.hasPriorities ?? true}
    />,
  );
}

describe('ShortcutHelpDialog', () => {
  it('lists every shortcut for a writer on a board with priorities', () => {
    renderDialog();
    expect(
      screen.getByRole('heading', { name: 'Keyboard shortcuts' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Navigate')).toBeInTheDocument();
    expect(screen.getByText('Focused item')).toBeInTheDocument();
    for (const row of [...NAVIGATION_SHORTCUT_ROWS, ...ITEM_SHORTCUT_ROWS]) {
      expect(screen.getByText(row.description)).toBeInTheDocument();
    }
    // spot-check the key badges render
    expect(screen.getByText('Alt+→')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('hides the mutating rows from read-only visitors', () => {
    renderDialog({ canWrite: false });
    // navigation always stays
    for (const row of NAVIGATION_SHORTCUT_ROWS) {
      expect(screen.getByText(row.description)).toBeInTheDocument();
    }
    // Enter (open the menu) works for readers and stays
    expect(
      screen.getByText("Open the item's actions menu"),
    ).toBeInTheDocument();
    for (const row of ITEM_SHORTCUT_ROWS.filter(entry => entry.needsWrite)) {
      expect(screen.queryByText(row.description)).not.toBeInTheDocument();
    }
  });

  it('hides the priority rows on a board without priorities', () => {
    renderDialog({ hasPriorities: false });
    expect(screen.queryByText('Set the priority')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Set the priority with that order (0 = 10)'),
    ).not.toBeInTheDocument();
    // the other write actions stay
    expect(screen.getByText('Archive the item')).toBeInTheDocument();
  });

  // The drift guard: every key handleItemShortcut acts on must be
  // documented by some row, and every documented key must really be
  // handled. Changing the shortcuts fails this test until the help
  // dialog is updated too.
  describe('stays in sync with handleItemShortcut', () => {
    const keyEvent = (key: string, modifier?: 'ctrl' | 'alt') =>
      ({
        key,
        ctrlKey: modifier === 'ctrl',
        metaKey: false,
        altKey: modifier === 'alt',
        shiftKey: false,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as unknown as KeyboardEvent<HTMLElement>);

    const ctx: ItemShortcutContext = {
      columns: [
        testColumn({ id: 'column-1', title: 'Todo', position: 1000 }),
        testColumn({ id: 'column-2', title: 'Done', position: 2000 }),
      ],
      priorities: testPriorities(),
      readonly: false,
      actions: testActions(),
      selection: {
        selected: new Set<string>(),
        toggleItem: jest.fn(),
        setMany: jest.fn(),
        clear: jest.fn(),
      },
      openMenu: jest.fn(),
    };

    const documented = new Set(
      visibleShortcutRows(ITEM_SHORTCUT_ROWS, {
        canWrite: true,
        hasPriorities: true,
      }).flatMap(row => row.covers ?? []),
    );

    it('documents every handled key', () => {
      // the complete key surface of handleItemShortcut
      const handledKeys = [
        'alt:ArrowLeft',
        'alt:ArrowRight',
        'alt:ArrowUp',
        'alt:ArrowDown',
        ' ',
        'Enter',
        'Delete',
        's',
        'c',
        'm',
        'a',
        'd',
        'p',
        ...'1234567890',
      ];
      for (const entry of handledKeys) {
        expect(documented).toContain(entry);
      }
    });

    it('handles every documented key', () => {
      const item = testItem({ id: 'item-1', columnId: 'column-1' });
      for (const entry of documented) {
        const [, modifier, key] = entry.match(/^(?:(ctrl|alt):)?(.+)$/)!;
        expect(
          handleItemShortcut(
            keyEvent(key, modifier as 'ctrl' | 'alt' | undefined),
            item,
            ctx,
          ),
        ).toBe(true);
      }
    });
  });
});
