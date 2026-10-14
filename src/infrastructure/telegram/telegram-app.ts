import {
  init,
  initData,
  miniApp,
  openTelegramLink as sdkOpenTelegramLink,
  viewport,
} from '@telegram-apps/sdk';
import type { ViewportSnapshot } from '../../application/ports/telegram';
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
  viewportHeight?: number;
  viewportStableHeight?: number;
  isVersionAtLeast?: (version: string) => boolean;
  requestFullscreen?: () => void;
  onEvent?: (event: string, handler: () => void) => void;
}

const EMPTY_SNAPSHOT: ViewportSnapshot = {
  isFullscreen: false,
  safeTop: 0,
  safeBottom: 0,
  contentTop: 0,
  contentBottom: 0,
  viewportHeight: 0,
  viewportStableHeight: 0,
};

/**
 * Минимальный верхний отступ в fullscreen: гарантирует, что собственная шапка
 * (кнопка «назад», название, иконки) не уходит под плавающие кнопки Telegram
 * (Close / меню). Применяется как НИЖНЯЯ граница: если Telegram отдаёт реальный
 * `safeAreaInset`/`contentSafeAreaInset` больше — берётся он (max в CSS), поэтому
 * это не «один и тот же отступ для всех телефонов». Значение подобрано по
 * реальным скриншотам: хватает статус-бар + строка управления Telegram + запас.
 */
const FULLSCREEN_MIN_TOP = 88;

let viewportSnapshot: ViewportSnapshot = EMPTY_SNAPSHOT;
const viewportSubscribers = new Set<() => void>();
let windowListenersBound = false;

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
  // Каждый шаг защищён отдельно: падение `expand()`/одного `.sub` не должно
  // лишать нас инсетов, класса fullscreen и снимка viewport.
  try {
    viewport.expand();
  } catch {
    // ignore
  }
  const sync = () => writeInsets(viewport.safeAreaInsets(), viewport.contentSafeAreaInsets());
  const sub = (register: () => void) => {
    try {
      register();
    } catch {
      // ignore
    }
  };
  sync();
  sub(() => viewport.safeAreaInsets.sub(sync));
  sub(() => viewport.contentSafeAreaInsets.sub(sync));
  // Высота и fullscreen тоже двигают снимок и класс `tg-fullscreen`.
  sub(() => viewport.isFullscreen.sub(sync));
  sub(() => viewport.height.sub(sync));
  sub(() => viewport.stableHeight.sub(sync));
  void requestSdkFullscreen().then(refreshAndLog);
}

