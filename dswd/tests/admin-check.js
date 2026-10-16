/* DSWD admin and security checks (phase 3).
   Needs the local test accounts: mysql -u root dswd_website < database/seed-test-users.sql
   Run from C:\xampp\htdocs\SLP with Apache and MySQL running:
     node "C:/Users/julie/.claude/skills/playwright-skill/run.js" dswd/tests/admin-check.js
   Each run first removes what the previous run left (sample accounts, feedback,
   soft-deleted articles and files) and clears the local rate-limit counters. */

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const {
  assert, path, check, run, missingIdRefs, unnamedControls, noSidewaysScroll, tabStopsWithoutRing,
} = require('./harness');

const BASE = process.env.TARGET_URL || 'http://localhost/SLP/dswd/';
const TEST_PASSWORD = fs.readFileSync(path.join(__dirname, '..', 'database', 'seed-test-users.sql'), 'utf8')
  .match(/Password for all four: (\S+)/)[1];
const RUN = Date.now().toString(36);
const at = (p) => new URL(p, BASE).href;

const sql = (query) => execFileSync('C:/xampp/mysql/bin/mysql.exe', ['-u', 'root', '-N', 'dswd_website', '-e', query], { encoding: 'utf8' });
const leftovers = sql(`SELECT cover_image FROM news_articles WHERE (title LIKE 'Photo check %' OR title LIKE 'Big photo check %') AND cover_image IS NOT NULL
  UNION ALL SELECT file_path FROM downloads WHERE title LIKE 'Upload check %' OR title LIKE 'PNG check %'`);
for (const file of leftovers.split(/\r?\n/)) {
  if (/^uploads\/(files|images)\/[0-9a-f]{32}\.(pdf|jpg|png)$/.test(file)) fs.rmSync(path.join(__dirname, '..', file), { force: true });
}
sql(`DELETE FROM rate_limits;
  DELETE FROM users WHERE email LIKE 'new-%@dswd.test';
  DELETE FROM feedback WHERE email IN ('check.person@example.com', 'api.person@example.com');
  DELETE FROM news_articles WHERE title LIKE 'Check article %' OR title LIKE 'Sanitizer check %' OR title LIKE 'Photo check %' OR title LIKE 'Big photo check %';
  DELETE FROM downloads WHERE title LIKE 'Upload check %' OR title LIKE 'PNG check %';`);

/** A two-tone JPEG or PNG drawn by the browser, as a Buffer. */
async function drawImage(page, type, width, height) {
  const data = await page.evaluate(([t, w, h]) => {
    const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1E7A4C';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#E8F4EC';
    ctx.fillRect(0, 0, w / 2, h / 2);
    return canvas.toDataURL(t, 0.9).split(',')[1];
  }, [type, width, height]);
  return Buffer.from(data, 'base64');
}

const jpegSegment = (marker, body) => Buffer.concat([Buffer.from([0xFF, marker, (body.length + 2) >> 8, (body.length + 2) & 255]), body]);

/** Exif as a phone writes it: orientation 6 (rotated) and the owner's name. */
function phoneExif() {
  const artist = Buffer.from('SECRET-ARTIST\0', 'latin1');
  const ifd = Buffer.alloc(30);
  ifd.writeUInt16LE(2, 0);
  ifd.writeUInt16LE(0x0112, 2); ifd.writeUInt16LE(3, 4); ifd.writeUInt32LE(1, 6); ifd.writeUInt16LE(6, 10);
  ifd.writeUInt16LE(0x013B, 14); ifd.writeUInt16LE(2, 16); ifd.writeUInt32LE(artist.length, 18); ifd.writeUInt32LE(8 + ifd.length, 22);
  return Buffer.concat([Buffer.from([0x45, 0x78, 0x69, 0x66, 0, 0, 0x49, 0x49, 0x2A, 0, 8, 0, 0, 0]), ifd, artist]);
}

const crc32 = (buf) => {
  let c = ~0;
  for (const byte of buf) { c ^= byte; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
  return ~c >>> 0;
};

/** The PNG with a text chunk after IHDR. */
function pngWithText(png) {
  const data = Buffer.from('Comment\0SECRET-PNG', 'latin1');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write('tEXt', 4, 'latin1');
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);
}

async function storedFile(page, folder) {
  const href = await page.locator(`.field__hint a[href*="uploads/${folder}/"]`).getAttribute('href');
  return { href, bytes: Buffer.from(await (await page.request.get(new URL(href, BASE).href)).body()) };
}

