/**
 * Page transitions (Barba.js + GSAP), per-page animation, custom cursor and
 * theme toggle — in the spirit of the Codrops article "Creating Custom Page
 * Transitions in Astro with Barba.js and GSAP".
 *
 * Transition map:
 *  - home → section (clicked open panel): the panel's photo grows to fill the
 *    screen, then wipes upward off the incoming page.
 *  - gallery → photo (clicked card): shared-element FLIP — the clicked image
 *    flies and expands into the detail page hero.
 *  - photo → photo (prev/next): the wave sweeps horizontally in the travel
 *    direction (next: left → right, prev: right → left).
 *  - section change: curved wave sweep rising from the bottom (dropping from
 *    the top when leaving a photo).
 *  - same page, other language: quick scale-down + rise.
 *
 * Page transitions (Barba) run on desktop (>=1024px) only; on smaller
 * screens, and with prefers-reduced-motion, navigation is plain multi-page
 * loads. Reduced-motion additionally drops reveals and the custom cursor.
 */
import barba from '@barba/core';
import gsap from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import 'photoswipe/style.css';

gsap.registerPlugin(MorphSVGPlugin);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The page transitions (wave / FLIP / slide) only read well on large screens;
// below this — or with reduced-motion — navigation is plain multi-page loads.
const useBarba = !reducedMotion && window.matchMedia('(min-width: 1024px)').matches;

/** Theme accent pair, read live so dark/light both look right. */
function accentColors(): [string, string] {
  const styles = getComputedStyle(document.documentElement);
  return [
    styles.getPropertyValue('--color-accent').trim() || '#a87e2f',
    styles.getPropertyValue('--color-accent-soft').trim() || '#e2c078',
  ];
}

/* ---------------- helpers ---------------- */

/** Wrap each character of an element's text in a span (CJK-safe SplitText). */
function splitChars(el: HTMLElement): HTMLElement[] {
  const text = el.textContent ?? '';
  el.textContent = '';
  el.setAttribute('aria-label', text);
  const chars: HTMLElement[] = [];
  for (const ch of text) {
    const span = document.createElement('span');
    span.className = 'char';
    // Regular spaces collapse to zero width inside inline-block spans.
    span.textContent = ch === ' ' ? ' ' : ch;
    span.setAttribute('aria-hidden', 'true');
    el.appendChild(span);
    chars.push(span);
  }
  return chars;
}

function markLoaded(img: HTMLImageElement) {
  if (img.complete && img.naturalWidth > 0) img.classList.add('is-loaded');
  else img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
}

/* ---------------- per-page init ---------------- */

function initImages(container: HTMLElement) {
  container.querySelectorAll<HTMLImageElement>('.photo-img').forEach(markLoaded);
}

/** Card reveals via IntersectionObserver: immune to transition timing. */
let revealObserver: IntersectionObserver | null = null;

function initReveals(container: HTMLElement) {
  if (reducedMotion) return;

  const cards = gsap.utils.toArray<HTMLElement>('.shop-reveal', container);
  if (cards.length) {
    gsap.set(cards, { autoAlpha: 0, y: 48 });
    let batch: HTMLElement[] = [];
    let scheduled = false;
    const flush = () => {
      gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07 });
      batch = [];
      scheduled = false;
    };
    revealObserver = new IntersectionObserver(
      (entries, io) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          batch.push(entry.target as HTMLElement);
          io.unobserve(entry.target);
        }
        if (batch.length && !scheduled) {
          scheduled = true;
          requestAnimationFrame(flush);
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
    );
    cards.forEach((card) => revealObserver!.observe(card));
  }

  const blocks = gsap.utils.toArray<HTMLElement>('.about-reveal, .detail-reveal', container);
  if (blocks.length) {
    gsap.from(blocks, {
      autoAlpha: 0,
      y: 40,
      duration: 1,
      ease: 'power3.out',
      stagger: 0.12,
      delay: 0.1,
    });
  }
}

function initHero(container: HTMLElement) {
  if (reducedMotion) return;
  const title = container.querySelector<HTMLElement>('[data-split]');
  if (!title) return;
  const chars = splitChars(title);
  // The overflow mask gets room above/below the line box (cancelled by
  // negative margins, so layout is unchanged): with these tight line-heights
  // CJK glyphs draw above the box and their tops were being sliced off.
  gsap.set(title, {
    display: 'inline-block',
    overflow: 'hidden',
    verticalAlign: 'bottom',
    paddingTop: '0.25em',
    marginTop: '-0.25em',
    paddingBottom: '0.15em',
    marginBottom: '-0.15em',
  });
  gsap.from(chars, {
    yPercent: 145, // clear of the taller mask, so no ink peeks before the rise
    duration: 1.1,
    ease: 'power4.out',
    stagger: 0.035,
    delay: 0.15,
  });
  const line = container.querySelector('.hero-line');
  if (line) gsap.from(line, { autoAlpha: 0, y: 16, duration: 0.8, delay: 0.5 });
}

/**
 * Home page expanding panels (after aaronjamieson.com): clicking a closed
 * strip opens it; clicking the open one follows its link (Barba's
 * 'panel-expand' transition on desktop, a plain load elsewhere). Keyboard
 * focus opens a panel too, so Tab walks the sections and Enter goes in.
 */
