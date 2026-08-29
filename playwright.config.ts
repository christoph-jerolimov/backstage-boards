/*
 * Copyright 2023 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { defineConfig } from '@playwright/test';
import { generateProjects } from '@backstage/e2e-test-utils/playwright';

/** The test files that compare full-page screenshots against baselines. */
const SCREENSHOT_TESTS = /screenshots\.test\.ts/;

// All baselines live in docs/screenshots (see snapshotDir below), split
// by theme, named exactly like the shot — ready to embed in docs. The
// names carry no platform suffix: they are rendered on Linux, matching
// CI; regenerate them there.
const LIGHT_SNAPSHOTS = '{snapshotDir}/light/{arg}{ext}';
const DARK_SNAPSHOTS = '{snapshotDir}/dark/{arg}{ext}';

// Find all packages with e2e-test folders. Environments without a Chrome
// channel install (e.g. containers with a preinstalled Chromium) can point
// PLAYWRIGHT_CHROMIUM_PATH at a browser binary instead.
const baseProjects = generateProjects().map(project =>
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? {
        ...project,
        use: {
          launchOptions: {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
          },
        },
      }
    : project,
);

// Screenshots are compared without masks, so the pages they capture must
// show exactly the data their tests seeded. The boards screenshot tests
// therefore run in their own projects before the functional tests get to
// create boards of their own; the dark run comes second so it reuses the
// showcase board the light run seeded. The app package is untouched by
// board seeding, so its tests double as its screenshot suite and only
// gain a dark twin.
const projects = baseProjects.flatMap(project => {
  const name = String(project.name);
  const light = (base: typeof project) => ({
    ...base,
    snapshotPathTemplate: LIGHT_SNAPSHOTS,
  });
  const dark = (base: typeof project, darkName: string) => ({
    ...base,
    name: darkName,
    use: { ...base.use, colorScheme: 'dark' as const },
    snapshotPathTemplate: DARK_SNAPSHOTS,
  });
  if (!name.includes('boards')) {
    return [light(project), dark(project, `${name}-dark`)];
  }
  const screenshots = {
    ...light(project),
    name: `${name}-screenshots`,
    testMatch: SCREENSHOT_TESTS,
  };
  const screenshotsDark = {
    ...dark(screenshots, `${name}-screenshots-dark`),
    dependencies: [screenshots.name],
  };
  return [
    screenshots,
    screenshotsDark,
    {
      ...project,
      testIgnore: SCREENSHOT_TESTS,
      dependencies: [screenshots.name, screenshotsDark.name],
    },
  ];
});

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  timeout: 60_000,

  expect: {
    timeout: 30_000,

    // Screenshot baselines live in docs/screenshots (light/ and dark/)
    // and are compared with a small tolerance, since font rasterization
    // differs slightly between browser builds and machines. Regenerate
    // them with `yarn test:e2e --update-snapshots` after intentional UI
    // changes.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.3,
    },
  },

  snapshotDir: './docs/screenshots',

  // Run your local dev server before starting the tests
  webServer: process.env.CI
    ? []
    : [
        {
          command: 'yarn start app',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: 'yarn start backend',
          port: 7007,
          reuseExistingServer: true,
          timeout: 60_000,
        },
      ],

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  reporter: [['html', { open: 'never', outputFolder: 'e2e-test-report' }]],

  use: {
    actionTimeout: 0,
    baseURL:
      process.env.PLAYWRIGHT_URL ??
      (process.env.CI ? 'http://localhost:7007' : 'http://localhost:3000'),
    // pixel comparisons need identical text rendering on every machine
    locale: 'en-US',
    timezoneId: 'UTC',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  outputDir: 'node_modules/.cache/e2e-test-results',

  projects,
});
