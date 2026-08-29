import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { todayISO } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { ItemDrawer } from './ItemDrawer';
import {
  renderWithProviders,
  testBoard,
  testBoardsApi,
  testColumn,
  testItem,
  testPriorities,
} from './__testUtils__/testHelpers';

const catalogApi = {
  getEntities: jest.fn().mockResolvedValue({
    items: [{ kind: 'User', metadata: { namespace: 'default', name: 'bob' } }],
  }),
  getEntitiesByRefs: jest.fn().mockResolvedValue({ items: [] }),
};

const board = testBoard({
  columns: [
    testColumn({ id: 'column-1', title: 'Todo' }),
    testColumn({ id: 'column-2', title: 'Done' }),
  ],
});

const timeline = [
  {
    kind: 'change',
    at: '2026-08-01T10:00:00.000Z',
    change: {
      id: 'change-1',
      actorRef: 'text:Importer',
      type: 'created',
      at: '2026-08-01T10:00:00.000Z',
    },
  },
  {
    kind: 'comment',
    at: '2026-08-05T10:00:00.000Z',
    comment: {
      id: 'comment-1',
      authorRef: 'user:default/jane',
      text: 'Looks good',
      createdAt: '2026-08-05T10:00:00.000Z',
      versionCount: 1,
    },
  },
];

