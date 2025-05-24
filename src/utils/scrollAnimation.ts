export const setupScrollAnimations = (): void => {

  /* Intersection Observerの設定 */
  const options: IntersectionObserverInit = {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.01 // 要素の1%が見えたら実行
  };

  /* 監視する対象の要素 */
  const workItems: NodeListOf<Element> = document.querySelectorAll('.work-item');
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
  const animateHeroText = (element: Element): void => {
    const index = element.getAttribute('data-index');
    const delay = index ? parseFloat(index) * 0.7 + 0.5 : 0.5;
    
    // アニメーションクラスを追加
    element.classList.add('animate-textReveal');
    (element as HTMLElement).style.animationDelay = `${delay}s`;
  };

  /* Intersection Observerの作成と設定 */
  const observer: IntersectionObserver = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {

      // 要素が表示領域に入った場合
      if (entry.isIntersecting) {
        if (entry.target.parentElement?.classList.contains('hero-text')) {
          animateHeroText(entry.target);
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
  const heroImage = document.getElementById('hero-image') as HTMLImageElement;
  
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
  function setupHeroTextAnimation() {
    heroTexts.forEach((item: Element) => {
      observer.observe(item);
      item.classList.remove('animate-textReveal');
    });
  }
};
