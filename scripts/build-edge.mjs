// build-edge.mjs — бандлит каждую edge-функцию вместе с edge-functions/_shared
// в один ESM-файл (edge-functions/.dist/<slug>.js) для деплоя в InsForge.
//
// InsForge деплоит функцию ОДНИМ файлом, поэтому общий код приходится вкладывать
// на этапе сборки. Пакет npm:@insforge/sdk остаётся внешним (Deno резолвит его сам).

import { build } from 'esbuild';
import { readdirSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(root, 'edge-functions');
const outDir = join(srcDir, '.dist');

const entries = readdirSync(srcDir, { withFileTypes: true })
  .filter((d) => d.isFile() && d.name.endsWith('.js'))
  .map((d) => join(srcDir, d.name));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: entries,
  outdir: outDir,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  external: ['npm:@insforge/sdk'],
  logLevel: 'info',
});

console.log(`Bundled ${entries.length} edge functions -> ${outDir}`);
