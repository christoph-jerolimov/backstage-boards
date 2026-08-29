import { extractMentions, findMentions } from './mentions';

describe('extractMentions', () => {
  it('extracts full user and group refs', () => {
    expect(
      extractMentions('ping @user:default/jane and @group:default/team-a'),
    ).toEqual(['user:default/jane', 'group:default/team-a']);
  });

  it('resolves shorthand to user:default', () => {
    expect(extractMentions('@carol please review')).toEqual([
      'user:default/carol',
    ]);
  });

  it('resolves refs without namespace to the default namespace', () => {
    expect(extractMentions('cc @user:jane')).toEqual(['user:default/jane']);
  });

  it('deduplicates', () => {
    expect(extractMentions('@carol and again @carol')).toEqual([
      'user:default/carol',
    ]);
  });

  it('ignores email-like text', () => {
    expect(extractMentions('mail me at jane@example.com')).toEqual([]);
  });

  it('matches after punctuation openers and start of text', () => {
    expect(extractMentions('(@carol)')).toEqual(['user:default/carol']);
  });

  it('returns only user/group principals, not other entity kinds', () => {
    expect(extractMentions('@component:webserver-example @carol')).toEqual([
      'user:default/carol',
    ]);
  });

  it('ignores non-entity kinds like text:', () => {
    expect(extractMentions('@text:not-a-ref')).toEqual([]);
  });

  it('leaves sentence punctuation out of the ref', () => {
    expect(extractMentions('owned by @group:default/guests.')).toEqual([
      'group:default/guests',
    ]);
    expect(extractMentions('thanks @carol.')).toEqual(['user:default/carol']);
  });
});

describe('findMentions', () => {
  it('reports positions and display text', () => {
    const [mention] = findMentions('hi @carol!');
    expect(mention).toEqual({
      start: 3,
      end: 9,
      entityRef: 'user:default/carol',
      display: '@carol',
    });
  });

  it('reports full entity refs of any kind', () => {
    const mentions = findMentions(
      'see @component:webserver-example and @group:default/another-team',
    );
    expect(mentions.map(m => m.entityRef)).toEqual([
      'component:default/webserver-example',
      'group:default/another-team',
    ]);
    expect(mentions[0].display).toBe('@component:webserver-example');
  });

  it('skips non-entity kinds', () => {
    expect(findMentions('read @text:foo')).toEqual([]);
  });
});
