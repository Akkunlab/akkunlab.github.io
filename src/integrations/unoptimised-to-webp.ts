import type { AstroIntegration } from 'astro';
import fg from 'fast-glob';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

export const unoptimisedToWebp = (
  {
    quality = 80,
    format  = 'webp',
    exts    = ['png', 'jpg', 'jpeg', 'gif'],
    keepOriginal = false,
  }: {
    quality?: number;
    format?: 'webp' | 'avif';
    exts?: string[];
    keepOriginal?: boolean;
  } = {},
): AstroIntegration => ({
  name: 'unoptimised-to-webp',
  hooks: {
    async 'astro:build:done'({ dir, logger }) {
      const distDir = path.join(fileURLToPath(dir), '_astro');
      const pattern = `**/*.{${exts.join(',')}}`;
      const files = await fg(pattern, {
        cwd: distDir,
        onlyFiles: true,
      });

      if (!files.length) {
        logger.info('No target images');
        return;
      }

      logger.info(`Converting ${files.length} images …`);

      await Promise.all(
        files.map(async (rel) => {
          const src  = path.join(distDir, rel);
          const dest = src.replace(/\.(png|jpe?g|gif)$/i, `.${format}`);

          await sharp(src)[format]({ quality }).toFile(dest);

          if (!keepOriginal) await fs.unlink(src);
        }),
      );

      logger.info('Done!');
    },
  },
});
