/**
 * カードのフィルタリングを行う
 * @param cards - フィルタリング対象のカード要素
 * @param tag - フィルタリングするタグ
 */
const filterCards = (cards: NodeListOf<HTMLElement>, tag: string): void => {
  cards.forEach(card => {
    const tags = (card.dataset.tags || '').split(',');
    card.style.display = (tag === 'all' || tags.includes(tag)) ? 'block' : 'none';
  });
};

/**
 * URLのクエリパラメータを更新する
 * @param tag - 更新するタグ
 */
const updateURLParameter = (tag: string): void => {
  const url = new URL(window.location.href);
  url.searchParams.set('tag', tag);
  window.history.pushState({ path: url.href }, '', url.href);
};

/**
 * ボタンのアクティブ状態を設定する
 * @param buttons - フィルタリングボタンの要素
 * @param tag - 対象のタグ
 */
const setActiveButton = (buttons: NodeListOf<HTMLButtonElement>, tag: string): void => {
  buttons.forEach(button => {
    const isActive = button.getAttribute('data-tag') === tag;
    button.classList.toggle('bg-button-active', isActive);
    button.classList.toggle('text-button-active-content', isActive);
    button.classList.toggle('btn-outline', !isActive);
  });
};

/**
 * ボタンにイベントリスナーを設定する
 * @param buttons - フィルタリングボタンの要素
 * @param cards - フィルタリング対象のカード要素
 */
const setupButtonListeners = (
  buttons: NodeListOf<HTMLButtonElement>, 
  cards: NodeListOf<HTMLElement>
): void => {
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const tag = button.getAttribute('data-tag');

      if (tag) {
        filterCards(cards, tag);
        updateURLParameter(tag);
        setActiveButton(buttons, tag);
      }
    });
  });
};

/**
 * タグ名・カテゴリ名を ID 用に正規化
 * @param name - タグ名・カテゴリ名
 * @returns 正規化された ID
 */
export const normalizeTagName = (name?: string): string => {
  if (!name) return '';

  return name
    .trim()
    .toLowerCase()
    .replace(/[/\s]+/g, '-')  // スラッシュ・空白をハイフンに変換
    .replace(/-+/g, '-');     // 連続したハイフンを 1 つにまとめる
};

/**
 * タグ名やカテゴリ名を正規化して data-tags 属性を生成
 * @param tags - NotionRecord の tags プロパティ
 * @param category - NotionRecord の category プロパティ
 * @returns data-tags 属性に埋め込むためのカンマ区切り文字列
 */
export const generateTagString = (
  tags?: { name?: string }[],
  category?: string,
): string => {
  const normalizedTags = [
    ...(tags ?? []).map(tag => normalizeTagName(tag.name)),
    normalizeTagName(category),
  ].filter((tag): tag is string => Boolean(tag));

  return normalizedTags.join(',');
};

/**
 * フィルタリングに関する全設定を行う
 */
export const filterTags = (): void => {
  const buttons = document.querySelectorAll<HTMLButtonElement>('button.filter-btn');
  const cards = document.querySelectorAll<HTMLElement>('.work-item');
  const urlParams = new URLSearchParams(window.location.search);
  const initialTag = urlParams.get('tag') || 'all';

  // 初期状態の設定
  filterCards(cards, initialTag);
  setActiveButton(buttons, initialTag);
  
  // イベントリスナーの設定
  setupButtonListeners(buttons, cards);
};
