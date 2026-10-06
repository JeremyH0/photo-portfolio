import type { LocaleCode } from './locales';

// Copy for the Shop teaser only (kept out of locales.ts, which holds the
// site-wide UI strings). Deliberately vague: nothing is for sale yet.
type Idea = { title: string; body: string };

type ShopStrings = {
  eyebrow: string;
  title: string;
  intro: string;
  notice: string;
  featureEyebrow: string;
  featureTitle: string;
  featureBody: string;
  previewTitle: string;
  previewBody: string;
  ideasTitle: string;
  ideas: Record<'prints' | 'paper' | 'digital', Idea>;
  askTitle: string;
  askBody: string;
};

export const shopUi: Record<LocaleCode, ShopStrings> = {
  en: {
    eyebrow: 'Coming soon',
    title: 'Shop',
    intro: 'A small collection of prints and keepsakes from Hokkaido is in the works.',
    notice: 'Nothing is for sale just yet. Follow along on Instagram to hear first when it opens.',
    featureEyebrow: 'In the works',
    featureTitle: 'Photographs for your walls',
    featureBody: 'A selection of Nick’s favourite images from Hokkaido, printed with care to live with every day.',
    previewTitle: 'A first look',
    previewBody: 'Some of the photographs being considered.',
    ideasTitle: 'What might be coming',
    ideas: {
      prints: { title: 'Prints', body: 'Favourite photographs, ready to hang.' },
      paper: { title: 'Paper goods', body: 'Small keepsakes, like cards to send or keep.' },
      digital: { title: 'Digital', body: 'Images for your screens.' },
    },
    askTitle: 'Want to hear when it opens?',
    askBody: 'Follow Nick on Instagram, or get in touch.',
  },
  ja: {
    eyebrow: '近日公開',
    title: 'ショップ',
    intro: '北海道の写真を使ったプリントや小さなアイテムを準備中です。',
    notice: '現在、販売中の商品はありません。オープンのお知らせはInstagramでいち早くお届けします。',
    featureEyebrow: '準備中',
    featureTitle: '壁に飾る写真を',
    featureBody: '北海道で撮影したNickのお気に入りの写真を、毎日眺めたくなるプリントに。',
    previewTitle: 'ひと足先に',
    previewBody: '候補の写真の一部です。',
    ideasTitle: '予定しているもの',
    ideas: {
      prints: { title: 'プリント', body: 'お気に入りの写真を、飾れるかたちで。' },
      paper: { title: 'ペーパーアイテム', body: '贈ったり手元に残したりできる、小さな紙もの。' },
      digital: { title: 'デジタル', body: 'スマホやパソコンで楽しめる画像。' },
    },
    askTitle: 'オープンのお知らせを受け取るには？',
    askBody: 'NickのInstagramをフォローするか、お気軽にお問い合わせください。',
  },
  zh: {
    eyebrow: '即将推出',
    title: '商店',
    intro: '以北海道照片制作的印刷品和小物正在筹备中。',
    notice: '目前暂无商品出售。关注 Instagram，第一时间获得开业消息。',
    featureEyebrow: '筹备中',
    featureTitle: '挂在墙上的照片',
    featureBody: '精选 Nick 在北海道拍摄的心爱作品，用心印制，适合每天欣赏。',
    previewTitle: '抢先一览',
    previewBody: '部分候选作品。',
    ideasTitle: '可能推出的内容',
    ideas: {
      prints: { title: '印刷品', body: '心爱的照片，装裱即可悬挂。' },
      paper: { title: '纸品', body: '可以寄出或珍藏的小卡片等。' },
      digital: { title: '数字作品', body: '为你的屏幕准备的图片。' },
    },
    askTitle: '想在开业时收到通知？',
    askBody: '关注 Nick 的 Instagram，或直接联系。',
  },
  'zh-tw': {
    eyebrow: '即將推出',
    title: '商店',
    intro: '以北海道照片製作的印刷品與小物正在籌備中。',
    notice: '目前暫無商品販售。追蹤 Instagram，第一時間獲得開幕消息。',
    featureEyebrow: '籌備中',
    featureTitle: '掛在牆上的照片',
    featureBody: '精選 Nick 在北海道拍攝的心愛作品，用心印製，適合每天欣賞。',
    previewTitle: '搶先一覽',
    previewBody: '部分候選作品。',
    ideasTitle: '可能推出的內容',
    ideas: {
      prints: { title: '印刷品', body: '心愛的照片，裝裱即可懸掛。' },
      paper: { title: '紙品', body: '可以寄出或珍藏的小卡片等。' },
      digital: { title: '數位作品', body: '為你的螢幕準備的圖片。' },
    },
    askTitle: '想在開幕時收到通知？',
    askBody: '追蹤 Nick 的 Instagram，或直接聯絡。',
  },
};
