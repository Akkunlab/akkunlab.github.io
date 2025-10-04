const STAGGER_DELAY: number = 150;    // 要素間の遅延（ミリ秒）
const BREAKPOINT_MD: number = 768;    // MD以下のブレークポイント
const PARALLAX_SPEED: number = 0.05;  // パララックス効果の速度

// 重複初期化防止用のフラグ
const SCROLL_ANIM_INIT_FLAG = '__akkunlabScrollAnimationsInitialized__';

/**
 * ヘッダーのスクロール制御
 * MD以下のサイズでスクロールに応じてヘッダーを表示/非表示
 */
const setupHeaderScrollControl = (): void => {
  const header = document.getElementById('header');

  if (!header) return;
  
  let lastScrollTop = 0;
  const isMobile = () => window.innerWidth < BREAKPOINT_MD;

  const handleScroll = () => {
    if (!isMobile()) return;
    
    const currentScrollTop = window.scrollY || document.documentElement.scrollTop;
    
    // スクロール方向の判定
    header.style.transform = currentScrollTop > lastScrollTop ? 'translateY(-100%)' : 'translateY(0)';
    lastScrollTop = currentScrollTop;
  };
  
  const handleResize = () => {
    if (!isMobile()) header.style.transform = 'translateY(0)';
  };

  // 重複でイベントが追加されないように一度だけ追加
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', handleResize);
};

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
          const offsetPosition = elementPosition + window.scrollY;

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
 * テキスト要素のふんわりアニメーション
 * @param element - アニメーションを適用する要素
 */
const animateTextFadeIn = (element: Element): void => {
  // 2回目以降の実行を防止
  if ((element as HTMLElement).dataset.animated === 'true') return;
  (element as HTMLElement).dataset.animated = 'true';

  element.classList.add('animate-fadeInUp');
  element.classList.remove('opacity-0', 'translate-y-8');
};

/**
 * Workアイテムのアニメーション
 * @param element - アニメーションを適用する要素
 */
const animateWorkItem = (element: Element): void => {
  // 2回目以降の実行を防止
  if ((element as HTMLElement).dataset.animated === 'true') return;
  (element as HTMLElement).dataset.animated = 'true';

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
    if ((item as HTMLElement).dataset.animated === 'true') return;
    (item as HTMLElement).dataset.animated = 'true';
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
        } else if (entry.target.classList.contains('fade-in-text')) {
          animateTextFadeIn(entry.target);
        }

        // 一度アニメーションが実行されたら監視を解除
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  return observer;
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

    // 既にアニメーション済みならスキップ
    if ((item as HTMLElement).dataset.animated === 'true') return;

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
  document.addEventListener('splashScreenComplete', () => {
    setupHeroTextAnimation(heroTextContainer, heroTexts, observer);
  });
};

/**
 * パララックス背景効果の設定
 */
const setupParallaxEffect = (): void => {
  const parallaxElements = document.querySelectorAll('.parallax-bg');
  
  if (parallaxElements.length === 0) return;
  
  const handleScroll = () => {
    const scrollPosition = window.scrollY;
    
    parallaxElements.forEach((element: Element) => {
      const elementTop = element.getBoundingClientRect().top + scrollPosition;
      const elementHeight = (element as HTMLElement).offsetHeight;
      const viewportHeight = window.innerHeight;
      
      // 画面内に要素が表示されている場合のみ計算
      if (
        scrollPosition + viewportHeight > elementTop && 
        scrollPosition < elementTop + elementHeight
      ) {
        const distance = scrollPosition - elementTop;
        const yPos = distance * PARALLAX_SPEED;
        
        const imageElement = element.querySelector('img');
        if (imageElement) {
          (imageElement as HTMLElement).style.transform = `translateY(${yPos}px)`;
        }
      }
    });
  };

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        handleScroll();
        ticking = false;
      });
      ticking = true;
    }
  });
  
  handleScroll();
};

/**
 * テキスト要素のアニメーション設定
 * @param textElements - 対象となるテキスト要素のリスト
 * @param observer - Intersection Observer
 */
const setupTextAnimation = (
  textElements: NodeListOf<Element>, 
  observer: IntersectionObserver
): void => {
  textElements.forEach((element: Element) => {

    // 既にアニメーション済みならスキップ
    if ((element as HTMLElement).dataset.animated === 'true') return;

    // 要素が画面内にあるかをチェック
    const rect: DOMRect = element.getBoundingClientRect();
    const isVisible: boolean = 
      rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.bottom >= 0;
    
    // 画面内にない要素のみ監視対象に追加
    if (!isVisible) {
      observer.observe(element);
    } else {
      animateTextFadeIn(element);
    }
  });
};

/**
 * スクロールに関する全アニメーションの設定を行う
 */
export const setupScrollAnimations = (): void => {
  // 多重初期化の防止
  if ((window as any)[SCROLL_ANIM_INIT_FLAG]) return;
  (window as any)[SCROLL_ANIM_INIT_FLAG] = true;

  // 監視する対象の要素を取得
  const workItems: NodeListOf<Element> = document.querySelectorAll('.work-item');
  const heroTextContainer: Element | null = document.querySelector('.hero-text');
  const heroTexts: NodeListOf<Element> = document.querySelectorAll('.hero-text span');
  const fadeInTexts: NodeListOf<Element> = document.querySelectorAll('.fade-in-text');

  // Intersection Observerの作成
  const observer: IntersectionObserver = createIntersectionObserver(heroTexts);

  // Workアイテムの監視とアニメーション設定
  setupWorkItemsAnimation(workItems, observer);

  // ヒーローテキストのアニメーション設定
  setupHeroImageAndText(heroTextContainer, heroTexts, observer);

  // テキストのフェードインアニメーション設定
  setupTextAnimation(fadeInTexts, observer);

  // スムーススクロールの設定
  setupSmoothScroll();

  // ヘッダーのスクロール制御を設定
  setupHeaderScrollControl();

  // パララックス効果の設定
  setupParallaxEffect();
};
