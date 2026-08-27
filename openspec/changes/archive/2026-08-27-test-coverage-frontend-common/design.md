# Design

The Backstage CLI auto-detects `src/setupTests.*`, so registering
`@testing-library/jest-dom` there needs no jest config. Component tests
use RTL with `@backstage/frontend-test-utils`' `TestApiProvider` for
components calling `useApi` (identity, catalog), and `userEvent` for
interaction. Components that need routing or a query client are wrapped
in `MemoryRouter` / `QueryClientProvider` inside a local `renderWith`
helper per test file.

Scope is deliberately the leaf components with real logic plus the API
client; the large page components (`BoardPage`, `KanbanView`,
`TableView`, `ItemDrawer`) stay covered by the Playwright e2e suite,
which exercises them against a real backend rather than a mock.

`api.ts` is tested by injecting a fake `fetchApi`/`discoveryApi` and
asserting on method, URL, body, 204 handling, and error-message
extraction.
