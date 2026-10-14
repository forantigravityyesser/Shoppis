// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardSkeleton from './DashboardSkeleton';

describe('DashboardSkeleton', () => {
  it('объявляет live-статус и рендерит 4 карточки-заглушки (aria-hidden)', () => {
    const { container } = render(<DashboardSkeleton />);
    const root = screen.getByRole('status', { name: 'Загрузка сводки' });
    expect(root).toBeInTheDocument();
    const cards = container.querySelectorAll('.dash-skeleton__card');
    expect(cards).toHaveLength(4);
    cards.forEach((card) => expect(card).toHaveAttribute('aria-hidden', 'true'));
  });

  it('содержит текст для screen reader', () => {
    render(<DashboardSkeleton />);
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
  });
});
