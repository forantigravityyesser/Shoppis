import {
  init,
  initData,
  miniApp,
  openTelegramLink as sdkOpenTelegramLink,
  viewport,
} from '@telegram-apps/sdk';
import { BUYER_APP_SHORTNAME, BUYER_BOT_USERNAME } from '../insforge/config';

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

interface TelegramInsets {
  top?: number;
  bottom?: number;
}

interface RawViewportWebApp {
  safeAreaInset?: TelegramInsets;
  contentSafeAreaInset?: TelegramInsets;
  isFullscreen?: boolean;
  isVersionAtLeast?: (version: string) => boolean;
  requestFullscreen?: () => void;
  onEvent?: (event: string, handler: () => void) => void;
}

/** Инициализация Mini App: mount, expand, fullscreen, ready. Вне Telegram — no-op. */
export function initApp(): void {
  if (initialized) return;
  initialized = true;
  let sdkReady = false;
  try {
    init();
    sdkReady = true;
  } catch {
    // SDK не инициализировался — уходим на классический Telegram.WebApp
  }
  if (!sdkReady) {
    setupRawViewport();
    return;
  }
  try {
    miniApp.mount();
    miniApp.ready();
  } catch {
    // ignore
  }
  setupViewport();
}

/** Настройка viewport через SDK: раскрытие, fullscreen, реактивные safe-area инсеты. */
function setupViewport(): void {
  try {
    if (!viewport.mount.isAvailable()) {
      setupRawViewport();
      return;
    }
    viewport
      .mount()
      .then(onSdkViewportMounted)
      .catch(() => setupRawViewport());
  } catch {
    setupRawViewport();
  }
}

function onSdkViewportMounted(): void {
  try {
    viewport.expand();
    const sync = () => writeInsets(viewport.safeAreaInsets(), viewport.contentSafeAreaInsets());
    sync();
    viewport.safeAreaInsets.sub(sync);
    viewport.contentSafeAreaInsets.sub(sync);
  } catch {
    // ignore
  }
  void requestSdkFullscreen().then(logViewportDiagnostics);
}

/** Fullscreen (Bot API 8.0+); на старых клиентах — тихо остаёмся в обычном режиме. */
async function requestSdkFullscreen(): Promise<void> {
  try {
    if (viewport.requestFullscreen.isAvailable()) {
      await viewport.requestFullscreen();
    }
  } catch {
    // fullscreen не поддерживается
  }
}

/** Фолбэк на классический Telegram.WebApp, когда SDK не смонтировал viewport. */
function setupRawViewport(): void {
  const tg = rawViewportWebApp();
  if (!tg) return;
  const sync = () => writeInsets(tg.safeAreaInset, tg.contentSafeAreaInset);
  sync();
  for (const event of ['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged']) {
    try {
      tg.onEvent?.(event, sync);
    } catch {
      // ignore
    }
  }
  try {
    if (tg.isVersionAtLeast?.('8.0') && typeof tg.requestFullscreen === 'function') {
      tg.requestFullscreen();
      logViewportDiagnostics();
    }
  } catch {
    // fullscreen не поддерживается
  }
}

function rawViewportWebApp(): RawViewportWebApp | undefined {
  try {
    return (window as unknown as { Telegram?: { WebApp?: RawViewportWebApp } }).Telegram?.WebApp;
  } catch {
    return undefined;
  }
}

/**
 * Инсеты Telegram → CSS-переменные. `safe` — системная область (вырез, статус-бар),
 * `content` — область поверх плавающего UI Telegram (актуальна в fullscreen).
 */
function writeInsets(safe?: TelegramInsets, content?: TelegramInsets): void {
  try {
    const root = document.documentElement;
    root.style.setProperty('--tg-safe-area-top', `${safe?.top ?? 0}px`);
    root.style.setProperty('--tg-safe-area-bottom', `${safe?.bottom ?? 0}px`);
    root.style.setProperty('--tg-content-safe-area-top', `${content?.top ?? 0}px`);
    root.style.setProperty('--tg-content-safe-area-bottom', `${content?.bottom ?? 0}px`);
  } catch {
    // вне браузера — нечего писать
  }
}