function initHome(container: HTMLElement) {
  const root = container.querySelector<HTMLElement>('[data-home]');
  if (!root) return;
  const panels = gsap.utils.toArray<HTMLAnchorElement>('[data-home-panel]', root);
  const bars = container.querySelectorAll<HTMLButtonElement>('[data-home-goto]');
  const counter = container.querySelector('[data-home-current]');
  const enterLabel = root.dataset.enterLabel ?? '';
  let active = Math.max(
    0,
    panels.findIndex((p) => p.classList.contains('is-active')),
  );
  // When the panel under the pointer was opened a moment ago, a click on it
  // is a quick second click from someone switching (or a double-click) —
  // not a decision to enter. Following it launched the full-screen
  // panel-expand transition mid-switch: a sudden bright flash of photo.
  const ENTER_GRACE_MS = 650;
  let openedAt = 0;

  const activate = (i: number) => {
    const target = (i + panels.length) % panels.length;
    if (target !== active) openedAt = performance.now();
    active = target;
    panels.forEach((panel, k) => {
      const on = k === active;
      panel.classList.toggle('is-active', on);
      // Cursor badge only on the open panel — that's the one a click enters.
      if (on) panel.dataset.cursorLabel = enterLabel;
      else delete panel.dataset.cursorLabel;
    });
    bars.forEach((bar, k) => bar.setAttribute('aria-pressed', String(k === active)));
    if (counter) counter.textContent = String(active + 1).padStart(2, '0');
    // The pointer is still over the panel it just opened: refresh the cursor.
    refreshCursor?.(panels[active]);
  };

  panels.forEach((panel, i) => {
    panel.draggable = false;
    // The blurry placeholder behind the panel only covers the first load;
    // once a real still is up it must never show through (it's of the
    // reel's FIRST still, so it read as "a different picture").
    const firstImg = panel.querySelector<HTMLImageElement>('.home-panel__img');
    const dropPlaceholder = () => (panel.style.backgroundImage = 'none');
    if (firstImg?.complete && firstImg.naturalWidth > 0) dropPlaceholder();
    else firstImg?.addEventListener('load', dropPlaceholder, { once: true });
    panel.addEventListener('click', (e) => {
      // Open panel: follow the link — unless it only just opened under a
      // pointer (e.detail > 0: mouse/touch; keyboard Enter always enters).
      if (i === active && !(e.detail > 0 && performance.now() - openedAt < ENTER_GRACE_MS)) return;
      e.preventDefault();
      // Barba listens on document and ignores defaultPrevented — keep this
      // click from reaching it, or it would navigate instead of opening.
      e.stopPropagation();
      activate(i);
    });
    // Keyboard only: a mouse click also focuses the link first, and opening
    // on that focus would turn the click into an immediate navigation.
    panel.addEventListener('focus', () => {
      if (panel.matches(':focus-visible')) activate(i);
    });
  });

  bars.forEach((bar) =>
    bar.addEventListener('click', () => activate(Number(bar.dataset.homeGoto))),
  );
  container.querySelectorAll<HTMLButtonElement>('[data-home-step]').forEach((btn) =>
    btn.addEventListener('click', () =>
      activate(active + (btn.dataset.homeStep === 'prev' ? -1 : 1)),
    ),
  );

  if (reducedMotion) {
    root.classList.add('is-ready');
    return;
  }

  // Intro: strips rise in one after another (slide in from the left when
  // stacked on phones), photos settle from a slight zoom, then the open
  // panel's title reveals (CSS, keyed on .is-ready).
  const stacked = getComputedStyle(root).flexDirection === 'column';
  gsap.fromTo(
    panels,
    { clipPath: stacked ? 'inset(0% 100% 0% 0%)' : 'inset(100% 0% 0% 0%)' },
    {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.2,
      ease: 'power4.inOut',
      stagger: 0.09,
      clearProps: 'clipPath',
    },
  );
  gsap.from(root.querySelectorAll('.home-panel__media'), {
    scale: 1.3,
    duration: 1.8,
    ease: 'power3.out',
    stagger: 0.09,
    clearProps: 'transform',
  });
  const controls = container.querySelector('[data-home-controls]');
  if (controls) gsap.from(controls, { autoAlpha: 0, y: 12, duration: 0.8, delay: 0.9, ease: 'power3.out' });
  gsap.delayedCall(0.7, () => root.classList.add('is-ready'));
}

/**
 * Still-photo reels (every home panel + the Videos page): stills cross-fade
 * every few seconds, each with a slow zoom and sideways drift, so the frame
 * feels like moving footage. Several reels on one page are offset so their
 * changes ripple across instead of all flipping at once.
 *
 * Kept deliberately light on the GPU — this was a real bug: with every
 * loaded still left in the page (just transparent), four reels piled up
 * ~20 Retina-sized layers and browsers began dropping image tiles, showing
 * one-frame flashes of the blurry placeholder / a different picture. So:
 *  - only the current still (plus the previous one, during the cross-fade)
 *    is rendered; every other slide is [hidden] (display: none);
 *  - each reel fetches only the next still, and it's fully decoded
 *    (img.decode()) before it's revealed, never decoded mid-fade.
 * Reduced motion: the first still just stays put.
 */
const REEL_HOLD = 3.2; // seconds each still stays on screen
const REEL_FADE = 1.2; // matches .reel-slide's opacity transition
const REEL_STAGGER = 0.8; // offset between reels on the same page

/** Start fetching + decoding a slide's still; `data-ready` once decoded. */
function prepareSlide(slide: HTMLElement | undefined) {
  const img = slide?.querySelector('img');
  if (!slide || !img || slide.dataset.ready || slide.dataset.decoding) return;
  if (!img.getAttribute('src')) {
    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    if (img.dataset.src) img.src = img.dataset.src;
  }
  slide.dataset.decoding = '1';
  img
    .decode()
    .then(() => (slide.dataset.ready = '1'))
    .catch(() => delete slide.dataset.decoding); // failed load: retry next round
}

function initSlideshows(container: HTMLElement) {
  if (reducedMotion) return;
  container.querySelectorAll<HTMLElement>('[data-slideshow]').forEach((root, reelIndex) => {
    const slides = gsap.utils.toArray<HTMLElement>('[data-slide]', root);
    if (slides.length < 2) return;

    let index = 0;
    let drift = reelIndex % 2 ? -1 : 1;
    const kenBurns = (slide: HTMLElement) => {
      drift = -drift; // alternate left/right so consecutive stills don't slide the same way
      gsap.fromTo(
        slide,
        { scale: 1, xPercent: 0 },
        { scale: 1.1, xPercent: 2 * drift, duration: REEL_HOLD + REEL_FADE, ease: 'none', overwrite: true },
      );
    };
    kenBurns(slides[0]);
    prepareSlide(slides[0]); // already loading; marks it ready for the loop back

    // First look-ahead waits for the page to settle; later ones follow each change.
    const preloadNext = () => prepareSlide(slides[(index + 1) % slides.length]);
    if ('requestIdleCallback' in window) requestIdleCallback(preloadNext, { timeout: 2500 });
    else setTimeout(preloadNext, 1200);

    const tick = () => {
      if (!root.isConnected) return; // navigated away (Barba swap): stop
      const next = slides[(index + 1) % slides.length];
      if (!document.hidden && next.dataset.ready) {
        const prev = slides[index];
        prev.classList.replace('is-current', 'is-prev');
        next.hidden = false;
        void next.offsetWidth; // commit opacity: 0 so adding .is-current fades it in
        next.classList.add('is-current');
        kenBurns(next);
        index = (index + 1) % slides.length;
        // Once covered, take the previous still out of rendering entirely.
        gsap.delayedCall(REEL_FADE, () => {
          prev.classList.remove('is-prev');
          prev.hidden = true;
          gsap.killTweensOf(prev);
        });
        preloadNext();
      } else {
        prepareSlide(next); // not requested / decoded yet — try again next beat
      }
      gsap.delayedCall(REEL_HOLD, tick);
    };
    gsap.delayedCall(REEL_HOLD + reelIndex * REEL_STAGGER, tick);
  });
}

/**
 * Videos "coming soon" poster: the fake player bar runs once per reel cycle
 * (so it reads as a film playing), and the fake play button only teases.
 */
function initFakePlayer(container: HTMLElement) {
  const play = container.querySelector<HTMLElement>('[data-fake-play]');
  if (!play) return;
  const fill = container.querySelector<HTMLElement>('[data-fake-fill]');
  const time = container.querySelector<HTMLElement>('[data-fake-time]');
  const slides = container.querySelectorAll('[data-slideshow] [data-slide]').length || 1;
  const cycle = slides * REEL_HOLD;

  if (fill && time && !reducedMotion) {
    gsap.fromTo(
      fill,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: cycle,
        ease: 'none',
        repeat: -1,
        // `this`, not the returned tween: fromTo renders (and calls this)
        // before gsap.fromTo() returns — referencing the const there threw,
        // which froze the home → Videos transition on its photo clone.
        onUpdate(this: gsap.core.Tween) {
          if (!fill.isConnected) return void this.kill();
          const s = Math.floor(this.progress() * cycle);
          time.textContent = `0:${String(s).padStart(2, '0')}`;
        },
      },
    );
  }

  let timer = 0;
  play.addEventListener('click', () => {
    play.classList.remove('is-pressed');
    void play.offsetWidth; // restart the press animation
    play.classList.add('is-pressed', 'is-teasing');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => play.classList.remove('is-teasing', 'is-pressed'), 2600);
  });
}

