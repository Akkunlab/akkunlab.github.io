const HEADER_HEIGHT: number = 64; // ヘッダーの高さ
const STAGGER_DELAY: number = 150; // 要素間の遅延（ミリ秒）

/**
 * Intersection Observerのオプション
 */
const observerOptions: IntersectionObserverInit = {
  root: null,
  rootMargin: '0px 0px -10% 0px',
  threshold: 0.01 // 要素の1%が見えたら実行
};

/**
 * スムーススクロール機能の設定
 */
const setupSmoothScroll = (): void => {
  const scrollLinks = document.querySelectorAll('a[data-scroll="true"]');
  
  scrollLinks.forEach((link: Element) => {
    link.addEventListener('click', (e: Event) => {
      e.preventDefault();
      
      const href = (link as HTMLAnchorElement).getAttribute('href') || '';
      const targetId = href.split('#')[1];
      
      if (targetId) {
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
          const elementPosition = targetElement.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.scrollY - HEADER_HEIGHT;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }
    });
  });
};

/**
 * Workアイテムのアニメーション
 * @param element - アニメーションを適用する要素
 */
const animateWorkItem = (element: Element): void => {
  const curtain: HTMLElement | null = element.querySelector('.curtain-animation');
  const image: HTMLElement | null = element.querySelector('.image-animation');
  const imageWrapper: HTMLElement | null = element.querySelector('.image-wrapper');
  
  // カーテンアニメーションの開始
  if (curtain) {
    curtain.classList.remove('opacity-0');
    curtain.classList.add('animate-imageCurtain');
  }
  
  // 画像アニメーション
  if (image) {
    setTimeout(() => {
      image.classList.add('animate-imageFadeIn');
      image.classList.remove('opacity-0');

      setTimeout(() => {
        if (imageWrapper) imageWrapper.classList.add('z-30');
        if (curtain) curtain.style.display = 'none';
      }, 1800);
    }, 500);
  }
};

/**
 * ヒーローテキストのアニメーション
 * @param heroTexts - アニメーションを適用するテキスト要素のリスト
 */
const animateHeroText = (heroTexts: NodeListOf<Element>): void => {
  heroTexts.forEach((item: Element) => {
    const index: string | null = item.getAttribute('data-index');
    const delay: number = index ? parseFloat(index) * 0.7 + 0.5 : 0.5;
    
    item.classList.add('animate-textReveal');
    (item as HTMLElement).style.animationDelay = `${delay}s`;
  });
};

/**
 * ヒーローテキストアニメーションのセットアップ
 * @param heroTextContainer - コンテナ要素
 * @param heroTexts - テキスト要素のリスト
 * @param observer - Intersection Observer
 */
const setupHeroTextAnimation = (
  heroTextContainer: Element | null, 
  heroTexts: NodeListOf<Element>,
  observer: IntersectionObserver
): void => {
  if (heroTextContainer) observer.observe(heroTextContainer);
  
  // アニメーションクラスをリセット
  heroTexts.forEach((item: Element) => item.classList.remove('animate-textReveal'));
};

/**
 * Intersection Observerの作成
 * @param heroTexts - ヒーローテキスト要素のリスト
 * @returns 設定済みのIntersection Observer
 */
const createIntersectionObserver = (heroTexts: NodeListOf<Element>): IntersectionObserver => {
  const observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {

      // 要素が表示領域に入った場合
      if (entry.isIntersecting) {
        if (entry.target.classList.contains('hero-text')) {
          animateHeroText(heroTexts);
        } else if (entry.target.classList.contains('work-item')) {
          animateWorkItem(entry.target);
        }

        // 一度アニメーションが実行されたら監視を解除
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  return observer;
};

/**
 * スクロールに関する全アニメーションの設定を行う
 */
export const setupScrollAnimations = (): void => {

  // スムーススクロールの設定
  setupSmoothScroll();

  // 監視する対象の要素を取得
  const workItems: NodeListOf<Element> = document.querySelectorAll('.work-item');
  const heroTextContainer: Element | null = document.querySelector('.hero-text');
  const heroTexts: NodeListOf<Element> = document.querySelectorAll('.hero-text span');

  // Intersection Observerの作成
  const observer: IntersectionObserver = createIntersectionObserver(heroTexts);

  // Workアイテムの監視とアニメーション設定
  setupWorkItemsAnimation(workItems, observer);

  // ヒーローテキストのアニメーション設定
  setupHeroImageAndText(heroTextContainer, heroTexts, observer);
};

/**
 * Workアイテムのアニメーション設定
 * @param workItems - 対象となる要素のリスト
 * @param observer - Intersection Observer
 */
const setupWorkItemsAnimation = (
  workItems: NodeListOf<Element>, 
  observer: IntersectionObserver
): void => {
  let delay: number = 0;

  workItems.forEach((item: Element) => {

    // 要素が画面内にあるかをチェック
    const rect: DOMRect = item.getBoundingClientRect();
    const isVisible: boolean = 
      rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.bottom >= 0;
    
    // 画面内にある要素は遅延をつけて順番にアニメーション
    if (isVisible) {
      setTimeout(() => animateWorkItem(item), delay);
      delay += STAGGER_DELAY;
    } else {
      observer.observe(item);
    }
  });
};

/**
 * ヒーロー画像とテキストのアニメーション設定
 * @param heroTextContainer - テキストコンテナ要素
 * @param heroTexts - テキスト要素のリスト
 * @param observer - Intersection Observer
 */
const setupHeroImageAndText = (
  heroTextContainer: Element | null,
  heroTexts: NodeListOf<Element>,
  observer: IntersectionObserver
): void => {
  const heroImage: HTMLImageElement | null = document.getElementById('hero-image') as HTMLImageElement;
  
  // 画像のロードイベントを設定
  if (heroImage) {
    if (heroImage.complete) {
      setupHeroTextAnimation(heroTextContainer, heroTexts, observer);
    } else {
      heroImage.addEventListener('load', () => {
        setupHeroTextAnimation(heroTextContainer, heroTexts, observer);
      });
    }
  } else {
    setupHeroTextAnimation(heroTextContainer, heroTexts, observer);
  }
};
