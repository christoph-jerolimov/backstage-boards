import {
  autolinkEntities,
  BlockToken,
  InlineToken,
  parseMarkdown,
} from './markdown';

/** The inline tokens of a paragraph, failing the test for any other block. */
function paragraphChildren(block: BlockToken): InlineToken[] {
  if (block.type !== 'paragraph') {
    throw new Error(`Expected a paragraph block, got '${block.type}'`);
  }
  return block.children;
}

describe('autolinkEntities', () => {
  it('links catalog entity refs with namespace', () => {
    expect(autolinkEntities('please check system:default/example now')).toEqual(
      [
        { type: 'text', value: 'please check ' },
        { type: 'entity', entityRef: 'system:default/example' },
        { type: 'text', value: ' now' },
      ],
    );
  });

  it('links short-form refs', () => {
    expect(autolinkEntities('ask user:christoph')).toEqual([
      { type: 'text', value: 'ask ' },
      { type: 'entity', entityRef: 'user:christoph' },
    ]);
  });

  it('never links text: refs', () => {
    expect(autolinkEntities('by text:anonymous')).toEqual([
      { type: 'text', value: 'by text:anonymous' },
    ]);
  });

  it('links @-mentions as entities', () => {
    expect(autolinkEntities('ping @carol about this')).toEqual([
      { type: 'text', value: 'ping ' },
      { type: 'entity', entityRef: 'user:default/carol' },
      { type: 'text', value: ' about this' },
    ]);
    expect(autolinkEntities('@group:default/team-a fyi')).toEqual([
      { type: 'entity', entityRef: 'group:default/team-a' },
      { type: 'text', value: ' fyi' },
    ]);
  });

  it('links full-entity-ref mentions of any kind', () => {
    expect(autolinkEntities('see @component:webserver-example please')).toEqual(
      [
        { type: 'text', value: 'see ' },
        { type: 'entity', entityRef: 'component:default/webserver-example' },
        { type: 'text', value: ' please' },
      ],
    );
  });

  it('never links text: mentions', () => {
    expect(autolinkEntities('read @text:foo')).toEqual([
      { type: 'text', value: 'read @text:foo' },
    ]);
  });

  it('does not treat emails as mentions', () => {
    expect(autolinkEntities('mail jane@example.com')).toEqual([
      { type: 'text', value: 'mail jane@example.com' },
    ]);
  });

  it('links bare urls', () => {
    expect(autolinkEntities('see https://example.com/a for details')).toEqual([
      { type: 'text', value: 'see ' },
      {
        type: 'link',
        href: 'https://example.com/a',
        children: [{ type: 'text', value: 'https://example.com/a' }],
      },
      { type: 'text', value: ' for details' },
    ]);
  });

  it('keeps sentence punctuation out of a bare url', () => {
    expect(autolinkEntities('read https://example.com/docs.')).toEqual([
      { type: 'text', value: 'read ' },
      {
        type: 'link',
        href: 'https://example.com/docs',
        children: [{ type: 'text', value: 'https://example.com/docs' }],
      },
      { type: 'text', value: '.' },
    ]);
  });

  it('does not read a url with a port as an entity ref', () => {
    expect(autolinkEntities('at http://host:8080/path')).toEqual([
      { type: 'text', value: 'at ' },
      {
        type: 'link',
        href: 'http://host:8080/path',
        children: [{ type: 'text', value: 'http://host:8080/path' }],
      },
    ]);
  });
});

