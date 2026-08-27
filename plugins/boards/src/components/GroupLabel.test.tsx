import { screen } from '@testing-library/react';
import { todayISO } from '@internal/plugin-boards-common';
import { GroupLabel } from './GroupLabel';
import { NO_DUE_DATE, UNASSIGNED, UNTAGGED } from './grouping';
import { renderWithProviders } from './__testUtils__/testHelpers';

const renderLabel = renderWithProviders;

describe('GroupLabel', () => {
  it('labels assignee groups, entity refs as links', () => {
    renderLabel(<GroupLabel mode="assignee" groupKey={UNASSIGNED} />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();

    renderLabel(<GroupLabel mode="assignee" groupKey="text:Jane" />);
    expect(screen.getByText('Jane')).toBeInTheDocument();
  });

  it('labels due-date groups relatively near today and absolutely otherwise', () => {
    renderLabel(<GroupLabel mode="dueDate" groupKey={todayISO()} />);
    expect(screen.getByText('Due today')).toBeInTheDocument();

    renderLabel(<GroupLabel mode="dueDate" groupKey="2999-12-31" />);
    expect(screen.getByText('Dec 31, 2999')).toBeInTheDocument();

    renderLabel(<GroupLabel mode="dueDate" groupKey={NO_DUE_DATE} />);
    expect(screen.getByText('No due date')).toBeInTheDocument();
  });

  it('labels tag groups and the untagged sentinel', () => {
    renderLabel(<GroupLabel mode="tags" groupKey="bug" />);
    expect(screen.getByText('bug')).toBeInTheDocument();

    renderLabel(<GroupLabel mode="tags" groupKey={UNTAGGED} />);
    expect(screen.getByText('Untagged')).toBeInTheDocument();
  });

  it('renders nothing when not grouped', () => {
    renderLabel(
      <div data-testid="host">
        <GroupLabel mode="none" groupKey="all" />
      </div>,
    );
    expect(screen.getByTestId('host')).toBeEmptyDOMElement();
  });
});
