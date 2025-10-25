import { remark } from 'remark';
import remarkHtml from 'remark-html';
import remarkBreaks from 'remark-breaks'
import { visit } from 'unist-util-visit'
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const DEFAULT_IMAGE_WIDTH = 640;
const DEFAULT_IMAGE_HEIGHT = 360;

const BASE_DIRECTORY = path.resolve(process.cwd(), 'public');

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
    if (/^https?:\/\//.test(imageSource)) {
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
 * Remark プラグイン： 画像ノードに実寸サイズを追加
 */
const addImageDimensions = () => async (tree: any): Promise<void> => {
  const pendingTasks: Promise<void>[] = [];

  visit(tree, 'image', (node: any) => {
    pendingTasks.push(
      (async () => {
        const { width, height } = await getImageIntrinsicSize(node.url);
        node.data ??= {};
        node.data.hProperties ??= {};
        node.data.hProperties.width = width;
        node.data.hProperties.height = height;
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
      .use(addImageDimensions)
      .use(remarkHtml)
      .process(markdownContent);

    return html.toString();
  } catch (error) {
    console.error('Error in markdownToHtml:', error);

    return '';
  }
};
