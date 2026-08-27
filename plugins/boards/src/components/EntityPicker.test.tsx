import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { EntityPicker } from './EntityPicker';
import { renderWithProviders } from './__testUtils__/testHelpers';

const entities = [
  {
    kind: 'Component',
    metadata: { namespace: 'default', name: 'www', title: 'Website' },
  },
  {
    kind: 'Component',
    metadata: { namespace: 'default', name: 'api' },
  },
  {
    kind: 'Group',
    metadata: { namespace: 'default', name: 'team-a' },
  },
];

/** BUI's Combobox opens its listbox on ArrowDown, not on a plain click. */
async function openList(name: string) {
  await userEvent.click(screen.getByRole('combobox', { name }));
  await userEvent.keyboard('{ArrowDown}');
}

function renderPicker(over: { exclude?: string[] } = {}) {
  const catalogApi = {
    getEntities: jest.fn().mockResolvedValue({ items: entities }),
  };
  const onSelect = jest.fn();
  renderWithProviders(
    <EntityPicker
      ariaLabel="Add entity reference"
      exclude={over.exclude}
      onSelect={onSelect}
    />,
    { apis: [[catalogApiRef, catalogApi]] },
  );
  return { catalogApi, onSelect };
}

describe('EntityPicker', () => {
  it('lists every catalog entity, sorted by label', async () => {
    renderPicker();
    await openList('Add entity reference');
    const options = await screen.findAllByRole('option');
    expect(options.map(option => option.textContent)).toEqual([
      'api (component:default/api)',
      'team-a (group:default/team-a)',
      'Website (component:default/www)',
    ]);
  });

  it('filters the options by what the user typed', async () => {
    renderPicker();
    await userEvent.type(
      screen.getByRole('combobox', { name: 'Add entity reference' }),
      'websi',
    );
    const options = await screen.findAllByRole('option');
    expect(options.map(option => option.textContent)).toEqual([
      'Website (component:default/www)',
    ]);
  });

  it('hides the entities that are already referenced', async () => {
    renderPicker({ exclude: ['component:default/www'] });
    await openList('Add entity reference');
    const options = await screen.findAllByRole('option');
    expect(
      options.map(option => option.textContent),
    ).not.toContain('Website (component:default/www)');
  });

  it('reports the selected ref and clears the input', async () => {
    const { onSelect } = renderPicker();
    const input = screen.getByRole('combobox', {
      name: 'Add entity reference',
    });
    await userEvent.type(input, 'api');
    await userEvent.click(await screen.findByRole('option'));
    expect(onSelect).toHaveBeenCalledWith('component:default/api');
    expect(input).toHaveValue('');
  });
});
