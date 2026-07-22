import gsap from 'gsap';

/**
 * "Blinds" reveal for photo-to-photo navigation on /photo — a lighter
 * replacement for the wave sweep, scoped strictly to the `photo-slide`
 * Barba transition (see app.ts). Vertical slats, each painted with the
 * outgoing photo, collapse away in sequence to reveal the incoming one
 * (already live in the DOM underneath) — left-to-right for next,
 * right-to-left for prev.
 *
 * Self-contained on purpose: to remove this effect, swap the two call
 * sites in app.ts's `photo-slide` transition back to waveIn()/waveOut()
 * and delete this file. Nothing else depends on it.
 */

/** Tune here. */
export const BLINDS_COUNT = 14;
export const BLINDS_SLAT_DURATION = 0.5; // seconds — one slat's own open animation
export const BLINDS_STAGGER = 0.03; // seconds between each slat's start
export const BLINDS_OVERLAP_PCT = 0.6; // extra width per slat (%), hides seams

export type BlindsDirection = 'prev' | 'next';

let activeBlinds: { kill: () => void } | null = null;

/**
 * Builds the covering overlay instantly (no animation) — call from `leave`,
 * before Barba swaps the DOM. Because it's painted with the exact photo
 * already on screen, appearing is imperceptible; the visible motion only
 * happens later, in `revealBlinds`.
 */
export function coverWithBlinds(rect: DOMRect, fromSrc: string): HTMLElement {
  // A rapid second navigation before the first finished revealing: drop the
  // old overlay/timeline cleanly rather than let two transitions overlap.
  activeBlinds?.kill();

  const overlay = document.createElement('div');
  overlay.className = 'blinds-overlay';
  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;

  const slatWidth = 100 / BLINDS_COUNT;
  for (let i = 0; i < BLINDS_COUNT; i++) {
    const left = Math.max(0, i * slatWidth - BLINDS_OVERLAP_PCT / 2);
    const right = Math.max(0, 100 - (i + 1) * slatWidth - BLINDS_OVERLAP_PCT / 2);

    const slat = document.createElement('div');
    slat.className = 'blinds-slat';
    slat.style.clipPath = `inset(0 ${right}% 0 ${left}%)`;

    const fill = document.createElement('div');
    fill.className = 'blinds-slat__fill';
    fill.style.backgroundImage = `url("${fromSrc}")`;

    slat.appendChild(fill);
    overlay.appendChild(slat);
  }

  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Opens the slats to reveal what's already live beneath them — call from
 * `after`, once the new page (and its hero image) is in the DOM. Resolves
 * once fully open; removes its own overlay when done.
 */
export async function revealBlinds(
  overlay: HTMLElement,
  toSrc: string,
  direction: BlindsDirection,
): Promise<void> {
  await preloadImage(toSrc);

  const fills = overlay.querySelectorAll<HTMLElement>('.blinds-slat__fill');

  await new Promise<void>((resolve) => {
    const tl = gsap.timeline({
      onComplete: () => {
        overlay.remove();
        activeBlinds = null;
        resolve();
      },
    });
    activeBlinds = {
      kill: () => {
        tl.kill();
        overlay.remove();
        activeBlinds = null;
      },
    };

    tl.to(fills, {
      scaleX: 0,
      duration: BLINDS_SLAT_DURATION,
      ease: 'power2.inOut',
      stagger: { each: BLINDS_STAGGER, from: direction === 'next' ? 'start' : 'end' },
    });
  });
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => (img.decode ? img.decode().then(resolve, resolve) : resolve());
    if (img.complete) {
      done();
      return;
    }
    img.onload = done;
    img.onerror = () => resolve(); // don't hang the transition on a broken image
    img.src = src;
  });
}
