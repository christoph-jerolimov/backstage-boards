import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatDate, InlineEdit, RefDisplay } from './common';
import { renderWithProviders } from './__testUtils__/testHelpers';

describe('RefDisplay', () => {
  it('renders text refs as plain text', () => {
    render(
      <div data-testid="host">
        <RefDisplay refString="text:Some Contractor" />
      </div>,
    );
    expect(screen.getByTestId('host')).toHaveTextContent('Some Contractor');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders catalog refs as entity links', async () => {
    renderWithProviders(<RefDisplay refString="user:default/jane" />);
    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute('href', '/catalog/default/user/jane');
  });
});

describe('InlineEdit', () => {
  it('renders read-only text without an edit affordance', () => {
    render(
      <InlineEdit
        value="Board name"
        canEdit={false}
        onCommit={jest.fn()}
        ariaLabel="board name"
      />,
    );
    expect(screen.getByText('Board name')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('commits a changed value on Enter', async () => {
    const onCommit = jest.fn();
    render(
      <InlineEdit
        value="Old"
        canEdit
        onCommit={onCommit}
        ariaLabel="board name"
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Edit board name' }),
    );
    const field = screen.getByRole('textbox', { name: 'board name' });
    await userEvent.clear(field);
    await userEvent.type(field, 'New{Enter}');
    expect(onCommit).toHaveBeenCalledWith('New');
    await waitFor(() =>
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument(),
    );
  });

  it('opens the editor from the keyboard', async () => {
    render(
      <InlineEdit value="Old" canEdit onCommit={jest.fn()} ariaLabel="title" />,
    );
    screen.getByRole('button', { name: 'Edit title' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: 'title' })).toBeInTheDocument();
  });

  it('does not commit an unchanged value', async () => {
    const onCommit = jest.fn();
    render(
      <InlineEdit value="Same" canEdit onCommit={onCommit} ariaLabel="title" />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit title' }));
    await userEvent.type(screen.getByRole('textbox'), '{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('discards the draft on Escape', async () => {
    const onCommit = jest.fn();
    render(
      <InlineEdit value="Keep" canEdit onCommit={onCommit} ariaLabel="title" />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit title' }));
    await userEvent.type(screen.getByRole('textbox'), ' edited{Escape}');
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText('Keep')).toBeInTheDocument();
  });

  it('commits on blur', async () => {
    const onCommit = jest.fn();
    render(
      <>
        <InlineEdit value="Old" canEdit onCommit={onCommit} ariaLabel="title" />
        <button type="button">elsewhere</button>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit title' }));
    await userEvent.type(screen.getByRole('textbox'), ' more');
    await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(onCommit).toHaveBeenCalledWith('Old more');
  });
});

describe('formatDate', () => {
  it('formats an ISO timestamp for the locale', () => {
    expect(formatDate('2026-09-04T10:00:00.000Z')).toBe(
      new Date('2026-09-04T10:00:00.000Z').toLocaleString(),
    );
  });

  it('returns invalid input unchanged where formatting fails', () => {
    expect(formatDate('not-a-date')).toBe(
      new Date('not-a-date').toLocaleString(),
    );
  });
});
