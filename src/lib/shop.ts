import type { Shot } from './shots';

/**
 * Shop — a "coming soon" teaser. Nick has nothing to sell yet, so the page
 * stays deliberately vague: no prices, sizes or ordering, just the photos
 * framed on a wall and loose ideas of what could come.
 */

export const FEATURED: Shot = { id: 'photo-nick-81771a06158f' }; // Peak at First Light

export const PREVIEW: Shot[] = [
  { id: 'photo-nick-a0d01672f987' }, // By the Lone Pine
  { id: 'photo-nick-083c32a46ce5' }, // Frozen Lantern Light
  { id: 'photo-nick-d11c919961dd' }, // Canal of Lights
];

export const IDEAS: { key: 'prints' | 'paper' | 'digital'; shot: Shot }[] = [
  { key: 'prints', shot: { id: 'photo-nick-8c4afd465ecb', focus: '70% 66%' } }, // Winter Shrine
  { key: 'paper', shot: { id: 'photo-nick-afc2eaa650fd', focus: '50% 50%' } }, // Summer Lantern Street
  { key: 'digital', shot: { id: 'photo-nick-cddba31aa814', focus: '50% 50%' } }, // Magnolia Sky
];
