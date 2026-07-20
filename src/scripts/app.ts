/**
 * Page transitions (Barba.js + GSAP), per-page animation, custom cursor and
 * theme toggle — in the spirit of the Codrops article "Creating Custom Page
 * Transitions in Astro with Barba.js and GSAP".
 *
 * Transition map:
 *  - gallery → photo (clicked card): shared-element FLIP — the clicked image
 *    flies and expands into the detail page hero.
 *  - photo → photo (prev/next): directional horizontal slide.
 *  - section change: layered slats curtain (accent wave + dark wave) carrying
 *    the destination page name, while the old page sinks back.
 *  - same page, other language: quick scale-down + rise.
 *
 * prefers-reduced-motion: Barba, reveals and the custom cursor are all
 * disabled; the site works as plain multi-page navigation.
 */
import barba from '@barba/core';
import gsap from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';

gsap.registerPlugin(MorphSVGPlugin);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  const cards = gsap.utils.toArray<HTMLElement>('.photo-card', container);
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

  // Skipped when a transition (FLIP) already choreographed the text itself.
  const blocks =
    container.dataset.skipTextReveal === '1'
      ? []
      : gsap.utils.toArray<HTMLElement>('.about-reveal, .detail-reveal', container);
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
  gsap.set(title, { display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom' });
  gsap.from(chars, {
    yPercent: 110,
    duration: 1.1,
    ease: 'power4.out',
    stagger: 0.035,
    delay: 0.15,
  });
  const line = container.querySelector('.hero-line');
  if (line) gsap.from(line, { autoAlpha: 0, y: 16, duration: 0.8, delay: 0.5 });
}

function initFilter(container: HTMLElement) {
  const buttons = container.querySelectorAll<HTMLButtonElement>('.filter-btn');
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));

      const cards = container.querySelectorAll<HTMLElement>('.photo-card');
      const visible: HTMLElement[] = [];
      cards.forEach((card) => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.style.display = match ? '' : 'none';
        if (match) visible.push(card);
      });

      if (!reducedMotion) {
        gsap.fromTo(
          visible,
          { autoAlpha: 0, y: 32 },
          { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.05 },
        );
      }
    });
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

function initDetail(container: HTMLElement) {
  const hero = container.querySelector<HTMLElement>('[data-detail-hero]');
  const zoomBtn = hero?.querySelector<HTMLElement>('[data-zoom-toggle]');
  if (!hero || !zoomBtn) return;
  const zoomLabel = zoomBtn.dataset.cursorLabel ?? '';
  const closeLabel = zoomBtn.dataset.closeLabel ?? zoomLabel;

  // Native image drag swallows pointerup and kills the swipe gesture.
  hero.querySelectorAll('img').forEach((img) => (img.draggable = false));

  const setImmersive = (open: boolean) => {
    hero.classList.toggle('is-immersive', open);
    document.documentElement.classList.toggle('immersive-open', open);
    const label = open ? closeLabel : zoomLabel;
    zoomBtn.dataset.cursorLabel = label;
    zoomBtn.setAttribute('aria-label', label);
    // The cursor badge is likely showing over the image right now — update it.
    cursorEl?.querySelector('.cursor-label')?.replaceChildren(document.createTextNode(label));
    if (!reducedMotion) gsap.fromTo(hero, { autoAlpha: 0.6 }, { autoAlpha: 1, duration: 0.35 });
  };

  // Tap = zoom toggle; horizontal drag = previous/next photo.
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
    setImmersive(!hero.classList.contains('is-immersive'));
  });
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
    // Hover zoom multiplies the base over-scale (see initHoverParallax).
    const total = scale * parseFloat(el.dataset.hoverScale ?? '1');
    el.style.transform = `translate3d(0, ${shift}px, 0)${total !== 1 ? ` scale(${total.toFixed(4)})` : ''}`;
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

  // Gallery images drift inside their masks (over-scaled so edges never show).
  container.querySelectorAll<HTMLElement>('.photo-card .photo-img').forEach((img) => {
    parallaxItems.push({ el: img, speed: -0.07, scale: 1.14 });
  });

  updateParallax();
}