async function fillArticle(page, title) {
  await page.locator('#f-title').fill(title);
  await page.getByLabel('Short summary').fill('Checks how cover photos are stored.');
  await page.locator('.rte__area, textarea#f-body').first().fill('Body text for the photo check.');
  await page.getByLabel('Describe the cover photo').fill('A green test square.');
}

async function signIn(page, email, password = TEST_PASSWORD) {
  await page.goto(at('admin/login.php'));
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/* ---------- sign-in ---------- */

check('wrong password gets one generic message', { url: 'admin/login.php' }, async (page) => {
  await signIn(page, 'editor@dswd.test', 'not-the-password');
  assert.ok(await page.getByText('Email or password is incorrect.').isVisible());
  await signIn(page, `nobody-${RUN}@dswd.test`, 'whatever-password');
  assert.ok(await page.getByText('Email or password is incorrect.').isVisible(), 'unknown email gives the same message');
});

check('sign-in is rate limited after 5 failures', { url: 'admin/login.php' }, async (page) => {
  const email = `limit-${RUN}@dswd.test`;
  for (let i = 0; i < 5; i++) await signIn(page, email, 'wrong-password-123');
  await signIn(page, email, 'wrong-password-123');
  assert.ok(await page.getByText(/Too many attempts/).isVisible());
});

check('session cookie is HttpOnly and SameSite=Strict', { url: 'admin/login.php' }, async (page) => {
  await signIn(page, 'viewer@dswd.test');
  const cookie = (await page.context().cookies()).find((c) => c.name === 'dswd_session');
  assert.ok(cookie, 'session cookie set');
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, 'Strict');
});

check('signing out needs a POST; a plain link does not sign out', { url: 'admin/login.php' }, async (page) => {
  await signIn(page, 'viewer@dswd.test');
  await page.goto(at('admin/logout.php'));
  assert.ok(page.url().endsWith('admin/dashboard.php'), page.url());
  await page.getByRole('button', { name: 'Sign out' }).click();
  assert.ok(page.url().endsWith('admin/login.php'), page.url());
  await page.goto(at('admin/dashboard.php'));
  assert.ok(page.url().endsWith('admin/login.php'), 'dashboard needs sign-in again');
});

/* ---------- roles ---------- */

check('every admin page sends signed-out visitors to sign in', { url: 'admin/login.php' }, async (page) => {
  const pages = fs.readdirSync(path.join(__dirname, '..', 'admin')).filter((f) => f.endsWith('.php') && f !== 'login.php' && !f.startsWith('_'));
  assert.ok(pages.length >= 15, pages.join(', '));
  for (const p of pages) {
    for (const method of ['get', 'post']) {
      const res = await page.request[method](at(`admin/${p}`), { maxRedirects: 0 });
      const ok = res.status() === 303 && /admin\/(login|dashboard)\.php$/.test(res.headers().location || '');
      assert.ok(ok || (method === 'post' && res.status() === 403), `${method.toUpperCase()} ${p} → ${res.status()} ${res.headers().location || ''}`);
    }
  }
});

check('viewers and editors get 403 on staff-only pages', { url: 'admin/login.php', allowErrors: true }, async (page) => {
  for (const email of ['viewer@dswd.test', 'editor@dswd.test']) {
    await signIn(page, email);
    for (const p of ['users.php', 'audit.php', 'settings.php', 'categories.php', 'feedback.php']) {
      assert.equal((await page.goto(at(`admin/${p}`))).status(), 403, `${email} ${p}`);
    }
    await page.goto(at('admin/dashboard.php'));
    await page.getByRole('button', { name: 'Sign out' }).click();
  }
});

check('viewer can look but not add, change or open feedback', { url: 'admin/login.php', allowErrors: true }, async (page) => {
  await signIn(page, 'viewer@dswd.test');
  await page.goto(at('admin/programs.php'));
  assert.equal(await page.getByRole('link', { name: /^Add program/ }).count(), 0);
  await page.locator('main table').getByRole('link', { name: /^View/ }).first().click();
  assert.equal(await page.getByRole('button', { name: 'Save' }).count(), 0);
  assert.ok(await page.locator('#f-title_en').isDisabled());
  const response = await page.goto(at('admin/feedback.php'));
  assert.equal(response.status(), 403);
  assert.equal((await page.goto(at('admin/programs.php?action=new'))).status(), 403);
});

