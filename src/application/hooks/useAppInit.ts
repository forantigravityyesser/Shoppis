import { useEffect } from 'react';
import { useStore } from '../store';
import { deps } from '../composition/container';
import { authenticate } from '../services/auth-service';
import { parseStorefrontStartParam } from '../../domain/rules/storefront-link';
import type { AppContext } from '../../domain/constants/app-context';

/** Минимальная поверхность Telegram WebApp, используемая при инициализации. */
interface TelegramWebApp {
  safeAreaInset?: { bottom?: number };
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
  useEffect(() => {
    const initAppFlow = async () => {
      try {
        // --- 1. Telegram WebApp допавечки ---
        try {
          const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram
            ?.WebApp;
          if (tg) {
            const bottomInset = tg.safeAreaInset?.bottom || 0;
            document.documentElement.style.setProperty('--tg-safe-area-bottom', `${bottomInset}px`);
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
        try {
          const session = await authenticate();
          useStore.getState().setSession(session.token, session.user);
          authenticated = true;
        } catch (e) {
          console.warn('[appInit] authentication failed:', e);
          useStore.getState().clearSession();
        }

        // --- 3. Контекст входа по start_param (два бота) ---
        let finalContext: AppContext = 'buyer';
        let buyerPublicId: string | null = null;

        if (authenticated) {
          const startParam = deps().telegram.getStartParam();

          if (startParam === 'seller') {
            // --- БОТ ПРОДАВЦА: любой пользователь может создать магазин ---
            finalContext = 'seller';
            // storeId оставим null → App покажет SellerOnboardingView
          } else {
            // --- БОТ ПОКУПАТЕЛЯ: deep link на витрину `shop_<public_id>` ---
            const fromLink = parseStorefrontStartParam(startParam);
            if (fromLink) {
              finalContext = 'buyer';
              buyerPublicId = fromLink;
              localStorage.setItem('last_visited_store_public_id', fromLink);
            } else {
              // Вход без параметра: последняя посещённая витрина
              buyerPublicId = localStorage.getItem('last_visited_store_public_id');
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
  }, []);
}
