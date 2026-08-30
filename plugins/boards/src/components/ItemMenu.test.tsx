import type { ReactNode } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { identityApiRef } from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { Button, MenuItem, MenuTrigger } from '@backstage/ui';
import { BoardItem, BoardPriority } from '@internal/plugin-boards-common';
import { ItemMenu } from './ItemMenu';
import {
  renderWithProviders,
  testActions,
  testColumn,
  testItem,
  testPriorities,
} from './__testUtils__/testHelpers';

const identityApi = {
  getBackstageIdentity: async () => ({
    type: 'user',
    userEntityRef: 'user:default/alice',
    ownershipEntityRefs: ['user:default/alice'],
  }),
};

/** Catalog stub resolving refs in the order they were requested. */
function stubCatalog(byRef: Record<string, Entity> = {}) {
  return {
    getEntitiesByRefs: jest.fn(async (request: { entityRefs: string[] }) => ({
      items: request.entityRefs.map(ref => byRef[ref]),
    })),
  };
}

function userEntity(name: string, displayName: string): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'User',
    metadata: { name, namespace: 'default' },
    spec: { profile: { displayName } },
  };
}

const columns = [
  testColumn({ id: 'column-1', title: 'Todo' }),
  testColumn({ id: 'column-2', title: 'In progress' }),
];

async function openMenu(options: {
  item?: BoardItem;
  readonly?: boolean;
  assigneePool?: string[];
  priorities?: BoardPriority[];
  extraItems?: ReactNode;
  catalogApi?: unknown;
  showOpenDetails?: boolean;
}) {
  const actions = testActions();
  const item = options.item ?? testItem();
  renderWithProviders(
    <MenuTrigger>
      <Button>Actions</Button>
      <ItemMenu
        item={item}
        columns={columns}
        priorities={options.priorities ?? []}
        readonly={options.readonly ?? false}
        actions={actions}
        assigneePool={options.assigneePool ?? []}
        extraItems={options.extraItems}
        showOpenDetails={options.showOpenDetails}
      />
    </MenuTrigger>,
    {
      apis: [
        [identityApiRef, identityApi],
        [catalogApiRef, options.catalogApi ?? stubCatalog()],
      ],
    },
  );
  await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
  await screen.findByRole('menuitem', {
    name: options.showOpenDetails === false ? 'Move to column' : 'Open details',
  });
  return { actions, item };
}

