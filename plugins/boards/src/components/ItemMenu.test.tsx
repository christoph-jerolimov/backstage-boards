import type { ReactNode } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { identityApiRef } from '@backstage/frontend-plugin-api';
import { Button, MenuItem, MenuTrigger } from '@backstage/ui';
import { BoardItem } from '@internal/plugin-boards-common';
import { ItemMenu } from './ItemMenu';
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
  extraItems?: ReactNode;
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
        extraItems={options.extraItems}
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

  it('renders a surface\u2019s extra entries after Open details', async () => {
    const onAction = jest.fn();
    await openMenu({
      readonly: true,
      extraItems: <MenuItem onAction={onAction}>Open board</MenuItem>,
    });
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual(['Open details', 'Open board']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open board' }));
    expect(onAction).toHaveBeenCalled();
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