check('editor drafts stay off the site until a publisher publishes them', { url: 'admin/login.php' }, async (page) => {
  const title = `Check article ${RUN}`;
  await signIn(page, 'editor@dswd.test');
  await page.goto(at('admin/news.php?action=new'));
  await page.locator('#f-title').fill(title);
  await page.getByLabel('Short summary').fill('A short summary for the automated check.');
  await page.locator('.rte__area').fill('Body text for the automated check.');
  await page.getByRole('button', { name: 'Save' }).click();
  assert.ok(await page.getByText(/stays a draft/).isVisible(), 'saved as a draft');
  assert.equal(await page.getByRole('button', { name: 'Publish' }).count(), 0, 'editors cannot publish');
  const editUrl = page.url();

  const publicPage = await page.context().newPage();
  await publicPage.goto(at(`news.php?q=${encodeURIComponent(title)}`));
  assert.equal(await publicPage.locator('main .media').count(), 0, 'draft not public');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, 'publisher@dswd.test');
  await page.goto(editUrl);
  await page.getByRole('button', { name: 'Publish' }).click();
  assert.ok(await page.getByText(/now on the website/).isVisible());
  await publicPage.reload();
  assert.equal(await publicPage.locator('main .media').count(), 1, 'published article is public');

  await page.getByRole('link', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
  await publicPage.reload();
  assert.equal(await publicPage.locator('main .media').count(), 0, 'deleted article is gone');
});

