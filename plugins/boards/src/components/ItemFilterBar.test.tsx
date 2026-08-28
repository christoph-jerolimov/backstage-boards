import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardItem, BoardPriority } from '@internal/plugin-boards-common';
import { ItemFilterBar, useItemFilter } from './ItemFilterBar';
import {
  renderWithProviders,
  testItem,
  testPriorities,
} from './__testUtils__/testHelpers';

function Harness(props: {
  items: BoardItem[];
  priorities?: BoardPriority[];
  minAssigneeOptions?: number;
}) {
  const filter = useItemFilter(props.items, props.priorities);
  return (
    <ItemFilterBar
      filter={filter}
      minAssigneeOptions={props.minAssigneeOptions}
    />
  );
}

function render(
  items: BoardItem[],
  minAssigneeOptions?: number,
  priorities?: BoardPriority[],
) {
  renderWithProviders(
    <Harness
      items={items}
      priorities={priorities}
      minAssigneeOptions={minAssigneeOptions}
    />,
  );
}

const alicesItem = testItem({
  id: 'item-1',
  title: 'Ship the docs',
  assignees: ['user:default/alice'],
  tags: ['docs'],
});
const bobsItem = testItem({
  id: 'item-2',
  title: 'Fix the build',
  assignees: ['user:default/bob'],
});

describe('ItemFilterBar', () => {
  it('offers the assignee menu for a single assignee by default', async () => {
    render([alicesItem, testItem({ id: 'item-3' })]);
    expect(
      await screen.findByRole('button', { name: 'Assignees' }),
    ).toBeInTheDocument();
  });

  it('hides the assignee menu below the minimum', async () => {
    render([alicesItem, testItem({ id: 'item-3' })], 2);
    expect(await screen.findByRole('button', { name: 'Tags' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Assignees' }),
    ).not.toBeInTheDocument();
  });

  it('offers the assignee menu once the minimum is reached', async () => {
    render([alicesItem, bobsItem], 2);
    expect(
      await screen.findByRole('button', { name: 'Assignees' }),
    ).toBeInTheDocument();
  });

  it('filters and counts while the assignee menu is hidden', async () => {
    render([alicesItem, testItem({ id: 'item-3', tags: ['ops'] })], 2);
    await userEvent.click(await screen.findByRole('button', { name: 'Tags' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'ops' }));
    expect(await screen.findByText('1 of 2 items')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tags (1)' })).toBeVisible();
  });

  it('offers no priority menu while no item has a priority', () => {
    render([alicesItem, bobsItem], undefined, testPriorities());
    expect(
      screen.queryByRole('button', { name: /^Priority/ }),
    ).not.toBeInTheDocument();
  });

  it('lists used priorities highest first with their counts', async () => {
    render(
      [
        testItem({ id: 'item-1', title: 'A', priorityId: 'priority-4' }),
        testItem({ id: 'item-2', title: 'B', priorityId: 'priority-1' }),
        testItem({ id: 'item-3', title: 'C', priorityId: 'priority-1' }),
        testItem({ id: 'item-4', title: 'D' }),
      ],
      undefined,
      testPriorities(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Priority' }));
    const entries = (await screen.findAllByRole('menuitem')).map(
      entry => entry.textContent,
    );
    // critical (order 1) before low (order 4); medium/high are unused
    expect(entries).toEqual(['critical (2)', 'low (1)']);
  });

  it('filters by any selected priority and clears with the bar', async () => {
    render(
      [
        testItem({ id: 'item-1', title: 'A', priorityId: 'priority-1' }),
        testItem({ id: 'item-2', title: 'B', priorityId: 'priority-4' }),
        testItem({ id: 'item-3', title: 'C' }),
      ],
      undefined,
      testPriorities(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Priority' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: /critical/ }),
    );
    expect(await screen.findByText('1 of 3 items')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Priority (1)' })).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Clear filters' }),
    );
    expect(screen.queryByText('1 of 3 items')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Priority' })).toBeVisible();
  });
});