function initBackToTop(container: HTMLElement) {
  container.querySelector('[data-back-to-top]')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  });
}

function initMenu(container: HTMLElement) {
  const btn = container.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = container.querySelector<HTMLElement>('[data-mobile-menu]');
  if (!btn || !menu) return;
  const links = menu.querySelectorAll('a');

  const open = () => {
    btn.setAttribute('aria-expanded', 'true');
    btn.classList.add('is-open');
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('menu-open');
    if (!reducedMotion) {
      gsap.fromTo(
        menu,
        { clipPath: 'inset(0 0 100% 0)' },
        { clipPath: 'inset(0 0 0% 0)', duration: 0.5, ease: 'power3.inOut' },
      );
      gsap.fromTo(
        links,
        { y: 44, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out', stagger: 0.06, delay: 0.18 },
      );
    }
  };

  const close = () => {
    btn.setAttribute('aria-expanded', 'false');
    btn.classList.remove('is-open');
    document.documentElement.classList.remove('menu-open');
    const finish = () => {
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      gsap.set(menu, { clearProps: 'clipPath' });
    };
    if (reducedMotion) finish();
    else
      gsap.to(menu, {
        clipPath: 'inset(0 0 100% 0)',
        duration: 0.4,
        ease: 'power3.inOut',
        onComplete: finish,
      });
  };

  btn.addEventListener('click', () =>
    btn.getAttribute('aria-expanded') === 'true' ? close() : open(),
  );
}

type LightboxData = {
  index: number;
  labels: { zoom: string; close: string; prev: string; next: string };
  photos: {
    url: string;
    src: string;
    srcset: string;
    width: number;
    height: number;
    msrc: string;
    alt: string;
  }[];
};

/** PhotoSwipe is only loaded the first time the viewer is opened. */
let lightboxModule: Promise<typeof import('photoswipe/lightbox')> | null = null;

type ViewerOptions = {
  photos: Omit<LightboxData['photos'][number], 'url'>[];
  index: number;
  labels: LightboxData['labels'];
  /** Element to zoom from/to for a photo; none = fade. */
  thumbFor?: (index: number) => HTMLElement | null | undefined;
  /** Called with the index the viewer was closed on. */
  onClose?: (index: number) => void;
};

/**
 * The fullscreen viewer (PhotoSwipe), shared by the photo page and the
 * Photography gallery: real zoom, swipe/arrows between photos, site icons.
 */
async function openViewer(o: ViewerOptions) {
  lightboxModule ??= import('photoswipe/lightbox');
  const { default: PhotoSwipeLightbox } = await lightboxModule;

  const lightbox = new PhotoSwipeLightbox({
    dataSource: o.photos,
    pswpModule: () => import('photoswipe'),
    bgOpacity: 1,
    wheelToZoom: true,
    showHideAnimationType: reducedMotion ? 'none' : 'zoom',
    closeTitle: o.labels.close,
    zoomTitle: o.labels.zoom,
    arrowPrevTitle: o.labels.prev,
    arrowNextTitle: o.labels.next,
    // Reuse the same glyphs as the detail page's own prev/next arrows —
    // one consistent set of icons instead of PhotoSwipe's defaults.
    arrowPrevSVG: '<span class="pswp__icn-glyph" aria-hidden="true">←</span>',
    arrowNextSVG: '<span class="pswp__icn-glyph" aria-hidden="true">→</span>',
    closeSVG: '<span class="pswp__icn-glyph pswp__icn-glyph--close" aria-hidden="true">×</span>',
    // Thin-line magnifier, styled to match; reuses PhotoSwipe's own
    // "+" -> "-" class names so the built-in zoomed-in toggle still works.
    zoomSVG:
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
      '<circle cx="10" cy="10" r="6.5"/><line x1="14.8" y1="14.8" x2="20.5" y2="20.5"/>' +
      '<line class="pswp__zoom-icn-bar-h" x1="7" y1="10" x2="13" y2="10"/>' +
      '<line class="pswp__zoom-icn-bar-v" x1="10" y1="7" x2="10" y2="13"/></svg>',
  });
  lightbox.addFilter('thumbEl', (thumbEl, _itemData, index) => o.thumbFor?.(index) ?? (thumbEl as HTMLElement));

  // Touch devices get no arrow buttons (PhotoSwipe hides them until a
  // mouse is used) — swiping already works, but isn't obvious on first
  // open, so show a quiet hint that fades on its own or on first swipe.
  if (o.photos.length > 1) {
    lightbox.on('uiRegister', () => {
      lightbox.pswp?.ui?.registerElement({
        name: 'swipeHint',
        className: 'pswp__swipe-hint',
        appendTo: 'wrapper',
        html: '<span class="pswp__icn-glyph">←</span><span class="pswp__icn-glyph">→</span>',
      });
    });
    // `change` fires once just for setting the opening slide, then again
    // per real navigation — only the latter should dismiss the hint.
    let changeCount = 0;
    lightbox.on('change', () => {
      if (changeCount++ > 0) lightbox.pswp?.element?.classList.add('pswp__swipe-hint-dismissed');
    });
  }

  let lastIndex = o.index;
  lightbox.on('change', () => {
    lastIndex = lightbox.pswp?.currIndex ?? lastIndex;
  });
  lightbox.on('destroy', () => o.onClose?.(lastIndex));
  lightbox.init();
  lightbox.loadAndOpen(o.index);
}

function initDetail(container: HTMLElement) {
  const hero = container.querySelector<HTMLElement>('[data-detail-hero]');
  const zoomBtn = hero?.querySelector<HTMLElement>('[data-zoom-toggle]');
  const dataEl = container.querySelector<HTMLScriptElement>('[data-lightbox-data]');
  if (!hero || !zoomBtn || !dataEl) return;
  const data: LightboxData = JSON.parse(dataEl.textContent ?? '{}');

  // Native image drag swallows pointerup and kills the swipe gesture.
  hero.querySelectorAll('img').forEach((img) => (img.draggable = false));

  const openLightbox = () =>
    openViewer({
      photos: data.photos,
      index: data.index,
      labels: data.labels,
      // Open/close zooms from/to the hero — but only for this page's own
      // photo; after swiping to another one the close falls back to a fade.
      thumbFor: (i) => (i === data.index ? hero.querySelector('img') : null),
      onClose: (last) => {
        if (last === data.index) return;
        // The viewer closed on a different photo: catch the page up, waving
        // in the direction the user was browsing (shorter way around).
        const len = data.photos.length;
        const forward = (last - data.index + len) % len;
        pendingNavDir = forward <= len - forward ? 'next' : 'prev';
        const url = data.photos[last].url;
        if (useBarba) barba.go(url);
        else location.assign(url);
      },
    });

  // Tap = open the fullscreen viewer; horizontal drag = previous/next photo.
  let startX = 0;
  let startY = 0;
  let swiped = false;
  zoomBtn.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    swiped = false;
  });
  zoomBtn.addEventListener('pointerup', (e) => {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = true;
      const dir = dx > 0 ? 'prev' : 'next';
      container.querySelector<HTMLAnchorElement>(`[data-nav-dir="${dir}"]`)?.click();
    }
  });
  zoomBtn.addEventListener('click', () => {
    if (swiped) return;
    void openLightbox();
  });
}

