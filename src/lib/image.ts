import { createImageUrlBuilder } from '@sanity/image-url';
import { sanity } from './sanity';
import type { SanityImageRef } from './queries';

const builder = createImageUrlBuilder(sanity);

/**
 * The only way images leave Sanity: auto format (WebP/AVIF where supported),
 * capped quality, hotspot-aware crops.
 */
export function urlFor(image: SanityImageRef, width: number, height?: number) {
  let b = builder.image(image).width(width).auto('format').quality(80).fit('max');
  if (height) b = b.height(height).fit('crop');
  return b.url();
}

const SRCSET_WIDTHS = [480, 768, 1080, 1440, 1920];

export function srcsetFor(image: SanityImageRef, aspect?: number): string {
  return SRCSET_WIDTHS.filter((w) => w <= Math.max(image.width, 768))
    .map((w) => `${urlFor(image, w, aspect ? Math.round(w / aspect) : undefined)} ${w}w`)
    .join(', ');
}
