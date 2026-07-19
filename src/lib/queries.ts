import { sanity } from './sanity';
import type { LocaleCode } from '../i18n/locales';

type Localized = Partial<Record<LocaleCode, string>>;

export interface SanityImageRef {
  _type: 'image';
  asset: { _ref: string; _type: 'reference' };
  hotspot?: { x: number; y: number };
  crop?: { top: number; bottom: number; left: number; right: number };
  lqip: string;
  width: number;
  height: number;
}

export interface Photo {
  _id: string;
  title: Localized;
  caption?: Localized;
  category: { title: Localized; slug: string };
  image: SanityImageRef;
}

export interface Category {
  title: Localized;
  slug: string;
}

export interface SiteSettings {
  photographerName: string;
  bio?: Localized;
  contactEmail?: string;
  socialLinks?: { label?: string; url?: string }[];
}

const PHOTO_PROJECTION = `{
  _id,
  title,
  caption,
  'category': category->{title, 'slug': slug.current},
  'image': image{
    _type, asset, hotspot, crop,
    'lqip': asset->metadata.lqip,
    'width': asset->metadata.dimensions.width,
    'height': asset->metadata.dimensions.height
  }
}`;

export async function getPhotos(): Promise<Photo[]> {
  return sanity.fetch(
    `*[_type == 'photo' && defined(image.asset)] | order(orderRank asc) ${PHOTO_PROJECTION}`,
  );
}

export async function getCategories(): Promise<Category[]> {
  // Only categories that actually contain photos, in the order they first appear.
  return sanity.fetch(
    `*[_type == 'category' && count(*[_type == 'photo' && category._ref == ^._id]) > 0]
      { title, 'slug': slug.current }`,
  );
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const settings = await sanity.fetch(`*[_id == 'siteSettings'][0]{
    photographerName, bio, contactEmail, socialLinks
  }`);
  return settings ?? { photographerName: 'Photographer' };
}
