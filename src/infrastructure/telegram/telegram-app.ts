import { init, initData, miniApp, viewport } from '@telegram-apps/sdk';

export interface TelegramUser {
  id: string;
  username: string;
  firstName: string;
  languageCode: string;
}

interface RawUser {
  id?: number | string;
  username?: string;
  first_name?: string;
  language_code?: string;
}

let initialized = false;

/** Инициализация Mini App: mount, expand на весь экран, ready. Вне Telegram — no-op. */
export function initApp(): void {
  if (initialized) return;
  initialized = true;
  try {
    init();
    miniApp.mount();
    viewport
      .mount()
      .then(() => viewport.expand())
      .catch(() => {});
    miniApp.ready();
  } catch {
    // Браузер вне Telegram: работаем с фолбэками (startapp из URL)
  }
}

interface WebAppUnsafe {
  user?: RawUser;
  start_param?: string;
}

/**
 * Классический объект Telegram WebApp. Его инжектит любой клиент при открытии
 * через кнопку меню / Mini App — даже когда в URL нет tgWebAppData для SDK v3.
 */
function webAppUnsafe(): WebAppUnsafe | undefined {
  try {
    const w = window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: WebAppUnsafe } } };
    return w.Telegram?.WebApp?.initDataUnsafe;
  } catch {
    return undefined;
  }
}

/**
 * Ручной парсинг tgWebAppData из URL (query + hash) мимо валидации SDK —
 * на случай, если SDK кидает InvalidLaunchParams, а данные в URL есть.
 */
function launchDataFromUrl(): { user?: RawUser; startParam?: string } {
  try {
    const src = `${window.location.search}&${window.location.hash.replace(/^#/, '')}`;
    const outer = new URLSearchParams(src);
    const raw = outer.get('tgWebAppData');
    if (!raw) return {};
    const inner = new URLSearchParams(raw);
    let user: RawUser | undefined;
    try {
      const userJson = inner.get('user');
      if (userJson) user = JSON.parse(userJson) as RawUser;
    } catch {
      user = undefined;
    }
    return { user, startParam: inner.get('start_param') ?? undefined };
  } catch {
    return {};
  }
}

function toTelegramUser(raw: RawUser | undefined): TelegramUser | null {
  if (raw?.id == null) return null;
  return {
    id: String(raw.id),
    username: raw.username ?? '',
    firstName: raw.first_name ?? '',
    languageCode: raw.language_code ?? '',
  };
}

export function getTelegramUser(): TelegramUser | null {
  try {
    const fromSdk = toTelegramUser(initData.user() as RawUser | undefined);
    if (fromSdk) return fromSdk;
  } catch {
    // ignore, fallback ниже
  }
  try {
    const fromUnsafe = toTelegramUser(webAppUnsafe()?.user);
    if (fromUnsafe) return fromUnsafe;
  } catch {
    // ignore, fallback ниже
  }
  try {
    const fromUrl = toTelegramUser(launchDataFromUrl().user);
    if (fromUrl) return fromUrl;
  } catch {
    // ignore
  }

  // Fallback for local development outside Telegram
  if (import.meta.env && import.meta.env.DEV) {
    return {
      id: 'mock_12345',
      username: 'mock_user',
      firstName: 'Mock Dev User',
      languageCode: 'ru',
    };
  }

  return null;
}

/** startapp-параметр: 'seller' | 'store_<uuid>' | ''. Вне TG — из ?startapp= в URL. */
export function getStartParam(): string {
  try {
    const param = initData.startParam();
    if (param) return param;
  } catch {
    // ignore, fallback ниже
  }
  const unsafeParam = webAppUnsafe()?.start_param;
  if (unsafeParam) return unsafeParam;
  const urlParam = launchDataFromUrl().startParam;
  if (urlParam) return urlParam;
  return new URLSearchParams(window.location.search).get('startapp') ?? '';
}

/** Временная диагностика окружения (без секретов: только флаги и имена ключей) */
export function logTelegramDiagnostics(): void {
  try {
    const hash = window.location.hash ?? '';
    const w = window as unknown as {
      Telegram?: { WebApp?: { initData?: string; initDataUnsafe?: Record<string, unknown> } };
    };
    const webApp = w.Telegram?.WebApp;
    // eslint-disable-next-line no-console
    console.log('[shoppis] build=onboarding-fix-3', {
      hasTelegram: !!w.Telegram,
      hasWebApp: !!webApp,
      initDataLen: webApp?.initData?.length ?? 0,
      unsafeKeys: webApp?.initDataUnsafe ? Object.keys(webApp.initDataUnsafe) : [],
      hashHasTgData: hash.includes('tgWebAppData'),
      query: window.location.search,
    });
    try {
      const user = initData.user();
      const startParam = initData.startParam();
      // eslint-disable-next-line no-console
      console.log('[shoppis] sdk signals ok:', { hasUser: !!user, startParam });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[shoppis] sdk signals fail:', String((e as Error)?.message ?? e).slice(0, 200));
    }
  } catch {
    // ignore
  }
}