describe('parseMarkdown', () => {
  it('parses emphasis, bold and inline code', () => {
    const [block] = parseMarkdown('a **bold** and *soft* `code`');
    expect(block).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'a ' },
        { type: 'bold', children: [{ type: 'text', value: 'bold' }] },
        { type: 'text', value: ' and ' },
        { type: 'italic', children: [{ type: 'text', value: 'soft' }] },
        { type: 'text', value: ' ' },
        { type: 'code', value: 'code' },
      ],
    });
  });

  it('parses links but only http(s)', () => {
    const [block] = parseMarkdown('[docs](https://example.com)');
    expect(block).toEqual({
      type: 'paragraph',
      children: [
        {
          type: 'link',
          href: 'https://example.com',
          children: [{ type: 'text', value: 'docs' }],
        },
      ],
    });
    const [nonLink] = parseMarkdown('[x](javascript:alert(1))');
    expect(
      paragraphChildren(nonLink).some(token => token.type === 'link'),
    ).toBe(false);
  });

  it('keeps a url inside inline code as code', () => {
    const [block] = parseMarkdown('run `https://example.com` locally');
    expect(paragraphChildren(block)).toEqual([
      { type: 'text', value: 'run ' },
      { type: 'code', value: 'https://example.com' },
      { type: 'text', value: ' locally' },
    ]);
  });

  it('parses code blocks verbatim without linking', () => {
    const blocks = parseMarkdown('```\nuser:christoph <b>x</b>\n```');
    expect(blocks).toEqual([
      { type: 'codeBlock', value: 'user:christoph <b>x</b>' },
    ]);
  });

  it('parses lists', () => {
    const blocks = parseMarkdown('- one\n- two user:jane');
    expect(blocks).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          [{ type: 'text', value: 'one' }],
          [
            { type: 'text', value: 'two ' },
            { type: 'entity', entityRef: 'user:jane' },
          ],
        ],
      },
    ]);
  });

  it('does not emit raw html', () => {
    const [block] = parseMarkdown('<script>alert(1)</script>');
    expect(block).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: '<script>alert(1)</script>' }],
    });
  });

  it('auto-links entities inside paragraphs', () => {
    const [block] = parseMarkdown('deployed to system:default/payments');
    expect(paragraphChildren(block)).toContainEqual({
      type: 'entity',
      entityRef: 'system:default/payments',
    });
  });

  it('parses headings with inline formatting', () => {
    const blocks = parseMarkdown('## Rollout **plan**');
    expect(blocks).toEqual([
      {
        type: 'heading',
        level: 2,
        children: [
          { type: 'text', value: 'Rollout ' },
          { type: 'bold', children: [{ type: 'text', value: 'plan' }] },
        ],
      },
    ]);
  });

  it('keeps hashtags without a space as paragraph text', () => {
    const [block] = parseMarkdown('#hashtag');
    expect(block).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: '#hashtag' }],
    });
  });

  it('parses pipe tables with inline formatting and entity refs', () => {
    const blocks = parseMarkdown(
      '| Name | Owner |\n| --- | --- |\n| **api** | user:jane |\n| web |',
    );
    expect(blocks).toEqual([
      {
        type: 'table',
        header: [
          [{ type: 'text', value: 'Name' }],
          [{ type: 'text', value: 'Owner' }],
        ],
        rows: [
          [
            [{ type: 'bold', children: [{ type: 'text', value: 'api' }] }],
            [{ type: 'entity', entityRef: 'user:jane' }],
          ],
          [[{ type: 'text', value: 'web' }], []],
        ],
      },
    ]);
  });

  it('keeps pipe lines without a separator row as paragraph text', () => {
    const blocks = parseMarkdown('either | or');
    expect(blocks).toEqual([
      {
        type: 'paragraph',
        children: [{ type: 'text', value: 'either | or' }],
      },
    ]);
  });

  it('does not swallow a table into a preceding paragraph', () => {
    const blocks = parseMarkdown(
      'intro text\n| a | b |\n| --- | --- |\n| 1 | 2 |',
    );
    expect(blocks.map(block => block.type)).toEqual(['paragraph', 'table']);
    expect(paragraphChildren(blocks[0])).toEqual([
      { type: 'text', value: 'intro text' },
    ]);
  });

  it('ends a paragraph at a heading line', () => {
    const blocks = parseMarkdown('intro text\n# Title');
    expect(blocks.map(block => block.type)).toEqual(['paragraph', 'heading']);
  });
});
