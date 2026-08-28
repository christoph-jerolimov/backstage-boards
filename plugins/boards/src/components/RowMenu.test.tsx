import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu, MenuItem } from '@backstage/ui';
import { useRowMenu } from './RowMenu';
import { renderWithProviders } from './__testUtils__/testHelpers';

interface TestRow {
  id: string;
  title: string;
}

const row: TestRow = { id: 'row-1', title: 'Right-clicked' };

/** A minimal surface with row actions, as the tables and cards have. */
function Host(props: { onAction?: () => void }) {
  const rowMenu = useRowMenu<TestRow>({
    name: entry => entry.title,
    children: entry => (
      <Menu aria-label={`Actions for ${entry.title}`}>
        <MenuItem onAction={() => props.onAction?.()}>Open details</MenuItem>
      </Menu>
    ),
  });
  return (
    <div data-testid="host">
      <button
        type="button"
        onContextMenu={event => rowMenu.onContextMenu(row, event)}
      >
        {row.title}
      </button>
      {rowMenu.rowActions(row)}
      {rowMenu.contextMenu}
    </div>
  );
}

describe('useRowMenu', () => {
  it('offers the row a three-dot actions button', async () => {
    const onAction = jest.fn();
    renderWithProviders(<Host onAction={onAction} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Actions for Right-clicked' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Open details' }),
    );
    expect(onAction).toHaveBeenCalled();
  });

  it('renders no context menu until a row is right-clicked', () => {
    renderWithProviders(<Host />);
    expect(
      document.querySelector('[aria-label="Context menu for Right-clicked"]'),
    ).toBeNull();
  });

  it('opens the context menu at the pointer', async () => {
    renderWithProviders(<Host />);
    await userEvent.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Right-clicked' }),
      coords: { clientX: 120, clientY: 80 },
    });
    await screen.findByRole('menuitem', { name: 'Open details' });
    // the trigger is hidden from assistive tech while the menu owns the
    // focus scope, so it is only reachable through the DOM
    expect(
      document.querySelector('[aria-label="Context menu for Right-clicked"]'),
    ).toHaveStyle({ left: '120px', top: '80px' });
  });
});
