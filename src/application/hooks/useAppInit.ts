import { useEffect } from 'react';
import { useStore } from '../store';
import { getRawInitData, getStartParam, getTelegramUser } from '../../infrastructure/telegram/telegram-app';
import { authenticateTelegram } from '../../infrastructure/functions/auth-api';
import type { AppContext } from '../../domain/constants/app-context';

/**
 * Инициализация входа: Telegram WebApp, получение User, определение контекста
 * (панель продавца / витрина) по start_param, загрузка магазина продавца.
 *
 * Контекст — это не роль пользователя: один User может владеть магазином и
 * покупать в других витринах. 01 §5
 */
export function useAppInit(): void {
  useEffect(() => {
    const initAppFlow = async () => {
      const setContext = useStore.getState().setContext;
      const setStoreId = useStore.getState().setStoreId;
      const setUser = useStore.getState().setUser;
      const setSession = useStore.getState().setSession;
      const fetchUserProfile = useStore.getState().fetchUserProfile;
      const setIsAppInitializing = useStore.getState().setIsAppInitializing;

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

        // --- 2. Получаем user ПЕРЕД БД ---
        const user = getTelegramUser();
        const tid = user?.id ?? '';

        // --- 3. Контекст входа по start_param (два бота) ---
        let finalContext: AppContext = 'buyer';
        let finalStoreId: string | null = null;

        if (tid) {
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
          // tid undefined — fallback: продавец, чтобы onboarding показался
          finalContext = 'seller';
        }

        // --- 4. Теперь безопасно ставим user + profile ---
        if (user) {
          setUser(user);
          await fetchUserProfile();
        }

        // --- 4.5 Серверная валидация Telegram identity (initData → сессия) ---
        const rawInitData = getRawInitData();
        if (rawInitData) {
          try {
            const session = await authenticateTelegram(rawInitData);
            setSession(session.token, session.user);
          } catch (e) {
            console.warn('[appInit] telegram-auth failed:', e);
          }
        }

        // --- 5. Применяем контекст и storeId ---
        setContext(finalContext);
        setStoreId(finalStoreId);

        // Если контекст продавца — пробуем загрузить его существующий магазин
        if (finalContext === 'seller' && user) {
          const loadSellerStore = useStore.getState().loadSellerStore;
          await loadSellerStore();
        }
      } catch (e) {
        console.warn('[appInit] failed, fallback to seller onboarding:', e);
      } finally {
        setIsAppInitializing(false);
      }
    };

    void initAppFlow();
  }, []);
}
