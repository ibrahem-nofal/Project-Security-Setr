/**
 * Verification for the Phase 7–9 feedback fixes.
 * Run: node scripts/verifyFixes.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const BASE = process.argv[2] || 'http://127.0.0.1:5173/';
const SHOTS = path.join(os.tmpdir(), 'sitr-fixes');
await fs.mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const errors = [];
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

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

async function waitForNoAlert() {
  await page.waitForFunction(
    () => !document.querySelector('[role="alert"]'),
    undefined,
    { timeout: 10000 },
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

async function download(buttonTitle, filename) {
  const [event] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.getByTitle(buttonTitle).click(),
  ]);
  const target = path.join(SHOTS, filename);
  await event.saveAs(target);
  return target;
}

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.locator('h1').waitFor({ state: 'visible' });
await page.waitForTimeout(700);

/* ------------------------------------------------------------------ */
/* Task 3 — key input / copy icon alignment + IV in Step 3             */
/* ------------------------------------------------------------------ */
const keyBox = await keyInput.boundingBox();
const copyBox = await page.getByRole('button', { name: 'نسخ المفتاح' }).boundingBox();
const keyStyles = await keyInput.evaluate((node) => {
  const style = getComputedStyle(node);
  return {
    fontFamily: style.fontFamily,
    paddingRight: style.paddingRight,
    direction: style.direction,
  };
});
if (!keyStyles.fontFamily.includes('IBM Plex Mono')) throw new Error('key field is not font-mono');
if (Number.parseFloat(keyStyles.paddingRight) < 40) throw new Error('key field right padding too small');
if (keyStyles.direction !== 'ltr') throw new Error('key field must be LTR');
if (copyBox.x < keyBox.x + keyBox.width / 2) throw new Error('copy icon is on the text-start side');
if (copyBox.x + copyBox.width > keyBox.x + keyBox.width + 1) throw new Error('copy icon overflows field');
await sidebar.getByText('إدارة المفتاح والمعاملات', { exact: false }).waitFor({ state: 'visible' });
if (!(await page.locator('#iv-field').isVisible())) throw new Error('IV field missing in Step 3');
await sidebar.getByRole('button', { name: /ECB/ }).click();
await page.waitForTimeout(150);
await sidebar.getByText('نمط ECB لا يتطلب IV', { exact: false }).waitFor({ state: 'visible' });
await sidebar.getByRole('button', { name: /CBC/ }).click();
await page.waitForTimeout(150);
await sidebar.getByRole('button', { name: /ECB/ }).click();
await page.waitForTimeout(150);
console.log('Task 3: key alignment + Step 3 IV integration passed', {
  paddingRight: keyStyles.paddingRight,
  gap: Math.round(keyBox.x + keyBox.width - (copyBox.x + copyBox.width)),
});

/* ------------------------------------------------------------------ */
/* Task 2 — collapsible presets                                        */
/* ------------------------------------------------------------------ */
const showPresets = sidebar.getByRole('button', { name: 'إظهار', exact: true });
const presetGrid = page.locator('#preset-grid');
if (await presetGrid.isVisible().catch(() => false)) {
  throw new Error('preset grid should start collapsed by default');
}
await showPresets.click();
await page.waitForTimeout(250);
if (!(await presetGrid.isVisible())) throw new Error('preset grid did not expand');
const hidePresets = sidebar.getByRole('button', { name: 'إخفاء', exact: true });
await hidePresets.click();
await page.waitForTimeout(250);
if (await presetGrid.isVisible().catch(() => false)) throw new Error('preset grid did not collapse');
await showPresets.click();
await page.waitForTimeout(250);
console.log('Task 2: presets collapsed-by-default + expand/collapse passed');

/* ------------------------------------------------------------------ */
/* Task 1 — full workspace drag & drop                                 */
/* ------------------------------------------------------------------ */
await page.evaluate(async () => {
  const img = Array.from(document.querySelectorAll('img')).find((node) => /tux/i.test(node.src));
  const blob = await fetch(img.src).then((response) => response.blob());
  const file = new File([blob], 'drop-test.png', { type: 'image/png' });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  const zone = document.querySelector('[data-testid="workspace-dropzone"]');
  for (const type of ['dragenter', 'dragover', 'drop']) {
    zone.dispatchEvent(
      new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }),
    );
  }
});
await sidebar.getByText('drop-test').waitFor({ state: 'visible', timeout: 30000 });
await page.locator('canvas').waitFor({ state: 'visible', timeout: 30000 });
console.log('Task 1: workspace drag & drop passed');

/* ------------------------------------------------------------------ */
/* Task 4 — comparison controls                                        */
/* ------------------------------------------------------------------ */
const originalKey = await keyInput.inputValue();
await ctaEncrypt.click();
await waitForBadge('مشفّرة');
await page.getByTestId('comparison-controls').waitFor({ state: 'visible' });

await page.getByRole('button', { name: 'جنباً إلى جنب', exact: true }).click();
await page.waitForTimeout(350);
const sideCanvases = await page.locator('canvas').count();
if (sideCanvases < 2) throw new Error('side-by-side view did not render two canvases');
await page.screenshot({ path: path.join(SHOTS, 'comparison-side.png'), fullPage: false });

await page.getByRole('button', { name: 'منزلق', exact: true }).click();
await page.waitForTimeout(350);
const range = page.locator('input[type=range][aria-label*="المقارنة"]');
await range.waitFor({ state: 'visible' });
await range.evaluate((node) => {
  node.value = '30';
  node.dispatchEvent(new Event('input', { bubbles: true }));
  node.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(SHOTS, 'comparison-split-mode.png'), fullPage: false });