/** Hover: the image zooms in inside its frame and leans toward the pointer. */
function initHoverParallax(container: HTMLElement) {
  if (reducedMotion || !window.matchMedia('(hover: hover)').matches) return;
  container.querySelectorAll<HTMLElement>('.photo-card a').forEach((link) => {
    const media = link.querySelector<HTMLElement>('.photo-media');
    const img = link.querySelector<HTMLElement>('.photo-img');
    if (!media || !img) return;
    const toX = gsap.quickTo(media, 'x', { duration: 0.7, ease: 'power3' });
    const toY = gsap.quickTo(media, 'y', { duration: 0.7, ease: 'power3' });
    // Zoom is folded into the scroll-parallax transform via dataset so the
    // two effects never overwrite each other.
    const zoom = { v: 1 };
    const applyZoom = () => {
      img.dataset.hoverScale = zoom.v.toFixed(4);
      requestParallax();
    };
    link.addEventListener('pointerenter', () => {
      gsap.to(zoom, { v: 1.09, duration: 0.9, ease: 'power3.out', onUpdate: applyZoom });
    });
    link.addEventListener('pointermove', (e) => {
      const rect = link.getBoundingClientRect();
      toX(((e.clientX - rect.left) / rect.width - 0.5) * 26);
      toY(((e.clientY - rect.top) / rect.height - 0.5) * 26);
    });
    link.addEventListener('pointerleave', () => {
      toX(0);
      toY(0);
      gsap.to(zoom, { v: 1, duration: 0.7, ease: 'power3.out', onUpdate: applyZoom });
    });
  });
}

function initPage(container: HTMLElement) {
  // Barba also fires afterEnter for the initial load — never init twice
  // (double-bound listeners made one burger tap open AND close the menu).
  if (container.dataset.appInit === '1') return;
  container.dataset.appInit = '1';
  initImages(container);
  initFilter(container);
  initBackToTop(container);
  initMenu(container);
  initDetail(container);
  initHero(container);
  initReveals(container);
  initParallax(container);
  initHoverParallax(container);
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

const waveSvg = document.querySelector<SVGSVGElement>('.transition-wave');
const wavePath = waveSvg?.querySelector<SVGPathElement>('.transition-wave__path');
const waveStops = waveSvg?.querySelectorAll<SVGStopElement>('.transition-wave__stop');

type WaveOptions = { from?: 'bottom' | 'top'; speed?: number };

function waveIn({ from = 'bottom', speed = 1 }: WaveOptions = {}): gsap.core.Timeline {
  const [accent, soft] = accentColors();
  waveStops?.[0]?.setAttribute('stop-color', accent);
  waveStops?.[1]?.setAttribute('stop-color', soft);
  const tl = gsap.timeline({ defaults: { duration: 0.45 / speed } });
  tl.set(waveSvg!, { visibility: 'visible', scaleY: from === 'top' ? -1 : 1 })
    .set(wavePath!, { attr: { d: WAVE.hidden } })
    .to(wavePath!, { morphSVG: WAVE.mid, ease: 'power2.in' })
    .to(wavePath!, { morphSVG: WAVE.cover, ease: 'power2.out' });
  return tl;
}

function waveOut({ speed = 1 }: WaveOptions = {}): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { duration: 0.45 / speed } });
  tl.to(wavePath!, { morphSVG: WAVE.midOut, ease: 'power2.in' })
    .to(wavePath!, { morphSVG: WAVE.gone, ease: 'power2.out' })
    .set(waveSvg!, { visibility: 'hidden', scaleY: 1 })
    .set(wavePath!, { attr: { d: WAVE.hidden } });
  return tl;
}

function photoLinkFrom(trigger: unknown): HTMLElement | null {
  return trigger instanceof HTMLElement ? trigger.closest('[data-photo-link]') : null;
}

/** FLIP state shared between leave and enter of the gallery → photo transition. */
let flipClone: HTMLImageElement | null = null;

