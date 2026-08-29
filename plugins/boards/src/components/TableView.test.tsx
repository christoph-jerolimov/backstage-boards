import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { identityApiRef } from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { tomorrowISO } from '@internal/plugin-boards-common';
import { TableView } from './TableView';
import {
  renderWithProviders,
  testActions,
  testBoard,
  testBulkActions,
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
    board?: typeof board;
    items?: typeof items;
    canWrite?: boolean;
    groupBy?: 'none' | 'assignee' | 'dueDate' | 'tags';
  } = {},
) {
  const actions = testActions();
  const bulk = testBulkActions();
  const openItem = jest.fn();
  renderWithProviders(
    <TableView
      board={over.board ?? board}
      items={over.items ?? items}
      canWrite={over.canWrite ?? true}
      actions={actions}
      bulk={bulk}
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
  return { actions, bulk, openItem };
}

/** Titles of the data rows, in render order. */
function titles() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map(row => row.querySelector('[role="rowheader"]')?.textContent);
}

function rowCheckbox(title: string) {
  return screen.getByRole('checkbox', { name: `Select ${title}` });
}

async function selectRows(...rowTitles: string[]) {
  for (const title of rowTitles) {
    await userEvent.click(rowCheckbox(title));
  }
}

async function chooseFromMenu(menuLabel: string, entry: RegExp) {
  await userEvent.click(screen.getByRole('button', { name: menuLabel }));
  await userEvent.click(await screen.findByRole('menuitem', { name: entry }));
}

