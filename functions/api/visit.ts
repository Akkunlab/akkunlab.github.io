interface Env {
  VISITS_DB: D1Database;
}

const COUNTED_HOSTS = ['akkunlab.dev'];
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const BOT_UA = /bot|crawl|spider|slurp|lighthouse|headless|pagespeed|preview|facebookexternalhit|embedly|quora link/i;

const jstDay = (ms: number): string => new Date(ms + JST_OFFSET_MS).toISOString().slice(0, 10);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const host = new URL(request.url).hostname;
  const ua = request.headers.get('user-agent') ?? '';
  if (COUNTED_HOSTS.includes(host) && ua && !BOT_UA.test(ua)) {
    await env.VISITS_DB.prepare(
      'INSERT INTO visit_daily (day, host, count) VALUES (?1, ?2, 1) ON CONFLICT (day, host) DO UPDATE SET count = count + 1',
    )
      .bind(jstDay(Date.now()), host)
      .run();
  }
  return new Response(null, { status: 204 });
};
