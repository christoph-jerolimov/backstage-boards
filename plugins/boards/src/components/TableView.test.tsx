import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { identityApiRef, storageApiRef } from '@backstage/frontend-plugin-api';
import { mockApis } from '@backstage/frontend-test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  BoardItem,
  BoardWithContext,
  tomorrowISO,
} from '@internal/plugin-boards-common';
import { TableView } from './TableView';
import { BulkActionsBar } from './BulkActionsBar';
import { useItemSelection } from './useItemSelection';
import { assigneePool, GroupByMode } from './grouping';
import type { BoardActions } from './BoardView';
import type { BulkActions } from './useBoardActions';
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

/**
 * The page-level wiring around the table, mirroring `BoardPage`: the
 * shared selection hook plus the bulk-actions bar above the view.
 */
function TableHarness(props: {
  board: BoardWithContext;
  items: BoardItem[];
  canWrite: boolean;
  groupBy: GroupByMode;
  actions: BoardActions;
  bulk: BulkActions;
  openItem: (itemId: string) => void;
}) {
  const selection = useItemSelection();
  const selectedItems = props.canWrite
    ? props.items.filter(item => selection.selected.has(item.id))
    : [];
  return (
    <>
      {selectedItems.length > 0 && (
        <BulkActionsBar
          board={props.board}
          selectedItems={selectedItems}
          assigneePool={assigneePool(props.items)}
          tagPool={[...new Set(props.items.flatMap(item => item.tags))]}
          bulk={props.bulk}
          onClear={selection.clear}
        />
      )}
      <TableView
        board={props.board}
        items={props.items}
        canWrite={props.canWrite}
        actions={props.actions}
        groupBy={props.groupBy}
        openItem={props.openItem}
        selection={props.canWrite ? selection : undefined}
      />
    </>
  );
}

function renderTable(
  over: {
    board?: typeof board;
    items?: typeof items;
    canWrite?: boolean;
    groupBy?: 'none' | 'assignee' | 'dueDate' | 'tags';
    storage?: ReturnType<typeof mockApis.storage>;
  } = {},
) {
  const actions = testActions();
  const bulk = testBulkActions();
  const openItem = jest.fn();
  const storage = over.storage ?? mockApis.storage();
  renderWithProviders(
    <TableHarness
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
        [storageApiRef, storage],
      ],
    },
  );
  return { actions, bulk, openItem, storage };
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
  it('renders one row per item with the default columns', () => {
    renderTable();
    expect(
      screen.getAllByRole('columnheader').map(cell => cell.textContent),
      // the leading '' is the selection column, whose header is the
      // select-all checkbox
    ).toEqual(['', 'Title', 'Status', 'Due', 'Assignees', 'Tags', 'Actions']);
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
    ).toEqual(['', 'Title', 'Created', 'Updated by', 'Actions']);
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
    ).toEqual(['Open details', 'Copy link']);
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
            <TableHarness
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

    it('marks tags and adds a partially present tag to the items missing it', async () => {
      const { bulk } = renderTable({
        items: [
          testItem({ id: 'item-1', title: 'One', tags: ['docs', 'infra'] }),
          testItem({ id: 'item-2', title: 'Two', tags: ['docs'] }),
        ],
      });
      await selectRows('One', 'Two');
      await userEvent.click(screen.getByRole('button', { name: 'Tags' }));
      const entries = await screen.findAllByRole('menuitem');
      expect(entries.map(entry => entry.textContent)).toEqual([
        '✓ docs',
        '– infra',
        'Add tag…',
        'Remove all tags',
      ]);
      await userEvent.click(screen.getByRole('menuitem', { name: '– infra' }));
      expect(bulk.updateItems).toHaveBeenCalledWith([
        { itemId: 'item-2', update: { tags: ['docs', 'infra'] } },
      ]);
    });

    it('removes a tag every selected item has', async () => {
      const { bulk } = renderTable({
        items: [
          testItem({ id: 'item-1', title: 'One', tags: ['docs'] }),
          testItem({ id: 'item-2', title: 'Two', tags: ['docs', 'infra'] }),
        ],
      });
      await selectRows('One', 'Two');
      await chooseFromMenu('Tags', /✓ docs/);
      expect(bulk.updateItems).toHaveBeenCalledWith([
        { itemId: 'item-1', update: { tags: [] } },
        { itemId: 'item-2', update: { tags: ['infra'] } },
      ]);
    });

    it('adds a typed new tag to every selected item', async () => {
      const { bulk } = renderTable({
        items: [
          testItem({ id: 'item-1', title: 'One', tags: ['docs'] }),
          testItem({ id: 'item-2', title: 'Two' }),
        ],
      });
      await selectRows('One', 'Two');
      await chooseFromMenu('Tags', /Add tag…/);
      const input = await screen.findByRole('searchbox', { name: 'Add tag' });
      await userEvent.type(input, '#q3-carryover {Enter}');
      expect(bulk.updateItems).toHaveBeenCalledWith([
        { itemId: 'item-1', update: { tags: ['docs', 'q3-carryover'] } },
        { itemId: 'item-2', update: { tags: ['q3-carryover'] } },
      ]);
    });

    it('clears all tags via "Remove all tags"', async () => {
      const { bulk } = renderTable({
        items: [
          testItem({ id: 'item-1', title: 'One', tags: ['docs'] }),
          testItem({ id: 'item-2', title: 'Two' }),
        ],
      });
      await selectRows('One', 'Two');
      await chooseFromMenu('Tags', /Remove all tags/);
      expect(bulk.updateItems).toHaveBeenCalledWith([
        { itemId: 'item-1', update: { tags: [] } },
      ]);
    });
  });
});

