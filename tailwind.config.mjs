/** @type {import('tailwindcss').Config} */

import daisyui from 'daisyui';

module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  daisyui: {
    themes: [
      {
        theme: {
          'primary': '#0015ca',
          'primary-content': '#fff',
          'neutral': '#000',
          'neutral-content': '#fff',
          'base-200': '#e5e7eb',
        },
      },
    ],
  },
  theme: {
    fontFamily: {
      'body': ['Noto Sans JP', 'sans-serif'],
      'name': ['Zen Old Mincho', 'serif'],
    },
    extend: {
      colors: {
        'button-active': '#1f1f1f',
        'button-active-content': '#f2f2f2',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(120%)' },
          '100%': { transform: 'translateX(0%)' }
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-120%)' }
        },
        fadeOut: {
          from: { opacity: 1 },
          to: { opacity: 0 }
        },
        textReveal: {
          '0%': { visibility: 'hidden', clipPath: 'inset(0 100% 0 0)' },
          '1%': { visibility: 'visible' },
          '100%': { visibility: 'visible', clipPath: 'inset(0 0 0 0)' }
        }
      },
      animation: {
        slideInOut: 'slideInRight 1.5s cubic-bezier(0.18, 0.9, 0.18, 0.9) forwards,' +
                    'slideOutLeft 1.5s cubic-bezier(0.18, 0.9, 0.18, 0.9) 1.5s forwards',
        fadeOut: 'fadeOut 1.5s 2s forwards',
        textReveal: 'textReveal 1.5s cubic-bezier(0.77, 0, 0.18, 1) forwards'
      }
    }
  },
  plugins: [
    daisyui,
  ],
}
