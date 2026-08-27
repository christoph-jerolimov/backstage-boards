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
});
