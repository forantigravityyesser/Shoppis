import { useQuery } from '@tanstack/react-query';
import { deps } from '../composition/container';
import type { StorefrontHome } from '../read-models/storefront';

export interface StorefrontHomeState {
  /** Данные витрины; null — ещё не загружены или магазин не найден. */
  home: StorefrontHome | null;
  loading: boolean;
  error: string | null;
  /** Запрос успешен, но магазина с таким public_id нет. */
  notFound: boolean;
  refresh: () => void;
}

/**
 * Статичный контекст витрины по `public_id` (`storefront_home_context_read`):
 * store + активные категории. Товарный поток — отдельно (`useStorefrontHomeProducts`).
 * Кэш/ретраи — на `QueryClient`. Без `publicId` запрос отключён, чтобы не ходить
 * в сеть до резолва магазина (`useAppInit`).
 */
export function useStorefrontHome(publicId: string | null): StorefrontHomeState {
  const enabled = Boolean(publicId);
  const query = useQuery({
    queryKey: ['storefront-home', publicId],
    queryFn: () => deps().storefrontRepository.loadStorefrontHome(publicId as string),
    enabled,
  });

  return {
    home: query.data ?? null,
    loading: enabled && query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    notFound: query.isSuccess && query.data === null,
    refresh: () => {
      void query.refetch();
    },
  };
}
