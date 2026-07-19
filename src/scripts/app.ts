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
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);
// The tutorial's easing curve, verbatim.
CustomEase.create('hop', '0.56, 0, 0.35, 0.98');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ACCENTS = ['#ff4b24', '#2743ff', '#ffb400'];

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

function initPage(container: HTMLElement) {
  initImages(container);
  initFilter(container);
  initBackToTop(container);
  initHero(container);
  initReveals(container);
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
    if (labelled) {
      label.textContent = labelled.dataset.cursorLabel ?? '';
      const card = labelled.closest<HTMLElement>('.photo-card');
      const accent = card ? getComputedStyle(card).getPropertyValue('--cat') : '';
      cursor.style.setProperty('--cursor-accent', accent.trim() || ACCENTS[0]);
    }
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

let accentIndex = 0;

function nextAccent(): string {
  accentIndex = (accentIndex + 1) % ACCENTS.length;
  return ACCENTS[accentIndex];
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
          const rect = img.getBoundingClientRect();

          flipClone = img.cloneNode(true) as HTMLImageElement;
          flipClone.className = 'flip-clone';
          Object.assign(flipClone.style, {
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
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
            xPercent: -6 * dir,
            autoAlpha: 0,
            duration: 0.4,
            ease: 'power2.in',
          });
        },
        enter({ current, next }) {
          window.scrollTo(0, 0);
          const dir = Number((current.container as HTMLElement).dataset.slideDir ?? 1);
          return gsap.from(next.container, {
            xPercent: 6 * dir,
            autoAlpha: 0,
            duration: 0.55,
            ease: 'power3.out',
          });
        },
      },
      {
        // Section change: the tutorial's sixth transition (pseudo-element
        // curtain, leandra-isler.ch-inspired). The next page opens from a
        // thin slit while a colored curtain lifts off it. Sync mode: both
        // containers are in the DOM; the old page stays beneath.
        name: 'curtain',
        custom: ({ current, next, trigger }) =>
          current.namespace !== next.namespace &&
          !(next.namespace === 'photo' && photoLinkFrom(trigger) !== null),
        sync: true,
        before(data) {
          data.next.container.classList.add('curtain__transition');
          gsap.set(data.next.container, {
            position: 'fixed',
            inset: 0,
            clipPath: 'polygon(15% 75%, 85% 75%, 85% 75%, 15% 75%)',
            zIndex: 3,
            height: '100vh',
            overflow: 'hidden',
            '--clip': 'inset(0 0 0% 0)',
            '--curtain-overlay': nextAccent(),
          });
        },
        enter(data) {
          const tl = gsap.timeline({
            defaults: { duration: 1.25, ease: 'hop' },
            onComplete: () => tl.kill(),
          });

          tl.to(data.next.container, {
            clipPath: 'polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)',
          });

          tl.to(data.next.container, { '--clip': 'inset(0 0 100% 0)' }, '<+=0.285');

          return new Promise<void>((resolve) => {
            tl.call(() => resolve());
          });
        },
        after(data) {
          data.next.container.classList.remove('curtain__transition');
          // Adaptation: our pages scroll — reset before releasing the fixed
          // positioning so the revealed page starts at the top.
          window.scrollTo(0, 0);
          gsap.set(data.next.container, { clearProps: 'all' });
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
    // The hovered element is gone after a swap — reset cursor state.
    cursorEl?.classList.remove('is-view', 'is-hover');
  });
}

/* ---------------- boot ---------------- */

const firstContainer = document.querySelector<HTMLElement>('[data-barba="container"]');
if (firstContainer) initPage(firstContainer);
if (!reducedMotion) initBarba();

// Arrow keys navigate between photos on detail pages.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const dir = e.key === 'ArrowLeft' ? 'prev' : 'next';
  document.querySelector<HTMLAnchorElement>(`[data-nav-dir="${dir}"]`)?.click();
});
