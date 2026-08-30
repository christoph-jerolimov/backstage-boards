import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableMarkdown } from './EditableMarkdown';
import { renderWithProviders } from './__testUtils__/testHelpers';

function renderBlock(
  over: Partial<Parameters<typeof EditableMarkdown>[0]> = {},
) {
  const props = {
    text: 'The **description**',
    canEdit: true,
    versionCount: 1,
    loadVersions: jest.fn().mockResolvedValue([]),
    versionsKey: ['test', 'versions'],
    onSave: jest.fn().mockResolvedValue(undefined),
    editAriaLabel: 'Description',
    ...over,
  };
  renderWithProviders(<EditableMarkdown {...props} />);
  return props;
}

describe('EditableMarkdown', () => {
  it('renders the text as markdown with an Edit button', () => {
    renderBlock();
    expect(
      screen.getByText('description').closest('strong'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('shows the placeholder and an Add button when empty', () => {
    renderBlock({ text: '', emptyText: 'No description yet.' });
    expect(screen.getByText('No description yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('hides the edit affordance for readers', () => {
    renderBlock({ canEdit: false });
    expect(
      screen.queryByRole('button', { name: 'Edit' }),
    ).not.toBeInTheDocument();
  });

  it('saves an edited text', async () => {
    const props = renderBlock({ text: 'before' });
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const field = screen.getByRole('textbox', { name: 'Description' });
    await userEvent.clear(field);
    await userEvent.type(field, 'after');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(props.onSave).toHaveBeenCalledWith('after');
  });

  it('does not save an unchanged text', async () => {
    const props = renderBlock({ text: 'same' });
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('refuses to clear the text unless empties are allowed', async () => {
    const props = renderBlock({ text: 'keep me', allowEmpty: false });
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Description' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('clears the text when empties are allowed', async () => {
    const props = renderBlock({ text: 'clear me', allowEmpty: true });
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Description' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(props.onSave).toHaveBeenCalledWith('');
  });

  it('drops the draft on cancel', async () => {
    const props = renderBlock({ text: 'original' });
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Description' }),
      ' edited',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.getByText('original')).toBeInTheDocument();
  });

  it('offers no history for a single version', () => {
    renderBlock({ versionCount: 1 });
    expect(
      screen.queryByRole('button', { name: 'History' }),
    ).not.toBeInTheDocument();
  });

  it('loads and toggles the version history', async () => {
    const props = renderBlock({
      versionCount: 2,
      loadVersions: jest.fn().mockResolvedValue([
        {
          id: 'version-1',
          text: 'the first draft',
          editedBy: 'user:default/jane',
          editedAt: '2026-08-01T10:00:00.000Z',
        },
      ]),
    });
    await userEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(await screen.findByText('the first draft')).toBeInTheDocument();
    expect(props.loadVersions).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Hide history' }));
    await waitFor(() =>
      expect(screen.queryByText('the first draft')).not.toBeInTheDocument(),
    );
  });
});
