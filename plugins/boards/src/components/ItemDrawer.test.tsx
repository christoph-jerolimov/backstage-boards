import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { storageApiRef } from '@backstage/frontend-plugin-api';
import { mockApis } from '@backstage/frontend-test-utils';
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
  typeIntoRichText,
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
    storage?: ReturnType<typeof mockApis.storage>;
    nav?: {
      prevId?: string;
      nextId?: string;
      position: number;
      total: number;
    };
  } = {},
) {
  const boardsApi = testBoardsApi({
    getTimeline: jest.fn().mockResolvedValue(timeline),
    addComment: jest.fn().mockResolvedValue(undefined),
  });
  const storage = over.storage ?? mockApis.storage();
  const onClose = jest.fn();
  const onChanged = jest.fn().mockResolvedValue(undefined);
  const onNavigate = jest.fn();
  renderWithProviders(
    <ItemDrawer
      board={{ ...board, priorities: over.priorities ?? [] }}
      item={over.item ?? testItem({ title: 'Ship the docs' })}
      canWrite={over.canWrite ?? true}
      tagSuggestions={['docs']}
      nav={over.nav === undefined ? undefined : { ...over.nav, onNavigate }}
      onClose={onClose}
      onChanged={onChanged}
    />,
    {
      apis: [
        [boardsApiRef, boardsApi],
        [catalogApiRef, catalogApi],
        [storageApiRef, storage],
      ],
    },
  );
  return { boardsApi, onClose, onChanged, storage, onNavigate };
}

/** The bucket the drawer keeps unsent input in. */
function draftsBucket(storage: ReturnType<typeof mockApis.storage>) {
  return storage.forBucket('boards-item-drafts');
}

describe('ItemDrawer navigation', () => {
  const nav = { prevId: 'item-0', nextId: 'item-2', position: 2, total: 3 };

  it('walks with the header arrows and shows the position', async () => {
    const { onNavigate } = renderDrawer({ nav });
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Previous item' }),
    );
    expect(onNavigate).toHaveBeenCalledWith('item-0');
    await userEvent.click(screen.getByRole('button', { name: 'Next item' }));
    expect(onNavigate).toHaveBeenCalledWith('item-2');
  });

  it('disables the arrows at the ends', () => {
    renderDrawer({ nav: { position: 1, total: 1 } });
    expect(
      screen.getByRole('button', { name: 'Previous item' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next item' })).toBeDisabled();
  });

  it('navigates with j and k', async () => {
    const { onNavigate } = renderDrawer({ nav });
    await userEvent.keyboard('j');
    expect(onNavigate).toHaveBeenCalledWith('item-2');
    await userEvent.keyboard('k');
    expect(onNavigate).toHaveBeenCalledWith('item-0');
  });

  it('never navigates while typing', async () => {
    const { onNavigate } = renderDrawer({ nav });
    const comment = await screen.findByPlaceholderText(/Write a comment/);
    await userEvent.type(comment, 'jk');
    expect(onNavigate).not.toHaveBeenCalled();
    expect(comment).toHaveValue('jk');
  });

  it('offers no navigation without a nav prop', () => {
    renderDrawer();
    expect(
      screen.queryByRole('button', { name: 'Next item' }),
    ).not.toBeInTheDocument();
  });
});

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
    // no created-by/updated-by metadata block anymore
    expect(await screen.findByText('Looks good')).toBeInTheDocument();
    expect(screen.queryByText(/Created by/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Updated by/)).not.toBeInTheDocument();
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
    typeIntoRichText(
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
      'Copy link',
      'Move to column',
      'Due date',
      'Priority',
      'Assignee',
      'Duplicate item',
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

  it('groups the drawer into sections with a field table, no Activity heading', () => {
    renderDrawer();
    for (const title of ['Details', 'Description', 'Checklist']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    // assignees and tags are labelled table rows, not headlined sections
    expect(screen.getByText('Assignees')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Tags' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Activity' }),
    ).not.toBeInTheDocument();
    const tags = screen.getByText('Tags');
    const description = screen.getByRole('heading', { name: 'Description' });
    expect(
      tags.compareDocumentPosition(description) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('offers the description controls beside its heading', () => {
    renderDrawer();
    const headingRow = screen.getByRole('heading', { name: 'Description' })
      .parentElement as HTMLElement;
    // empty description offers "Add"; the button sits in the heading row
    expect(
      within(headingRow).getByRole('button', { name: 'Add' }),
    ).toBeInTheDocument();
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

  it('places the composer in the tab panel, beside where the comment lands', async () => {
    renderDrawer();
    await screen.findByText('Looks good');
    const panel = screen.getByRole('tabpanel');
    // newest first: the composer comes before the newest entry
    const composer = within(panel).getByRole('textbox', {
      name: 'New comment',
    });
    expect(
      composer.compareDocumentPosition(screen.getByText('Looks good')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // oldest first: the composer moves after the timeline
    await userEvent.click(screen.getByRole('button', { name: 'Newest first' }));
    const flipped = screen.getByRole('textbox', { name: 'New comment' });
    expect(
      screen.getByText('Looks good').compareDocumentPosition(flipped) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('hides the composer on the Changes tab', async () => {
    renderDrawer();
    await screen.findByText('Looks good');
    await userEvent.click(screen.getByRole('tab', { name: 'Changes' }));
    expect(
      screen.queryByRole('textbox', { name: 'New comment' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Comments' }));
    expect(
      screen.getByRole('textbox', { name: 'New comment' }),
    ).toBeInTheDocument();
  });

  it('persists the comment draft until the comment is added', async () => {
    const storage = mockApis.storage();
    const { boardsApi } = renderDrawer({ storage });
    await screen.findByText('Looks good');
    typeIntoRichText(
      screen.getByRole('textbox', { name: 'New comment' }),
      'half a thought',
    );
    await waitFor(() =>
      expect(
        draftsBucket(storage).snapshot<string>('comment-board-1-item-1').value,
      ).toBe('half a thought'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
    expect(boardsApi.addComment).toHaveBeenCalledWith(
      'board-1',
      'item-1',
      'half a thought',
    );
    await waitFor(() =>
      expect(
        draftsBucket(storage).snapshot('comment-board-1-item-1').presence,
      ).toBe('absent'),
    );
  });

  it('restores a stored comment draft', async () => {
    const storage = mockApis.storage();
    draftsBucket(storage).set('comment-board-1-item-1', 'unsent words');
    renderDrawer({ storage });
    await screen.findByText('Looks good');
    expect(
      screen.getByRole('textbox', { name: 'New comment' }),
    ).toHaveTextContent('unsent words');
  });

  it('persists the description draft and clears it on save', async () => {
    const storage = mockApis.storage();
    draftsBucket(storage).set('description-board-1-item-1', 'draft notes');
    const { boardsApi } = renderDrawer({ storage });
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    const editor = screen.getByRole('textbox', { name: 'Edit description' });
    // the editor opens with the stored draft instead of the saved text
    expect(editor).toHaveTextContent('draft notes');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(boardsApi.updateItem).toHaveBeenCalledWith('board-1', 'item-1', {
      description: 'draft notes',
    });
    await waitFor(() =>
      expect(
        draftsBucket(storage).snapshot('description-board-1-item-1').presence,
      ).toBe('absent'),
    );
  });

  it('adds a comment', async () => {
    const { boardsApi } = renderDrawer();
    typeIntoRichText(
      await screen.findByRole('textbox', { name: 'New comment' }),
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
    await userEvent.click(
      await screen.findByRole('button', { name: 'Comment' }),
    );
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
