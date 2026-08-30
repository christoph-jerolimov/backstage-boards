import { screen, waitFor } from '@testing-library/react';
import { createHeadlessEditor } from '@lexical/headless';
import { renderWithProviders } from '../__testUtils__/testHelpers';
import {
  $exportMarkdown,
  $importMarkdown,
  RICH_TEXT_NODES,
  RichTextViewer,
} from './RichText';

/** Markdown → editor state → markdown, without a DOM. */
function roundTrip(markdown: string): string {
  const editor = createHeadlessEditor({
    namespace: 'test',
    nodes: RICH_TEXT_NODES,
    onError: error => {
      throw error;
    },
  });
  editor.update(() => $importMarkdown(markdown), { discrete: true });
  return editor.getEditorState().read($exportMarkdown);
}

describe('markdown round-trip', () => {
  it.each([
    ['bold and italics', 'Some **bold** and *italic* text'],
    ['inline code', 'run `yarn test` locally'],
    ['heading', '## Rollout plan'],
    ['unordered list', '- one\n- two'],
    ['ordered list', '1. first\n2. second'],
    ['link', '[docs](https://example.com/)'],
    ['code block', '```\nconst a = 1;\nuser:christoph <b>x</b>\n```'],
    ['table', '| Name | Owner |\n| --- | --- |\n| api | jane |'],
    ['user mention', 'ping @user:default/jane now'],
    ['any-kind mention', 'see @component:webserver-example please'],
    ['shorthand mention', 'thanks @carol'],
    ['bare entity ref', 'deployed to system:default/payments'],
    ['bare url', 'see https://example.com/docs for details'],
    ['bare url with port', 'at http://host:8080/path'],
    ['bare url before punctuation', 'read https://example.com/docs.'],
    ['url inside inline code', 'run `https://example.com` locally'],
    ['hashtag', 'work on #frontend today'],
    [
      'mixed document',
      '## Plan\n\nSome **bold** text for @carol about #frontend\n\n' +
        '| Service | Owner |\n| --- | --- |\n| **api** | user:jane |\n\n' +
        '- one\n- two',
    ],
  ])('preserves %s', (_name, markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it('preserves unknown markdown as plain text', () => {
    expect(roundTrip('> not a supported quote')).toBe(
      '> not a supported quote',
    );
  });

  it('keeps @text: mentions and text: refs plain', () => {
    expect(roundTrip('read @text:foo by text:anonymous')).toBe(
      'read @text:foo by text:anonymous',
    );
  });

  it('keeps a pipe line without a divider row as a paragraph', () => {
    const editor = createHeadlessEditor({
      namespace: 'test',
      nodes: RICH_TEXT_NODES,
      onError: error => {
        throw error;
      },
    });
    editor.update(() => $importMarkdown('| a | b |'), { discrete: true });
    const state = editor.getEditorState().toJSON() as {
      root: { children: { type: string }[] };
    };
    expect(state.root.children.map(child => child.type)).toEqual(['paragraph']);
    expect(editor.getEditorState().read($exportMarkdown)).toBe('| a | b |');
  });

  it('never produces a non-http link', () => {
    // the importer leaves the syntax as literal text; either way no
    // javascript: link may come out the other side
    expect(roundTrip('[x](javascript:alert(1))')).toBe(
      '[x](javascript:alert(1))',
    );
  });
});

describe('RichTextViewer', () => {
  it('renders bold, heading, list, and code block', () => {
    const { container } = renderWithProviders(
      <RichTextViewer
        markdown={
          '# Big **plan**\n\n- one\n- two\n\n```\nconst a = 1;\n```\n\nend *soft*'
        }
      />,
    );
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Big plan');
    expect(h1.querySelector('.brt-bold')).toHaveTextContent('plan');
    expect(container.querySelectorAll('ul li')).toHaveLength(2);
    expect(container.querySelector('.brt-codeblock')).toHaveTextContent(
      'const a = 1;',
    );
    expect(container.querySelector('.brt-italic')).toHaveTextContent('soft');
  });

  it('renders mentions of any kind as catalog links', async () => {
    renderWithProviders(
      <RichTextViewer markdown="see @component:webserver-example and @text:foo" />,
    );
    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute(
      'href',
      '/catalog/default/component/webserver-example',
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText(/@text:foo/)).toBeInTheDocument();
  });

  it('auto-links bare entity refs but never text: refs', async () => {
    renderWithProviders(
      <RichTextViewer markdown="check system:default/example by text:anonymous" />,
    );
    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute('href', '/catalog/default/system/example');
    expect(screen.getByText(/text:anonymous/)).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('renders tables with a header row and links in cells', async () => {
    const { container } = renderWithProviders(
      <RichTextViewer
        markdown={'| Name | Owner |\n| --- | --- |\n| api | user:jane |'}
      />,
    );
    await waitFor(() =>
      expect(container.querySelectorAll('table th')).toHaveLength(2),
    );
    expect(container.querySelector('table th')).toHaveTextContent('Name');
    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute('href', '/catalog/default/user/jane');
  });

  it('auto-links bare urls, keeping trailing punctuation out', async () => {
    renderWithProviders(
      <RichTextViewer markdown="read https://example.com/docs, then reply" />,
    );
    const link = await screen.findByRole('link', {
      name: 'https://example.com/docs',
    });
    expect(link).toHaveAttribute('href', 'https://example.com/docs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('does not read a url with a port as an entity ref', async () => {
    renderWithProviders(
      <RichTextViewer markdown="at http://host:8080/path now" />,
    );
    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute('href', 'http://host:8080/path');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('keeps a url inside inline code plain', () => {
    const { container } = renderWithProviders(
      <RichTextViewer markdown="run `https://example.com` locally" />,
    );
    expect(container.querySelector('.brt-code')).toHaveTextContent(
      'https://example.com',
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('highlights hashtags', () => {
    const { container } = renderWithProviders(
      <RichTextViewer markdown="work on #frontend" />,
    );
    expect(container.querySelector('.brt-hashtag')).toHaveTextContent(
      '#frontend',
    );
  });

  it('renders http links with a safe target and no raw html', () => {
    const { container } = renderWithProviders(
      <RichTextViewer markdown="[docs](https://example.com/) and <script>alert(1)</script>" />,
    );
    const link = screen.getByRole('link', { name: 'docs' });
    expect(link).toHaveAttribute('href', 'https://example.com/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(container.querySelector('script')).toBeNull();
    expect(
      screen.getByText(/<script>alert\(1\)<\/script>/),
    ).toBeInTheDocument();
  });
});
