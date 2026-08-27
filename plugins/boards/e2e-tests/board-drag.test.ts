import { expect, request, test, type Page } from '@playwright/test';

const BACKEND_URL = process.env.PLAYWRIGHT_BACKEND_URL ?? 'http://localhost:7007';

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
  const [todo, inProgress] = board.columns;
  const items: Record<string, string> = {};
  for (const title of ['First card', 'Second card', 'Third card']) {
    const itemResponse = await api.post(
      `/api/boards/boards/${board.id}/items`,
      { headers, data: { columnId: todo.id, title } },
    );
    items[title] = (await itemResponse.json()).id;
  }
  await api.dispose();
  return { board, todo, inProgress, items };
}

/**
 * Performs an HTML5 drag between two locators. Headless browsers do not
 * synthesize drag events from mouse moves reliably, so the native event
 * sequence is dispatched with a shared DataTransfer.
 */
async function dragCard(
  page: Page,
  source: ReturnType<Page['locator']>,
  target: ReturnType<Page['locator']>,
) {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent('dragstart', { dataTransfer });
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });
  await source.dispatchEvent('dragend', { dataTransfer });
}

async function openBoard(page: Page, boardId: string) {
  await page.goto(`/boards/${boardId}`);
  // guest sign-in page appears on the first navigation of a session
  await page
    .getByRole('button', { name: 'Enter' })
    .click({ timeout: 10_000 })
    .catch(() => undefined);
  await expect(page.getByText('First card')).toBeVisible();
}

test.describe('kanban drag gestures', () => {
  test('dragging a card to another column persists the move', async ({
    page,
  }) => {
    const { board } = await seedBoard(`Drag E2E ${Date.now()}`);
    await openBoard(page, board.id);

    await expect(page.getByText('To do (3)')).toBeVisible();
    await dragCard(
      page,
      page.getByRole('button', { name: 'First card', exact: true }),
      page.getByText('In progress (0)'),
    );

    await expect(page.getByText('In progress (1)')).toBeVisible();
    await expect(page.getByText('To do (2)')).toBeVisible();

    // the move must have reached the server
    await page.reload();
    await expect(page.getByText('In progress (1)')).toBeVisible();
    await expect(page.getByText('To do (2)')).toBeVisible();
  });

  test('dropping a card onto another card inserts it before that card', async ({
    page,
  }) => {
    const { board } = await seedBoard(`Drag E2E order ${Date.now()}`);
    await openBoard(page, board.id);

    // "Third card" dropped onto "First card" should land before it
    await dragCard(
      page,
      page.getByRole('button', { name: 'Third card', exact: true }),
      page.getByRole('button', { name: 'First card', exact: true }),
    );
    await expect(page.getByText('To do (3)')).toBeVisible();

    await page.reload();
    await expect(page.getByText('First card')).toBeVisible();
    const cardTitles = await page
      .getByRole('button', { name: /card$/, exact: false })
      .allTextContents();
    const order = cardTitles
      .map(text => text.match(/(First|Second|Third) card/)?.[0])
      .filter(Boolean);
    expect(order.indexOf('Third card')).toBeLessThan(
      order.indexOf('First card'),
    );
  });

  test('the accessible move menu is an equivalent fallback', async ({
    page,
  }) => {
    const { board } = await seedBoard(`Drag E2E menu ${Date.now()}`);
    await openBoard(page, board.id);

    await page.getByRole('button', { name: 'Actions for Second card' }).click();
    await page.getByRole('menuitem', { name: 'Move to column' }).hover();
    await page.getByRole('menuitem', { name: 'In progress' }).click();

    await expect(page.getByText('In progress (1)')).toBeVisible();
    await page.reload();
    await expect(page.getByText('In progress (1)')).toBeVisible();
  });
});
