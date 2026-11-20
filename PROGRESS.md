# PROGRESS — سِتر (Sitr) Image Cryptography

**Project:** Production-ready React + Vite + Tailwind image cryptography lab (AES-ECB / CBC / CTR)
**Location:** `D:\Security Project`
**Design language:** Porcelain `#ffffff` · Signal Violet `#594ff4` · Inkstone `#1f1f1f` · Slate `#5d5d5d` · Cloud `#f6f6f6` · RTL Arabic

---

## Phase Roadmap

- [x] Phase 1: Project Initialization & Directory Setup (`D:\Security Project`)
- [x] Phase 2: Design System Token Configuration (CSS Variables & Tailwind setup)
- [x] Phase 3: Control Sidebar & Control State Management (Mode, Key, Image presets)
- [x] Phase 4: Image Canvas & Raw Pixel Processing Pipeline
- [x] Phase 5: Client-side AES Engine Implementation (ECB, CBC, CTR Modes)
- [x] Phase 6: Edge-case Handling, UI Polish & RTL Alignment Verification
- [x] Phase 7: Workspace Dropzone, Collapsible Presets, Key Field Alignment
- [x] Phase 8: Image Comparison View (Side-by-Side + Split Slider + Quick Toggle)
- [x] Phase 9: Unified `.sitr` v1 Header + Lossless PNG Cipher Round-Trip
- [x] Phase 10: Decrypt Compare Pipeline, Slider UX, Step 3 IV Integration, Preset Library
- [x] Phase 11: IV Auto-Generation Lifecycle & Decryption Engine/Pipeline Restoration
- [x] Phase 12: Manual Decrypt-on-Demand & Lossless Pixel/Export Integrity

---

## Phase Log

| Phase | Status | Notes |
| ----- | ------ | ----- |
| 1 | Complete | React 19 + Vite + Tailwind v4 installed · folder structure (`src/components`, `src/lib`, `src/workers`, `src/assets/presets`) · Tux + Alice presets embedded · Vite/HTML shell ready |
| 2 | Complete | Tailwind v4 `@theme` tokens: porcelain / signal / inkstone / muted / cloud, radii 16/36/99, IBM Plex Arabic + Mono, checker & blueprint utilities, RTL focus states |
| 3 | Complete | Sidebar with operation switch, 3 numbered steps (mode, image/presets, key & parameters), CTA, toasts, validation messaging |
| 4 | Complete | Canvas stage, drag/drop + presets, 1200px safe rasterization on white, RGB extraction, ciphertext preview, entropy metrics, live insight card |
| 5 | Complete | Pure FIPS-197 AES-128/256 engine (ECB/CBC/CTR), PKCS#7, metadata header auth, Web Worker + progress, FIPS/NIST tests pass |
| 6 | Complete | Self-hosted IBM Plex fonts (zero external requests), locked controls during worker jobs, `.sitr` dimension/payload consistency checks, worker error recovery, larger readable type, verified at 320/390/900/1440px with full E2E + edge suites and production preview |
| 7 | Complete | Whole workspace is a dropzone with Signal Violet dashed highlight; presets card collapses; hex key field uses physical `pr-12` padding so the copy icon never covers the first characters |
| 8 | Complete | Workspace header comparison control: single / side-by-side / split slider + press-to-compare quick toggle, all fed by the retained original ImageData |
| 9 | Complete | `.sitr` v1 = `SITR` + version + mode + 16-byte IV + ciphertext; ciphertext (including payload header) is mapped to fully opaque RGB pixels so encrypted PNG files re-import and decrypt losslessly; PNG import probes current mode/key/IV and falls back to normal source loading |
| 10 | Complete | Decrypt comparison now uses encrypted-input vs restored-output; slider refactored to pointer drag with `getBoundingClientRect`; IV moved into Step 3 with generate/copy (ECB indicator); presets collapsed by default and expanded to 5 crypto test images |
| 11 | Complete | CBC/CTR IV is auto-generated on init and on every CBC/CTR mode switch with explicit “توليد IV جديد” control; decrypt CTA/pipeline restored for imported packages and current-canvas pixels with strict IV/key validation, inline/toast feedback, and opaque RGB output |
| 12 | Complete | Encrypted-image drops no longer auto-decrypt: `.sitr`/encrypted PNGs load as input preview and require explicit “فك تشفير الصورة”; output/restored state is cleared on new loads. Canvas contexts disable smoothing, RGB/alpha integrity preserved (opaque alpha 255), and exports remain strictly lossless PNG/`.sitr` |

