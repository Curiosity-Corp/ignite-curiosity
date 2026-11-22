import { expect, test, type Page } from '@playwright/test';

// Production smoke for ignitecuriosity.org (hypervoid/admiral#123): the pages a customer lands on load,
// render, show their images and raise no script errors. Read-only: no form is filled or submitted,
// and reCAPTCHA requests are blocked so the run sends no reCAPTCHA traffic.
// The site itself lives on the gh-pages branch; this suite lives on master so it is not published.

const PAGES: ReadonlyArray<{ path: string; what: string }> = [
  { path: '/spark/index.html', what: 'Programs (Spark)' },
  { path: '/spark/robotics.html', what: 'A program page (Spark Robotics)' },
  { path: '/register.html', what: 'Registration' },
  { path: '/fundraise.html', what: 'Donate (fundraise)' },
  { path: '/get-involved.html', what: 'Get involved' },
  { path: '/contact.html', what: 'Contact' },
];

const BLOCKED = /(^https?:\/\/(www\.)?(google\.com|gstatic\.com|recaptcha\.net)\/recaptcha\/)/;

async function open(page: Page, path: string) {
  const problems: string[] = [];
  await page.route(BLOCKED, (route) => route.abort());
  page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const where = message.location().url;
    // Errors from the requests this test blocks on purpose are not the site's fault.
    if (BLOCKED.test(where) || /recaptcha/i.test(message.text())) return;
    problems.push(`console: ${message.text()}${where ? ` (${where})` : ''}`);
  });
  page.on('requestfailed', (request) => {
    if (BLOCKED.test(request.url())) return;
    if (request.resourceType() === 'image' || request.resourceType() === 'stylesheet' || request.resourceType() === 'script') {
      problems.push(`${request.resourceType()} failed: ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`);
    }
  });
  const response = await page.goto(path, { waitUntil: 'load' });
  // Walk down the page so lazy images load, then give every image a moment to settle.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    window.scrollTo(0, 0);
  });
  await page
    .waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 15_000 })
    .catch(() => undefined);
  return { response, problems };
}

async function brokenImages(page: Page) {
  return page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => img.currentSrc !== '' && img.complete && img.naturalWidth === 0)
      .map((img) => img.currentSrc),
  );
}

// The banner slider changes slide every 5 s, and its slide-change handler threw in production
// ("reading 'play'", Curiosity-Corp/ignite-curiosity#24) only then, after the page had loaded. Hold the
// landing page until the slider has changed slide twice, so a fault in that handler is caught.
type SliderJQuery = (selector: string) => { length: number; on: (event: string, handler: () => void) => void };

async function waitForSlideChanges(page: Page, selector: string, count: number) {
  return page.evaluate(
    ({ selector, count }) =>
      new Promise<number>((resolve, reject) => {
        const jq = (window as unknown as { jQuery?: SliderJQuery }).jQuery;
        if (!jq) return reject(new Error('jQuery is not loaded'));
        const slider = jq(selector);
        if (slider.length === 0) return reject(new Error(`no ${selector} on the page`));
        let seen = 0;
        const timer = setTimeout(() => reject(new Error(`${selector} changed slide ${seen} of ${count} times in 15 s`)), 15_000);
        slider.on('translated.owl.carousel', () => {
          seen += 1;
          if (seen >= count) {
            clearTimeout(timer);
            // Let every other handler of this event run before the caller reads the errors.
            setTimeout(() => resolve(seen), 250);
          }
        });
      }),
    { selector, count },
  );
}

test('the landing page loads cleanly for a customer', async ({ page }, testInfo) => {
  const { response, problems } = await open(page, '/');
  expect(await waitForSlideChanges(page, '#oc-fullslider', 2), 'banner slide changes').toBeGreaterThanOrEqual(2);
  // Saved before any assertion, so a red run still shows the page. production-e2e.mjs posts it.
  await page.screenshot({ path: `production-e2e/landing-${testInfo.project.name}.png`, fullPage: true });
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/\S/);
  expect(await brokenImages(page), 'images that did not load').toEqual([]);
  expect(problems, 'console errors, uncaught exceptions and failed assets').toEqual([]);
});

// The contact page's map: the Maps JavaScript API embed was loaded with no key (ApiProjectMapError,
// Curiosity-Corp/ignite-curiosity#24) and is replaced by a keyless location panel that links out.
// The panel must show the address and both links, and the page must not load the Maps API again.
test('the contact page shows its location panel, with no Maps API', async ({ page }) => {
  const mapsApi: string[] = [];
  page.on('request', (request) => {
    if (/^https:\/\/maps\.googleapis\.com\//.test(request.url())) mapsApi.push(request.url().split('?')[0] ?? '');
  });
  const { response, problems } = await open(page, '/contact.html');
  expect(response?.status()).toBe(200);
  const panel = page.locator('.maps-wraper .location-panel');
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box?.height ?? 0, 'location panel height').toBeGreaterThan(100);
  await expect(panel).toContainText('Marietta, OH 45750');
  await expect(panel.locator('a[href^="https://www.google.com/maps/search/?api=1"]')).toBeVisible();
  await expect(panel.locator('a[href^="https://www.openstreetmap.org/search"]')).toBeVisible();
  expect(mapsApi, 'requests to the Maps JavaScript API').toEqual([]);
  expect(problems, 'console errors, uncaught exceptions and failed assets').toEqual([]);
});

for (const { path, what } of PAGES) {
  test(`${what} (${path}) loads cleanly`, async ({ page }) => {
    const { response, problems } = await open(page, path);
    expect(response?.status(), path).toBe(200);
    await expect(page).toHaveTitle(/\S/);
    await expect(page.locator('body')).toBeVisible();
    expect(await brokenImages(page), 'images that did not load').toEqual([]);
    expect(problems, 'console errors, uncaught exceptions and failed assets').toEqual([]);
  });
}
