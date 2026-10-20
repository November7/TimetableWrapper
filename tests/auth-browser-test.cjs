const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('../.tools/node_modules/playwright');
const fixture = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

(async () => {
  const browser = await chromium.launch({ channel: process.env.TEST_BROWSER_CHANNEL || 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, colorScheme: 'light' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(fixture.url + 'index.php');
    assert.equal(await page.locator('.login-microsoft').count(), 1);
    assert.equal(await page.locator('input:not([type="hidden"])').count(), 0);
    await page.screenshot({ path: path.join(fixture.output, 'login-light.png'), fullPage: true });
    await page.getByRole('button', { name: 'Przełącz na motyw ciemny' }).click();
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
    assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'dark');
    await page.screenshot({ path: path.join(fixture.output, 'login-dark.png'), fullPage: true });
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.setViewportSize({ width: 320, height: 700 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(fixture.output, 'login-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 850 });
    await context.addCookies([{ name: fixture.session.name, value: fixture.session.value, url: fixture.url, httpOnly: true, secure: true, sameSite: 'Lax' }]);
    await page.goto(fixture.url + 'index.php');
    await page.locator('#schedule').getByText('Matematyka').first().waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.locator('#plan-source-select option').count(), 3); // current + separator + archive
    await page.screenshot({ path: path.join(fixture.output, 'app-dark.png'), fullPage: true });
    const original = await page.locator('#original-plan-link').getAttribute('href');
    const originalTab = await context.newPage();
    await originalTab.goto(new URL(original, fixture.url).href);
    assert.equal(await originalTab.locator('body').evaluate(el => getComputedStyle(el).color), 'rgb(40, 50, 60)');
    await originalTab.close();
    const other = await context.newPage();
    await other.goto(fixture.url + 'index.php');
    await page.getByRole('button', { name: 'Przełącz na motyw jasny' }).click();
    await other.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await other.close();
    assert.deepEqual(errors, []);
    // A fresh context sees login and can reuse the theme saved in this browser origin.
    await context.clearCookies();
    await page.goto(fixture.url + 'index.php');
    assert.equal(await page.locator('.login-card').count(), 1);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    // Same origin and theme, independent public deployment with no PHP entry point.
    await page.goto(new URL('../static/TimetableWrapper/index.html', fixture.url).href);
    await page.locator('#schedule').getByText('Matematyka').first().waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.equal(await page.locator('.auth-logout').count(), 0);
    await page.getByRole('button', { name: 'Przełącz na motyw ciemny' }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'dark');
    assert.deepEqual(errors, []);
    console.log('PASS: login light/dark/mobile, persistent and cross-tab theme, independent PHP/HTML apps and original CSS.');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
