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
});