/** Текущее viewport-состояние: fullscreen + safe-area инсеты. SDK, иначе raw-фолбэк. */
function viewportDiagnostics(): Record<string, unknown> {
  try {
    return {
      isFullscreen: viewport.isFullscreen(),
      safeArea: viewport.safeAreaInsets(),
      contentSafeArea: viewport.contentSafeAreaInsets(),
    };
  } catch {
    const tg = rawViewportWebApp();
    if (!tg) return { available: false };
    return {
      isFullscreen: tg.isFullscreen ?? null,
      safeArea: tg.safeAreaInset ?? null,
      contentSafeArea: tg.contentSafeAreaInset ?? null,
    };
  }
}

/** Диагностика viewport для проверки fullscreen на устройстве (без секретов). */
export function logViewportDiagnostics(): void {
  try {
    const root = document.documentElement.style;
    console.log('[shoppis] viewport:', {
      ...viewportDiagnostics(),
      css: {
        safeTop: root.getPropertyValue('--tg-safe-area-top').trim(),
        safeBottom: root.getPropertyValue('--tg-safe-area-bottom').trim(),
        contentTop: root.getPropertyValue('--tg-content-safe-area-top').trim(),
        contentBottom: root.getPropertyValue('--tg-content-safe-area-bottom').trim(),
      },
    });
  } catch {
    // ignore
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

  return null;
}

/** Username buyer-бота (без `@`) для публичных ссылок. Статический build-конфиг. */
export function getBuyerBotUsername(): string {
  return BUYER_BOT_USERNAME;
}

/** Короткое имя buyer Mini App для прямой ссылки. Статический build-конфиг. */
export function getBuyerAppShortname(): string {
  return BUYER_APP_SHORTNAME;
}

/**
 * Открыть t.me-ссылку внутри Telegram (например, предпросмотр витрины).
 * Вне Telegram / при недоступности SDK — открываем в новой вкладке.
 * `true`, если открытие инициировано; `false` — открыть не удалось.
 */
export function openTelegramLink(url: string): boolean {
  try {
    if (sdkOpenTelegramLink.isAvailable()) {
      sdkOpenTelegramLink(url);
      return true;
    }
  } catch {
    // fallback ниже
  }
  try {
    return Boolean(window.open(url, '_blank', 'noopener'));
  } catch {
    return false;
  }
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

/**
 * Сырой initData для серверной валидации подписи (telegram-auth).
 * Порядок: SDK → window.Telegram.WebApp.initData → tgWebAppData из URL.
 */
export function getRawInitData(): string {
  try {
    const raw = (initData as unknown as { raw?: () => string }).raw?.();
    if (raw) return raw;
  } catch {
    // ignore, fallback ниже
  }
  try {
    const raw = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram
      ?.WebApp?.initData;
    if (raw) return raw;
  } catch {
    // ignore, fallback ниже
  }
  try {
    const src = `${window.location.search}&${window.location.hash.replace(/^#/, '')}`;
    return new URLSearchParams(src).get('tgWebAppData') ?? '';
  } catch {
    return '';
  }
}

/** Временная диагностика окружения (без секретов: только флаги и имена ключей) */
export function logTelegramDiagnostics(): void {
  try {
    const hash = window.location.hash ?? '';
    const w = window as unknown as {
      Telegram?: { WebApp?: { initData?: string; initDataUnsafe?: Record<string, unknown> } };
    };
    const webApp = w.Telegram?.WebApp;
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
      console.log('[shoppis] sdk signals ok:', { hasUser: !!user, startParam });
    } catch (e) {
      console.log('[shoppis] sdk signals fail:', String((e as Error)?.message ?? e).slice(0, 200));
    }
    logViewportDiagnostics();
  } catch {
    // ignore
  }
}
