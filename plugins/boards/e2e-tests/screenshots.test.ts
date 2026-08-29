import { expect, request, test, type Page } from '@playwright/test';

/*
 * Full-page screenshots of every boards surface, in light and dark mode
 * (the dark project in playwright.config.ts re-runs this file with a
 * dark color scheme). The shots double as showcase images, so nothing
 * is masked — instead everything on screen is made deterministic: one
 * fixed showcase board, a frozen clock, and rewritten timestamps.
 *
 * The my-items and home shots show everything the guest user can see,
 * so they expect a backend that only holds this file's data. CI starts
 * a backend per run and the config runs these projects before the
 * functional tests seed boards of their own; locally, restart the dev
 * backend before re-running the suite for the same reason.
 */

const BACKEND_URL =
  process.env.PLAYWRIGHT_BACKEND_URL ?? 'http://localhost:7007';

/**
 * Every screenshot shows this one board. The name is deliberately
 * constant: the dark-mode project (and any re-run against a live
 * server) finds and reuses the board the first run created, so board
 * counts and my-items groups stay identical from run to run.
 */
const BOARD_NAME = 'Sprint planning';

/**
 * The single instant every screenshot pretends to be taken at. The
 * browser clock is pinned to it and all server timestamps are rewritten
 * to it in transit, so created/updated stamps, timeline entries, and
 * relative due-date labels render the same on every run.
 */
const FROZEN_TIME = '2026-01-15T10:30:00.000Z';
const ISO_TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g;

/** Due dates relative to the frozen clock: one overdue, one upcoming. */
const OVERDUE_DATE = '2025-12-28';
const UPCOMING_DATE = '2026-06-15';

/**
 * Pins the page to {@link FROZEN_TIME}: `Date` in the browser is fixed
 * (timers keep running) and every boards API response has its ISO
 * timestamps replaced before it reaches the UI.
 */
async function freezeTime(page: Page) {
  await page.clock.setFixedTime(new Date(FROZEN_TIME));
  await page.route('**/api/boards/**', async route => {
    const response = await route.fetch();
    const contentType = response.headers()['content-type'] ?? '';
    if (!contentType.includes('json')) {
      await route.fulfill({ response });
      return;
    }
    const body = (await response.text()).replace(ISO_TIMESTAMP, FROZEN_TIME);
    await route.fulfill({ response, body });
  });
}

type Priority = { id: string; name: string };
type Column = { id: string };

/**
 * Finds or creates the showcase board: three columns of items that
 * together exercise priorities, tags, assignees, due dates, a
 * checklist, a markdown description, and a comment. The board is
 * favorited so the home page's "Boards" card lists it.
 */
