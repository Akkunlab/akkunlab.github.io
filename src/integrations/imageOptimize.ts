import type { AstroIntegration } from 'astro';
import fg from 'fast-glob';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

export const optimizeImages = (
  {
    quality = 45,
    format  = 'avif',
    exts    = ['png', 'jpg', 'jpeg', 'gif'],
    keepOriginal = false,
  }: {
    quality?: number;
    format?: 'webp' | 'avif';
    exts?: string[];
    keepOriginal?: boolean;
  } = {},
): AstroIntegration => ({
  name: 'image-optimize',
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

          // リサイズ
          const image = sharp(src);
          const metadata = await image.metadata();
          const { width = 0, height = 0 } = metadata;
          let processedImage = image;

          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            processedImage = image.resize(MAX_WIDTH, MAX_HEIGHT, {
              fit: 'inside',
              withoutEnlargement: true,
            });
          }

          await processedImage[format]({ quality }).toFile(dest);

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
