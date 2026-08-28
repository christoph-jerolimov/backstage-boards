import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { identityApiRef } from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { TableView } from './TableView';
import {
  renderWithProviders,
  testActions,
  testBoard,
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

const board = testBoard({
  columns: [
    testColumn({ id: 'column-1', title: 'Todo' }),
    testColumn({ id: 'column-2', title: 'Done', position: 2000 }),
  ],
});

const items = [
  testItem({
    id: 'item-1',
    title: 'Beta task',
    columnId: 'column-2',
    tags: ['docs'],
    dueDate: '2026-09-04',
    updatedAt: '2026-08-10T10:00:00.000Z',
  }),
  testItem({
    id: 'item-2',
    title: 'Alpha task',
    columnId: 'column-1',
    createdBy: 'text:Importer',
    updatedAt: '2026-08-12T10:00:00.000Z',
  }),
];

function renderTable(
  over: {
    items?: typeof items;
    canWrite?: boolean;
    groupBy?: 'none' | 'assignee' | 'dueDate' | 'tags';
  } = {},
) {
  const actions = testActions();
  const openItem = jest.fn();
  renderWithProviders(
    <TableView
      board={board}
      items={over.items ?? items}
      canWrite={over.canWrite ?? true}
      actions={actions}
      groupBy={over.groupBy ?? 'none'}
      openItem={openItem}
    />,
    {
      apis: [
        [identityApiRef, identityApi],
        [catalogApiRef, catalogApi],
      ],
    },
  );
  return { actions, openItem };
}

/** Titles of the data rows, in render order. */
function titles() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map(row => row.querySelector('[role="rowheader"]')?.textContent);
}

describe('TableView', () => {
  it('renders one row per item with all columns', () => {
    renderTable();
    expect(
      screen.getAllByRole('columnheader').map(cell => cell.textContent),
    ).toEqual([
      'Title',
      'Status',
      'Due',
      'Assignees',
      'Tags',
      'Created by',
      'Updated',
      'Actions',
    ]);
    expect(titles()).toEqual(['Beta task', 'Alpha task']);
    expect(screen.getByText('docs')).toBeInTheDocument();
    expect(screen.getByText('Importer')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('marks externally managed items in the title', () => {
    renderTable({
      items: [testItem({ title: 'Synced', externalManager: 'jira' })],
    });
    expect(screen.getByText('Synced (via jira)')).toBeInTheDocument();
  });

  it('opens an item when its row is activated', async () => {
    const { openItem } = renderTable();
    await userEvent.click(screen.getByRole('row', { name: /Alpha task/ }));
    expect(openItem).toHaveBeenCalledWith('item-2');
  });

  it('sorts by a clicked column and reverses on a second click', async () => {
    renderTable();
    const titleHeader = screen.getByRole('columnheader', { name: 'Title' });
    await userEvent.click(titleHeader);
    expect(titles()).toEqual(['Alpha task', 'Beta task']);
    await userEvent.click(titleHeader);
    expect(titles()).toEqual(['Beta task', 'Alpha task']);
  });

  it('offers the item menu from the row', async () => {
    const { actions } = renderTable();
    await userEvent.click(
      screen.getByRole('button', { name: 'Actions for Alpha task' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Delete item' }),
    );
    expect(actions.deleteItem).toHaveBeenCalledWith('item-2');
  });

  it('keeps the menu read-only for readers', async () => {
    renderTable({ canWrite: false });
    await userEvent.click(
      screen.getByRole('button', { name: 'Actions for Alpha task' }),
    );
    expect(
      (await screen.findAllByRole('menuitem')).map(entry => entry.textContent),
    ).toEqual(['Open details']);
  });

  it('opens the context menu at the pointer on right-click', async () => {
    renderTable();
    const row = screen.getByRole('row', { name: /Alpha task/ });
    await userEvent.pointer({ target: row, keys: '[MouseRight]' });
    expect(
      await screen.findByRole('menuitem', { name: 'Open details' }),
    ).toBeInTheDocument();
  });

  it('renders one table per group when grouping is on', () => {
    renderTable({ groupBy: 'tags' });
    expect(screen.getAllByRole('grid')).toHaveLength(2);
    expect(
      screen.getAllByRole('heading').map(heading => heading.textContent),
    ).toEqual(['docs', 'Untagged']);
  });
});