/**
 * Warms the browser cache for the prev/next hero images (same URL the real
 * navigation will request — see heroPrefetchUrl() in [id].astro, must stay
 * in sync) so by the time someone actually clicks, it's already loaded.
 * Deferred via requestIdleCallback so it never competes with the current
 * photo's own load.
 */
/**
 * Photography: an endless strip of square photos (after detroit.paris). Each
 * item sits at x = i·spacing − position along a looping track and is scaled by
 * where it is: tiny on the left, large on the right, bigger ones on top. The
 * translate is applied inside the scale, so screen x = x·scale and the gaps
 * widen towards the right, the "staircase". Wheel, drag, swipe and ←/→ move
 * it; switching gallery folds the stairs away and grows the new set in.
 * Only the handful of on-screen items are rendered; the rest stay [hidden].
 */
const STRIP_SPACING = 0.5; // between items, as a fraction of the base size

function stripConfig(width: number) {
  if (width < 1024) return { min: 0.3, max: 1.4, base: 0.46 };
  return { min: 0.055, max: 1.6, base: 0.29 };
}

/**
 * Phones keep a plain vertical list (full-width photos in their own shape):
 * on a narrow screen the strip could only show one photo properly and the
 * rest as slivers. The strip runs from 768px up; the two swap when the width
 * crosses that line (e.g. rotating a phone).
 */
const PHONE_LIST = '(max-width: 767px)';

type GalleryMode = (container: HTMLElement, strip: HTMLElement, ctrl: AbortController) => void;

function initGallery(container: HTMLElement) {
  const strip = container.querySelector<HTMLElement>('[data-strip]');
  if (!strip) return;
  const mq = window.matchMedia(PHONE_LIST);
  let ctrl = new AbortController();
  const start = () => ((mq.matches ? initGalleryList : initStrip) as GalleryMode)(container, strip, ctrl);
  const onChange = () => {
    ctrl.abort();
    if (!strip.isConnected) return mq.removeEventListener('change', onChange);
    ctrl = new AbortController();
    start();
  };
  mq.addEventListener('change', onChange);
  start();
}

const pressedGallery = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-filter][aria-pressed="true"]')?.dataset.filter ?? 'all';

/**
 * Clicking a gallery photo opens it straight in the fullscreen viewer, over
 * the photos of the chosen gallery (Jeremy: skip the photo page). Plain
 * clicks only — cmd/ctrl/middle-click still open the photo page in a new tab.
 * Returns true when it took the click.
 */
function openFromGallery(
  e: MouseEvent,
  strip: HTMLElement,
  filter: string,
  // zoomFromThumb: the phone list's photos are uncropped, so the viewer can
  // grow out of them; the strip's are cropped + scaled, so it fades instead.
  extra: { zoomFromThumb: boolean; onClose?: (el: HTMLAnchorElement) => void },
) {
  const link = (e.target as Element).closest<HTMLAnchorElement>('.strip-item');
  if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  e.preventDefault();
  e.stopPropagation(); // Barba listens on document and would navigate
  // Originals only (clones in the strip are aria-hidden), in gallery order.
  const members = [...strip.querySelectorAll<HTMLAnchorElement>('.strip-item:not([aria-hidden])')].filter(
    (el) => filter === 'all' || el.dataset.category === filter,
  );
  const index = Math.max(0, members.findIndex((el) => el.dataset.photoLink === link.dataset.photoLink));
  void openViewer({
    photos: members.map((el) => ({
      src: el.dataset.pswpSrc!,
      srcset: el.dataset.pswpSrcset!,
      width: Number(el.dataset.pswpW),
      height: Number(el.dataset.pswpH),
      msrc: el.dataset.pswpMsrc!,
      alt: el.dataset.title ?? '',
    })),
    index,
    labels: JSON.parse(strip.dataset.viewerLabels ?? '{}'),
    thumbFor: extra.zoomFromThumb ? (i) => members[i]?.querySelector('img') : undefined,
    onClose: (last) => extra.onClose?.(members[last]),
  });
  return true;
}

/** Phones: vertical list, filtered in place, photos rise in as they scroll into view. */
function initGalleryList(container: HTMLElement, strip: HTMLElement, ctrl: AbortController) {
  const { signal } = ctrl;
  const items = gsap.utils.toArray<HTMLAnchorElement>('.strip-item', strip);
  const buttons = container.querySelectorAll<HTMLButtonElement>('[data-filter]');
  let filter = pressedGallery(container);

  items.forEach((el) => (el.querySelector('img')!.sizes = '92vw'));
  const apply = () =>
    items.forEach((el) => (el.hidden = !(filter === 'all' || el.dataset.category === filter)));

  const io = reducedMotion
    ? null
    : new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.remove('is-pending');
            io!.unobserve(entry.target);
          }),
        { rootMargin: '0px 0px -8% 0px' },
      );
  const watch = () => {
    if (!io) return;
    io.disconnect();
    items.forEach((el) => {
      if (el.hidden) return;
      el.classList.add('is-pending');
      io.observe(el);
    });
  };

  buttons.forEach((btn) =>
    btn.addEventListener(
      'click',
      () => {
        const next = btn.dataset.filter!;
        if (next === filter) return;
        filter = next;
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        if (reducedMotion) return apply();
        gsap.to(strip, {
          autoAlpha: 0,
          duration: 0.25,
          onComplete: () => {
            apply();
            // Back to the top of the list if we were scrolled into it.
            const top = strip.getBoundingClientRect().top + window.scrollY - 160;
            if (window.scrollY > top) window.scrollTo(0, Math.max(0, top));
            watch();
            gsap.to(strip, { autoAlpha: 1, duration: 0.35 });
          },
        });
      },
      { signal },
    ),
  );
  strip.addEventListener(
    'click',
    (e) =>
      openFromGallery(e, strip, filter, {
        zoomFromThumb: true,
        // Closed on another photo further down/up: bring it into view.
        onClose: (el) => {
          const r = el?.getBoundingClientRect();
          if (r && (r.bottom < 0 || r.top > window.innerHeight)) el.scrollIntoView({ block: 'center' });
        },
      }),
    { capture: true, signal },
  );
  signal.addEventListener('abort', () => {
    io?.disconnect();
    gsap.killTweensOf(strip);
    gsap.set(strip, { clearProps: 'opacity,visibility' });
    items.forEach((el) => el.classList.remove('is-pending'));
  });

  apply();
  watch();
  strip.classList.add('is-ready');
}

