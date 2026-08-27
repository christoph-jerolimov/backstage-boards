import { screen } from '@testing-library/react';
import { renderTestApp } from '@backstage/frontend-test-utils';
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

  it('exposes the root route', () => {
    expect(boardsPlugin.routes.root).toBeDefined();
  });

  it('serves the boards page at /boards, backed by the boards client', async () => {
    renderTestApp({
      features: [boardsPlugin],
      initialRouteEntries: ['/boards'],
      apis: [
        [
          boardsApiRef,
          { listBoards: jest.fn().mockResolvedValue([]) } as any,
        ],
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