---

## Phase 7–9 — Feedback Fixes

| # | Requirement | Status | Implementation |
| - | ----------- | ------ | -------------- |
| 1 | Full workspace drag & drop | Complete | `CanvasStage` owns `dragenter/dragover/dragleave/drop` on the whole preview shell; highlight = `#594ff4` dashed border + `signal-soft` tint + drop overlay; dropped files go straight to `App.handleFile` |
| 2 | Collapsible presets | Complete | `ImagePanel` adds an accessible collapse toggle (`aria-expanded`) with `ChevronUp/Down`; collapsed state hides the preset grid |
| 3 | Key copy icon overlap | Complete | `KeyPanel` hex input is forced LTR + `font-mono`, uses physical `pl-3 pr-12`, copy action is `absolute right-1.5 z-10` so it sits outside the 64-char text boundary |
| 4 | Original vs encrypted comparison | Complete | New `ImageComparison.jsx` + header segmented control: `معاينة` / `جنباً إلى جنب` / `منزلق` and a quick `قبل / بعد` toggle; comparison frames retained in `reference` state |
| 5 | `.png` / `.sitr` decryption pipeline | Complete | New `cryptoPipeline.js`; `.sitr` header exactly `SITR`+`0x01`+mode+16-byte IV+payload; ciphertext rendered into opaque RGB; `decryptImageFromPixels()` scans the decrypted stream for the authenticated payload header; PNG import auto-detects and decrypts |

**Round-trip verification (Phase 9)**
- Encrypt → `.sitr` export → reload → import → mode/IV auto-filled → paste key → decrypt: passes.
- Encrypt → encrypted `.png` export → reload → import → current mode/key/IV → auto-decrypt: passes.
- Alpha is forced to `255` in `bytesToImageData()` and canvas contexts use `colorSpace: 'srgb'`, preventing premultiplication from altering ciphertext bytes.

---

## Phase 10 — Critical UX & State Fixes

| # | Requirement | Status | Implementation |
| - | ----------- | ------ | -------------- |
| 1 | Decryption comparison pipeline | Complete | `App.jsx`: `.sitr` import and decrypted-PNG import keep the encrypted frame as `reference` (Before) and set restored output as `view` kind `decrypted` (After). `ImageComparison` labels/sides switch by `view.kind`: encrypt flow = plaintext→ciphertext, decrypt flow = ciphertext→plaintext across single toggle, side-by-side, and slider |
| 2 | Comparison slider controls & layout | Complete | `ImageComparison.jsx` refactored to pointer events (`pointerdown/move/up/cancel`) with `getBoundingClientRect()` positioning, `touchAction: 'none'`, `select-none`, `overflow-hidden`, and matched `object-contain` layers so the divider/handle drags smoothly and stays aligned responsively |
| 3 | IV integrated into Step 3 | Complete | `ModeSelector` reduced to mode selection; `KeyPanel`/`Sidebar` Step 3 now contains key hex + IV together. CBC/CTR show 32-hex IV input with generate and copy actions; ECB shows a subtle “نمط ECB لا يتطلب IV” indicator |
| 4 | Presets collapsed by default + expanded set | Complete | `ImagePanel` defaults `isPresetsOpen=false`; `presets.js` now provides 5 presets — Tux, Alice, Geometric Grid (`grid.svg`), Color Gradient (`gradient.svg`), Document Text (`document.svg`) |

**Verification targets (Phase 10)**
- Decrypt mode: imported/encrypted input appears as Before (المشفّرة المرفوعة) and restored result as After (المستعادة) in side-by-side, slider, and quick toggle.
- Slider divider responds to mouse/touch drag and range input without displacement.
- Step 3 shows Hex key and Hex IV stacked with copy/generate controls; ECB displays non-IV note.
- Presets panel starts collapsed and exposes 5 distinct crypto-testing samples when expanded.

---

## Phase 11 — IV Lifecycle & Decryption Restoration

