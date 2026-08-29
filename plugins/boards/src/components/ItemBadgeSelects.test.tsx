import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tomorrowISO } from '@internal/plugin-boards-common';
import {
  DueDateSelect,
  PrioritySelect,
  StatusBadgeSelect,
} from './ItemBadgeSelects';
import {
  renderWithProviders,
  testColumn,
  testPriorities,
} from './__testUtils__/testHelpers';

const columns = [
  testColumn({ id: 'column-1', title: 'Todo' }),
  testColumn({ id: 'column-2', title: 'Done' }),
];

describe('StatusBadgeSelect', () => {
  it('opens on click and selects a column', async () => {
    const onSelect = jest.fn();
    renderWithProviders(
      <StatusBadgeSelect
        columns={columns}
        columnId="column-1"
        readonly={false}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Change status: Todo' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Done' }));
    expect(onSelect).toHaveBeenCalledWith('column-2');
  });

  it('marks the current column and ignores re-selecting it', async () => {
    const onSelect = jest.fn();
    renderWithProviders(
      <StatusBadgeSelect
        columns={columns}
        columnId="column-1"
        readonly={false}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Change status: Todo' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: '✓ Todo' }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('opens on right-click', async () => {
    renderWithProviders(
      <StatusBadgeSelect
        columns={columns}
        columnId="column-1"
        readonly={false}
        onSelect={jest.fn()}
      />,
    );
    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Change status: Todo' }),
    );
    expect(
      await screen.findByRole('menuitem', { name: 'Done' }),
    ).toBeInTheDocument();
  });

  it('is keyboard focusable and operable', async () => {
    const onSelect = jest.fn();
    renderWithProviders(
      <StatusBadgeSelect
        columns={columns}
        columnId="column-1"
        readonly={false}
        onSelect={onSelect}
      />,
    );
    await userEvent.tab();
    expect(
      screen.getByRole('button', { name: 'Change status: Todo' }),
    ).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('menu');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('column-2');
  });

  it('renders the plain badge when read-only', () => {
    renderWithProviders(
      <StatusBadgeSelect
        columns={columns}
        columnId="column-1"
        readonly
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('Todo')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('PrioritySelect', () => {
  it('lists the priorities in order plus a clear entry and selects one', async () => {
    const onSelect = jest.fn();
    renderWithProviders(
      <PrioritySelect
        priorities={testPriorities()}
        priorityId="priority-2"
        readonly={false}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Change priority: high' }),
    );
    const entries = screen.getAllByRole('menuitem');
    expect(entries.map(entry => entry.textContent)).toEqual([
      'critical',
      '✓ high',
      'medium',
      'low',
      'No priority',
    ]);
    await userEvent.click(screen.getByRole('menuitem', { name: 'critical' }));
    expect(onSelect).toHaveBeenCalledWith('priority-1');
  });

  it('clears the priority via the clear entry', async () => {
    const onSelect = jest.fn();
    renderWithProviders(
      <PrioritySelect
        priorities={testPriorities()}
        priorityId="priority-2"
        readonly={false}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Change priority: high' }),
    );
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'No priority' }),
    );
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('shows a placeholder when the item has no priority', async () => {
    const onSelect = jest.fn();
    renderWithProviders(
      <PrioritySelect
        priorities={testPriorities()}
        readonly={false}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Change priority: No priority' }),
    );
    await userEvent.click(
      screen.getByRole('menuitem', { name: '✓ No priority' }),
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders the plain chip when read-only', () => {
    renderWithProviders(
      <PrioritySelect
        priorities={testPriorities()}
        priorityId="priority-1"
        readonly
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing when read-only without a priority', () => {
    renderWithProviders(
      <PrioritySelect
        priorities={testPriorities()}
        readonly
        onSelect={jest.fn()}
      />,
    );
    expect(screen.queryByText('No priority')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('DueDateSelect', () => {
  it('sets a quick option from the badge', async () => {
    const onChange = jest.fn();
    renderWithProviders(<DueDateSelect readonly={false} onChange={onChange} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Change due date' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tomorrow' }));
    expect(onChange).toHaveBeenCalledWith(tomorrowISO());
  });

  it('offers a focused date input behind Pick a date', async () => {
    const onChange = jest.fn();
    renderWithProviders(<DueDateSelect readonly={false} onChange={onChange} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Change due date' }),
    );
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Pick a date…' }),
    );
    const input = await screen.findByLabelText('Due date');
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: '2026-09-04' } });
    expect(onChange).toHaveBeenCalledWith('2026-09-04');
    expect(screen.queryByLabelText('Due date')).not.toBeInTheDocument();
  });

  it('removes the due date via the danger entry', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <DueDateSelect
        dueDate="2026-09-04"
        readonly={false}
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Change due date' }),
    );
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Remove due date' }),
    );
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('offers no remove entry without a due date', async () => {
    renderWithProviders(
      <DueDateSelect readonly={false} onChange={jest.fn()} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Change due date' }),
    );
    expect(
      screen.queryByRole('menuitem', { name: 'Remove due date' }),
    ).not.toBeInTheDocument();
  });

  it('renders the plain display when read-only', () => {
    renderWithProviders(<DueDateSelect readonly onChange={jest.fn()} />);
    expect(screen.getByText('No due date')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
