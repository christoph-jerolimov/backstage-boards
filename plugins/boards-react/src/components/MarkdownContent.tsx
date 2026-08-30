import { CSSProperties } from 'react';
import { Text } from '@backstage/ui';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import { BlockToken, InlineToken, parseMarkdown } from './markdown';

function InlineTokens(props: { tokens: InlineToken[] }) {
  return (
    <>
      {props.tokens.map((token, index) => {
        switch (token.type) {
          case 'text':
            return <span key={index}>{token.value}</span>;
          case 'bold':
            return (
              <strong key={index}>
                <InlineTokens tokens={token.children} />
              </strong>
            );
          case 'italic':
            return (
              <em key={index}>
                <InlineTokens tokens={token.children} />
              </em>
            );
          case 'code':
            return <code key={index}>{token.value}</code>;
          case 'link':
            return (
              <a
                key={index}
                href={token.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <InlineTokens tokens={token.children} />
              </a>
            );
          case 'entity':
            return <EntityRefLink key={index} entityRef={token.entityRef} />;
          default:
            return null;
        }
      })}
    </>
  );
}

// Comment/description headings render at drawer scale, well below the
// page chrome, decreasing from `#` to `######`.
const HEADING_ELEMENTS = [
  { as: 'h1', variant: 'title-medium' },
  { as: 'h2', variant: 'title-small' },
  { as: 'h3', variant: 'title-x-small' },
  { as: 'h4', variant: 'body-medium' },
  { as: 'h5', variant: 'body-small' },
  { as: 'h6', variant: 'body-x-small' },
] as const;

const TABLE_CELL_STYLE: CSSProperties = {
  border: '1px solid var(--bui-border-1)',
  padding: '4px 8px',
  textAlign: 'left',
};

/** Safe renderer for the comment markdown subset with entity auto-linking. */
export function MarkdownContent(props: { text: string }) {
  const blocks: BlockToken[] = parseMarkdown(props.text);
  return (
    <div>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading': {
            const heading = HEADING_ELEMENTS[block.level - 1];
            return (
              <Text
                key={index}
                as={heading.as}
                variant={heading.variant}
                weight="bold"
              >
                <InlineTokens tokens={block.children} />
              </Text>
            );
          }
          case 'table':
            return (
              <div key={index} style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th
                          key={cellIndex}
                          style={{
                            ...TABLE_CELL_STYLE,
                            background: 'var(--bui-bg-neutral-2)',
                          }}
                        >
                          <InlineTokens tokens={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} style={TABLE_CELL_STYLE}>
                            <InlineTokens tokens={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'paragraph':
            return (
              <Text key={index} as="p">
                <InlineTokens tokens={block.children} />
              </Text>
            );
          case 'codeBlock':
            return (
              <pre key={index} style={{ overflowX: 'auto' }}>
                <code>{block.value}</code>
              </pre>
            );
          case 'list': {
            const items = block.items.map((tokens, itemIndex) => (
              <li key={itemIndex}>
                <InlineTokens tokens={tokens} />
              </li>
            ));
            return block.ordered ? (
              <ol key={index}>{items}</ol>
            ) : (
              <ul key={index}>{items}</ul>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
