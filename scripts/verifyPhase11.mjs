import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const BASE = process.argv[2] || 'http://127.0.0.1:5173/';
const SHOTS = path.join(os.tmpdir(), 'sitr-phase11');
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
const ivField = page.locator('#iv-field');
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
  await page.waitForTimeout(350);
}

async function canvasHash() {
  return page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    const ctx = c.getContext('2d');
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < data.length; i++) {
      h ^= data[i];
      h = Math.imul(h, 16777619);
    }
    return `${width}x${height}:${(h >>> 0).toString(16)}`;
  });
}

async function currentOperation() {
  return page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const enc = btns.find((b) => b.textContent?.includes('تشفير') && !b.textContent?.includes('الصورة'));
    const dec = btns.find((b) => b.textContent?.includes('فك التشفير'));
    if (enc?.getAttribute('aria-pressed') === 'true') return 'encrypt';
    if (dec?.getAttribute('aria-pressed') === 'true') return 'decrypt';
    return null;
  });
}

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.locator('h1').waitFor({ state: 'visible' });
await page.waitForTimeout(700);

// --- 1) IV auto-generation on init + mode switch lifecycle ---
// Default mode is ECB (IV input replaced by indicator); IV state is still initialized.
// Switching to CBC must reveal a populated, valid 32-hex IV.
await sidebar.getByRole('button', { name: /CBC/ }).click();
await page.waitForTimeout(250);
const ivCbc = await ivField.inputValue();
if (!/^[0-9a-f]{32}$/i.test(ivCbc)) {
  throw new Error(`IV not populated on CBC (from init): "${ivCbc}"`);
}

await sidebar.getByRole('button', { name: /CTR/ }).click();
await page.waitForTimeout(200);
const ivCtr = await ivField.inputValue();
if (!/^[0-9a-f]{32}$/i.test(ivCtr) || ivCtr === ivCbc) {
  throw new Error(`CTR switch did not generate fresh IV: cbc=${ivCbc} ctr=${ivCtr}`);
}

await sidebar.getByRole('button', { name: /ECB/ }).click();
await page.waitForTimeout(150);
await page.getByText('نمط ECB لا يتطلب IV', { exact: false }).first().waitFor({ state: 'visible' });

await sidebar.getByRole('button', { name: /CBC/ }).click();
await page.waitForTimeout(200);
const ivCbc2 = await ivField.inputValue();
if (!/^[0-9a-f]{32}$/i.test(ivCbc2) || ivCbc2 === ivCtr) {
  throw new Error(`ECB->CBC did not generate fresh IV: ctr=${ivCtr} cbc2=${ivCbc2}`);
}

// "توليد IV جديد" button
await page.getByRole('button', { name: 'توليد IV جديد' }).click();
await page.waitForTimeout(200);
const ivRefreshed = await ivField.inputValue();
if (!/^[0-9a-f]{32}$/i.test(ivRefreshed) || ivRefreshed === ivCbc2) {
  throw new Error(`Refresh IV button failed: before=${ivCbc2} after=${ivRefreshed}`);
}
console.log('IV lifecycle: init + mode switches + refresh button passed');

// --- 2) ECB encrypt/decrypt round-trip (100% restore) ---
await sidebar.getByRole('button', { name: /ECB/ }).click();
await loadPreset('Tux');
await page.waitForTimeout(250);
const origEcb = await canvasHash();
await ctaEncrypt.click();
await waitForBadge('مشفّرة');
await ctaDecrypt.click();
await waitForBadge('مستعادة');
await page.waitForTimeout(250);
const restoredEcb = await canvasHash();
if (origEcb !== restoredEcb) throw new Error(`ECB round-trip mismatch: ${origEcb} vs ${restoredEcb}`);
console.log('ECB round-trip restore 100% passed');

// --- 3) CBC encrypt/decrypt round-trip ---
await sidebar.getByRole('button', { name: /CBC/ }).click();
await loadPreset('Alice');
await page.waitForTimeout(250);
const ivUsedCbc = await ivField.inputValue();
const keyCbc = await keyInput.inputValue();
const origCbc = await canvasHash();
await ctaEncrypt.click();
await waitForBadge('مشفّرة');
await ctaDecrypt.click();
await waitForBadge('مستعادة');
await page.waitForTimeout(250);
const restoredCbc = await canvasHash();
if (origCbc !== restoredCbc) throw new Error(`CBC round-trip mismatch: ${origCbc} vs ${restoredCbc}`);
console.log('CBC round-trip restore 100% passed');