function initBarba() {
  barba.init({
    prevent: ({ el }) => el.hasAttribute('data-no-barba'),
    transitions: [
      {
        // Clicked photo card: the image itself flies into the detail page.
        name: 'flip-photo',
        custom: ({ next, trigger }) =>
          next.namespace === 'photo' && photoLinkFrom(trigger) !== null,
        async leave({ current, trigger }) {
          const link = photoLinkFrom(trigger)!;
          const img = link.querySelector('img')!;
          // Measure the mask, not the img — parallax over-scales the img
          // inside it, so the img rect is larger than what's visible.
          const rect = (link.querySelector('.photo-media') ?? img).getBoundingClientRect();

          flipClone = img.cloneNode(true) as HTMLImageElement;
          flipClone.className = 'flip-clone';
          Object.assign(flipClone.style, {
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            transform: 'none',
          });
          document.body.appendChild(flipClone);
          (link.closest('.photo-card') as HTMLElement).style.opacity = '0';

          await gsap.to(current.container, { autoAlpha: 0, duration: 0.35, ease: 'power2.in' });
        },
        async enter({ next }) {
          window.scrollTo(0, 0);
          const hero = next.container.querySelector<HTMLImageElement>('[data-detail-hero] img')!;
          hero.style.visibility = 'hidden';

          const text = next.container.querySelectorAll('.detail-reveal, [aria-label="Photos"]');
          gsap.set(text, { autoAlpha: 0 });

          const target = hero.getBoundingClientRect();
          if (flipClone) {
            await gsap.to(flipClone, {
              top: target.top,
              left: target.left,
              width: target.width,
              height: target.height,
              duration: 0.8,
              ease: 'power4.inOut',
            });
          }
          hero.style.visibility = '';
          markLoaded(hero);
          (next.container as HTMLElement).dataset.skipTextReveal = '1';
          gsap.to(text, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08 });
          // Keep the clone painted briefly so the hero can render beneath it.
          const clone = flipClone;
          flipClone = null;
          if (clone) gsap.to(clone, { autoAlpha: 0, duration: 0.25, delay: 0.15, onComplete: () => clone.remove() });
        },
      },
      {
        // Prev/next between photos: directional slide.
        name: 'photo-slide',
        custom: ({ current, next }) =>
          current.namespace === 'photo' && next.namespace === 'photo',
        async leave({ current, trigger }) {
          const dir =
            trigger instanceof HTMLElement && trigger.closest('[data-nav-dir="prev"]') ? -1 : 1;
          (current.container as HTMLElement).dataset.slideDir = String(dir);
          await gsap.to(current.container, {
            xPercent: -5 * dir,
            autoAlpha: 0,
            duration: 0.26,
            ease: 'power2.in',
          });
        },
        enter({ current, next }) {
          window.scrollTo(0, 0);
          const dir = Number((current.container as HTMLElement).dataset.slideDir ?? 1);
          return gsap.from(next.container, {
            xPercent: 5 * dir,
            autoAlpha: 0,
            duration: 0.34,
            ease: 'power3.out',
          });
        },
      },
      {
        // Leaving a photo back to a section: the same wave language, but
        // mirrored — it drops from the top and moves quicker.
        name: 'wave-top',
        custom: ({ current, next }) =>
          current.namespace === 'photo' && next.namespace !== 'photo',
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
        custom: ({ current, next, trigger }) =>
          current.namespace !== next.namespace &&
          current.namespace !== 'photo' &&
          !(next.namespace === 'photo' && photoLinkFrom(trigger) !== null),
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
            duration: 0.4,
            ease: 'power2.in',
          });
        },
        enter({ next }) {
          window.scrollTo(0, 0);
          return gsap.from(next.container, {
            y: 28,
            autoAlpha: 0,
            duration: 0.55,
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
    // The old container (with its open menu / immersive view) is gone —
    // release the scroll locks.
    document.documentElement.classList.remove('menu-open', 'immersive-open');
    // The hovered element is gone after a swap — reset cursor state.
    cursorEl?.classList.remove('is-view', 'is-hover');
  });
}

/* ---------------- boot ---------------- */

const firstContainer = document.querySelector<HTMLElement>('[data-barba="container"]');
if (firstContainer) initPage(firstContainer);
if (!reducedMotion) initBarba();

// Arrow keys navigate between photos; Escape exits the immersive view.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const immersive = document.querySelector<HTMLElement>('.is-immersive [data-zoom-toggle]');
    if (immersive) immersive.click();
    return;
  }
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const dir = e.key === 'ArrowLeft' ? 'prev' : 'next';
  document.querySelector<HTMLAnchorElement>(`[data-nav-dir="${dir}"]`)?.click();
});
