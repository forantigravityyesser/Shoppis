// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const {
  useStorefrontHome,
  useStorefrontCatalog,
  useStorefrontCatalogPriceBounds,
  navigate,
  setSearchParams,
  searchParamsRef,
  state,
} = vi.hoisted(() => ({
  useStorefrontHome: vi.fn(),
  useStorefrontCatalog: vi.fn(),
  useStorefrontCatalogPriceBounds: vi.fn(),
  navigate: vi.fn(),
  setSearchParams: vi.fn(),
  searchParamsRef: { value: new URLSearchParams('') },
  state: {
    viewedStore: { publicId: 'pub1', supportHandle: '', logoUrl: null } as {
      publicId: string;
      supportHandle: string;
      logoUrl: string | null;
    } | null,
    serverUser: null as { photoUrl: string | null; firstName: string } | null,
    authLoading: false,
    storeId: undefined as string | undefined,
    favoritesByStore: {} as Record<string, string[]>,
    toggleFavorite: () => {},
  },
}));

vi.mock('react-router', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [searchParamsRef.value, setSearchParams],
}));
vi.mock('../../../application/store', () => ({
  useStore: (selector: (s: typeof state) => unknown) => selector(state),
}));
vi.mock('../../../application/hooks/useStorefrontHome', () => ({ useStorefrontHome }));
vi.mock('../../../application/hooks/useStorefrontCatalog', () => ({ useStorefrontCatalog }));
vi.mock('../../../application/hooks/useStorefrontCatalogPriceBounds', () => ({
  useStorefrontCatalogPriceBounds,
}));
vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({ selectTick: vi.fn() }),
}));

import CatalogView from './CatalogView';
import type {
  StorefrontHome,
  StorefrontProductCard,
} from '../../../application/read-models/storefront';
import type { StorefrontHomeState } from '../../../application/hooks/useStorefrontHome';
import type {
  StorefrontCatalogFilters,
  StorefrontCatalogState,
} from '../../../application/hooks/useStorefrontCatalog';

const HOME: StorefrontHome = {
  store: {
    id: 's1',
    publicId: 'pub1',
    name: 'Nike Shop',
    bannerUrl: null,
    status: 'ACTIVE',
    currencyCode: 'USD',
    currencySymbol: '$',
  },
  categories: [
    { id: 'c1', name: 'Обувь', imageUrl: null, sortOrder: 0 },
    { id: 'c2', name: 'Одежда', imageUrl: null, sortOrder: 1 },
  ],
};

const PRODUCTS: StorefrontProductCard[] = [
  { id: 'p1', title: 'Nike Air', categoryId: 'c1', imageUrl: null, price: 100000, available: true },
  {
    id: 'p2',
    title: 'Polo Shirt',
    categoryId: 'c2',
    imageUrl: null,
    price: 250000,
    available: true,
  },
];

function contextState(overrides: Partial<StorefrontHomeState> = {}): StorefrontHomeState {
  return {
    home: HOME,
    loading: false,
    error: null,
    notFound: false,
    refresh: vi.fn(),
    ...overrides,
  };
}

function catalogState(overrides: Partial<StorefrontCatalogState> = {}): StorefrontCatalogState {
  return {
    products: PRODUCTS,
    nextCursor: null,
    hasNextPage: false,
    loading: false,
    fetchingNextPage: false,
    updating: false,
    initialError: null,
    nextPageError: null,
    loadMore: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  };
}

function lastParams(): URLSearchParams {
  const calls = setSearchParams.mock.calls;
  return calls[calls.length - 1][0] as URLSearchParams;
}

function lastFilters(): StorefrontCatalogFilters {
  const calls = useStorefrontCatalog.mock.calls;
  return calls[calls.length - 1][1] as StorefrontCatalogFilters;
}

function lastCatalogEnabled(): boolean {
  const calls = useStorefrontCatalog.mock.calls;
  return calls[calls.length - 1][3] as boolean;
}

function lastBoundsEnabled(): boolean {
  const calls = useStorefrontCatalogPriceBounds.mock.calls;
  return calls[calls.length - 1][1] as boolean;
}

