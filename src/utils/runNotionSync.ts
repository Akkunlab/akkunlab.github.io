import { incrementalSync } from './notionSync';

// Simple CLI runner: pnpm ts-node src/utils/runNotionSync.ts <DB_ID>
// (Adjust according to your tooling; Astro build can import and call incrementalSync instead.)

const db = process.argv[2] || process.env.NOTION_DATABASE_ID;
if (!db) {
  console.error('Usage: node runNotionSync.js <DB_ID> or set NOTION_DATABASE_ID env var.');
  process.exit(1);
}

incrementalSync(db).then(r => {
  console.log('[notion-sync] done', r);
}).catch(e => {
  console.error('[notion-sync] failed', e);
  process.exit(1);
});