await page.getByRole('button', { name: 'قبل / بعد', exact: true }).click();
await page.waitForTimeout(250);
await waitForBadge('قبل التشفير');
await page.getByRole('button', { name: 'عرض بعد التشفير', exact: true }).click();
await page.waitForTimeout(250);
console.log('Task 4: comparison modes + quick toggle passed');
await page.screenshot({ path: path.join(SHOTS, 'comparison-split.png'), fullPage: true });

/* ------------------------------------------------------------------ */
/* Task 5a — .sitr ECB round-trip                                      */
/* ------------------------------------------------------------------ */
const sitrPath = await download('تنزيل حزمة .sitr', 'ecb-roundtrip.sitr');
const sitrBytes = await fs.readFile(sitrPath);
if (sitrBytes.subarray(0, 4).toString('ascii') !== 'SITR') throw new Error('bad .sitr magic');
if (sitrBytes[4] !== 1) throw new Error('bad .sitr version');
if (sitrBytes[5] !== 0) throw new Error('bad ECB mode code');

await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('h1').waitFor({ state: 'visible' });
await page.waitForTimeout(500);
await page.locator('input[type=file]').setInputFiles(sitrPath);
await waitForBadge('مشفّرة');
await keyInput.fill(originalKey);
await page.waitForTimeout(250);
await ctaDecrypt.click();
await waitForBadge('مستعادة');
await waitForNoAlert();
console.log('Task 5a: .sitr ECB export → reload → import → decrypt passed');

/* ------------------------------------------------------------------ */
/* Task 5b — encrypted PNG round-trip (ECB, manual decrypt)            */
/* ------------------------------------------------------------------ */
await ctaEncrypt.click();
await waitForBadge('مشفّرة');
const pngPath = await download('تنزيل معاينة PNG', 'ecb-cipher.png');
const pngBytes = await fs.readFile(pngPath);
if (pngBytes.subarray(1, 4).toString('ascii') !== 'PNG') throw new Error('bad PNG signature');

await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('h1').waitFor({ state: 'visible' });
await page.waitForTimeout(500);
await keyInput.fill(originalKey);
await page.waitForTimeout(250);
await page.locator('input[type=file]').setInputFiles(pngPath);
await waitForBadge('مشفّرة');
await sidebar.getByRole('button', { name: 'فك التشفير', exact: true }).click();
await page.waitForTimeout(150);
await ctaDecrypt.click();
await waitForBadge('مستعادة');
await waitForNoAlert();
console.log('Task 5b: encrypted PNG export → reload → import → manual decrypt passed');
/* ------------------------------------------------------------------ */
/* Task 5c — CBC .sitr carries mode + IV                               */
/* ------------------------------------------------------------------ */
await sidebar.getByRole('button', { name: /CBC/ }).click();
await loadPreset('Alice');
const ivValue = await page.locator('#iv-field').inputValue();
const cbcKey = await keyInput.inputValue();
await ctaEncrypt.click();
await waitForBadge('مشفّرة');
const cbcPath = await download('تنزيل حزمة .sitr', 'cbc-roundtrip.sitr');
const cbcBytes = await fs.readFile(cbcPath);
if (cbcBytes[5] !== 1) throw new Error('bad CBC mode code');

await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('h1').waitFor({ state: 'visible' });
await page.waitForTimeout(500);
await page.locator('input[type=file]').setInputFiles(cbcPath);
await waitForBadge('مشفّرة');
if ((await sidebar.getByRole('button', { name: /CBC/ }).getAttribute('aria-pressed')) !== 'true') {
  throw new Error('CBC mode was not restored from the .sitr header');
}
const restoredIv = await page.locator('#iv-field').inputValue();
if (restoredIv !== ivValue) throw new Error('IV was not restored from the .sitr header');
await keyInput.fill(cbcKey);
await page.waitForTimeout(250);
await ctaDecrypt.click();
await waitForBadge('مستعادة');
await waitForNoAlert();
console.log('Task 5c: CBC .sitr auto-restores mode + IV and decrypts passed');

/* ------------------------------------------------------------------ */
/* Task 5d — encrypted PNG round-trip for CBC and CTR (manual decrypt) */
/* ------------------------------------------------------------------ */
for (const modeName of ['CBC', 'CTR']) {
  await sidebar.getByRole('button', { name: new RegExp(modeName) }).click();
  await loadPreset('Tux');
  const modeIv = await page.locator('#iv-field').inputValue();
  const modeKey = await keyInput.inputValue();
  await ctaEncrypt.click();
  await waitForBadge('مشفّرة');
  const modePng = await download('تنزيل معاينة PNG', `${modeName.toLowerCase()}-cipher.png`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('h1').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  await sidebar.getByRole('button', { name: 'فك التشفير', exact: true }).click();
  await page.waitForTimeout(150);
  await sidebar.getByRole('button', { name: new RegExp(modeName) }).click();
  await page.waitForTimeout(200);
  await page.locator('#iv-field').fill(modeIv);
  await keyInput.fill(modeKey);
  await page.waitForTimeout(250);
  await page.locator('input[type=file]').setInputFiles(modePng);
  await waitForBadge('مشفّرة');
  await ctaDecrypt.click();
  await waitForBadge('مستعادة');
  await waitForNoAlert();
  console.log(`Task 5d: encrypted PNG ${modeName} round-trip (manual decrypt) passed`);
}

await page.screenshot({ path: path.join(SHOTS, 'final.png'), fullPage: true });
console.log('console errors =', errors.length ? errors : 'none');
console.log('screenshots =', SHOTS);
await browser.close();
if (errors.length) process.exitCode = 1;
