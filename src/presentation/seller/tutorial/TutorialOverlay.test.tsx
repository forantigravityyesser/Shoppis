// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  setStep: vi.fn(),
  complete: vi.fn(),
  dismiss: vi.fn(),
  consumePreview: vi.fn(),
  interrupted: true,
  step: 'orientation' as string | null,
  progress: { index: 1, total: 5 } as { index: number; total: number } | null,
  pathname: '/seller/dashboard',
  summary: null as { inventory: { buyerAvailableProducts: number } } | null,
}));

vi.mock('../../../application/hooks/useSellerTutorial', () => ({
  useSellerTutorial: () => ({
    interrupted: h.interrupted,
    step: h.step,
    progress: h.progress,
    setStep: h.setStep,
    complete: h.complete,
    dismiss: h.dismiss,
  }),
  consumeTutorialPreviewOpened: () => h.consumePreview(),
  markTutorialPreviewOpened: () => {},
}));
vi.mock('react-router', () => ({
  useLocation: () => ({ pathname: h.pathname }),
  useNavigate: () => h.navigate,
}));
vi.mock('../../../application/store', () => {
  const useStore = (selector: (s: { serverUser: null; storeId: string }) => unknown) =>
    selector({ serverUser: null, storeId: 's1' });
  useStore.getState = () => ({});
  return { useStore };
});
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: h.summary }) }));

import TutorialOverlay from './TutorialOverlay';

/** Подкладываем в DOM поле-цель (в реальном приложении его рендерит форма). */
function appendField(tour: string, value: string) {
  const label = document.createElement('label');
  label.setAttribute('data-tour', tour);
  const input = document.createElement('input');
  input.value = value;
  label.appendChild(input);
  document.body.appendChild(label);
}

afterEach(() => {
  document.body.querySelectorAll('label[data-tour]').forEach((n) => n.remove());
});

beforeEach(() => {
  h.navigate.mockReset();
  h.setStep.mockReset().mockResolvedValue(undefined);
  h.complete.mockReset().mockResolvedValue(undefined);
  h.dismiss.mockReset().mockResolvedValue(undefined);
  h.consumePreview.mockReset().mockReturnValue(false);
  h.interrupted = true;
  h.step = 'orientation';
  h.progress = { index: 1, total: 5 };
  h.pathname = '/seller/dashboard';
  h.summary = null;
});

