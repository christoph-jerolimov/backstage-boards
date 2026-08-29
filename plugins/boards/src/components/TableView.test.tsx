import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { identityApiRef, storageApiRef } from '@backstage/frontend-plugin-api';
import { mockApis } from '@backstage/frontend-test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { TableView } from './TableView';
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

const board = testBoard({
  columns: [
    testColumn({ id: 'column-1', title: 'Todo' }),
    testColumn({ id: 'column-2', title: 'Done', position: 2000 }),
  ],
  priorities: testPriorities(),
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
    storage?: ReturnType<typeof mockApis.storage>;
  } = {},
) {
  const actions = testActions();
  const openItem = jest.fn();
  const storage = over.storage ?? mockApis.storage();
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
        [storageApiRef, storage],
      ],
    },
  );
  return { actions, openItem, storage };
}

/** Titles of the data rows, in render order. */
function titles() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map(row => row.querySelector('[role="rowheader"]')?.textContent);
}

describe('TableView', () => {
  it('renders one row per item with the default columns', () => {
    renderTable();
    expect(
      screen.getAllByRole('columnheader').map(cell => cell.textContent),
    ).toEqual(['Title', 'Status', 'Due', 'Assignees', 'Tags', 'Actions']);
    expect(titles()).toEqual(['Beta task', 'Alpha task']);
    expect(screen.getByText('docs')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    // the audit columns are hidden by default
    expect(screen.queryByText('Importer')).not.toBeInTheDocument();
  });

  it('shows and hides columns from the configure menu, stored per board', async () => {
    const { storage } = renderTable();
    await userEvent.click(
      screen.getByRole('button', { name: 'Configure columns' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Created by' }));
    expect(
      screen.getByRole('columnheader', { name: 'Created by' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Importer')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Configure columns' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: '✓ Tags' }));
    expect(
      screen.queryByRole('columnheader', { name: 'Tags' }),
    ).not.toBeInTheDocument();
    expect(
      storage.forBucket('boards-table-columns').snapshot<string[]>('board-1')
        .value,
    ).toEqual([
      'title',
      'status',
      'priority',
      'dueDate',
      'assignees',
      'createdBy',
    ]);
  });

  it('renders a stored column choice, including the new audit columns', () => {
    const storage = mockApis.storage();
    storage
      .forBucket('boards-table-columns')
      .set('board-1', ['title', 'createdAt', 'updatedBy']);
    renderTable({ storage });
    expect(
      screen.getAllByRole('columnheader').map(cell => cell.textContent),
    ).toEqual(['Title', 'Created', 'Updated by', 'Actions']);
    // both fixture items were created 2026-08-01 and updated by alice
    expect(screen.getAllByText(/8\/1\/2026/)).toHaveLength(2);
    expect(screen.getAllByText('alice')).toHaveLength(2);
  });

  it('sorts by the Created column', async () => {
    const storage = mockApis.storage();
    storage
      .forBucket('boards-table-columns')
      .set('board-1', ['title', 'createdAt']);
    renderTable({
      storage,
      items: [
        testItem({
          id: 'item-1',
          title: 'Older',
          createdAt: '2026-08-01T10:00:00.000Z',
        }),
        testItem({
          id: 'item-2',
          title: 'Newer',
          createdAt: '2026-08-05T10:00:00.000Z',
        }),
      ],
    });
    await userEvent.click(
      screen.getByRole('columnheader', { name: 'Created' }),
    );
    expect(titles()).toEqual(['Older', 'Newer']);
    await userEvent.click(
      screen.getByRole('columnheader', { name: 'Created' }),
    );
    expect(titles()).toEqual(['Newer', 'Older']);
  });

  it('adds the priority column only when a listed item has one', () => {
    renderTable({
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
    expect(
      screen.getAllByRole('columnheader').map(cell => cell.textContent),
    ).toContain('Priority');
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('has no priority column while no item has a priority', () => {
    renderTable();
    expect(
      screen.getAllByRole('columnheader').map(cell => cell.textContent),
    ).not.toContain('Priority');
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
