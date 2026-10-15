import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '../store';
import { deps } from '../composition/container';
import { authenticate } from '../services/auth-service';
import {
  parseLegacyStoreStartParam,
  parseProductStartParam,
  parseStorefrontStartParam,
} from '../../domain/rules/storefront-link';
import type { AppContext } from '../../domain/constants/app-context';
import type { EntryBot } from '../contracts/auth';

/** Минимальная поверхность Telegram WebApp, используемая при инициализации. */
interface TelegramWebApp {
  expand?: () => void;
  ready?: () => void;
  enableClosingConfirmation?: () => void;
  disableVerticalSwipes?: () => void;
}

/**
 * Инициализация входа. Порядок — источник истины задаёт серверная сессия:
 *   Telegram environment → raw initData → server authentication → session/user
 *   → context (панель продавца / витрина) → загрузка магазина продавца.
 *
 * Пользователь Telegram-профиля до серверной проверки не используется.
 * Контекст — не роль пользователя: один User может владеть магазином и
 * покупать в других витринах. 01 §5
 */
export function useAppInit(): void {
  const navigate = useNavigate();
  /**
   * `useNavigate()` возвращает новую функцию при каждой смене pathname (её
   * useCallback зависит от location). Без этого флага эффект ниже перезапускался
   * бы на каждом переходе и повторно вызывал `loadSellerStore()`/`loadBuyerStore()`,
   * которые сбрасывают каталог и категории — товары «мигали» и пропадали после
   * навигации. Инициализация входа обязана выполниться ровно один раз.
   */
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const initAppFlow = async () => {
      try {
        // --- 1. Telegram WebApp допавечки ---
        // Safe-area/fullscreen инсеты прокидывает telegram-app.ts (реактивно).
        try {
          const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram
            ?.WebApp;
          if (tg) {
            if (typeof tg.expand === 'function') tg.expand();
            if (typeof tg.ready === 'function') tg.ready();
            if (typeof tg.enableClosingConfirmation === 'function') tg.enableClosingConfirmation();
            if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
          }
        } catch {
          // вне Telegram — пропускаем
        }

        // --- 2. Серверная аутентификация: initData → session/user ---
        let authenticated = false;
        let sessionToken: string | null = null;
        // Источник входа (подпись initData совпала с токеном бота): нужен для
        // открытий без startapp — главный Mini App / кнопка «Open App».
        let entryBot: EntryBot = null;
        try {
          const session = await authenticate();
          useStore.getState().setSession(session.token, session.user, session.accessToken);
          sessionToken = session.token;
          entryBot = session.bot;
          authenticated = true;
        } catch (e) {
          console.warn('[appInit] authentication failed:', e);
          useStore.getState().clearSession();
        }

        // --- 3. Контекст входа по start_param (два бота) ---
        let finalContext: AppContext = 'buyer';
        let buyerPublicId: string | null = null;
        // Товарный deep-link (`prod_<public_id>_<product_id>`) — после загрузки
        // витрины переходим на карточку товара.
        let buyerProductId: string | null = null;

        if (authenticated) {
          const startParam = deps().telegram.getStartParam();

          if (startParam === 'seller') {
            // --- БОТ ПРОДАВЦА: любой пользователь может создать магазин ---
            finalContext = 'seller';
            // storeId оставим null → App покажет SellerOnboardingView
          } else {
            // --- БОТ ПОКУПАТЕЛЯ: deep link на витрину `shop_<public_id>`
            // или на товар `prod_<public_id>_<product_id>`.
            // Legacy `store_<id>` поддержан только для чтения старых ссылок.
            const productLink = parseProductStartParam(startParam);
            const fromLink =
              productLink?.publicId ??
              parseStorefrontStartParam(startParam) ??
              parseLegacyStoreStartParam(startParam);
            if (fromLink) {
              finalContext = 'buyer';
              buyerPublicId = fromLink;
              buyerProductId = productLink?.productId ?? null;
              localStorage.setItem('last_visited_store_public_id', fromLink);
            } else if (entryBot === 'seller') {
              // Главный Mini App бота продавца открыт без startapp: это панель,
              // а не пустая витрина. Источник входа даёт подписанный initData.
              finalContext = 'seller';
            } else {
              // Вход без параметра: последняя посещённая витрина. localStorage
              // может не делиться между точками входа — тогда спрашиваем сервер.
              buyerPublicId = localStorage.getItem('last_visited_store_public_id');
              if (!buyerPublicId && sessionToken) {
                try {
                  const visited = await deps().storeVisitApi.loadVisitedStores(sessionToken);
                  buyerPublicId = visited[0]?.publicId ?? null;
                  if (buyerPublicId) {
                    localStorage.setItem('last_visited_store_public_id', buyerPublicId);
                  }
                } catch (e) {
                  console.warn('[appInit] visited stores load failed:', e);
                }
              }
            }

            // Открытие витрины фиксируем на сервере: список магазинов покупателя
            // и счётчик посетителей у продавца (store-visit). Fire-and-forget —
            // сбой записи визита не должен блокировать приложение.
            if (buyerPublicId && sessionToken) {
              void deps()
                .storeVisitApi.recordStoreVisit(sessionToken, buyerPublicId)
                .catch((e) => console.warn('[appInit] store visit failed:', e));
            }
          }
        } else {
          // Нет серверной identity — показываем онбординг продавца.
          finalContext = 'seller';
        }

        // --- 4. Применяем контекст и загружаем магазин ---
        useStore.getState().setContext(finalContext);

        if (finalContext === 'buyer') {
          await useStore.getState().loadBuyerStore(buyerPublicId);
          // Товар из deep-link: витрина загружена. Кладём главную магазина в
          // историю и открываем товар поверх — кнопка «назад» из карточки вернёт
          // на витрину магазина, из которого пришла ссылка.
          if (buyerProductId) {
            navigate('/', { replace: true });
            navigate(`/product/${buyerProductId}`);
          }
        } else if (authenticated) {
          // Контекст продавца — пробуем загрузить его существующий магазин
          await useStore.getState().loadSellerStore();
        }
      } catch (e) {
        console.warn('[appInit] failed, fallback to seller onboarding:', e);
      } finally {
        useStore.getState().setIsAppInitializing(false);
      }
    };

    void initAppFlow();
  }, [navigate]);
}
