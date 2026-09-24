import { useEffect } from 'react';
import { useStore } from '../store';
import { getOrCreateCustomer } from '../../infrastructure/repositories/customer-repository';

/**
 * Порт useCustomerSync: при наличии storeId сохраняет/обновляет покупателя
 * (upsert по store_id+telegram_id) и подтягивает defaultRecipient.
 */
export function useCustomerSync(): void {
  const storeId = useStore((s) => s.storeId);
  const role = useStore((s) => s.role);

  useEffect(() => {
    const syncCustomer = async () => {
      const { user } = useStore.getState();
      const tid = user?.id;
      if (!storeId || !tid) return;
      try {
        const data = await getOrCreateCustomer(
          storeId,
          tid,
          user?.username ?? '',
          user?.firstName ?? '',
        );
        if (data?.name) {
          useStore.getState().setDefaultRecipient({ name: data.name, phone: data.phone || '', address: data.email || '' });
        }
      } catch (e) {
        console.error('[customerSync] failed:', e);
      }
    };
    void syncCustomer();
  }, [storeId, role]);
}
