/* DSWD website checks (phase 2 PHP pages).
   Run from C:\xampp\htdocs\SLP with Apache running:
     node "C:/Users/julie/.claude/skills/playwright-skill/run.js" dswd/tests/site-check.js
   Headless by default; PW_HEADLESS=false shows the browser. Harness: tests/harness.js. */

const {
  assert, path, SHOTS, check, run,
  missingIdRefs, unnamedControls, statusColoredText, smallTargets, tabStopsWithoutRing, noSidewaysScroll,
} = require('./harness');

const BASE = process.env.TARGET_URL || 'http://localhost/SLP/dswd/';
const PAGES = [
  'index.php', 'programs.php', 'program.php?slug=sustainable-livelihood-program', 'news.php',
  'article.php?slug=new-online-feedback-form', 'downloads.php', 'transparency.php', 'offices.php',
  'about.php', 'contact.php', 'faqs.php', 'search.php?q=pension', 'privacy.php', 'terms.php', 'sitemap.php',
];
const shotName = (url) => url.replace(/\.php.*$/, '');

/* ---------- every page ---------- */

for (const url of PAGES) {
  check(`${url}: one h1, one primary action, landmarks, breadcrumbs`, { url }, async (page) => {
    assert.equal(await page.locator('h1').count(), 1, 'h1 count');
    assert.equal(await page.locator('.btn--primary:visible').count(), 1, 'primary actions');
    for (const sel of ['header.site-header', 'nav#site-nav[aria-label]', 'main#main', 'footer.site-footer']) {
      assert.equal(await page.locator(sel).count(), 1, sel);
    }
    assert.equal(await page.locator('main nav.breadcrumb').count(), url === 'index.php' ? 0 : 1, 'breadcrumbs');
  });

  check(`${url}: names, id references, alt text, lazy images, weight`, { url }, async (page) => {
    assert.deepEqual(await page.evaluate(missingIdRefs), [], 'id references');
    assert.deepEqual(await page.evaluate(unnamedControls), [], 'accessible names');
    assert.deepEqual(await page.evaluate(statusColoredText), [], 'status colors used as text');
    const imgs = await page.$$eval('img', (els) => els.map((i) => ({
      src: i.getAttribute('src'), alt: i.hasAttribute('alt'), lazy: i.loading === 'lazy',
      top: i.getBoundingClientRect().top + window.scrollY,
    })));
    assert.deepEqual(imgs.filter((i) => !i.alt).map((i) => i.src), [], 'images without alt');
    assert.deepEqual(imgs.filter((i) => i.top > 900 && !i.lazy).map((i) => i.src), [], 'images below the first screen that are not lazy');
    const bytes = await page.evaluate(() => [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')]
      .reduce((sum, e) => sum + (e.encodedBodySize || 0), 0));
    assert.ok(bytes < 1024 * 1024, `page weight is ${bytes} bytes`);
  });

  for (const width of [320, 360, 768, 1024, 1440]) {
    check(`${url}: no sideways scroll at ${width}px`, { url, width }, async (page) => {
      await noSidewaysScroll(page);
      if (width === 360 || width === 1440) {
        await page.screenshot({ path: path.join(SHOTS, `site-${shotName(url)}-${width}.png`), fullPage: true, timeout: 30000 });
      }
    });
  }
}

/* ---------- targets, focus, header ---------- */

for (const url of ['index.php', 'programs.php', 'contact.php', 'offices.php']) {
  check(`${url}: targets are at least 44px at 360px`, { url, width: 360 }, async (page) => {
    assert.deepEqual(await page.evaluate(smallTargets), []);
  });
}

for (const url of ['index.php', 'programs.php', 'contact.php']) {
  check(`${url}: every Tab stop shows a focus ring`, { url }, async (page) => {
    assert.deepEqual(await tabStopsWithoutRing(page), []);
  });
}

check('header is sticky', {}, async (page) => {
  assert.equal(await page.locator('.site-header').evaluate((el) => getComputedStyle(el).position), 'sticky');
});

check('menu opens with Enter and closes with Escape at 360px', { width: 360 }, async (page) => {
  const toggle = page.locator('.menu-toggle');
  const nav = page.locator('#site-nav');
  assert.ok(await nav.isHidden());
  await toggle.focus();
  await page.keyboard.press('Enter');
  assert.ok(await nav.isVisible());
  await nav.getByRole('link').first().focus();
  await page.keyboard.press('Escape');
  assert.ok(await nav.isHidden());
  assert.ok(await toggle.evaluate((el) => el === document.activeElement));
});

check('section page is the current page; a page inside it is the current section', { url: 'programs.php' }, async (page) => {
  assert.equal(await page.locator('.site-nav__link[aria-current="page"]').textContent(), 'Programs and services');
  await page.goto(new URL('program.php?slug=kalahi-cidss', BASE).href);
  assert.equal(await page.locator('.site-nav__link[aria-current="true"]').textContent(), 'Programs and services');
});

check('language toggle switches to Filipino and remembers it', { url: 'index.php?lang=fil' }, async (page) => {
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'fil');
  assert.equal((await page.locator('#site-nav .site-nav__link').first().textContent()).trim(), 'Mga programa at serbisyo');
  await page.goto(new URL('programs.php', BASE).href);
  assert.equal((await page.locator('h1').textContent()).trim(), 'Mga programa at serbisyo');
  assert.equal(await page.locator('.lang-toggle__link[aria-current]').getAttribute('lang'), 'fil');
});

