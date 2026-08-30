import { screen } from '@testing-library/react';
import { MarkdownContent } from './MarkdownContent';
import { renderWithProviders } from './__testUtils__/testHelpers';

describe('MarkdownContent', () => {
  it('renders paragraphs with bold, italic, code and links', () => {
    renderWithProviders(
      <MarkdownContent text="Some **bold** and *italic* and `code` and [a link](https://example.com)." />,
    );
    // the inline text token renders inside the emphasis element
    expect(screen.getByText('bold').closest('strong')).toBeInTheDocument();
    expect(screen.getByText('italic').closest('em')).toBeInTheDocument();
    expect(screen.getByText('code').tagName).toBe('CODE');
    const link = screen.getByRole('link', { name: 'a link' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders fenced code blocks verbatim', () => {
    renderWithProviders(<MarkdownContent text={'```\nconst a = 1;\n```'} />);
    expect(screen.getByText('const a = 1;').tagName).toBe('CODE');
  });

  it('renders bulleted and numbered lists', () => {
    const { container } = renderWithProviders(
      <MarkdownContent text={'- one\n- two\n\n1. first\n2. second'} />,
    );
    expect(container.querySelectorAll('ul li')).toHaveLength(2);
    expect(container.querySelectorAll('ol li')).toHaveLength(2);
  });

  it('auto-links @-mentioned entities', async () => {
    renderWithProviders(<MarkdownContent text="ping @user:default/jane now" />);
    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute('href', '/catalog/default/user/jane');
  });

  it('links mentions of non-principal entity kinds, but never text:', async () => {
    renderWithProviders(
      <MarkdownContent text="see @component:webserver-example and @text:foo" />,
    );
    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute(
      'href',
      '/catalog/default/component/webserver-example',
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText(/@text:foo/)).toBeInTheDocument();
  });

  it('renders headings at decreasing sizes', () => {
    renderWithProviders(
      <MarkdownContent text={'# Big **plan**\n\n### Smaller'} />,
    );
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Big plan');
    expect(h1.querySelector('strong')).toHaveTextContent('plan');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      'Smaller',
    );
  });

  it('renders pipe tables with a header row and entity links in cells', async () => {
    renderWithProviders(
      <MarkdownContent
        text={'| Name | Owner |\n| --- | --- |\n| api | user:default/jane |'}
      />,
    );
    expect(
      screen.getByRole('columnheader', { name: 'Name' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'api' })).toBeInTheDocument();
    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute('href', '/catalog/default/user/jane');
  });
});
