import { createImageUrlBuilder } from '@sanity/image-url';
import { sanity } from './sanity';
import type { SanityImageRef } from './queries';

const builder = createImageUrlBuilder(sanity);

/**
 * A region of the source image, in source pixels. Cropped server-side by
 * Sanity, so whatever is outside it is never sent to the browser at all.
 */
export type Rect = { left: number; top: number; width: number; height: number };

/**
 * The only way images leave Sanity: auto format (WebP/AVIF where supported),
 * capped quality, hotspot-aware crops.
 */
export function urlFor(image: SanityImageRef, width: number, height?: number, rect?: Rect) {
  let b = builder.image(image);
  if (rect) b = b.rect(rect.left, rect.top, rect.width, rect.height);
  b = b.width(width).auto('format').quality(80).fit('max');
  if (height) b = b.height(height).fit('crop');
  return b.url();
}

const SRCSET_WIDTHS = [480, 768, 1080, 1440, 1920];

export function srcsetFor(image: SanityImageRef, aspect?: number, rect?: Rect): string {
  return SRCSET_WIDTHS.filter((w) => w <= Math.max(rect?.width ?? image.width, 768))
    .map((w) => `${urlFor(image, w, aspect ? Math.round(w / aspect) : undefined, rect)} ${w}w`)
    .join(', ');
}

/** Larger candidates for the fullscreen lightbox, which upgrades on zoom. */
const LIGHTBOX_WIDTHS = [1080, 1440, 1920, 2560];

export function lightboxSrcset(image: SanityImageRef): string {
  return LIGHTBOX_WIDTHS.filter((w) => w <= Math.max(image.width, 1080))
    .map((w) => `${urlFor(image, w)} ${w}w`)
    .join(', ');
}
