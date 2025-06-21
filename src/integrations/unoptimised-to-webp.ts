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

      // 変換処理
      const results = await Promise.all(
        files.map(async (rel) => {
          const src  = path.join(distDir, rel);
          const dest = src.replace(/\.(png|jpe?g|gif)$/i, `.${format}`);

          const originalStats = await fs.stat(src);
          const originalSize = originalStats.size;

          await sharp(src)[format]({ quality }).toFile(dest);

          const convertedStats = await fs.stat(dest);
          const convertedSize = convertedStats.size;

          const reduction = originalSize - convertedSize;
          const reductionPercent = ((reduction / originalSize) * 100).toFixed(2);

          if (!keepOriginal) await fs.unlink(src);

          return {
            file: rel,
            reduction,
            reductionPercent,
            originalSize,
            convertedSize,
          };
        }),
      );

      // 結果を表示
      results.forEach(({ file, reduction, reductionPercent }) => {
        const sign = reduction >= 0 ? '-' : '+';
        const absReduction = Math.abs(reduction);
        const formattedReduction = absReduction >= 1024 
          ? `${(absReduction / 1024).toFixed(2)} KB`
          : `${absReduction} Bytes`;
        
        logger.info(`(${sign}${formattedReduction}) ${reductionPercent}% reduction in ${file}`);
      });

      logger.info('Done!');
    },
  },
});
