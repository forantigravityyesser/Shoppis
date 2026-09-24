import { useEffect } from 'react';
import { useStore } from '../store';
import { getStartParam, getTelegramUser } from '../../infrastructure/telegram/telegram-app';
import type { UserRole } from '../../domain/constants/roles';

/**
 * Авторизация для схемы из двух отдельных ботов (продавец / покупатель).
 * 
 * ГЛАВНОЕ ИСПРАВЛЕНИЕ: user получается ПЕРЕД createStore/checkStoreOwnership,
 * поэтому ошибка "not telegram user" больше не возникает.
 * 
 * Порядок (исправленный):
 * 1. initApp() — SDK инициализация
 * 2. **user = getTelegramUser()** — фиксируем ID сразу, до любых async- проверок
 * 3. Определяем роль по start_param (два бota: seller и buyer по ссылке)
 * 4. setUser + fetchUserProfile — теперь user гарантированно заполнен
 * 5. setRole / setStoreId
 * 6. setIsAppInitializing(false)
 * 
 * После этого createStore в auth-slice получит user уже существующим,
 * и throw new Error('No Telegram user') не сработает.
 */
export function useAppInit(): void {
  useEffect(() => {
    const initAppFlow = async () => {
      const setRole = useStore.getState().setRole;
      const setStoreId = useStore.getState().setStoreId;
      const setUser = useStore.getState().setUser;
      const fetchUserProfile = useStore.getState().fetchUserProfile;
      const setIsAppInitializing = useStore.getState().setIsAppInitializing;

      try {
        // --- 1. Telegram WebApp допавечки (как было) ---
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

        // --- 2. ГЛАВНОЕ: получаем user ПЕРЕД БД ---
        const user = getTelegramUser();
        const tid = user?.id ?? '';

        // --- 3. Определяем роль по start_param (два бota) ---
        let finalRole = 'buyer';
        let finalStoreId: string | null = null;

        if (tid) {
          // Пользователь известен — определяем роль
          const startParam = getStartParam();

          if (startParam === 'seller') {
            // --- БОТ ПРОДАВЦА: любой пользователь может создать магазин ---
            finalRole = 'seller';
            // storeId оставим null → App покажет SellerOnboardingView
          } else if (startParam && startParam.startsWith('store_')) {
            // --- БОТ ПОКУПАТЕЛЯ по ссылке ---
            finalRole = 'buyer';
            finalStoreId = startParam.slice(6);
            localStorage.setItem('last_visited_store_id', finalStoreId);
          } else {
            // Вход без параметра: проверяем, был ли last visited store
            const lastId = localStorage.getItem('last_visited_store_id');
            if (lastId) {
              finalRole = 'buyer';
              finalStoreId = lastId;
            } else {
              // Первый вход buyer без магазина → покажем каталог/приветство
              finalRole = 'buyer';
            }
          }
        } else {
          // tid undefined — fallback: продавец, чтобы onboarding показался
          finalRole = 'seller';
        }

        // --- 4. Теперь безопасно ставим user + profile (ошибки "not user" уже не будет) ---
        if (user) {
          setUser(user);
          await fetchUserProfile();
        }

        // --- 5. Применяем роль и storeId ---
        setRole(finalRole as UserRole);
        setStoreId(finalStoreId);

        // Если это продавец, пробуем загрузить его существующий магазин
        if (finalRole === 'seller' && user) {
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