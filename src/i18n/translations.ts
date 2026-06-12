import type { Locale } from './index';

const ja = {
  site: {
    title: '岸本篤 / Atsushi Kishimoto Portfolio',
    description: 'テクノロジーとデザインの融合で、人々に感動と幸せを届けるクリエイター、岸本篤のポートフォリオサイト。',
  },
  author: '岸本 篤',
  hero: {
    titleLines: ['テクノロジーと', 'デザインの融合で', '人々を幸せに'],
    visualAlt: 'メインビジュアル',
  },
  nav: {
    works: '作品',
    activities: '活動',
    profile: 'プロフィール',
    links: '連絡先',
  },
  home: {
    stats: {
      works: '制作した作品数',
      activities: '参加したイベント数',
      skills: '習得したスキル数',
    },
    sections: {
      works: '作品',
      activities: '活動',
      profile: 'プロフィール',
      links: '連絡先',
    },
    headings: {
      career: '職歴',
      education: '学歴',
      certifications: '資格',
      media: 'メディア',
      skills: 'スキル',
    },
    seeMore: 'もっと見てみる！',
    profileName: {
      main: '岸本 篤',
      sub: 'Atsushi Kishimoto',
    },
    summary: `福島県いわき市生まれ。小学生の頃からモノづくりに取り組む。福島工業高等専門学校を卒業し、茨城大学工学部を経て、筑波大学大学院情報学学位プログラムに所属。感性工学・HCIを軸に、人の感じ方や使いやすさを起点にした体験設計の研究と実装に取り組む。

パソコン甲子園、技育展、高専プロコンに出場し、2021年にAWS Robot Delivery Challenge準優勝を果たす。2023年に常陸frogs（現・茨城frogs）5期生に選抜される。2025年、チーム今橋製作所として県北BCPアイデアソンで茨城県知事賞を受賞。

ソフト・ハード双方の基盤として、応用情報技術者、ディジタル技術検定1級情報、第二種電気工事士を有する。2023年からOLIENT TECH株式会社でフロントエンドエンジニアとして開発に従事。2025年からMonoLu株式会社ではマネージャーとして推進責任を担いながら、デザインとフロントエンド実装も一貫してリードしている。加えて、業務委託案件ではAI・LLM領域の技術検証と実装に携わった。

「テクノロジーとデザインの融合で人々を幸せに」をミッションに、心地よさと使いやすさを体験として形にするクリエイターとして挑み続けている。`,
    alts: {
      worksBg: '作品背景画像',
      activitiesBg: '活動背景画像',
      profilePhoto: 'プロフィール写真',
      linksBg: '連絡先背景画像',
    },
  },
  list: {
    works: {
      title: '作品',
      bgAlt: '作品背景画像',
    },
    activities: {
      title: '活動',
      bgAlt: '活動背景画像',
    },
  },
  detail: {
    home: 'ホーム',
    published: '公開日',
    updated: '更新日',
    // 日本語ページでは表示しないため空文字
    jaOnlyNote: '',
    works: {
      section: '作品',
      eventLabel: '制作日',
      viewButton: '作品を見る！',
      backButton: '作品一覧に戻る！',
      fallbackDescriptionSuffix: ' - 岸本 篤のポートフォリオ',
    },
    activities: {
      section: '活動',
      eventLabel: '実施日',
      viewButton: '活動を見る！',
      backButton: '活動一覧に戻る！',
      fallbackDescriptionSuffix: ' - 岸本 篤の活動',
    },
  },
  footer: {
    catchphraseLines: ['テクノロジーとデザインの融合で', '人々に感動と幸せを届けるクリエイター'],
    linksTitle: 'リンク',
    infoPanel: {
      title: '思考システム',
      systemMessage: 'システム起動中...',
      items: [
        { id: '01', name: 'ハッカー思考', status: '稼働中', statusColor: 'text-green-400' },
        { id: '02', name: 'デザイン思考', status: '同期中', statusColor: 'text-amber-400' },
        { id: '03', name: '創発エンジン', status: '出力中', statusColor: 'text-green-400' },
      ],
    },
    copyrightHint: '何かが起こるかも...?',
    surpriseMessages: [
      '🎉 サプライズ！ 🎉',
      '🤖 テックの匠 🤖',
      '⚒️ 未来を創るクリエイター ⚒️',
      '★ 感性のエンジニア ★',
      '💻 革新のイノベーター 💻',
    ],
  },
  notFound: {
    heading: 'リンクが家出しました',
    body: ['置き手紙すら残さず旅に出たようです...', '行き先のヒントはホームに貼ってあります。'],
    back: 'ホームに戻る',
    imageAlt: '家出したキャラクター',
  },
};

export type Translation = typeof ja;

