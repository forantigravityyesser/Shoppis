// http.js — единые HTTP-ответы и CORS для edge-функций.

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

/** Ответ на CORS preflight. */
export function preflight() {
  return new Response(null, { headers: CORS_HEADERS });
}

/** 405 для не-POST запросов. */
export function methodNotAllowed() {
  return json({ success: false, error: 'Use POST' }, 405);
}

/** Безопасный разбор JSON-тела: null при ошибке. */
export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Bearer-токен из заголовка Authorization. */
export function bearerToken(request) {
  const authHeader = request.headers.get('Authorization') || '';
  return authHeader.replace(/^Bearer\s+/i, '');
}
