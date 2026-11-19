import { chromium } from 'playwright-core';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

const SHOTS = path.join(os.tmpdir(), 'sitr-verify');
await fs.mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const sidebar = page.locator('aside');
const keyInput = page.locator('#key-hex');

async function waitForBadge(text) {
  await page.waitForFunction(
    (value) =>
      Array.from(document.querySelectorAll('span')).some(
        (span) => span.textContent.trim() === value,
      ),
    text,
    { timeout: 90000 },
  );
}

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.locator('h1').waitFor();
await page.waitForTimeout(500);

// Real file upload ---------------------------------------------------------
await page
  .locator('input[type=file]')
  .setInputFiles(path.join('D:\\Security Project', 'src', 'assets', 'presets', 'tux.png'));
await page.locator('canvas').waitFor({ state: 'visible' });
await page.waitForTimeout(600);
console.log('uploaded file strip =', await sidebar.getByText('tux.png', { exact: false }).count());

// AES-128 path -------------------------------------------------------------
await sidebar.getByRole('button', { name: '128', exact: true }).click();
await page.waitForTimeout(400);
console.log('128-bit key length =', (await keyInput.inputValue()).length);
await page.getByRole('button', { name: 'تشفير الصورة', exact: true }).click();
await waitForBadge('مشفّرة');
await page.waitForTimeout(800);

const ctaBg = await page
  .getByRole('button', { name: 'فك تشفير الصورة', exact: true })
  .evaluate((el) => getComputedStyle(el).backgroundColor);
const activeOpBg = await page
  .getByRole('button', { name: 'فك التشفير', exact: true })
  .evaluate((el) => getComputedStyle(el).backgroundColor);
console.log('CTA bg =', ctaBg, '| active op bg =', activeOpBg);

await page.screenshot({ path: path.join(SHOTS, '20-aes128-encrypted-viewport.png') });

// Key-size auto alignment when switching back to decrypt -------------------
await sidebar.getByRole('button', { name: '256', exact: true }).click();
await page.waitForTimeout(200);
await sidebar.getByRole('button', { name: 'تشفير', exact: true }).click();
await page.waitForTimeout(150);
await sidebar.getByRole('button', { name: 'فك التشفير', exact: true }).click();
await page.waitForTimeout(300);
console.log('auto-aligned key bits length =', (await keyInput.inputValue()).length);

await page.getByRole('button', { name: 'فك تشفير الصورة', exact: true }).click();
await waitForBadge('مستعادة');
await page.waitForTimeout(300);
console.log('AES-128 decryption passed');

// Reset to original --------------------------------------------------------
await page.getByTitle('استعادة الصورة الأصلية').click();
await waitForBadge('أصلية');
console.log('reset passed');

// Tablet layout ------------------------------------------------------------
const tablet = await browser.newPage({ viewport: { width: 900, height: 1100 } });
await tablet.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await tablet.locator('h1').waitFor();
await tablet.waitForTimeout(500);
await tablet.getByRole('button', { name: /Tux/ }).first().click();
await tablet.locator('canvas').waitFor({ state: 'visible' });
await tablet.waitForTimeout(500);
await tablet.getByRole('button', { name: 'تشفير الصورة', exact: true }).click();
await tablet.waitForTimeout(2500);
await tablet.waitForTimeout(500);
await tablet.screenshot({ path: path.join(SHOTS, '21-tablet.png'), fullPage: true });
console.log(
  'tablet overflow =',
  await tablet.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
);

// Narrow mobile overflow ---------------------------------------------------
const narrow = await browser.newPage({ viewport: { width: 320, height: 700 } });
await narrow.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await narrow.locator('h1').waitFor();
await narrow.waitForTimeout(400);
console.log(
  '320px overflow =',
  await narrow.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
);
await narrow.screenshot({ path: path.join(SHOTS, '22-mobile-320.png'), fullPage: false });

console.log('errors =', errors);
await browser.close();
