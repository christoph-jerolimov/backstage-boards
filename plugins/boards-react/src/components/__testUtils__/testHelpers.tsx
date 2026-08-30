import { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';

/** The options `renderInTestApp` accepts, so ours stay in step with it. */
type TestAppOptions = NonNullable<Parameters<typeof renderInTestApp>[1]>;

/**
 * A catalog that resolves nothing, so components that look entity refs up
 * render their fallbacks. The real app always has this API; tests that
 * care about the answers pass their own.
 */
export const emptyCatalogApi = {
  getEntitiesByRefs: async (request: { entityRefs: string[] }) => ({
    items: request.entityRefs.map(() => undefined),
  }),
  getEntities: async () => ({ items: [] }),
};

/**
 * Renders a component inside a test app (routing and app context, which
 * catalog entity links need) with a fresh query client and any stubbed
 * APIs.
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Pick<TestAppOptions, 'apis' | 'mountedRoutes'>,
) {
  let apis = options?.apis ?? [];
  if (!apis.some(([ref]) => ref === catalogApiRef)) {
    apis = [...apis, [catalogApiRef, emptyCatalogApi] as (typeof apis)[number]];
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderInTestApp(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    {
      apis,
      mountedRoutes: {
        // catalog entity links resolve through this route
        '/catalog/:namespace/:kind/:name': entityRouteRef,
        ...options?.mountedRoutes,
      },
    },
  );
}
