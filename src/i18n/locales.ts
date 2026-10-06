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
  photography: string;
  videos: string;
  shop: string;
  about: string;
  contactNav: string;
  all: string;
  contact: string;
  tagline: string;
  metaDescription: string;
  backToTop: string;
  back: string;
  prev: string;
  next: string;
  view: string;
  zoom: string;
  close: string;
  counterOf: string;
  albums: string;
  galleries: string;
  /** Photography strip: how to move it (fine pointer / touch). */
  dragHint: string;
  swipeHint: string;
  /** Home page panels: one-line teaser per section + the call to action. */
  photographySub: string;
  videosSub: string;
  contactSub: string;
  aboutSub: string;
  enter: string;
  videosSoonTitle: string;
  videosSoonBody: string;
  email: string;
  comingSoon: string;
};

export const ui: Record<LocaleCode, UIStrings> = {
  en: {
    photography: 'Photography',
    videos: 'Videos',
    shop: 'Shop',
    about: 'About',
    all: 'All',
    contactNav: 'Contact',
    contact: 'Get in touch',
    tagline: 'Photography from Hokkaido and beyond',
    metaDescription: 'Photography portfolio — landscapes, street and portrait work.',
    backToTop: 'Back to top',
    back: 'Back to gallery',
    prev: 'Previous',
    next: 'Next',
    view: 'View',
    zoom: 'Zoom',
    close: 'Close',
    counterOf: 'of',
    albums: 'Albums',
    galleries: 'Galleries',
    dragHint: 'Scroll or drag',
    swipeHint: 'Swipe',
    photographySub: 'Landscapes, portraits and street — Hokkaido and beyond',
    videosSub: 'Short films and moments in motion',
    contactSub: 'Commissions, collaborations, or just to say hello',
    aboutSub: 'The photographer behind the lens',
    enter: 'Enter',
    videosSoonTitle: 'Films are on their way',
    videosSoonBody: 'New work is being edited. In the meantime, follow along on Instagram.',
    email: 'Email',
    comingSoon: 'Coming soon',
  },
  ja: {
    photography: '写真',
    videos: '映像',
    shop: 'ショップ',
    about: 'プロフィール',
    all: 'すべて',
    contactNav: 'お問い合わせ',
    contact: 'お問い合わせ',
    tagline: '北海道とその先の風景を撮る',
    metaDescription: '写真ポートフォリオ — 風景、ストリート、ポートレート。',
    backToTop: 'トップへ戻る',
    back: 'ギャラリーへ戻る',
    prev: '前へ',
    next: '次へ',
    view: '見る',
    zoom: '拡大',
    close: '閉じる',
    counterOf: '/',
    albums: 'アルバム',
    galleries: 'ギャラリー',
    dragHint: 'スクロール・ドラッグ',
    swipeHint: 'スワイプ',
    photographySub: '北海道とその先の風景・ポートレート・ストリート',
    videosSub: 'ショートフィルムと動く瞬間',
    contactSub: '撮影のご依頼、コラボレーション、ご挨拶もお気軽に',
    aboutSub: 'レンズの向こうの写真家',
    enter: '見る',
    videosSoonTitle: '映像作品を準備中です',
    videosSoonBody: '現在編集中です。公開までは Instagram でお楽しみください。',
    email: 'メール',
    comingSoon: '近日公開',
  },
  zh: {
    photography: '摄影',
    videos: '视频',
    shop: '商店',
    about: '关于',
    all: '全部',
    contactNav: '联系',
    contact: '联系我',
    tagline: '来自北海道与更远的摄影',
    metaDescription: '摄影作品集 — 风景、街头与人像。',
    backToTop: '回到顶部',
    back: '返回作品集',
    prev: '上一张',
    next: '下一张',
    view: '查看',
    zoom: '放大',
    close: '关闭',
    counterOf: '/',
    albums: '相册',
    galleries: '图库',
    dragHint: '滚动或拖动',
    swipeHint: '滑动浏览',
    photographySub: '北海道与更远处的风景、人像与街头',
    videosSub: '短片与流动的瞬间',
    contactSub: '约拍、合作，或只是打个招呼',
    aboutSub: '镜头背后的摄影师',
    enter: '进入',
    videosSoonTitle: '影片即将上线',
    videosSoonBody: '新作品正在剪辑中。在此之前，欢迎在 Instagram 上关注。',
    email: '邮箱',
    comingSoon: '即将推出',
  },
  'zh-tw': {
    photography: '攝影',
    videos: '影片',
    shop: '商店',
    about: '關於',
    all: '全部',
    contactNav: '聯絡',
    contact: '聯絡我',
    tagline: '來自北海道與更遠的攝影',
    metaDescription: '攝影作品集 — 風景、街頭與人像。',
    backToTop: '回到頂部',
    back: '返回作品集',
    prev: '上一張',
    next: '下一張',
    view: '查看',
    zoom: '放大',
    close: '關閉',
    counterOf: '/',
    albums: '相簿',
    galleries: '圖庫',
    dragHint: '滾動或拖曳',
    swipeHint: '滑動瀏覽',
    photographySub: '北海道與更遠處的風景、人像與街頭',
    videosSub: '短片與流動的瞬間',
    contactSub: '約拍、合作，或只是打個招呼',
    aboutSub: '鏡頭背後的攝影師',
    enter: '進入',
    videosSoonTitle: '影片即將上線',
    videosSoonBody: '新作品正在剪輯中。在此之前，歡迎在 Instagram 上關注。',
    email: '電子郵件',
    comingSoon: '即將推出',
  },
};

/** Static paths helper for /[lang]/ pages. */
export function getLocalePaths() {
  return locales.map((locale) => ({ params: { lang: locale.code } }));
}
