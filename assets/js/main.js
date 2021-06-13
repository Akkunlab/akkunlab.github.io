/* Loading */
window.onload = () => {
    const loading = document.getElementById('loading');
    const loadingText = document.getElementById('loading_text');
    
    const loadingAnimation = (element, value, delay) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                element['classList'].toggle(value);
                resolve();
            }, delay)
        });
    }

    loadingAnimation(loadingText, 'in-right', 500)
        .then(() => loadingAnimation(loadingText, 'out-left', 1500))
        .then(() => loadingAnimation(loading, 'hidden', 500))
        .then(() => setTimeout(() => loading.style.display = 'none', 1000));
}

/* SmoothScroll */
const duration = 1000;
const header = 100;
const Ease = { easeInOut: t => t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1 };

window.addEventListener('DOMContentLoaded', () => {
   
    let SST = document.querySelectorAll('a[href^="#"]');
    SST.forEach(SST => {
   
        SST.addEventListener('click', e => {

            let href = SST.getAttribute('href');
            let currentPostion = document.documentElement.scrollTop || document.body.scrollTop;
            let targetElement = document.getElementById( href.replace('#', '') );
   
            if (targetElement) {
   
                e.preventDefault();
                e.stopPropagation();
                let targetPosition = window.pageYOffset + targetElement.getBoundingClientRect().top - header;
                let startTime = performance.now();
                let loop = nowTime => {

                    let time = nowTime - startTime;
                    let normalizedTime = time / duration;
   
                    if (normalizedTime < 1) {

                        window.scrollTo(0, currentPostion + ((targetPosition - currentPostion) * Ease.easeInOut(normalizedTime)));
                        requestAnimationFrame(loop);

                    } else {
                        
                        window.scrollTo(0, targetPosition);

                    }
   
                }

                requestAnimationFrame(loop);

            }

        });
   
    });
   
});

/* Mobile nav */
const nav_link = document.getElementsByClassName('nav_link_mobile');
for (let i = 0; i < nav_link.length; i++) {
    nav_link[i].addEventListener('click', () => document.getElementById('mobile_nav_input').checked = false);
}
