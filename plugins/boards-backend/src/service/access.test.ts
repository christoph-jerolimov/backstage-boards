import { actorRef, computeEffectiveLevel } from './access';
import { alice, anonymous, bob, syncService } from './testUtils';

describe('computeEffectiveLevel', () => {
  it('grants nothing on private boards without entries', () => {
    expect(
      computeEffectiveLevel({
        principal: alice,
        visibility: 'private',
        entries: [],
      }),
    ).toBeUndefined();
  });

  it('grants via direct user entry', () => {
    expect(
      computeEffectiveLevel({
        principal: alice,
        visibility: 'private',
        entries: [{ principalRef: 'user:default/alice', level: 'write' }],
      }),
    ).toBe('write');
  });

  it('grants via ownership group entry', () => {
    expect(
      computeEffectiveLevel({
        principal: alice,
        visibility: 'private',
        entries: [{ principalRef: 'group:default/team-a', level: 'read' }],
      }),
    ).toBe('read');
  });

  it('uses the highest of multiple grants', () => {
    expect(
      computeEffectiveLevel({
        principal: alice,
        visibility: 'private',
        entries: [
          { principalRef: 'user:default/alice', level: 'read' },
          { principalRef: 'group:default/team-a', level: 'write' },
        ],
      }),
    ).toBe('write');
  });

  it('does not grant to non-members', () => {
    expect(
      computeEffectiveLevel({
        principal: bob,
        visibility: 'private',
        entries: [{ principalRef: 'group:default/team-a', level: 'admin' }],
      }),
    ).toBeUndefined();
  });

  it('grants logged-in modes only to users', () => {
    expect(
      computeEffectiveLevel({
        principal: alice,
        visibility: 'logged-in-write',
        entries: [],
      }),
    ).toBe('write');
    expect(
      computeEffectiveLevel({
        principal: anonymous,
        visibility: 'logged-in-write',
        entries: [],
      }),
    ).toBeUndefined();
  });

  it('grants public modes to anonymous, capped below admin', () => {
    expect(
      computeEffectiveLevel({
        principal: anonymous,
        visibility: 'public-read',
        entries: [],
      }),
    ).toBe('read');
    expect(
      computeEffectiveLevel({
        principal: anonymous,
        visibility: 'public-write',
        entries: [],
      }),
    ).toBe('write');
  });

  it('never derives admin from visibility alone', () => {
    for (const visibility of [
      'logged-in-read',
      'logged-in-write',
      'public-read',
      'public-write',
    ] as const) {
      expect(
        computeEffectiveLevel({ principal: alice, visibility, entries: [] }),
      ).not.toBe('admin');
    }
  });

  it('direct grant tops up public visibility', () => {
    expect(
      computeEffectiveLevel({
        principal: alice,
        visibility: 'public-read',
        entries: [{ principalRef: 'user:default/alice', level: 'admin' }],
      }),
    ).toBe('admin');
  });

  it('treats service principals as admin', () => {
    expect(
      computeEffectiveLevel({
        principal: syncService,
        visibility: 'private',
        entries: [],
      }),
    ).toBe('admin');
  });
});

describe('actorRef', () => {
  it('maps principals to actor refs', () => {
    expect(actorRef(alice)).toBe('user:default/alice');
    expect(actorRef(syncService)).toBe('text:external:github-sync');
    expect(actorRef(anonymous)).toBe('text:anonymous');
  });
});
