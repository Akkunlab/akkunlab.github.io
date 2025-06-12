/**
 * カードのフィルタリングを行う
 * @param cards - フィルタリング対象のカード要素
 * @param tag - フィルタリングするタグ
 */
const filterCards = (cards: NodeListOf<HTMLAnchorElement>, tag: string): void => {
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
  cards: NodeListOf<HTMLAnchorElement>
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
 * フィルタリングに関する全設定を行う
 */
export const filterTags = (): void => {
  const buttons = document.querySelectorAll<HTMLButtonElement>('button.filter-btn');
  const cards = document.querySelectorAll<HTMLAnchorElement>('.card-item');
  const urlParams = new URLSearchParams(window.location.search);
  const initialTag = urlParams.get('tag') || 'all';

  // 初期状態の設定
  filterCards(cards, initialTag);
  setActiveButton(buttons, initialTag);
  
  // イベントリスナーの設定
  setupButtonListeners(buttons, cards);
};
