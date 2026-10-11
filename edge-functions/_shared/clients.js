// clients.js — общие InsForge SDK-клиенты для edge-функций.
//
// - `anonClient`  → роль `anon`: публичные чтения по существующим грантам.
// - `adminClient` → роль `project_admin` через reserved-секрет `API_KEY`
//   (server-only, инжектится платформой). Нужен для защищённых order-RPC,
//   у которых `EXECUTE` отозван у `anon`/`authenticated`/`public`
//   (docs/24 ORD-HARDEN-01): прямой вызов с клиентской ролью невозможен,
//   доверенный серверный путь — только через edge.
import { createAdminClient, createClient } from 'npm:@insforge/sdk';
import { env } from './env.js';

/** Anon-клиент (роль `anon`). */
export function anonClient(baseUrl) {
  return createClient({ baseUrl, anonKey: env('ANON_KEY') });
}

/** Admin-клиент (роль `project_admin`); ключ — server-only. */
export function adminClient(baseUrl) {
  return createAdminClient({ baseUrl, apiKey: env('API_KEY') });
}
