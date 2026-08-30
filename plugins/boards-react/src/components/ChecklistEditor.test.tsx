import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChecklistBadge, ChecklistEditor } from './ChecklistEditor';
import { renderWithProviders } from './__testUtils__/testHelpers';

describe('ChecklistEditor', () => {
  const entries = [
    { text: 'write docs', checked: false },
    { text: 'update tests', checked: true },
  ];

  it('lists the entries with their done states', () => {
    renderWithProviders(
      <ChecklistEditor checklist={entries} canEdit onChange={jest.fn()} />,
    );
    expect(screen.getByText('write docs')).toBeInTheDocument();
    expect(screen.getByText('update tests')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /"write docs" as done/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /"update tests" as not done/ }),
    ).toBeChecked();
  });

  it('shows an empty state without entries', () => {
    renderWithProviders(
      <ChecklistEditor checklist={[]} canEdit onChange={jest.fn()} />,
    );
    expect(screen.getByText('No checklist yet.')).toBeInTheDocument();
  });

  it('adds a typed entry on Enter and ignores empty input', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <ChecklistEditor checklist={entries} canEdit onChange={onChange} />,
    );
    // the entry field is offered directly, no button press first
    const field = screen.getByRole('textbox', { name: 'Add checklist entry' });
    await userEvent.type(field, '   {Enter}');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.type(field, 'announce{Enter}');
    expect(onChange).toHaveBeenCalledWith([
      ...entries,
      { text: 'announce', checked: false },
    ]);
  });

  it('toggles an entry through its checkbox', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <ChecklistEditor checklist={entries} canEdit onChange={onChange} />,
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: /"write docs" as done/ }),
    );
    expect(onChange).toHaveBeenCalledWith([
      { text: 'write docs', checked: true },
      { text: 'update tests', checked: true },
    ]);
  });

  it('edits an entry label in place', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <ChecklistEditor checklist={entries} canEdit onChange={onChange} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Edit checklist entry write docs' }),
    );
    const field = screen.getByRole('textbox', {
      name: 'checklist entry write docs',
    });
    await userEvent.clear(field);
    await userEvent.type(field, 'write the docs{Enter}');
    expect(onChange).toHaveBeenCalledWith([
      { text: 'write the docs', checked: false },
      { text: 'update tests', checked: true },
    ]);
  });

  it('removes an entry', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <ChecklistEditor checklist={entries} canEdit onChange={onChange} />,
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Remove checklist entry write docs',
      }),
    );
    expect(onChange).toHaveBeenCalledWith([
      { text: 'update tests', checked: true },
    ]);
  });

  it('renders read-only without editing affordances', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <ChecklistEditor
        checklist={entries}
        canEdit={false}
        onChange={onChange}
      />,
    );
    expect(
      screen.queryByRole('textbox', { name: 'Add checklist entry' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Remove checklist entry/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Edit checklist entry/ }),
    ).not.toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', {
      name: /"write docs" as done/,
    });
    expect(checkbox).toBeDisabled();
    await userEvent.click(checkbox);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ChecklistBadge', () => {
  it('shows done over total', () => {
    renderWithProviders(
      <ChecklistBadge
        checklist={[
          { text: 'a', checked: true },
          { text: 'b', checked: false },
          { text: 'c', checked: false },
        ]}
      />,
    );
    const badge = screen.getByLabelText('Checklist: 1 of 3 done');
    expect(badge).toHaveTextContent('1/3');
    expect(badge).toHaveAttribute('data-checklist-state', 'in-progress');
  });

  it('marks a fully done checklist as complete', () => {
    renderWithProviders(
      <ChecklistBadge
        checklist={[
          { text: 'a', checked: true },
          { text: 'b', checked: true },
        ]}
      />,
    );
    const badge = screen.getByLabelText('Checklist: 2 of 2 done');
    expect(badge).toHaveTextContent('2/2');
    expect(badge).toHaveAttribute('data-checklist-state', 'complete');
  });

  it('renders nothing without a checklist', () => {
    renderWithProviders(<ChecklistBadge checklist={[]} />);
    expect(screen.queryByLabelText(/Checklist:/)).not.toBeInTheDocument();
  });
});