beforeEach(() => {
  useStorefrontHome.mockReset();
  useStorefrontCatalog.mockReset();
  useStorefrontCatalogPriceBounds.mockReset();
  navigate.mockReset();
  setSearchParams.mockReset();
  searchParamsRef.value = new URLSearchParams('');
  state.viewedStore = { publicId: 'pub1', supportHandle: '', logoUrl: null };
  state.serverUser = null;
  useStorefrontHome.mockReturnValue(contextState());
  useStorefrontCatalog.mockReturnValue(catalogState());
  useStorefrontCatalogPriceBounds.mockReturnValue({
    bounds: { minPrice: 8000, maxPrice: 320000 },
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
});

describe('CatalogView', () => {
  it('loading контекста → skeleton', () => {
    useStorefrontHome.mockReturnValue(contextState({ home: null, loading: true }));
    const { container } = render(<CatalogView />);
    expect(container.querySelector('.skel--card')).toBeTruthy();
    expect(screen.queryByLabelText('Поиск по названию')).toBeNull();
  });

  it('loading товарного потока → skeleton', () => {
    useStorefrontCatalog.mockReturnValue(catalogState({ loading: true }));
    const { container } = render(<CatalogView />);
    expect(container.querySelector('.skel--card')).toBeTruthy();
  });

  it('шапка: назад / название / все категории / профиль', () => {
    render(<CatalogView />);
    expect(screen.getByRole('heading', { name: 'Каталог' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Назад' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Все категории' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Профиль' })).toBeInTheDocument();
  });

  it('рендерит карточки категорий и товары сервера', () => {
    render(<CatalogView />);
    expect(screen.getByText('Nike Air')).toBeInTheDocument();
    expect(screen.getByText('Polo Shirt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Обувь' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Одежда' })).toBeInTheDocument();
  });

  it('URL category → фильтр в useStorefrontCatalog и активная категория', () => {
    searchParamsRef.value = new URLSearchParams('category=c1');
    render(<CatalogView />);

    expect(lastFilters().categoryId).toBe('c1');
    expect(screen.getByRole('button', { name: 'Обувь' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('клик по карточке категории пишет category в URL', async () => {
    render(<CatalogView />);
    await userEvent.click(screen.getByRole('button', { name: 'Одежда' }));

    expect(lastParams().get('category')).toBe('c2');
  });

  it('клик по товару → переход в /product/:id', async () => {
    render(<CatalogView />);
    await userEvent.click(screen.getByRole('button', { name: 'Nike Air' }));

    expect(navigate).toHaveBeenCalledWith('/product/p1');
  });

  it('«Все категории» открывает sheet, выбор категории пишет category и закрывает', async () => {
    const { queryByText } = render(<CatalogView />);
    expect(queryByText('Все категории')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Все категории' }));
    expect(screen.getByText('Все категории')).toBeInTheDocument();

    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Обувь' }));
    expect(lastParams().get('category')).toBe('c1');
  });

  it('URL q → фильтр search и значение в поле поиска', () => {
    searchParamsRef.value = new URLSearchParams('q=nike');
    render(<CatalogView />);

    expect(lastFilters().search).toBe('nike');
    expect(screen.getByLabelText('Поиск по названию')).toHaveValue('nike');
  });

  it('ввод в поиск пишет q в URL с debounce (не на каждый символ)', async () => {
    render(<CatalogView />);
    await userEvent.type(screen.getByLabelText('Поиск по названию'), 'p');

    expect(setSearchParams).not.toHaveBeenCalled();
    await waitFor(() => expect(lastParams().get('q')).toBe('p'));
  });

  it('очистка убирает q мгновенно', async () => {
    searchParamsRef.value = new URLSearchParams('q=nike');
    render(<CatalogView />);
    await userEvent.click(screen.getByRole('button', { name: 'Очистить' }));

    expect(lastParams().get('q')).toBeNull();
  });

  it('URL minPrice/maxPrice → числовые фильтры; битый → null', () => {
    searchParamsRef.value = new URLSearchParams('minPrice=5000&maxPrice=20000');
    render(<CatalogView />);
    expect(lastFilters().minPrice).toBe(5000);
    expect(lastFilters().maxPrice).toBe(20000);

    searchParamsRef.value = new URLSearchParams('minPrice=oops');
    render(<CatalogView />);
    expect(lastFilters().minPrice).toBeNull();
  });

  it('кнопка фильтров открывает sheet; применение пишет min/max (или убирает)', async () => {
    render(<CatalogView />);
    await userEvent.click(screen.getByRole('button', { name: 'Фильтры' }));
    expect(screen.getByText('Фильтры')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Показать товары' }));
    expect(lastParams().get('minPrice')).toBeNull();
    expect(lastParams().get('maxPrice')).toBeNull();
  });

  it('применённый ценовой фильтр → кнопка фильтров активна', () => {
    searchParamsRef.value = new URLSearchParams('minPrice=5000&maxPrice=100000');
    render(<CatalogView />);
    expect(screen.getByRole('button', { name: 'Фильтры' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('чипы фильтров: снятие категории не трогает цену', async () => {
    searchParamsRef.value = new URLSearchParams('category=c1&minPrice=5000&maxPrice=100000');
    render(<CatalogView />);

    await userEvent.click(screen.getByRole('button', { name: 'Убрать фильтр «Обувь»' }));
    expect(lastParams().get('category')).toBeNull();
    expect(lastParams().get('minPrice')).toBe('5000');
    expect(lastParams().get('maxPrice')).toBe('100000');
  });

  it('чипы фильтров: снятие цены не трогает категорию', async () => {
    searchParamsRef.value = new URLSearchParams('category=c1&minPrice=5000&maxPrice=100000');
    render(<CatalogView />);

    await userEvent.click(screen.getByRole('button', { name: 'Убрать фильтр цены 50 $ – 1000 $' }));
    expect(lastParams().get('minPrice')).toBeNull();
    expect(lastParams().get('maxPrice')).toBeNull();
    expect(lastParams().get('category')).toBe('c1');
  });

  it('PAUSED → экран паузы без каталога и поиска', () => {
    useStorefrontHome.mockReturnValue(
      contextState({ home: { ...HOME, store: { ...HOME.store, status: 'PAUSED' } } }),
    );
    render(<CatalogView />);
    expect(screen.getByText('Магазин временно закрыт')).toBeInTheDocument();
    expect(screen.getByText('Nike Shop')).toBeInTheDocument();
    expect(screen.queryByLabelText('Поиск по названию')).toBeNull();
    expect(screen.queryByText('Nike Air')).toBeNull();
  });

  it('пусто без поиска → «Товаров пока нет»', () => {
    useStorefrontCatalog.mockReturnValue(catalogState({ products: [] }));
    render(<CatalogView />);
    expect(screen.getByText('Товаров пока нет')).toBeInTheDocument();
  });

  it('пусто по поисковому запросу → сообщение с запросом', () => {
    searchParamsRef.value = new URLSearchParams('q=nike');
    useStorefrontCatalog.mockReturnValue(catalogState({ products: [] }));
    render(<CatalogView />);
    expect(screen.getByText('Ничего не нашлось')).toBeInTheDocument();
    expect(screen.getByText(/По запросу «nike»/)).toBeInTheDocument();
  });

  it('пусто по фильтру цены → «Нет товаров в этом диапазоне»', () => {
    searchParamsRef.value = new URLSearchParams('minPrice=5000&maxPrice=100000');
    useStorefrontCatalog.mockReturnValue(catalogState({ products: [] }));
    render(<CatalogView />);
    expect(screen.getByText('Нет товаров в этом диапазоне')).toBeInTheDocument();
  });

  it('пусто в категории → «В этой категории пока нет товаров»', () => {
    searchParamsRef.value = new URLSearchParams('category=c1');
    useStorefrontCatalog.mockReturnValue(catalogState({ products: [] }));
    render(<CatalogView />);
    expect(screen.getByText('В этой категории пока нет товаров')).toBeInTheDocument();
  });

  it('infinite: sentinel при наличии следующей страницы', () => {
    useStorefrontCatalog.mockReturnValue(catalogState({ hasNextPage: true, nextCursor: 'c1' }));
    render(<CatalogView />);
    expect(screen.getByTestId('catalog-stream-sentinel')).toBeInTheDocument();
  });

  it('infinite: индикатор догрузки при fetchingNextPage', () => {
    useStorefrontCatalog.mockReturnValue(
      catalogState({ hasNextPage: true, fetchingNextPage: true }),
    );
    render(<CatalogView />);
    expect(screen.getByTestId('catalog-stream-loading')).toBeInTheDocument();
  });

  it('infinite: ошибка догрузки сохраняет товары и даёт «Повторить»', async () => {
    const loadMore = vi.fn();
    useStorefrontCatalog.mockReturnValue(
      catalogState({ hasNextPage: true, nextPageError: 'boom', loadMore }),
    );
    render(<CatalogView />);
    expect(screen.getByTestId('catalog-stream-error')).toBeInTheDocument();
    expect(screen.getByText('Nike Air')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(loadMore).toHaveBeenCalled();
  });

  it('ошибка первой загрузки → заголовок и «Повторить» перезапрашивает', async () => {
    const refresh = vi.fn();
    useStorefrontCatalog.mockReturnValue(
      catalogState({ products: [], initialError: 'boom', refresh }),
    );
    render(<CatalogView />);
    expect(screen.getByText('Не удалось загрузить каталог')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('профиль → переход в аккаунт', async () => {
    render(<CatalogView />);
    await userEvent.click(screen.getByRole('button', { name: 'Профиль' }));
    expect(navigate).toHaveBeenCalledWith('/account');
  });

  it('внешнее изменение URL q синхронизирует поле и фильтр', () => {
    searchParamsRef.value = new URLSearchParams('q=nike');
    const { rerender } = render(<CatalogView />);
    expect(screen.getByLabelText('Поиск по названию')).toHaveValue('nike');

    searchParamsRef.value = new URLSearchParams('q=adidas');
    rerender(<CatalogView />);

    expect(screen.getByLabelText('Поиск по названию')).toHaveValue('adidas');
    expect(lastFilters().search).toBe('adidas');
  });

  it('ACTIVE → catalog и bounds enabled; PAUSED → disabled', () => {
    render(<CatalogView />);
    expect(lastCatalogEnabled()).toBe(true);
    expect(lastBoundsEnabled()).toBe(true);

    useStorefrontHome.mockReturnValue(
      contextState({ home: { ...HOME, store: { ...HOME.store, status: 'PAUSED' } } }),
    );
    render(<CatalogView />);
    expect(lastCatalogEnabled()).toBe(false);
    expect(lastBoundsEnabled()).toBe(false);
  });

  it('обновление набора (stale) → индикатор и aria-busy, товары остаются', () => {
    useStorefrontCatalog.mockReturnValue(catalogState({ updating: true }));
    const { container } = render(<CatalogView />);

    expect(screen.getByTestId('catalog-updating')).toBeInTheDocument();
    expect(container.querySelector('.catalog-results')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Nike Air')).toBeInTheDocument();
  });

  it('ошибка bounds → отдельное сообщение и «Повторить»', async () => {
    const refresh = vi.fn();
    useStorefrontCatalogPriceBounds.mockReturnValue({
      bounds: null,
      loading: false,
      error: 'boom',
      refresh,
    });
    render(<CatalogView />);

    await userEvent.click(screen.getByRole('button', { name: 'Фильтры' }));
    expect(screen.getByText('Не удалось загрузить фильтр цены')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('bounds ещё грузятся → «Загрузка фильтра…», не «нет цен»', async () => {
    useStorefrontCatalogPriceBounds.mockReturnValue({
      bounds: null,
      loading: true,
      error: null,
      refresh: vi.fn(),
    });
    render(<CatalogView />);

    await userEvent.click(screen.getByRole('button', { name: 'Фильтры' }));
    expect(screen.getByText('Загрузка фильтра…')).toBeInTheDocument();
    expect(screen.queryByText('Пока нет доступных цен для фильтра.')).toBeNull();
  });
});