/** Tablet/desktop: the endless strip (see the comment above STRIP_SPACING). */
function initStrip(container: HTMLElement, strip: HTMLElement, ctrl: AbortController) {
  const items = gsap.utils.toArray<HTMLAnchorElement>('.strip-item', strip);
  const buttons = container.querySelectorAll<HTMLButtonElement>('[data-filter]');
  const tag = strip.querySelector<HTMLElement>('[data-strip-tag]')!;
  const tagText = tag.querySelector<HTMLElement>('[data-strip-tag-text]')!;
  const { signal } = ctrl;

  type Slot = { el: HTMLAnchorElement; img: HTMLImageElement; aspect: number; shown: boolean; L: number; r: number };
  let slots: Slot[] = [];
  let clones: HTMLAnchorElement[] = [];
  let filter = 'all';
  let hovered: HTMLAnchorElement | null = null;

  // Geometry, in px: strip width/height, base item size, the scale of the
  // right-most visible item (sets the rendered size) and that size.
  let V = 0;
  let H = 0;
  let base = 0;
  let sTop = 1;
  let xEdge = 0; // track position where an item reaches the right edge
  let size = 0;
  let ratio = 1; // box height / width
  let cfg = stripConfig(window.innerWidth);
  const state = { current: 0, target: 0, shift: 0, appear: 1 };
  let dirty = true;

  const scaleAt = (x: number) => cfg.min + gsap.utils.clamp(0, 1, (x + base / 2) / V) * (cfg.max - cfg.min);
  const spacing = () => base * STRIP_SPACING;

  function measure() {
    cfg = stripConfig(window.innerWidth);
    V = strip!.clientWidth;
    H = strip!.clientHeight;
    base = cfg.base * V;
    // The item reaching the right edge is the biggest one on screen; shrink
    // the base until that one fits the strip's height.
    for (let k = 0; k < 4; k++) {
      let lo = 0;
      let hi = V;
      for (let j = 0; j < 30; j++) {
        const mid = (lo + hi) / 2;
        if (mid * scaleAt(mid) < V) lo = mid;
        else hi = mid;
      }
      sTop = scaleAt(lo);
      xEdge = lo;
      base = Math.min(cfg.base * V, (H * 0.97) / sTop);
    }
    size = base * sTop;
    // Square on desktop; on tall phone/tablet screens width runs out first,
    // so the boxes turn portrait to fill the height instead of leaving a gap.
    const fill = (H * 0.97) / size;
    ratio = V < 1024 && Number.isFinite(fill) ? Math.min(1.5, Math.max(1, fill)) : 1;
    strip!.style.setProperty('--strip-w', `${size.toFixed(1)}px`);
    strip!.style.setProperty('--strip-ratio', ratio.toFixed(3));
    for (const el of [...items, ...clones]) {
      const img = el.querySelector('img')!;
      const aspect = img.width / img.height || 1;
      // Cover-fit into the box, 115% wide for the drift.
      img.sizes = `${Math.ceil(size * Math.max(1.15, ratio * aspect))}px`;
    }
  }

  function build() {
    clones.forEach((c) => c.remove());
    clones = [];
    const members = items.filter((el) => filter === 'all' || el.dataset.category === filter);
    items.forEach((el) => (el.hidden = true));
    // Small galleries repeat so the loop is always longer than the screen.
    const need = Math.ceil((V * 1.1 + 3 * base) / spacing());
    const list = [...members];
    while (members.length && list.length < need) {
      for (const el of members) {
        const copy = el.cloneNode(true) as HTMLAnchorElement;
        copy.setAttribute('aria-hidden', 'true');
        copy.tabIndex = -1;
        copy.hidden = true;
        strip!.insertBefore(copy, tag);
        markLoaded(copy.querySelector('img')!);
        clones.push(copy);
        list.push(copy);
      }
    }
    slots = list.map((el) => {
      const img = el.querySelector('img')!;
      return { el, img, aspect: img.width / img.height || 1, shown: false, L: 0, r: 0 };
    });
    measure();
    dirty = true;
  }

  function render() {
    const total = spacing() * slots.length;
    if (!total) return;
    // Keep numbers small: wrap the position once it passes a full loop.
    if (state.current > total || state.current < 0) {
      const wrap = Math.floor(state.current / total) * total;
      state.current -= wrap;
      state.target -= wrap;
      drag.start -= wrap;
    }
    const pos = state.current + state.shift;
    slots.forEach((slot, i) => {
      let x = (((i * spacing() - pos) % total) + total) % total;
      if (x > total - base) x -= total;
      const s0 = scaleAt(x);
      const s = s0 * state.appear;
      const L = x * s;
      const r = s / sTop;
      // Only the stretch of track that's on screen at rest, even while the
      // stairs fold/grow: mid-switch everything crams into the left corner
      // and ~20 photos would be drawn at once — too many GPU layers (the
      // home page "flash" lesson, see AGENTS.md).
      const visible = s > 0.002 && x > -base && x < xEdge + spacing() && L < V && L + size * r > 0;
      // Warm up images about to come on screen, from either end.
      if (slot.img.loading === 'lazy' && x > -4 * spacing() && x < V + 4 * spacing()) slot.img.loading = 'eager';
      if (visible !== slot.shown) {
        slot.el.hidden = !visible;
        slot.shown = visible;
      }
      if (!visible) return;
      slot.L = L;
      slot.r = r;
      slot.el.style.transform = `translate3d(${L.toFixed(2)}px,0,0) scale(${r.toFixed(4)})`;
      slot.el.style.zIndex = String(Math.round(s * 1000));
      // Fade only at the very start: overlapping see-through boxes look muddy.
      slot.el.style.opacity = state.appear < 0.25 ? (state.appear * 4).toFixed(3) : '';
      // The photo drifts inside its frame as the frame grows.
      const p = (s0 - cfg.min) / (cfg.max - cfg.min);
      slot.img.style.transform = `translate3d(${(-13 * (1 - p)).toFixed(2)}%,0,0)`;
    });

    const slot = hovered && slots.find((sl) => sl.el === hovered);
    if (slot && slot.shown && !drag.active) {
      tag.style.transform = `translate3d(${slot.L.toFixed(1)}px, ${(-size * ratio * slot.r).toFixed(1)}px, 0)`;
      tag.classList.add('is-visible');
    } else tag.classList.remove('is-visible');
  }

  // Intro, and the second half of a gallery switch: the stairs grow in from
  // the left while sliding into place.
  function intro() {
    if (reducedMotion) {
      state.appear = 1;
      return;
    }
    state.shift = 0.42 * V;
    state.appear = 0;
    gsap.to(state, { shift: 0, appear: 1, duration: 1.5, ease: 'power2.out', onUpdate: () => void (dirty = true) });
  }

  // Any input ends the intro's slide (its remaining offset folds into the
  // position, so nothing jumps); the fade-in keeps going.
  function takeOver() {
    if (!state.shift) return;
    const appear = state.appear;
    gsap.killTweensOf(state);
    state.current += state.shift;
    state.target += state.shift;
    state.shift = 0;
    if (appear < 1) gsap.to(state, { appear: 1, duration: 0.6, ease: 'power2.out', onUpdate: () => void (dirty = true) });
  }

  function switchTo(next: string) {
    if (next === filter) return;
    filter = next;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === next)));
    hovered = null;
    const swap = () => {
      build();
      state.current = state.target = 0;
      intro();
    };
    if (reducedMotion) return swap();
    gsap.killTweensOf(state);
    state.current += state.shift;
    state.target = state.current;
    state.shift = 0;
    gsap.to(state, { appear: 0, duration: 0.5, ease: 'power3.in', onUpdate: () => void (dirty = true), onComplete: swap });
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => switchTo(btn.dataset.filter!), { signal });
    // Start fetching a gallery's first photos as soon as it's pointed at, so
    // they're ready when its stairs grow in.
    btn.addEventListener(
      'pointerenter',
      () =>
        items
          .filter((el) => btn.dataset.filter === 'all' || el.dataset.category === btn.dataset.filter)
          .slice(0, 8)
          .forEach((el) => (el.querySelector('img')!.loading = 'eager')),
      { signal, once: true },
    );
  });

  // Wheel anywhere on the page moves the strip (unless the page itself needs
  // to scroll and the pointer isn't over the strip — a very short window).
  container.addEventListener(
    'wheel',
    (e) => {
      const pageScrolls = document.documentElement.scrollHeight > window.innerHeight + 2;
      if (pageScrolls && !strip.contains(e.target as Node)) return;
      e.preventDefault();
      takeOver();
      const unit = e.deltaMode === 1 ? 16 : 1;
      state.target += (e.deltaX - e.deltaY) * 0.5 * unit;
    },
    { passive: false, signal },
  );

  // Drag (mouse) and swipe (touch; vertical swipes still scroll the page).
  const drag = { active: false, moved: false, x: 0, start: 0, lastX: 0, lastT: 0, v: 0 };
  strip.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return;
      takeOver();
      Object.assign(drag, { active: true, moved: false, x: e.clientX, start: state.current, lastX: e.clientX, lastT: e.timeStamp, v: 0 });
    },
    { signal },
  );
  window.addEventListener(
    'pointermove',
    (e) => {
      if (!drag.active) return;
      const dx = drag.x - e.clientX;
      if (!drag.moved && Math.abs(dx) > 6) {
        drag.moved = true;
        strip.classList.add('is-dragging');
      }
      state.target = drag.start + dx;
      const dt = e.timeStamp - drag.lastT;
      if (dt > 0) drag.v = gsap.utils.interpolate(drag.v, (drag.lastX - e.clientX) / dt, 0.4);
      drag.lastX = e.clientX;
      drag.lastT = e.timeStamp;
    },
    { signal },
  );
  const release = (e: PointerEvent) => {
    if (!drag.active) return;
    drag.active = false;
    strip.classList.remove('is-dragging');
    if (e.pointerType === 'touch' && drag.moved) state.target += drag.v * 260; // fling
  };
  window.addEventListener('pointerup', release, { signal });
  window.addEventListener('pointercancel', release, { signal });
  // A drag that ends over a photo must not open it; a click opens the viewer.
  strip.addEventListener(
    'click',
    (e) => {
      if (drag.moved) {
        e.preventDefault();
        e.stopPropagation();
        drag.moved = false;
        return;
      }
      openFromGallery(e, strip, filter, {
        zoomFromThumb: false,
        // Glide the strip so the photo the viewer closed on sits large on the
        // right, the shorter way round the loop.
        onClose: (el) => {
          const j = slots.findIndex((sl) => sl.el === el);
          const total = spacing() * slots.length;
          if (j < 0 || !total) return;
          const want = j * spacing() - (xEdge - 1.5 * spacing());
          let delta = (((want - state.current) % total) + total) % total;
          if (delta > total / 2) delta -= total;
          state.target = state.current + delta;
        },
      });
    },
    { capture: true, signal },
  );
  strip.addEventListener('dragstart', (e) => e.preventDefault(), { signal });
  strip.addEventListener(
    'pointerover',
    (e) => {
      const link = (e.target as Element).closest<HTMLAnchorElement>('.strip-item');
      if (!link || e.pointerType === 'touch') return;
      hovered = link;
      tagText.textContent = link.dataset.title ?? '';
      dirty = true;
    },
    { signal },
  );
  strip.addEventListener('pointerleave', () => ((hovered = null), (dirty = true)), { signal });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (document.querySelector('.pswp')) return; // the viewer owns arrows
      takeOver();
      state.target += (e.key === 'ArrowRight' ? 2 : -2) * spacing();
    },
    { signal },
  );
  window.addEventListener(
    'resize',
    () => {
      // Crossing into phone width: the list takes over (its matchMedia
      // handler aborts this mode) — don't measure the list's layout here.
      if (window.matchMedia(PHONE_LIST).matches) return;
      const at = state.current / spacing();
      build();
      state.current = state.target = at * spacing();
    },
    { signal },
  );

  // Handing over to the phone list (or leaving the page): undo everything.
  signal.addEventListener('abort', () => {
    gsap.killTweensOf(state);
    clones.forEach((c) => c.remove());
    items.forEach((el) => {
      el.style.transform = el.style.zIndex = el.style.opacity = '';
      el.querySelector('img')!.style.transform = '';
    });
    strip.style.removeProperty('--strip-w');
    strip.style.removeProperty('--strip-ratio');
    strip.classList.remove('is-dragging');
    tag.classList.remove('is-visible');
  });

  // Keeps the gallery chosen in the phone list when the modes swap live.
  filter = pressedGallery(container);
  build();
  intro();
  strip.classList.add('is-ready');

  let last = performance.now();
  const tick = (now: number) => {
    if (signal.aborted) return;
    if (!strip.isConnected) return ctrl.abort();
    const dt = Math.min(64, now - last);
    last = now;
    const gap = state.target - state.current;
    if (Math.abs(gap) > 0.05) {
      state.current += gap * (1 - Math.pow(1 - (drag.active ? 0.1 : 0.06), dt / 16.67));
      dirty = true;
    }
    if (dirty) {
      dirty = false;
      render();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function initPrefetch(container: HTMLElement) {
  const links = container.querySelectorAll<HTMLAnchorElement>('[data-prefetch-src]');
  if (!links.length) return;

  const warm = () => {
    links.forEach((link) => {
      const src = link.dataset.prefetchSrc;
      if (src) new Image().src = src;
    });
  };

  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 2000 });
  else setTimeout(warm, 300);
}

