import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardInsights } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { InsightsView, formatHours } from './InsightsView';
import {
  renderWithProviders,
  testBoard,
  testBoardsApi,
} from './__testUtils__/testHelpers';

const insights: BoardInsights = {
  columns: [
    { columnId: 'column-1', title: 'Todo', color: 'blue' },
    { columnId: 'column-2', title: 'Done', color: 'green' },
  ],
  cycleTimes: [
    {
      columnId: 'column-1',
      title: 'Todo',
      color: 'blue',
      stays: 3,
      averageHours: 48,
      medianHours: 36,
    },
    {
      columnId: 'column-2',
      title: 'Done',
      stays: 0,
      averageHours: 0,
      medianHours: 0,
    },
  ],
  cumulativeFlow: [
    { date: '2026-08-01', counts: { 'column-1': 2, 'column-2': 0 } },
    { date: '2026-08-02', counts: { 'column-1': 1, 'column-2': 1 } },
  ],
  throughput: [
    { weekStart: '2026-08-17', count: 0 },
    { weekStart: '2026-08-24', count: 3 },
  ],
  moveCount: 4,
};

function render(over: Partial<BoardInsights> = {}) {
  const boardsApi = testBoardsApi();
  (boardsApi.getBoardInsights as jest.Mock).mockResolvedValue({
    ...insights,
    ...over,
  });
  const onOpenDialog = jest.fn();
  renderWithProviders(
    <InsightsView board={testBoard()} onOpenDialog={onOpenDialog} />,
    { apis: [[boardsApiRef, boardsApi]] },
  );
  return { onOpenDialog };
}

describe('InsightsView', () => {
  it('renders the three charts from the aggregates', async () => {
    render();
    expect(await screen.findByTestId('cycle-time-chart')).toBeInTheDocument();
    expect(screen.getByTestId('throughput-chart')).toBeInTheDocument();
    expect(screen.getByTestId('cumulative-flow-chart')).toBeInTheDocument();
    expect(screen.getByText('avg 2d · median 36h · 3')).toBeInTheDocument();
    expect(screen.getByText('no completed stays')).toBeInTheDocument();
    // throughput labels the weekly counts
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('opens the matrix dialogs', async () => {
    const { onOpenDialog } = render();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Assignee matrix' }),
    );
    expect(onOpenDialog).toHaveBeenCalledWith('assigneeMatrix');
    await userEvent.click(
      screen.getByRole('button', { name: 'Priority matrix' }),
    );
    expect(onOpenDialog).toHaveBeenCalledWith('priorityMatrix');
  });

  it('shows an empty state without any recorded moves', async () => {
    render({ moveCount: 0 });
    expect(await screen.findByText('No flow history yet')).toBeInTheDocument();
    expect(screen.queryByTestId('cycle-time-chart')).not.toBeInTheDocument();
  });
});

describe('formatHours', () => {
  it('picks minutes, hours, or days', () => {
    expect(formatHours(0.5)).toBe('30m');
    expect(formatHours(36)).toBe('36h');
    expect(formatHours(72)).toBe('3d');
  });
});
