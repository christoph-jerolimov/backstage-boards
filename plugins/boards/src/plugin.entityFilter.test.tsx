import { createExtensionTester } from '@backstage/frontend-test-utils';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { Entity } from '@backstage/catalog-model';
import { boardsPlugin } from './plugin';

// Lives in its own file: instantiating an extension tester in the same file
// as `renderTestApp` leaves the following app render stuck on its loader.

function entity(labels?: Record<string, string>): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'payments', namespace: 'default', labels },
    spec: { type: 'service' },
  };
}

describe('entity boards content filter', () => {
  const filterFor = (config?: { filter?: unknown }) => {
    const filter = createExtensionTester(
      boardsPlugin.getExtension('entity-content:boards/entity')!,
      config ? { config: config as any } : undefined,
    ).get(EntityContentBlueprint.dataRefs.filterFunction);
    if (!filter) {
      throw new Error('the boards entity content declares no entity filter');
    }
    return filter;
  };

  it('matches only entities a board references', () => {
    const filter = filterFor();
    expect(filter(entity({ 'boards/is-referenced': 'auto-detected' }))).toBe(
      true,
    );
    expect(filter(entity({ other: 'label' }))).toBe(false);
    expect(filter(entity())).toBe(false);
  });

  it('can be overridden through the extension config', () => {
    const filter = filterFor({ filter: { kind: 'component' } });
    expect(filter(entity())).toBe(true);
  });
});