describe('TableView keyboard', () => {
  function row(name: RegExp) {
    return screen.getByRole('row', { name });
  }

  it('moves the row focus with the arrows, across group boundaries', async () => {
    renderTable({ groupBy: 'tags' });
    // groups: docs (Beta task), then Untagged (Alpha task)
    row(/Beta task/).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(row(/Alpha task/)).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(row(/Beta task/)).toHaveFocus();
    // the top edge keeps the focus in place
    await userEvent.keyboard('{ArrowUp}');
    expect(row(/Beta task/)).toHaveFocus();
    // left and right do not navigate items in the table view
    await userEvent.keyboard('{ArrowLeft}{ArrowRight}');
    expect(row(/Beta task/)).toHaveFocus();
  });

  it('toggles the selection with Space without opening the item', async () => {
    const { openItem } = renderTable();
    row(/Alpha task/).focus();
    await userEvent.keyboard(' ');
    expect(rowCheckbox('Alpha task')).toBeChecked();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await userEvent.keyboard(' ');
    expect(rowCheckbox('Alpha task')).not.toBeChecked();
    expect(openItem).not.toHaveBeenCalled();
  });

  it('opens the item menu with Enter instead of the drawer', async () => {
    const { openItem } = renderTable();
    row(/Alpha task/).focus();
    await userEvent.keyboard('{Enter}');
    expect(
      await screen.findByRole('menuitem', { name: 'Open details' }),
    ).toBeInTheDocument();
    expect(openItem).not.toHaveBeenCalled();
  });

  it('changes the status to the neighbouring column with Alt+Arrow', async () => {
    const { actions } = renderTable();
    row(/Alpha task/).focus(); // item-2, in the first column
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(actions.moveItem).toHaveBeenCalledWith('item-2', {
      columnId: 'column-2',
    });
    (actions.moveItem as jest.Mock).mockClear();
    // no column left of the first one
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(actions.moveItem).not.toHaveBeenCalled();
  });

  it('aliases j/k and jumps with Home/End across the rows', async () => {
    renderTable({ groupBy: 'tags' });
    // groups: docs (Beta task), then Untagged (Alpha task)
    row(/Beta task/).focus();
    await userEvent.keyboard('j');
    expect(row(/Alpha task/)).toHaveFocus();
    await userEvent.keyboard('k');
    expect(row(/Beta task/)).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(row(/Alpha task/)).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(row(/Beta task/)).toHaveFocus();
  });

  it('never reorders from the table with Alt+Up/Down', async () => {
    const { actions } = renderTable();
    row(/Alpha task/).focus();
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(actions.moveItem).not.toHaveBeenCalled();
  });

  it('opens the move picker with s and moves via its entries', async () => {
    const { actions } = renderTable();
    row(/Alpha task/).focus();
    await userEvent.keyboard('s');
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Done' }),
    );
    expect(actions.moveItem).toHaveBeenCalledWith('item-2', {
      columnId: 'column-2',
    });
  });

  it('sets the priority with a digit and archives with Delete', async () => {
    const { actions } = renderTable();
    row(/Alpha task/).focus();
    await userEvent.keyboard('1');
    expect(actions.setItemPriority).toHaveBeenCalledWith(
      'item-2',
      'priority-1',
    );
    await userEvent.keyboard('{Delete}');
    expect(actions.deleteItem).toHaveBeenCalledWith('item-2');
  });

  it('keeps the shortcuts inert on an externally managed row', async () => {
    const { actions } = renderTable({
      items: [
        ...items,
        testItem({ id: 'item-3', title: 'Synced', externalManager: 'jira' }),
      ],
    });
    row(/Synced/).focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Delete}');
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    expect(actions.deleteItem).not.toHaveBeenCalled();
  });
});
