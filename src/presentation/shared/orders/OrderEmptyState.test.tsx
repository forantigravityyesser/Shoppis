// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderEmptyState from './OrderEmptyState';

describe('OrderEmptyState', () => {
  it('показывает текст пустого состояния', () => {
    render(<OrderEmptyState text="Заказов пока нет" />);
    expect(screen.getByTestId('order-empty')).toHaveTextContent('Заказов пока нет');
  });

  it('рендерит слот действия', () => {
    render(<OrderEmptyState text="Пусто" action={<button type="button">Повторить</button>} />);
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});
