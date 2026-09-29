// env.js — чтение переменных окружения Deno с безопасным fallback.

export function env(name, fallback = '') {
  try {
    const v = typeof Deno !== 'undefined' ? Deno.env.get(name) : undefined;
    return v || fallback;
  } catch {
    return fallback;
  }
}