| # | Requirement | Status | Implementation |
| - | ----------- | ------ | -------------- |
| 1 | IV auto-generation & state lifecycle | Complete | `App.jsx` initializes a secure 16-byte hex IV on load and regenerates a fresh IV on every switch to CBC/CTR; `KeyPanel.jsx` Step 3 keeps IV input with **توليد IV جديد** and copy controls; ECB shows “نمط ECB لا يتطلب IV”. IV/key state is validated before encrypt/decrypt triggers |
| 2 | Decrypt engine & render pipeline | Complete | `App.jsx` `handleDecrypt` supports package decrypt (`.sitr`/probed cipher) and current-canvas pixel decrypt (`decrypt-pixels`) using valid Uint8Array key/IV; missing/invalid CBC/CTR IV or bad key/params show inline alert + toast (“المفتاح أو متجه التهيئة IV غير صحيح لهذا النمط”); try/catch prevents canvas corruption and updates restored output immediately. RGB-only ciphertext mapping with alpha forced to 255 preserves opaque restored pixels |

**Verification targets (Phase 11)**
- App start and CBC/CTR mode switches always yield a populated 32-hex IV.
- “فك تشفير الصورة” decrypts stored packages and current encrypted image pixels for ECB/CBC/CTR when key/IV match, restoring the image in the output canvas.
- Invalid/missing CBC/CTR IV or wrong key shows the specified notification without breaking the canvas.

---

## Phase 12 — Manual Decrypt Trigger & Pixel/Export Integrity

| # | Requirement | Status | Implementation |
| - | ----------- | ------ | -------------- |
| 1 | Prevent auto-decryption on file drop | Complete | `App.jsx` `handleFile`: dropping/loading encrypted PNGs in decrypt context (or encrypted-named PNGs) now loads pixels **losslessly** as encrypted input preview via `loadEncryptedInputPng` (no `decrypt-pixels` run) and notifies user to click **«فك تشفير الصورة»**. `.sitr` import remains manual. New drops clear restored/output state (`cipher`/restored view reset), and `handleDecrypt` Path B/Path A execute only on explicit CTA |
| 2 | Pixel fidelity / no alpha corruption | Complete | Lossless encrypted-input path uses `loadImagePixelsFromFile` (no downscale, no white flatten, `imageSmoothingEnabled=false`); RGB-only byte mapping with enforced opaque alpha (`bytesToImageData` / render paths keep `A=255`) prevents canvas premultiplication damage. 2D contexts for rendering/export set `imageSmoothingEnabled=false` in `imagePipeline.imageDataToCanvas` and `ImageComparison` `putImageData` canvases |
| 3 | Lossless export guarantee | Complete | Encrypted/plain previews export via `canvasToBlob(...,'image/png')` only; cipher packages download as `.sitr` (`createCipherFile`/`downloadBlob`). Upload accepts `image/png,image/jpeg,image/webp,.sitr` as sources but no JPG/JPEG export path exists for encrypted outputs |

**Verification targets (Phase 12)**
- Dropping an encrypted image shows input preview and waits for “فك تشفير الصورة” (no immediate decrypt).
- Encrypt→decrypt round-trips retain full fidelity with no transparent/black corrupted pixels (opaque alpha).
- Exports for encrypted/image results are lossless (`.png` / `.sitr`) only.

---

## Phase 6 — Verification Log

**Automated checks**
- `npm run test:crypto` → FIPS-197 block vectors, NIST SP 800-38A CTR vectors, ECB/CBC/CTR round-trips, wrong-key auth rejection, ECB pattern retention.
- `node scripts/verifyUi.mjs` → desktop E2E: Tux ECB encrypt/decrypt, `.sitr` export → reload → import → decrypt, Alice CBC, wrong-key error, CTR, PBKDF2 derivation; mobile 390px flow.
- `node scripts/verifyExtra.mjs` → real file upload, AES-128 key switch + auto-align on decrypt, reset, tablet 900px, 320px overflow check.
- `node scripts/verifyEdge.mjs` → malformed/truncated/absurd-dimension `.sitr` rejection, 1×1 image round-trip, re-encrypt after restore, imported-package reset, font loading, zero external requests. Run against both dev (`:5173`) and production preview (`:4173`).

**Measured results**
- Horizontal overflow: `0px` at 320, 390, 900 and 1440 widths; `html dir="rtl"`.
- Console/page errors: none; external network requests after load: none (fonts bundled as woff2, 9 files).
- Design tokens: porcelain / Signal Violet CTAs and active pills / Inkstone / Slate / Cloud; radii 16/36/99; pill CTAs.
- Production build: `vite build` succeeds, 2143 modules, CSS ≈ 38 kB, JS ≈ 288 kB (≈ 89 kB gzip), AES worker chunk separate.