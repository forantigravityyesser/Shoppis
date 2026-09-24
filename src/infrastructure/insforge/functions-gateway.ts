import { INSFORGE_ANON_KEY, INSFORGE_URL } from './config';

/**
 * Единый адаптер вызова InsForge Edge Functions.
 *
 * Вся специфика endpoint'а (function2-хост, авторизация) живёт ЗДЕСЬ, а не в
 * бизнес-коде и не в monkey-patch поверх SDK. Остальные модули зависят только
 * от invokeFunction<T>().
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

export interface InvokeOptions {
  body?: unknown;
  /** Серверная сессия (Bearer). Без неё используется anon key. */
  token?: string | null;
}

export interface FunctionError {
  message: string;
  /** HTTP-статус edge-функции (для будущей обработки 401 на уровне P2). */
  status?: number;
  context?: unknown;
}

export interface FunctionResponse<T> {
  data: T | null;
  error: FunctionError | null;
}

export async function invokeFunction<T>(
  functionName: string,
  options: InvokeOptions = {},
): Promise<FunctionResponse<T>> {
  try {
    const authToken = options.token || INSFORGE_ANON_KEY;
    const response = await fetch(`${functionsBase()}/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(options.body ?? {}),
    });

    let data: unknown;
    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const message = (data as { error?: string })?.error || data || 'Edge function error';
      return { data: null, error: { message: String(message), status: response.status, context: data } };
    }
    return { data: data as T, error: null };
  } catch (err) {
    return { data: null, error: { message: (err as Error)?.message ?? 'Network error', context: err } };
  }
}
