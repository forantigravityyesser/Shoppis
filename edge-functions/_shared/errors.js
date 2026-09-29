// errors.js — маппинг сообщения RPC-ошибки в HTTP-ответ по таблице кодов.

import { json } from './http.js';

export function errorToResponse(errorStatus, message, fallback) {
  const code = Object.keys(errorStatus).find((key) => String(message).includes(key));
  const status = code ? errorStatus[code] : 500;
  return json({ success: false, error: code || fallback }, status);
}
