import type { APIRoute } from 'astro';
import { fetchNotionPage, fetchNotionPageList } from '@/utils/notion';
import { SITE_URL } from '@/constants';

const IMAGE_URL_REGEX = /!\[[^\]]*]\(([^)]+)\)/g;

const escapeXml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const extractImageUrls = (markdown: string): string[] => {
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = IMAGE_URL_REGEX.exec(markdown))) {
    const url = match[1]?.trim();
    if (url) urls.push(url);
  }
  return urls;
};

const resolveUrl = (url: string, siteUrl: string): string =>
  /^https?:\/\//.test(url) ? url : `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`;

export const GET: APIRoute = async () => {
  const siteUrl = SITE_URL.replace(/\/+$/, '');
  const PORTFOLIO_DATABASE_ID = import.meta.env.PORTFOLIO_DATABASE_ID;

  const [works, activities] = await Promise.all([
    fetchNotionPageList(PORTFOLIO_DATABASE_ID, {
      types: ['作品', '記事'],
      sorts: [{ property: 'event', direction: 'descending' }],
    }),
    fetchNotionPageList(PORTFOLIO_DATABASE_ID, {
      types: ['活動'],
      sorts: [{ property: 'event', direction: 'descending' }],
    }),
  ]);

  const pages = [
    ...works.map((p) => ({ ...p, basePath: '/works' })),
    ...activities.map((p) => ({ ...p, basePath: '/activities' })),
  ];

  const entries: string[] = [];

  for (const page of pages) {
    const pageData = await fetchNotionPage(page.id);
    if (!pageData?.content) continue;

    const imageUrls = extractImageUrls(pageData.content);
    if (imageUrls.length === 0) continue;

    const pageUrl = escapeXml(`${siteUrl}${page.basePath}/${page.slug}/`);
    const imageTags = imageUrls
      .map((url) => {
        const absoluteUrl = escapeXml(resolveUrl(url, siteUrl));
        const title = escapeXml(page.title || '');
        return `      <image:image>
        <image:loc>${absoluteUrl}</image:loc>
        ${title ? `<image:title>${title}</image:title>` : ''}
      </image:image>`;
      })
      .join('\n');

    entries.push(`  <url>
    <loc>${pageUrl}</loc>
${imageTags}
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
