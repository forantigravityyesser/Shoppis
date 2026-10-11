// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import OrderStatusTabs from './OrderStatusTabs';

describe('OrderStatusTabs', () => {
  it('рендерит пять табов, активный помечен aria-selected', () => {
    render(<OrderStatusTabs value="NEW" onChange={() => {}} />);
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: 'Новые' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Все' })).toHaveAttribute('aria-selected', 'false');
  });

  it('клик по табу вызывает onChange с доменным фильтром', () => {
    const onChange = vi.fn();
    render(<OrderStatusTabs value="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'История' }));
    expect(onChange).toHaveBeenCalledWith('history');
  });

  it('пользовательский набор табов конфигурируется', () => {
    render(
      <OrderStatusTabs
        value="all"
        onChange={() => {}}
        tabs={[
          { value: 'all', label: 'Всё' },
          { value: 'history', label: 'Архив' },
        ]}
      />,
    );
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Архив' })).toBeInTheDocument();
  });

  it('клавиатура: ArrowRight / End / Home переключают таб (docs/24 D9)', () => {
    const onChange = vi.fn();
    render(<OrderStatusTabs value="all" onChange={onChange} />);
    const tablist = screen.getByRole('tablist');

    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('NEW');

    fireEvent.keyDown(tablist, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('history');

    fireEvent.keyDown(tablist, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('all');

    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('history');
  });

  it('roving tabindex: в tab-порядке только активный таб', () => {
    render(<OrderStatusTabs value="DELIVERED" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Доставлено' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Все' })).toHaveAttribute('tabindex', '-1');
  });

  it('aria-controls указывает на панель контента, если задан panelId', () => {
    render(<OrderStatusTabs value="all" onChange={() => {}} panelId="orders-panel" />);
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-controls', 'orders-panel');
  });
});
