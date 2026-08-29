import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineEntry } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { ActivityBlock } from './ItemTimeline';
import {
  renderWithProviders,
  testBoardsApi,
} from './__testUtils__/testHelpers';

const entries: TimelineEntry[] = [
  {
    kind: 'change',
    at: '2026-08-01T10:00:00.000Z',
    change: {
      id: 'change-1',
      itemId: 'item-1',
      boardId: 'board-1',
      actorRef: 'text:Importer',
      at: '2026-08-01T10:00:00.000Z',
      type: 'created',
    },
  },
  {
    kind: 'comment',
    at: '2026-08-05T10:00:00.000Z',
    comment: {
      id: 'comment-1',
      itemId: 'item-1',
      authorRef: 'user:default/jane',
      createdAt: '2026-08-05T10:00:00.000Z',
      text: 'Looks good',
      versionCount: 1,
    },
  },
  {
    kind: 'change',
    at: '2026-08-07T10:00:00.000Z',
    change: {
      id: 'change-2',
      itemId: 'item-1',
      boardId: 'board-1',
      actorRef: 'user:default/jane',
      at: '2026-08-07T10:00:00.000Z',
      type: 'moved',
      oldValue: 'Todo',
      newValue: 'Doing',
    },
  },
];

function renderBlock(composer?: React.ReactNode) {
  renderWithProviders(
    <ActivityBlock
      boardId="board-1"
      itemId="item-1"
      entries={entries}
      canWrite
      onChanged={jest.fn().mockResolvedValue(undefined)}
      composer={composer}
    />,
    { apis: [[boardsApiRef, testBoardsApi()]] },
  );
}

/** The visible order of the given snippets inside the active tab panel. */
function panelOrder(...snippets: string[]) {
  const text = screen.getByRole('tabpanel').textContent ?? '';
  const positions = snippets.map(snippet => text.indexOf(snippet));
  positions.forEach(position => expect(position).toBeGreaterThanOrEqual(0));
  return positions;
}

describe('ActivityBlock', () => {
  it('shows the combined timeline newest first by default', () => {
    renderBlock();
    expect(screen.getByRole('tab', { name: 'Combined' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const [moved, commented, created] = panelOrder(
      'moved this item',
      'Looks good',
      'created this item',
    );
    expect(moved).toBeLessThan(commented);
    expect(commented).toBeLessThan(created);
  });

  it('shows only comments on the Comments tab', async () => {
    renderBlock();
    await userEvent.click(screen.getByRole('tab', { name: 'Comments' }));
    expect(screen.getByText('Looks good')).toBeInTheDocument();
    expect(screen.queryByText(/created this item/)).not.toBeInTheDocument();
    expect(screen.queryByText(/moved this item/)).not.toBeInTheDocument();
  });

  it('shows only changes on the Changes tab', async () => {
    renderBlock();
    await userEvent.click(screen.getByRole('tab', { name: 'Changes' }));
    expect(screen.getByText(/created this item/)).toBeInTheDocument();
    expect(screen.getByText(/moved this item/)).toBeInTheDocument();
    expect(screen.queryByText('Looks good')).not.toBeInTheDocument();
  });

  it('flips the ordering with the toggle, across tabs', async () => {
    renderBlock();
    await userEvent.click(screen.getByRole('button', { name: 'Newest first' }));
    expect(
      screen.getByRole('button', { name: 'Oldest first' }),
    ).toBeInTheDocument();
    const [created, commented] = panelOrder('created this item', 'Looks good');
    expect(created).toBeLessThan(commented);

    // the chosen ordering carries over to the filtered tabs
    await userEvent.click(screen.getByRole('tab', { name: 'Changes' }));
    const [createdChange, movedChange] = panelOrder(
      'created this item',
      'moved this item',
    );
    expect(createdChange).toBeLessThan(movedChange);
  });
});

describe('ActivityBlock composer placement', () => {
  const composer = <div>THE COMPOSER</div>;

  it('renders the composer before the list when newest first', () => {
    renderBlock(composer);
    const [composerAt, newest] = panelOrder('THE COMPOSER', 'moved this item');
    expect(composerAt).toBeLessThan(newest);
  });

  it('moves the composer after the list when oldest first', async () => {
    renderBlock(composer);
    await userEvent.click(screen.getByRole('button', { name: 'Newest first' }));
    const [oldest, composerAt] = panelOrder(
      'created this item',
      'THE COMPOSER',
    );
    expect(oldest).toBeLessThan(composerAt);
  });

  it('shows the composer on the Comments tab but not on Changes', async () => {
    renderBlock(composer);
    await userEvent.click(screen.getByRole('tab', { name: 'Comments' }));
    expect(screen.getByText('THE COMPOSER')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Changes' }));
    expect(screen.queryByText('THE COMPOSER')).not.toBeInTheDocument();
  });
});
