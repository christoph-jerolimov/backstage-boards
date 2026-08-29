import { expect, request, test, type Page } from '@playwright/test';

const BACKEND_URL =
  process.env.PLAYWRIGHT_BACKEND_URL ?? 'http://localhost:7007';

/**
 * Seeds two boards for the guest user: one favorited with items assigned
 * to them, one neither favorited nor assigned. That contrast is what the
 * "Boards" card's scope setting switches between.
 */
async function seedHomeData(suffix: string) {
  const api = await request.newContext({ baseURL: BACKEND_URL });
  const auth = await api.get('/api/auth/guest/refresh', {
    headers: { accept: 'application/json' },
  });
  const identity = await auth.json();
  const token = identity.backstageIdentity.token as string;
  const userRef = identity.backstageIdentity.identity.userEntityRef as string;
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };

  const favoriteName = `Favorite board ${suffix}`;
  const otherName = `Other board ${suffix}`;

  const favorite = await (
    await api.post('/api/boards/boards', {
      headers,
      data: { name: favoriteName },
    })
  ).json();
  const other = await (
    await api.post('/api/boards/boards', { headers, data: { name: otherName } })
  ).json();
  await api.put(`/api/boards/boards/${favorite.id}/favorite`, { headers });

  const [todo, inProgress] = favorite.columns;
  // one overdue item and one due far in the future, so the card's "due"
  // scope has something to include and something to drop
  await api.post(`/api/boards/boards/${favorite.id}/items`, {
    headers,
    data: {
      columnId: todo.id,
      title: `Overdue task ${suffix}`,
      assignees: [userRef],
    },
  });
  await api.post(`/api/boards/boards/${favorite.id}/items`, {
    headers,
    data: {
      columnId: inProgress.id,
      title: `Later task ${suffix}`,
      assignees: [userRef],
    },
  });
  await api.dispose();
  return {
    favorite,
    other,
    favoriteName,
    otherName,
    overdueTitle: `Overdue task ${suffix}`,
    laterTitle: `Later task ${suffix}`,
  };
}

async function openHome(page: Page) {
  await suppressDevServerOverlay(page);
  await page.goto('/home');
  // guest sign-in page appears on the first navigation of a session
  await page
    .getByRole('button', { name: 'Enter' })
    .click({ timeout: 10_000 })
    .catch(() => undefined);
}

/**
 * The webpack dev server overlays an iframe on any uncaught runtime error,
 * and that iframe swallows clicks. The home page raises one without this
 * test doing anything: the stock "Random joke" widget fetches a public API
 * that a sandboxed or offline machine cannot reach, and it re-raises on
 * every retry — so the overlay is kept out for the page's whole lifetime
 * rather than removed once. The overlay does not exist in the built app CI
 * serves, so suppressing it here costs no coverage.
 */
async function suppressDevServerOverlay(page: Page) {
  await page.addInitScript(() => {
    // the dev server has two of these, raised by different machinery
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
    // an init script runs before the document is parsed, so there may be
    // no documentElement to observe yet
    if (document.documentElement) {
      install();
    } else {
      document.addEventListener('DOMContentLoaded', install);
    }
  });
}

/**
 * Puts the home page back to the layout and settings `app-config.yaml`
 * declares. Saved card settings live in the signed-in user's settings,
 * which the backend keeps across browser contexts — so without this a run
 * that changed a setting would decide what the next run sees.
 */
async function resetHomeLayout(page: Page) {
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Restore defaults' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Edit', exact: true }),
  ).toBeVisible();
}

/**
 * One widget's grid cell, found by its card title. The cell holds both the
 * card and — in edit mode — the settings overlay, which is a sibling of
 * the card rather than a child of it.
 */
function widget(page: Page, title: string) {
  return page
    .locator('.react-grid-item')
    .filter({ has: page.getByText(title, { exact: true }) });
}

test.describe('boards home page widgets', () => {
  test('both cards render the current user’s boards and items', async ({
    page,
  }) => {
    const { favoriteName, otherName, overdueTitle, laterTitle } =
      await seedHomeData(`${Date.now()}`);
    await openHome(page);
    await resetHomeLayout(page);

    // "Assigned items" defaults to all items, grouped by board
    const assigned = widget(page, 'Assigned items');
    await expect(assigned).toBeVisible();
    await expect(
      assigned.getByRole('button', { name: `Open board ${favoriteName}` }),
    ).toBeVisible();
    await expect(
      assigned.getByRole('button', { name: `Open item ${overdueTitle}` }),
    ).toBeVisible();
    await expect(
      assigned.getByRole('button', { name: `Open item ${laterTitle}` }),
    ).toBeVisible();

    // "Boards" defaults to favorites only
    const boards = widget(page, 'Boards');
    await expect(
      boards.getByRole('button', { name: `Open board ${favoriteName}` }),
    ).toBeVisible();
    await expect(
      boards.getByRole('button', { name: `Open board ${otherName}` }),
    ).toHaveCount(0);
  });

  test('activating an assigned item opens its drawer on the homepage', async ({
    page,
  }) => {
    const { overdueTitle } = await seedHomeData(`${Date.now()}`);
    await openHome(page);
    await resetHomeLayout(page);

    await widget(page, 'Assigned items')
      .getByRole('button', { name: `Open item ${overdueTitle}` })
      .click();
    const drawer = page.getByRole('dialog', { name: `Item ${overdueTitle}` });
    await expect(drawer).toBeVisible();
    // the drawer renders above the widgets, in place — no navigation
    expect(new URL(page.url()).pathname).toBe('/home');

    await drawer.getByRole('button', { name: 'Close item details' }).click();
    await expect(drawer).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe('/home');
  });

  test('a card’s scope setting changes its content and survives a reload', async ({
    page,
  }) => {
    const { favoriteName, otherName } = await seedHomeData(`${Date.now()}`);
    await openHome(page);
    await resetHomeLayout(page);

    const boards = widget(page, 'Boards');
    await expect(
      boards.getByRole('button', { name: `Open board ${favoriteName}` }),
    ).toBeVisible();

    // switch the Boards card from favorites to every accessible board
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await widget(page, 'Boards')
      .getByRole('button', { name: 'Edit settings' })
      .click();
    const dialog = page.locator('.widgetSettingsDialog');
    await dialog.getByRole('radio', { name: 'All accessible boards' }).check();
    await dialog.getByRole('button', { name: 'Submit' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    const updated = widget(page, 'Boards');
    await expect(
      updated.getByRole('button', { name: `Open board ${otherName}` }),
    ).toBeVisible();

    // the setting is stored per card, so it outlives the page
    await page.reload();
    const reloaded = widget(page, 'Boards');
    await expect(
      reloaded.getByRole('button', { name: `Open board ${otherName}` }),
    ).toBeVisible();
    await expect(
      reloaded.getByRole('button', { name: `Open board ${favoriteName}` }),
    ).toBeVisible();
  });
});
