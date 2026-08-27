import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WatchButton } from './WatchButton';
import { renderWithProviders } from './__testUtils__/testHelpers';

function renderButton(over: Partial<Parameters<typeof WatchButton>[0]> = {}) {
  const props = {
    watching: false,
    onToggle: jest.fn(),
    loadWatchers: jest.fn().mockResolvedValue([]),
    targetLabel: 'this board',
    ...over,
  };
  renderWithProviders(<WatchButton {...props} />);
  return props;
}

describe('WatchButton', () => {
  it('offers to start watching when the user does not watch yet', async () => {
    const props = renderButton({ watching: false });
    const button = screen.getByRole('button', { name: 'Watch this board' });
    expect(button).toHaveTextContent('Watch');
    await userEvent.click(button);
    expect(props.onToggle).toHaveBeenCalledWith(true);
  });

  it('offers to stop watching when the user watches already', async () => {
    const props = renderButton({ watching: true });
    const button = screen.getByRole('button', {
      name: 'Stop watching this board',
    });
    expect(button).toHaveTextContent('Watching');
    await userEvent.click(button);
    expect(props.onToggle).toHaveBeenCalledWith(false);
  });

  it('does not load the watchers before the menu is opened', () => {
    const props = renderButton();
    expect(props.loadWatchers).not.toHaveBeenCalled();
  });

  it('lists the watchers when the menu is opened', async () => {
    renderButton({
      loadWatchers: jest
        .fn()
        .mockResolvedValue(['user:default/jane', 'text:Ops team']),
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Show watchers of this board' }),
    );
    expect(
      await screen.findByRole('link', { name: 'jane' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ops team')).toBeInTheDocument();
  });

  it('says so when nobody watches yet', async () => {
    renderButton({ loadWatchers: jest.fn().mockResolvedValue([]) });
    await userEvent.click(
      screen.getByRole('button', { name: 'Show watchers of this board' }),
    );
    expect(
      await screen.findByText('Nobody is watching yet'),
    ).toBeInTheDocument();
  });
});
