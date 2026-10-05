# Performance work: progress log

Backup of the project before any change (excludes node_modules and .next, includes .git):
`C:\Users\agarw\Desktop\project-backup-1791148611`

State found at the start (2026-10-05): an earlier, unlogged session had already converted
lab/lander to WebP (1920-px sizing), split `PRELOAD` into `critical`/`deferred`, and added
`scripts/check-assets.mjs` + `npm run check:assets`. Also, the files in `design-src/unused-assets/`
from commit 635a46b were **missing from disk** (git shows them as staged deletions); they are
still in HEAD. They were not restored here (no git commands allowed).
Restore with `git checkout HEAD -- design-src/unused-assets`.

Measuring: `first-load JS` = every script the prerendered `/` HTML loads, raw and gzip -9.
The build is Turbopack (Next 16 default); `@next/bundle-analyzer` only works with webpack, so
module sizes come from a one-off `next build --webpack` with the analyzer (installed with
`--no-save`, config restored afterwards).

| Phase | Status | Notes |
|---|---|---|
| 0 Baseline | DONE | |
| 1 Heavy PNGs | DONE | |
| 2 Unused assets | DONE | nothing left to move; checker hardened |
| 3 Tiered preload | DONE | loader waits on 1.30 MB instead of 2.75 MB |
| 4 Code-splitting | DONE | page chunk 395.9 → 291.7 KB raw (108.3 → 90.1 KB gz) |
| 5 Images | DONE | 69 × decoding=async, 17 lazy, 22 sized |
| 6 Low-power mode | DONE | static + runtime detection; WebKit tour now passes |
| 7 Caching headers | DONE | /assets/* cached 7 d + 1 d SWR |
| 8 Resilience | DONE | error boundaries, Google flow, storage, chunk failures |
| 9 Smoke test | DONE | 6/6 pass (desktop Chrome, Pixel 5, iPhone 13) |
| 10 Lighthouse | DONE | after-only: perf 38, LCP 20.5 s (loader-gated), CLS 0.001 |

## Phase 0: baseline: DONE

First-load JS for `/` (Turbopack production build, 8 scripts): **948.8 KB raw / 277.1 KB gzip**

| chunk | raw | gzip | contents |
|---|---|---|---|
| 35fh86lvss9v9.js (page chunk) | 395.9 KB | 108.3 KB | Innovision + every view + GSAP |
| 1rj7ns8rte9vc.js | 223.8 KB | 69.8 KB | react-dom |
| 20pkwklkbp1q4.js | 179.0 KB | 47.2 KB | next runtime |
| 0cz1d0mv5g_q7.js | 110.0 KB | 38.6 KB | next/react runtime |
| 4 small chunks | 40.1 KB | 13.2 KB | |
| (lazy) 3tclb1hy04vmb.js | 35.5 KB | 9.3 KB | howler, already lazy |

The page chunk is 395.9 KB here vs. the known 405 KB / 110 KB baseline; the tree already
had some uncommitted edits.

Module sizes (webpack analyzer, parsed / gzip): AuthOverlay 71.3 / 16.2 KB, Innovision 44.9 / 10.2,
DetailView 38.1 / 8.6, HomeView 30.1 / 6.8, ScheduleView 11.2 / 2.5, Rover 10.9 / 2.5,
BagPanel 5.3 / 1.2, MerchView 5.2 / 1.2, GalleryView 4.1 / 0.9, MenuOverlay 2.4 / 0.5.

public/assets: 40 files, **10.53 MB** (it was **13.93 MB** with the original lab.png 2.02 MB and
lander.png 1.67 MB). Files over 500 KB: the four songs (1.4–2.1 MB each, streamed on demand, not preloaded).

Preload weight: critical (loader waits) 9 files **1300.0 KB**; deferred 18 files 1513.8 KB.
Before the earlier split, the loader waited on all 27 files (2.75 MB).

## Phase 1: heavy PNGs: DONE

How they render (DetailView, Flagship scene foreground):
- lab: `width: 24%` of a `max(124vw,170vh)` box → 762 CSS px at 2560×1440 → 2x = 1524 px wide.
- lander: `height: 32vh` → 461 CSS px at 2560×1440 → 2x = 922 px tall.

Re-exported with sharp (`npm i --no-save sharp`, script kept outside the repo), q80, effort 6, alpha kept,
`withoutEnlargement`. The earlier exports were sized for 1920 px, not for the largest rendered size.

| file | before | after |
|---|---|---|
| lab | lab.png 1536×1024, 2064 KB | lab.webp 1524×1016, 221.5 KB |
| lander | lander.png 1389×1132, 1708 KB | lander.webp 1131×922, 238.3 KB |

- Originals: `design-src/originals/lab.png`, `design-src/originals/lander.png`.
- Earlier 1920-based exports kept in `design-src/unused-assets/*-prev-export.webp`.
- References in DetailView.tsx point at `/assets/lab.webp` and `/assets/lander.webp`.
- public/assets: 13.93 MB → 10.69 MB. lint ✓ build ✓

## Phase 2: unused assets: DONE

- All 40 files in public/assets are referenced from src/ (no globals.css url() references exist).
  The earlier commit 635a46b had already moved the dead files (cloud-0/6/tl/tr, rover*, reciever*,
  satellite.png, station, ufo, shuttle, home-planet-bg, home-spaceship, floor-v2, indian-astronaut.png)
  out of public/. So there was nothing confidently unused to move this time.
- Dynamic names checked: `A + f` in the Howl sources, PRELOAD lists, SCHED_DAYS, PILLS, WORLDS.gates,
  Loader ORBS (`"/assets/" + img`). No `cloud-${i}`-style template literal remains in src/.
- Uncertain, left alone: public/file.svg, globe.svg, next.svg, vercel.svg, window.svg (create-next-app
  leftovers outside public/assets, not referenced from src/; they could still be linked from outside).
- scripts/check-assets.mjs and `npm run check:assets` were already present; I hardened the script.
  Template literals (`/assets/cloud-${i}.webp`, ``A + `x-${i}.webp` ``, `` `${A}x-${i}.webp` ``) now count
  as wildcards that must match at least one file; before, they produced a false "missing cloud-".
  Tested against fixtures: missing file → exit 1, wildcard with no match → exit 1, refs in comments ignored.
- `npm run check:assets`: 40 referenced, 40 on disk, ✓. lint ✓ build ✓

## Phase 3: tiered preload: DONE

- data.ts: `PRELOAD` → `PRELOAD_CRITICAL` (9 files, 1300.0 KB: Loader ORBS planet-tide/yellow/blue,
  plus the first home screen: stars, asteroid, planet-ringed, home-rocks, planet-storm, indian-astronaut)
  and `PRELOAD_DEFERRED` (21 files, 2061.1 KB). lab, lander and home-astronaut were added to DEFERRED:
  the detail scenes show them, and after Phase 4 those views are no longer in the initial DOM.
- The loader progress depends only on CRITICAL, for deep links too. Before, a deep link waited on all
  27 files (2.75 MB). Instead, `prepView` now ends with `imagesReady(view)`: it waits (capped at 3 s)
  only for the not-yet-complete images on the first screen of the view being opened. So a deep-linked
  view, or a view entered behind the curtain, still never opens half-drawn.
- DEFERRED starts after the loader finishes (`hideLoader` → `warmDeferred`), 3 files per idle period
  (requestIdleCallback with a 4 s timeout, or setTimeout 200 ms as fallback). The next batch is queued
  only when the previous one settles. Pending work is cancelled on unmount.
- DEFERRED is skipped entirely when `navigator.connection.saveData` is true or `effectiveType` is
  `slow-2g` / `2g`.
- Weight the loader waits on: 2.75 MB → **1.30 MB** (deep links); home was already 1.30 MB after the earlier split.
- lint ✓ build ✓ check:assets ✓

## Phase 4: code-splitting: DONE

Read first: node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md.

- AuthOverlay, DetailView, ScheduleView, MerchView, BagPanel, GalleryView, MenuOverlay are loaded with
  `next/dynamic(..., { ssr: false })`. Each mounts the first time it is needed and then stays mounted
  (`state.lazy`, `Innovision#mount`). HomeView, Loader, Hud, WorldsView/Rover and the GSAP imports stay static.
- One `import()` per module (`LAZY[k].load`), shared by `dynamic()` and the prefetch. A second `import()`
  of the same file made Turbopack emit a duplicate chunk, so a prefetch would have fetched a chunk
  `dynamic()` never used.
- GSAP lifecycle unchanged (context, cleanups, ticker removal, ScrollTrigger kills). `boot()` only reached
  views that existed at boot, so `attach(k)` repeats boot's per-view setup when a lazy view mounts, inside
  the same `ctx`: autoAlpha 0, `[data-idle]`, `loops()` + `syncLoops()`, detail `smoothWheel`, and gallery
  element lookup (`galleryInit` split into `galleryQuery` + its existing ticker).
- No flash or layout shift: lazy views mount with their own `visibility:hidden` while the curtain or loader
  covers the screen. `prepView` awaits the mount and then the first-screen images (Phase 3). They keep
  their place in the DOM order, so stacking is unchanged. Menu and bag mount closed and open one frame
  later, so their CSS clip-path and slide transitions still play. The rift origin is captured before
  the auth overlay mounts.
- Prefetch: the auth and detail chunks are fetched on the first idle period after the loader (with
  Save-Data / 2G off), and the auth chunk on pointerenter / pointerdown / focus of every LOG IN and
  REGISTER link (Hud, HomeView, MenuOverlay). A lazy view's chunk also starts downloading as its curtain falls.
- Failure path: if a chunk can't be fetched (offline), a toast says so and the visitor stays put. The
  curtain lifts on the previous view and the hash is restored. A deep link falls back to home. The
  curtain also always resumes now, even if its `covered` step throws.
- Verified in Chromium (Playwright): no lazy chunk is requested before the loader hides; at about 5.5 s
  the auth chunk and the detail chunk are prefetched together.

Turbopack production build (what ships):

| | before | after |
|---|---|---|
| page chunk | 395.9 KB raw / 108.3 KB gz | **291.7 KB raw / 90.1 KB gz** |
| first-load JS total (8 scripts*) | 948.8 / 277.1 KB | **859.1 / 264.7 KB** |
| AuthOverlay chunk (lazy) | in page chunk | 39.5 / 6.4 KB |
| DetailView chunk (lazy) | in page chunk | 33.4 / 7.3 KB |
| ScheduleView / MerchView / GalleryView / BagPanel / MenuOverlay (lazy) | in page chunk | 10.1 / 5.0 / 5.1 / 5.0 / 2.6 KB raw |

*Includes the 110 KB polyfill chunk, which modern browsers skip (nomodule), in both columns.

Webpack + @next/bundle-analyzer (same metric as the known baseline): page chunk 274.7 KB parsed /
62.3 KB gz → **180.0 KB / 47.7 KB gz**; AuthOverlay 71.3 KB and DetailView 38.1 KB moved out to their own chunks.

lint ✓ build ✓ smoke test (desktop Chrome + Pixel 5) ✓

## Phase 5: images: DONE

- `decoding="async"` on all 69 `<img>` tags (one-off script; every file in src/components/innovision).
- `loading="lazy"` on 17 images, all in secondary views and none of them PRELOAD_CRITICAL art:
  - DetailView: spaceship, planet-blue-half, big-spaceship, moon-cratered, lab, floor ×2, lander, moon,
    home-astronaut; mission porthole art and next-world planet via `lazyUnlessCritical(src)`.
  - ScheduleView: planet-crescent, rocket (spaceship), day planets via `lazyUnlessCritical`.
  - AuthOverlay: planet-crescent, the two upload previews (blob URLs).
  - ImageSlot got a `loading` prop, set to "lazy" from GalleryView and MerchView. No slot images
    are configured yet, so this is for when photos are added.
- width/height attributes (intrinsic px, from `imgSize()` in data.ts) on the 22 images whose CSS sets
  only one dimension (`height: X; width: auto` or `width: X; height: auto`). The browser derives the
  aspect ratio from them, so the box is reserved before load; CSS still decides the rendered size.
  These are: DetailView (spaceship, planet-blue-half, big-spaceship, asteroid, lab, floor ×2, lander,
  moon, home-astronaut, mission art), HomeView (asteroid, astronaut, launch spaceship), WorldsView
  (deco spaceship, astronauts ×2), SignalLink (receiver, satellite), Sponsors (title art), ScheduleView
  (rocket), AuthOverlay (pass planet).

Left alone, and why:
- Home, Loader, WorldsView, SignalLink, Sponsors, SiteFooter, AboutPanel, MenuOverlay: no lazy (first
  screen or always-mounted chrome). The rule says never lazy on home, loader or critical art.
- Curtain clouds (10): no lazy. The layers sit translated off-screen until a transition, so lazy would
  make them pop in mid-transition. Both CSS dimensions are already set.
- Secondary-view images whose file is PRELOAD_CRITICAL (stars in detail/gallery/merch/schedule/bag/auth,
  planet-ringed, planet-storm, asteroid, the auth pass planet-yellow): no lazy, as instructed.
- Every other image already has both CSS dimensions (`width/height: 100%`, `inset: 0`, or fixed px)
  inside a sized box, so it can't shift layout.
- Sponsor logo `<img>`s: none configured; `.sp-logo` sets both dimensions.

lint ✓ build ✓ check:assets ✓ smoke (desktop Chrome + Pixel 5) ✓

## Phase 6: low-power mode: DONE

- `lowPower` state flag next to `coarse`/`narrow` (plus the `this.lowPower` field the engine reads
  synchronously). It only ever switches on (`goLowPower`), which sets `data-lowpower` on `<html>`.
- Static detection at mount: `hardwareConcurrency <= 4`, `deviceMemory <= 4`, `prefers-reduced-motion`, or
  Save-Data. Exception: on iOS/iPadOS the core count is ignored. WebKit caps it at 2 on iOS whatever the
  phone, so the rule would have put every iPhone in low-power mode; there, the frame check decides.
- Runtime fallback (`watchFrames`): starting 500 ms after mount, it measures the average frame time over
  ~3 s and downgrades if it is above 25 ms (~40 fps). Time in a background tab doesn't count; the
  window restarts. Never upgrades.
- Filters: the 19 parallax-layer images (`[data-depth]`/`[data-speed]` descendants: home hero
  asteroid/ringed/rocks ×2/storm/astronaut, the 13 detail-scene images, the worlds deco spaceship) use
  `.fx { filter: var(--fx) var(--fx-shadow,) }` instead of an inline filter. Normal rendering is identical
  (computed filters checked in Chromium). `[data-lowpower] .fx` drops the drop-shadow blur and keeps the
  monochrome colour matrix: without it the art would turn from monochrome to full colour, a design
  change rather than a lightening. Use `filter: none` in that rule to drop both.
- Halved decorations (`data-lp-skip`, hidden by CSS, their GSAP loops paused in `syncLoops`): hero
  sparks 10 → 5, loader sparks 8 → 4, gallery dust 46 → 23 (skipped in `galleryTick` too), curtain cloud
  layers 5 → 3 (cloud-4 and cloud-2 sit out; the label layer stays).
- Ticker: the per-frame callbacks bound to one view (rover → worlds, gallery engine → gallery, cursor
  attraction → home, detail smooth-wheel → detail) are registered through `tickFor`. In low-power mode,
  `syncTicks` (run by showView) keeps only the current view's callback on `gsap.ticker`. Without
  low-power mode they stay registered as before. Each is still removed on unmount.
- Verified (Playwright): Chromium normal → no flag, 10 sparks, 5 layers, shadows on. Chromium with
  reduced motion → flag, 5 sparks, 3 layers, shadows off, mono kept. WebKit iPhone 13 → downgraded by the
  frame check. That also made the WebKit smoke tour finish (1.3 min; before, frames took over 500 ms and the
  first curtain alone took over 30 s).

lint ✓ build ✓ smoke (all 3 projects) ✓

## Phase 7: caching: DONE

Read first: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md.

- next.config.ts `headers()`: `/assets/:path*` → `Cache-Control: public, max-age=604800, stale-while-revalidate=86400`.
  Not `immutable`: filenames carry no content hash. The config comments that immutable would need every
  file renamed on each change. `devIndicators: false` kept.
- Verified with `next start` + curl: stars.webp and splash.mp3 return the new header. `/` keeps Next's own
  `s-maxage=31536000`. `/_next/static/*` keeps Next's hashed `immutable`, which can't be overridden.
- Before: Next's documented default for public/ files (`public, max-age=0`): every visit revalidated
  every asset.
- lint ✓ build ✓

## Phase 8: resilience: DONE

Read first: node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md and
03-api-reference/03-file-conventions/error.md. In 16.3 the boundary prop is a stable `retry`.
`global-error` renders its own `<html>`/`<body>`, fonts and styles.

- `src/app/error.tsx` and `src/app/global-error.tsx` both render `components/innovision/ErrorFallback.tsx`:
  dark space theme drawn with CSS gradients (no asset dependency), Cinzel heading, Space Grotesk copy,
  "SIGNAL LOST / We drifted off course.", TRY AGAIN (`retry()`) and RELOAD PAGE, plus the error digest
  when there is one. global-error loads the two fonts itself via next/font, with the same CSS variables.
  Verified: a forced render crash shows the fallback; TRY AGAIN restores the site.
- Google sign-in (`googleLogin`):
  - missing NEXT_PUBLIC_GOOGLE_CLIENT_ID → toast + inline message.
  - GIS script fails or stalls (15 s cap) → "Couldn't load Google sign-in…".
  - token request fails: popup closed/denied → "closed before it finished"; popup blocked →
    "allow pop-ups"; other errors, or no token after 3 min → "Google didn't confirm your account…".
  - userinfo fetch fails, is non-2xx, times out (15 s, AbortController) or returns no email →
    "Signed in, but Google didn't share your name and email…".
  - `gFail` now also raises a Toast. `gBusy` is cleared in `finally`, so the button never stays busy.
  - Verified with a throwaway build using a dummy client id and mocked Google endpoints: all four
    failure paths and the success path. The final build has no client id baked in.
- localStorage: every read was already in try/catch. Now the values are validated too: the bag keeps
  only well-formed lines for known products (quantity clamped 1–99). Starred schedule ids must be strings.
  Rendering a bag line no longer crashes on an out-of-range colour index.
- Also (Phase 4 work, recorded here): a lazy chunk that fails to load gives a toast and keeps the visitor
  where they were (verified by blocking the detail chunk), and the curtain always lifts.

lint ✓ build ✓

## Phase 9: smoke test: DONE

- `@playwright/test` ^1.63.0 added as a devDependency. Browsers installed: `npx playwright install chromium webkit`.
- `playwright.config.ts`: webServer `npm run start -- -p 3100` (the production build); projects desktop-chrome
  (1440×900), pixel-5, iphone-13 (WebKit, given longer timeouts: WebKit on Windows renders this site
  much slower than an iPhone does).
- `npm run test:e2e` = `pretest:e2e` (`npm run build`) + `playwright test`, so it always tests current code.
- `tests/smoke.spec.ts`:
  - Loader-done signal: `[data-loader]` hidden. `hideLoader()` sets `display:none` only after the exit animation.
  - A transition is done when the target `[data-view]` is visible and `[data-curtain]` is back to `[data-idle]`.
  - The tour: home → worlds → detail (scrolls) → schedule (switches day) → merch (adds to cart) → bag panel
    (from the cart pill) → gallery → menu (desktop briefly resizes to 1000 px, since only compact screens
    have one) → login overlay (HUD LOG IN; on phones via the menu) → register overlay → home.
  - A second test deep-links into a lazy view (`/#/world/main-events`) straight from the loader.
  - Fails on any pageerror, console error, failed request or HTTP status ≥ 400. One exception:
    `net::ERR_ABORTED` on `media` requests. The songs stream through `<audio>`, and the browser cancels
    and re-issues range requests while buffering. That is normal behaviour that predates this work,
    not a failure.
- `/test-results/` and `/playwright-report/` added to .gitignore and to the ESLint ignores.
- Result: 6/6 passed in 2.3 min.

## Phase 10: Lighthouse (best effort): DONE (after-only)

Lighthouse 12, installed Chrome headless, mobile form factor, simulated throttling (Slow 4G, 4× CPU),
production build, 3 runs (all three identical within noise):

| metric | value |
|---|---|
| Performance score | **38** |
| LCP | **20.5 s** (TTFB 0.46 s, render delay 20.0 s = 98%) |
| CLS | **0.001** |
| TBT | 1.4 s |
| FCP | 2.4 s |
| Speed Index | 9.2 s |
| Total byte weight | **3,197 KiB** |

- No "before" run: the backup has no node_modules or build, and the tree I started from already held
  part of the work, so a before number would not be the real baseline.
- What LCP measures here: the LCP element is the home hero rocks image. It has already loaded, but
  stays hidden behind the loader until the loader's exit animation. The loader waits for the 1.30 MB
  critical set (indian-astronaut.webp alone is 455 KB) and a 2.8 s minimum. On simulated Slow 4G that
  gate is most of the 20 s. Lowering it would mean a smaller critical set (e.g. recompress
  indian-astronaut and the three 210–230 KB loader planets) or a shorter / earlier-exiting loader. Both
  are design decisions, outside this pass.
- Byte weight includes the idle-time deferred art and the short sound effects: Lighthouse waits for
  network quiet, so they land inside its window.

## Final check (2026-10-05)

`npm run lint` ✓ · `npm run build` ✓ · `npm run check:assets` ✓ (40/40) · `npm run test:e2e` ✓ 6/6 (2.2 min).
Temporary packages (@next/bundle-analyzer, sharp) were installed with `--no-save` and removed again with
`npm prune`; package.json only gained @playwright/test and the `test:e2e` / `pretest:e2e` scripts.

| | before | after |
|---|---|---|
| First-load JS for `/` (raw / gzip) | 948.8 / 277.1 KB | **870.9 / 269.0 KB** |
| Page chunk (Turbopack, raw / gzip) | 395.9 / 108.3 KB | **295.2 / 91.1 KB** |
| Page chunk (webpack analyzer, parsed / gzip) | 274.7 / 62.3 KB | **180.0 / 47.7 KB** (Phase 4 run) |
| public/assets | 13.93 MB (original PNGs) | **10.69 MB** |
| Weight the loader waits on | 1.30 MB home / 2.75 MB deep links | **1.30 MB** in both cases |
| Lighthouse mobile (after only) | n/a | perf 38, LCP 20.5 s, CLS 0.001, 3,197 KiB |

Notes on the JS numbers:
- First-load counts the 110 KB nomodule polyfill chunk in both columns; modern browsers skip it.
- The page chunk grew ~3.5 KB after Phase 4 (lazy machinery, low-power mode, hardened Google flow).
- The error boundaries add 7.5 KB raw / 3.1 KB gz. Next loads them up front.