/* ---------------- parallax ---------------- */

type ParallaxItem = { el: HTMLElement; speed: number; scale: number };
let parallaxItems: ParallaxItem[] = [];
let parallaxTicking = false;

function updateParallax() {
  const vh = window.innerHeight;
  for (const { el, speed, scale } of parallaxItems) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < -160 || rect.top > vh + 160) continue;
    const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
    const shift = (-progress * speed * 100).toFixed(2);
    el.style.transform = `translate3d(0, ${shift}px, 0)${scale !== 1 ? ` scale(${scale})` : ''}`;
  }
  parallaxTicking = false;
}

function requestParallax() {
  if (parallaxTicking) return;
  parallaxTicking = true;
  requestAnimationFrame(updateParallax);
}

window.addEventListener('scroll', requestParallax, { passive: true });
window.addEventListener('resize', requestParallax);

function initParallax(container: HTMLElement) {
  parallaxItems = [];
  if (reducedMotion) return;

  // Elements opting in via data-parallax="<speed>".
  container.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
    parallaxItems.push({ el, speed: parseFloat(el.dataset.parallax || '0.12'), scale: 1 });
  });

  updateParallax();
}

function initPage(container: HTMLElement) {
  // Barba also fires afterEnter for the initial load — never init twice
  // (double-bound listeners made one burger tap open AND close the menu).
  if (container.dataset.appInit === '1') return;
  container.dataset.appInit = '1';
  // Each feature is isolated: this runs inside Barba's afterEnter, and one
  // throwing used to abort the rest of the transition — the home → Videos
  // photo clone then stayed on screen and the page looked frozen.
  const features = [
    initImages,
    initHome,
    initSlideshows,
    initGallery,
    initFakePlayer,
    initBackToTop,
    initMenu,
    initDetail,
    initPrefetch,
    initHero,
    initReveals,
    initParallax,
  ];
  for (const init of features) {
    try {
      init(container);
    } catch (err) {
      console.error(`${init.name} failed`, err);
    }
  }
}

