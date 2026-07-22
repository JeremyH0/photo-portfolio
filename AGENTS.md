# Photo Portfolio — Site

Astro site for Nick's photography portfolio, built by Jeremy. Full project
context (stack, rules, Sanity data model, pending tasks) lives in the
**sibling repo** `../photo-portfolio-studio/CLAUDE.md` — read that first.
This file covers the site's own architecture so a new session can jump
straight into changes.

## Live
- https://photo-portfolio-d1s.pages.dev — Cloudflare Pages, auto-deploys on
  push to `main` (no CI config needed, it's a dashboard-connected GitHub
  integration). Check deploy status via the GitHub check-runs API on the
  latest commit, or the Cloudflare dashboard.
- Local dev: `npm run dev` → localhost:4321. Preview a production build:
  `npm run build && npx astro preview --port 4399` (4321 may be occupied by
  a stale background server — check `lsof -iTCP -sTCP:LISTEN` first).

## Architecture

**i18n**: 4 locales — `en` (default), `ja`, `zh` (Simplified), `zh-tw`
(Traditional). Routes are `/[lang]/`, `/[lang]/about/`,
`/[lang]/photo/[id]/`, root redirects to `/en/`. Single source of truth:
`src/i18n/locales.ts` (`locales` array, `ui` strings record, `l()` helper
for pulling a field out of a Sanity localized object). Mirror any new
locale in `astro.config.mjs` (`i18n.locales`) and the Studio's
`schemaTypes/supportedLanguages.ts`.

**Data layer**: `src/lib/sanity.ts` (client), `src/lib/queries.ts` (GROQ +
types), `src/lib/image.ts` (`urlFor`/`srcsetFor` — always route images
through these, never raw Sanity URLs). Env vars `SANITY_PROJECT_ID` /
`SANITY_DATASET` via `.env` (see `.env.example`).

**Albums / galleries**: a Sanity `category` doubles as an "album" (labelled
"Galleries" in the gallery UI). The gallery (`/[lang]/`) shows every photo in
one mixed editorial grid with a switcher up top (per-gallery photo counts,
accent underline on the active one); `initFilter` in `app.ts` filters
client-side and animates the re-layout with **GSAP Flip** (surviving cards
slide to new slots; entering/leaving cards fade+scale). Grid is responsive:
1 col on phones, 2 on tablets (`sm:`), the 12-col offset pattern only at
`lg:` (desktop). Photo detail pages
(`/[lang]/photo/[id]/`) are album-scoped — prev/next/counter/swipe all stay
within the photo's own album; an album-switcher tab row at the top jumps to
another album's first photo. Logic lives in `getStaticPaths()` in
`src/pages/[lang]/photo/[id].astro` (groups photos by category, computes
per-album index/prev/next at build time).

**Design system** (`src/styles/global.css`, Tailwind v4 `@theme`):
Currently the **"champagne" (light) / "velvet" (dark)** palette — warm
alabaster paper + espresso ink + brass/gold accent in light,
brown-black + ivory + champagne gold in dark. One accent pair only
(`--color-accent` / `--color-accent-soft`), themed via
`:root[data-theme="dark"]`. **This has been reworked multiple times per
Jeremy's taste** (started colorful 3-accent, went minimalist blue, now
champagne/gold) — if asked to change it again, it's contained entirely to
that `@theme` block plus the two SVG gradient `<stop>` colors in
`Layout.astro`. Theme toggle persists to `localStorage`, defaults to system
preference, applied pre-paint (no FOUC). The toggle itself is a simple
`data-theme` flip (`html,body { transition: background-color, color }` for
the crossfade); a fancier View-Transitions circular reveal was tried and
reverted, it read as buggy on some devices.
The button's own rotate flourish (`global.css`) is driven by the theme
state, `:root[data-theme="dark"] .theme-toggle { transform: rotate(180deg) }`
— **not** `:hover`. It used to be hover-only, which looked identical on
desktop but broke on touch: mobile browsers apply `:hover` on tap and only
clear it once a *different* element is tapped, so the rotation played once
per visit and then silently stopped replaying until you touched something
else first. Tying it to the actual `[data-theme]` attribute instead makes
it replay every toggle, identically on mouse, touch, and keyboard.

