// Single source of truth for site languages.
// To add Traditional Chinese later: add an entry here, in astro.config.mjs
// i18n.locales, and in the Studio's schemaTypes/supportedLanguages.ts.
export const locales = [
  { code: 'en', htmlLang: 'en', label: 'EN', name: 'English' },
  { code: 'ja', htmlLang: 'ja', label: 'JA', name: '日本語' },
  { code: 'zh', htmlLang: 'zh-Hans', label: 'ZH', name: '中文' },
] as const;

export type LocaleCode = (typeof locales)[number]['code'];

export const defaultLocale: LocaleCode = 'en';

/** Pick a language from a Sanity localized object, falling back to English. */
export function l(
  field: Partial<Record<LocaleCode, string>> | undefined | null,
  lang: LocaleCode,
): string {
  return field?.[lang] ?? field?.[defaultLocale] ?? '';
}

type UIStrings = {
  work: string;
  about: string;
  all: string;
  contact: string;
  tagline: string;
  metaDescription: string;
  backToTop: string;
};

export const ui: Record<LocaleCode, UIStrings> = {
  en: {
    work: 'Work',
    about: 'About',
    all: 'All',
    contact: 'Get in touch',
    tagline: 'Photography from Hokkaido and beyond',
    metaDescription: 'Photography portfolio — landscapes, street and portrait work.',
    backToTop: 'Back to top',
  },
  ja: {
    work: '作品',
    about: 'プロフィール',
    all: 'すべて',
    contact: 'お問い合わせ',
    tagline: '北海道とその先の風景を撮る',
    metaDescription: '写真ポートフォリオ — 風景、ストリート、ポートレート。',
    backToTop: 'トップへ戻る',
  },
  zh: {
    work: '作品',
    about: '关于',
    all: '全部',
    contact: '联系我',
    tagline: '来自北海道与更远的摄影',
    metaDescription: '摄影作品集 — 风景、街头与人像。',
    backToTop: '回到顶部',
  },
};

/** Static paths helper for /[lang]/ pages. */
export function getLocalePaths() {
  return locales.map((locale) => ({ params: { lang: locale.code } }));
}