// --- 4) CTR encrypt/decrypt round-trip ---
await sidebar.getByRole('button', { name: /CTR/ }).click();
await loadPreset('شبكة');
await page.waitForTimeout(250);
const origCtr = await canvasHash();
await ctaEncrypt.click();
await waitForBadge('مشفّرة');
await ctaDecrypt.click();
await waitForBadge('مستعادة');
await page.waitForTimeout(250);
const restoredCtr = await canvasHash();
if (origCtr !== restoredCtr) throw new Error(`CTR round-trip mismatch: ${origCtr} vs ${restoredCtr}`);
console.log('CTR round-trip restore 100% passed');

// --- 5) Decrypt from current image pixels (Path B) + missing IV feedback ---
// Create encrypted PNG in CBC, reload, load it as normal source, decrypt via CTA
await sidebar.getByRole('button', { name: /CBC/ }).click();
await loadPreset('Tux');
const ivPathB = await ivField.inputValue();
const keyPathB = await keyInput.inputValue();
await ctaEncrypt.click();
await waitForBadge('مشفّرة');
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.getByTitle('تنزيل معاينة PNG').click(),
]);
const encPath = path.join(SHOTS, 'uploaded-source.png'); // neutral name so probe won't auto-treat as encrypted
await download.saveAs(encPath);

await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('h1').waitFor({ state: 'visible' });
await page.waitForTimeout(600);

// Load as normal image (probe won't trigger because not in decrypt op and name doesn't look encrypted)
await page.locator('input[type=file]').setInputFiles(encPath);
await page.locator('canvas').waitFor({ state: 'visible', timeout: 30000 });
await waitForBadge('أصلية');
await page.waitForTimeout(300);

// Switch to decrypt mode, set correct mode/key but clear IV -> should show inline/toast error
await sidebar.getByRole('button', { name: 'فك التشفير', exact: true }).click();
await page.waitForTimeout(150);
await sidebar.getByRole('button', { name: /CBC/ }).click();
await page.waitForTimeout(150);
await keyInput.fill(keyPathB);
await ivField.fill('');
await page.waitForTimeout(150);
await ctaDecrypt.click();
await page.waitForTimeout(600);
let alertText = await page.getByRole('alert').first().innerText().catch(() => '');
if (!/المفتاح أو متجه التهيئة IV غير صحيح لهذا النمط|متجه التهيئة/.test(alertText)) {
  throw new Error(`Missing IV did not show expected error: "${alertText}"`);
}
console.log('Missing CBC/CTR IV shows inline error instead of silent failure:', alertText);

// Now provide correct IV and decrypt current pixels (Path B)
await ivField.fill(ivPathB);
await page.waitForTimeout(150);
await ctaDecrypt.click();
await waitForBadge('مستعادة');
await page.waitForTimeout(350);
const opAfter = await currentOperation();
console.log('Path B decrypt from current image pixels passed, operation=', opAfter);
await page.screenshot({ path: path.join(SHOTS, 'pathb-restored.png') });

// --- 6) Wrong key feedback text ---
await sidebar.getByRole('button', { name: /ECB/ }).click();
await loadPreset('Alice');
await ctaEncrypt.click();
await waitForBadge('مشفّرة');
await sidebar.getByRole('button', { name: 'توليد', exact: true }).click();
await page.waitForTimeout(200);
await ctaDecrypt.click();
await page.waitForTimeout(1200);
alertText = await page.getByRole('alert').first().innerText().catch(() => '');
if (!/المفتاح أو متجه التهيئة IV غير صحيح لهذا النمط/.test(alertText)) {
  throw new Error(`Wrong-key feedback mismatch: "${alertText}"`);
}
console.log('Wrong key/IV feedback message passed');

await page.screenshot({ path: path.join(SHOTS, 'final.png'), fullPage: true });
console.log('console errors =', errors.length ? errors : 'none');
console.log('screenshots =', SHOTS);
await browser.close();
if (errors.length) process.exitCode = 1;
