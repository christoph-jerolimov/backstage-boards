import { screen, waitFor, within } from '@testing-library/react';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { AssigneeAvatars } from './AssigneeAvatars';
import { renderWithProviders } from './__testUtils__/testHelpers';

function userEntity(name: string, profile?: Record<string, string>): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'User',
    metadata: { name, namespace: 'default' },
    spec: profile ? { profile } : {},
  };
}

/** Catalog stub resolving refs in the order they were requested. */
function stubCatalog(byRef: Record<string, Entity | undefined>) {
  return {
    getEntitiesByRefs: jest.fn(async (request: { entityRefs: string[] }) => ({
      items: request.entityRefs.map(ref => byRef[ref]),
    })),
  };
}

const renderAvatars = (refs: string[], catalog: unknown) =>
  renderWithProviders(
    <div data-testid="host">
      <AssigneeAvatars refs={refs} />
    </div>,
    { apis: [[catalogApiRef, catalog]] },
  );

const host = () => screen.getByTestId('host');
const avatars = () => host().querySelectorAll('.bui-AvatarRoot');

describe('AssigneeAvatars', () => {
  it('renders nothing without assignees', () => {
    renderAvatars([], stubCatalog({}));
    expect(host()).toBeEmptyDOMElement();
  });

  it('shows one avatar with the catalog display name, both linking to the entity', async () => {
    renderAvatars(
      ['user:default/jane'],
      stubCatalog({
        'user:default/jane': userEntity('jane', { displayName: 'Jane Doe' }),
      }),
    );
    // the display name arrives once the catalog query resolves
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(avatars()).toHaveLength(1);
    // both the avatar and the name link to the catalog entity
    const links = within(host()).getAllByRole('link');
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/catalog/default/user/jane');
    }
  });

  it('falls back to the ref name when the catalog has no entity', async () => {
    renderAvatars(['user:default/ghost'], stubCatalog({}));
    expect(await screen.findByText('ghost')).toBeInTheDocument();
    expect(avatars()).toHaveLength(1);
  });

  it('stacks several assignees as avatars without a name label', async () => {
    renderAvatars(
      ['user:default/jane', 'group:default/team-a'],
      stubCatalog({
        'user:default/jane': userEntity('jane', { displayName: 'Jane Doe' }),
        'group:default/team-a': {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Group',
          metadata: { name: 'team-a', namespace: 'default', title: 'Team A' },
        },
      }),
    );
    await screen.findByRole('img', { name: 'Jane Doe' });
    // the metadata title is used when there is no profile display name
    expect(await screen.findByRole('img', { name: 'Team A' })).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
    // no single-assignee name label in stacked mode
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-stacked]'),
    ).toBeInTheDocument();
  });

  it('renders text assignees as plain badges, not avatars', async () => {
    renderAvatars(['text:External Person'], stubCatalog({}));
    expect(await screen.findByText('External Person')).toBeInTheDocument();
    expect(avatars()).toHaveLength(0);
  });

  it('requests only the catalog refs, sorted and deduplicated', async () => {
    const catalog = stubCatalog({});
    renderAvatars(
      ['user:default/zoe', 'text:Someone', 'group:default/alpha'],
      catalog,
    );
    await waitFor(() => expect(catalog.getEntitiesByRefs).toHaveBeenCalled());
    expect(catalog.getEntitiesByRefs.mock.calls[0][0].entityRefs).toEqual([
      'group:default/alpha',
      'user:default/zoe',
    ]);
  });
});