describe('TableView', () => {
  it('renders one row per item with all columns', () => {
    renderTable();
    expect(
      screen.getAllByRole('columnheader').map(cell => cell.textContent),
    ).toEqual([
      '',
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

  describe('row selection', () => {
    it('shows no checkboxes to readers', () => {
      renderTable({ canWrite: false });
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('selects a row without opening the drawer', async () => {
      const { openItem } = renderTable();
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
      await selectRows('Alpha task');
      expect(rowCheckbox('Alpha task')).toBeChecked();
      expect(screen.getByText('1 selected')).toBeInTheDocument();
      expect(openItem).not.toHaveBeenCalled();
    });

    it('disables the checkbox of an externally managed item', () => {
      renderTable({
        items: [
          ...items,
          testItem({ id: 'item-3', title: 'Synced', externalManager: 'jira' }),
        ],
      });
      expect(rowCheckbox('Synced')).toBeDisabled();
    });

    it('select-all covers the selectable rows and turns indeterminate', async () => {
      renderTable({
        items: [
          ...items,
          testItem({ id: 'item-3', title: 'Synced', externalManager: 'jira' }),
        ],
      });
      const selectAll = screen.getByRole('checkbox', {
        name: 'Select all items',
      });
      await userEvent.click(selectAll);
      expect(rowCheckbox('Beta task')).toBeChecked();
      expect(rowCheckbox('Alpha task')).toBeChecked();
      expect(rowCheckbox('Synced')).not.toBeChecked();
      expect(screen.getByText('2 selected')).toBeInTheDocument();
      await selectRows('Alpha task');
      expect((selectAll as HTMLInputElement).indeterminate).toBe(true);
      expect(selectAll).not.toBeChecked();
    });

    it('clearing via select-all removes the table rows from the selection', async () => {
      renderTable();
      const selectAll = screen.getByRole('checkbox', {
        name: 'Select all items',
      });
      await userEvent.click(selectAll);
      expect(screen.getByText('2 selected')).toBeInTheDocument();
      await userEvent.click(selectAll);
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });

    it('keeps the selection across a group-by change and counts a multi-group item once', async () => {
      const twoAssignees = [
        testItem({
          id: 'item-1',
          title: 'Multi task',
          assignees: ['user:default/bob', 'user:default/carol'],
        }),
        testItem({ id: 'item-2', title: 'Solo task' }),
      ];
      function Harness() {
        const [groupBy, setGroupBy] = useState<'none' | 'assignee'>('none');
        return (
          <>
            <button onClick={() => setGroupBy('assignee')}>regroup</button>
            <TableView
              board={board}
              items={twoAssignees}
              canWrite
              actions={testActions()}
              bulk={testBulkActions()}
              groupBy={groupBy}
              openItem={jest.fn()}
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
      await selectRows('Multi task', 'Solo task');
      expect(screen.getByText('2 selected')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'regroup' }));
      // the multi-assignee item renders (checked) in both of its groups
      const multiBoxes = screen.getAllByRole('checkbox', {
        name: 'Select Multi task',
      });
      expect(multiBoxes).toHaveLength(2);
      multiBoxes.forEach(box => expect(box).toBeChecked());
      expect(rowCheckbox('Solo task')).toBeChecked();
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });
  });

  describe('bulk actions bar', () => {
    it('clears the selection and hides the bar', async () => {
      renderTable();
      await selectRows('Alpha task', 'Beta task');
      await userEvent.click(
        screen.getByRole('button', { name: 'Clear selection' }),
      );
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
      expect(rowCheckbox('Alpha task')).not.toBeChecked();
    });

    it('archives every selected item', async () => {
      const { bulk } = renderTable();
      await selectRows('Alpha task', 'Beta task');
      await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
      expect(bulk.archiveItems).toHaveBeenCalledWith(['item-1', 'item-2']);
    });

    it('marks a mixed status with dashes and moves only the items not there yet', async () => {
      const { bulk } = renderTable();
      await selectRows('Alpha task', 'Beta task');
      await userEvent.click(screen.getByRole('button', { name: 'Status' }));
      const entries = await screen.findAllByRole('menuitem');
      expect(entries.map(entry => entry.textContent)).toEqual([
        '– Todo',
        '– Done',
      ]);
      await userEvent.click(screen.getByRole('menuitem', { name: '– Done' }));
      expect(bulk.moveItems).toHaveBeenCalledWith(['item-2'], 'column-2');
    });

    it('marks a uniform status with a checkmark', async () => {
      renderTable({
        items: [
          testItem({ id: 'item-1', title: 'One', columnId: 'column-1' }),
          testItem({ id: 'item-2', title: 'Two', columnId: 'column-1' }),
        ],
      });
      await selectRows('One', 'Two');
      await userEvent.click(screen.getByRole('button', { name: 'Status' }));
      const entries = await screen.findAllByRole('menuitem');
      expect(entries.map(entry => entry.textContent)).toEqual([
        '✓ Todo',
        'Done',
      ]);
    });

    it('offers no priority dropdown on a board without priorities', async () => {
      renderTable({
        board: testBoard({ columns: board.columns, priorities: [] }),
      });
      await selectRows('Alpha task');
      expect(
        screen.queryByRole('button', { name: 'Priority' }),
      ).not.toBeInTheDocument();
    });

    it('marks priorities and sets one on the items missing it', async () => {
      const { bulk } = renderTable({
        items: [
          testItem({ id: 'item-1', title: 'One', priorityId: 'priority-2' }),
          testItem({ id: 'item-2', title: 'Two' }),
        ],
      });
      await selectRows('One', 'Two');
      await userEvent.click(screen.getByRole('button', { name: 'Priority' }));
      const entries = await screen.findAllByRole('menuitem');
      expect(entries.map(entry => entry.textContent)).toEqual([
        'critical',
        '– high',
        'medium',
        'low',
        '– No priority',
      ]);
      await userEvent.click(screen.getByRole('menuitem', { name: '– high' }));
      expect(bulk.updateItems).toHaveBeenCalledWith([
        { itemId: 'item-2', update: { priorityId: 'priority-2' } },
      ]);
    });

    it('clears priorities and shows the checkmark on "No priority"', async () => {
      const { bulk } = renderTable({
        items: [
          testItem({ id: 'item-1', title: 'One', priorityId: 'priority-1' }),
          testItem({ id: 'item-2', title: 'Two', priorityId: 'priority-2' }),
        ],
      });
      await selectRows('One', 'Two');
      await chooseFromMenu('Priority', /No priority/);
      expect(bulk.updateItems).toHaveBeenCalledWith([
        { itemId: 'item-1', update: { priorityId: null } },
        { itemId: 'item-2', update: { priorityId: null } },
      ]);
    });

    it('checkmarks "No priority" when no selected item has one', async () => {
      renderTable({
        items: [
          testItem({ id: 'item-1', title: 'One' }),
          testItem({ id: 'item-2', title: 'Two' }),
        ],
      });
      await selectRows('One', 'Two');
      await userEvent.click(screen.getByRole('button', { name: 'Priority' }));
      expect(
        await screen.findByRole('menuitem', { name: '✓ No priority' }),
      ).toBeInTheDocument();
    });

    it('adds a partially present assignee to the items missing them', async () => {
      const { bulk } = renderTable({
        items: [
          testItem({ id: 'item-1', title: 'One', assignees: ['text:Jane'] }),
          testItem({ id: 'item-2', title: 'Two' }),
        ],
      });
      await selectRows('One', 'Two');
      await userEvent.click(screen.getByRole('button', { name: 'Assignee' }));
      const entries = await screen.findAllByRole('menuitem');
      expect(entries.map(entry => entry.textContent)).toEqual([
        'Me',
        '– Jane',
        '– No assignee',
      ]);
      await userEvent.click(screen.getByRole('menuitem', { name: '– Jane' }));
      expect(bulk.updateItems).toHaveBeenCalledWith([
        { itemId: 'item-2', update: { assignees: ['text:Jane'] } },
      ]);
    });

    it('removes an assignee every selected item has', async () => {
      const { bulk } = renderTable({
        items: [
          testItem({ id: 'item-1', title: 'One', assignees: ['text:Jane'] }),
          testItem({
            id: 'item-2',
            title: 'Two',
            assignees: ['text:Jane', 'text:Joe'],
          }),
        ],
      });
      await selectRows('One', 'Two');
      await chooseFromMenu('Assignee', /✓ Jane/);
      expect(bulk.updateItems).toHaveBeenCalledWith([
        { itemId: 'item-1', update: { assignees: [] } },
        { itemId: 'item-2', update: { assignees: ['text:Joe'] } },
      ]);
    });

    it('clears all assignees via "No assignee"', async () => {
      const { bulk } = renderTable({
        items: [
          testItem({ id: 'item-1', title: 'One', assignees: ['text:Jane'] }),
          testItem({ id: 'item-2', title: 'Two' }),
        ],
      });
      await selectRows('One', 'Two');
      await chooseFromMenu('Assignee', /No assignee/);
      expect(bulk.updateItems).toHaveBeenCalledWith([
        { itemId: 'item-1', update: { assignees: [] } },
      ]);
    });

    it('sets and removes the due date on every selected item', async () => {
      const { bulk } = renderTable({
        items: [
          testItem({ id: 'item-1', title: 'One' }),
          testItem({ id: 'item-2', title: 'Two', dueDate: '2026-09-04' }),
        ],
      });
      await selectRows('One', 'Two');
      await chooseFromMenu('Due date', /Tomorrow/);
      expect(bulk.updateItems).toHaveBeenCalledWith([
        { itemId: 'item-1', update: { dueDate: tomorrowISO() } },
        { itemId: 'item-2', update: { dueDate: tomorrowISO() } },
      ]);
      (bulk.updateItems as jest.Mock).mockClear();
      await chooseFromMenu('Due date', /Remove due date/);
      expect(bulk.updateItems).toHaveBeenCalledWith([
        { itemId: 'item-2', update: { dueDate: null } },
      ]);
    });
  });
});
