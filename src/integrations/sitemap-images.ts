import type { AstroIntegration } from 'astro';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

interface ImageEntry {
  loc: string;
  title?: string;
}

/**
 * 画像サイトマップ XML から各ページ URL に紐づく画像情報を抽出
 */
const parseImageSitemap = (xml: string): Map<string, ImageEntry[]> => {
  const result = new Map<string, ImageEntry[]>();
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];

  for (const block of urlBlocks) {
    const loc = block.match(/<loc>([\s\S]*?)<\/loc>/)?.[1]?.trim();
    if (!loc) continue;

    const images: ImageEntry[] = [];
    const imageBlocks = block.match(/<image:image>[\s\S]*?<\/image:image>/g) || [];

    for (const imgBlock of imageBlocks) {
      const imgLoc = imgBlock.match(/<image:loc>([\s\S]*?)<\/image:loc>/)?.[1]?.trim();
      if (!imgLoc) continue;
      images.push({
        loc: imgLoc,
        title: imgBlock.match(/<image:title>([\s\S]*?)<\/image:title>/)?.[1]?.trim(),
      });
    }

    if (images.length > 0) result.set(loc, images);
  }

  return result;
};

/**
 * 画像エントリから <image:image> タグを構築
 */
const buildImageTags = (images: ImageEntry[]): string =>
  images
    .map((img) => {
      const title = img.title ? `<image:title>${img.title}</image:title>` : '';
      return `<image:image><image:loc>${img.loc}</image:loc>${title}</image:image>`;
    })
    .join('');

/**
 * ビルド後に sitemap-images.xml のデータを sitemap-0.xml に統合する Astro インテグレーション
 */
export default function sitemapImages(): AstroIntegration {
  return {
    name: 'sitemap-images',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const distDir = fileURLToPath(dir);
        const sitemapPath = join(distDir, 'sitemap-0.xml');
        const imageSitemapPath = join(distDir, 'sitemap-images.xml');

        let sitemapXml: string;
        let imageSitemapXml: string;

        try {
          [sitemapXml, imageSitemapXml] = await Promise.all([
            readFile(sitemapPath, 'utf-8'),
            readFile(imageSitemapPath, 'utf-8'),
          ]);
        } catch {
          console.warn('[sitemap-images] Required sitemap files not found, skipping.');
          return;
        }

        const imageData = parseImageSitemap(imageSitemapXml);
        if (imageData.size === 0) {
          console.log('[sitemap-images] No image data found, skipping.');
          return;
        }

        // image namespace を追加（未設定の場合）
        if (!sitemapXml.includes('xmlns:image=')) {
          sitemapXml = sitemapXml.replace(
            '<urlset',
            '<urlset xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
          );
        }

        // 各 URL エントリに画像タグを注入
        for (const [pageUrl, images] of imageData) {
          const escapedUrl = pageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const pattern = new RegExp(`(<loc>${escapedUrl}</loc>)(.*?)(</url>)`, 's');
          sitemapXml = sitemapXml.replace(pattern, `$1$2${buildImageTags(images)}$3`);
        }

        await writeFile(sitemapPath, sitemapXml, 'utf-8');
        await unlink(imageSitemapPath);

        console.log(
          `[sitemap-images] Merged ${imageData.size} pages with image data into sitemap-0.xml`,
        );
      },
    },
  };
}
