import { autolinkEntities, parseMarkdown } from './markdown';

describe('autolinkEntities', () => {
  it('links catalog entity refs with namespace', () => {
    expect(autolinkEntities('please check system:default/example now')).toEqual([
      { type: 'text', value: 'please check ' },
      { type: 'entity', entityRef: 'system:default/example' },
      { type: 'text', value: ' now' },
    ]);
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

  it('never links urls', () => {
    expect(autolinkEntities('see https://example.com/a')).toEqual([
      { type: 'text', value: 'see https://example.com/a' },
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
    expect(nonLink.type).toBe('paragraph');
    expect(
      (nonLink as any).children.some((t: any) => t.type === 'link'),
    ).toBe(false);
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
    expect((block as any).children).toContainEqual({
      type: 'entity',
      entityRef: 'system:default/payments',
    });
  });
});
