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
  const onOpenItem = jest.fn();
  renderWithProviders(
    <PriorityMatrixDialog
      board={board}
      items={items}
      isOpen
      onOpenChange={jest.fn()}
      onOpenItem={onOpenItem}
    />,
  );
  return { onOpenItem };
}

describe('PriorityMatrixDialog', () => {
  it('places items in their status × priority cell', () => {
    renderDialog([
      testItem({
        id: 'item-1',
        title: 'Urgent todo',
        columnId: 'column-1',
        priorityId: 'priority-1',
      }),
      testItem({
        id: 'item-2',
        title: 'Done low',
        columnId: 'column-2',
        priorityId: 'priority-4',
      }),
    ]);
    const table = screen.getByRole('table', { name: 'Priority matrix' });
    const rows = within(table).getAllByRole('row');
    // header, four priorities; no "No priority" row: every item has one
    expect(rows).toHaveLength(5);
    const critical = rows[1];
    const cells = within(critical).getAllByRole('cell');
    expect(within(cells[0]).getByText('Urgent todo')).toBeInTheDocument();
    expect(cells[1].textContent).toBe('');
    const low = rows[4];
    expect(
      within(within(low).getAllByRole('cell')[1]).getByText('Done low'),
    ).toBeInTheDocument();
  });

  it('collects items without a priority in a trailing row', () => {
    renderDialog([
      testItem({ id: 'item-1', title: 'Plain', columnId: 'column-1' }),
    ]);
    const table = screen.getByRole('table', { name: 'Priority matrix' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(6);
    const last = rows[rows.length - 1];
    expect(within(last).getByText('No priority')).toBeInTheDocument();
    expect(within(last).getByText('Plain')).toBeInTheDocument();
  });

  it('opens an item from its cell', async () => {
    const { onOpenItem } = renderDialog([
      testItem({
        id: 'item-1',
        title: 'Urgent todo',
        columnId: 'column-1',
        priorityId: 'priority-1',
      }),
    ]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Open item Urgent todo' }),
    );
    expect(onOpenItem).toHaveBeenCalledWith('item-1');
  });
});