const en: Translation = {
  site: {
    title: 'Atsushi Kishimoto Portfolio',
    description:
      'Portfolio of Atsushi Kishimoto, a creator who brings excitement and happiness to people through the fusion of technology and design.',
  },
  author: 'Atsushi Kishimoto',
  hero: {
    titleLines: ['Fusing Technology', 'and Design', 'to Bring People Joy'],
    visualAlt: 'Main visual',
  },
  nav: {
    works: 'Works',
    activities: 'Activities',
    profile: 'Profile',
    links: 'Contact',
  },
  home: {
    stats: {
      works: 'Works Created',
      activities: 'Events Attended',
      skills: 'Skills Acquired',
    },
    sections: {
      works: 'Works',
      activities: 'Activities',
      profile: 'Profile',
      links: 'Contact',
    },
    headings: {
      career: 'Career',
      education: 'Education',
      certifications: 'Certifications',
      media: 'Media',
      skills: 'Skills',
    },
    seeMore: 'See More!',
    profileName: {
      main: 'Atsushi Kishimoto',
      sub: '岸本 篤',
    },
    summary: `Born in Iwaki, Fukushima, Japan, I have been devoted to making things since elementary school. After graduating from the National Institute of Technology, Fukushima College, and studying at the College of Engineering, Ibaraki University, I am now enrolled in the Master's Program in Informatics at the University of Tsukuba. Grounded in Kansei (affective) engineering and HCI, I research and build experience design that starts from how people feel and how easy things are to use.

I have competed in PC Koshien, Geekten, and the KOSEN Programming Contest, and won second place in the AWS Robot Delivery Challenge 2021. In 2023, I was selected as a fifth-cohort member of Hitachi frogs (now Ibaraki frogs). In 2025, as part of Team Imahashi Seisakusho, I received the Ibaraki Governor's Award at the Kenpoku BCP Ideathon.

As a foundation spanning both software and hardware, I hold the Applied Information Technology Engineer certification, the Digital Technology Certification Grade 1 (Information), and a Second-Class Electrician license. Since 2023, I have worked as a frontend engineer at OLIENT TECH Co., Ltd. Since 2025, I have served as a manager at MonoLu Co., Ltd., driving projects forward while also leading design and frontend implementation end to end. I have also worked on technical validation and implementation in the AI and LLM domain through contract work.

With the mission of "bringing happiness to people through the fusion of technology and design," I keep taking on challenges as a creator who turns comfort and usability into tangible experiences.`,
    alts: {
      worksBg: 'Works section background',
      activitiesBg: 'Activities section background',
      profilePhoto: 'Profile photo',
      linksBg: 'Contact section background',
    },
  },
  list: {
    works: {
      title: 'Works',
      bgAlt: 'Works section background',
    },
    activities: {
      title: 'Activities',
      bgAlt: 'Activities section background',
    },
  },
  detail: {
    home: 'Home',
    published: 'Published',
    updated: 'Updated',
    jaOnlyNote: 'This content is currently available in Japanese only.',
    works: {
      section: 'Works',
      eventLabel: 'Created',
      viewButton: 'View the Work!',
      backButton: 'Back to Works!',
      fallbackDescriptionSuffix: ' - A work by Atsushi Kishimoto',
    },
    activities: {
      section: 'Activities',
      eventLabel: 'Date',
      viewButton: 'View the Activity!',
      backButton: 'Back to Activities!',
      fallbackDescriptionSuffix: ' - An activity by Atsushi Kishimoto',
    },
  },
  footer: {
    catchphraseLines: [
      'A creator bringing excitement and happiness to people',
      'through the fusion of technology and design',
    ],
    linksTitle: 'Links',
    infoPanel: {
      title: 'Thinking System',
      systemMessage: 'SYSTEM BOOTING...',
      items: [
        { id: '01', name: 'Hacker Mindset', status: 'ACTIVE', statusColor: 'text-green-400' },
        { id: '02', name: 'Design Thinking', status: 'SYNCING', statusColor: 'text-amber-400' },
        { id: '03', name: 'Emergence Engine', status: 'OUTPUT', statusColor: 'text-green-400' },
      ],
    },
    copyrightHint: 'Something might happen...?',
    surpriseMessages: [
      '🎉 Surprise! 🎉',
      '🤖 Tech Artisan 🤖',
      '⚒️ Creator Shaping the Future ⚒️',
      '★ Engineer of Kansei ★',
      '💻 Innovator at Heart 💻',
    ],
  },
  notFound: {
    heading: 'This link ran away from home',
    body: [
      'It seems to have left on a journey without even a note...',
      'Hints to its whereabouts are posted on the home page.',
    ],
    back: 'Back to Home',
    imageAlt: 'Runaway character',
  },
};

export const translations: Record<Locale, Translation> = { ja, en };

/**
 * Notion の select / multi_select 値の英語表示名マップ。
 * 日本語の値はフィルタ ID・色マッピング・URL クエリの内部キーとして使われているため
 * Notion 側では変更せず、表示時のみここで変換する。未登録の値は原文のまま表示される。
 */
export const CONTENT_LABELS: Record<string, string> = {
  // Notion の types select 値
  '作品': 'Works',
  '記事': 'Articles',
  '活動': 'Activities',
  '掲載': 'Media',
  // buildTagsFromPages が生成する先頭タグ
  'すべて': 'All',
  // スキルカテゴリ（interestColors.ts のキーと同じ値）
  'プログラミング': 'Programming',
  'メディアアート制作': 'Media Art',
  '学問': 'Academics',
  // スキルのサブカテゴリ
  '言語': 'Languages',
  'フロントエンド': 'Frontend',
  'バックエンド・インフラ': 'Backend & Infra',
  'モバイル・ゲーム': 'Mobile & Games',
  'ツール・その他': 'Tools & Others',
  'オーディオ': 'Audio',
  '映像': 'Video',
  'インタラクション': 'Interaction',
  'ハードウェア': 'Hardware',
  '人間情報学': 'Human Informatics',
  '情報科学': 'Information Science',
  '電気工学': 'Electrical Engineering',
  // 作品・活動のタグ
  'アート': 'Art',
  'キャリア': 'Career',
  'ポートフォリオ': 'Portfolio',
  '大学': 'University',
  '大学院': 'Graduate School',
  '情報学': 'Informatics',
  '感性': 'Kansei',
  '文部科学省': 'MEXT',
  '研究': 'Research',
  '筑波大学': 'University of Tsukuba',
  '編入': 'Transfer Admission',
  '進学': 'Higher Education',
  '進路': 'Career Path',
  '高専': 'KOSEN',
};

export const localizeContentLabel = (name: string, locale: Locale): string =>
  locale === 'ja' ? name : CONTENT_LABELS[name] ?? name;
