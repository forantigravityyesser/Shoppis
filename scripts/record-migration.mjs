import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Records a migration as applied in `public.schema_migrations` (project-owned
 * tracking; see migrations/README.md). Use it right after applying a migration
 * by hand or via admin SQL.
 *
 * Run: npm run migrations:record -- 0034
 */

const version = process.argv[2];
if (!/^\d{4}$/.test(version ?? '')) {
  console.error('Usage: npm run migrations:record -- <4-digit version>   (e.g. 0034)');
  process.exit(1);
}

const files = readdirSync(resolve(process.cwd(), 'migrations'));
const file = files.find((name) => name.startsWith(`${version}_`) && name.endsWith('.sql'));
if (!file) {
  console.error(`[migrations] no migration file for version ${version}`);
  process.exit(1);
}

const name = file.replace(/^\d{4}_/, '').replace(/\.sql$/, '');
const sql =
  `insert into public.schema_migrations (version, name) ` +
  `values ('${version}', '${name}') on conflict (version) do nothing;`;

const config = JSON.parse(readFileSync(resolve(process.cwd(), '.insforge/project.json'), 'utf8'));
const res = await fetch(`${config.oss_host}/api/database/advance/rawsql`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.api_key}`,
  },
  body: JSON.stringify({ query: sql }),
});

if (!res.ok) {
  console.error(`[migrations] record failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

await res.json().catch(() => ({}));
console.log(`[migrations] recorded ${version}_${name}`);
