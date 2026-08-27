import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  changeSummary,
  formatDate,
  InlineEdit,
  MarkdownContent,
  RefChips,
  RefDisplay,
  useAsyncData,
} from './common';
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

describe('RefChips', () => {
  it('renders nothing for an empty list', () => {
    render(
      <div data-testid="host">
        <RefChips refs={[]} />
      </div>,
    );
    expect(screen.getByTestId('host')).toBeEmptyDOMElement();
  });

  it('renders one badge per ref', () => {
    renderWithProviders(
      <RefChips refs={['text:Ops team', 'text:Support']} />,
    );
    expect(screen.getByText('Ops team')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
  });
});

describe('MarkdownContent', () => {
  it('renders paragraphs with bold, italic, code and links', () => {
    renderWithProviders(
      <MarkdownContent text="Some **bold** and *italic* and `code` and [a link](https://example.com)." />,
    );
    // the inline text token renders inside the emphasis element
    expect(screen.getByText('bold').closest('strong')).toBeInTheDocument();
    expect(screen.getByText('italic').closest('em')).toBeInTheDocument();
    expect(screen.getByText('code').tagName).toBe('CODE');
    const link = screen.getByRole('link', { name: 'a link' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders fenced code blocks verbatim', () => {
    renderWithProviders(
      <MarkdownContent text={'```\nconst a = 1;\n```'} />,
    );
    expect(screen.getByText('const a = 1;').tagName).toBe('CODE');
  });

  it('renders bulleted and numbered lists', () => {
    const { container } = renderWithProviders(
      <MarkdownContent text={'- one\n- two\n\n1. first\n2. second'} />,
    );
    expect(container.querySelectorAll('ul li')).toHaveLength(2);
    expect(container.querySelectorAll('ol li')).toHaveLength(2);
  });

  it('auto-links @-mentioned entities', async () => {
    renderWithProviders(<MarkdownContent text="ping @user:default/jane now" />);
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
    await userEvent.click(screen.getByRole('button', { name: 'Edit board name' }));
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
        <InlineEdit
          value="Old"
          canEdit
          onCommit={onCommit}
          ariaLabel="title"
        />
        <button type="button">elsewhere</button>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit title' }));
    await userEvent.type(screen.getByRole('textbox'), ' more');
    await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(onCommit).toHaveBeenCalledWith('Old more');
  });
});

describe('useAsyncData', () => {
  it('loads data and exposes a refresh', async () => {
    const load = jest
      .fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');
    const { result } = renderHook(() => useAsyncData(load, []));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('first');

    await act(() => result.current.refresh());
    expect(result.current.data).toBe('second');
  });

  it('captures load errors', async () => {
    const load = jest.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAsyncData(load, []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.data).toBeUndefined();
  });

  it('ignores results from superseded loads', async () => {
    let resolveFirst: (value: string) => void = () => {};
    const load = jest
      .fn()
      .mockImplementationOnce(
        () => new Promise<string>(resolve => (resolveFirst = resolve)),
      )
      .mockResolvedValueOnce('newest');
    const { result } = renderHook(() => useAsyncData(load, []));

    await act(() => result.current.refresh());
    expect(result.current.data).toBe('newest');

    await act(async () => {
      resolveFirst('stale');
    });
    expect(result.current.data).toBe('newest');
  });
});

describe('changeSummary', () => {
  it.each([
    [{ type: 'created' }, 'created this item'],
    [{ type: 'archived' }, 'archived this item'],
    [{ type: 'restored' }, 'restored this item'],
  ])('describes %j', (change, expected) => {
    expect(changeSummary(change)).toBe(expected);
  });

  it('describes moves between columns', () => {
    expect(
      changeSummary({ type: 'moved', oldValue: 'Todo', newValue: 'Done' }),
    ).toBe('moved this item from “Todo” to “Done”');
  });

  it('describes a field change without values', () => {
    expect(changeSummary({ type: 'updated', field: 'title' })).toBe(
      'changed the title',
    );
  });

  it('describes a field change with values', () => {
    expect(
      changeSummary({
        type: 'updated',
        field: 'title',
        oldValue: 'a',
        newValue: 'b',
      }),
    ).toBe('changed title: "a" → "b"');
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
