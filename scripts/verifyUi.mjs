import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const SHOTS = path.join(os.tmpdir(), 'sitr-verify');
await fs.mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--font-render-hinting=none'],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(`PAGEERROR: ${error.message}`));

const sidebar = page.locator('aside');
const keyInput = page.locator('#key-hex');
const ctaEncrypt = page.getByRole('button', { name: 'تشفير الصورة', exact: true });
const ctaDecrypt = page.getByRole('button', { name: 'فك تشفير الصورة', exact: true });

async function waitForBadge(text, timeout = 90000) {
  await page.waitForFunction(
    (value) =>
      Array.from(document.querySelectorAll('span')).some(
        (span) => span.textContent.trim() === value,
      ),
    text,
    { timeout },
  );
}

async function screenshot(name, fullPage = true) {
  await page.screenshot({ path: path.join(SHOTS, name), fullPage });
  console.log(`SHOT ${name}`);
}

async function loadPreset(name) {
  await sidebar.getByRole('button', { name: new RegExp(name) }).click();
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(350);
}

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(700);
console.log('HTML dir =', await page.locator('html').getAttribute('dir'));
await screenshot('01-desktop-initial.png');

// ECB with Tux -------------------------------------------------------------
await loadPreset('Tux');
const originalKey = await keyInput.inputValue();
console.log('key length =', originalKey.length);
await screenshot('02-tux-original.png');

await ctaEncrypt.click();
await waitForBadge('مشفّرة');
await page.waitForTimeout(300);
const ecbStats = await page.locator('section').filter({ hasText: 'المعاينة الحيّة' }).innerText();
console.log('ECB state captured');
await screenshot('03-tux-ecb-encrypted.png');

await ctaDecrypt.click();
await waitForBadge('مستعادة');
await screenshot('04-tux-decrypted.png');

// Export .sitr, reload, import and decrypt --------------------------------
await ctaEncrypt.click();
await waitForBadge('مشفّرة');
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.getByTitle('تنزيل حزمة .sitr').click(),
]);
const packagePath = path.join(SHOTS, 'roundtrip.sitr');
await download.saveAs(packagePath);
console.log('downloaded =', packagePath, (await fs.stat(packagePath)).size, 'bytes');

await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('h1').waitFor({ state: 'visible' });
await page.waitForTimeout(500);
await page.locator('input[type=file]').setInputFiles(packagePath);
await waitForBadge('مشفّرة');
await keyInput.fill(originalKey);
await page.waitForTimeout(200);
await ctaDecrypt.click();
await waitForBadge('مستعادة');
console.log('round-trip package decryption passed');
await screenshot('05-imported-roundtrip.png');

// CBC with Alice -----------------------------------------------------------
await sidebar.getByRole('button', { name: /CBC/ }).click();
await loadPreset('Alice');
await page.waitForTimeout(300);
await screenshot('06-alice-cbc-original.png');
await ctaEncrypt.click();
await waitForBadge('مشفّرة');
await screenshot('07-alice-cbc-encrypted.png');

// Wrong key rejection ------------------------------------------------------
await sidebar.getByRole('button', { name: 'توليد', exact: true }).click();
await page.waitForTimeout(250);
await ctaDecrypt.click();
await page.waitForTimeout(1200);
const errorVisible = await page.getByRole('alert').first().isVisible().catch(() => false);
console.log('wrong-key error visible =', errorVisible);
if (errorVisible) console.log('error =', await page.getByRole('alert').first().innerText());
await screenshot('08-wrong-key.png');

// CTR mode ---------------------------------------------------------------
await sidebar.getByRole('button', { name: /CTR/ }).click();
await loadPreset('Tux');
await ctaEncrypt.click();
await waitForBadge('مشفّرة');
await screenshot('09-tux-ctr-encrypted.png');

// Passphrase derivation ---------------------------------------------------
await sidebar.getByRole('button', { name: 'من جملة', exact: true }).click();
await page.locator('#passphrase').fill('سِتر-2026-اختبار');
await page.getByRole('button', { name: 'اشتقاق', exact: true }).click();
await page.waitForTimeout(1200);
console.log('derived key length =', (await keyInput.inputValue()).length);
await screenshot('10-passphrase-panel.png');

// Mobile layout ------------------------------------------------------------
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const mobileErrors = [];
mobile.on('pageerror', (error) => mobileErrors.push(error.message));
await mobile.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await mobile.locator('h1').waitFor({ state: 'visible' });
await mobile.waitForTimeout(600);
await mobile.screenshot({ path: path.join(SHOTS, '11-mobile-initial.png'), fullPage: true });
await mobile.screenshot({ path: path.join(SHOTS, '12-mobile-viewport.png') });
await mobile.getByRole('button', { name: /Tux/ }).first().click();
await mobile.waitForTimeout(800);
await mobile.getByRole('button', { name: 'تشفير الصورة', exact: true }).click();
await mobile.waitForTimeout(3000);
await mobile.screenshot({ path: path.join(SHOTS, '13-mobile-encrypted.png'), fullPage: true });
console.log('mobile errors =', mobileErrors);

// Horizontal overflow check at both sizes
const overflowDesktop = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
const overflowMobile = await mobile.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
console.log('overflow desktop/mobile =', overflowDesktop, overflowMobile);
console.log('console errors =', consoleErrors);
console.log('ECB snapshot:', ecbStats.slice(0, 220).replace(/\n/g, ' | '));

await browser.close();