async function seedShowcaseBoard(): Promise<string> {
  const api = await request.newContext({ baseURL: BACKEND_URL });
  try {
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

    const { boards }: { boards: { id: string; name: string }[] } = await (
      await api.get('/api/boards/boards', { headers })
    ).json();
    const existing = boards.find(entry => entry.name === BOARD_NAME);
    if (existing) {
      return existing.id;
    }

    const board = await (
      await api.post('/api/boards/boards', {
        headers,
        data: { name: BOARD_NAME },
      })
    ).json();
    await api.put(`/api/boards/boards/${board.id}/favorite`, { headers });

    const [todo, inProgress, done]: Column[] = board.columns;
    const priorities: Priority[] = board.priorities;
    const priority = (name: string) =>
      priorities.find(entry => entry.name === name)?.id;
    const item = async (data: Record<string, unknown>) =>
      (
        await api.post(`/api/boards/boards/${board.id}/items`, {
          headers,
          data,
        })
      ).json();
    const patchItem = (itemId: string, data: Record<string, unknown>) =>
      api.patch(`/api/boards/boards/${board.id}/items/${itemId}`, {
        headers,
        data,
      });

    const design = await item({
      columnId: todo.id,
      title: 'Design login flow',
      priorityId: priority('critical'),
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
    await api.post(
      `/api/boards/boards/${board.id}/items/${design.id}/comments`,
      { headers, data: { text: 'Kickoff scheduled, notes attached.' } },
    );

    const fix = await item({
      columnId: inProgress.id,
      title: 'Fix flaky pipeline',
      priorityId: priority('high'),
      tags: ['ci'],
      assignees: [userRef],
    });
    await patchItem(fix.id, { dueDate: UPCOMING_DATE });

    await item({
      columnId: todo.id,
      title: 'Write release notes',
      priorityId: priority('medium'),
    });
    await item({ columnId: done.id, title: 'Update dependencies' });

    return board.id;
  } finally {
    await api.dispose();
  }
}

async function openBoard(page: Page, boardId: string) {
  await freezeTime(page);
  await page.goto(`/boards/${boardId}`);
  // guest sign-in page appears on the first navigation of a session
  await page
    .getByRole('button', { name: 'Enter' })
    .click({ timeout: 10_000 })
    .catch(() => undefined);
  await expect(page.getByText('Design login flow')).toBeVisible();
}

test('the kanban view, priority grouping, and the table view', async ({
  page,
}) => {
  const boardId = await seedShowcaseBoard();
  await openBoard(page, boardId);

  await expect(page.getByText('To do (2)')).toBeVisible();
  await expect(page).toHaveScreenshot('board-kanban.png', { fullPage: true });

  await page.getByRole('button', { name: 'Group by' }).click();
  await page.getByRole('option', { name: 'By priority' }).click();
  await expect(page.getByText('critical (1)')).toBeVisible();
  await expect(page).toHaveScreenshot('board-grouped-by-priority.png', {
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Group by' }).click();
  await page.getByRole('option', { name: 'Not grouped' }).click();
  await page.getByLabel('Table view').click();
  await expect(
    page.getByRole('row', { name: /Design login flow/ }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('board-table.png', { fullPage: true });
});

test('the item drawer shows description, checklist, and timeline', async ({
  page,
}) => {
  const boardId = await seedShowcaseBoard();
  await openBoard(page, boardId);

  await page
    .getByRole('button', { name: 'Design login flow', exact: true })
    .click();
  const drawer = page.getByRole('dialog', { name: 'Item Design login flow' });
  await expect(
    drawer.getByText('Kickoff scheduled, notes attached.'),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('item-drawer.png', { fullPage: true });
});

test('the priority matrix and board settings dialogs', async ({ page }) => {
  const boardId = await seedShowcaseBoard();
  await openBoard(page, boardId);

  await page.getByRole('button', { name: 'More board actions' }).click();
  await page.getByRole('menuitem', { name: 'Priority matrix…' }).click();
  const matrix = page.getByRole('dialog');
  await expect(
    matrix.getByRole('table', { name: 'Priority matrix' }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('priority-matrix.png', {
    fullPage: true,
  });
  // the dialog carries an icon close and the footer button; use the latter
  await matrix.getByRole('button', { name: 'Close' }).last().click();

  await page.getByRole('button', { name: 'More board actions' }).click();
  await page.getByRole('menuitem', { name: 'Board settings…' }).click();
  const settings = page.getByRole('dialog');
  await expect(
    settings.getByRole('button', { name: 'Delete priority critical' }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('board-settings.png', {
    fullPage: true,
  });
});

test('the my-items table', async ({ page }) => {
  await seedShowcaseBoard();
  await freezeTime(page);

  await page.goto('/boards');
  // guest sign-in page appears on the first navigation of a session
  await page
    .getByRole('button', { name: 'Enter' })
    .click({ timeout: 10_000 })
    .catch(() => undefined);
  await page.getByRole('tab', { name: 'My items' }).click();

  const grid = page.getByRole('grid', { name: `My items on ${BOARD_NAME}` });
  await expect(
    grid.getByRole('row', { name: /Design login flow/ }),
  ).toBeVisible();
  await expect(
    grid.getByRole('row', { name: /Fix flaky pipeline/ }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('my-items.png', { fullPage: true });
});

test('the home page', async ({ page }) => {
  await seedShowcaseBoard();
  await freezeTime(page);

  // the stock joke widget fetches a public API; serve it a fixed joke so
  // the card renders the same everywhere, networked or not
  await page.route('**/official-joke-api.appspot.com/**', route =>
    route.fulfill({
      json: {
        id: 1,
        type: 'programming',
        setup: 'Why do programmers prefer dark mode?',
        punchline: 'Because light attracts bugs.',
      },
    }),
  );

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

  await expect(page.getByText('Because light attracts bugs.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Open board ${BOARD_NAME}` }).first(),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('home.png', { fullPage: true });
});
