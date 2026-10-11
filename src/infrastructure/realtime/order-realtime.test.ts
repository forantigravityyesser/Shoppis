import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RealtimeHandler = (message?: unknown) => void;

const h = vi.hoisted(() => {
  const handlers = new Map<string, Set<RealtimeHandler>>();
  const subscribed = new Set<string>();
  const state = { isConnected: false, failConnect: false, subscribeOk: true };
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
      if (state.failConnect) throw new Error('connect failed');
      state.isConnected = true;
    },
    disconnect() {
      calls.disconnect += 1;
      state.isConnected = false;
    },
    async subscribe(channel: string) {
      calls.subscribe.push(channel);
      if (!state.subscribeOk) {
        return { ok: false, channel, error: { code: 'REJECTED', message: 'rejected' } };
      }
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
    emit(event: string, message?: unknown) {
      handlers.get(event)?.forEach((cb) => cb(message));
    },
    reset() {
      handlers.clear();
      subscribed.clear();
      state.isConnected = false;
      state.failConnect = false;
      state.subscribeOk = true;
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

afterEach(() => {
  vi.useRealTimers();
});

describe('order-realtime adapter (docs/22 ORD-14)', () => {
  it('buyer: подключается и подписывается на orders:buyer:<userId>', async () => {
    const mod = await load();
    mod.subscribeBuyerOrders('u1', { onChange: vi.fn() });

    await vi.waitFor(() => expect(h.calls.subscribe).toContain('orders:buyer:u1'));
    expect(h.calls.connect).toBe(1);
  });

  it('seller: подписывается на orders:seller:<storeId>', async () => {
    const mod = await load();
    mod.subscribeStoreOrders('s1', { onChange: vi.fn() });

    await vi.waitFor(() => expect(h.calls.subscribe).toContain('orders:seller:s1'));
  });

  it('маршрутизирует событие канала в onChange и нормализует payload', async () => {
    const mod = await load();
    const onChange = vi.fn();
    mod.subscribeBuyerOrders('u1', { onChange });
    await vi.waitFor(() => expect(h.calls.subscribe).toContain('orders:buyer:u1'));

    h.realtime.emit('order_status_changed', {
      orderId: 'o1',
      status: 'IN_TRANSIT',
      meta: { channel: 'orders:buyer:u1' },
    });

    expect(onChange).toHaveBeenCalledWith({ orderId: 'o1', status: 'IN_TRANSIT' });
  });

  it('игнорирует события чужого канала и битый payload', async () => {
    const mod = await load();
    const onChange = vi.fn();
    mod.subscribeBuyerOrders('u1', { onChange });
    await vi.waitFor(() => expect(h.calls.subscribe).toContain('orders:buyer:u1'));

    h.realtime.emit('order_status_changed', {
      orderId: 'o1',
      status: 'NEW',
      meta: { channel: 'orders:buyer:other' },
    });
    h.realtime.emit('order_status_changed', { meta: { channel: 'orders:buyer:u1' } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('рефкаунт канала и persistent-сокет: отписка последнего не закрывает соединение', async () => {
    const mod = await load();
    const a = vi.fn();
    const b = vi.fn();
    const offA = mod.subscribeBuyerOrders('u1', { onChange: a });
    const offB = mod.subscribeBuyerOrders('u1', { onChange: b });
    await vi.waitFor(() => expect(h.calls.subscribe).toContain('orders:buyer:u1'));
    expect(h.calls.subscribe.filter((c) => c === 'orders:buyer:u1')).toHaveLength(1);

    offA();
    expect(h.calls.unsubscribe).toHaveLength(0);

    offB();
    expect(h.calls.unsubscribe).toEqual(['orders:buyer:u1']);
    // Persistent: сокет остаётся открытым для следующих экранов.
    expect(h.calls.disconnect).toBe(0);
  });

  it('reconnect: переподписывает канал и вызывает onResync (сверка с сервером)', async () => {
    const mod = await load();
    const onResync = vi.fn();
    mod.subscribeBuyerOrders('u1', { onChange: vi.fn(), onResync });
    await vi.waitFor(() => expect(h.realtime.getSubscribedChannels()).toContain('orders:buyer:u1'));

    // Разрыв: SDK теряет подписки; затем socket.io переподключается.
    h.state.isConnected = true;
    h.subscribed.clear();
    h.realtime.emit('connect');

    await vi.waitFor(() => expect(onResync).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(h.realtime.getSubscribedChannels()).toContain('orders:buyer:u1'),
    );
  });

  it('первичный провал connect → повтор с backoff', async () => {
    vi.useFakeTimers();
    const mod = await load();
    h.state.failConnect = true;

    mod.subscribeBuyerOrders('u1', { onChange: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.calls.connect).toBe(1);
    expect(h.realtime.getSubscribedChannels()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1000);
    expect(h.calls.connect).toBe(2);

    h.state.failConnect = false;
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.realtime.getSubscribedChannels()).toContain('orders:buyer:u1');
  });

  it('отказ subscribe ({ ok:false }) → повтор с backoff', async () => {
    vi.useFakeTimers();
    const mod = await load();
    h.state.subscribeOk = false;

    mod.subscribeBuyerOrders('u1', { onChange: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.calls.subscribe).toEqual(['orders:buyer:u1']);

    await vi.advanceTimersByTimeAsync(1000);
    expect(h.calls.subscribe.length).toBe(2);

    h.state.subscribeOk = true;
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.realtime.getSubscribedChannels()).toContain('orders:buyer:u1');
  });
});
