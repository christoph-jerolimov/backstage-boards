import { Entity } from '@backstage/catalog-model';
import {
  ALL_LEVELS,
  ALL_VISIBILITIES,
  entityDisplayName,
  isTextRef,
  isValidActorRef,
  isValidEntityRef,
  isValidPrincipalRef,
  levelIncludes,
  maxLevel,
  refDisplayName,
  TEXT_REF_PREFIX,
  textRefDisplay,
} from './refs';

function entity(over: {
  kind?: string;
  name?: string;
  title?: string;
  displayName?: string;
}): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: over.kind ?? 'User',
    metadata: {
      name: over.name ?? 'csmith',
      namespace: 'default',
      ...(over.title ? { title: over.title } : {}),
    },
    spec: over.displayName
      ? { profile: { displayName: over.displayName } }
      : {},
  };
}

describe('text refs', () => {
  it('detects the text prefix', () => {
    expect(isTextRef(`${TEXT_REF_PREFIX}Jane`)).toBe(true);
    expect(isTextRef('user:default/jane')).toBe(false);
    expect(isTextRef('')).toBe(false);
  });

  it('returns the display value only for text refs', () => {
    expect(textRefDisplay('text:Jane (agency)')).toBe('Jane (agency)');
    expect(textRefDisplay('text:')).toBe('');
    expect(textRefDisplay('user:default/jane')).toBeUndefined();
  });
});

describe('isValidActorRef', () => {
  it('accepts catalog refs of any kind', () => {
    expect(isValidActorRef('user:default/jane')).toBe(true);
    expect(isValidActorRef('group:default/team-a')).toBe(true);
    expect(isValidActorRef('component:default/svc')).toBe(true);
  });

  it('accepts text refs with content, rejects empty ones', () => {
    expect(isValidActorRef('text:Jane')).toBe(true);
    expect(isValidActorRef('text:   ')).toBe(false);
    expect(isValidActorRef('text:')).toBe(false);
  });

  it('rejects unparseable refs', () => {
    expect(isValidActorRef('not a ref !!')).toBe(false);
    expect(isValidActorRef('')).toBe(false);
  });
});

describe('isValidPrincipalRef', () => {
  it('accepts only user and group refs', () => {
    expect(isValidPrincipalRef('user:default/jane')).toBe(true);
    expect(isValidPrincipalRef('group:default/team-a')).toBe(true);
    expect(isValidPrincipalRef('User:default/jane')).toBe(true);
    expect(isValidPrincipalRef('component:default/svc')).toBe(false);
  });

  it('rejects text refs and garbage', () => {
    expect(isValidPrincipalRef('text:Jane')).toBe(false);
    expect(isValidPrincipalRef('nonsense !!')).toBe(false);
  });
});

describe('isValidEntityRef', () => {
  it('accepts any parseable entity ref', () => {
    expect(isValidEntityRef('component:default/svc')).toBe(true);
    expect(isValidEntityRef('api:default/grpc')).toBe(true);
  });

  it('rejects unparseable values', () => {
    expect(isValidEntityRef('not a ref !!')).toBe(false);
    expect(isValidEntityRef('')).toBe(false);
  });
});

describe('permission levels', () => {
  it('levelIncludes ranks read < write < admin', () => {
    expect(levelIncludes('admin', 'read')).toBe(true);
    expect(levelIncludes('admin', 'write')).toBe(true);
    expect(levelIncludes('admin', 'admin')).toBe(true);
    expect(levelIncludes('write', 'read')).toBe(true);
    expect(levelIncludes('write', 'admin')).toBe(false);
    expect(levelIncludes('read', 'write')).toBe(false);
    expect(levelIncludes('read', 'read')).toBe(true);
  });

  it('levelIncludes treats a missing level as no access', () => {
    expect(levelIncludes(undefined, 'read')).toBe(false);
  });

  it('maxLevel picks the higher level and tolerates gaps', () => {
    expect(maxLevel('read', 'admin')).toBe('admin');
    expect(maxLevel('admin', 'read')).toBe('admin');
    expect(maxLevel('write', 'write')).toBe('write');
    expect(maxLevel(undefined, 'write')).toBe('write');
    expect(maxLevel('write', undefined)).toBe('write');
    expect(maxLevel(undefined, undefined)).toBeUndefined();
  });

  it('exposes the full level and visibility sets', () => {
    expect(ALL_LEVELS).toEqual(['read', 'write', 'admin']);
    expect(ALL_VISIBILITIES).toContain('private');
    expect(ALL_VISIBILITIES).toHaveLength(5);
  });
});

describe('entityDisplayName', () => {
  const ref = 'user:default/csmith';

  it('prefers the profile display name of users and groups', () => {
    expect(
      entityDisplayName(ref, entity({ displayName: 'Christoph Smith' })),
    ).toBe('Christoph Smith');
    expect(
      entityDisplayName('group:default/team-a', {
        ...entity({
          kind: 'Group',
          name: 'team-a',
          title: 'Team A (title)',
          displayName: 'Team Alpha',
        }),
      }),
    ).toBe('Team Alpha');
  });

  it('compares the kind case-insensitively', () => {
    for (const kind of ['User', 'user', 'GROUP', 'group']) {
      expect(
        entityDisplayName(ref, entity({ kind, displayName: 'Chris' })),
      ).toBe('Chris');
    }
  });

  it('uses the title for every other kind, profile or not', () => {
    expect(
      entityDisplayName('component:default/www', {
        ...entity({ kind: 'Component', name: 'www', title: 'Web front end' }),
      }),
    ).toBe('Web front end');
    // a non-profile kind carrying a profile display name still reads by title
    expect(
      entityDisplayName('component:default/www', {
        ...entity({
          kind: 'Component',
          name: 'www',
          title: 'Web front end',
          displayName: 'ignored',
        }),
      }),
    ).toBe('Web front end');
  });

  it('falls back to the title, then the entity name', () => {
    expect(entityDisplayName(ref, entity({ title: 'Christoph (title)' }))).toBe(
      'Christoph (title)',
    );
    expect(entityDisplayName(ref, entity({}))).toBe('csmith');
  });

  it('reads like refDisplayName without an entity', () => {
    expect(entityDisplayName(ref)).toBe('csmith');
    expect(entityDisplayName(ref)).toBe(refDisplayName(ref));
    expect(entityDisplayName('text:Jane (agency)')).toBe('Jane (agency)');
    expect(entityDisplayName('not a ref')).toBe('not a ref');
  });
});
