import type { OrderStatus } from '../models/order';

export const ORDER_STATUS_META: Record<OrderStatus, { labelRu: string }> = {
  pending: { labelRu: 'Подготовка' },
  shipped: { labelRu: 'В пути' },
  delivered: { labelRu: 'Доставлено' },
  cancelled: { labelRu: 'Отмена' },
};
