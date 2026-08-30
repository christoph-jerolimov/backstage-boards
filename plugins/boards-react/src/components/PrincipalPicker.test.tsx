import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { PrincipalPicker } from './PrincipalPicker';
import { renderWithProviders } from './__testUtils__/testHelpers';

const entities = [
  { kind: 'User', metadata: { namespace: 'default', name: 'jane' } },
  {
    kind: 'Group',
    metadata: { namespace: 'default', name: 'team-a', title: 'Team A' },
  },
];

/** BUI's Combobox opens its listbox on ArrowDown, not on a plain click. */
async function openList(name: string) {
  await userEvent.click(screen.getByRole('combobox', { name }));
  await userEvent.keyboard('{ArrowDown}');
}

function renderPicker(over: { allowText?: boolean; exclude?: string[] } = {}) {
  const catalogApi = {
    getEntities: jest.fn().mockResolvedValue({ items: entities }),
  };
  const onSelect = jest.fn();
  renderWithProviders(
    <PrincipalPicker
      ariaLabel="Add person"
      allowText={over.allowText ?? false}
      exclude={over.exclude}
      onSelect={onSelect}
    />,
    { apis: [[catalogApiRef, catalogApi]] },
  );
  return { catalogApi, onSelect };
}

describe('PrincipalPicker', () => {
  it('only asks the catalog for users and groups', async () => {
    const { catalogApi } = renderPicker();
    expect(catalogApi.getEntities).toHaveBeenCalledWith(
      expect.objectContaining({ filter: { kind: ['User', 'Group'] } }),
    );
  });

  it('lists users and groups sorted by label', async () => {
    renderPicker();
    await openList('Add person');
    const options = await screen.findAllByRole('option');
    expect(options.map(option => option.textContent)).toEqual([
      'jane (user:default/jane)',
      'Team A (group:default/team-a)',
    ]);
  });

  it('hides the principals that are already added', async () => {
    renderPicker({ exclude: ['user:default/jane'] });
    await openList('Add person');
    const options = await screen.findAllByRole('option');
    expect(options.map(option => option.textContent)).toEqual([
      'Team A (group:default/team-a)',
    ]);
  });

  it('reports the selected catalog ref', async () => {
    const { onSelect } = renderPicker();
    await userEvent.type(
      screen.getByRole('combobox', { name: 'Add person' }),
      'jane',
    );
    await userEvent.click(await screen.findByRole('option'));
    expect(onSelect).toHaveBeenCalledWith('user:default/jane');
  });

  it('offers the typed input as a text identity when allowed', async () => {
    const { onSelect } = renderPicker({ allowText: true });
    await userEvent.type(
      screen.getByRole('combobox', { name: 'Add person' }),
      'Some Contractor',
    );
    const option = await screen.findByRole('option', {
      name: 'Use text “Some Contractor”',
    });
    await userEvent.click(option);
    expect(onSelect).toHaveBeenCalledWith('text:Some Contractor');
  });

  it('does not offer a text identity when it is not allowed', async () => {
    renderPicker({ allowText: false });
    await userEvent.type(
      screen.getByRole('combobox', { name: 'Add person' }),
      'Some Contractor',
    );
    expect(await screen.findByRole('option')).toHaveTextContent(
      'No results found.',
    );
  });
});
