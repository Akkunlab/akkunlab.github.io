import { BOT_UA, COUNTED_HOSTS, jstDay } from './visit';

interface Env {
  VISITS_DB: D1Database;
  SALT_SECRET?: string;
}

const MAX_BODY_BYTES = 16 * 1024;
const MAX_EVENTS = 60;
const MAX_MS = 2_592_000_000;
const MAX_TS = 4_102_444_800_000;

type Check = (value: unknown) => boolean;

const int =
  (max: number): Check =>
  (value) =>
    Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;
const match =
  (pattern: RegExp): Check =>
  (value) =>
    typeof value === 'string' && pattern.test(value);
const oneOf =
  (...allowed: unknown[]): Check =>
  (value) =>
    allowed.includes(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fits = (value: unknown, fields: Record<string, Check>, required: string[]): boolean =>
  isRecord(value) &&
  required.every((key) => Object.hasOwn(value, key)) &&
  Object.entries(value).every(([key, item]) => Object.hasOwn(fields, key) && fields[key](item));

const NAME = /^[A-Za-z0-9_-]{1,64}$/;
const PATH = /^\/(?!\/)[A-Za-z0-9\-._~%!$&'()*+,;=:@/]{0,511}$/;
const ORIGIN = /^https?:\/\/[a-z0-9.-]{1,253}(:[0-9]{1,5})?$/;
const UTM = /^[A-Za-z0-9_.-]{1,64}$/;

const EVENTS: Record<string, { fields: Record<string, Check>; required: string[] }> = {
  section: {
    fields: { t: oneOf('section'), id: match(NAME), ms: int(MAX_MS), seen: int(100_000) },
    required: ['t', 'id', 'ms', 'seen'],
  },
  scroll: {
    fields: { t: oneOf('scroll'), pct: oneOf(25, 50, 75, 100), at: int(MAX_MS) },
    required: ['t', 'pct', 'at'],
  },
  click: {
    fields: { t: oneOf('click'), to: match(/^[a-z0-9.-]{1,128}$/), section: match(NAME), at: int(MAX_MS) },
    required: ['t', 'to', 'at'],
  },
  vitals: {
    fields: {
      t: oneOf('vitals'),
      m: oneOf('LCP', 'INP', 'CLS'),
      v: (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_MS,
    },
    required: ['t', 'm', 'v'],
  },
  exit: {
    fields: { t: oneOf('exit'), last: match(/^[A-Za-z0-9_-]{0,64}$/), total: int(MAX_MS), active: int(MAX_MS) },
    required: ['t', 'last', 'total', 'active'],
  },
};

const validEvent = (value: unknown): boolean => {
  if (!isRecord(value) || typeof value.t !== 'string' || !Object.hasOwn(EVENTS, value.t)) return false;
  const { fields, required } = EVENTS[value.t];
  return fits(value, fields, required);
};

interface Beacon {
  v: 1;
  vid: string;
  p: string;
  ts: number;
  r?: string;
  u?: Record<string, string>;
  vp?: string;
  e: Record<string, unknown>[];
}

const BEACON: Record<string, Check> = {
  v: oneOf(1),
  vid: match(/^[0-9a-z]{8}$/),
  p: match(PATH),
  ts: int(MAX_TS),
  r: match(ORIGIN),
  u: (value) => fits(value, { source: match(UTM), medium: match(UTM), campaign: match(UTM) }, []),
  vp: match(/^[0-9]{1,5}x[0-9]{1,5}$/),
  e: (value) =>
    Array.isArray(value) &&
    value.length <= MAX_EVENTS &&
    value.every(validEvent) &&
    (value.at(-1) as { t?: unknown } | undefined)?.t === 'exit',
};

const isBeacon = (value: unknown): value is Beacon => fits(value, BEACON, ['v', 'vid', 'p', 'ts', 'e']);

const device = (userAgent: string): 'mobile' | 'tablet' | 'desktop' => {
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(userAgent)) return 'tablet';
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(userAgent)) return 'mobile';
  return 'desktop';
};

const readCapped = async (body: ReadableStream<Uint8Array> | null): Promise<string | null> => {
  if (!body) return null;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let result = '';
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return result + decoder.decode();
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    result += decoder.decode(value, { stream: true });
  }
};

const sha256 = async (...parts: string[]): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('|')));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

let cachedSalt: { day: string; value: string } | null = null;

const dailySalt = async (db: D1Database, today: string): Promise<string> => {
  if (cachedSalt?.day === today) return cachedSalt.value;
  const read = () => db.prepare('SELECT value FROM salt WHERE day = ?1').bind(today).first<{ value: string }>();
  let row = await read();
  if (!row) {
    const { meta } = await db
      .prepare('INSERT INTO salt (day, value) VALUES (?1, ?2) ON CONFLICT DO NOTHING')
      .bind(today, crypto.randomUUID())
      .run();
    if (meta.changes > 0) await db.prepare('DELETE FROM salt WHERE day < ?1').bind(today).run();
    row = await read();
  }
  if (!row?.value) throw new Error('daily salt unavailable');
  cachedSalt = { day: today, value: row.value };
  return row.value;
};

const done = (status: number) => new Response(null, { status, headers: { 'cache-control': 'no-store' } });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') ?? '';
  if (!COUNTED_HOSTS.includes(url.hostname) || !userAgent || BOT_UA.test(userAgent)) return done(204);

  // sendBeacon は Origin を付けないことがある
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return done(403);
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return done(413);

  if (!env.SALT_SECRET) return done(503);

  const body = await readCapped(request.body);
  if (body === null) return done(413);
  let beacon: unknown;
  try {
    beacon = JSON.parse(body);
  } catch {
    return done(400);
  }
  if (!isBeacon(beacon)) return done(400);

  const now = Date.now();
  const today = jstDay(now);
  const exit = beacon.e.find((event) => event.t === 'exit');
  const total = typeof exit?.total === 'number' ? exit.total : 0;

  try {
    const sid = await sha256(
      request.headers.get('cf-connecting-ip') ?? '',
      userAgent,
      today,
      await dailySalt(env.VISITS_DB, today),
      env.SALT_SECRET,
    );
    // 離脱時の 2 通は順不同で届くので、新しいほうだけを残す
    await env.VISITS_DB.prepare(
      `INSERT INTO session (sid, vid, day, started_at, ended_at, path, referrer, utm, device, viewport, events)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
       ON CONFLICT (sid, vid) DO UPDATE SET ended_at = excluded.ended_at, events = excluded.events
       WHERE json_extract(excluded.events, '$[#-1].total') > json_extract(session.events, '$[#-1].total')
          OR (json_extract(excluded.events, '$[#-1].total') = json_extract(session.events, '$[#-1].total')
              AND json_array_length(excluded.events) >= json_array_length(session.events))`,
    )
      .bind(
        sid,
        beacon.vid,
        today,
        Math.max(now - total, 0),
        now,
        beacon.p,
        beacon.r ?? '',
        JSON.stringify(beacon.u ?? {}),
        device(userAgent),
        beacon.vp ?? '',
        JSON.stringify(beacon.e),
      )
      .run();
  } catch (error) {
    console.error('beacon: 503', error instanceof Error ? error.name : 'unknown');
    return done(503);
  }
  return done(204);
};
