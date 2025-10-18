import * as fs from 'fs/promises';
import * as fssync from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  getDevImageDirectory,
  getDevImagePublicPath,
  getR2Config,
  hashString,
} from './cache';

type ImageFormat = 'webp' | 'avif';

interface EnsureImageOptions {
  format: ImageFormat;
  quality: number;
}

const { MODE } = import.meta.env;

const isProduction = MODE === 'production';

/**
 * 指定したディレクトリが存在しない場合は作成
 * @param dir ディレクトリパス
 */
const ensureDir = async (dir: string) => {
  if (!fssync.existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
};

/**
 * URL 由来の文字列をスラッグ化して安全なファイル名を作成
 * @param input 元の文字列
 * @returns スラッグ化した文字列
 */
const slugify = (input: string) =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';

/**
 * 画像 URL とフォーマットからキャッシュ用ファイル名を生成
 * @param url 画像の取得元 URL
 * @param format 変換後のフォーマット
 * @returns キャッシュ用ファイル名
 */
const buildFileName = (url: string, format: ImageFormat) => {
  try {
    const urlObj = new URL(url);
    const base = decodeURIComponent(path.posix.basename(urlObj.pathname));
    const { name } = path.posix.parse(base);
    const hash = hashString(url);
    return `${slugify(name)}-${hash.slice(0, 10)}.${format}`;
  } catch {
    const hash = hashString(url);
    return `${hash}.${format}`;
  }
};

/**
 * Notion から画像を取得し指定フォーマットへ変換
 * @param url 画像の取得元 URL
 * @param format 変換後のフォーマット
 * @param quality 画質設定
 * @returns 変換済み画像のバッファ
 */
const downloadAndConvert = async (url: string, format: ImageFormat, quality: number) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image from Notion: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const pipeline = sharp(buffer).rotate();

  if (format === 'avif') {
    return pipeline.avif({ quality }).toBuffer();
  }

  return pipeline.webp({ quality }).toBuffer();
};

let r2Client: S3Client | null = null;

/**
 * Cloudflare R2 へアクセスするための S3 互換クライアントを取得
 * @returns クライアントと接続設定
 */
const getR2Client = () => {
  const config = getR2Config();
  if (!config) {
    throw new Error('Cloudflare R2 environment variables are not configured.');
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return { client: r2Client, config };
};

/**
 * 画像をキャッシュに保存し、再利用可能な公開 URL を返す
 * @param sourceUrl Notion 上の画像 URL
 * @param options 変換設定
 * @returns 公開 URL とオブジェクトキー
 */
export const ensureImageCached = async (
  sourceUrl: string,
  { format, quality }: EnsureImageOptions,
): Promise<{ publicUrl: string; objectKey: string }> => {
  const fileName = buildFileName(sourceUrl, format);

  if (!isProduction) {
    const devDir = getDevImageDirectory();
    await ensureDir(devDir);

    const filePath = path.join(devDir, fileName);
    if (!fssync.existsSync(filePath)) {
      const buffer = await downloadAndConvert(sourceUrl, format, quality);
      await fs.writeFile(filePath, buffer as unknown as NodeJS.ArrayBufferView);
    }

    const publicDir = getDevImagePublicPath().replace(/\/$/, '');
    return {
      publicUrl: `${publicDir}/${fileName}`,
      objectKey: fileName,
    };
  }

  const { client, config } = getR2Client();
  const objectKey = `notion/${fileName}`;

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: objectKey,
      }),
    );
  } catch (error) {
    const buffer = await downloadAndConvert(sourceUrl, format, quality);

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: objectKey,
        Body: buffer,
        ContentType: format === 'avif' ? 'image/avif' : 'image/webp',
      }),
    );
  }

  const baseUrl = `https://${config.bucketName}.${config.accountId}.r2.cloudflarestorage.com`;

  return {
    publicUrl: `${baseUrl}/${objectKey}`,
    objectKey,
  };
};
