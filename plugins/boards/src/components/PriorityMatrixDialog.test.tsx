import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PriorityMatrixDialog } from './PriorityMatrixDialog';
import {
  renderWithProviders,
  testBoard,
  testColumn,
  testItem,
  testPriorities,
} from './__testUtils__/testHelpers';

const board = testBoard({
  columns: [
    testColumn({ id: 'column-1', title: 'Todo' }),
    testColumn({ id: 'column-2', title: 'Done', position: 2000 }),
  ],
  priorities: testPriorities(),
});

function renderDialog(items: ReturnType<typeof testItem>[]) {
  renderWithProviders(
    <PriorityMatrixDialog
      board={board}
      items={items}
      isOpen
      onOpenChange={jest.fn()}
    />,
  );
}

/** One Todo+critical, one Done+critical, one Todo+low. */
const threeItems = [
  testItem({
    id: 'item-1',
    title: 'Todo critical',
    columnId: 'column-1',
    priorityId: 'priority-1',
  }),
  testItem({
    id: 'item-2',
    title: 'Done critical',
    columnId: 'column-2',
    priorityId: 'priority-1',
  }),
  testItem({
    id: 'item-3',
    title: 'Todo low',
    columnId: 'column-1',
    priorityId: 'priority-4',
  }),
];

/** The cell texts of the row whose header carries `name`. */
function rowCells(name: string): string[] {
  const table = screen.getByRole('table', { name: 'Priority matrix' });
  const row = within(table)
    .getAllByRole('row')
    .find(
      entry => within(entry).queryByRole('rowheader')?.textContent === name,
    );
  if (!row) {
    throw new Error(`row ${name} not found`);
  }
  return within(row)
    .getAllByRole('cell')
    .map(cell => cell.textContent ?? '');
}

describe('PriorityMatrixDialog', () => {
  it('shows counts per cell instead of item buttons', () => {
    renderDialog([
      ...threeItems,
      testItem({
        id: 'item-4',
        title: 'Second todo critical',
        columnId: 'column-1',
        priorityId: 'priority-1',
      }),
    ]);
    // Todo, Done, Sum
    expect(rowCells('critical')).toEqual(['2', '1', '3']);
    expect(screen.queryByText('Todo critical')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Open item/ }),
    ).not.toBeInTheDocument();
  });

  it('sums rows, columns, and the overall total', () => {
    renderDialog(threeItems);
    expect(rowCells('critical')).toEqual(['1', '1', '2']);
    expect(rowCells('low')).toEqual(['1', '0', '1']);
    // sum row: Todo 2, Done 1, total 3
    expect(rowCells('Sum')).toEqual(['2', '1', '3']);
  });

  it('excludes an unselected status from the sums, reversibly', async () => {
    renderDialog(threeItems);
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(done);
    expect(done).toHaveAttribute('aria-pressed', 'false');
    // cell counts stay, sums drop the Done column
    expect(rowCells('critical')).toEqual(['1', '1', '1']);
    expect(rowCells('Sum')).toEqual(['2', '0', '2']);
    await userEvent.click(done);
    expect(rowCells('critical')).toEqual(['1', '1', '2']);
    expect(rowCells('Sum')).toEqual(['2', '1', '3']);
  });

  it('excludes an unselected priority from the sums', async () => {
    renderDialog(threeItems);
    await userEvent.click(screen.getByRole('button', { name: 'low' }));
    expect(rowCells('low')).toEqual(['1', '0', '0']);
    expect(rowCells('Sum')).toEqual(['1', '1', '2']);
  });

  it('counts items without a priority in a trailing toggleable row', async () => {
    renderDialog([
      ...threeItems,
      testItem({ id: 'item-5', title: 'Plain', columnId: 'column-2' }),
    ]);
    expect(rowCells('No priority')).toEqual(['0', '1', '1']);
    expect(rowCells('Sum')).toEqual(['2', '2', '4']);
    await userEvent.click(screen.getByRole('button', { name: 'No priority' }));
    expect(rowCells('No priority')).toEqual(['0', '1', '0']);
    expect(rowCells('Sum')).toEqual(['2', '1', '3']);
  });

  it('offers no no-priority row when every item has one', () => {
    renderDialog(threeItems);
    expect(screen.queryByText('No priority')).not.toBeInTheDocument();
  });
});
