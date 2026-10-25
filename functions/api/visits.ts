interface Env {
  VISITS_DB: D1Database;
  VISITS_READ_TOKEN: string;
}

interface Row {
  day: string;
  host: string;
  count: number;
}

const MAX_DAYS = 400;

const sameToken = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = request.headers.get('authorization') ?? '';
  if (!env.VISITS_READ_TOKEN || !sameToken(auth, `Bearer ${env.VISITS_READ_TOKEN}`)) {
    return new Response('Unauthorized', { status: 401 });
  }
  const since = new URL(request.url).searchParams.get('since') ?? '';
  const from = /^\d{4}-\d{2}-\d{2}$/.test(since)
    ? since
    : new Date(Date.now() - MAX_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { results } = await env.VISITS_DB.prepare(
    'SELECT day, host, count FROM visit_daily WHERE day >= ?1 ORDER BY day',
  )
    .bind(from)
    .all<Row>();
  const visits: Record<string, Record<string, number>> = {};
  for (const row of results) {
    visits[row.day] ??= {};
    visits[row.day][row.host] = row.count;
  }
  return Response.json({ visits }, { headers: { 'cache-control': 'no-store' } });
};
