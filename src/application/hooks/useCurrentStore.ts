import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../store';
import type { Store } from '../../domain/models/store';

export interface CurrentStoreState {
  /** Текущий магазин продавца или `null`, пока он не загружен/недоступен. */
  store: Store | null;
  /** Идёт запрос (глобальный `authLoading` при отсутствии магазина). */
  loading: boolean;
  /** Ошибка запроса (сеть/сервер). `null` при успехе или «магазин не найден». */
  error: string | null;
  /** Запрос завершился, но магазина нет. Не то же самое, что ошибка чтения. */
  notFound: boolean;
  /** Повторная загрузка после ошибки. */
  retry: () => void;
}

/**
 * Единое поведение загрузки магазина продавца для settings-экранов (R4).
 *
 * В отличие от прямого `void fetchCurrentStore()`, различает «запрос не удался»
 * (`error` + `retry`) и «магазина нет» (`notFound`): временный сбой сети больше
 * не выглядит как удалённый магазин.
 */
export function useCurrentStore(): CurrentStoreState {
  const currentStore = useStore((s) => s.currentStore);
  const authLoading = useStore((s) => s.authLoading);
  const fetchCurrentStore = useStore((s) => s.fetchCurrentStore);

  const [error, setError] = useState<string | null>(null);

  // Ошибку пишем асинхронно (в `.catch`), чтобы эффект не делал setState синхронно.
  // `Promise.resolve().then(...)` нормализует и sync-throw, и не-promise результат.
  const load = useCallback(
    () =>
      Promise.resolve()
        .then(() => fetchCurrentStore())
        .catch((e) => setError((e as Error).message)),
    [fetchCurrentStore],
  );

  const retry = useCallback(() => {
    setError(null);
    void load();
  }, [load]);

  // Загружаем один раз при отсутствии магазина. После ошибки `currentStore`
  // остаётся null, но deps не меняются — автоповтор не запускается; повтор — `retry`.
  useEffect(() => {
    if (!currentStore) void load();
  }, [currentStore, load]);

  return {
    store: currentStore,
    loading: !currentStore && authLoading && !error,
    error: currentStore ? null : error,
    notFound: !currentStore && !authLoading && !error,
    retry,
  };
}
