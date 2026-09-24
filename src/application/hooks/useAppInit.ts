import { useEffect } from 'react';
import { useStore } from '../store';
import { getStartParam } from '../../infrastructure/telegram/telegram-app';
import { authenticate } from '../services/auth-service';
import type { AppContext } from '../../domain/constants/app-context';

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
          const tg = (window as unknown as { Telegram?: { WebApp?: any } }).Telegram?.WebApp;
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
        let finalStoreId: string | null = null;

        if (authenticated) {
          const startParam = getStartParam();

          if (startParam === 'seller') {
            // --- БОТ ПРОДАВЦА: любой пользователь может создать магазин ---
            finalContext = 'seller';
            // storeId оставим null → App покажет SellerOnboardingView
          } else if (startParam && startParam.startsWith('store_')) {
            // --- БОТ ПОКУПАТЕЛЯ по ссылке ---
            finalContext = 'buyer';
            finalStoreId = startParam.slice(6);
            localStorage.setItem('last_visited_store_id', finalStoreId);
          } else {
            // Вход без параметра: проверяем, был ли last visited store
            const lastId = localStorage.getItem('last_visited_store_id');
            if (lastId) {
              finalContext = 'buyer';
              finalStoreId = lastId;
            }
          }
        } else {
          // Нет серверной identity — показываем онбординг продавца.
          finalContext = 'seller';
        }

        // --- 4. Применяем контекст и storeId ---
        useStore.getState().setContext(finalContext);
        useStore.getState().setStoreId(finalStoreId);

        // Если контекст продавца — пробуем загрузить его существующий магазин
        if (finalContext === 'seller' && authenticated) {
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
