import { useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { identityApiRef } from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { BoardView } from './BoardView';
import type { SelectionHandle } from './useItemSelection';
import {
  renderWithProviders,
  testActions,
  testBoard,
  testColumn,
  testItem,
  testPriorities,
} from './__testUtils__/testHelpers';

const identityApi = {
  getBackstageIdentity: async () => ({
    type: 'user',
    userEntityRef: 'user:default/alice',
    ownershipEntityRefs: ['user:default/alice'],
  }),
};

const catalogApi = {
  getEntitiesByRefs: jest.fn().mockResolvedValue({ items: [] }),
};

const columns = [
  testColumn({ id: 'column-1', title: 'Todo', position: 1000 }),
  testColumn({ id: 'column-2', title: 'Doing', position: 2000 }),
  testColumn({ id: 'column-3', title: 'Done', position: 3000 }),
];

const items = [
  testItem({
    id: 'item-1',
    title: 'Second',
    columnId: 'column-1',
    position: 2000,
  }),
  testItem({
    id: 'item-2',
    title: 'First',
    columnId: 'column-1',
    position: 1000,
  }),
  testItem({
    id: 'item-3',
    title: 'Shipped',
    columnId: 'column-3',
    tags: ['docs'],
  }),
];

function renderBoard(
  over: {
    columns?: typeof columns;
    items?: typeof items;
    priorities?: ReturnType<typeof testPriorities>;
    canWrite?: boolean;
    groupBy?: 'none' | 'assignee' | 'priority' | 'dueDate' | 'tags';
    selection?: SelectionHandle;
  } = {},
) {
  const actions = testActions();
  const board = testBoard({
    columns: over.columns ?? columns,
    priorities: over.priorities ?? [],
  });
  renderWithProviders(
    <BoardView
      board={board}
      items={over.items ?? items}
      canWrite={over.canWrite ?? true}
      actions={actions}
      groupBy={over.groupBy ?? 'none'}
      selection={over.selection}
    />,
    {
      apis: [
        [identityApiRef, identityApi],
        [catalogApiRef, catalogApi],
      ],
    },
  );
  return { actions };
}

describe('BoardView lanes', () => {
  it('renders one lane per column with its item count', () => {
    renderBoard();
    expect(screen.getByText('Todo (2)')).toBeInTheDocument();
    expect(screen.getByText('Doing (0)')).toBeInTheDocument();
    expect(screen.getByText('Done (1)')).toBeInTheDocument();
  });

  it('orders the cards of a lane by position', () => {
    renderBoard();
    const cards = screen
      .getAllByRole('button')
      .map(button => button.getAttribute('aria-label'))
      .filter(label => label === 'First' || label === 'Second');
    expect(cards).toEqual(['First', 'Second']);
  });

  it('opens an item when its card is clicked', async () => {
    const { actions } = renderBoard();
    await userEvent.click(screen.getByRole('button', { name: 'Shipped' }));
    expect(actions.openItem).toHaveBeenCalledWith('item-3');
  });

  it('shows the tags and the external manager on a card', () => {
    renderBoard({
      items: [
        testItem({ id: 'item-4', title: 'Synced', externalManager: 'jira' }),
        items[2],
      ],
    });
    expect(screen.getByText('docs')).toBeInTheDocument();
    expect(screen.getByText('Managed by jira (read-only)')).toBeInTheDocument();
  });

  it('shows checklist progress on cards with a checklist', () => {
    renderBoard({
      items: [
        testItem({
          id: 'item-4',
          title: 'In progress',
          checklist: [
            { text: 'a', checked: true },
            { text: 'b', checked: false },
            { text: 'c', checked: false },
          ],
        }),
        testItem({
          id: 'item-5',
          title: 'All done',
          columnId: 'column-2',
          checklist: [
            { text: 'a', checked: true },
            { text: 'b', checked: true },
            { text: 'c', checked: true },
          ],
        }),
        items[2],
      ],
    });
    const partial = screen.getByLabelText('Checklist: 1 of 3 done');
    expect(partial).toHaveTextContent('1/3');
    expect(partial).toHaveAttribute('data-checklist-state', 'in-progress');
    const complete = screen.getByLabelText('Checklist: 3 of 3 done');
    expect(complete).toHaveTextContent('3/3');
    expect(complete).toHaveAttribute('data-checklist-state', 'complete');
    // 'Shipped' has no checklist, so exactly the two badges exist
    expect(screen.getAllByLabelText(/Checklist:/)).toHaveLength(2);
  });

  it('renames an item inline', async () => {
    const { actions } = renderBoard();
    await userEvent.click(
      screen.getByRole('button', { name: 'Edit title of Shipped' }),
    );
    const field = screen.getByRole('textbox', { name: 'title of Shipped' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Delivered{Enter}');
    expect(actions.renameItem).toHaveBeenCalledWith('item-3', 'Delivered');
  });

  it('renames a column inline', async () => {
    const { actions } = renderBoard();
    await userEvent.click(
      screen.getByRole('button', { name: 'Edit column Doing title' }),
    );
    const field = screen.getByRole('textbox', { name: 'column Doing title' });
    await userEvent.clear(field);
    await userEvent.type(field, 'In progress{Enter}');
    expect(actions.renameColumn).toHaveBeenCalledWith(
      'column-2',
      'In progress',
    );
  });

  it('hides every edit affordance from readers', () => {
    renderBoard({ canWrite: false });
    expect(
      screen.queryByRole('button', { name: 'Add item' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Actions for column/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit column Doing title' }),
    ).not.toBeInTheDocument();
  });

  it('groups the cards inside the lanes', () => {
    renderBoard({ groupBy: 'tags' });
    // the group heading of the Done lane plus the tag line of its card
    expect(screen.getAllByText('docs')).toHaveLength(2);
    expect(screen.getAllByText('Untagged').length).toBeGreaterThan(0);
  });

  it('shows the priority on cards that have one', () => {
    renderBoard({
      priorities: testPriorities(),
      items: [
        testItem({
          id: 'item-1',
          title: 'Urgent',
          columnId: 'column-1',
          priorityId: 'priority-1',
        }),
        testItem({ id: 'item-2', title: 'Plain', columnId: 'column-1' }),
      ],
    });
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('shows no priority chip without priorities', () => {
    renderBoard();
    expect(screen.queryByText('critical')).not.toBeInTheDocument();
  });

  it('groups by priority with counts, highest first, rest last', () => {
    renderBoard({
      groupBy: 'priority',
      priorities: testPriorities(),
      items: [
        testItem({
          id: 'item-1',
          title: 'Low one',
          columnId: 'column-1',
          position: 1000,
          priorityId: 'priority-4',
        }),
        testItem({
          id: 'item-2',
          title: 'Critical one',
          columnId: 'column-1',
          position: 2000,
          priorityId: 'priority-1',
        }),
        testItem({
          id: 'item-3',
          title: 'Plain',
          columnId: 'column-1',
          position: 3000,
        }),
      ],
    });
    const headings = screen.getAllByText(
      /critical \(1\)|low \(1\)|No priority \(1\)/,
    );
    expect(headings.map(node => node.textContent)).toEqual([
      'critical (1)',
      'low (1)',
      'No priority (1)',
    ]);
  });
});

describe('BoardView add item', () => {
  it('creates an item and stays open for the next one', async () => {
    const { actions } = renderBoard();
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Add item' })[0],
    );
    const field = screen.getByRole('textbox', { name: 'New item title' });
    await userEvent.type(field, 'Write the spec{Enter}');
    expect(actions.createItem).toHaveBeenCalledWith(
      'column-1',
      'Write the spec',
    );
    expect(
      screen.getByRole('textbox', { name: 'New item title' }),
    ).toBeInTheDocument();
  });

  it('closes the form on Escape without creating', async () => {
    const { actions } = renderBoard();
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Add item' })[0],
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'New item title' }),
      'Never mind{Escape}',
    );
    expect(actions.createItem).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.queryByRole('textbox', { name: 'New item title' }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe('BoardView column menu', () => {
  async function openColumnMenu(title: string) {
    await userEvent.click(
      screen.getByRole('button', { name: `Actions for column ${title}` }),
    );
    await screen.findByRole('menuitem', { name: 'Delete column' });
  }

  it('offers Move right only on the first column', async () => {
    renderBoard();
    await openColumnMenu('Todo');
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual([
      'Insert column before',
      'Insert column after',
      'Move right',
      'Color',
      'WIP limits',
      'Delete column',
    ]);
  });

  it('offers both directions in the middle', async () => {
    renderBoard();
    await openColumnMenu('Doing');
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual([
      'Insert column before',
      'Insert column after',
      'Move left',
      'Move right',
      'Color',
      'WIP limits',
      'Delete column',
    ]);
  });

  it('reorders a column', async () => {
    const { actions } = renderBoard();
    await openColumnMenu('Doing');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move left' }));
    expect(actions.reorderColumn).toHaveBeenCalledWith('column-2', 500);
  });

  it('sets and clears the column color', async () => {
    const { actions } = renderBoard();
    await openColumnMenu('Todo');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Color' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'blue' }),
    );
    expect(actions.setColumnColor).toHaveBeenCalledWith('column-1', 'blue');
  });

  it('deletes an empty column right away', async () => {
    const { actions } = renderBoard();
    await openColumnMenu('Doing');
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Delete column' }),
    );
    expect(actions.deleteColumn).toHaveBeenCalledWith('column-2');
  });

  it('asks where the items should go before deleting a filled column', async () => {
    const { actions } = renderBoard();
    await openColumnMenu('Todo');
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Delete column' }),
    );
    expect(await screen.findByText('Delete column “Todo”')).toBeInTheDocument();
    expect(actions.deleteColumn).not.toHaveBeenCalled();
    // the closing column menu still owns the focus scope, so the dialog's
    // own controls are hidden from the accessibility tree for a moment
    const confirm = screen.getByRole('button', {
      name: 'Move items and delete',
      hidden: true,
    });
    expect(confirm).toBeDisabled();

    await userEvent.click(
      screen.getByRole('button', { name: /Move items to/, hidden: true }),
    );
    await userEvent.click(await screen.findByRole('option', { name: 'Done' }));
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Move items and delete',
        hidden: true,
      }),
    );
    expect(actions.deleteColumn).toHaveBeenCalledWith('column-1', 'column-3');
  });
});

describe('BoardView add column', () => {
  it('is offered only while the board has no column', () => {
    renderBoard();
    expect(
      screen.queryByRole('button', { name: 'Add column' }),
    ).not.toBeInTheDocument();
  });

  it('creates the first column', async () => {
    const { actions } = renderBoard({ columns: [], items: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Add column' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'New column title' }),
      'Backlog{Enter}',
    );
    expect(actions.addColumn).toHaveBeenCalledWith('Backlog', undefined);
  });

  it('cancels adding the first column on Escape', async () => {
    const { actions } = renderBoard({ columns: [], items: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Add column' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'New column title' }),
      'Backlog{Escape}',
    );
    expect(actions.addColumn).not.toHaveBeenCalled();
  });
});

describe('BoardView insert column', () => {
  async function insert(column: string, entry: 'before' | 'after') {
    await userEvent.click(
      screen.getByRole('button', { name: `Actions for column ${column}` }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: `Insert column ${entry}` }),
    );
    return screen.findByRole('textbox', { name: 'New column title' });
  }

  it('inserts between two columns without a follow-up reorder', async () => {
    // Todo=1000, Doing=2000, so the gap after Todo is 1500
    const { actions } = renderBoard();
    await userEvent.type(await insert('Todo', 'after'), 'In Review{Enter}');
    expect(actions.addColumn).toHaveBeenCalledTimes(1);
    expect(actions.addColumn).toHaveBeenCalledWith('In Review', 1500);
    // the column is created where it belongs, never appended and moved
    expect(actions.reorderColumn).not.toHaveBeenCalled();
  });

  it('inserts before the leftmost column below its position', async () => {
    const { actions } = renderBoard();
    await userEvent.type(await insert('Todo', 'before'), 'Backlog{Enter}');
    expect(actions.addColumn).toHaveBeenCalledWith('Backlog', 500);
  });

  it('leaves appending to the backend past the last column', async () => {
    const { actions } = renderBoard();
    await userEvent.type(await insert('Done', 'after'), 'Archive{Enter}');
    expect(actions.addColumn).toHaveBeenCalledWith('Archive', undefined);
  });

  it('creates nothing when the insert is cancelled on Escape', async () => {
    const { actions } = renderBoard();
    await userEvent.type(await insert('Todo', 'after'), 'In Review{Escape}');
    expect(actions.addColumn).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.queryByRole('textbox', { name: 'New column title' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('creates nothing when the title is left empty', async () => {
    const { actions } = renderBoard();
    await userEvent.type(await insert('Todo', 'after'), '   {Enter}');
    expect(actions.addColumn).not.toHaveBeenCalled();
  });

  it('offers no insert entries to a read-only user', () => {
    renderBoard({ canWrite: false });
    expect(
      screen.queryByRole('button', { name: /Actions for column/ }),
    ).not.toBeInTheDocument();
  });
});

function mockSelection(
  selectedIds: string[] = [],
): jest.Mocked<SelectionHandle> {
  return {
    selected: new Set(selectedIds),
    toggleItem: jest.fn(),
    setMany: jest.fn(),
    clear: jest.fn(),
  };
}

function card(name: string | RegExp) {
  return screen.getByRole('button', { name });
}

describe('BoardView drop zones', () => {
  it('renders one gap zone per possible insertion point', () => {
    renderBoard();
    // Todo (2 cards): 3 zones; Doing (empty): 1 zone; Done (1 card): 2
    expect(screen.getAllByTestId('gap-drop-zone')).toHaveLength(6);
  });

  it('renders the zones per group section when the lane is grouped', () => {
    renderBoard({
      groupBy: 'tags',
      items: [
        testItem({
          id: 'item-1',
          title: 'Tagged',
          columnId: 'column-1',
          tags: ['docs'],
        }),
        testItem({ id: 'item-2', title: 'Plain', columnId: 'column-1' }),
      ],
    });
    // Todo has two sections of one card (2 zones each); Doing and Done
    // are empty lanes with one zone each
    expect(screen.getAllByTestId('gap-drop-zone')).toHaveLength(6);
  });
});

describe('BoardView card selection', () => {
  it('marks selected cards', () => {
    renderBoard({ selection: mockSelection(['item-2']) });
    expect(card('First, selected')).toBeInTheDocument();
    expect(card('Second')).toBeInTheDocument();
  });

  it('shows no selected marking without a selection handle', () => {
    renderBoard({ canWrite: false });
    expect(
      screen.queryByRole('button', { name: /, selected/ }),
    ).not.toBeInTheDocument();
  });
});

describe('BoardView keyboard', () => {
  it('gives exactly one card the roving tab stop', () => {
    renderBoard();
    // the first card of the first non-empty column
    expect(card('First')).toHaveAttribute('tabindex', '0');
    expect(card('Second')).toHaveAttribute('tabindex', '-1');
    expect(card('Shipped')).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus down and up within a column', async () => {
    renderBoard();
    card('First').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(card('Second')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(card('First')).toHaveFocus();
    // the edges keep the focus in place
    await userEvent.keyboard('{ArrowUp}');
    expect(card('First')).toHaveFocus();
  });

  it('moves focus across columns, skipping empty ones', async () => {
    renderBoard();
    card('Second').focus();
    // Doing is empty: focus jumps to Done, clamped to its last card
    await userEvent.keyboard('{ArrowRight}');
    expect(card('Shipped')).toHaveFocus();
    // and back at the same visual index: Shipped is Done's first card
    await userEvent.keyboard('{ArrowLeft}');
    expect(card('First')).toHaveFocus();
  });

  it('moves the item one column with Alt+Arrow', async () => {
    const { actions } = renderBoard();
    card('First').focus();
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(actions.moveItem).toHaveBeenCalledWith('item-2', {
      columnId: 'column-2',
    });
    (actions.moveItem as jest.Mock).mockClear();
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(actions.moveItem).not.toHaveBeenCalled();
  });

  it('toggles the bulk selection with Space', async () => {
    const selection = mockSelection();
    renderBoard({ selection });
    card('First').focus();
    await userEvent.keyboard(' ');
    expect(selection.toggleItem).toHaveBeenCalledWith('item-2');
  });

  it('opens the item menu with Enter and returns focus on Escape', async () => {
    renderBoard();
    card('Shipped').focus();
    await userEvent.keyboard('{Enter}');
    expect(
      await screen.findByRole('menuitem', { name: 'Open details' }),
    ).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(card('Shipped')).toHaveFocus());
  });

  it('opens the move picker with s and moves via its entries', async () => {
    const { actions } = renderBoard();
    card('First').focus();
    await userEvent.keyboard('s');
    const entries = await screen.findAllByRole('menuitem');
    expect(entries.map(entry => entry.textContent)).toEqual(['Doing', 'Done']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Doing' }));
    expect(actions.moveItem).toHaveBeenCalledWith('item-2', {
      columnId: 'column-2',
    });
  });

  it('opens the due-date picker with d', async () => {
    renderBoard();
    card('First').focus();
    await userEvent.keyboard('d');
    expect(
      await screen.findByRole('menuitem', { name: 'Tomorrow' }),
    ).toBeInTheDocument();
  });

  it('opens the assignee picker with a', async () => {
    renderBoard();
    card('First').focus();
    await userEvent.keyboard('a');
    expect(
      await screen.findByRole('menuitem', { name: /Me/ }),
    ).toBeInTheDocument();
  });

  it('opens the priority picker with p on a board with priorities', async () => {
    renderBoard({ priorities: testPriorities() });
    card('First').focus();
    await userEvent.keyboard('p');
    expect(
      await screen.findByRole('menuitem', { name: 'critical' }),
    ).toBeInTheDocument();
  });

  it('opens no priority picker without priorities', async () => {
    renderBoard();
    card('First').focus();
    await userEvent.keyboard('p');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('sets the priority with that order on a digit', async () => {
    const { actions } = renderBoard({ priorities: testPriorities() });
    card('First').focus();
    await userEvent.keyboard('2');
    expect(actions.setItemPriority).toHaveBeenCalledWith(
      'item-2',
      'priority-2',
    );
    (actions.setItemPriority as jest.Mock).mockClear();
    // no priority carries order 7 on this board
    await userEvent.keyboard('7');
    expect(actions.setItemPriority).not.toHaveBeenCalled();
  });

  it('archives the focused card with Delete', async () => {
    const { actions } = renderBoard();
    card('First').focus();
    await userEvent.keyboard('{Delete}');
    expect(actions.deleteItem).toHaveBeenCalledWith('item-2');
  });

  it('keeps every mutation shortcut inert on read-only cards', async () => {
    const selection = mockSelection();
    const { actions } = renderBoard({
      items: [
        testItem({
          id: 'item-9',
          title: 'Synced',
          columnId: 'column-1',
          externalManager: 'jira',
        }),
      ],
      selection,
    });
    card('Synced').focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('s');
    await userEvent.keyboard('{Delete}');
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(selection.toggleItem).not.toHaveBeenCalled();
    expect(actions.moveItem).not.toHaveBeenCalled();
    expect(actions.deleteItem).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('aliases j/k/h/l to the arrows', async () => {
    renderBoard();
    card('First').focus();
    await userEvent.keyboard('j');
    expect(card('Second')).toHaveFocus();
    await userEvent.keyboard('k');
    expect(card('First')).toHaveFocus();
    // Doing is empty, so l jumps to Done and h returns
    await userEvent.keyboard('l');
    expect(card('Shipped')).toHaveFocus();
    await userEvent.keyboard('h');
    expect(card('First')).toHaveFocus();
  });

  it('jumps to the first and last card of the column with Home/End', async () => {
    renderBoard();
    card('First').focus();
    await userEvent.keyboard('{End}');
    expect(card('Second')).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(card('First')).toHaveFocus();
  });

  it('reorders the card within its column with Alt+Up/Down', async () => {
    const { actions } = renderBoard();
    // 'First' (item-2, position 1000) sits above 'Second' (item-1, 2000)
    card('First').focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(actions.moveItem).toHaveBeenCalledWith('item-2', {
      columnId: 'column-1',
      // after 'Second': past the last position
      position: 3000,
    });
    (actions.moveItem as jest.Mock).mockClear();
    // already the first card: Alt+Up does nothing
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(actions.moveItem).not.toHaveBeenCalled();
  });

  it('walks the grouped sections of a column top to bottom', async () => {
    renderBoard({
      groupBy: 'tags',
      items: [
        testItem({
          id: 'item-1',
          title: 'Tagged',
          columnId: 'column-1',
          tags: ['docs'],
          position: 2000,
        }),
        testItem({
          id: 'item-2',
          title: 'Plain',
          columnId: 'column-1',
          position: 1000,
        }),
      ],
    });
    // group order: docs first, then Untagged — regardless of positions
    card('Tagged').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(card('Plain')).toHaveFocus();
  });
});

describe('BoardView focus stability', () => {
  it('focuses a successor when the focused card is archived away', async () => {
    const actions = testActions();
    function Harness() {
      const [current, setCurrent] = useState(items);
      return (
        <>
          <button
            onClick={() => setCurrent(items.filter(i => i.id !== 'item-2'))}
          >
            drop
          </button>
          <BoardView
            board={testBoard({ columns, priorities: [] })}
            items={current}
            canWrite
            actions={actions}
            groupBy="none"
          />
        </>
      );
    }
    renderWithProviders(<Harness />, {
      apis: [
        [identityApiRef, identityApi],
        [catalogApiRef, catalogApi],
      ],
    });
    card('First').focus();
    await userEvent.keyboard('{Delete}');
    expect(actions.deleteItem).toHaveBeenCalledWith('item-2');
    // the server refresh removes the archived item; focus moves on to
    // the next card of the column (fireEvent: a real click would move
    // the focus to the button and must then be left alone)
    fireEvent.click(screen.getByText('drop'));
    await waitFor(() => expect(card('Second')).toHaveFocus());
  });
});

describe('BoardView WIP limits', () => {
  const limited = [
    testColumn({ id: 'column-1', title: 'Todo', position: 1000 }),
    testColumn({
      id: 'column-2',
      title: 'Doing',
      position: 2000,
      wipSoftLimit: 1,
      wipHardLimit: 2,
    }),
  ];
  const doingFull = [
    testItem({ id: 'item-1', title: 'One', columnId: 'column-1' }),
    testItem({ id: 'item-2', title: 'Two', columnId: 'column-2' }),
    testItem({
      id: 'item-3',
      title: 'Three',
      columnId: 'column-2',
      position: 2000,
    }),
  ];

  it('shows the count against the limit and the ok state without one', () => {
    renderBoard({
      columns: limited,
      items: [testItem({ id: 'item-1', title: 'One', columnId: 'column-2' })],
    });
    expect(screen.getByText('Todo (0)')).toBeInTheDocument();
    expect(screen.getByText('Doing (1/2)')).toBeInTheDocument();
  });

  it('marks the soft state with a warning background', () => {
    renderBoard({
      columns: limited,
      items: [testItem({ id: 'item-1', title: 'One', columnId: 'column-2' })],
    });
    // the wrapping header flex carries the warning background
    expect(document.body.innerHTML.includes('--bui-bg-warning')).toBe(true);
    expect(document.body.innerHTML.includes('--bui-bg-danger')).toBe(false);
  });

  it('marks the hard state, disables the add row, and disables move entries', async () => {
    renderBoard({ columns: limited, items: doingFull });
    expect(document.body.innerHTML.includes('--bui-bg-danger')).toBe(true);
    // the full column's add row disables, the other stays usable
    const addButtons = screen.getAllByRole('button', { name: 'Add item' });
    expect(addButtons[0]).toBeEnabled();
    expect(addButtons[1]).toBeDisabled();
    // move entries into the full column disable in the item menu
    await userEvent.click(
      screen.getByRole('button', { name: 'Actions for One' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Move to column' }),
    );
    const entry = await screen.findByRole('menuitem', { name: 'Doing' });
    expect(entry).toHaveAttribute('aria-disabled', 'true');
  });

  it('saves limits from the WIP limits dialog', async () => {
    const { actions } = renderBoard();
    await userEvent.click(
      screen.getByRole('button', { name: 'Actions for column Doing' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'WIP limits' }),
    );
    await userEvent.type(screen.getByLabelText('Soft limit'), '3');
    await userEvent.type(screen.getByLabelText('Hard limit'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Save limits' }));
    expect(actions.setColumnWipLimits).toHaveBeenCalledWith('column-2', {
      wipSoftLimit: 3,
      wipHardLimit: 5,
    });
  });

  it('keeps Save disabled while the limits are invalid', async () => {
    renderBoard();
    await userEvent.click(
      screen.getByRole('button', { name: 'Actions for column Doing' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'WIP limits' }),
    );
    await userEvent.type(screen.getByLabelText('Soft limit'), '5');
    await userEvent.type(screen.getByLabelText('Hard limit'), '3');
    expect(screen.getByRole('button', { name: 'Save limits' })).toBeDisabled();
  });
});

describe('BoardView reader empty board', () => {
  it('explains a column-less board to a reader', () => {
    renderBoard({ columns: [], items: [], canWrite: false });
    expect(
      screen.getByText('This board has no columns yet'),
    ).toBeInTheDocument();
  });

  it('keeps the add-column affordance for writers', () => {
    renderBoard({ columns: [], items: [] });
    expect(
      screen.getByRole('button', { name: 'Add column' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('This board has no columns yet'),
    ).not.toBeInTheDocument();
  });
});
