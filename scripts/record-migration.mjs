import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

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

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npx, ['-y', '@insforge/cli', 'db', 'query', sql, '--json'], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
