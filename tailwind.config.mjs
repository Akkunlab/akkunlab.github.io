/** @type {import('tailwindcss').Config} */

import daisyui from 'daisyui'

module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  daisyui: {
    themes: [
      {
        theme: {
          'primary': '#0015ca',
          'primary-content': '#000',
          'neutral': '#000',
          'neutral-content': '#fff',
        },
      },
    ],
  },
  theme: {
    extend: {
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
        }
      },
      animation: {
        slideInOut: 'slideInRight 1.5s cubic-bezier(0.18, 0.9, 0.18, 0.9) forwards,' +
                    'slideOutLeft 1.5s cubic-bezier(0.18, 0.9, 0.18, 0.9) 1.5s forwards',
        fadeOut: 'fadeOut 1.5s 2s forwards',
      }
    }
  },
  plugins: [
    daisyui,
  ],
}