describe('ItemMenu', () => {
  it('offers the full action set for writers', async () => {
    await openMenu({});
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual([
      'Open details',
      'Copy link',
      'Move to column',
      'Due date',
      'Assignee',
      'Duplicate item',
      'Delete item',
    ]);
  });

  it('drops Open details when the details are already open', async () => {
    await openMenu({ showOpenDetails: false });
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual([
      'Copy link',
      'Move to column',
      'Due date',
      'Assignee',
      'Duplicate item',
      'Delete item',
    ]);
  });

  it('offers only Open details and Copy link on read-only items', async () => {
    await openMenu({ readonly: true });
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual(['Open details', 'Copy link']);
  });

  it('duplicates the item', async () => {
    const { actions, item } = await openMenu({});
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Duplicate item' }),
    );
    expect(actions.duplicateItem).toHaveBeenCalledWith(item.id);
  });

  it('copies the item permalink to the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { item } = await openMenu({ readonly: true });
    await userEvent.click(screen.getByRole('menuitem', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/boards/${item.boardId}?item=${item.id}`,
    );
  });

  it('renders a surface\u2019s extra entries after Open details', async () => {
    const onAction = jest.fn();
    await openMenu({
      readonly: true,
      extraItems: <MenuItem onAction={onAction}>Open board</MenuItem>,
    });
    expect(
      screen.getAllByRole('menuitem').map(entry => entry.textContent),
    ).toEqual(['Open details', 'Copy link', 'Open board']);
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

  it('hides the priority submenu on boards without priorities', async () => {
    await openMenu({});
    expect(
      screen.queryByRole('menuitem', { name: 'Priority' }),
    ).not.toBeInTheDocument();
  });

  it('sets a priority from the submenu, highest order first', async () => {
    const { actions, item } = await openMenu({
      priorities: testPriorities(),
    });
    await userEvent.click(screen.getByRole('menuitem', { name: 'Priority' }));
    await screen.findByRole('menuitem', { name: 'critical' });
    const entries = screen
      .getAllByRole('menuitem')
      .map(entry => entry.textContent)
      .filter(text =>
        ['critical', 'high', 'medium', 'low'].includes(text ?? ''),
      );
    expect(entries).toEqual(['critical', 'high', 'medium', 'low']);
    expect(
      screen.queryByRole('menuitem', { name: 'Remove priority' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'critical' }));
    expect(actions.setItemPriority).toHaveBeenCalledWith(item.id, 'priority-1');
  });

  it('marks the current priority and can remove it', async () => {
    const { actions, item } = await openMenu({
      item: testItem({ priorityId: 'priority-2' }),
      priorities: testPriorities(),
    });
    await userEvent.click(screen.getByRole('menuitem', { name: 'Priority' }));
    await screen.findByRole('menuitem', { name: '✓ high' });
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Remove priority' }),
    );
    expect(actions.setItemPriority).toHaveBeenCalledWith(item.id, null);
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
            'Copy link',
            'Move to column',
            'Due date',
            'Assignee',
            'Duplicate item',
            'Delete item',
          ].includes(text!),
      );
    // "Me" replaces alice; the rest are sorted by display name
    expect(entries).toEqual(['Me', 'bob', 'carol', 'Contractor']);
  });

  it('lists the assignees by their catalog display name, in that order', async () => {
    await openMenu({
      assigneePool: ['user:default/zoe', 'user:default/bob'],
      catalogApi: stubCatalog({
        // display names sort opposite to the ref names
        'user:default/zoe': userEntity('zoe', 'Anna Zander'),
        'user:default/bob': userEntity('bob', 'Yuri Bobrov'),
      }),
    });
    await userEvent.click(screen.getByRole('menuitem', { name: 'Assignee' }));
    await screen.findByRole('menuitem', { name: 'Anna Zander' });
    const entries = screen
      .getAllByRole('menuitem')
      .map(entry => entry.textContent)
      .filter(text => text === 'Anna Zander' || text === 'Yuri Bobrov');
    expect(entries).toEqual(['Anna Zander', 'Yuri Bobrov']);
  });

  it('falls back to the ref names when the catalog resolves nothing', async () => {
    await openMenu({
      assigneePool: ['user:default/zoe', 'user:default/bob'],
      catalogApi: stubCatalog(),
    });
    await userEvent.click(screen.getByRole('menuitem', { name: 'Assignee' }));
    expect(
      await screen.findByRole('menuitem', { name: 'bob' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'zoe' })).toBeInTheDocument();
  });

  it('carries the full ref on catalog entries, but not on text ones', async () => {
    await openMenu({
      assigneePool: ['user:default/bob', 'text:Contractor'],
      catalogApi: stubCatalog({
        'user:default/bob': userEntity('bob', 'Bob Builder'),
      }),
    });
    await userEvent.click(screen.getByRole('menuitem', { name: 'Assignee' }));
    // the ref is a tooltip, not part of the entry's accessible name
    const bob = await screen.findByRole('menuitem', { name: 'Bob Builder' });
    expect(bob.querySelector('[title]')).toHaveAttribute(
      'title',
      'user:default/bob',
    );
    const contractor = screen.getByRole('menuitem', { name: 'Contractor' });
    expect(contractor.querySelector('[title]')).toBeNull();
    // "Me" names the signed-in user, so it carries their ref too
    expect(
      screen.getByRole('menuitem', { name: 'Me' }).querySelector('[title]'),
    ).toHaveAttribute('title', 'user:default/alice');
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

describe('ItemMenu submenu mode', () => {
  async function openFlat(options: {
    submenu: 'move' | 'assignee' | 'due' | 'priority';
    item?: BoardItem;
    readonly?: boolean;
    priorities?: BoardPriority[];
  }) {
    const actions = testActions();
    const item = options.item ?? testItem();
    renderWithProviders(
      <MenuTrigger defaultOpen>
        <Button>Actions</Button>
        <ItemMenu
          item={item}
          columns={columns}
          priorities={options.priorities ?? []}
          readonly={options.readonly ?? false}
          actions={actions}
          assigneePool={[]}
          submenu={options.submenu}
        />
      </MenuTrigger>,
      {
        apis: [
          [identityApiRef, identityApi],
          [catalogApiRef, stubCatalog()],
        ],
      },
    );
    return { actions, item };
  }

  it('renders only the move entries as a flat menu', async () => {
    const { actions, item } = await openFlat({ submenu: 'move' });
    const entries = await screen.findAllByRole('menuitem');
    // the item sits in column-1, so only the other column is offered
    expect(entries.map(entry => entry.textContent)).toEqual(['In progress']);
    await userEvent.click(entries[0]);
    expect(actions.moveItem).toHaveBeenCalledWith(item.id, {
      columnId: 'column-2',
    });
  });

  it('renders the due-date entries as a flat menu', async () => {
    await openFlat({ submenu: 'due' });
    const entries = await screen.findAllByRole('menuitem');
    expect(entries.map(entry => entry.textContent)).toEqual([
      'Today',
      'Tomorrow',
      'This week (Fri)',
    ]);
  });

  it('renders the priority entries with the current one marked', async () => {
    await openFlat({
      submenu: 'priority',
      priorities: testPriorities(),
      item: testItem({ priorityId: 'priority-2' }),
    });
    const entries = await screen.findAllByRole('menuitem');
    expect(entries.map(entry => entry.textContent)).toEqual([
      'critical',
      '✓ high',
      'medium',
      'low',
      'Remove priority',
    ]);
  });

  it('renders nothing read-only or for priorities without any', async () => {
    await openFlat({ submenu: 'move', readonly: true });
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});
