import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { identityApiRef } from '@backstage/frontend-plugin-api';
import { Button, MenuTrigger } from '@backstage/ui';
import { BoardItem } from '@internal/plugin-boards-common';
import { ItemContextMenu, ItemMenu } from './ItemMenu';
import {
  renderWithProviders,
  testActions,
  testColumn,
  testItem,
} from './__testUtils__/testHelpers';

const identityApi = {
  getBackstageIdentity: async () => ({
    type: 'user',
    userEntityRef: 'user:default/alice',
    ownershipEntityRefs: ['user:default/alice'],
  }),
};

const columns = [
  testColumn({ id: 'column-1', title: 'Todo' }),
  testColumn({ id: 'column-2', title: 'In progress' }),
];

async function openMenu(options: {
  item?: BoardItem;
  readonly?: boolean;
  assigneePool?: string[];
}) {
  const actions = testActions();
  const item = options.item ?? testItem();
  renderWithProviders(
    <MenuTrigger>
      <Button>Actions</Button>
      <ItemMenu
        item={item}
        columns={columns}
        readonly={options.readonly ?? false}
        actions={actions}
        assigneePool={options.assigneePool ?? []}
      />
    </MenuTrigger>,
    { apis: [[identityApiRef, identityApi]] },
  );
  await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
  await screen.findByRole('menuitem', { name: 'Open details' });
  return { actions, item };
}

describe('ItemMenu', () => {
  it('offers the full action set for writers', async () => {
    await openMenu({});
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual([
      'Open details',
      'Move to column',
      'Due date',
      'Assignee',
      'Delete item',
    ]);
  });

  it('offers only Open details on read-only items', async () => {
    await openMenu({ readonly: true });
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual(['Open details']);
  });

  it('opens the item details', async () => {
    const { actions, item } = await openMenu({});
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Open details' }),
    );
    expect(actions.openItem).toHaveBeenCalledWith(item.id);
  });

  it('deletes the item', async () => {
    const { actions, item } = await openMenu({});
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Delete item' }),
    );
    expect(actions.deleteItem).toHaveBeenCalledWith(item.id);
  });

  it('moves the item to another column', async () => {
    const { actions, item } = await openMenu({});
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Move to column' }),
    );
    const target = await screen.findByRole('menuitem', { name: 'In progress' });
    await userEvent.click(target);
    expect(actions.moveItem).toHaveBeenCalledWith(item.id, {
      columnId: 'column-2',
    });
  });

  it('offers due-date shortcuts, with Remove only when a date is set', async () => {
    await openMenu({});
    await userEvent.click(screen.getByRole('menuitem', { name: 'Due date' }));
    await screen.findByRole('menuitem', { name: 'Today' });
    expect(
      screen.queryByRole('menuitem', { name: 'Remove due date' }),
    ).not.toBeInTheDocument();
  });

  it('clears the due date of an item that has one', async () => {
    const { actions, item } = await openMenu({
      item: testItem({ dueDate: '2026-09-04' }),
    });
    await userEvent.click(screen.getByRole('menuitem', { name: 'Due date' }));
    const remove = await screen.findByRole('menuitem', {
      name: 'Remove due date',
    });
    await userEvent.click(remove);
    expect(actions.setItemDueDate).toHaveBeenCalledWith(item.id, null);
  });

  it('lists Me first, then the board assignees, deduplicated', async () => {
    await openMenu({
      assigneePool: [
        'user:default/carol',
        'user:default/alice',
        'user:default/bob',
        'text:Contractor',
      ],
    });
    await userEvent.click(screen.getByRole('menuitem', { name: 'Assignee' }));
    await screen.findByRole('menuitem', { name: 'Me' });
    const entries = screen
      .getAllByRole('menuitem')
      .map(entry => entry.textContent)
      .filter(
        text =>
          ![
            'Open details',
            'Move to column',
            'Due date',
            'Assignee',
            'Delete item',
          ].includes(text!),
      );
    // "Me" replaces alice; the rest are sorted by display name
    expect(entries).toEqual(['Me', 'bob', 'carol', 'Contractor']);
  });

  it('adds an assignee and marks the ones already set', async () => {
    const { actions, item } = await openMenu({
      item: testItem({ assignees: ['user:default/alice'] }),
      assigneePool: ['user:default/bob'],
    });
    await userEvent.click(screen.getByRole('menuitem', { name: 'Assignee' }));
    await screen.findByRole('menuitem', { name: '✓ Me' });
    await userEvent.click(screen.getByRole('menuitem', { name: 'bob' }));
    expect(actions.setAssignees).toHaveBeenCalledWith(item.id, [
      'user:default/alice',
      'user:default/bob',
    ]);
  });

  it('removes an assignee that is already set', async () => {
    const { actions, item } = await openMenu({
      item: testItem({ assignees: ['user:default/alice'] }),
    });
    await userEvent.click(screen.getByRole('menuitem', { name: 'Assignee' }));
    const me = await screen.findByRole('menuitem', { name: '✓ Me' });
    await userEvent.click(me);
    expect(actions.setAssignees).toHaveBeenCalledWith(item.id, []);
  });
});

describe('ItemContextMenu', () => {
  it('renders nothing without a pointer position', () => {
    renderWithProviders(
      <div data-testid="host">
        <ItemContextMenu
          state={undefined}
          onClose={jest.fn()}
          columns={columns}
          readonly={false}
          actions={testActions()}
          assigneePool={[]}
        />
      </div>,
      { apis: [[identityApiRef, identityApi]] },
    );
    expect(screen.getByTestId('host')).toBeEmptyDOMElement();
  });

  it('opens the menu at the pointer and closes on dismiss', async () => {
    const onClose = jest.fn();
    const item = testItem({ title: 'Right-clicked' });
    renderWithProviders(
      <ItemContextMenu
        state={{ row: item, x: 120, y: 80 }}
        onClose={onClose}
        columns={columns}
        readonly={false}
        actions={testActions()}
        assigneePool={[]}
      />,
      { apis: [[identityApiRef, identityApi]] },
    );
    await screen.findByRole('menuitem', { name: 'Open details' });
    // the trigger is hidden from assistive tech while the menu owns the
    // focus scope, so it is only reachable through the DOM
    const anchor = document.querySelector(
      '[aria-label="Context menu for Right-clicked"]',
    );
    expect(anchor).toHaveStyle({ left: '120px', top: '80px' });

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