describe('TutorialOverlay (docs/26 TUT-05/TUT-07)', () => {
  it('orientation: карточка с прогрессом и «Пропустить шаг», без primary', () => {
    render(<TutorialOverlay />);

    expect(screen.getByTestId('tutorial-overlay')).toBeInTheDocument();
    expect(screen.getByText('Инвентарь — ваш центр управления')).toBeInTheDocument();
    expect(screen.getByText('Шаг 1 из 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Пропустить шаг' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Далее' })).toBeNull();
  });

  it('orientation: вход в «Инвентарь» автоматически закрывает шаг 1', () => {
    h.pathname = '/seller/inventory';
    render(<TutorialOverlay />);
    expect(h.setStep).toHaveBeenCalledWith('product-create');
  });

  it('product-create в инвентаре: подсветка «+ Добавить», без primary', () => {
    h.step = 'product-create';
    h.pathname = '/seller/inventory';
    render(<TutorialOverlay />);

    expect(screen.getByText('Добавьте товар')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать товар' })).toBeNull();
  });

  it('product-create в инвентаре при существующем товаре: «Посмотреть существующий» → buyer view', async () => {
    h.step = 'product-create';
    h.pathname = '/seller/inventory';
    h.summary = { inventory: { buyerAvailableProducts: 1 } };
    render(<TutorialOverlay />);

    await userEvent.click(screen.getByRole('button', { name: 'Посмотреть существующий товар' }));
    expect(h.setStep).toHaveBeenCalledWith('product-buyer-view');
  });

  it('product-create в форме: первым шагом фото, дальше — название', async () => {
    h.step = 'product-create';
    h.pathname = '/seller/inventory/product/new';
    render(<TutorialOverlay />);

    expect(screen.getByText('Фотография товара')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Пропустить шаг' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
    expect(screen.getByText('Название товара')).toBeInTheDocument();
    // На обязательном поле кнопки «Пропустить шаг» нет.
    expect(screen.queryByRole('button', { name: 'Пропустить шаг' })).toBeNull();
  });

  it('«Пропустить шаг» на фото ведёт дальше', async () => {
    h.step = 'product-create';
    h.pathname = '/seller/inventory/product/new';
    render(<TutorialOverlay />);

    await userEvent.click(screen.getByRole('button', { name: 'Пропустить шаг' }));
    expect(screen.getByText('Название товара')).toBeInTheDocument();
  });

  it('«Далее» не пускает дальше при пустом обязательном поле', async () => {
    h.step = 'product-create';
    h.pathname = '/seller/inventory/product/new';
    appendField('product-title', '  ');
    render(<TutorialOverlay />);

    // фото → название (необязательный шаг пропускается «Далее»)
    await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
    expect(screen.getByText('Название товара')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Заполните это поле');
    expect(screen.getByText('Название товара')).toBeInTheDocument();
  });

  it('product-buyer-view: без «Далее» (шаг закрывается по возврату)', () => {
    h.step = 'product-buyer-view';
    h.pathname = '/seller/inventory/product/p1';
    render(<TutorialOverlay />);
    expect(screen.getByText('Посмотрите глазами покупателя')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Далее' })).toBeNull();
  });

  it('product-buyer-view: возврат из предпросмотра → storefront', () => {
    h.step = 'product-buyer-view';
    h.pathname = '/seller/inventory/product/p1';
    h.consumePreview.mockReturnValue(true);
    render(<TutorialOverlay />);
    expect(h.setStep).toHaveBeenCalledWith('storefront');
  });

  it('finish: «Готово» завершает обучение', async () => {
    h.step = 'finish';
    render(<TutorialOverlay />);
    await userEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(h.complete).toHaveBeenCalledTimes(1);
  });

  it('storefront на экране шаринга: клик «Копировать» → главная + финал', async () => {
    const copyBtn = document.createElement('button');
    copyBtn.setAttribute('data-tour', 'share-copy');
    document.body.appendChild(copyBtn);

    h.step = 'storefront';
    h.pathname = '/seller/settings/share';
    render(<TutorialOverlay />);

    await userEvent.click(copyBtn);
    expect(h.navigate).toHaveBeenCalledWith('/seller/dashboard');
    expect(h.setStep).toHaveBeenCalledWith('finish');

    copyBtn.remove();
  });

  it('закрытие (✕) завершает обучение', async () => {
    render(<TutorialOverlay />);
    await userEvent.click(screen.getByRole('button', { name: 'Завершить обучение' }));
    expect(h.dismiss).toHaveBeenCalledTimes(1);
  });

  it('пока подсвечен блок — ручной скролл контейнера заблокирован', () => {
    const scroller = document.createElement('div');
    scroller.className = 'scrollable-content';
    document.body.appendChild(scroller);

    h.step = 'product-create';
    h.pathname = '/seller/inventory/product/new';
    render(<TutorialOverlay />);

    const event = new WheelEvent('wheel', { cancelable: true, bubbles: true });
    scroller.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    scroller.remove();
  });

  it('карточка доступна: dialog назван заголовком и описан текстом шага', () => {
    render(<TutorialOverlay />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Инвентарь — ваш центр управления');
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    expect(dialog).toHaveAttribute('aria-describedby', 'tutorial-step-text');
  });

  it('Escape завершает обучение (клавиатурный выход)', async () => {
    render(<TutorialOverlay />);
    await userEvent.keyboard('{Escape}');
    expect(h.dismiss).toHaveBeenCalledTimes(1);
  });

  it('точки прогресса декоративны (скрыты от скринридера)', () => {
    render(<TutorialOverlay />);
    const dots = document.querySelector('.tutorial-overlay__dots');
    expect(dots).toHaveAttribute('aria-hidden');
  });

  it('не активно → оверлея нет', () => {
    h.interrupted = false;
    render(<TutorialOverlay />);
    expect(screen.queryByTestId('tutorial-overlay')).toBeNull();
  });

  it('finish → карточка-поздравление видна', () => {
    h.step = 'finish';
    render(<TutorialOverlay />);
    expect(screen.getByTestId('tutorial-overlay')).toBeInTheDocument();
    expect(screen.getByText('Поздравляем!')).toBeInTheDocument();
  });
});
