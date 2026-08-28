import { createRouteRef, useRouteRef } from '@backstage/frontend-plugin-api';

export const rootRouteRef = createRouteRef();

/**
 * Where the plugin is mounted, for links built by hand. Falls back to
 * /boards where no route is bound, as in a test or a standalone render.
 */
export function useBoardsBasePath(): string {
  const rootLink = useRouteRef(rootRouteRef);
  return rootLink?.() ?? '/boards';
}
