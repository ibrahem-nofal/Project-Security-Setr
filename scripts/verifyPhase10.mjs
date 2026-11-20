import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const BASE = process.argv[2] || 'http://127.0.0.1:5173/';
const SHOTS = path.join(os.tmpdir(), 'sitr-phase10');
await fs.mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const errors = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const sidebar = page.locator('aside');
const keyInput = page.locator('#key-hex');
const ctaEncrypt = page.getByRole('button', { name: 'تشفير الصورة', exact: true });
const ctaDecrypt = page.getByRole('button', { name: 'فك تشفير الصورة', exact: true });

async function waitForBadge(text, timeout = 90000) {
  await page.waitForFunction(
    (value) =>
      Array.from(document.querySelectorAll('span')).some((span) => span.textContent.trim() === value),
    text,
    { timeout },
  );
}

async function ensurePresetsOpen() {
  const show = sidebar.getByRole('button', { name: 'إظهار', exact: true });
  if (await show.count()) {
    await show.click();
    await page.waitForTimeout(200);
  }
}

async function loadPreset(name) {
  await ensurePresetsOpen();
  await sidebar.getByRole('button', { name: new RegExp(name) }).click();
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(400);
}

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.locator('h1').waitFor({ state: 'visible' });
await page.waitForTimeout(700);

// 4) Presets collapsed by default and 5 items
const presetGrid = page.locator('#preset-grid');
if (await presetGrid.isVisible().catch(() => false)) {
  throw new Error('Presets should be collapsed by default');
}
await ensurePresetsOpen();
const presetButtons = await page.locator('#preset-grid button').count();
if (presetButtons < 5) throw new Error(`Expected >=5 presets, got ${presetButtons}`);
for (const name of ['Tux', 'Alice', 'شبكة', 'تدرج', 'وثيقة']) {
  if ((await sidebar.getByRole('button', { name: new RegExp(name) }).count()) === 0) {
    throw new Error(`Missing preset: ${name}`);
  }
}
console.log('Task 4: presets collapsed by default and 5 presets present');

// 3) Step 3 IV integration
await page.getByText('إدارة المفتاح والمعاملات', { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 });
await sidebar.getByRole('button', { name: /ECB/ }).click();
await page.waitForTimeout(300);
await page.getByText('نمط ECB لا يتطلب IV', { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 });
await sidebar.getByRole('button', { name: /CBC/ }).click();
await page.waitForTimeout(150);
const ivField = page.locator('#iv-field');
await ivField.waitFor({ state: 'visible' });
if ((await ivField.getAttribute('maxlength')) !== '32') throw new Error('IV maxlength not 32');
if ((await page.getByRole('button', { name: 'توليد IV جديد' }).count()) === 0) {
  throw new Error('IV generate button missing');
}
if ((await page.getByRole('button', { name: 'نسخ متجه التهيئة' }).count()) === 0) {
  throw new Error('IV copy button missing');
}
const oldIv = await ivField.inputValue();
await page.getByRole('button', { name: 'توليد IV جديد' }).click();
await page.waitForTimeout(200);
const newIv = await ivField.inputValue();
if (newIv === oldIv || newIv.length !== 32) throw new Error('IV regeneration failed');
console.log('Task 3: Step 3 key+IV integration and ECB indicator passed');

// 1 + 2) Encrypt then decrypt in-session and verify comparison pipeline & slider
await loadPreset('Tux');
const key = await keyInput.inputValue();
await ctaEncrypt.click();
await waitForBadge('مشفّرة');
await page.getByTestId('comparison-controls').waitFor({ state: 'visible' });

// Side-by-side in encrypt flow: before original, after encrypted
await page.getByRole('button', { name: 'جنباً إلى جنب', exact: true }).click();
await page.waitForTimeout(300);
await page.getByText('الصورة الأصلية', { exact: false }).first().waitFor({ state: 'visible' });
await page.getByText('الصورة المشفّرة', { exact: false }).first().waitFor({ state: 'visible' });

// Slider drag by pointer
await page.getByRole('button', { name: 'منزلق', exact: true }).click();
await page.waitForTimeout(300);
const sliderContainer = page.locator('[role="group"][aria-label*="مقارنة تفاعلية"]');
await sliderContainer.waitFor({ state: 'visible' });
const box = await sliderContainer.boundingBox();
if (!box) throw new Error('slider container has no box');
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(150);
const rangeValue = Number(
  await page.locator('input[type=range][aria-label*="خط المقارنة"]').inputValue(),
);
console.log('slider range after drag =', rangeValue);
if (!(rangeValue >= 0 && rangeValue <= 45)) {
  throw new Error(`Slider drag did not move handle as expected: ${rangeValue}`);
}
await page.screenshot({ path: path.join(SHOTS, 'slider-encrypt.png') });

// Decrypt in-session: reference should become encrypted frame, view restored
await ctaDecrypt.click();
await waitForBadge('مستعادة');
await page.waitForTimeout(350);

// Side-by-side in decrypt flow: before encrypted uploaded, after restored
await page.getByRole('button', { name: 'جنباً إلى جنب', exact: true }).click();
await page.waitForTimeout(300);
await page.getByText('المشفّرة المرفوعة', { exact: false }).first().waitFor({ state: 'visible' });
await page.getByText('الصورة المستعادة', { exact: false }).first().waitFor({ state: 'visible' });
await page.screenshot({ path: path.join(SHOTS, 'decrypt-side.png') });

// Quick toggle in decrypt flow should show encrypted (before) frame
await page.getByRole('button', { name: /قبل \/ بعد/ }).click();
await page.waitForTimeout(250);
await waitForBadge('المشفّرة المرفوعة');
await page.screenshot({ path: path.join(SHOTS, 'decrypt-toggle-before.png') });

console.log('Task 1+2: decrypt comparison pipeline and slider interactions passed');
console.log('console errors =', errors.length ? errors : 'none');
console.log('screenshots =', SHOTS);

await browser.close();
if (errors.length) process.exitCode = 1;
