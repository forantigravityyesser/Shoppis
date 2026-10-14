// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetNavigationDepth, setNavigationDepth } from '../../shared/can-go-back';

const {
  navigate,
  createProduct,
  updateProduct,
  uploadCatalogImages,
  removeCatalogImages,
} = vi.hoisted(() => ({
  navigate: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  uploadCatalogImages: vi.fn(),
  removeCatalogImages: vi.fn(),
}));

vi.mock('react-router', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('../../../application/hooks/useInventory', () => ({
  useInventoryHome: () => ({ categories: [] }),
}));

vi.mock('../../../application/hooks/useInventoryActions', () => ({
  useInventoryActions: () => ({ createProduct, updateProduct }),
}));

vi.mock('../../../application/services/image-service', () => ({
  uploadCatalogImages,
  removeCatalogImages,
}));

import CreateProductView from './CreateProductView';

const TITLE_PLACEHOLDER = 'Например, Морковь';

const FRESH_PHOTO = { url: 'https://cdn/up-1.jpg', thumbUrl: 'https://cdn/up-1-thumb.jpg' };

/** Имитирует выбор файла в скрытом input формы и ждёт появления слота фото. */
async function uploadPhoto(container: HTMLElement): Promise<void> {
  uploadCatalogImages.mockResolvedValue([FRESH_PHOTO]);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(['x'], 'photo.jpg', { type: 'image/jpeg' })] },
  });
  await screen.findByRole('button', { name: 'Удалить фото' });
}

beforeEach(() => {
  navigate.mockReset();
  createProduct.mockReset().mockResolvedValue('new-1');
  updateProduct.mockReset().mockResolvedValue(undefined);
  uploadCatalogImages.mockReset().mockResolvedValue([FRESH_PHOTO]);
  removeCatalogImages.mockReset().mockResolvedValue(undefined);
  // Экран открыт переходом из инвентаря — история есть (кнопка «назад» идёт шагом назад).
  resetNavigationDepth();
  setNavigationDepth(1);
});

describe('CreateProductView — копирование черновиков (docs/23 §3.1, §7)', () => {
  it('кнопка «Создать копию» появляется только после ввода данных', async () => {
    render(<CreateProductView />);
    expect(screen.queryByRole('button', { name: 'Создать копию' })).not.toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), 'Морковь');
    expect(screen.getByRole('button', { name: 'Создать копию' })).toBeInTheDocument();
  });

  it('создаёт независимую копию и переключается на неё', async () => {
    render(<CreateProductView />);
    await userEvent.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), 'Морковь');

    await userEvent.click(screen.getByRole('button', { name: 'Создать копию' }));

    expect(screen.getByText('Исходная')).toBeInTheDocument();
    expect(screen.getByText('Копия 1')).toBeInTheDocument();
    // активна копия — в поле скопированное название
    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toHaveValue('Морковь');
  });

  it('сохранение единственной карточки убирает её и открывает карточку товара', async () => {
    render(<CreateProductView />);
    await userEvent.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), 'Морковь');
    await userEvent.type(screen.getByPlaceholderText('42 / XL / 500 мл / 128 GB'), '1 кг');
    await userEvent.type(screen.getByPlaceholderText('0.00'), '100');

    await userEvent.click(screen.getByRole('button', { name: 'На витрину' }));

    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    // Открываем созданный товар (сверка) заменой записи формы — «назад» ведёт в инвентарь.
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/seller/inventory/product/new-1', { replace: true }),
    );
  });

  it('переключение не теряет данные карточек', async () => {
    render(<CreateProductView />);
    await userEvent.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), 'Морковь');
    await userEvent.click(screen.getByRole('button', { name: 'Создать копию' }));

    const input = screen.getByPlaceholderText(TITLE_PLACEHOLDER);
    await userEvent.clear(input);
    await userEvent.type(input, 'Копия');

    await userEvent.click(screen.getByRole('tab', { name: /Исходная/ }));
    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toHaveValue('Морковь');

    await userEvent.click(screen.getByRole('tab', { name: /Копия 1/ }));
    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toHaveValue('Копия');
  });

  it('ограничивает сессию 6 карточками (§9)', async () => {
    render(<CreateProductView />);
    await userEvent.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), 'Морковь');

    for (let i = 0; i < 5; i += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Создать копию' }));
    }

    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Создать копию' })).toBeDisabled();
    expect(screen.getByText(/Достигнут лимит: 6/)).toBeInTheDocument();
  });
});