function renderDrawer(
  over: {
    item?: ReturnType<typeof testItem>;
    canWrite?: boolean;
    priorities?: ReturnType<typeof testPriorities>;
  } = {},
) {
  const boardsApi = testBoardsApi({
    getTimeline: jest.fn().mockResolvedValue(timeline),
  });
  const onClose = jest.fn();
  const onChanged = jest.fn().mockResolvedValue(undefined);
  renderWithProviders(
    <ItemDrawer
      board={{ ...board, priorities: over.priorities ?? [] }}
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
    // the status badge is the one place naming the column
    expect(screen.getByText('Todo')).toBeInTheDocument();
    expect(screen.getByText('No due date')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('No description yet.')).toBeInTheDocument();
    expect(await screen.findAllByRole('link', { name: 'alice' })).toHaveLength(
      2,
    );
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

  it('moves the item to another status via the badge', async () => {
    const { boardsApi } = renderDrawer();
    await userEvent.click(
      screen.getByRole('button', { name: 'Change status: Todo' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Done' }),
    );
    expect(boardsApi.moveItem).toHaveBeenCalledWith('board-1', 'item-1', {
      columnId: 'column-2',
    });
  });

  it('offers no priority control on a board without priorities', () => {
    renderDrawer();
    expect(
      screen.queryByRole('button', { name: /Change priority/ }),
    ).not.toBeInTheDocument();
  });

  it('sets the priority from the drawer badge', async () => {
    const { boardsApi } = renderDrawer({ priorities: testPriorities() });
    await userEvent.click(
      screen.getByRole('button', { name: 'Change priority: No priority' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'high' }),
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      priorityId: 'priority-2',
    });
  });

  it('clears the priority via the No priority entry', async () => {
    const { boardsApi } = renderDrawer({
      item: testItem({ priorityId: 'priority-2' }),
      priorities: testPriorities(),
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Change priority: high' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'No priority' }),
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      priorityId: null,
    });
  });

  it('shows plain badges without pickers to readers', () => {
    renderDrawer({
      canWrite: false,
      item: testItem({ priorityId: 'priority-1' }),
      priorities: testPriorities(),
    });
    expect(screen.getByText('Todo')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Change status/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Change priority/ }),
    ).not.toBeInTheDocument();
  });

  it('sets a quick due date from the badge', async () => {
    const { boardsApi } = renderDrawer();
    await userEvent.click(
      screen.getByRole('button', { name: 'Change due date' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Today' }),
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      dueDate: todayISO(),
    });
  });

  it('removes the due date from the badge menu', async () => {
    const { boardsApi } = renderDrawer({
      item: testItem({ dueDate: '2026-09-04' }),
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Change due date' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Remove due date' }),
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      dueDate: null,
    });
  });

  it('picks an arbitrary due date behind Pick a date', async () => {
    const { boardsApi } = renderDrawer();
    await userEvent.click(
      screen.getByRole('button', { name: 'Change due date' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Pick a date…' }),
    );
    fireEvent.change(await screen.findByLabelText('Due date'), {
      target: { value: '2026-09-18' },
    });
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      dueDate: '2026-09-18',
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
    await userEvent.type(screen.getByRole('searchbox'), 'frontend{Enter}');
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      tags: ['frontend'],
    });
  });

  it('saves checklist changes', async () => {
    const { boardsApi } = renderDrawer({
      item: testItem({
        checklist: [{ text: 'write docs', checked: false }],
      }),
    });
    await userEvent.click(
      screen.getByRole('checkbox', { name: /"write docs" as done/ }),
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      checklist: [{ text: 'write docs', checked: true }],
    });
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Add checklist entry' }),
      'announce{Enter}',
    );
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      checklist: [
        { text: 'write docs', checked: false },
        { text: 'announce', checked: false },
      ],
    });
  });

  it('shows the checklist read-only on externally managed items', () => {
    renderDrawer({
      item: testItem({
        externalManager: 'jira',
        checklist: [{ text: 'write docs', checked: true }],
      }),
    });
    expect(
      screen.getByRole('checkbox', { name: /"write docs" as not done/ }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('textbox', { name: 'Add checklist entry' }),
    ).not.toBeInTheDocument();
  });

  it('offers the item menu without Open details and no standalone delete button', async () => {
    renderDrawer({ priorities: testPriorities() });
    expect(
      screen.queryByRole('button', { name: 'Delete item' }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Actions for Ship the docs' }),
    );
    expect(
      (await screen.findAllByRole('menuitem')).map(entry => entry.textContent),
    ).toEqual([
      'Move to column',
      'Due date',
      'Priority',
      'Assignee',
      'Delete item',
    ]);
  });

  it('deletes the item from the menu and closes', async () => {
    const { boardsApi, onClose } = renderDrawer();
    await userEvent.click(
      screen.getByRole('button', { name: 'Actions for Ship the docs' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Delete item' }),
    );
    expect(boardsApi.deleteItem).toHaveBeenCalledWith('board-1', 'item-1');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('moves the item from the menu', async () => {
    const { boardsApi } = renderDrawer();
    await userEvent.click(
      screen.getByRole('button', { name: 'Actions for Ship the docs' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Move to column' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Done' }),
    );
    expect(boardsApi.moveItem).toHaveBeenCalledWith('board-1', 'item-1', {
      columnId: 'column-2',
    });
  });

  it('hides the item menu from readers', () => {
    renderDrawer({ canWrite: false });
    expect(
      screen.queryByRole('button', { name: 'Actions for Ship the docs' }),
    ).not.toBeInTheDocument();
  });

  it('groups the drawer into headlined sections, tags before description', () => {
    renderDrawer();
    for (const title of [
      'Details',
      'Tags',
      'Description',
      'Checklist',
      'Activity',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    const tags = screen.getByRole('heading', { name: 'Tags' });
    const description = screen.getByRole('heading', { name: 'Description' });
    expect(
      tags.compareDocumentPosition(description) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps the watch control in the header', () => {
    renderDrawer();
    const watch = screen.getByRole('button', { name: 'Watch this item' });
    const details = screen.getByRole('heading', { name: 'Details' });
    // the watch button renders in the header, above every section
    expect(
      watch.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows the activity timeline with comments and changes, newest first', async () => {
    renderDrawer();
    const comment = await screen.findByText('Looks good');
    expect(screen.getByText('Importer')).toBeInTheDocument();
    const change = screen.getByText(/created this item/);
    // the older change entry renders below the newer comment
    expect(
      comment.compareDocumentPosition(change) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('places the comment composer above the timeline', async () => {
    renderDrawer();
    await screen.findByText('Looks good');
    const composer = screen.getByRole('textbox', { name: 'New comment' });
    const tabs = screen.getByRole('tab', { name: 'Combined' });
    expect(
      composer.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
      screen.queryByRole('button', { name: /Actions for/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Change status/ }),
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
