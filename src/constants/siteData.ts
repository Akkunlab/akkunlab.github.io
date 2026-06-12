export const SITE_URL: string = 'https://akkunlab.dev/';

export const AUTHOR: string = '岸本 篤';
export const AUTHOR_ENGLISH: string = 'Atsushi Kishimoto';

export const OGP_IMAGE: string = '/ogp.png';

export const X_ID: string = '@akkun_lab';
export const COLOR: string = '#000';

export const IMAGE_QUALITY: number = 45;
export const IMAGE_FORMAT: "webp" | "avif" = 'webp';

export const PREVIEW_ITEMS_COUNT: number = 6;

// 表示ラベルは i18n 辞書の nav.* が key で対応する
export const NAV_ITEMS = [
  {
    key: 'works',
    href: '/works',
    icon: 'work-outline',
    activeIcon: 'work'
  }, {
    key: 'activities',
    href: '/activities',
    icon: 'event-available-outline-rounded',
    activeIcon: 'event-available-rounded'
  }, {
    key: 'profile',
    href: '/#profile',
    icon: 'account-circle-outline',
    activeIcon: 'account-circle'
  }, {
    key: 'links',
    href: '/#links',
    icon: 'mail-outline-rounded',
    activeIcon: 'mail-rounded'
  }
] as const;