/* ---------------- theme toggle (event delegation, survives Barba swaps) ---------------- */

document.addEventListener('click', (e) => {
  if (!(e.target instanceof Element) || !e.target.closest('[data-theme-toggle]')) return;
  const root = document.documentElement;
  const dark = root.dataset.theme === 'dark';
  if (dark) delete root.dataset.theme;
  else root.dataset.theme = 'dark';
  localStorage.setItem('theme', dark ? 'light' : 'dark');
});

/* ---------------- custom cursor ---------------- */

/** Re-evaluates the cursor for an element whose label changed under it. */
let refreshCursor: ((target: Element | null) => void) | null = null;

function initCursor() {
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (reducedMotion || !finePointer) return;

  const cursor = document.querySelector<HTMLElement>('.cursor');
  const dot = cursor?.querySelector<HTMLElement>('.cursor-dot');
  const ring = cursor?.querySelector<HTMLElement>('.cursor-ring');
  const label = cursor?.querySelector<HTMLElement>('.cursor-label');
  if (!cursor || !dot || !ring || !label) return;

  document.documentElement.classList.add('has-cursor');
  cursor.classList.add('is-hidden');

  const dotX = gsap.quickTo(dot, 'x', { duration: 0.05, ease: 'power3' });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.05, ease: 'power3' });
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.18, ease: 'power3' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.18, ease: 'power3' });

  window.addEventListener('pointermove', (e) => {
    cursor.classList.remove('is-hidden');
    dotX(e.clientX);
    dotY(e.clientY);
    ringX(e.clientX);
    ringY(e.clientY);
  });

  const setState = (target: Element | null) => {
    const labelled = target?.closest<HTMLElement>('[data-cursor-label]');
    const interactive = target?.closest('a, button, [data-cursor-label]');
    cursor.classList.toggle('is-view', !!labelled);
    cursor.classList.toggle('is-hover', !!interactive && !labelled);
    if (labelled) label.textContent = labelled.dataset.cursorLabel ?? '';
  };

  refreshCursor = setState;
  document.addEventListener('pointerover', (e) => setState(e.target as Element));
  document.addEventListener('pointerout', (e) => setState(e.relatedTarget as Element | null));
  document.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
  document.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
  document.documentElement.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
  document.documentElement.addEventListener('mouseenter', () => cursor.classList.remove('is-hidden'));

  return cursor;
}

const cursorEl = initCursor();

/* ---------------- transitions ---------------- */

/**
 * Curved wave sweep, adapted from GreenSock's "morphSVG curve manipulation"
 * pen (codepen.io/GreenSock/pen/EaKpEpJ): the covering edge bulges through a
 * quadratic curve mid-flight and flattens at rest. Cover comes up from the
 * bottom; reveal continues off the top. Gradient uses our accent palette.
 */
const WAVE = {
  hidden: 'M 0 100 V 100 Q 50 100 100 100 V 100 z',
  mid: 'M 0 100 V 50 Q 50 0 100 50 V 100 z', // the pen's "start"
  cover: 'M 0 100 V 0 Q 50 0 100 0 V 100 z', // the pen's "end"
  midOut: 'M 0 0 V 50 Q 50 100 100 50 V 0 z',
  gone: 'M 0 0 V 0 Q 50 0 100 0 V 0 z',
};

// Transpose of WAVE: sweeps left → right ('right' mirrors it via scaleX).
const WAVE_H = {
  hidden: 'M 0 0 H 0 Q 0 50 0 100 H 0 z',
  mid: 'M 0 0 H 50 Q 100 50 50 100 H 0 z',
  cover: 'M 0 0 H 100 Q 100 50 100 100 H 0 z',
  midOut: 'M 100 0 H 50 Q 0 50 50 100 H 100 z',
  gone: 'M 100 0 H 100 Q 100 50 100 100 H 100 z',
};

const waveSvg = document.querySelector<SVGSVGElement>('.transition-wave');
const wavePath = waveSvg?.querySelector<SVGPathElement>('.transition-wave__path');
const waveStops = waveSvg?.querySelectorAll<SVGStopElement>('.transition-wave__stop');

const WAVE_STEP = 0.32; // per-morph duration at speed 1

type WaveOptions = { from?: 'bottom' | 'top' | 'left' | 'right'; speed?: number };

// waveOut must finish on the same axis waveIn started on.
let waveKeyframes = WAVE;

function waveIn({ from = 'bottom', speed = 1 }: WaveOptions = {}): gsap.core.Timeline {
  const [accent, soft] = accentColors();
  waveStops?.[0]?.setAttribute('stop-color', accent);
  waveStops?.[1]?.setAttribute('stop-color', soft);
  waveKeyframes = from === 'left' || from === 'right' ? WAVE_H : WAVE;
  waveSvg!.dataset.waveFrom = from; // observable in tests/devtools
  const tl = gsap.timeline({ defaults: { duration: WAVE_STEP / speed } });
  tl.set(waveSvg!, {
    visibility: 'visible',
    scaleY: from === 'top' ? -1 : 1,
    scaleX: from === 'right' ? -1 : 1,
  })
    .set(wavePath!, { attr: { d: waveKeyframes.hidden } })
    .to(wavePath!, { morphSVG: waveKeyframes.mid, ease: 'power2.in' })
    .to(wavePath!, { morphSVG: waveKeyframes.cover, ease: 'power2.out' });
  return tl;
}

function waveOut({ speed = 1 }: WaveOptions = {}): gsap.core.Timeline {
  const kf = waveKeyframes;
  const tl = gsap.timeline({ defaults: { duration: WAVE_STEP / speed } });
  tl.to(wavePath!, { morphSVG: kf.midOut, ease: 'power2.in' })
    .to(wavePath!, { morphSVG: kf.gone, ease: 'power2.out' })
    .set(waveSvg!, { visibility: 'hidden', scaleY: 1, scaleX: 1 })
    .set(wavePath!, { attr: { d: kf.hidden } });
  return tl;
}

/*
 * Barba resolves the transition BEFORE the next page is fetched, so
 * `next.namespace` is only populated on cache hits — a predicate built on it
 * silently falls back to another transition on every first visit. All
 * predicates below therefore decide from `current` + the clicked trigger
 * only. (Among equal-priority custom transitions Barba also checks the
 * LAST-defined first, so they must stay mutually exclusive.)
 */
function navDirFrom(trigger: unknown): HTMLElement | null {
  return trigger instanceof HTMLElement ? trigger.closest('[data-nav-dir]') : null;
}

function homePanelFrom(trigger: unknown): HTMLElement | null {
  return trigger instanceof HTMLElement ? trigger.closest('[data-home-panel]') : null;
}

