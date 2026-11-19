import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const BASE = process.argv[2] || 'http://localhost:5173/';
const SHOTS = path.join(os.tmpdir(), 'sitr-verify');
await fs.mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const errors = [];
const external = [];
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('request', (request) => {
  const url = request.url();
  if (!/^(https?|ws):/.test(url)) return;
  const { hostname } = new URL(url);
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') external.push(url);
});

function u32(value) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function sitrBuffer({ magic = [...Buffer.from('SITR')], width, height, cipher, nameLength = 0 }) {
  const header = Buffer.from([
    ...magic,
    1, // version
    0, // ECB
    1, // 256-bit
    0,
    ...u32(width),
    ...u32(height),
    ...new Array(16).fill(0x2a),
    (nameLength >>> 8) & 0xff,
    nameLength & 0xff,
    ...u32(cipher.length),
  ]);
  return Buffer.concat([header, cipher, Buffer.alloc(nameLength)]);
}

const badMagic = path.join(SHOTS, 'edge-bad-magic.sitr');
await fs.writeFile(badMagic, sitrBuffer({ magic: [...Buffer.from('NOPE')], width: 2, height: 2, cipher: Buffer.alloc(48) }));

const absurdDims = path.join(SHOTS, 'edge-absurd-dims.sitr');
await fs.writeFile(absurdDims, sitrBuffer({ width: 20000, height: 20000, cipher: Buffer.alloc(32) }));

const truncated = path.join(SHOTS, 'edge-truncated.sitr');
await fs.writeFile(truncated, sitrBuffer({ width: 2, height: 2, cipher: Buffer.alloc(48) }).subarray(0, 50));

const tinyPng = path.join(SHOTS, 'edge-1x1.png');
await fs.writeFile(
  tinyPng,
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
);

async function waitForAlert(fragment, timeout = 12000) {
  await page.waitForFunction(
    (text) =>
      Array.from(document.querySelectorAll('[role="alert"]')).some((node) =>
        node.textContent.includes(text),
      ),
    fragment,
    { timeout },
  );
  return page.locator('[role="alert"]').first().innerText();
}

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

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.locator('h1').waitFor({ state: 'visible' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

const fontReport = await page.evaluate(() => {
  const faces = Array.from(document.fonts).map((face) => ({
    family: face.family.replace(/["']/g, ''),
    weight: face.weight,
    status: face.status,
  }));
  return {
    faces,
    sansReady: document.fonts.check('16px "IBM Plex Sans Arabic"'),
    monoReady: document.fonts.check('16px "IBM Plex Mono"'),
    googleLink: Boolean(document.querySelector('link[href*="fonts.googleapis"]')),
  };
});
console.log('font faces =', fontReport.faces.filter((face) => face.status === 'loaded').length);
console.log('arabic loaded =', fontReport.sansReady, '| mono loaded =', fontReport.monoReady);
console.log('google fonts link =', fontReport.googleLink);
console.log('external requests =', external.length ? external : 'none');

const fileInput = page.locator('input[type=file]');

await fileInput.setInputFiles(badMagic);
console.log('bad magic ->', await waitForAlert('غير صالح'));
await page.screenshot({ path: path.join(SHOTS, '30-edge-bad-magic.png'), fullPage: true });

await fileInput.setInputFiles(absurdDims);
console.log('absurd dims ->', await waitForAlert('غير صالح'));

await fileInput.setInputFiles(truncated);
console.log('truncated ->', await waitForAlert('غير مكتملة'));

// Recover with a real 1×1 image and complete a full cycle.
await fileInput.setInputFiles(tinyPng);
await page.locator('canvas').waitFor({ state: 'visible', timeout: 30000 });
await page.waitForTimeout(600);
const dims = await page.locator('aside').innerText();
console.log('1x1 loaded =', dims.includes('1 × 1'));

const encryptCta = page.getByRole('button', { name: 'تشفير الصورة', exact: true });
const decryptCta = page.getByRole('button', { name: 'فك تشفير الصورة', exact: true });

await encryptCta.click();
await waitForBadge('مشفّرة');
await decryptCta.click();
await waitForBadge('مستعادة');
console.log('1x1 round-trip passed');

// Re-encrypt the restored pixels directly from the encrypt CTA.
await encryptCta.click();
await waitForBadge('مشفّرة');
console.log('re-encrypt after restore passed');

await page.getByTitle('استعادة الصورة الأصلية').click();
await waitForBadge('أصلية');
console.log('reset passed');

// Reset on an imported package should return to its ciphertext snapshot.
await encryptCta.click();
await waitForBadge('مشفّرة');
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.getByTitle('تنزيل حزمة .sitr').click(),
]);
const packagePath = path.join(SHOTS, 'edge-roundtrip.sitr');
await download.saveAs(packagePath);
const exportedKey = await page.locator('#key-hex').inputValue();
await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('h1').waitFor();
await fileInput.setInputFiles(packagePath);
await waitForBadge('مشفّرة');
await page.locator('#key-hex').fill(exportedKey);
await page.waitForTimeout(200);
await decryptCta.click();
await waitForBadge('مستعادة');
await page.getByTitle('استعادة الصورة الأصلية').click();
await waitForBadge('مشفّرة');
console.log('imported package reset-to-ciphertext passed');

await page.screenshot({ path: path.join(SHOTS, '31-edge-recovered.png'), fullPage: true });
console.log('errors =', errors);
console.log('external requests after load =', external.length ? external : 'none');

await browser.close();
