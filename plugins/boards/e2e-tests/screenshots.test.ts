import {
  expect,
  request,
  test,
  type Locator,
  type Page,
} from '@playwright/test';

const BACKEND_URL =
  process.env.PLAYWRIGHT_BACKEND_URL ?? 'http://localhost:7007';

/**
 * Fixed calendar dates keep the due-date badges stable across runs and
 * days: a date far in the past renders "Overdue Jan 1, 2020" and one far
 * in the future renders "Due Jan 15, 2027" — both include the year
 * because it differs from the current one, so the labels never change.
 */
const OVERDUE_DATE = '2020-01-01';
const UPCOMING_DATE = '2027-01-15';

type Priority = { id: string; name: string };

/**
 * Seeds a board that exercises as many card decorations as possible:
 * priorities, tags, assignees, due dates, a checklist, a markdown
 * description, and a comment (so the drawer timeline has entries).
 */
async function seedRichBoard(name: string) {
  const api = await request.newContext({ baseURL: BACKEND_URL });
  const auth = await api.get('/api/auth/guest/refresh', {
    headers: { accept: 'application/json' },
  });
  const session = await auth.json();
  const token = session.backstageIdentity.token as string;
  const userRef = session.backstageIdentity.identity.userEntityRef as string;
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
  const board = await (
    await api.post('/api/boards/boards', { headers, data: { name } })
  ).json();
  const [todo, inProgress, done] = board.columns;
  const priorities: Priority[] = board.priorities;
  const byName = (priorityName: string) =>
    priorities.find(priority => priority.name === priorityName)?.id;

  const item = async (data: Record<string, unknown>) =>
    (
      await api.post(`/api/boards/boards/${board.id}/items`, { headers, data })
    ).json();
  const patchItem = (itemId: string, data: Record<string, unknown>) =>
    api.patch(`/api/boards/boards/${board.id}/items/${itemId}`, {
      headers,
      data,
    });

  const design = await item({
    columnId: todo.id,
    title: 'Design login flow',
    priorityId: byName('critical'),
    tags: ['frontend', 'design'],
    assignees: [userRef],
    checklist: [
      { text: 'Collect requirements', checked: true },
      { text: 'Sketch wireframes', checked: false },
      { text: 'Review with the team', checked: false },
    ],
  });
  await patchItem(design.id, {
    description:
      'Rework the **login flow** so that guests land on the board:\n\n' +
      '- single sign-on first\n- guest access as fallback\n',
    dueDate: OVERDUE_DATE,
  });
  await api.post(`/api/boards/boards/${board.id}/items/${design.id}/comments`, {
    headers,
    data: { text: 'Kickoff scheduled, notes attached.' },
  });

  const fix = await item({
    columnId: inProgress.id,
    title: 'Fix flaky pipeline',
    priorityId: byName('high'),
    tags: ['ci'],
    assignees: [userRef],
  });
  await patchItem(fix.id, { dueDate: UPCOMING_DATE });

  await item({
    columnId: todo.id,
    title: 'Write release notes',
    priorityId: byName('medium'),
  });
  await item({ columnId: done.id, title: 'Update dependencies' });

  await api.dispose();
  return { board, userRef };
}

async function openBoard(page: Page, boardId: string, expectCard: string) {
  await page.goto(`/boards/${boardId}`);
  // guest sign-in page appears on the first navigation of a session
  await page
    .getByRole('button', { name: 'Enter' })
    .click({ timeout: 10_000 })
    .catch(() => undefined);
  await expect(page.getByText(expectCard)).toBeVisible();
}

/**
 * The regions a stable screenshot has to paint over: the board name
 * carries a per-run timestamp, and created/updated stamps change on
 * every run. Their on-screen boxes are constant (a `Date.now()` suffix
 * is always 13 digits), so masking keeps the rest comparable.
 */
function dynamicRegions(scope: Page | Locator, boardName: string): Locator[] {
  return [
    scope.getByText(boardName),
    // `toLocaleString()` output, e.g. "8/28/2026, 10:15:30 AM"
    scope.getByText(/\d{1,2}:\d{2}:\d{2}/),
  ];
}

