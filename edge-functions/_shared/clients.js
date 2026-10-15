// clients.js — общий InsForge SDK-клиент для edge-функций.
//
// `adminClient` → роль `project_admin` через reserved-секрет `API_KEY`
// (server-only, инжектится платформой). Все серверные чтения/мутации edge идут
// через него: `EXECUTE` на RPC и гранты на таблицы отозваны у
// `anon`/`authenticated`/`public` (docs/11 S1). Клиентской роли в edge нет.
import { createAdminClient } from 'npm:@insforge/sdk';
import { env } from './env.js';

/** Admin-клиент (роль `project_admin`); ключ — server-only. */
export function adminClient(baseUrl) {
  return createAdminClient({ baseUrl, apiKey: env('API_KEY') });
}
