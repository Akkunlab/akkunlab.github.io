
const HEADER_HEIGHT: number = 64; // ヘッダーの高さ

/* スムーススクロール機能の設定 */
const setupSmoothScroll = (): void => {
  const scrollLinks = document.querySelectorAll('a[data-scroll="true"]');
  
  // 各リンクにクリックイベントリスナーを追加
  scrollLinks.forEach((link: Element) => {
    link.addEventListener('click', (e: Event) => {
      e.preventDefault();
      
      // リンクのhref属性からターゲットIDを取得
      const href = (link as HTMLAnchorElement).getAttribute('href') || '';
      const targetId = href.split('#')[1];
      
      if (targetId) {
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
          const elementPosition = targetElement.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - HEADER_HEIGHT;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }
    });
  });
};

export const setupScrollAnimations = (): void => {

  setupSmoothScroll(); // スムーススクロールの設定

  /* Intersection Observerの設定 */
  const options: IntersectionObserverInit = {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.01 // 要素の1%が見えたら実行
  };

  /* 監視する対象の要素 */
  const workItems: NodeListOf<Element> = document.querySelectorAll('.work-item');
  const heroTextContainer: Element | null = document.querySelector('.hero-text');
  const heroTexts: NodeListOf<Element> = document.querySelectorAll('.hero-text span');

  /* Workアニメーション関数を定義 */
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

  /* ヒーローテキストのアニメーション関数を定義 */
  const animateHeroText = (): void => {
    heroTexts.forEach((item: Element) => {
      const index: string | null = item.getAttribute('data-index');
      const delay: number = index ? parseFloat(index) * 0.7 + 0.5 : 0.5;
      
      item.classList.add('animate-textReveal');
      (item as HTMLElement).style.animationDelay = `${delay}s`;
    });
  };

  /* Intersection Observerの作成と設定 */
  const observer: IntersectionObserver = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {

      // 要素が表示領域に入った場合
      if (entry.isIntersecting) {
        if (entry.target.classList.contains('hero-text')) {
          animateHeroText();
        } else if (entry.target.classList.contains('work-item')) {
          animateWorkItem(entry.target);
        }
        observer.unobserve(entry.target); // 監視を解除
      }
    });
  }, options);

  /* 各要素を監視対象に追加し、表示済み要素のアニメーションを開始 */
  let delay: number = 0;
  const STAGGER_DELAY: number = 150; // 要素間の遅延（ミリ秒）

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

  /* ヒーローテキストのアニメーション設定 */
  const heroImage: HTMLImageElement | null = document.getElementById('hero-image') as HTMLImageElement;
  
  // 画像のロードイベントを設定
  if (heroImage) {
    if (heroImage.complete) {
      setupHeroTextAnimation();
    } else {
      heroImage.addEventListener('load', setupHeroTextAnimation);
    }
  } else {
    setupHeroTextAnimation();
  }
  
  // ヒーローテキストのアニメーション設定関数
  function setupHeroTextAnimation(): void {
    if (heroTextContainer) observer.observe(heroTextContainer);
    
    // アニメーションクラスをリセット
    heroTexts.forEach((item: Element) => item.classList.remove('animate-textReveal'));
  }
};
