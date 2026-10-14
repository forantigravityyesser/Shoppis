// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InventoryProductDetail } from '../../../application/hooks/useProduct';

const {
  navigate,
  createProduct,
  updateProduct,
  uploadCatalogImages,
  removeCatalogImages,
  detailState,
} = vi.hoisted(() => ({
  navigate: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  uploadCatalogImages: vi.fn(),
  removeCatalogImages: vi.fn(),
  detailState: { current: {} as Record<string, unknown> },
}));

vi.mock('react-router', () => ({
  useParams: () => ({ productId: 'p1' }),
  useNavigate: () => navigate,
}));

vi.mock('../../../application/hooks/useInventory', () => ({
  useInventoryHome: () => ({ categories: [] }),
}));

vi.mock('../../../application/hooks/useInventoryActions', () => ({
  useInventoryActions: () => ({ createProduct, updateProduct }),
}));

vi.mock('../../../application/hooks/useProduct', () => ({
  useProductDetail: () => ({
    product: detailState.current,
    loading: false,
    error: null,
    notFound: false,
  }),
}));

vi.mock('../../../application/services/image-service', () => ({
  uploadCatalogImages,
  removeCatalogImages,
}));

import EditProductView from './EditProductView';

const TITLE_PLACEHOLDER = 'Например, Морковь';

const DB_PHOTO = { url: 'https://cdn/db-full.jpg', thumbUrl: 'https://cdn/db-thumb.jpg' };
const FRESH_PHOTO = { url: 'https://cdn/up-1.jpg', thumbUrl: 'https://cdn/up-1-thumb.jpg' };

/** Имитирует выбор файла в скрытом input формы и ждёт появления нового слота фото. */
async function uploadPhoto(container: HTMLElement): Promise<void> {
  uploadCatalogImages.mockResolvedValue([FRESH_PHOTO]);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const before = screen.queryAllByRole('button', { name: 'Удалить фото' }).length;
  fireEvent.change(input, {
    target: { files: [new File(['x'], 'photo.jpg', { type: 'image/jpeg' })] },
  });
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Удалить фото' })).toHaveLength(before + 1),
  );
}

function makeDetail(images: InventoryProductDetail['images'] = []): InventoryProductDetail {
  return {
    id: 'p1',
    categoryId: null,
    categoryName: 'Без категории',
    title: 'Футболка',
    description: '',
    status: 'ACTIVE',
    images,
    emoji: '📦',
    originalAmountMinor: 190000,
    discountPercent: 0,
    priceMinor: 190000,
    currency: 'RUB',
    attributes: [],
    variants: [
      {
        id: 'v1',
        name: 'Размер',
        value: 'M',
        originalAmountMinor: 190000,
        priceMinor: 190000,
        discountPercent: 0,
        availableQuantity: 5,
        heldQuantity: 0,
        priceMode: 'USE_PRODUCT_PRICE',
        customOriginalAmountMinor: null,
        customDiscountPercent: null,
      },
    ],
    stockAvailable: 5,
    stockHeld: 0,
    stockState: 'in_stock',
    rating: 0,
    reviewsCount: 0,
    questionsCount: 0,
  };
}

beforeEach(() => {
  navigate.mockReset();
  createProduct.mockReset().mockResolvedValue('new-1');
  updateProduct.mockReset().mockResolvedValue(undefined);
  uploadCatalogImages.mockReset().mockResolvedValue([FRESH_PHOTO]);
  removeCatalogImages.mockReset().mockResolvedValue(undefined);
  detailState.current = makeDetail() as unknown as Record<string, unknown>;
});

describe('EditProductView — копирование существующего товара (docs/23 §3.2, §7.3)', () => {
  it('показывает данные товара и кнопку «Создать копию»', () => {
    render(<EditProductView />);
    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toHaveValue('Футболка');
    expect(screen.getByRole('button', { name: 'Создать копию' })).toBeInTheDocument();
  });

  it('копия не наследует ID: сохранение копии создаёт новый товар и убирает карточку из списка', async () => {
    render(<EditProductView />);
    await userEvent.click(screen.getByRole('button', { name: 'Создать копию' }));

    expect(screen.getByText('Исходная')).toBeInTheDocument();
    expect(screen.getByText('Копия 1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'На витрину' }));

    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    expect(updateProduct).not.toHaveBeenCalled();
    // карточка сохранена и исчезла из списка → остаётся только «Исходная»
    await waitFor(() => expect(screen.queryByText('Копия 1')).not.toBeInTheDocument());
    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toHaveValue('Футболка');
  });

  it('сохранение исходного товара обновляет его и завершает сессию', async () => {
    render(<EditProductView />);
    await userEvent.click(screen.getByRole('button', { name: 'На витрину' }));

    await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));
    expect(updateProduct.mock.calls[0][0]).toBe('p1');
    expect(createProduct).not.toHaveBeenCalled();
    // сессия опустела → уходим на карточку товара
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/seller/inventory/product/p1', { replace: true }),
    );
  });

  it('изменения копии не влияют на исходную карточку', async () => {
    render(<EditProductView />);
    await userEvent.click(screen.getByRole('button', { name: 'Создать копию' }));

    const input = screen.getByPlaceholderText(TITLE_PLACEHOLDER);
    await userEvent.clear(input);
    await userEvent.type(input, 'Копия');

    await userEvent.click(screen.getByRole('tab', { name: /Исходная/ }));
    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toHaveValue('Футболка');

    await userEvent.click(screen.getByRole('tab', { name: /Копия 1/ }));
    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toHaveValue('Копия');
  });
});

