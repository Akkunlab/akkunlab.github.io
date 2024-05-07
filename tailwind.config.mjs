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
        },
      },
    ],
  },
  plugins: [
    daisyui,
  ],
}
