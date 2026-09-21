const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

let server, browser, origin;
before(async () => {
  server = createServer(async (req, res) => {
    const file = path.basename(new URL(req.url, 'http://localhost').pathname);
    const folder = req.url.startsWith('/fonts/') ? 'fonts/' : '';
    try {
      const data = await readFile(path.join(__dirname, '..', folder, file));
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' }[path.extname(file)];
      res.writeHead(200, { 'Content-Type': mime || 'text/plain' }); res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

const user = { id: 'verified-user', email: 'person@example.com', email_confirmed_at: '2026-09-21T00:00:00Z' };
const successHash = '#access_token=valid&type=signup&refresh_token=do-not-store';
async function pageFor(hash, response = user, status = 200, instance = browser) {
  const page = await instance.newPage({ viewport: { width: 390, height: 844 } });
  const requests = [];
  await page.route('https://*.supabase.co/**', async route => {
    requests.push(route.request());
    if (response === 'offline') await route.abort();
    else await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(response) });
  });
  await page.goto(`${origin}/auth-callback.html${hash}`);
  await page.waitForFunction(() => document.querySelector('h1').textContent !== 'Checking verification…');
  return { page, requests };
}

test('bare URL, forged success, missing token, wrong flow, and expired link never show success', async () => {
  for (const hash of ['', '?verified=true', '#type=signup', '#access_token=fake', '#access_token=valid&type=recovery',
    '#error_code=otp_expired&error_description=Expired', `${successHash}&error=access_denied`, `?error=invalid${successHash}`]) {
    const { page, requests } = await pageFor(hash);
    assert.equal(await page.locator('h1').textContent(), 'Unable to verify email');
    assert.equal(await page.locator('#resend-form').isVisible(), true);
    assert.equal(requests.length, 0);
    assert.equal(new URL(page.url()).hash, '');
    await page.close();
  }
});

test('validated success has the requested copy, official logo, and token-free app link; sessions survive', async () => {
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('existing-session', 'preserve-this'));
  let authCalls = 0;
  await page.route('https://*.supabase.co/**', async route => {
    authCalls++;
    assert.equal(route.request().method(), 'GET');
    assert.equal(route.request().headers().authorization, 'Bearer valid');
    await route.fulfill({ json: user });
  });
  await page.goto(`${origin}/auth-callback.html${successHash}`);
  await page.waitForFunction(() => document.querySelector('h1').textContent === 'Email verified');
  assert.equal(await page.locator('#result-body').textContent(), 'Your UNBND account is ready.');
  assert.equal(await page.locator('#open-app').textContent(), 'Open UNBND');
  assert.equal(await page.locator('#open-app').getAttribute('href'), 'unbnd:///');
  assert.equal(await page.locator('#resend-form').isVisible(), false);
  assert.equal(await page.locator('.logo').getAttribute('alt'), 'UNBND');
  assert.equal(await page.locator('.logo').evaluate(img => img.naturalWidth), 1024);
  assert.equal(await page.evaluate(() => localStorage.getItem('existing-session')), 'preserve-this');
  assert.equal(await page.evaluate(() => localStorage.length), 1);
  assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  assert.equal(new URL(page.url()).hash, '');
  assert.equal(authCalls, 1);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('h1').textContent === 'Unable to verify email');
  await page.close();
});

test('invalid/unconfirmed users are rejected and connection errors can be retried', async () => {
  for (const [response, status, title] of [[{}, 401, 'Unable to verify email'], [{ ...user, email_confirmed_at: null }, 200, 'Unable to verify email'],
    ['offline', 200, 'Could not check verification'], [{}, 503, 'Could not check verification'], [{}, 429, 'Could not check verification']]) {
    const { page } = await pageFor(successHash, response, status);
    assert.equal(await page.locator('h1').textContent(), title);
    if (title === 'Could not check verification') {
      await page.unroute('https://*.supabase.co/**');
      await page.route('https://*.supabase.co/**', route => route.fulfill({ json: user }));
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('h1').textContent === 'Email verified');
    }
    await page.close();
  }
});

test('resend uses signup, normalizes email, pins HTTPS redirect, and throttles repeated sends', async () => {
  const { page, requests } = await pageFor('');
  await page.getByLabel('Account email').fill('Person@Example.com');
  await page.getByRole('button', { name: 'Send another verification email' }).click();
  await page.waitForFunction(() => document.querySelector('#resend-status').textContent.includes('on its way'));
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].postDataJSON(), { type: 'signup', email: 'person@example.com' });
  assert.equal(new URL(requests[0].url()).searchParams.get('redirect_to'), 'https://dongyoon112.github.io/UpNext/auth-callback.html');
  assert.equal(await page.locator('#resend').isDisabled(), true);
  assert.equal(await page.locator('h1').textContent(), 'Unable to verify email');
  await page.close();
});

test('resend failures and rate limits give actionable feedback', async () => {
  for (const [response, status, message] of [[{}, 429, 'Too many requests'], ['offline', 200, 'We could not send'], [{}, 500, 'We could not send']]) {
    const { page } = await pageFor('', response, status);
    await page.getByLabel('Account email').fill('person@example.com');
    await page.locator('#resend').click();
    await page.waitForFunction(text => document.querySelector('#resend-status').textContent.includes(text), message);
    await page.close();
  }
});

test('320px phone layout has no overflow and images can be blocked without losing the action', async () => {
  const { page } = await pageFor(successHash);
  await page.setViewportSize({ width: 320, height: 640 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.route('**/*.png', route => route.abort());
  await page.goto(`${origin}/auth-callback.html${successHash}`);
  await page.waitForFunction(() => document.querySelector('h1').textContent === 'Email verified');
  assert.equal(await page.locator('#open-app').isVisible(), true);
  await page.close();
});

test('WebKit mobile browser validates the callback too', { skip: process.env.UNBND_SKIP_WEBKIT === '1' ? 'WebKit system libraries unavailable on this host' : false }, async () => {
  const safari = await webkit.launch({ headless: true });
  try {
    const { page } = await pageFor(successHash, user, 200, safari);
    assert.equal(await page.locator('h1').textContent(), 'Email verified');
    await page.close();
  } finally { await safari.close(); }
});
