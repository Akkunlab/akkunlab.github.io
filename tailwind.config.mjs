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
          'base-300': '#0a0a0a',
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
        'header-bg': 'rgba(0, 0, 0, 0.7)',
        'header-border': 'rgba(255, 255, 255, 0.1)',
        'header-hover': 'rgba(255, 255, 255, 0.1)',
        'footer-bg': '#080b14',
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
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 }
        },
        fadeOut: {
          from: { opacity: 1 },
          to: { opacity: 0 }
        },
        carousel: {
          '0%': { transform: 'translateX(10%)', opacity: 1, clipPath: 'inset(0 0 0 100%)' },
          '10%': { transform: 'translateX(0)', opacity: 1, clipPath: 'inset(0 0 0 0)' },
          '50%': { transform: 'translateX(0)', opacity: 1, clipPath: 'inset(0 0 0 0)' },
          '60%': { transform: 'translateX(-10%)', opacity: 1, clipPath: 'inset(0 100% 0 0)' },
          '61%, 100%': { transform: 'translateX(0%)', opacity: 0 },
        },
        textReveal: {
          '0%': { visibility: 'hidden', clipPath: 'inset(0 100% 0 0)' },
          '100%': { visibility: 'visible', clipPath: 'inset(0 0 0 0)' }
        },
        imageCurtain: {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        scan: {
          '0%': { transform: 'translateY(0)', opacity: '0.5' },
          '50%': { opacity: '0.1' },
          '100%': { transform: 'translateY(100px)', opacity: '0.5' }
        },
        glitch: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        typing: {
          from: { width: '0' },
          to: { width: '100%' }
        },
        blinkCaret: {
          '0%, 100%': { borderColor: 'transparent' },
          '50%': { borderColor: 'rgba(34, 211, 238, 0.7)' }
        },
      },
      animation: {
        slideInOut: 'slideInRight 1.5s cubic-bezier(0.18, 0.9, 0.18, 0.9) forwards,' +
                    'slideOutLeft 1.5s cubic-bezier(0.18, 0.9, 0.18, 0.9) 1.5s forwards',
        fadeOut: 'fadeOut 1.5s 2s forwards',
        textReveal: 'textReveal 1s cubic-bezier(0.77, 0, 0.18, 1) forwards',
        imageCurtain: 'imageCurtain 1.8s cubic-bezier(0.77, 0, 0.18, 1) forwards',
        imageFadeIn: 'fadeIn 1.8s cubic-bezier(0.77, 0, 0.18, 1) forwards',
        scan: 'scan 2s linear infinite',
        glitch: 'glitch 2s linear infinite',
        typing: 'typing 3.5s steps(40, end), blinkCaret 0.75s step-end infinite',
        carousel: 'carousel 5s cubic-bezier(0.77, 0, 0.18, 1) infinite'
      }
    }
  },
  plugins: [
    daisyui,
  ],
}
