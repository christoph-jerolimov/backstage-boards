import { screen } from '@testing-library/react';
import {
  createExtensionTester,
  renderTestApp,
} from '@backstage/frontend-test-utils';
import {
  HomePageWidgetData,
  homePageWidgetDataRef,
} from '@backstage/plugin-home-react/alpha';
import { boardsApiRef } from './api';
import { boardsPlugin } from './plugin';

describe('boardsPlugin', () => {
  it('registers the api, the page and the entity content', () => {
    expect(boardsPlugin.getExtension('api:boards')).toBeDefined();
    expect(boardsPlugin.getExtension('page:boards')).toBeDefined();
    expect(
      boardsPlugin.getExtension('entity-content:boards/entity'),
    ).toBeDefined();
  });

  it.each([
    [
      'home-page-widget:boards/assigned-items',
      'BoardsAssignedItems',
      'Assigned items',
      ['scope', 'groupBy'],
    ],
    [
      'home-page-widget:boards/boards',
      'BoardsList',
      'Boards',
      ['scope', 'showCounts'],
    ],
  ])(
    'contributes %s as a home page widget with its settings schema',
    (id, name, title, properties) => {
      const extension = boardsPlugin.getExtension(id as any);
      expect(extension).toBeDefined();

      const widget = createExtensionTester(extension!).get(
        homePageWidgetDataRef,
      ) as HomePageWidgetData;
      // the name is what app-config's home defaultConfig references
      expect(widget.name).toBe(name);
      expect(widget.title).toBe(title);
      expect(widget.description).toEqual(expect.any(String));
      // layout hints keep the card legible at its default size
      expect(widget.layout?.width?.defaultColumns).toBe(4);
      // a schema is what makes the grid offer the settings dialog and hand
      // the chosen values back to the widget as props
      expect(Object.keys(widget.settings?.schema?.properties ?? {})).toEqual(
        properties,
      );
    },
  );

  it('exposes the root route', () => {
    expect(boardsPlugin.routes.root).toBeDefined();
  });

  it('serves the boards page at /boards, backed by the boards client', async () => {
    renderTestApp({
      features: [boardsPlugin],
      initialRouteEntries: ['/boards'],
      apis: [
        [boardsApiRef, { listBoards: jest.fn().mockResolvedValue([]) } as any],
      ],
    });
    expect(
      await screen.findByRole('tab', { name: 'Favorites (0)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create board' }),
    ).toBeInTheDocument();
  });
});
