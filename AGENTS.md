# Photo Portfolio — Site

Astro site for Nick's photography portfolio, built by Jeremy. Full project
context (stack, rules, Sanity data model, pending tasks) lives in the
**sibling repo** `../photo-portfolio-studio/CLAUDE.md` — read that first.
This file covers the site's own architecture so a new session can jump
straight into changes.

## Live
- https://nickhuangphoto.com — Cloudflare Pages project `nickhuangphoto`
  (also https://nickhuangphoto.pages.dev), auto-deploys on push to `main`
  (no CI config needed, it's a dashboard-connected GitHub integration).
  Check deploy status via the GitHub check-runs API on the latest commit, or
  the Cloudflare dashboard.
- **Accounts**: the domain and the Pages project live in **Nick's own
  Cloudflare account** (registered 2026-10-09 via Cloudflare Registrar, in his
  name, auto-renew on); Jeremy is a Super Administrator member and switches
  to it from his own login. The project moved there from Jeremy's account
  (old URL `photo-portfolio-d1s.pages.dev`, now gone) because a Pages apex
  domain must be in the same account as the project — and a GitHub repo can
  only be connected to Pages in ONE Cloudflare account, so the old project
  had to be deleted first. `www.` 301s to the apex (a Single Redirect rule,
  `https://www.nickhuangphoto.com/*` → `https://nickhuangphoto.com/${1}` —
  the template's `https://www.*` would capture the host too); Always Use
  HTTPS is on. `site:` in `astro.config.mjs` drives canonical/hreflang.
- **Testing the domain from Jeremy's network**: a Fortinet firewall there
  blocks "Newly Registered Domain" (and re-signs TLS with its own CA, so curl
  fails with "unable to get local issuer certificate"). That's local only —
  check from outside, e.g. the check-host.net API, or a phone off Wi-Fi.
- Local dev: `npm run dev` → localhost:4321. Preview a production build:
  `npm run build && npx astro preview --port 4399` (4321 may be occupied by
  a stale background server — check `lsof -iTCP -sTCP:LISTEN` first).

## Architecture

**i18n**: 4 locales — `en` (default), `ja`, `zh` (Simplified), `zh-tw`
(Traditional). Routes are `/[lang]/` (home), `/[lang]/photography/`
(the gallery), `/[lang]/photo/[id]/`, `/[lang]/videos/`, `/[lang]/contact/`,
`/[lang]/about/`; root redirects to `/en/`. Single source of truth:
`src/i18n/locales.ts` (`locales` array, `ui` strings record, `l()` helper
for pulling a field out of a Sanity localized object). Mirror any new
locale in `astro.config.mjs` (`i18n.locales`) and the Studio's
`schemaTypes/supportedLanguages.ts`.

**Data layer**: `src/lib/sanity.ts` (client), `src/lib/queries.ts` (GROQ +
types), `src/lib/image.ts` (`urlFor`/`srcsetFor` — always route images
through these, never raw Sanity URLs). Env vars `SANITY_PROJECT_ID` /
`SANITY_DATASET` via `.env` (see `.env.example`).

**Home page** (`/[lang]/`, `index.astro`): four expanding image panels —
Photography | Videos | Contact | About, in that order (Nick's request) —
adapted from aaronjamieson.com's home carousel. One panel is open (flex-grow
6, or 4.2 when stacked), the rest are slim strips with a vertical label
(`writing-mode: vertical-rl`, deliberately *not* rotated: rotation would
flip CJK upside down). Click a strip → it opens; click the open one → enter
that section. Logic in `initHome()` (`app.ts`): the expanding click calls
`stopPropagation()` because Barba listens on `document` and ignores
`defaultPrevented`; focus only opens a panel when `:focus-visible` (a mouse
click focuses the link first, and opening on that would turn the click into
a navigation). **Fast-switching gotchas** (both reported by Jeremy as a
"flash" when clicking quickly between panels): (1) a click on a panel that
opened <650ms ago is swallowed (`ENTER_GRACE_MS`, pointer clicks only via
`e.detail > 0`) — otherwise a quick second click / double-click landed on
the just-opened panel and launched the full-screen `panel-expand`
transition mid-switch; (2) closed strips are dimmed by an opacity-fading
dark layer (`.home-panel__media::after`), never `filter: brightness()` on
the photos — animated filters on large zooming images can paint undimmed
frames on real GPUs (Safari especially). Panels are `user-select: none`.
Phones (<768px) stack the panels vertically as a true
accordion. Every panel plays a reel of 5–6 photos, one colour mood per
panel so they stay distinct (Photography = one per album, Contact = warm
night light, About = calm/cool, Videos = motion). Each panel's photos are `Shot`s (`src/lib/shots.ts`) picked by
Sanity `_id` in the `PANELS` array — with an object-position `focus` and an
optional `crop` (fractions of the frame) that Sanity's CDN applies via
`rect`, so the cut-away part is never sent to the browser. Contact's
*Golden Reach* uses it to keep the model's face out in every layout,
including the full-screen transition clone — use `crop`, not CSS
positioning, whenever something must never show. Faces are otherwise fine
(Jeremy confirmed), but About's reel opens on a scene, not a person, since a
lone portrait there reads as Nick (no photo of him exists yet).
A deleted photo falls back to another one; not yet editable in the Studio.
**Reels** (`[data-slideshow]`, `initSlideshows()`): cross-fade stacked
`.reel-slide`s every 3.2s with a slow zoom/drift; reels on one page are
offset 0.8s so changes ripple across panels instead of flipping together.
Only the first still ships with the page; each reel fetches just the *next*
still (`data-src(set)`) ahead of its turn — loading all four reels up front
was ~20 images, too heavy on phones. Stops when its root leaves the DOM.
**GPU budget — the real "flash" bug** (Jeremy's screen recording, all
browsers): with every loaded still left in the page at opacity 0, each with
its own transform transition, inside rounded-corner panels, four reels
reached ~22 Retina-sized composited layers and browsers began dropping image
tiles — single frames where photos were only partly painted and the blurry
panel placeholder (of a *different* still) showed through. Rules now: only
the current still (+ the previous one during the 1.2s cross-fade) is
rendered, every other slide is `[hidden]`; a still is `img.decode()`d before
it's revealed; NO scale animation on hover/open and no hover "peek"
resize (each settled scale change re-rasterizes a big photo — sweeping the
pointer across the strips triggered it constantly; Jeremy found the glitch
tracked mouse movement); hover feedback is the dim layer's opacity only;
reel slides are `will-change: transform` so Ken Burns never re-rasters,
and on the home page each slide is a FIXED-size frame (70vw × panel height;
phones: full width × max(52svh, 24rem)) — never `inset: 0` to the panel,
whose size animates: a layer resized every frame piled up re-raster work on
fast clicking and glitched for seconds;
panels have no border-radius; the placeholder
background is removed once the first still loads. Headless runs (even with GPU
flags) do NOT reproduce it. What does: Playwright driving the real, visible
Google Chrome (`chromium.launch({ channel: 'chrome', headless: false })`,
`viewport: null`, so it gets the display's real 2x DPR), recording every
compositor frame via CDP `Page.startScreencast` during rapid clicks +
pointer sweeps, then counting one-frame outliers (frame differs from both
neighbours while they match each other). Pre-fix build: 37 glitches / 20s;
fixed build: 0 across four runs, incl. full-screen window and 4x CPU
throttle. Re-run that harness for any change to the home panels.
The `panel-expand` transition clones whichever still is current. The Videos
page poster plays the same `VIDEO_REEL` (`src/lib/site.ts`) until real
films exist. The panel `<img>` keeps
the open panel's size and stays centered so opening just unmasks it (no
re-crop mid-animation); its `sizes` is height-aware per photo
(`panelSizes()`), because on tall screens height, not width, decides how
wide a cover-fitted landscape renders — a plain `70vw` made tablet/phone
panels visibly soft. Layout prop `fill` makes home a one-screen page with
a compact footer. **Videos** is a "coming soon" poster for now (no video
content model exists yet), dressed as a paused film: a "● Coming soon"
badge, a fake play button circled by rotating "COMING SOON •" text (SVG
`textPath`; a click only teases "Films are on their way"), and a fake
player bar whose progress + timecode run once per reel cycle
(`initFakePlayer()`). **Gotcha**: reel slides carry z-index 1–2 (see
the GPU notes above), so every overlay on a reel needs z-index ≥ 3 — the
poster's play button/text once silently disappeared under the photos. The
home Videos panel shows the same badge. **Contact** reads email from Site Settings plus
the Instagram constant in `src/lib/site.ts`.

**Shop** (`/[lang]/shop/`): a "coming soon" teaser — Nick has nothing to sell
yet, so it stays deliberately vague (no prices, sizes or ordering; Jeremy
asked for that after a fuller store mock-up). Photos in `src/lib/shop.ts`,
copy in `src/i18n/shop.ts`; prints render as framed mock-ups on a lit
"wall" (`hang()` sizes the frame so any aspect fits). In the nav, no home
panel.

**Header**: wordmark (`.site-logo`) is uppercase/tracked like the nav with
an accent dot, so the bar reads as one line; the photographer's name is no
longer repeated as a giant hero on the gallery (that hero now says
"Photography."). Desktop nav shows from `lg:` — four items don't fit at
`md:`, so tablets use the hamburger menu.

**Albums / galleries**: a Sanity `category` doubles as an "album" (labelled
"Galleries" in the gallery UI). The gallery (`/[lang]/photography/`, a
one-screen `fill` page from 768px up) is modelled on **detroit.paris's
home strip** (Jeremy's pick; it replaced an editorial grid + GSAP Flip
filter): title, then the galleries as ●-dot choices (label rolls on hover,
counts), then an endless strip of photos along the bottom. Logic:
`initGallery()` → `initStrip()` in `app.ts`. Each item sits at
x = i·spacing − position on a looping track and is scaled by x (tiny at the
left, ~1.6× base at the right, bigger on top); the translate is applied
*inside* the scale so screen x = x·scale — that's what makes the gaps widen
into a staircase (same trick as detroit's `main.js`: `transform` + the
`scale` property). The element is sized at the largest *visible* scale and
only scaled down, so photos stay sharp under `will-change: transform`.
Wheel (anywhere on the page), drag, ←/→ move it, with lerp smoothing;
switching gallery folds the stairs into the left corner and grows the new
set in (small galleries are cloned to fill the loop). Hover shows one
"● Title" tag. **Clicking a photo opens it straight in the fullscreen
viewer** (`openFromGallery()` → the shared `openViewer()`, same PhotoSwipe
setup as the photo page), paging through the chosen gallery — Jeremy asked
to skip the photo page in between. On close the strip glides to the photo
you ended on (the list scrolls to it). Modified clicks (cmd/ctrl/middle)
still open the photo page, which stays for shared links; a drag never
opens anything. **GPU budget** (home "flash" lesson again): only items
on the at-rest stretch of track (x ≤ `xEdge`) are ever un-`[hidden]` —
mid-switch everything crams into the corner and ~20 photo layers at once
produced a one-frame blank in the real-Chrome frame detector. Tall
tablet screens get portrait boxes (`--strip-ratio`) so the strip fills the
height. **Phones (<768px) keep a vertical list** instead (Jeremy: on a
phone the strip only shows one photo properly, the rest are slivers):
`initGalleryList()` — same markup, full-width photos in their own aspect
(`--ar`) with a caption, filtered in place, rising in on scroll. The two
modes swap live on a `matchMedia` change (each owns an AbortController and
undoes its inline styles on abort). Photo detail pages
(`/[lang]/photo/[id]/`) are album-scoped — prev/next/counter/swipe all stay
within the photo's own album; an album-switcher tab row at the top jumps to
another album's first photo. Logic lives in `getStaticPaths()` in
`src/pages/[lang]/photo/[id].astro` (groups photos by category, computes
per-album index/prev/next at build time). Its "Back to gallery" link goes
to `/[lang]/photography/`.

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

**CJK + reveal masks (gotcha)**: at the tight line-heights used for big
titles (~1.0), Japanese/Chinese glyphs (Hiragino/PingFang) draw ABOVE the
line box, so any `overflow: hidden` reveal mask sliced their tops off (the
home panel titles, and the split-char hero titles on Photography/Videos —
"攝影" lost its top strokes). Masks now get `padding: .25em 0 .15em` cancelled
by equal negative margins (layout unchanged), and the hidden start offset
is 140–145% so nothing peeks pre-reveal. Any new masked text reveal needs
the same. Found with a real-Chrome detector: screenshot each text element
whose overflow clips, again with `overflow: visible`, and diff.

**Favicon**: a viewfinder (four focus-frame corners) with the wordmark's
gold dot, cream on an espresso rounded tile (`public/favicon.svg`). Picked
from three concepts (viewfinder / aperture / N monogram) shown to Jeremy at
real tab size. Also in `public/`: `favicon.ico` (16/32/48 PNG-in-ICO),
`apple-touch-icon.png` + `icon-192/512.png` (full-bleed square — the OS
rounds them), `icon-maskable-512.png` (mark scaled into the 80% safe zone)
and `site.webmanifest`. They're rendered from the SVG by real Chrome, so
after changing the SVG regenerate the PNG/ICO files rather than editing
them. `theme-color` follows light/dark (paper colours), not the icon.

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
- Scroll parallax (`initParallax`): elements with `data-parallax="<speed>"`
  (e.g. the About hero) drift via one shared `requestAnimationFrame` loop
  (`parallaxItems` array, rebuilt per page in `initPage`). The old gallery
  grid's image parallax + hover zoom went with the grid.
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
  **Loading**: the hero's `sizes` attribute is computed per-photo in
  `[id].astro` (`heroSizes()`) from the band-height tiers above times that
  photo's own aspect ratio — it must track the band CSS. A stale
  `85vw`/`100vw` value shipped once after the fixed-band redesign and went
  unnoticed for a while: it told the browser to assume near-full-viewport
  width, so the srcset picked an oversized candidate for every non-wide
  (portrait/square) photo. The same per-photo width feeds
  `heroPrefetchUrl()`, embedded as `data-prefetch-src` on the prev/next
  arrows; `initPrefetch()` in `app.ts` warms those exact URLs via
  `requestIdleCallback` shortly after each photo page settles, so the
  adjacent image is normally already cached before it's ever clicked — this
  is what actually hides the wait on desktop, more than any animation
  could. The two must request the same width or the prefetch is wasted
  under a different cache key. `.photo-media:has(> .photo-img:not(.is-loaded))`
  in `global.css` adds a quiet breathing-pulse animation to the blurred LQIP
  backdrop as a graceful fallback for the rare slow/uncached load (first
  visit, slow connection, jumping albums via the switcher) — driven purely
  by the existing `markLoaded()`/`.is-loaded` class toggle, no extra JS.

**Page transitions** (Barba.js + GSAP, `src/scripts/app.ts`) — a family of
five, not one style everywhere (a sixth, `flip-photo` — gallery photo flying
into its page — was removed once gallery clicks started opening the
fullscreen viewer instead of navigating):
0. `panel-expand` — clicking the open home panel: its photo grows from the
   panel to fill the screen (`.panel-clone`), the page swaps underneath,
   then the photo wipes upward off the new page. `wave` excludes home-panel
   triggers to stay mutually exclusive.
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
Each feature init in `initPage()` runs in its own try/catch: it executes
inside Barba's `afterEnter`, and one throwing aborted the rest of the
transition (home → Videos stayed frozen on the `panel-expand` photo clone).
The throw was a GSAP gotcha: `fromTo()` renders — and fires `onUpdate` —
before it returns, so an `onUpdate` that references the returned tween
const hits the TDZ. Use `this` inside the callback instead.

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
