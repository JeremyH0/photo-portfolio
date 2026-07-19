// Single source of truth for site languages.
// Mirrored in astro.config.mjs (i18n.locales) and the Studio's
// schemaTypes/supportedLanguages.ts (sanityKey must match its field ids).
export const locales = [
  { code: 'en', sanityKey: 'en', htmlLang: 'en', label: 'EN', name: 'English' },
  { code: 'ja', sanityKey: 'ja', htmlLang: 'ja', label: 'JA', name: '日本語' },
  { code: 'zh', sanityKey: 'zh', htmlLang: 'zh-Hans', label: '简', name: '简体中文' },
  { code: 'zh-tw', sanityKey: 'zhHant', htmlLang: 'zh-Hant', label: '繁', name: '繁體中文' },
] as const;

export type LocaleCode = (typeof locales)[number]['code'];
export type SanityKey = (typeof locales)[number]['sanityKey'];

export const defaultLocale: LocaleCode = 'en';

// Longest first so 'zh-tw' matches before 'zh'.
export const localePathPattern = new RegExp(
  `^/(${[...locales]
    .map((loc) => loc.code)
    .sort((a, b) => b.length - a.length)
    .join('|')})(?=/|$)`,
);

/** Pick a language from a Sanity localized object, falling back to English. */
export function l(
  field: Partial<Record<SanityKey, string>> | undefined | null,
  lang: LocaleCode,
): string {
  const key = locales.find((loc) => loc.code === lang)?.sanityKey ?? 'en';
  return field?.[key] ?? field?.en ?? '';
}

type UIStrings = {
  work: string;
  about: string;
  all: string;
  contact: string;
  tagline: string;
  metaDescription: string;
  backToTop: string;
  back: string;
  prev: string;
  next: string;
  view: string;
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
    back: 'Back to gallery',
    prev: 'Previous',
    next: 'Next',
    view: 'View',
  },
  ja: {
    work: '作品',
    about: 'プロフィール',
    all: 'すべて',
    contact: 'お問い合わせ',
    tagline: '北海道とその先の風景を撮る',
    metaDescription: '写真ポートフォリオ — 風景、ストリート、ポートレート。',
    backToTop: 'トップへ戻る',
    back: 'ギャラリーへ戻る',
    prev: '前へ',
    next: '次へ',
    view: '見る',
  },
  zh: {
    work: '作品',
    about: '关于',
    all: '全部',
    contact: '联系我',
    tagline: '来自北海道与更远的摄影',
    metaDescription: '摄影作品集 — 风景、街头与人像。',
    backToTop: '回到顶部',
    back: '返回作品集',
    prev: '上一张',
    next: '下一张',
    view: '查看',
  },
  'zh-tw': {
    work: '作品',
    about: '關於',
    all: '全部',
    contact: '聯絡我',
    tagline: '來自北海道與更遠的攝影',
    metaDescription: '攝影作品集 — 風景、街頭與人像。',
    backToTop: '回到頂部',
    back: '返回作品集',
    prev: '上一張',
    next: '下一張',
    view: '查看',
  },
};

/** Static paths helper for /[lang]/ pages. */
export function getLocalePaths() {
  return locales.map((locale) => ({ params: { lang: locale.code } }));
}
