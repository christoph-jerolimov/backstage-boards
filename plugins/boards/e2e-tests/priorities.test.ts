import { expect, request, test, type Page } from '@playwright/test';

const BACKEND_URL =
  process.env.PLAYWRIGHT_BACKEND_URL ?? 'http://localhost:7007';

type Priority = { id: string; name: string; color?: string; order: number };

/**
 * Creates a board (with its default priorities) and three items: one
 * critical, one high, one without a priority.
 */
async function seedBoard(name: string) {
  const api = await request.newContext({ baseURL: BACKEND_URL });
  const auth = await api.get('/api/auth/guest/refresh', {
    headers: { accept: 'application/json' },
  });
  const token = (await auth.json()).backstageIdentity.token as string;
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
  const boardResponse = await api.post('/api/boards/boards', {
    headers,
    data: { name },
  });
  const board = await boardResponse.json();
  const priorities: Priority[] = board.priorities;
  const [critical, high] = priorities;
  const todo = board.columns[0];
  const items: Record<string, string> = {};
  for (const [title, priorityId] of [
    ['Critical card', critical.id],
    ['High card', high.id],
    ['Plain card', undefined],
  ] as const) {
    const itemResponse = await api.post(
      `/api/boards/boards/${board.id}/items`,
      { headers, data: { columnId: todo.id, title, priorityId } },
    );
    items[title] = (await itemResponse.json()).id;
  }
  await api.dispose();
  return { board, priorities, todo, items };
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

test('new boards start with the default priorities', async () => {
  const { priorities } = await seedBoard(`Defaults ${Date.now()}`);
  expect(
    priorities.map(entry => [entry.name, entry.color, entry.order]),
  ).toEqual([
    ['critical', 'red', 1],
    ['high', 'orange', 2],
    ['medium', undefined, 3],
    ['low', undefined, 4],
  ]);
});

test('priorities show, filter, group, and edit on the board', async ({
  page,
}) => {
  const { board } = await seedBoard(`Surfaces ${Date.now()}`);
  await openBoard(page, board.id, 'Critical card');

  // cards show their priority chip
  await expect(page.getByText('critical', { exact: true })).toBeVisible();

  // the filter offers the used priorities, highest first, with counts
  await page.getByRole('button', { name: 'Priority', exact: true }).click();
  const options = page.getByRole('menuitem');
  await expect(options.first()).toContainText('critical (1)');
  await options.first().click();
  await expect(page.getByText('Critical card')).toBeVisible();
  await expect(page.getByText('High card')).toBeHidden();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByText('High card')).toBeVisible();

  // grouping by priority labels the sections with counts
  await page.getByRole('button', { name: 'Group by' }).click();
  await page.getByRole('option', { name: 'By priority' }).click();
  await expect(page.getByText('critical (1)')).toBeVisible();
  await expect(page.getByText('No priority (1)')).toBeVisible();

  // the item menu sets a priority on the plain card
  await page.getByRole('button', { name: 'Actions for Plain card' }).click();
  await page.getByRole('menuitem', { name: 'Priority' }).click();
  await page.getByRole('menuitem', { name: 'low', exact: true }).click();
  await expect(page.getByText('low (1)')).toBeVisible();
});

test('the drawer changes the priority', async ({ page }) => {
  const { board } = await seedBoard(`Drawer ${Date.now()}`);
  await openBoard(page, board.id, 'High card');
  // the card itself is the button; its title text is an inline editor
  await page.getByRole('button', { name: 'High card', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Item High card' });
  // the priority badge is the control; its name carries the current value
  await drawer.getByRole('button', { name: 'Change priority: high' }).click();
  await page.getByRole('menuitem', { name: 'medium' }).click();
  await expect(
    drawer.getByText('medium', { exact: true }).first(),
  ).toBeVisible();
});

test('the matrix counts combinations and toggles sums', async ({ page }) => {
  const { board } = await seedBoard(`Matrix ${Date.now()}`);
  await openBoard(page, board.id, 'Critical card');
  await page.getByRole('button', { name: 'More board actions' }).click();
  await page.getByRole('menuitem', { name: 'Priority matrix…' }).click();
  const table = page.getByRole('table', { name: 'Priority matrix' });
  await expect(table).toBeVisible();
  // three items, all in Todo: sum row reads Todo 3, other columns 0, total 3
  const sumRow = table.getByRole('row').last();
  await expect(sumRow).toContainText('3');
  // unselecting the Todo status empties the sums
  await table.getByRole('button', { name: 'To do' }).click();
  await expect(sumRow.getByRole('cell').last()).toHaveText('0');
  await table.getByRole('button', { name: 'To do' }).click();
  await expect(sumRow.getByRole('cell').last()).toHaveText('3');
});

test('deleting a used priority reassigns its items', async ({ page }) => {
  const { board } = await seedBoard(`Reassign ${Date.now()}`);
  await openBoard(page, board.id, 'Critical card');
  await page.getByRole('button', { name: 'More board actions' }).click();
  await page.getByRole('menuitem', { name: 'Board settings…' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('button', { name: 'Delete priority critical' })
    .click();
  await expect(dialog.getByText(/“critical” is still used/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Reassign and delete' }).click();
  await expect(
    dialog.getByRole('button', { name: 'Delete priority critical' }),
  ).toBeHidden();
  // the dialog carries an icon close and the footer button; use the latter
  await dialog.getByRole('button', { name: 'Close' }).last().click();
  // the reassign target defaults to the next priority: high
  await expect(page.getByText('high', { exact: true }).first()).toBeVisible();
});
