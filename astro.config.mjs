import { defineConfig } from 'astro/config';
import { SITE_URL } from './src/constants';

import tailwind from "@astrojs/tailwind";
import playformCompress from "@playform/compress";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  integrations: [
    tailwind(),
    playformCompress(),
    icon(),
    sitemap(),
    robotsTxt({
      policy: [{
        userAgent: '*',
        allow: '/'
      }]
    }),
  ]
});
