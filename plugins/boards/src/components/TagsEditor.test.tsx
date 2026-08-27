import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagsEditor } from './TagsEditor';
import { renderWithProviders } from './__testUtils__/testHelpers';

describe('TagsEditor', () => {
  it('lists the current tags', () => {
    renderWithProviders(
      <TagsEditor
        tags={['bug', 'ui']}
        canEdit
        suggestions={[]}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByText('bug')).toBeInTheDocument();
    expect(screen.getByText('ui')).toBeInTheDocument();
  });

  it('shows an empty state without tags', () => {
    renderWithProviders(
      <TagsEditor tags={[]} canEdit suggestions={[]} onChange={jest.fn()} />,
    );
    expect(screen.getByText('No tags yet.')).toBeInTheDocument();
  });

  it('removes a tag through the tag group', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <TagsEditor
        tags={['bug', 'ui']}
        canEdit
        suggestions={[]}
        onChange={onChange}
      />,
    );
    const uiTag = screen.getByRole('row', { name: /ui/ });
    await userEvent.click(uiTag.querySelector('button')!);
    expect(onChange).toHaveBeenCalledWith(['bug']);
  });

  it('hides the editing affordances without write access', () => {
    renderWithProviders(
      <TagsEditor
        tags={['bug']}
        canEdit={false}
        suggestions={['ui']}
        onChange={jest.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Add tag' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('row', { name: /bug/ }).querySelector('button'),
    ).toBeNull();
  });

  it('adds the typed value on Enter, normalizing away a leading #', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <TagsEditor
        tags={['bug']}
        canEdit
        suggestions={[]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    const search = screen.getByRole('searchbox');
    await userEvent.type(search, '#frontend');
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(['bug', 'frontend']);
  });

  it('ignores an Enter that would duplicate an existing tag', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <TagsEditor
        tags={['bug']}
        canEdit
        suggestions={[]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    await userEvent.type(screen.getByRole('searchbox'), 'bug');
    await userEvent.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('suggests the board tags that are not used yet', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <TagsEditor
        tags={['bug']}
        canEdit
        suggestions={['bug', 'backend', 'ui']}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    await userEvent.type(screen.getByRole('searchbox'), 'b');
    // 'bug' is already on the item, so only 'backend' matches
    const option = await screen.findByRole('option', { name: 'backend' });
    expect(screen.queryByRole('option', { name: 'bug' })).not.toBeInTheDocument();
    await userEvent.click(option);
    expect(onChange).toHaveBeenCalledWith(['bug', 'backend']);
  });

  it('closes on Escape and returns focus to the Add button', async () => {
    renderWithProviders(
      <TagsEditor tags={[]} canEdit suggestions={[]} onChange={jest.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    const search = screen.getByRole('searchbox');
    expect(search).toBeInTheDocument();

    // Escape is handled on the editor wrapper, so it applies while the
    // user is typing in the field
    await userEvent.type(search, 'half-typed{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument(),
    );
    const addButton = screen.getByRole('button', { name: 'Add tag' });
    await waitFor(() => expect(addButton).toHaveFocus());
  });
});