**Typography**: Nimbus Sans (URW++'s Helvetica-metric twin) is the single
site-wide face — `--font-serif` just aliases `--font-sans`. Self-hosted as
two static WOFF2 files in `src/fonts/nimbus-sans/` (`@font-face` in
`global.css`, Regular preloaded in `Layout.astro`); only Regular + Bold are
shipped since nothing on the site uses italic, and Regular's `@font-face`
declares `font-weight: 100 500` so the one `font-medium` usage (Header logo)
resolves to it instead of pulling a third file or triggering synthetic
bold. **License**: SIL OFL 1.1, no Reserved Font Name — genuinely free for
commercial use (`src/fonts/nimbus-sans/OFL.txt`; canonical source
[twardoch/urw-core35-fonts](https://github.com/twardoch/urw-core35-fonts),
itself a re-license of URW++'s original AGPL release). **Careful with "free
font" claims** — the previous font on this project (Harmony, an Awwwards
pick) turned out to be personal-use-only despite being billed as "free";
verify actual license terms before adopting a next one. Nimbus Sans covers
Latin/Cyrillic/Greek only; the CJK fallback chain in `--font-sans` must stay
for ja/zh/zh-tw.

**Interactions**:
- Custom cursor (`.cursor` in `Layout.astro`, logic in `initCursor()` in
  `src/scripts/app.ts`): dot + trailing ring, both gold/accent-colored;
  grows over links; shows a localized text badge (View/Zoom/Close) over
  labelled elements (`data-cursor-label` attribute). Fine pointers only.
- Scroll parallax (`initParallax`): hero title + gallery images drift at
  different speeds via one shared `requestAnimationFrame` loop
  (`parallaxItems` array, rebuilt per page in `initPage`).
- Hover on gallery images (`initHoverParallax`): zoom-in inside the frame +
  lean toward the pointer, folded into the same transform the scroll
  parallax writes (via `img.dataset.hoverScale`) so the two never fight.
- Mobile hamburger menu (`initMenu`): full-screen, clip-path reveal,
  numbered serif links, scroll-locked.
- Photo detail fullscreen viewer (`initDetail`): click the hero to open a
  PhotoSwipe v5 lightbox over the whole album (lazy-loaded chunk; skinned
  via `.pswp.pswp` CSS vars in `global.css` — doubled class beats
  photoswipe.css regardless of bundle order). Real zoom (wheel/pinch/
  double-tap + pan), swipe between photos without leaving fullscreen,
  close/counter/arrows built in. Closing on a different photo than it
  opened on syncs the page via `barba.go` + `pendingNavDir` (directional
  wave). While `.pswp` is in the DOM the global keydown handler stands down
  (PhotoSwipe owns Esc + arrows). Swipe/drag directly on the hero (outside
  the lightbox) still navigates prev/next.
  **Icons**: arrow/close/zoom are NOT PhotoSwipe's default SVGs — they're
  overridden via the `arrowPrevSVG`/`arrowNextSVG`/`closeSVG`/`zoomSVG`
  lightbox options in `app.ts` (arrows/close reuse the same ←/→/× glyphs as
  the rest of the site; zoom is a minimal hand-drawn magnifier that reuses
  PhotoSwipe's own `pswp__zoom-icn-bar-h`/`-v` class names so its built-in
  "+"→"−" zoomed-in toggle keeps working for free). Buttons are restyled in
  `global.css` into the same circular backdrop-blur chip as `.detail-arrow`.
  **Gotcha**: PhotoSwipe puts state classes (`.pswp--zoom-allowed`,
  `.pswp--one-slide`, `.pswp--touch`, `.pswp--has_mouse`) directly on the
  root `.pswp` element, not on a wrapping ancestor — an override has to be
  the *compound* selector `.pswp.pswp--zoom-allowed .foo`, not the
  descendant selector `.pswp--zoom-allowed .pswp .foo` (the latter matches
  nothing, since there's no separate `.pswp` descendant to find; this
  shipped as a real bug once, caught by the zoom button silently staying
  `display:block` instead of picking up the chip layout).
  **Mobile swipe hint**: PhotoSwipe hides its arrow buttons on touch devices
  by default (swipe replaces them) — a small `←→` hint element is
  registered via `lightbox.on('uiRegister', ...)` and fades in/out once via
  CSS animation, only visible while `.pswp--touch` is set and
  `.pswp--has_mouse` isn't (mirrors PhotoSwipe's own arrow-visibility
  logic). Dismissed early by a `pswp__swipe-hint-dismissed` class added on
  the *second* `change` event — the first `change` fires just from setting
  the opening slide, not a real swipe, and would otherwise dismiss the hint
  before it's ever seen. The hero fills a fixed vertical
  band at every breakpoint (`.detail-hero__media`, tiered height —
  `min(34svh,300px)` mobile / `min(46svh,560px)` sm / `min(72svh,760px)`
  lg — width auto, capped `max-width:100%`) so its top AND bottom edges stay
  put across formats and the caption/nav below never jump when paging
  between differently-shaped photos. The image itself is `object-fit:
  contain`, never `cover` — a shape that doesn't fill the band renders
  smaller inside it rather than cropping, with the blurred LQIP showing
  through as an ambient backdrop in the gutter. Mobile's band is
  deliberately short: width is the scarce dimension on a phone, so a tall
  band would letterbox ordinary landscape photos badly (see the git history
  on this block for the derivation if it needs retuning). Side arrows
  (`.detail-arrow`) only render `lg:` and up — tablet relies on swipe/thumb
  nav instead, they didn't fit well there.

**Page transitions** (Barba.js + GSAP, `src/scripts/app.ts`) — a family of
five, not one style everywhere:
1. `flip-photo` — clicking a gallery photo: the image itself flies/expands
   into the detail page hero (shared-element FLIP, `.flip-clone`).
2. `photo-slide` — prev/next inside an album: the wave, sweeping
   horizontally in the travel direction (next: left → right, prev:
   right → left; `WAVE_H` keyframes). **Gotcha**: this transition used to
   also drift the whole container a couple percent sideways via GSAP
   `xPercent` for extra polish — don't bring that back. `xPercent`/`x` set a
   CSS `transform` on the container, and a transformed ancestor becomes the
   containing block for any `position: fixed` descendant (confirmed live:
   the `.detail-arrow` side arrows visibly dragged ~36px sideways during the
   transition and snapped back). Any future per-container transform on the
   Barba container needs to be checked against the fixed-position arrows.
3. `wave-top` — leaving a photo page back to a section: the wave transition
   below, but mirrored (drops from top) and 1.35× faster.
4. `wave` — any other section change (Work ↔ About): a curved SVG wave
   sweeps up from the bottom and off the top, adapted from GreenSock's
   "morphSVG curve manipulation" CodePen (`EaKpEpJ`); gradient uses the live
   theme accent colors, not hardcoded ones.
5. `soft` — same page, different language: quick scale-down + rise.

Each transition is a `custom:` predicate — **built only from
`current` + `trigger`, never `next`**. Barba resolves the transition
*before* fetching the next page, so `next.namespace` is empty except on
cache hits; predicates that read it silently fall back to the wrong
transition on every first visit (this bug shipped once — vertical wave on
prev/next). Among equal-priority customs Barba checks the *last-defined
first*, so keep the predicates mutually exclusive. **Barba only runs on
desktop (>=1024px)** — the `useBarba` flag (`!reducedMotion && matchMedia(min-width:1024px)`)
gates both `initBarba()` and the lightbox's close-nav (`barba.go` vs
`location.assign`); below that, and with `prefers-reduced-motion`,
navigation is plain multi-page loads. Reduced-motion additionally disables
the cursor/parallax/hover-zoom (the lightbox still works, minus animations).

**Gotcha**: Barba fires `afterEnter` for the *initial* page load, not just
client-side navigations. `initPage()` guards against double-init via
`container.dataset.appInit` — don't remove this guard, it silently causes
double-bound listeners (broke the hamburger toggle once, duplicated
animations).

## Verification habit
Before calling a visual/interactive change done: build (`npm run build`),
then drive it with Playwright across desktop + tablet + mobile viewports
(screenshot key states, assert on computed styles/classes, check for
console/page errors) rather than eyeballing dev server only. Playwright/
Chromium aren't repo dependencies — install them in the scratchpad
(`npm i playwright && npx playwright install chromium`) each session. This
has caught real bugs (the double-init above; native image drag swallowing
swipe gestures) that would've shipped otherwise.

## Astro basics
- `astro dev --background` to run detached; `astro dev stop/status/logs` to manage.
- Docs: https://docs.astro.build (routing, components, framework components,
  content collections, styling, i18n guides linked from there).
