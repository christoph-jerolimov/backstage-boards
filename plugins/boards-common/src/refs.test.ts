import {
  ALL_LEVELS,
  ALL_VISIBILITIES,
  isTextRef,
  isValidActorRef,
  isValidEntityRef,
  isValidPrincipalRef,
  levelIncludes,
  maxLevel,
  TEXT_REF_PREFIX,
  textRefDisplay,
} from './refs';

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
