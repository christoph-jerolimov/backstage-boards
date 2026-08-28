import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { AssigneeMatrixDialog } from './AssigneeMatrixDialog';
import {
  renderWithProviders,
  testBoard,
  testColumn,
  testItem,
} from './__testUtils__/testHelpers';

const ALICE = 'user:default/alice';
const BOB = 'user:default/bob';

const board = testBoard({
  columns: [
    testColumn({ id: 'column-1', title: 'Todo' }),
    testColumn({ id: 'column-2', title: 'Done', position: 2000 }),
  ],
});

function renderDialog(items: ReturnType<typeof testItem>[], catalog?: unknown) {
  renderWithProviders(
    <AssigneeMatrixDialog
      board={board}
      items={items}
      isOpen
      onOpenChange={jest.fn()}
    />,
    catalog ? { apis: [[catalogApiRef, catalog]] } : undefined,
  );
}

/** The dialog behind an opener, so a test can close and reopen it. */
function ReopenableDialog(props: { items: ReturnType<typeof testItem>[] }) {
  const [isOpen, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open dialog
      </button>
      <AssigneeMatrixDialog
        board={board}
        items={props.items}
        isOpen={isOpen}
        onOpenChange={setOpen}
      />
    </>
  );
}

/** One Todo for Alice, one Done for Alice, one Todo for Bob. */
const threeItems = [
  testItem({
    id: 'item-1',
    title: 'Alice todo',
    columnId: 'column-1',
    assignees: [ALICE],
  }),
  testItem({
    id: 'item-2',
    title: 'Alice done',
    columnId: 'column-2',
    assignees: [ALICE],
  }),
  testItem({
    id: 'item-3',
    title: 'Bob todo',
    columnId: 'column-1',
    assignees: [BOB],
  }),
];

/** The cell texts of the row whose header carries `name`. */
function rowCells(name: string): string[] {
  const table = screen.getByRole('table', { name: 'Assignee matrix' });
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

/** The row header names, top to bottom, without the trailing sum row. */
function rowNames(): string[] {
  const table = screen.getByRole('table', { name: 'Assignee matrix' });
  return within(table)
    .getAllByRole('rowheader')
    .map(header => header.textContent ?? '')
    .filter(name => name !== 'Sum');
}

describe('AssigneeMatrixDialog', () => {
  it('shows counts per cell instead of item buttons', () => {
    renderDialog([
      ...threeItems,
      testItem({
        id: 'item-4',
        title: 'Second Alice todo',
        columnId: 'column-1',
        assignees: [ALICE],
      }),
    ]);
    // Todo, Done, Sum
    expect(rowCells('alice')).toEqual(['2', '1', '3']);
    expect(screen.queryByText('Alice todo')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Open item/ }),
    ).not.toBeInTheDocument();
  });

  it('sums rows, columns, and the overall total', () => {
    renderDialog(threeItems);
    expect(rowCells('alice')).toEqual(['1', '1', '2']);
    expect(rowCells('bob')).toEqual(['1', '0', '1']);
    // sum row: Todo 2, Done 1, total 3
    expect(rowCells('Sum')).toEqual(['2', '1', '3']);
  });

  it('counts an item with two assignees in both rows', () => {
    renderDialog([
      testItem({
        id: 'item-1',
        title: 'Shared',
        columnId: 'column-1',
        assignees: [ALICE, BOB],
      }),
    ]);
    expect(rowCells('alice')).toEqual(['1', '0', '1']);
    expect(rowCells('bob')).toEqual(['1', '0', '1']);
    // one item, counted for each of its two assignees
    expect(rowCells('Sum')).toEqual(['2', '0', '2']);
    expect(
      screen.getByText(/several assignees counts for each of them/),
    ).toBeInTheDocument();
  });

  it('counts items without an assignee in a trailing toggleable row', async () => {
    renderDialog([
      ...threeItems,
      testItem({ id: 'item-5', title: 'Nobody', columnId: 'column-2' }),
    ]);
    expect(rowNames()).toEqual(['alice', 'bob', 'Unassigned']);
    expect(rowCells('Unassigned')).toEqual(['0', '1', '1']);
    expect(rowCells('Sum')).toEqual(['2', '2', '4']);
    await userEvent.click(screen.getByRole('button', { name: 'Unassigned' }));
    expect(rowCells('Unassigned')).toEqual(['0', '1', '0']);
    expect(rowCells('Sum')).toEqual(['2', '1', '3']);
  });

  it('offers no unassigned row when every item has an assignee', () => {
    renderDialog(threeItems);
    expect(screen.queryByText('Unassigned')).not.toBeInTheDocument();
  });

  it('excludes an unselected status from the sums, reversibly', async () => {
    renderDialog(threeItems);
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(done);
    expect(done).toHaveAttribute('aria-pressed', 'false');
    // cell counts stay, sums drop the Done column
    expect(rowCells('alice')).toEqual(['1', '1', '1']);
    expect(rowCells('Sum')).toEqual(['2', '0', '2']);
    await userEvent.click(done);
    expect(rowCells('alice')).toEqual(['1', '1', '2']);
    expect(rowCells('Sum')).toEqual(['2', '1', '3']);
  });

  it('excludes an unselected assignee from the sums', async () => {
    renderDialog(threeItems);
    await userEvent.click(screen.getByRole('button', { name: 'bob' }));
    expect(rowCells('bob')).toEqual(['1', '0', '0']);
    expect(rowCells('Sum')).toEqual(['1', '1', '2']);
  });

  it('starts fully selected again when reopened', async () => {
    renderWithProviders(<ReopenableDialog items={threeItems} />);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(rowCells('Sum')).toEqual(['2', '0', '2']);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'open dialog' }),
    );
    expect(await screen.findByRole('button', { name: 'Done' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(rowCells('Sum')).toEqual(['2', '1', '3']);
  });

  it('labels assignees by their catalog display name and text refs by their text', async () => {
    const catalog = {
      getEntitiesByRefs: async (request: { entityRefs: string[] }) => ({
        items: request.entityRefs.map(ref =>
          ref === ALICE
            ? {
                kind: 'User',
                metadata: { name: 'alice' },
                spec: { profile: { displayName: 'Alice Anderson' } },
              }
            : undefined,
        ),
      }),
    };
    renderDialog(
      [
        testItem({ id: 'item-1', columnId: 'column-1', assignees: [ALICE] }),
        testItem({
          id: 'item-2',
          columnId: 'column-1',
          assignees: ['text:Jane (agency)'],
        }),
      ],
      catalog,
    );
    expect(
      await screen.findByRole('button', { name: 'Alice Anderson' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Jane (agency)' }),
    ).toBeInTheDocument();
    // the full ref stays reachable on the badge
    expect(
      screen.getByRole('button', { name: 'Alice Anderson' }),
    ).toHaveAttribute('title', ALICE);
  });
});
