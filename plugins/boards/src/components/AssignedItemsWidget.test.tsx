import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { boardsApiRef } from '../api';
import { rootRouteRef } from '../routes';
import { AssignedItemsContent } from './AssignedItemsWidget';
import {
  renderWithProviders,
  testBoard,
  testBoardsApi,
  testColumn,
  testMyItem,
  testPriority,
} from './__testUtils__/testHelpers';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// "today" for the due filter; the entries below straddle it
const TODAY = '2026-08-27';

const entries = [
  testMyItem({
    boardId: 'board-2',
    boardName: 'Support',
    columnTitle: 'Triage',
    item: { id: 'item-1', title: 'Answer the ticket', dueDate: '2026-08-05' },
  }),
  testMyItem({
    boardId: 'board-1',
    boardName: 'Roadmap',
    columnTitle: 'Todo',
    item: { id: 'item-2', title: 'Fix the build', dueDate: TODAY },
  }),
  testMyItem({
    boardId: 'board-1',
    boardName: 'Roadmap',
    columnTitle: 'Todo',
    item: { id: 'item-3', title: 'Ship the docs', dueDate: '2026-12-24' },
  }),
  testMyItem({
    boardId: 'board-1',
    boardName: 'Roadmap',
    columnTitle: 'In progress',
    item: { id: 'item-4', title: 'Undated chore' },
  }),
];

function renderWidget(
  props: Parameters<typeof AssignedItemsContent>[0] = {},
  over: { items?: unknown[]; error?: Error } = {},
) {
  const listMyItems = over.error
    ? jest.fn().mockRejectedValue(over.error)
    : jest.fn().mockResolvedValue(over.items ?? entries);
  // the drawer host resolves an opened item's board behind the card
  const getBoard = jest.fn().mockImplementation(async (boardId: string) =>
    testBoard({
      id: boardId,
      name: boardId === 'board-1' ? 'Roadmap' : 'Support',
      columns: [testColumn({ boardId })],
      access: 'write',
    }),
  );
  const boardsApi = testBoardsApi({ listMyItems, getBoard });
  renderWithProviders(<AssignedItemsContent {...props} />, {
    apis: [[boardsApiRef, boardsApi]],
    mountedRoutes: { '/boards': rootRouteRef },
  });
  return { boardsApi };
}

describe('AssignedItemsContent', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    jest.useFakeTimers({
      now: new Date(2026, 7, 27),
      doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'nextTick'],
    });
  });

  afterEach(() => jest.useRealTimers());

  it('renders with no props at all, using the documented defaults', async () => {
    // an unconfigured card arrives without any settings prop
    renderWidget();
    // default scope "all": the future and the undated item are included
    expect(
      await screen.findByRole('button', { name: 'Open item Ship the docs' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open item Undated chore' }),
    ).toBeInTheDocument();
    // default grouping "board": board headings are links
    expect(
      screen.getByRole('button', { name: 'Open board Roadmap' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open board Support' }),
    ).toBeInTheDocument();
  });

  it('shows the priority of an item that has one', async () => {
    renderWidget(
      {},
      {
        items: [
          testMyItem({
            item: {
              id: 'item-1',
              title: 'Urgent task',
              priorityId: 'priority-1',
            },
            priority: testPriority(),
          }),
          testMyItem({ item: { id: 'item-2', title: 'Plain task' } }),
        ],
      },
    );
    await screen.findByRole('button', { name: 'Open item Urgent task' });
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('shows a loading state while the items are in flight', () => {
    renderWidget();
    expect(screen.getByText('Loading your items…')).toBeInTheDocument();
  });

  it('reports a failure inside the card', async () => {
    renderWidget({}, { error: new Error('backend is down') });
    expect(
      await screen.findByText(
        /Your items could not be loaded: backend is down/,
      ),
    ).toBeInTheDocument();
  });

  it('says when nothing is assigned', async () => {
    renderWidget({}, { items: [] });
    expect(
      await screen.findByText('Nothing is assigned to you on any board.'),
    ).toBeInTheDocument();
  });

  it('distinguishes "nothing due" from "nothing assigned"', async () => {
    renderWidget(
      { scope: 'due' },
      { items: [entries[2], entries[3]] }, // future + undated only
    );
    expect(
      await screen.findByText('Nothing of yours is due.'),
    ).toBeInTheDocument();
  });

  it('due scope keeps overdue and today, drops future and undated', async () => {
    renderWidget({ scope: 'due' });
    expect(
      await screen.findByRole('button', {
        name: 'Open item Answer the ticket',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open item Fix the build' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open item Ship the docs' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open item Undated chore' }),
    ).not.toBeInTheDocument();
  });

  it('drops a board whose items are all filtered out', async () => {
    renderWidget(
      { scope: 'due', groupBy: 'board' },
      // Support's item is overdue; Roadmap's only item is due in the future
      { items: [entries[0], entries[2]] },
    );
    expect(
      await screen.findByRole('button', { name: 'Open board Support' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open board Roadmap' }),
    ).not.toBeInTheDocument();
  });

  it('groups by status across boards', async () => {
    renderWidget({ groupBy: 'status' });
    // headings, not per-row badges: the status is not repeated on each row
    expect(await screen.findByText('Triage')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getAllByText('Todo')).toHaveLength(1);
  });

  it('groups by due date with the undated group last', async () => {
    renderWidget({ groupBy: 'dueDate' });
    expect(await screen.findByText('No due date')).toBeInTheDocument();
    const headings = screen
      .getAllByText(/^(Aug 5|Aug 27|Dec 24|No due date)$/)
      .map(node => node.textContent);
    expect(headings).toEqual(['Aug 5', 'Aug 27', 'Dec 24', 'No due date']);
  });

  it('opens the item drawer on the homepage', async () => {
    renderWidget();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open item Fix the build' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Item Fix the build' }),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('saves a drawer edit and refreshes the card', async () => {
    const { boardsApi } = renderWidget();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open item Fix the build' }),
    );
    await screen.findByRole('dialog', { name: 'Item Fix the build' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Change due date' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Remove due date' }),
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-2', {
      dueDate: null,
    });
    // the drawer's invalidation reaches the card's listing
    await waitFor(() =>
      expect(boardsApi.listMyItems.mock.calls.length).toBeGreaterThan(1),
    );
  });

  it('opens the board of a group', async () => {
    renderWidget();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open board Support' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/boards/board-2');
  });
});