/* ---------- filters, search, pagination ---------- */

check('programs: type filter shows only services', { url: 'programs.php?kind=service' }, async (page) => {
  const metas = await page.locator('main .card__meta').allTextContents();
  assert.equal(metas.length, 2);
  assert.ok(metas.every((m) => m.startsWith('Service')), metas.join(' | '));
});

check('programs: category filter', { url: 'programs.php?category=children' }, async (page) => {
  assert.equal(await page.locator('main .card').count(), 2);
});

check('programs: no match shows the empty state', { url: 'programs.php?q=zzzz' }, async (page) => {
  assert.ok(await page.locator('.empty').isVisible());
});

check('news: search narrows the list', { url: 'news.php?q=typhoon' }, async (page) => {
  assert.equal(await page.locator('main .media').count(), 1);
});

check('news: two pages of six', { url: 'news.php' }, async (page) => {
  assert.equal(await page.locator('main .media').count(), 6);
  assert.equal(await page.locator('nav.pagination [aria-current="page"]').textContent(), '1');
  await page.goto(new URL('news.php?page=2', BASE).href);
  assert.equal(await page.locator('main .media').count(), 3);
});

check('news pagination: phones read "Page 1 of 2", wider screens get the page numbers', { url: 'news.php', width: 360 }, async (page) => {
  const status = page.locator('.pagination__status');
  assert.equal((await status.textContent()).trim(), 'Page 1 of 2');
  assert.ok(await status.isVisible());
  assert.equal(await page.locator('.pagination__page:visible').count(), 0);
  await page.setViewportSize({ width: 1024, height: 900 });
  assert.equal(await status.isVisible(), false);
  assert.equal(await page.locator('.pagination__page:visible').count(), 2);
});

check('skip link is the first Tab stop and moves focus to the main content', { url: 'programs.php' }, async (page) => {
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
  assert.ok(await page.locator('.skip-link').isVisible());
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
});

check('downloads: category and year filters', { url: 'downloads.php?category=forms&year=2026' }, async (page) => {
  const rows = await page.locator('tbody tr').allTextContents();
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.includes('Forms') && r.includes('2026')), rows.join(' | '));
});

check('offices: region filter', { url: 'offices.php?region=NCR' }, async (page) => {
  assert.equal(await page.locator('main .card').count(), 2); // central office and the NCR field office
});

check('search groups results by type', { url: 'search.php?q=pension' }, async (page) => {
  assert.ok((await page.locator('main .media').count()) >= 2);
  assert.ok((await page.locator('main h3').allTextContents()).some((h) => h.startsWith('Programs and services')));
});

check('unknown program returns 404 with a way back', { url: 'program.php?slug=does-not-exist', allowErrors: true }, async (page) => {
  assert.equal((await page.request.get(new URL('program.php?slug=does-not-exist', BASE).href)).status(), 404);
  assert.equal((await page.locator('h1').textContent()).trim(), 'Program not found');
  assert.equal(await page.locator('.btn--primary').count(), 1);
});

check('contact form: required fields, privacy notice and consent', { url: 'contact.php?type=complaint' }, async (page) => {
  assert.ok(await page.locator('input[name="type"][value="complaint"]').isChecked());
  for (const name of ['name', 'email', 'subject', 'message', 'consent']) {
    assert.equal(await page.locator(`[name="${name}"][required]`).count(), 1, name);
  }
  assert.ok(await page.locator('#privacy-notice').isVisible());
});

/* ---------- three-click rule ---------- */

check('every program, its requirements and the forms are within 3 clicks of home', {}, async (page) => {
  const home = new URL('index.php', BASE).href;
  const depth = new Map([[home, 0]]);
  let frontier = [home];
  for (let d = 1; d <= 3; d++) {
    const next = [];
    for (const url of frontier) {
      if (!url.includes('.php')) continue;
      const html = await (await page.request.get(url)).text();
      const links = await page.evaluate(({ html, url }) => [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a[href]')]
        .map((a) => new URL(a.getAttribute('href'), url).href.split('#')[0]), { html, url });
      for (const link of links) {
        if (link.startsWith(BASE) && !link.includes('lang=') && !depth.has(link)) {
          depth.set(link, d);
          next.push(link);
        }
      }
    }
    frontier = next;
  }
  const programsHtml = await (await page.request.get(new URL('programs.php', BASE).href)).text();
  const programLinks = [...new Set([...programsHtml.matchAll(/href="([^"]*program\.php\?slug=[^"]+)"/g)].map((m) => new URL(m[1].replace(/&amp;/g, '&'), BASE).href))];
  assert.equal(programLinks.length, 8);
  const tooDeep = programLinks.filter((l) => !(depth.get(l) <= 3)).map((l) => `${l} (${depth.get(l) ?? 'not reached'})`);
  assert.deepEqual(tooDeep, [], 'programs (their requirements are on the program page)');
  assert.ok(depth.get(new URL('downloads.php?category=forms', BASE).href) <= 1, 'forms list');
  assert.ok(depth.get(new URL('downloads/placeholder.pdf', BASE).href) <= 3, 'a form file');
});

run(BASE);