test('the kanban view, priority grouping, and the table view', async ({
  page,
}) => {
  const name = `Screens board ${Date.now()}`;
  const { board } = await seedRichBoard(name);
  await openBoard(page, board.id, 'Design login flow');
  const mask = dynamicRegions(page, name);

  await expect(page.getByText('To do (2)')).toBeVisible();
  await expect(page).toHaveScreenshot('board-kanban.png', { mask });

  await page.getByRole('button', { name: 'Group by' }).click();
  await page.getByRole('option', { name: 'By priority' }).click();
  await expect(page.getByText('critical (1)')).toBeVisible();
  await expect(page).toHaveScreenshot('board-grouped-by-priority.png', {
    mask,
  });

  await page.getByRole('button', { name: 'Group by' }).click();
  await page.getByRole('option', { name: 'Not grouped' }).click();
  await page.getByLabel('Table view').click();
  await expect(
    page.getByRole('row', { name: /Design login flow/ }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('board-table.png', { mask });
});

test('the item drawer shows description, checklist, and timeline', async ({
  page,
}) => {
  const name = `Screens drawer ${Date.now()}`;
  const { board } = await seedRichBoard(name);
  await openBoard(page, board.id, 'Design login flow');

  await page
    .getByRole('button', { name: 'Design login flow', exact: true })
    .click();
  const drawer = page.getByRole('dialog', { name: 'Item Design login flow' });
  await expect(
    drawer.getByText('Kickoff scheduled, notes attached.'),
  ).toBeVisible();
  await expect(drawer).toHaveScreenshot('item-drawer.png', {
    mask: dynamicRegions(drawer, name),
  });
});

test('the priority matrix and board settings dialogs', async ({ page }) => {
  const name = `Screens dialogs ${Date.now()}`;
  const { board } = await seedRichBoard(name);
  await openBoard(page, board.id, 'Design login flow');

  // the dialogs are compared as full-page shots — the dialog element
  // re-renders while it settles, which trips element screenshots
  const mask = dynamicRegions(page, name);

  await page.getByRole('button', { name: 'More board actions' }).click();
  await page.getByRole('menuitem', { name: 'Priority matrix…' }).click();
  const matrix = page.getByRole('dialog');
  await expect(
    matrix.getByRole('table', { name: 'Priority matrix' }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('priority-matrix.png', { mask });
  // the dialog carries an icon close and the footer button; use the latter
  await matrix.getByRole('button', { name: 'Close' }).last().click();

  await page.getByRole('button', { name: 'More board actions' }).click();
  await page.getByRole('menuitem', { name: 'Board settings…' }).click();
  const settings = page.getByRole('dialog');
  await expect(
    settings.getByRole('button', { name: 'Delete priority critical' }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('board-settings.png', { mask });
});

test('the my-items table', async ({ page }) => {
  // The screenshot compares this board's grid, whose pixel position
  // depends on the groups sorted above it — and concurrently running
  // tests add groups of their own. A name sorting before every other
  // board pins the grid to the top. The name is deliberately constant:
  // a re-run against a live server seeds a second, identical board, and
  // the first of the identical groups still renders at the same spot.
  const name = '0 My items screenshots';
  await seedRichBoard(name);

  await page.goto('/boards');
  // guest sign-in page appears on the first navigation of a session
  await page
    .getByRole('button', { name: 'Enter' })
    .click({ timeout: 10_000 })
    .catch(() => undefined);
  await page.getByRole('tab', { name: 'My items' }).click();

  // the listing groups by board, so this board's grid holds exactly the
  // seeded rows even while concurrently running tests add their own items
  const grid = page.getByRole('grid', { name: `My items on ${name}` }).first();
  await expect(
    grid.getByRole('row', { name: /Design login flow/ }),
  ).toBeVisible();
  await expect(
    grid.getByRole('row', { name: /Fix flaky pipeline/ }),
  ).toBeVisible();
  await expect(grid).toHaveScreenshot('my-items.png');
});

test('the home page layout', async ({ page }) => {
  // the stock joke widget fetches a public API; blocking every request
  // that leaves the app under test renders the same offline state (a
  // "Failed to fetch" toast) on any machine, networked or not
  await page.route(
    route => !['localhost', '127.0.0.1'].includes(route.hostname),
    route => route.abort(),
  );

  // the dev server overlays an iframe on any uncaught runtime error (the
  // stock joke widget raises one offline); the built app CI serves has no
  // overlay, so removing it here costs no coverage
  await page.addInitScript(() => {
    const OVERLAYS =
      '#react-refresh-overlay, #webpack-dev-server-client-overlay';
    const remove = () =>
      document.querySelectorAll(OVERLAYS).forEach(node => node.remove());
    const install = () => {
      remove();
      new MutationObserver(remove).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    };
    if (document.documentElement) {
      install();
    } else {
      document.addEventListener('DOMContentLoaded', install);
    }
  });

  await page.goto('/home');
  // guest sign-in page appears on the first navigation of a session
  await page
    .getByRole('button', { name: 'Enter' })
    .click({ timeout: 10_000 })
    .catch(() => undefined);

  // saved layout and card settings persist per user on the backend, so
  // put the page back to the defaults from app-config.yaml first
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Restore defaults' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Edit', exact: true }),
  ).toBeVisible();

  // one widget's grid cell, found by a text it always shows
  const cell = (text: string | RegExp) =>
    page
      .locator('.react-grid-item')
      .filter({ has: page.getByText(text, { exact: false }) });

  await expect(page).toHaveScreenshot('home.png', {
    fullPage: true,
    mask: [
      // whatever the joke API returned (or its offline error)
      cell(/Random Joke/i),
      // wall-clock times
      cell('UTC'),
      // both boards widgets list data that concurrently running tests
      // create for the same guest user
      cell('Assigned items'),
      cell(/^Boards$/),
      // visit tracking depends on what ran before
      cell(/Most Visited/i),
      cell(/Recently Visited/i),
    ],
  });
});