check('rich text is cleaned on save', { url: 'admin/login.php', allowErrors: true }, async (page) => {
  await signIn(page, 'editor@dswd.test');
  await page.goto(at('admin/news.php?action=new'));
  await page.locator('#f-title').fill(`Sanitizer check ${RUN}`);
  await page.getByLabel('Short summary').fill('Checks that unsafe markup is removed.');
  await page.locator('.rte__area').evaluate((el) => {
    el.innerHTML = '<p onclick="alert(1)">Safe <b>bold</b></p><script>alert(1)</script><a href="javascript:alert(1)">bad link</a><img src=x onerror=alert(1)>';
  });
  await page.getByRole('button', { name: 'Save' }).click();
  const saved = await page.locator('textarea[name="body"]').inputValue();
  assert.ok(!/script|onclick|onerror|javascript:|<img/i.test(saved), saved);
  assert.ok(saved.includes('<strong>bold</strong>'), saved);
  await page.getByRole('link', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
});

check('a POST without the CSRF token is refused', { url: 'admin/login.php', allowErrors: true }, async (page) => {
  await signIn(page, 'publisher@dswd.test');
  const response = await page.request.post(at('admin/programs.php'), { form: { do: 'save', title_en: 'No token' } });
  assert.equal(response.status(), 403);
});

check('uploads accept a real PDF and refuse a disguised script', { url: 'admin/login.php' }, async (page) => {
  await signIn(page, 'publisher@dswd.test');
  await page.goto(at('admin/downloads.php?action=new'));
  await page.locator('#f-title').fill(`Upload check ${RUN}`);
  await page.getByLabel('Category').selectOption({ label: 'Forms' });
  await page.getByLabel('Year').fill('2026');
  await page.locator('#f-file_path').setInputFiles({ name: 'form.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<?php echo "hacked"; ?>') });
  await page.getByRole('button', { name: 'Save' }).click();
  assert.ok(await page.getByText('Upload a PDF, JPG or PNG file.').first().isVisible(), 'script refused');

  await page.locator('#f-file_path').setInputFiles(path.join(__dirname, '..', 'downloads', 'placeholder.pdf'));
  await page.getByRole('button', { name: 'Save' }).click();
  const link = page.locator('.field__hint a[href*="uploads/files/"]');
  const href = await link.getAttribute('href');
  assert.match(href, /uploads\/files\/[0-9a-f]{32}\.pdf$/, 'stored under a random name');
  const file = await page.request.get(new URL(href, BASE).href);
  assert.equal(file.status(), 200);
  assert.equal(file.headers()['content-type'], 'application/pdf');
  await page.getByRole('link', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
});

check('photos are stored without location or owner details and stay upright', { url: 'admin/login.php' }, async (page) => {
  await signIn(page, 'editor@dswd.test');
  await page.goto(at('admin/news.php?action=new'));
  const jpg = await drawImage(page, 'image/jpeg', 64, 48);
  const tagged = Buffer.concat([jpg.subarray(0, 2), jpegSegment(0xE1, phoneExif()), jpegSegment(0xFE, Buffer.from('SECRET-COMMENT')), jpg.subarray(2)]);
  await fillArticle(page, `Photo check ${RUN}`);
  await page.locator('#f-cover_image').setInputFiles({ name: 'phone.jpg', mimeType: 'image/jpeg', buffer: tagged });
  await page.getByRole('button', { name: 'Save' }).click();
  const { bytes } = await storedFile(page, 'images');
  assert.ok(!bytes.includes('SECRET'), 'Exif owner name and comment removed');
  assert.ok(bytes.includes(Buffer.from([0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06])), 'orientation 6 kept');
  assert.ok(bytes.includes(jpg.subarray(jpg.indexOf(Buffer.from([0xFF, 0xDA])))), 'image data unchanged');
  await page.getByRole('link', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
});

check('PNG files lose their text chunks and anything hidden after the image', { url: 'admin/login.php' }, async (page) => {
  await signIn(page, 'publisher@dswd.test');
  await page.goto(at('admin/downloads.php?action=new'));
  const png = await drawImage(page, 'image/png', 40, 30);
  await page.locator('#f-title').fill(`PNG check ${RUN}`);
  await page.getByLabel('Category').selectOption({ label: 'Forms' });
  await page.getByLabel('Year').fill('2026');
  await page.locator('#f-file_path').setInputFiles({ name: 'scan.png', mimeType: 'image/png', buffer: Buffer.concat([pngWithText(png), Buffer.from('<?php echo 1; ?>')]) });
  await page.getByRole('button', { name: 'Save' }).click();
  const { bytes } = await storedFile(page, 'files');
  assert.ok(!bytes.includes('SECRET') && !bytes.includes('<?php'), 'text chunk and trailing data removed');
  assert.equal(bytes.subarray(-8, -4).toString('latin1'), 'IEND');
  await page.getByRole('link', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
});

check('big photos are scaled to 1600 pixels in the browser before upload', { url: 'admin/login.php' }, async (page) => {
  await signIn(page, 'editor@dswd.test');
  await page.goto(at('admin/news.php?action=new'));
  await fillArticle(page, `Big photo check ${RUN}`);
  await page.locator('#f-cover_image').setInputFiles({ name: 'big.jpg', mimeType: 'image/jpeg', buffer: await drawImage(page, 'image/jpeg', 2400, 1200) });
  await page.waitForFunction(async () => (await createImageBitmap(document.querySelector('#f-cover_image').files[0])).width === 1600);
  await page.getByRole('button', { name: 'Save' }).click();
  const { href } = await storedFile(page, 'images');
  const size = await page.evaluate(async (src) => { const img = new Image(); img.src = src; await img.decode(); return [img.naturalWidth, img.naturalHeight]; }, href);
  assert.deepEqual(size, [1600, 800]);
  await page.getByRole('link', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
});

check('without JavaScript the server asks for a smaller photo', { url: 'admin/login.php', js: false }, async (page) => {
  const helper = await page.context().browser().newPage();
  const big = await drawImage(helper, 'image/jpeg', 2400, 1200);
  await helper.close();
  await signIn(page, 'editor@dswd.test');
  await page.goto(at('admin/news.php?action=new'));
  await fillArticle(page, `Big photo check ${RUN} no script`);
  await page.locator('#f-cover_image').setInputFiles({ name: 'big.jpg', mimeType: 'image/jpeg', buffer: big });
  await page.getByRole('button', { name: 'Save' }).click();
  assert.ok(await page.getByText('Make the image at most 1600 pixels wide and high').first().isVisible());
});

check('new accounts must change the temporary password first', { url: 'admin/login.php' }, async (page) => {
  const email = `new-${RUN}@dswd.test`;
  await signIn(page, 'super@dswd.test');
  await page.goto(at('admin/users.php?action=new'));
  await page.getByLabel('Full name').fill('Check User');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Role').selectOption({ label: 'Viewer' });
  await page.getByRole('button', { name: 'Save' }).click();
  const message = await page.locator('.alert--success').textContent();
  const temporary = message.match(/by phone: (\S+)/)[1];
  await page.getByRole('button', { name: 'Sign out' }).click();

  await signIn(page, email, temporary);
  assert.ok(page.url().endsWith('admin/change-password.php'), page.url());
  await page.goto(at('admin/programs.php'));
  assert.ok(page.url().endsWith('admin/change-password.php'), 'blocked until the password changes');
  await page.getByLabel('Current password').fill(temporary);
  await page.locator('#f-new').fill(`A new long passphrase ${RUN}`);
  await page.getByLabel('Type the new password again').fill(`A new long passphrase ${RUN}`);
  await page.getByRole('button', { name: 'Change password' }).click();
  assert.ok(page.url().endsWith('admin/dashboard.php'), page.url());
});

check('audit log records sign-ins, publishing and deletes', { url: 'admin/login.php' }, async (page) => {
  await signIn(page, 'super@dswd.test');
  await page.goto(at('admin/audit.php'));
  const actions = await page.locator('tbody tr td:nth-child(3)').allTextContents();
  for (const action of ['login', 'create', 'publish', 'delete', 'login_failed']) {
    assert.ok(actions.includes(action), `audit has ${action}`);
  }
});

/* ---------- feedback ---------- */

check('contact form gives a reference number, and only publishers see the message', { url: 'contact.php' }, async (page) => {
  const subject = `Feedback check ${RUN}`;
  await page.getByLabel('Full name').fill('Check Person');
  await page.getByLabel('Email address').fill('check.person@example.com');
  await page.getByLabel('Subject').fill(subject);
  await page.getByLabel('Message').fill('This message checks the feedback form end to end.');
  await page.getByLabel(/I have read the privacy notice/).check();
  await page.getByRole('button', { name: 'Send message' }).click();
  const text = await page.locator('.alert--success').textContent();
  const reference = text.match(/FB-\d{8}-[A-Z2-9]{6}/)[0];
  await page.reload();
  assert.equal(await page.locator('.alert--success').count(), 0, 'reload does not resend or repeat');

  await signIn(page, 'publisher@dswd.test');
  await page.goto(at(`admin/feedback.php?q=${reference}`));
  assert.equal(await page.getByRole('link', { name: reference }).count(), 1);
});

check('contact form explains every error after an empty submission', { url: 'contact.php' }, async (page) => {
  await page.locator('form.form-stack').evaluate((form) => { form.noValidate = true; });
  await page.getByRole('button', { name: 'Send message' }).click();
  const summary = await page.locator('.alert--error a').allTextContents();
  assert.equal(summary.length, 5, summary.join(' | ')); // name, email, subject, message, consent
  assert.equal(await page.locator('[aria-invalid="true"]').count(), 5);
  assert.deepEqual(await page.evaluate(missingIdRefs), []);
});

check('feedback API needs the token and returns a reference number', { url: 'contact.php', allowErrors: true }, async (page) => {
  const body = { type: 'question', name: 'Api Person', email: 'api.person@example.com', subject: `API check ${RUN}`, message: 'Sent through the JSON endpoint.', consent: true };
  const refused = await page.request.post(at('api/feedback.php'), { data: body });
  assert.equal(refused.status(), 403);
  const token = (await (await page.request.get(at('api/feedback.php'))).json()).csrf_token;
  const sent = await page.request.post(at('api/feedback.php'), { data: body, headers: { 'X-CSRF-Token': token } });
  assert.equal(sent.status(), 201);
  assert.match((await sent.json()).reference_no, /^FB-\d{8}-[A-Z2-9]{6}$/);
  const invalid = await page.request.post(at('api/feedback.php'), { data: { ...body, email: 'not-an-email' }, headers: { 'X-CSRF-Token': token } });
  assert.equal(invalid.status(), 422);
  assert.ok((await invalid.json()).errors.email);
});

check('resolved feedback past the retention period is deleted; open requests stay', { url: 'admin/login.php' }, async (page) => {
  sql(`INSERT INTO feedback (reference_no, type, name, email, subject, message, status, consent_at, updated_at) VALUES
    ('FB-OLD-${RUN}-R', 'question', 'Old Person', 'check.person@example.com', 'Old resolved', 'Old.', 'resolved', NOW(), NOW() - INTERVAL 400 DAY),
    ('FB-OLD-${RUN}-N', 'question', 'Old Person', 'check.person@example.com', 'Old open', 'Old.', 'new', NOW(), NOW() - INTERVAL 400 DAY)`);
  await signIn(page, 'viewer@dswd.test');
  assert.equal(sql(`SELECT reference_no FROM feedback WHERE reference_no LIKE 'FB-OLD-${RUN}-%'`).trim(), `FB-OLD-${RUN}-N`);
});

/* ---------- admin pages: accessibility basics ---------- */

for (const [url, width] of [['admin/dashboard.php', 1024], ['admin/programs.php', 360], ['admin/programs.php?action=edit&id=2', 1024]]) {
  check(`${url} at ${width}px: one h1, names, ids, no sideways scroll`, { url: 'admin/login.php', width }, async (page) => {
    await signIn(page, 'super@dswd.test');
    await page.goto(at(url));
    assert.equal(await page.locator('h1').count(), 1);
    assert.deepEqual(await page.evaluate(missingIdRefs), []);
    assert.deepEqual(await page.evaluate(unnamedControls), []);
    await noSidewaysScroll(page);
  });
}

check('admin edit page: every Tab stop shows a focus ring', { url: 'admin/login.php' }, async (page) => {
  await signIn(page, 'super@dswd.test');
  await page.goto(at('admin/programs.php?action=edit&id=2'));
  assert.deepEqual(await tabStopsWithoutRing(page), []);
});

run(BASE);
