/** @type {import('tailwindcss').Config} */

import daisyui from 'daisyui'

module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {},
	},
  plugins: [
    daisyui,
  ],
}