/** После запроса fullscreen платформа шлёт событие не всегда — читаем состояние сами. */
function refreshAndLog(): void {
  refreshViewportSnapshot();
  logViewportDiagnostics();
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
  for (const event of [
    'safeAreaChanged',
    'contentSafeAreaChanged',
    'fullscreenChanged',
    'viewportChanged',
  ]) {
    try {
      tg.onEvent?.(event, sync);
    } catch {
      // ignore
    }
  }
  try {
    if (tg.isVersionAtLeast?.('8.0') && typeof tg.requestFullscreen === 'function') {
      tg.requestFullscreen();
      refreshAndLog();
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
  refreshViewportSnapshot();
}

/**
 * Снимок viewport: SDK → raw Telegram.WebApp → window. Никогда не бросает.
 * Используется отладочным оверлеем safe-area (docs, Phase 1).
 */
function readViewportSnapshot(): ViewportSnapshot {
  const winHeight =
    typeof window !== 'undefined'
      ? Math.max(window.innerHeight, window.visualViewport?.height ?? 0)
      : 0;
  // Классический объект — независимый источник по fullscreen: SDK-сигнал иногда
  // не успевает/не обновляется, а оверлей контента всё равно присутствует.
  const rawFullscreen = rawViewportWebApp()?.isFullscreen === true;
  try {
    const safe = viewport.safeAreaInsets();
    const content = viewport.contentSafeAreaInsets();
    return {
      isFullscreen: viewport.isFullscreen() || rawFullscreen,
      safeTop: safe.top ?? 0,
      safeBottom: safe.bottom ?? 0,
      contentTop: content.top ?? 0,
      contentBottom: content.bottom ?? 0,
      viewportHeight: viewport.height() || winHeight,
      viewportStableHeight: viewport.stableHeight() || winHeight,
    };
  } catch {
    // SDK не смонтирован — пробуем raw WebApp ниже
  }
  const tg = rawViewportWebApp();
  if (tg) {
    return {
      isFullscreen: tg.isFullscreen ?? false,
      safeTop: tg.safeAreaInset?.top ?? 0,
      safeBottom: tg.safeAreaInset?.bottom ?? 0,
      contentTop: tg.contentSafeAreaInset?.top ?? 0,
      contentBottom: tg.contentSafeAreaInset?.bottom ?? 0,
      viewportHeight: tg.viewportHeight ?? winHeight,
      viewportStableHeight: tg.viewportStableHeight ?? winHeight,
    };
  }
  return { ...EMPTY_SNAPSHOT, viewportHeight: winHeight, viewportStableHeight: winHeight };
}

function refreshViewportSnapshot(): void {
  viewportSnapshot = readViewportSnapshot();
  applyViewportState(viewportSnapshot);
  for (const listener of viewportSubscribers) {
    try {
      listener();
    } catch {
      // ignore
    }
  }
}

/**
 * Побочные эффекты состояния viewport на уровне документа (единый источник):
 * - класс `tg-fullscreen` на `<html>` для адаптации CSS;
 * - `--tg-viewport-stable-height` для высоты оболочки (устойчива к свайпам);
 * - `--tg-inset-*-fallback` — резерв против бага fullscreen с нулевым content-инсетом.
 * Никогда не бросает.
 */
function applyViewportState(snapshot: ViewportSnapshot): void {
  try {
    const root = document.documentElement;
    root.classList.toggle('tg-fullscreen', snapshot.isFullscreen);

    if (snapshot.viewportStableHeight > 0) {
      root.style.setProperty('--tg-viewport-stable-height', `${snapshot.viewportStableHeight}px`);
    } else {
      root.style.removeProperty('--tg-viewport-stable-height');
    }

    const topFallback = snapshot.isFullscreen ? FULLSCREEN_MIN_TOP : 0;
    if (topFallback > 0) {
      root.style.setProperty('--tg-inset-top-fallback', `${topFallback}px`);
    } else {
      root.style.removeProperty('--tg-inset-top-fallback');
    }
  } catch {
    // вне браузера — нечего применять
  }
}

/** Текущий снимок viewport для отладочного оверлея. */
export function getViewportSnapshot(): ViewportSnapshot {
  return viewportSnapshot;
}

/** Подписка на изменения viewport (для отладочного оверлея). Возвращает отписку. */
export function subscribeViewport(listener: () => void): () => void {
  viewportSubscribers.add(listener);
  bindViewportWindowListeners();
  refreshViewportSnapshot();
  return () => {
    viewportSubscribers.delete(listener);
  };
}

/** Разово вешаем слушатели окна: resize меняет высоту viewport вне сигналов SDK. */
function bindViewportWindowListeners(): void {
  if (windowListenersBound || typeof window === 'undefined') return;
  windowListenersBound = true;
  const onResize = () => refreshViewportSnapshot();
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
}

/** Текущее viewport-состояние: fullscreen + safe-area инсеты. SDK, иначе raw-фолбэк. */
function viewportDiagnostics(): Record<string, unknown> {
  try {
    return {
      isFullscreen: viewport.isFullscreen(),
      safeArea: viewport.safeAreaInsets(),
      contentSafeArea: viewport.contentSafeAreaInsets(),
      viewportHeight: viewport.height(),
      viewportStableHeight: viewport.stableHeight(),
    };
  } catch {
    const tg = rawViewportWebApp();
    if (!tg) return { available: false };
    return {
      isFullscreen: tg.isFullscreen ?? null,
      safeArea: tg.safeAreaInset ?? null,
      contentSafeArea: tg.contentSafeAreaInset ?? null,
      viewportHeight: tg.viewportHeight ?? null,
      viewportStableHeight: tg.viewportStableHeight ?? null,
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

/** startapp-параметр: 'seller' | 'shop_<public_id>' | 'prod_<public_id>_<product_id>' | ''. Вне TG — из ?startapp= в URL. */
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
