import { createClient } from '@insforge/sdk';
import { INSFORGE_ANON_KEY, INSFORGE_URL } from './config';

/** Единственный экземпляр клиента. Напрямую createClient больше нигде не вызывать. */
export const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
});

/**
 * Порт паттерна из старого проекта: invoke идет на function2-хост
 * (https://<appid>.eu-central.insforge.app -> https://<appid>.function2.insforge.app),
 * URL/ключ берутся из нашего config, не хардкод.
 */
function functionsBase(): string {
  try {
    const url = new URL(INSFORGE_URL);
    const appId = url.hostname.split('.')[0];
    if (appId) return `${url.protocol}//${appId}.function2.insforge.app`;
  } catch {
    // ignore, fallback ниже
  }
  return INSFORGE_URL;
}

type InvokeOptions = { body?: unknown; headers?: Record<string, string> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(insforge.functions as any).invoke = async (functionName: string, options?: InvokeOptions) => {
  try {
    const response = await fetch(`${functionsBase()}/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(INSFORGE_ANON_KEY ? { Authorization: `Bearer ${INSFORGE_ANON_KEY}` } : {}),
        ...(options?.headers || {}),
      },
      body: JSON.stringify(options?.body || {}),
    });

    let data: unknown;
    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const message =
        (data as { error?: string })?.error || data || 'Edge function error';
      return { data: null, error: { message, context: data } };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};
