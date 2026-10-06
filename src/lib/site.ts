import type { SiteSettings } from './queries';
import type { Shot } from './shots';

// Nick's Instagram is rendered from code (the seeded Site Settings only has a
// placeholder instagram.com link). socialsWithoutInstagram() drops any
// Instagram from Sanity so exactly one — the correct handle — shows; other
// Sanity socials still render.
export const INSTAGRAM_URL = 'https://www.instagram.com/shmily_5021991/';
export const INSTAGRAM_HANDLE = '@shmily_5021991';

export function socialsWithoutInstagram(settings: SiteSettings) {
  return settings.socialLinks?.filter((link) => link.url && !/instagram/i.test(link.url)) ?? [];
}

/**
 * No films yet — the Videos panel and page cycle through these stills with a
 * slow zoom so they feel like moving footage. Ordered like an edit: night
 * riding, the village lit up, a bright daytime jump, fireworks, snowfall.
 */
export const VIDEO_REEL: Shot[] = [
  { id: 'photo-nick-1d793319c8a5', focus: '42% 40%' }, // Suspended Snow
  { id: 'photo-nick-82572166b733', focus: '55% 50%' }, // Village Lights
  { id: 'photo-nick-124f8ca69569', focus: '50% 35%' }, // Backcountry Flight
  { id: 'photo-nick-49d0c33de8e3', focus: '40% 40%' }, // Mountain Fireworks
  { id: 'photo-nick-5aa8d6627cb9', focus: '50% 45%' }, // Falling Snow
];