describe('EditProductView — независимое сохранение (docs/23 §12, PC-05)', () => {
  it('ошибка сохранения копии изолирована и видна в своей карточке', async () => {
    render(<EditProductView />);
    await userEvent.click(screen.getByRole('button', { name: 'Создать копию' }));
    createProduct.mockRejectedValueOnce(new Error('Сервер недоступен'));

    await userEvent.click(screen.getByRole('button', { name: 'На витрину' }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('tab', { name: /Копия 1/ })).getByText('Ошибка сохранения'),
      ).toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole('tab', { name: /Исходная/ })).getByText('Сохранена'),
    ).toBeInTheDocument();

    // ошибка хранится в карточке и при переключении туда-обратно
    await userEvent.click(screen.getByRole('tab', { name: /Исходная/ }));
    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toHaveValue('Футболка');
    await userEvent.click(screen.getByRole('tab', { name: /Копия 1/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Сервер недоступен');
  });

  it('после ошибки карточка остаётся; повторное успешное сохранение её убирает', async () => {
    render(<EditProductView />);
    await userEvent.click(screen.getByRole('button', { name: 'Создать копию' }));
    createProduct.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('new-2');

    await userEvent.click(screen.getByRole('button', { name: 'На витрину' }));
    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    // при ошибке карточка не исчезает
    expect(screen.getByText('Копия 1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'На витрину' }));
    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(2));
    expect(updateProduct).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Копия 1')).not.toBeInTheDocument());
  });

  it('во время сохранения карточка показывает «Сохранение…», затем исчезает', async () => {
    let resolveCreate!: (id: string) => void;
    createProduct.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(<EditProductView />);
    await userEvent.click(screen.getByRole('button', { name: 'Создать копию' }));
    await userEvent.click(screen.getByRole('button', { name: 'На витрину' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Публикация…' })).toBeDisabled(),
    );
    expect(
      within(screen.getByRole('tab', { name: /Копия 1/ })).getByText('Сохранение…'),
    ).toBeInTheDocument();

    resolveCreate('new-3');
    await waitFor(() => expect(screen.queryByText('Копия 1')).not.toBeInTheDocument());
  });
});

describe('EditProductView — очистка Storage для несохранённых фото (docs/23 §6)', () => {
  it('фото из БД не удаляется ни при снятии, ни при уходе без сохранения', async () => {
    detailState.current = makeDetail([DB_PHOTO]) as unknown as Record<string, unknown>;
    render(<EditProductView />);

    await userEvent.click(screen.getByRole('button', { name: 'Удалить фото' }));
    expect(removeCatalogImages).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }));
    expect(removeCatalogImages).not.toHaveBeenCalled();
  });

  it('снятие нового фото удаляет только его, фото из БД остаётся', async () => {
    detailState.current = makeDetail([DB_PHOTO]) as unknown as Record<string, unknown>;
    const { container } = render(<EditProductView />);
    await uploadPhoto(container);

    const removeButtons = screen.getAllByRole('button', { name: 'Удалить фото' });
    expect(removeButtons).toHaveLength(2);
    await userEvent.click(removeButtons[1]);

    expect(removeCatalogImages).toHaveBeenCalledWith([FRESH_PHOTO]);
  });

  it('уход без сохранения удаляет новое фото, не трогая фото из БД', async () => {
    detailState.current = makeDetail([DB_PHOTO]) as unknown as Record<string, unknown>;
    const { container } = render(<EditProductView />);
    await uploadPhoto(container);

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }));

    expect(removeCatalogImages).toHaveBeenCalledTimes(1);
    expect(removeCatalogImages).toHaveBeenCalledWith([FRESH_PHOTO]);
  });

  it('сохранение карточки оставляет новое фото в Storage', async () => {
    const { container } = render(<EditProductView />);
    await uploadPhoto(container);

    await userEvent.click(screen.getByRole('button', { name: 'На витрину' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));
    expect(removeCatalogImages).not.toHaveBeenCalled();
  });
});
