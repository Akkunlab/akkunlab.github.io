import { defineConfig } from 'astro/config';
import { SITE_URL } from './src/constants/siteData';

import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import playformCompress from "@playform/compress";
import { optimizeImages } from './src/integrations/imageOptimize';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  integrations: [
    tailwind(),
    icon({
      iconDir: 'src/assets/icons',
    }),
    sitemap(),
    robotsTxt({
      policy: [{
        userAgent: '*',
        allow: '/'
      }]
    }),
    // optimizeImages(),
    // playformCompress(),
  ]
});
