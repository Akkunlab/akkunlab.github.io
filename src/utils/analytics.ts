import { onCLS, onINP, onLCP } from 'web-vitals';

// 制約は functions/api/e.ts と揃える
const ENDPOINT = '/api/e';
const MAX_EVENTS = 60;
const ORIGIN = /^https?:\/\/[a-z0-9.-]{1,253}(:[0-9]{1,5})?$/;
const UTM = /^[A-Za-z0-9_.-]{1,64}$/;
const MIN_VISIBLE_MS = 500;
const THRESHOLDS = [0, 0.05, 0.1, 0.2, 0.4, 0.8, 1];

type Tracked = { ms: number; seen: number; since: number | null; inView: boolean };
type BeaconEvent = { t: string } & Record<string, string | number>;

const start = (): void => {
  const opened = performance.now();
  const at = () => Math.round(performance.now() - opened);

  const vid = (crypto.randomUUID?.() ?? `${Math.random()}`)
    .replace(/[^0-9a-z]/g, '')
    .padEnd(8, '0')
    .slice(0, 8);

  const events: BeaconEvent[] = [];
  const sections = new Map<string, Tracked>();
  const nodes = [...document.querySelectorAll<HTMLElement>('main section[id]')];
  for (const node of nodes) sections.set(node.id, { ms: 0, seen: 0, since: null, inView: false });

  let last = '';
  let depth = 0;
  let active = 0;
  let activeSince: number | null = document.visibilityState === 'visible' ? opened : null;
  let sent = '';

  const sync = () => {
    const now = performance.now();
    const pageVisible = document.visibilityState === 'visible';
    if (activeSince !== null) active += now - activeSince;
    activeSince = pageVisible ? now : null;
    for (const [id, tracked] of sections) {
      const on = tracked.inView && pageVisible;
      if (on && tracked.since === null) {
        tracked.since = now;
        last = id;
        continue;
      }
      if (tracked.since !== null) {
        tracked.ms += now - tracked.since;
        tracked.since = on ? now : null;
      }
    }
  };

  const query = (key: string) => {
    const value = new URLSearchParams(location.search).get(key);
    return value && UTM.test(value) ? value : undefined;
  };

  const referrer = () => {
    try {
      const origin = document.referrer ? new URL(document.referrer).origin : '';
      return ORIGIN.test(origin) ? origin : undefined;
    } catch {
      return undefined;
    }
  };

  const flush = () => {
    sync();
    const visible = [...sections]
      .filter(([, tracked]) => tracked.ms >= MIN_VISIBLE_MS)
      .map(([id, tracked]) => ({ t: 'section', id, ms: Math.round(tracked.ms), seen: tracked.seen }));
    // 離脱時は 2 回呼ばれるので、変化が無ければ送らない
    const signature = `${events.length}|${visible.length}|${last}|${Math.round(active / 1000)}`;
    if (signature === sent) return;

    const utm = { source: query('utm_source'), medium: query('utm_medium'), campaign: query('utm_campaign') };
    const room = MAX_EVENTS - visible.length - 1;
    const body = JSON.stringify({
      v: 1,
      vid,
      p: location.pathname.slice(0, 512),
      ts: Date.now(),
      r: referrer(),
      u: Object.values(utm).some(Boolean) ? utm : undefined,
      vp: `${Math.round(innerWidth)}x${Math.round(innerHeight)}`,
      e: [...visible, ...(room > 0 ? events.slice(-room) : []), { t: 'exit', last, total: at(), active: Math.round(active) }],
    });
    if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) sent = signature;
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const tracked = sections.get((entry.target as HTMLElement).id);
        if (!tracked) continue;
        const enough = Math.min(entry.boundingClientRect.height, innerHeight * 0.5);
        const inView = entry.isIntersecting && entry.intersectionRect.height >= enough;
        if (inView && !tracked.inView) tracked.seen++;
        tracked.inView = inView;
      }
      sync();
    },
    { threshold: THRESHOLDS },
  );
  for (const node of nodes) observer.observe(node);

  let ticking = false;
  addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const max = document.documentElement.scrollHeight - innerHeight;
        const pct = max > 0 ? Math.min(100, Math.floor((scrollY / max) * 4) * 25) : 100;
        if (pct > depth) {
          depth = pct;
          events.push({ t: 'scroll', pct, at: at() });
        }
      });
    },
    { passive: true },
  );

  document.addEventListener(
    'click',
    (event) => {
      const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href]');
      if (!link) return;
      const to =
        link.protocol === 'mailto:' ? 'mailto' : link.protocol === 'tel:' ? 'tel' : link.host !== location.host ? link.hostname : '';
      if (!to) return;
      const section = link.closest('main section[id]')?.id;
      events.push(section ? { t: 'click', to, section, at: at() } : { t: 'click', to, at: at() });
    },
    { capture: true },
  );

  const vital = (m: 'LCP' | 'INP' | 'CLS') => (metric: { value: number }) => {
    events.push({ t: 'vitals', m, v: m === 'CLS' ? Math.round(metric.value * 1000) / 1000 : Math.round(metric.value) });
  };
  onLCP(vital('LCP'));
  onINP(vital('INP'));
  onCLS(vital('CLS'));

  // hidden で出る web-vitals の最終値を拾うため、web-vitals より後に登録する
  document.addEventListener('visibilitychange', () => {
    sync();
    if (document.visibilityState === 'hidden') flush();
  });
  addEventListener('pagehide', flush);
};

try {
  start();
} catch {}
