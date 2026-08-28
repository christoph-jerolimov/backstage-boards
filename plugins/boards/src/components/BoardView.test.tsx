import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { identityApiRef } from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { BoardWithContext } from '@internal/plugin-boards-common';
import { BoardView } from './BoardView';
import {
  renderWithProviders,
  testActions,
  testColumn,
  testItem,
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
    canWrite?: boolean;
    groupBy?: 'none' | 'assignee' | 'dueDate' | 'tags';
  } = {},
) {
  const actions = testActions();
  const board = {
    id: 'board-1',
    name: 'Roadmap',
    access: 'admin',
    columns: over.columns ?? columns,
  } as unknown as BoardWithContext;
  renderWithProviders(
    <BoardView
      board={board}
      items={over.items ?? items}
      canWrite={over.canWrite ?? true}
      actions={actions}
      groupBy={over.groupBy ?? 'none'}
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
