// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardCard from './DashboardCard';

describe('DashboardCard', () => {
  it('рендерит заголовок и подзаголовок', () => {
    render(<DashboardCard title="Заказы" subtitle="Сводка" />);
    const card = screen.getByTestId('dashboard-card');
    expect(card).toHaveTextContent('Заказы');
    expect(card).toHaveTextContent('Сводка');
  });

  it('без onClick — не кнопка (секция без шеврона)', () => {
    render(<DashboardCard title="Требует внимания">Текст</DashboardCard>);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('dashboard-card').tagName).toBe('SECTION');
  });

  it('с onClick — кнопка, вызывает обработчик', async () => {
    const onClick = vi.fn();
    render(<DashboardCard title="Продажи" onClick={onClick} />);
    const button = screen.getByRole('button', { name: /Продажи/ });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('рендерит дочерний контент', () => {
    render(
      <DashboardCard title="Продажи">
        <span>Получено: 100</span>
      </DashboardCard>,
    );
    expect(screen.getByText('Получено: 100')).toBeInTheDocument();
  });

  it('onTitleClick делает кликабельным только заголовок (карточка остаётся секцией)', async () => {
    const onTitleClick = vi.fn();
    render(
      <DashboardCard title="Заказы" onTitleClick={onTitleClick}>
        <span>тело</span>
      </DashboardCard>,
    );
    expect(screen.getByTestId('dashboard-card').tagName).toBe('SECTION');
    await userEvent.click(screen.getByRole('button', { name: 'Заказы' }));
    expect(onTitleClick).toHaveBeenCalledTimes(1);
  });
});
