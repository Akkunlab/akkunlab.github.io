import { defineConfig } from 'astro/config';

import tailwind from "@astrojs/tailwind";
import playformCompress from "@playform/compress";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";

// https://astro.build/config
export default defineConfig({
  site: 'https://akkunlab.pages.dev/',
  integrations: [
    tailwind(),
    playformCompress(),
    icon(),
    sitemap(),
    robotsTxt({
      policy: [{
        userAgent: '*',
        disallow: '/'
      }]
    }),
  ]
});