describe('CreateProductView — exit-guard (docs/23 §7.6, PC-07)', () => {
  it('предупреждает браузер только при несохранённых изменениях', async () => {
    render(<CreateProductView />);

    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await userEvent.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), 'М');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it('перехватывает внутренний уход при несохранённых изменениях', async () => {
    render(<CreateProductView />);

    // без изменений — уходит сразу
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(navigate).toHaveBeenCalledWith(-1);

    navigate.mockClear();
    await userEvent.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), 'Морковь');
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Подтверждение действия' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Остаться' }));
    expect(navigate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }));
    expect(navigate).toHaveBeenCalledWith(-1);
  });
});

describe('CreateProductView — удаление черновика (docs/23 §7.6, §8.5)', () => {
  it('не показывает удаление для единственной карточки', async () => {
    render(<CreateProductView />);
    await userEvent.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), 'Морковь');
    expect(screen.queryByRole('button', { name: /Удалить черновик/ })).not.toBeInTheDocument();
  });

  it('удаляет ненужную копию с подтверждением', async () => {
    render(<CreateProductView />);
    await userEvent.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), 'Морковь');
    await userEvent.click(screen.getByRole('button', { name: 'Создать копию' }));
    expect(screen.getAllByRole('tab')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Удалить черновик 2' }));
    expect(screen.getByRole('group', { name: 'Подтверждение действия' })).toBeInTheDocument();
    // отмена не удаляет
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.getAllByRole('tab')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Удалить черновик 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    await waitFor(() => expect(screen.queryByText('Копия 1')).not.toBeInTheDocument());
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('пустую карточку удаляет без подтверждения', async () => {
    render(<CreateProductView />);
    await userEvent.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), 'Морковь');
    await userEvent.click(screen.getByRole('button', { name: 'Создать копию' }));

    // возвращаемся к исходной и очищаем — теперь она пустая
    await userEvent.click(screen.getByRole('tab', { name: /Исходная/ }));
    await userEvent.clear(screen.getByPlaceholderText(TITLE_PLACEHOLDER));

    await userEvent.click(screen.getByRole('button', { name: 'Удалить черновик 1' }));
    expect(screen.queryByRole('group', { name: 'Подтверждение действия' })).not.toBeInTheDocument();
    // осталась одна карточка → навигация скрыта
    await waitFor(() => expect(screen.queryAllByRole('tab')).toHaveLength(0));
  });
});

describe('CreateProductView — очистка Storage для несохранённых фото', () => {
  it('снятие фото до сохранения удаляет файл из Storage сразу', async () => {
    const { container } = render(<CreateProductView />);
    await uploadPhoto(container);

    await userEvent.click(screen.getByRole('button', { name: 'Удалить фото' }));

    expect(removeCatalogImages).toHaveBeenCalledWith([FRESH_PHOTO]);
  });

  it('сохранение карточки оставляет загруженные фото в Storage', async () => {
    const { container } = render(<CreateProductView />);
    await uploadPhoto(container);
    await userEvent.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), 'Морковь');
    await userEvent.type(screen.getByPlaceholderText('42 / XL / 500 мл / 128 GB'), '1 кг');
    await userEvent.type(screen.getByPlaceholderText('0.00'), '100');

    await userEvent.click(screen.getByRole('button', { name: 'На витрину' }));

    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    expect(removeCatalogImages).not.toHaveBeenCalled();
  });

  it('удаление черновика-копии очищает загруженные в него фото', async () => {
    const { container } = render(<CreateProductView />);
    await userEvent.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), 'Морковь');
    await userEvent.click(screen.getByRole('button', { name: 'Создать копию' }));
    await uploadPhoto(container);

    await userEvent.click(screen.getByRole('button', { name: 'Удалить черновик 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(removeCatalogImages).toHaveBeenCalledWith([FRESH_PHOTO]);
  });

  it('подтверждение выхода: «Остаться» сохраняет фото, «Выйти» очищает Storage', async () => {
    const { container } = render(<CreateProductView />);
    await uploadPhoto(container);

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    await userEvent.click(screen.getByRole('button', { name: 'Остаться' }));
    expect(removeCatalogImages).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }));

    expect(navigate).toHaveBeenCalledWith(-1);
    expect(removeCatalogImages).toHaveBeenCalledWith([FRESH_PHOTO]);
  });

  it('размонтирование формы без сохранения (системный уход) очищает Storage', async () => {
    const { container, unmount } = render(<CreateProductView />);
    await uploadPhoto(container);

    unmount();

    expect(removeCatalogImages).toHaveBeenCalledWith([FRESH_PHOTO]);
  });
});
