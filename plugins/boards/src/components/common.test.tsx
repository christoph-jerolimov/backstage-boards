import { render, screen } from '@testing-library/react';
import { changeSummary, RefChips } from './common';
import { renderWithProviders } from './__testUtils__/testHelpers';

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
    renderWithProviders(<RefChips refs={['text:Ops team', 'text:Support']} />);
    expect(screen.getByText('Ops team')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
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
