import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardItem } from '@internal/plugin-boards-common';
import { ItemFilterBar, useItemFilter } from './ItemFilterBar';
import { renderWithProviders, testItem } from './__testUtils__/testHelpers';

function Harness(props: { items: BoardItem[]; minAssigneeOptions?: number }) {
  const filter = useItemFilter(props.items);
  return (
    <ItemFilterBar
      filter={filter}
      minAssigneeOptions={props.minAssigneeOptions}
    />
  );
}

function render(items: BoardItem[], minAssigneeOptions?: number) {
  renderWithProviders(
    <Harness items={items} minAssigneeOptions={minAssigneeOptions} />,
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
});
