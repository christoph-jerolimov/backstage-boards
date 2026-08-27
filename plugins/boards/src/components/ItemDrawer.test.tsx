import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { BoardWithContext } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { ItemDrawer } from './ItemDrawer';
import {
  renderWithProviders,
  testBoardsApi,
  testColumn,
  testItem,
} from './__testUtils__/testHelpers';

const catalogApi = {
  getEntities: jest.fn().mockResolvedValue({
    items: [{ kind: 'User', metadata: { namespace: 'default', name: 'bob' } }],
  }),
  getEntitiesByRefs: jest.fn().mockResolvedValue({ items: [] }),
};

const board = {
  id: 'board-1',
  name: 'Roadmap',
  access: 'admin',
  columns: [
    testColumn({ id: 'column-1', title: 'Todo' }),
    testColumn({ id: 'column-2', title: 'Done' }),
  ],
} as unknown as BoardWithContext;

const timeline = [
  {
    kind: 'comment',
    comment: {
      id: 'comment-1',
      authorRef: 'user:default/jane',
      text: 'Looks good',
      createdAt: '2026-08-05T10:00:00.000Z',
      versionCount: 1,
    },
  },
  {
    kind: 'change',
    change: {
      id: 'change-1',
      actorRef: 'text:Importer',
      type: 'created',
      at: '2026-08-01T10:00:00.000Z',
    },
  },
];

function renderDrawer(
  over: { item?: ReturnType<typeof testItem>; canWrite?: boolean } = {},
) {
  const boardsApi = testBoardsApi({
    getTimeline: jest.fn().mockResolvedValue(timeline),
  } as any);
  const onClose = jest.fn();
  const onChanged = jest.fn().mockResolvedValue(undefined);
  renderWithProviders(
    <ItemDrawer
      board={board}
      item={over.item ?? testItem({ title: 'Ship the docs' })}
      canWrite={over.canWrite ?? true}
      tagSuggestions={['docs']}
      onClose={onClose}
      onChanged={onChanged}
    />,
    {
      apis: [
        [boardsApiRef, boardsApi],
        [catalogApiRef, catalogApi],
      ],
    },
  );
  return { boardsApi, onClose, onChanged };
}

describe('ItemDrawer', () => {
  it('shows the item with its status, dates and authors', async () => {
    renderDrawer({ item: testItem({ title: 'Ship the docs' }) });
    expect(
      screen.getByRole('dialog', { name: 'Item Ship the docs' }),
    ).toBeInTheDocument();
    // the status badge and the status select both name the column
    expect(screen.getAllByText('Todo').length).toBeGreaterThan(0);
    expect(screen.getByText('No due date')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('No description yet.')).toBeInTheDocument();
    expect(await screen.findAllByRole('link', { name: 'alice' })).toHaveLength(2);
  });

  it('closes on the close button, the backdrop and Escape', async () => {
    const { onClose } = renderDrawer();
    await userEvent.click(
      screen.getByRole('button', { name: 'Close item details' }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renames the item', async () => {
    const { boardsApi } = renderDrawer();
    await userEvent.click(
      screen.getByRole('button', { name: 'Edit item title' }),
    );
    const field = screen.getByRole('textbox', { name: 'item title' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Renamed{Enter}');
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      title: 'Renamed',
    });
  });

  it('moves the item to another status', async () => {
    const { boardsApi } = renderDrawer();
    await userEvent.click(screen.getByRole('button', { name: /Status/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Done' }));
    expect(boardsApi.moveItem).toHaveBeenCalledWith('board-1', 'item-1', {
      columnId: 'column-2',
    });
  });

  it('sets and clears the due date', async () => {
    const { boardsApi } = renderDrawer({
      item: testItem({ dueDate: '2026-09-04' }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      dueDate: null,
    });
  });

  it('removes an assignee', async () => {
    const { boardsApi } = renderDrawer({
      item: testItem({ assignees: ['text:Contractor'] }),
    });
    expect(screen.getByText('Contractor')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove assignee text:Contractor' }),
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      assignees: [],
    });
  });

  it('adds an assignee from the catalog', async () => {
    const { boardsApi } = renderDrawer();
    await userEvent.type(
      screen.getByRole('combobox', { name: 'Add assignee' }),
      'bob',
    );
    await userEvent.click(
      await screen.findByRole('option', { name: 'bob (user:default/bob)' }),
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      assignees: ['user:default/bob'],
    });
  });

  it('saves the description', async () => {
    const { boardsApi } = renderDrawer();
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Edit description' }),
      'Some details',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      description: 'Some details',
    });
  });

  it('saves the tags', async () => {
    const { boardsApi } = renderDrawer();
    await userEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    await userEvent.type(
      screen.getByRole('searchbox'),
      'frontend{Enter}',
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      tags: ['frontend'],
    });
  });

  it('deletes the item and closes', async () => {
    const { boardsApi, onClose } = renderDrawer();
    await userEvent.click(screen.getByRole('button', { name: 'Delete item' }));
    expect(boardsApi.deleteItem).toHaveBeenCalledWith('board-1', 'item-1');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows the activity timeline with comments and changes', async () => {
    renderDrawer();
    expect(await screen.findByText('Looks good')).toBeInTheDocument();
    expect(screen.getByText('Importer')).toBeInTheDocument();
    expect(screen.getByText(/created this item/)).toBeInTheDocument();
  });

  it('adds a comment', async () => {
    const { boardsApi } = renderDrawer();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'New comment' }),
      'Nice work',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
    expect(boardsApi.addComment).toHaveBeenCalledWith(
      'board-1',
      'item-1',
      'Nice work',
    );
  });

  it('does not add an empty comment', async () => {
    const { boardsApi } = renderDrawer();
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
    expect(boardsApi.addComment).not.toHaveBeenCalled();
  });

  it('watches and unwatches the item', async () => {
    const { boardsApi } = renderDrawer();
    await userEvent.click(
      screen.getByRole('button', { name: 'Watch this item' }),
    );
    expect(boardsApi.setWatchItem).toHaveBeenCalledWith(
      'board-1',
      'item-1',
      true,
    );
  });

  it('is read-only for externally managed items', () => {
    renderDrawer({
      item: testItem({ externalManager: 'jira', assignees: ['text:Bob'] }),
    });
    expect(
      screen.getByText('This item is managed by “jira” and read-only.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete item' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Add assignee' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit item title' }),
    ).not.toBeInTheDocument();
  });

  it('hides the comment box from readers', () => {
    renderDrawer({ canWrite: false });
    expect(
      screen.queryByRole('textbox', { name: 'New comment' }),
    ).not.toBeInTheDocument();
  });
});
