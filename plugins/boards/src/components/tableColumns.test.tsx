import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { storageApiRef } from '@backstage/frontend-plugin-api';
import { mockApis } from '@backstage/frontend-test-utils';
import {
  ColumnsMenu,
  DEFAULT_VISIBLE_COLUMNS,
  TableColumnId,
  useVisibleColumns,
} from './tableColumns';
import { renderWithProviders } from './__testUtils__/testHelpers';

/** Renders the hook plus menu together, the way the tables use them. */
function Harness(props: { columnsKey: string; showPriority?: boolean }) {
  const [visible, toggle] = useVisibleColumns(props.columnsKey);
  return (
    <>
      <div data-testid="visible">{[...visible].sort().join(',')}</div>
      <ColumnsMenu
        visible={visible}
        onToggle={toggle}
        showPriority={props.showPriority ?? true}
      />
    </>
  );
}

function bucket(storage: ReturnType<typeof mockApis.storage>) {
  return storage.forBucket('boards-table-columns');
}

function renderHarness(
  storage: ReturnType<typeof mockApis.storage>,
  columnsKey = 'board-1',
  showPriority?: boolean,
) {
  renderWithProviders(
    <Harness columnsKey={columnsKey} showPriority={showPriority} />,
    { apis: [[storageApiRef, storage]] },
  );
}

const visibleIds = () =>
  (screen.getByTestId('visible').textContent ?? '').split(',');

describe('useVisibleColumns + ColumnsMenu', () => {
  it('shows the defaults when nothing is stored', () => {
    renderHarness(mockApis.storage());
    expect(visibleIds().sort()).toEqual([...DEFAULT_VISIBLE_COLUMNS].sort());
  });

  it('honors a stored choice and drops unknown ids', () => {
    const storage = mockApis.storage();
    bucket(storage).set('board-1', ['status', 'createdAt', 'bogus']);
    renderHarness(storage);
    expect(visibleIds().sort()).toEqual(['createdAt', 'status', 'title']);
  });

  it('keys the choice per board', () => {
    const storage = mockApis.storage();
    bucket(storage).set('board-other', ['status']);
    renderHarness(storage, 'board-1');
    expect(visibleIds().sort()).toEqual([...DEFAULT_VISIBLE_COLUMNS].sort());
  });

  it('toggles a column and persists the new set', async () => {
    const storage = mockApis.storage();
    renderHarness(storage);
    await userEvent.click(
      screen.getByRole('button', { name: 'Configure columns' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Created' }));
    expect(visibleIds()).toContain('createdAt');
    expect(bucket(storage).snapshot<TableColumnId[]>('board-1').value).toEqual([
      'title',
      'status',
      'priority',
      'dueDate',
      'assignees',
      'tags',
      'createdAt',
    ]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Configure columns' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: '✓ Tags' }));
    expect(visibleIds()).not.toContain('tags');
    expect(
      bucket(storage).snapshot<TableColumnId[]>('board-1').value,
    ).not.toContain('tags');
  });

  it('marks visible columns and never offers Title', async () => {
    renderHarness(mockApis.storage());
    await userEvent.click(
      screen.getByRole('button', { name: 'Configure columns' }),
    );
    const entries = screen
      .getAllByRole('menuitem')
      .map(entry => entry.textContent);
    expect(entries).toEqual([
      '✓ Status',
      '✓ Priority',
      '✓ Due',
      '✓ Assignees',
      '✓ Tags',
      'Created by',
      'Created',
      'Updated by',
      'Updated',
    ]);
  });

  it('hides the priority entry when the view has no priorities', async () => {
    renderHarness(mockApis.storage(), 'board-1', false);
    await userEvent.click(
      screen.getByRole('button', { name: 'Configure columns' }),
    );
    expect(
      screen.queryByRole('menuitem', { name: /Priority/ }),
    ).not.toBeInTheDocument();
  });
});
