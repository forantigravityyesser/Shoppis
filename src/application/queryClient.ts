import { QueryClient } from '@tanstack/react-query';

/** Порт queryClient из старого проекта: серверный кэш отдельно от zustand. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 минут
      retry: 1,
      refetchOnWindowFocus: false, // важно для Telegram WebApp
    },
  },
});
