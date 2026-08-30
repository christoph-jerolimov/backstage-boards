import type { Page } from '@playwright/test';

/**
 * The webpack dev server overlays an iframe on any uncaught runtime error,
 * and that iframe swallows clicks. Some errors arise without a test doing
 * anything wrong — the home page's stock "Random joke" widget fetching a
 * public API an offline machine cannot reach, or the browser's benign
 * "ResizeObserver loop completed with undelivered notifications" noise —
 * and some re-raise on every retry, so the overlay is kept out for the
 * page's whole lifetime rather than removed once. The overlay does not
 * exist in the built app CI serves, so suppressing it here costs no
 * coverage.
 */
export async function suppressDevServerOverlay(page: Page) {
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