/** Locale switcher links are the ones carrying a `lang` attribute. */
function isLangSwitch(trigger: unknown): boolean {
  return trigger instanceof HTMLElement && trigger.closest('a[lang]') !== null;
}

/** The home panel's photo, carried across the home → section transition. */
let panelClone: HTMLElement | null = null;

/**
 * Direction override for the next photo→photo transition. Set by the
 * lightbox when it closes on a different photo than it opened on (there the
 * Barba trigger is programmatic, so `[data-nav-dir]` detection can't work).
 */
let pendingNavDir: 'prev' | 'next' | null = null;

function initBarba() {
  barba.init({
    prevent: ({ el }) => el.hasAttribute('data-no-barba'),
    transitions: [
      {
        // Clicked the open home panel: its photo grows to fill the screen,
        // the page swaps underneath, then the photo wipes upward off it.
        name: 'panel-expand',
        custom: ({ trigger }) => homePanelFrom(trigger) !== null,
        async leave({ current, trigger }) {
          const panel = homePanelFrom(trigger)!;
          // The still on screen right now (a reel panel has several).
          const img =
            panel.querySelector<HTMLImageElement>('.reel-slide.is-current .home-panel__img') ??
            panel.querySelector<HTMLImageElement>('.home-panel__img');
          const rect = panel.getBoundingClientRect();

          const clone = document.createElement('div');
          clone.className = 'panel-clone';
          clone.style.backgroundImage = panel.style.backgroundImage;
          if (img) {
            const cloneImg = img.cloneNode(true) as HTMLImageElement;
            cloneImg.removeAttribute('class');
            clone.appendChild(cloneImg);
          }
          const shade = document.createElement('div');
          shade.className = 'panel-clone__shade';
          clone.appendChild(shade);
          Object.assign(clone.style, {
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          });
          document.body.appendChild(clone);
          panelClone = clone;
          panel.style.visibility = 'hidden';

          gsap.to(current.container, { autoAlpha: 0, duration: 0.45, ease: 'power2.in' });
          gsap.to(shade, { autoAlpha: 0, duration: 0.8, ease: 'power2.inOut' });
          await gsap.to(clone, {
            top: 0,
            left: 0,
            width: window.innerWidth,
            height: window.innerHeight,
            borderRadius: 0,
            duration: 0.85,
            ease: 'power4.inOut',
          });
        },
        enter() {
          window.scrollTo(0, 0);
        },
        async after() {
          const clone = panelClone;
          panelClone = null;
          if (!clone) return;
          await gsap.to(clone, {
            clipPath: 'inset(0% 0% 100% 0%)',
            duration: 0.8,
            ease: 'power4.inOut',
          });
          clone.remove();
        },
      },
      {
        // Prev/next between photos: the wave sweeps in the travel direction —
        // next pushes left → right, prev right → left. No transform is
        // applied to the container itself: a CSS transform there would turn
        // it into a new containing block for the position:fixed side arrows,
        // dragging them sideways along with the tween (confirmed bug — the
        // arrows visibly drifted during the transition and snapped back).
        name: 'photo-slide',
        custom: ({ current, trigger }) =>
          current.namespace === 'photo' &&
          (pendingNavDir !== null || navDirFrom(trigger) !== null),
        async leave({ current, trigger }) {
          const dir =
            pendingNavDir ??
            (trigger instanceof HTMLElement && trigger.closest('[data-nav-dir="prev"]')
              ? 'prev'
              : 'next');
          pendingNavDir = null;
          (current.container as HTMLElement).dataset.slideDir = dir;
          await waveIn({ from: dir === 'prev' ? 'right' : 'left', speed: 1.6 });
        },
        enter() {
          window.scrollTo(0, 0);
        },
        async after() {
          await waveOut({ speed: 1.6 });
        },
      },
      {
        // Leaving a photo back to a section: the same wave language, but
        // mirrored — it drops from the top and moves quicker.
        name: 'wave-top',
        custom: ({ current, trigger }) =>
          current.namespace === 'photo' &&
          pendingNavDir === null &&
          navDirFrom(trigger) === null,
        async leave() {
          await waveIn({ from: 'top', speed: 1.35 });
        },
        enter() {
          window.scrollTo(0, 0);
        },
        async after() {
          await waveOut({ speed: 1.35 });
        },
      },
      {
        // Section change: curved wave sweep (GreenSock pen adaptation).
        // The wave covers the old page, the swap happens beneath it, then
        // the wave continues off the top revealing the new page.
        name: 'wave',
        custom: ({ current, trigger }) =>
          current.namespace !== 'photo' &&
          homePanelFrom(trigger) === null &&
          !isLangSwitch(trigger),
        async leave() {
          await waveIn();
        },
        enter() {
          window.scrollTo(0, 0);
        },
        async after() {
          await waveOut();
        },
      },
      {
        // Same section (e.g. language switch): quick scale-down + rise.
        name: 'soft',
        async leave({ current }) {
          await gsap.to(current.container, {
            scale: 0.98,
            autoAlpha: 0,
            duration: 0.3,
            ease: 'power2.in',
          });
        },
        enter({ next }) {
          window.scrollTo(0, 0);
          return gsap.from(next.container, {
            y: 28,
            autoAlpha: 0,
            duration: 0.42,
            ease: 'power3.out',
          });
        },
      },
    ],
  });

  barba.hooks.before(() => {
    document.documentElement.classList.add('is-transitioning');
  });

  barba.hooks.beforeLeave(() => {
    revealObserver?.disconnect();
    revealObserver = null;
    // Old container's elements are going away — stop parallaxing them.
    parallaxItems = [];
  });

  barba.hooks.afterEnter((data) => {
    // Barba swaps only the container — sync <head>-owned state ourselves.
    const nextDoc = new DOMParser().parseFromString(data.next.html, 'text/html');
    document.title = nextDoc.title;
    const lang = nextDoc.documentElement.getAttribute('lang');
    if (lang) document.documentElement.setAttribute('lang', lang);
    const headSelector = 'link[rel="canonical"], link[rel="alternate"], meta[name="description"]';
    document.head.querySelectorAll(headSelector).forEach((el) => el.remove());
    nextDoc.head
      .querySelectorAll(headSelector)
      .forEach((el) => document.head.appendChild(el.cloneNode(true)));

    initPage(data.next.container as HTMLElement);
  });

  barba.hooks.after(() => {
    document.documentElement.classList.remove('is-transitioning');
    // The old container (with its open menu) is gone — release the scroll lock.
    document.documentElement.classList.remove('menu-open');
    // The hovered element is gone after a swap — reset cursor state.
    cursorEl?.classList.remove('is-view', 'is-hover');
  });
}

/* ---------------- boot ---------------- */

const firstContainer = document.querySelector<HTMLElement>('[data-barba="container"]');
if (firstContainer) initPage(firstContainer);
if (useBarba) initBarba();

// Arrow keys navigate between photos (or step the home panels). While the
// lightbox is open PhotoSwipe owns the keyboard (Escape and arrows) — don't
// also navigate underneath it.
document.addEventListener('keydown', (e) => {
  if (document.querySelector('.pswp')) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const dir = e.key === 'ArrowLeft' ? 'prev' : 'next';
  document
    .querySelector<HTMLElement>(`[data-nav-dir="${dir}"], [data-home-step="${dir}"]`)
    ?.click();
});
