/**
 * Page transitions (Barba.js + GSAP) and per-page animation.
 *
 * Two transitions, in the spirit of the Codrops article
 * "Creating Custom Page Transitions in Astro with Barba.js and GSAP":
 *  - "overlay-title": switching sections (Work <-> About) lifts a curtain
 *    overlay showing the destination page name in the destination language.
 *  - "soft": same section, different language — quick scale-down + reveal.
 *
 * prefers-reduced-motion: Barba is not initialised at all; the site works as
 * plain multi-page navigation with no animation.
 */
import barba from '@barba/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function initReveals(container: HTMLElement) {
  if (reducedMotion) return;

  const cards = gsap.utils.toArray<HTMLElement>('.photo-card', container);
  if (cards.length) {
    gsap.set(cards, { autoAlpha: 0, y: 64 });
    ScrollTrigger.batch(cards, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          ease: 'power3.out',
          stagger: 0.08,
        }),
    });
  }

  const aboutBlocks = gsap.utils.toArray<HTMLElement>('.about-reveal', container);
  if (aboutBlocks.length) {
    gsap.from(aboutBlocks, {
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
  gsap.set(title, { overflow: 'hidden' });
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
      buttons.forEach((b) => {
        const active = b === btn;
        b.setAttribute('aria-pressed', String(active));
        b.classList.toggle('text-paper', active);
        b.classList.toggle('text-muted', !active);
      });

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
      ScrollTrigger.refresh();
    });
  });
}

function initBackToTop(container: HTMLElement) {
  container.querySelector('[data-back-to-top]')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  });
}

function initPage(container: HTMLElement) {
  initImages(container);
  initFilter(container);
  initBackToTop(container);
  initHero(container);
  initReveals(container);
}

/* ---------------- transitions ---------------- */

const overlay = document.querySelector<HTMLElement>('.transition-overlay')!;
const overlayTitle = overlay.querySelector<HTMLElement>('.transition-overlay__title')!;

/** Curtain up over the old page, destination title types in. */
function overlayIn(title: string): gsap.core.Timeline {
  overlayTitle.textContent = title;
  const chars = splitChars(overlayTitle);
  const tl = gsap.timeline();
  tl.set(overlay, { visibility: 'visible', clipPath: 'inset(100% 0 0 0)' })
    .to(overlay, { clipPath: 'inset(0% 0 0 0)', duration: 0.65, ease: 'power4.inOut' })
    .from(chars, { yPercent: 120, duration: 0.7, ease: 'power4.out', stagger: 0.04 }, '-=0.25');
  return tl;
}

/** Curtain continues upward, revealing the new page underneath. */
function overlayOut(): gsap.core.Timeline {
  const chars = overlayTitle.querySelectorAll('.char');
  const tl = gsap.timeline();
  tl.to(chars, { yPercent: -120, duration: 0.5, ease: 'power4.in', stagger: 0.02 })
    .to(overlay, { clipPath: 'inset(0 0 100% 0)', duration: 0.65, ease: 'power4.inOut' }, '-=0.15')
    .set(overlay, { visibility: 'hidden', clipPath: 'inset(100% 0 0 0)' });
  return tl;
}

function initBarba() {
  barba.init({
    prevent: ({ el }) => el.hasAttribute('data-no-barba'),
    transitions: [
      {
        // Section change: Work <-> About
        name: 'overlay-title',
        custom: ({ current, next }) =>
          !!next.container && current.namespace !== next.namespace,
        async leave({ next }) {
          const title = next.container?.dataset.pageTitle ?? '';
          await overlayIn(title);
        },
        enter() {
          window.scrollTo(0, 0);
        },
        async after() {
          await overlayOut();
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
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
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
    ScrollTrigger.refresh();
  });

  barba.hooks.after(() => {
    document.documentElement.classList.remove('is-transitioning');
  });
}

/* ---------------- boot ---------------- */

const firstContainer = document.querySelector<HTMLElement>('[data-barba="container"]');
if (firstContainer) initPage(firstContainer);
if (!reducedMotion) initBarba();
