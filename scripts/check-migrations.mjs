import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Validates the project migration filename convention:
 *   <4-digit zero-padded version>_<lower_snake_name>.sql   e.g. 0026_storefront_catalog_read.sql
 *
 * Fails on: malformed names, duplicate versions, or gaps in the sequence.
 * Catches the "two 0030 files" class of regression before it reaches the backend.
 *
 * Run: node scripts/check-migrations.mjs  (or `npm run migrations:check`)
 */

const MIGRATIONS_DIR = resolve(process.cwd(), 'migrations');
const FILE_RE = /^(\d{4})_([a-z0-9_]+)\.sql$/;

const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql'));

const malformed = [];
const byVersion = new Map();
const duplicates = [];

for (const name of files) {
  const match = FILE_RE.exec(name);
  if (!match) {
    malformed.push(name);
    continue;
  }
  const version = match[1];
  if (byVersion.has(version)) {
    duplicates.push(version);
  } else {
    byVersion.set(version, name);
  }
}

const versions = [...byVersion.keys()].map(Number).sort((a, b) => a - b);
const gaps = [];
for (let i = 0; i < versions.length; i += 1) {
  const expected = i + 1;
  if (versions[i] !== expected) {
    gaps.push(
      `expected ${String(expected).padStart(4, '0')}, found ${String(versions[i]).padStart(4, '0')}`,
    );
    break;
  }
}

const problems = [];
if (malformed.length) problems.push(`malformed filenames:\n  ${malformed.join('\n  ')}`);
if (duplicates.length) problems.push(`duplicate versions: ${[...new Set(duplicates)].join(', ')}`);
if (gaps.length) problems.push(`numbering gap: ${gaps.join('; ')}`);

if (problems.length) {
  console.error(`[migrations] FAIL (${files.length} files)`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(
  `[migrations] OK — ${files.length} files, versions 0001..${byVersion.size.toString().padStart(4, '0')}, no duplicates/gaps`,
);
