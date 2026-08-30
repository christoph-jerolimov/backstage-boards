import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type LexicalEditor,
} from 'lexical';
import { RichTextEditor } from './RichText';

const catalog = {
  getEntities: jest.fn(async () => ({
    items: [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { namespace: 'default', name: 'webserver-example' },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Group',
        metadata: { namespace: 'default', name: 'another-team' },
      },
    ],
  })),
  getEntitiesByRefs: jest.fn(async (request: { entityRefs: string[] }) => ({
    items: request.entityRefs.map(() => undefined),
  })),
};

/** Renders the editor and types `text` behind the caret via the editor. */
async function typeIntoEditor(text: string) {
  let editor: LexicalEditor | undefined;
  const onChange = jest.fn();
  // a minimal wrapper: in edit mode the editor needs no app context, and
  // the full test app's Suspense boundaries choke on the typeahead menu
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TestApiProvider apis={[[catalogApiRef, catalog]]}>
        <RichTextEditor
          ariaLabel="Comment"
          onChange={onChange}
          onEditorReady={instance => {
            editor = instance;
          }}
        />
      </TestApiProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(editor).toBeDefined());
  act(() => {
    editor!.update(() => {
      const paragraph = $createParagraphNode();
      const textNode = $createTextNode(text);
      paragraph.append(textNode);
      $getRoot().clear().append(paragraph);
      textNode.select(text.length, text.length);
    });
  });
  act(() => {
    editor!.focus();
  });
  return { editor: editor!, onChange };
}

describe('MentionsPlugin', () => {
  // the range/ResizeObserver polyfills the menu needs live in setupTests
  beforeEach(() => jest.clearAllMocks());

  it('opens catalog suggestions after typing @ and inserts the mention', async () => {
    const { onChange } = await typeIntoEditor('ping @web');
    const listbox = await screen.findByRole('listbox', { name: 'Entities' });
    expect(listbox).toBeInTheDocument();
    const option = screen.getByRole('option', {
      name: /webserver-example \(component:default\/webserver-example\)/,
    });
    const user = userEvent.setup();
    await user.pointer({ target: option, keys: '[MouseLeft>]' });
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        'ping @component:default/webserver-example',
      ),
    );
  });

  it('filters the suggestions by the typed query', async () => {
    await typeIntoEditor('cc @another');
    await screen.findByRole('option', {
      name: /another-team \(group:default\/another-team\)/,
    });
    expect(
      screen.queryByRole('option', { name: /webserver-example/ }),
    ).not.toBeInTheDocument();
  });

  it('shows no menu without an @ trigger', async () => {
    await typeIntoEditor('plain text');
    await waitFor(() => expect(catalog.getEntities).toHaveBeenCalled());
    // the plugin's positioning anchor can linger from earlier tests, so
    // check for the menu itself
    expect(document.querySelector('.brt-mention-menu')).toBeNull();
  });
});
