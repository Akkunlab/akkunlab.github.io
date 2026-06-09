import { remark } from 'remark';
import remarkHtml from 'remark-html';
import remarkBreaks from 'remark-breaks'
import { visit } from 'unist-util-visit'
import type { Root, Image } from 'mdast';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { isHttpUrl } from './url';

const DEFAULT_IMAGE_WIDTH = 640;
const DEFAULT_IMAGE_HEIGHT = 360;

const GENERIC_ALT_TEXTS = new Set(['image', 'img', '画像', '']);

const BASE_DIRECTORY = path.resolve(process.cwd(), 'public');

/**
 * 画像URLからファイル名ベースの alt テキストを生成
 */
const generateAltFromUrl = (url: string): string => {

  // URLからパス部分を取得（クエリ・フラグメント除去）
  const pathPart = url.split(/[?#]/)[0] || url;
  const filename = path.basename(pathPart, path.extname(pathPart));

  // ハッシュ部分（末尾の -xxxxxxxxxxxx）を除去し、区切り文字をスペースに変換
  const cleaned = filename.replace(/-[a-f0-9]{8,}$/, '').replace(/[-_]/g, ' ').trim();
  return cleaned || filename;
};

/**
 * 与えられた画像パス/URLの実サイズを取得
 * @param imageSource 画像のパスまたはURL
 * @returns 画像の幅と高さ
 */
const getImageIntrinsicSize = async (
  imageSource: string
): Promise<{ width: number; height: number }> => {
  try {

    // 外部URL
    if (isHttpUrl(imageSource)) {
      const response = await fetch(imageSource);

      if (!response.ok) throw new Error(`Failed to fetch image: ${imageSource}`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const metadata = await sharp(buffer).metadata();

      if (metadata.width && metadata.height) {
        return { width: metadata.width, height: metadata.height };
      }
    } else {

      // ローカル
      const absolutePath = path.join(BASE_DIRECTORY, imageSource.replace(/^\//, ''));

      if (fs.existsSync(absolutePath)) {
        const metadata = await sharp(absolutePath).metadata();

        if (metadata.width && metadata.height) {
          return { width: metadata.width, height: metadata.height };
        }
      }
    }
  } catch (error) {
    console.warn('[getImageIntrinsicSize] Could not read image size:', imageSource, error);
  }

  return { width: DEFAULT_IMAGE_WIDTH, height: DEFAULT_IMAGE_HEIGHT };
};

/**
 * Remark プラグイン： 画像ノードにサイズ・alt・loading 属性を追加
 */
const enhanceImages = () => async (tree: Root): Promise<void> => {
  const pendingTasks: Promise<void>[] = [];

  visit(tree, 'image', (node: Image) => {
    pendingTasks.push(
      (async () => {
        const { width, height } = await getImageIntrinsicSize(node.url);
        const data = (node.data ??= {}) as { hProperties?: Record<string, unknown> };
        data.hProperties ??= {};
        data.hProperties.width = width;
        data.hProperties.height = height;
        data.hProperties.loading = 'lazy';

        // alt テキストが空もしくは汎用的な場合、URLから生成
        const currentAlt = (node.alt || '').trim();
        if (GENERIC_ALT_TEXTS.has(currentAlt.toLowerCase())) {
          const generated = generateAltFromUrl(node.url);
          if (generated) {
            node.alt = generated;
          }
        }
      })()
    );
  });

  await Promise.all(pendingTasks);
};

/**
 * Markdown形式の文字列をHTMLに変換
 * @param markdownContent Markdown形式の文字列
 * @returns HTML形式の文字列
 */
export const markdownToHtml = async (markdownContent: string): Promise<string> => {
  try {
    const html = await remark()
      .use(remarkBreaks)
      .use(enhanceImages)
      .use(remarkHtml, { sanitize: false })
      .process(markdownContent);

    return html.toString();
  } catch (error) {
    console.error('Error in markdownToHtml:', error);

    return '';
  }
};
