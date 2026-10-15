// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardChecklistBlock from './DashboardChecklistBlock';
import { computeShopReadiness } from '../../../../domain/rules/readiness-rules';
import type { StoreReadinessInput } from '../../../../domain/models/tutorial';

function readiness(overrides: Partial<StoreReadinessInput> = {}) {
  return computeShopReadiness({
    storeName: 'Shop',
    bannerUrl: '',
    description: '',
    supportHandle: '',
    buyerAvailableProducts: 0,
    activeCategories: 0,
    ...overrides,
  });
}

const READY = readiness({
  bannerUrl: 'banner.jpg',
  buyerAvailableProducts: 1,
  activeCategories: 1,
  supportHandle: 'john',
});

describe('DashboardChecklistBlock (docs/26 §4.5, TUT-03)', () => {
  it('свёрнут: заголовок + счётчик «N из 5», сегментов ровно 5', () => {
    render(<DashboardChecklistBlock readiness={readiness()} />);
    const block = screen.getByTestId('dashboard-checklist');
    const head = within(block).getByRole('button');

    expect(head).toHaveTextContent('Подготовка магазина');
    expect(head).toHaveTextContent('Выполнено 1 из 5');
    expect(block.querySelectorAll('.dash-checklist__step')).toHaveLength(5);
    // Название гарантировано → один заполненный сегмент.
    expect(block.querySelectorAll('.dash-checklist__step--done')).toHaveLength(1);
    expect(within(block).queryAllByTestId('dashboard-checklist-item')).toHaveLength(0);
  });

  it('число заполненных сегментов совпадает со счётчиком', async () => {
    render(
      <DashboardChecklistBlock
        readiness={readiness({ bannerUrl: 'b.jpg', activeCategories: 1 })}
      />,
    );
    const block = screen.getByTestId('dashboard-checklist');
    expect(within(block).getByRole('button')).toHaveTextContent('Выполнено 3 из 5');
    expect(block.querySelectorAll('.dash-checklist__step--done')).toHaveLength(3);

    await userEvent.click(within(block).getByRole('button'));
    expect(screen.getAllByTestId('dashboard-checklist-item')).toHaveLength(5);
  });

  it('раскрытие показывает пять пунктов; название — выполнено', async () => {
    render(<DashboardChecklistBlock readiness={readiness()} />);
    await userEvent.click(screen.getByRole('button'));

    const items = screen.getAllByTestId('dashboard-checklist-item');
    expect(items).toHaveLength(5);
    expect(screen.getByLabelText('Название магазина: Готово')).toBeInTheDocument();
  });

  it('незаполненные пункты показывают подсказки', async () => {
    render(<DashboardChecklistBlock readiness={readiness()} />);
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Добавьте баннер или описание')).toBeInTheDocument();
    expect(screen.getByText('Опубликуйте товар с остатком')).toBeInTheDocument();
    expect(screen.getByText('Создайте хотя бы одну категорию')).toBeInTheDocument();
    expect(screen.getByText('Укажите контакт для связи')).toBeInTheDocument();
  });

  it('готовый магазин: заголовок «Магазин подготовлен» и 5/5 заполненных сегментов', () => {
    render(<DashboardChecklistBlock readiness={READY} />);
    const block = screen.getByTestId('dashboard-checklist');
    expect(within(block).getByRole('button')).toHaveTextContent('Магазин подготовлен');
    expect(within(block).getByRole('button')).toHaveTextContent('Выполнено 5 из 5');
    expect(block.querySelectorAll('.dash-checklist__step--done')).toHaveLength(5);
  });

  it('aria-expanded переключается по клику', async () => {
    render(<DashboardChecklistBlock readiness={readiness()} />);
    const head = screen.getByRole('button');
    expect(head).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'true');
  });
});
