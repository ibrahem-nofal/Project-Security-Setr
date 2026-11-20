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

---

## Phase Log

| Phase | Status | Notes |
| ----- | ------ | ----- |
| 1 | Complete | React 19 + Vite + Tailwind v4 installed · folder structure (`src/components`, `src/lib`, `src/workers`, `src/assets/presets`) · Tux + Alice presets embedded · Vite/HTML shell ready |
| 2 | Complete | Tailwind v4 `@theme` tokens: porcelain / signal / inkstone / muted / cloud, radii 16/36/99, IBM Plex Arabic + Mono, checker & blueprint utilities, RTL focus states |
| 3 | Complete | Sidebar with operation switch, 3 numbered steps (ECB/CBC/CTR + IV, image drop + presets, key panel with generate/PBKDF2), CTA, toasts, validation messaging |
| 4 | Complete | Canvas stage, drag/drop + presets (Tux, Alice, pattern), 1200px safe rasterization on white, RGB extraction, ciphertext preview, entropy metrics, live insight card |
| 5 | Complete | Pure FIPS-197 AES-128/256 engine (ECB/CBC/CTR), PKCS#7, metadata header auth, Web Worker + progress, FIPS/NIST tests pass |
| 6 | Complete | Self-hosted IBM Plex fonts (zero external requests), locked controls during worker jobs, `.sitr` dimension/payload consistency checks, worker error recovery, larger readable type, verified at 320/390/900/1440px with full E2E + edge suites and production preview |
| 7 | Complete | Whole workspace is a dropzone with Signal Violet dashed highlight; presets card collapses; hex key field uses physical `pr-12` padding so the copy icon never covers the first characters |
| 8 | Complete | Workspace header comparison control: single / side-by-side / split slider + press-to-compare quick toggle, all fed by the retained original ImageData |
| 9 | Complete | `.sitr` v1 = `SITR` + version + mode + 16-byte IV + ciphertext; ciphertext (including payload header) is mapped to fully opaque RGB pixels so encrypted PNG files re-import and decrypt losslessly; PNG import probes current mode/key/IV and falls back to normal source loading |

---

## Phase 7–9 — Feedback Fixes

| # | Requirement | Status | Implementation |
| - | ----------- | ------ | -------------- |
| 1 | Full workspace drag & drop | Complete | `CanvasStage` owns `dragenter/dragover/dragleave/drop` on the whole preview shell; highlight = `#594ff4` dashed border + `signal-soft` tint + drop overlay; dropped files go straight to `App.handleFile` |
| 2 | Collapsible presets | Complete | `ImagePanel` adds an accessible collapse toggle (`aria-expanded`) with `ChevronUp/Down`; collapsed state hides the Tux/Alice/Pattern grid |
| 3 | Key copy icon overlap | Complete | `KeyPanel` hex input is forced LTR + `font-mono`, uses physical `pl-3 pr-12`, copy action is `absolute right-1.5 z-10` so it sits outside the 64-char text boundary |
| 4 | Original vs encrypted comparison | Complete | New `ImageComparison.jsx` + header segmented control: `معاينة` / `جنباً إلى جنب` / `منزلق` and a quick `قبل / بعد` toggle; original ImageData is retained in `reference` state |
| 5 | `.png` / `.sitr` decryption pipeline | Complete | New `cryptoPipeline.js`; `.sitr` header exactly `SITR`+`0x01`+mode+16-byte IV+payload; ciphertext rendered into opaque RGB; `decryptImageFromPixels()` scans the decrypted stream for the authenticated payload header; PNG import auto-detects and decrypts |

**Round-trip verification (Phase 9)**
- Encrypt → `.sitr` export → reload → import → mode/IV auto-filled → paste key → decrypt: passes.
- Encrypt → encrypted `.png` export → reload → import → current mode/key/IV → auto-decrypt: passes.
- Alpha is forced to `255` in `bytesToImageData()` and canvas contexts use `colorSpace: 'srgb'`, preventing premultiplication from altering ciphertext bytes.

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