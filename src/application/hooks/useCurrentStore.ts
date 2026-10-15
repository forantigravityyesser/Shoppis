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
 *
 * R2: локальный `pending` отмечает незавершённую первичную загрузку. Иначе первый
 * рендер (до старта эффекта) давал `authLoading === false` и показывал «магазин не
 * найден» раньше, чем начинался запрос. `notFound` теперь возможен только после
 * завершения запроса.
 */
export function useCurrentStore(): CurrentStoreState {
  const currentStore = useStore((s) => s.currentStore);
  const authLoading = useStore((s) => s.authLoading);
  const fetchCurrentStore = useStore((s) => s.fetchCurrentStore);

  const [error, setError] = useState<string | null>(null);
  // Пока `currentStore` нет — считаем первичную загрузку незавершённой.
  const [pending, setPending] = useState(!currentStore);

  // Ошибку пишем асинхронно (в `.catch`), чтобы эффект не делал setState синхронно.
  // `Promise.resolve().then(...)` нормализует и sync-throw, и не-promise результат.
  // `pending` снимаем в `.finally` — явное завершение запроса (успех/ошибка/пусто).
  // Первичный `pending` уже true из состояния, поэтому `load` его не поднимает
  // синхронно (эффект не должен делать setState в теле).
  const load = useCallback(
    () =>
      Promise.resolve()
        .then(() => fetchCurrentStore())
        .catch((e) => setError((e as Error).message))
        .finally(() => setPending(false)),
    [fetchCurrentStore],
  );

  const retry = useCallback(() => {
    setError(null);
    setPending(true);
    void load();
  }, [load]);

  // Загружаем один раз при отсутствии магазина. После ошибки `currentStore`
  // остаётся null, но deps не меняются — автоповтор не запускается; повтор — `retry`.
  useEffect(() => {
    if (!currentStore) void load();
  }, [currentStore, load]);

  // `loading` показываем, пока нет магазина, нет ошибки и запрос не завершён.
  const loading = !currentStore && !error && (authLoading || pending);

  return {
    store: currentStore,
    loading,
    error: currentStore ? null : error,
    notFound: !currentStore && !loading && !error,
    retry,
  };
}
