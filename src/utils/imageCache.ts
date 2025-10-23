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
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

let r2Client: S3Client | null = null;

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
 * Notion の URL から blockId とファイル名を抽出
 * @param urlObj URL オブジェクト
 * @returns 抽出された識別情報
 */
const extractNotionIdentity = (urlObj: URL) => {
  const segments = urlObj.pathname.split('/').filter(Boolean);
  const lastSegment = segments.length > 0 ? segments[segments.length - 1] : undefined;
  const decodedLast = lastSegment ? decodeURIComponent(lastSegment) : '';

  const normalizeUuid = (value: string) => {
    const hex = value.replace(/[^0-9a-f]/gi, '').toLowerCase();
    return hex.length === 32 ? hex : '';
  };

  const identity: { blockId?: string; fileName?: string } = {};

  const queryBlockId =
    urlObj.searchParams.get('id') ??
    urlObj.searchParams.get('blockId') ??
    urlObj.searchParams.get('block_id');
  if (queryBlockId) {
    const normalized = normalizeUuid(queryBlockId);
    identity.blockId = normalized || queryBlockId;
  }

  if (!identity.blockId) {
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const normalized = normalizeUuid(segments[i]);
      if (normalized) {
        identity.blockId = normalized;
        break;
      }
    }
  }

  if (decodedLast && decodedLast !== 'download') {
    identity.fileName = decodedLast;
  }

  return identity;
};

/**
 * キャッシュ用のファイル名を構築
 * @param url 画像の取得元 URL
 * @param format 変換後のフォーマット
 * @returns キャッシュ用ファイル名
 */
const buildFileName = (url: string, format: ImageFormat) => {
  try {
    const urlObj = new URL(url);
    const { blockId, fileName } = extractNotionIdentity(urlObj);

    const parsed = fileName ? path.posix.parse(fileName) : null;
    const baseName = parsed?.name || fileName;
    const safeBase = slugify(baseName || 'image');

    const hashSourceParts: string[] = [];
    if (blockId) hashSourceParts.push(blockId);
    if (baseName) hashSourceParts.push(baseName);
    if (hashSourceParts.length === 0) hashSourceParts.push(url);

    const hash = hashString(hashSourceParts.join('_'));

    return `${safeBase}-${hash.slice(0, 10)}.${format}`;
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
  const metadata = await pipeline.metadata();
  const { width = 0, height = 0 } = metadata;

  let processedPipeline = pipeline;

  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    processedPipeline = pipeline.resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  if (format === 'avif') {
    return processedPipeline.avif({ quality }).toBuffer();
  }

  return processedPipeline.webp({ quality }).toBuffer();
};

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
  const objectKey = `portfolio/${fileName}`;

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: objectKey,
      }),
    );
  } catch (error: any) {

    if (error?.$metadata?.httpStatusCode !== 404) throw error;

    const buffer = await downloadAndConvert(sourceUrl, format, quality);

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: objectKey,
        Body: buffer,
        ContentType: format === 'avif' ? 'image/avif' : 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  return {
    publicUrl: `${config.publicBaseUrl}/${objectKey}`,
    objectKey,
  };
};
