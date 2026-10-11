// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { OrderStatus } from '../../domain/models/order';
import type { OrderDetails, OrderListItem } from '../read-models/order';
import type { OrderRealtimeHandlers } from '../ports/order-realtime';

/**
 * Интеграционный тест «сверки» (docs/22 ORD-14): один realtime-сигнал должен
 * привести список и открытую деталь ТОГО ЖЕ заказа к одинаковому новому статусу.
 * Репозиторий-мок отдаёт обновлённые данные (имитация авторитетного серверного
 * чтения после инвалидации), realtime-мок лишь доставляет сигнал.
 */

const h = vi.hoisted(() => {
  const state = {
    sessionToken: 'tok' as string | null,
    storeId: 'store-1' as string | null,
    serverUser: { id: 'buyer-1' } as { id: string } | null,
    /** «Серверное» состояние статуса — меняется до push-сигнала. */
    status: 'NEW' as OrderStatus,
  };
  const captured: { buyer?: OrderRealtimeHandlers; store?: OrderRealtimeHandlers } = {};
  return {
    state,
    captured,
    listOrders: vi.fn(),
    getOrderDetails: vi.fn(),
    buyerSub: vi.fn(),
    storeSub: vi.fn(),
    reset() {
      captured.buyer = undefined;
      captured.store = undefined;
      state.sessionToken = 'tok';
      state.storeId = 'store-1';
      state.serverUser = { id: 'buyer-1' };
      state.status = 'NEW';
      this.listOrders.mockReset();
      this.getOrderDetails.mockReset();
      this.buyerSub.mockReset();
      this.storeSub.mockReset();
      this.buyerSub.mockImplementation((_userId: string, handlers: OrderRealtimeHandlers) => {
        captured.buyer = handlers;
        return () => {};
      });
      this.storeSub.mockImplementation((_storeId: string, handlers: OrderRealtimeHandlers) => {
        captured.store = handlers;
        return () => {};
      });
    },
  };
});

vi.mock('../composition/container', () => ({
  deps: () => ({
    orderRepository: {
      listOrders: h.listOrders,
      getOrderDetails: h.getOrderDetails,
    },
    orderRealtime: {
      subscribeBuyerOrders: h.buyerSub,
      subscribeStoreOrders: h.storeSub,
    },
  }),
}));

vi.mock('../store', () => ({
  useStore: (selector: (s: typeof h.state) => unknown) => selector(h.state),
}));

import { useOrders } from './useOrders';
import { useOrderDetails } from './useOrderDetails';
import { useOrdersRealtime } from './useOrdersRealtime';

const ORDER_ID = 'o1';

function listItem(status: OrderStatus): OrderListItem {
  return {
    id: ORDER_ID,
    publicOrderNumber: 'SH-1',
    status,
    createdAt: '2026-10-10T10:00:00Z',
    totalMinor: 1000,
    currencyCode: 'USD',
    currencySymbol: '$',
    itemCount: 1,
    previewItems: [],
  };
}

function details(status: OrderStatus): OrderDetails {
  return {
    id: ORDER_ID,
    publicOrderNumber: 'SH-1',
    status,
    deliveryOutcome: null,
    refusalReasonCode: null,
    currencyCode: 'USD',
    currencySymbol: '$',
    subtotalMinor: 1000,
    totalMinor: 1000,
    createdAt: '2026-10-10T10:00:00Z',
    updatedAt: '2026-10-10T10:00:00Z',
    cancelledAt: null,
    completedAt: null,
    refusedAt: null,
    delivery: { fullName: 'A', phone: '1', address: 'x' },
    contact: { supportHandle: null, telegramUsername: null },
    items: [],
  };
}

function useOrdersScreen() {
  const list = useOrders({ scope: 'buyer' });
  const detail = useOrderDetails({ scope: 'buyer', orderId: ORDER_ID });
  useOrdersRealtime({ scope: 'buyer' });
  return { list, detail };
}

let client: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  h.reset();
  h.listOrders.mockImplementation(async () => ({
    orders: [listItem(h.state.status)],
    nextCursor: null,
  }));
  h.getOrderDetails.mockImplementation(async () => details(h.state.status));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('orders realtime integration — сверка list ⟷ detail (docs/22 ORD-14)', () => {
  it('push о смене статуса приводит список и открытую деталь к одному статусу', async () => {
    const { result } = renderHook(() => useOrdersScreen(), { wrapper });

    await waitFor(() => expect(result.current.list.orders).toHaveLength(1));
    await waitFor(() => expect(result.current.detail.order).not.toBeNull());
    expect(result.current.list.orders[0].status).toBe('NEW');
    expect(result.current.detail.order?.status).toBe('NEW');

    // «Сервер» меняет статус, затем триггер из БД публикует сигнал.
    h.state.status = 'IN_TRANSIT';
    act(() => {
      h.captured.buyer?.onChange({ orderId: ORDER_ID, status: 'IN_TRANSIT' });
    });

    await waitFor(() => expect(result.current.detail.order?.status).toBe('IN_TRANSIT'));
    await waitFor(() => expect(result.current.list.orders[0].status).toBe('IN_TRANSIT'));

    // Главное: список и деталь согласованы.
    expect(result.current.detail.order?.status).toBe(result.current.list.orders[0].status);
  });

  it('onResync после разрыва перечитывает список и все детали (не теряет пропущенное)', async () => {
    const { result } = renderHook(() => useOrdersScreen(), { wrapper });

    await waitFor(() => expect(result.current.detail.order?.status).toBe('NEW'));

    // Пока сокет был отключён, статус на сервере сменился (событие потеряно).
    h.state.status = 'DELIVERED';
    act(() => {
      h.captured.buyer?.onResync?.();
    });

    await waitFor(() => expect(result.current.list.orders[0].status).toBe('DELIVERED'));
    await waitFor(() => expect(result.current.detail.order?.status).toBe('DELIVERED'));
  });
});
