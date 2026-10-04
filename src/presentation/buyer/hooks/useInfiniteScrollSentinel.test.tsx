// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IOCallback;
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();

  constructor(callback: IOCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry]);
  }
}

import { useInfiniteScrollSentinel } from './useInfiniteScrollSentinel';

function Probe({ onLoadMore, enabled }: { onLoadMore: () => void; enabled: boolean }) {
  const ref = useInfiniteScrollSentinel({ onLoadMore, enabled });
  return <div ref={ref} data-testid="sentinel" />;
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useInfiniteScrollSentinel', () => {
  it('enabled: создаёт observer и наблюдает sentinel', () => {
    render(<Probe onLoadMore={vi.fn()} enabled />);

    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.instances[0]?.observe).toHaveBeenCalledTimes(1);
  });

  it('пересечение → onLoadMore; непересечение → нет', () => {
    const onLoadMore = vi.fn();
    render(<Probe onLoadMore={onLoadMore} enabled />);
    const observer = MockIntersectionObserver.instances[0];

    observer?.trigger(false);
    expect(onLoadMore).not.toHaveBeenCalled();

    observer?.trigger(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('enabled=false: observer не создаётся', () => {
    render(<Probe onLoadMore={vi.fn()} enabled={false} />);
    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });

  it('размонтирование → disconnect', () => {
    const { unmount } = render(<Probe onLoadMore={vi.fn()} enabled />);
    const observer = MockIntersectionObserver.instances[0];

    unmount();
    expect(observer?.disconnect).toHaveBeenCalledTimes(1);
  });

  it('IntersectionObserver недоступен — не падает', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    expect(() => render(<Probe onLoadMore={vi.fn()} enabled />)).not.toThrow();
  });
});
