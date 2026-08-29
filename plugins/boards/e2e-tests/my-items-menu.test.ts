import { expect, request, test, type Page } from '@playwright/test';

const BACKEND_URL =
  process.env.PLAYWRIGHT_BACKEND_URL ?? 'http://localhost:7007';

/** An item to seed: a bare title, or a title with tags. */
type SeedItem = string | { title: string; tags?: string[] };

/** A board whose items are assigned to the signed-in guest user. */
async function seedAssignedBoard(name: string, titles: SeedItem[]) {
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
  const boardResponse = await api.post('/api/boards/boards', {
    headers,
    data: { name },
  });
  const board = await boardResponse.json();
  const [todo] = board.columns;
  for (const entry of titles) {
    const { title, tags } =
      typeof entry === 'string' ? { title: entry, tags: undefined } : entry;
    await api.post(`/api/boards/boards/${board.id}/items`, {
      headers,
      data: { columnId: todo.id, title, tags, assignees: [userRef] },
    });
  }
  await api.dispose();
  return { board };
}

async function openMyItems(page: Page, boardName: string) {
  await page.goto('/boards');
  // guest sign-in page appears on the first navigation of a session
  await page
    .getByRole('button', { name: 'Enter' })
    .click({ timeout: 10_000 })
    .catch(() => undefined);
  await page.getByRole('tab', { name: 'My items' }).click();
  await expect(
    page.getByRole('button', { name: `Open board ${boardName}` }),
  ).toBeVisible();
}

const row = (page: Page, title: string) =>
  page.getByRole('row', { name: new RegExp(title) });

test.describe('my-items row menu', () => {
  test('changes an item status from the my-items table', async ({ page }) => {
    const name = `My items E2E status ${Date.now()}`;
    await seedAssignedBoard(name, ['Status card']);
    await openMyItems(page, name);

    await expect(row(page, 'Status card').getByText('To do')).toBeVisible();
    await page.getByRole('button', { name: 'Actions for Status card' }).click();
    await page.getByRole('menuitem', { name: 'Move to column' }).hover();
    await page.getByRole('menuitem', { name: 'In progress' }).click();

    await expect(
      row(page, 'Status card').getByText('In progress'),
    ).toBeVisible();
    // the move must have reached the server
    await page.reload();
    await page.getByRole('tab', { name: 'My items' }).click();
    await expect(
      row(page, 'Status card').getByText('In progress'),
    ).toBeVisible();
  });

  test('sets a due date from the my-items table', async ({ page }) => {
    const name = `My items E2E due ${Date.now()}`;
    await seedAssignedBoard(name, ['Due card']);
    await openMyItems(page, name);

    await page.getByRole('button', { name: 'Actions for Due card' }).click();
    await page.getByRole('menuitem', { name: 'Due date' }).hover();
    await page.getByRole('menuitem', { name: 'Today' }).click();

    await expect(row(page, 'Due card').getByText('Due today')).toBeVisible();
    await page.reload();
    await page.getByRole('tab', { name: 'My items' }).click();
    await expect(row(page, 'Due card').getByText('Due today')).toBeVisible();
  });

  test('unassigning the user removes the row', async ({ page }) => {
    const name = `My items E2E assignee ${Date.now()}`;
    await seedAssignedBoard(name, ['Mine card', 'Other card']);
    await openMyItems(page, name);

    await page.getByRole('button', { name: 'Actions for Mine card' }).click();
    await page.getByRole('menuitem', { name: 'Assignee' }).hover();
    await page.getByRole('menuitem', { name: '✓ Me' }).click();

    await expect(row(page, 'Mine card')).toHaveCount(0);
    await expect(row(page, 'Other card')).toBeVisible();
  });
});

test.describe('my-items item drawer', () => {
  test('opens the item drawer in place from the row menu', async ({ page }) => {
    const name = `My items E2E drawer ${Date.now()}`;
    await seedAssignedBoard(name, ['Drawer card']);
    await openMyItems(page, name);

    // scoped to this run's board: my-items lists every assigned item
    await page
      .getByRole('grid', { name: `My items on ${name}` })
      .getByRole('button', { name: 'Actions for Drawer card' })
      .click();
    await page.getByRole('menuitem', { name: 'Open details' }).click();

    const drawer = page.getByRole('dialog', { name: 'Item Drawer card' });
    await expect(drawer).toBeVisible();
    // in place: still on the boards page, not on the item's board
    expect(new URL(page.url()).pathname).toBe('/boards');

    await drawer.getByRole('button', { name: 'Close item details' }).click();
    await expect(drawer).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: `Open board ${name}` }),
    ).toBeVisible();
  });
});

test.describe('my-items filter bar and grouping', () => {
  test('searches, regroups by tag, and keeps the row menu working', async ({
    page,
  }) => {
    const name = `My items E2E filter ${Date.now()}`;
    const stamp = `${Date.now()}`;
    const tag = `release-${stamp}`;
    await seedAssignedBoard(name, [
      { title: `Alpha ${stamp}`, tags: [tag] },
      `Beta ${stamp}`,
    ]);
    await openMyItems(page, name);

    // the search field narrows the listing and clears again
    await page.getByRole('searchbox', { name: 'Search items' }).fill('Alpha');
    await expect(row(page, `Alpha ${stamp}`)).toBeVisible();
    await expect(row(page, `Beta ${stamp}`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(row(page, `Beta ${stamp}`)).toBeVisible();

    // grouping by tag regroups the listing and names each row's board
    await page.getByRole('button', { name: /Group by/ }).click();
    await page.getByRole('option', { name: 'By tags' }).click();
    const tagged = page.getByRole('grid', {
      name: `My items grouped under ${tag}`,
    });
    await expect(tagged).toBeVisible();
    await expect(
      tagged.getByRole('button', { name: `Open board ${name}` }),
    ).toBeVisible();

    // and the row menu still opens on a regrouped row
    await tagged
      .getByRole('button', { name: `Actions for Alpha ${stamp}` })
      .click();
    await expect(
      page.getByRole('menuitem', { name: 'Open details' }),
    ).toBeVisible();
  });
});
