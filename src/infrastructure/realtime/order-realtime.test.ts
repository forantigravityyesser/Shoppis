import { beforeEach, describe, expect, it, vi } from 'vitest';

type RealtimeHandler = (message: unknown) => void;

const h = vi.hoisted(() => {
  const handlers = new Map<string, Set<RealtimeHandler>>();
  const subscribed = new Set<string>();
  const state = { isConnected: false };
  const calls = {
    connect: 0,
    disconnect: 0,
    subscribe: [] as string[],
    unsubscribe: [] as string[],
  };
  const realtime = {
    on(event: string, cb: RealtimeHandler) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(cb);
    },
    off(event: string, cb: RealtimeHandler) {
      handlers.get(event)?.delete(cb);
    },
    async connect() {
      calls.connect += 1;
      state.isConnected = true;
    },
    disconnect() {
      calls.disconnect += 1;
      state.isConnected = false;
    },
    async subscribe(channel: string) {
      calls.subscribe.push(channel);
      subscribed.add(channel);
      return { ok: true, channel, presence: { members: [] } };
    },
    unsubscribe(channel: string) {
      calls.unsubscribe.push(channel);
      subscribed.delete(channel);
    },
    get isConnected() {
      return state.isConnected;
    },
    getSubscribedChannels() {
      return [...subscribed];
    },
    emit(event: string, message: unknown) {
      handlers.get(event)?.forEach((cb) => cb(message));
    },
    reset() {
      handlers.clear();
      subscribed.clear();
      state.isConnected = false;
      calls.connect = 0;
      calls.disconnect = 0;
      calls.subscribe = [];
      calls.unsubscribe = [];
    },
  };
  return { realtime, state, calls, handlers, subscribed };
});

vi.mock('../insforge/client', () => ({ insforge: { realtime: h.realtime } }));

async function load() {
  vi.resetModules();
  return import('./order-realtime');
}

beforeEach(() => {
  h.realtime.reset();
});

describe('order-realtime adapter (docs/22 ORD-14)', () => {
  it('buyer: подключается и подписывается на orders:buyer:<userId>', async () => {
    const mod = await load();
    const listener = vi.fn();

    mod.subscribeBuyerOrders('u1', listener);
    await vi.waitFor(() => expect(h.calls.subscribe).toContain('orders:buyer:u1'));
    expect(h.calls.connect).toBe(1);
  });

  it('seller: подписывается на orders:seller:<storeId>', async () => {
    const mod = await load();
    mod.subscribeStoreOrders('s1', vi.fn());

    await vi.waitFor(() => expect(h.calls.subscribe).toContain('orders:seller:s1'));
  });

  it('маршрутизирует событие канала в слушателя и нормализует payload', async () => {
    const mod = await load();
    const listener = vi.fn();
    mod.subscribeBuyerOrders('u1', listener);
    await vi.waitFor(() => expect(h.calls.subscribe).toContain('orders:buyer:u1'));

    h.realtime.emit('order_status_changed', {
      orderId: 'o1',
      status: 'IN_TRANSIT',
      meta: { channel: 'orders:buyer:u1' },
    });

    expect(listener).toHaveBeenCalledWith({ orderId: 'o1', status: 'IN_TRANSIT' });
  });

  it('игнорирует события чужого канала и битый payload', async () => {
    const mod = await load();
    const listener = vi.fn();
    mod.subscribeBuyerOrders('u1', listener);
    await vi.waitFor(() => expect(h.calls.subscribe).toContain('orders:buyer:u1'));

    h.realtime.emit('order_status_changed', {
      orderId: 'o1',
      status: 'NEW',
      meta: { channel: 'orders:buyer:other' },
    });
    h.realtime.emit('order_status_changed', { meta: { channel: 'orders:buyer:u1' } });

    expect(listener).not.toHaveBeenCalled();
  });

  it('рефкаунт канала: одна подписка на нескольких слушателей, отписка/disconnect в конце', async () => {
    const mod = await load();
    const a = vi.fn();
    const b = vi.fn();
    const offA = mod.subscribeBuyerOrders('u1', a);
    const offB = mod.subscribeBuyerOrders('u1', b);
    await vi.waitFor(() => expect(h.calls.subscribe).toContain('orders:buyer:u1'));
    expect(h.calls.subscribe.filter((c) => c === 'orders:buyer:u1')).toHaveLength(1);

    offA();
    expect(h.calls.unsubscribe).toHaveLength(0);

    offB();
    expect(h.calls.unsubscribe).toEqual(['orders:buyer:u1']);
    expect(h.calls.disconnect).toBe(1);
  });
});
