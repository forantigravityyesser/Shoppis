import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useInventoryHome } from '../../../application/hooks/useInventory';
import { createProductPath } from '../../../application/hooks/useInventoryActions';
import { buildCategoryRows } from '../inventory/layout';
import InventoryHeader from '../inventory/components/InventoryHeader';
import CategoryGrid from '../inventory/components/CategoryGrid';
import InventorySearchState from '../inventory/components/InventorySearchState';
import InventorySkeleton from '../inventory/components/InventorySkeleton';
import AddInventorySheet from '../inventory/components/AddInventorySheet';
import '../inventory/inventory.css';

/**
 * Inventory Home — визуальная карта каталога: категории → превью товаров.
 * Данные: useInventoryHome (Zustand + InsForge).
 */
export default function InventoryView() {
  const navigate = useNavigate();
  const { categories, productsByCategory, allProducts, loading, error } = useInventoryHome();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const rows = useMemo(() => buildCategoryRows(categories), [categories]);

  const search = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { categories: [] as typeof categories, products: [] as typeof allProducts };
    return {
      categories: categories.filter((c) => c.name.toLowerCase().includes(q)),
      products: allProducts.filter((p) => p.title.toLowerCase().includes(q)),
    };
  }, [query, categories, allProducts]);

  const categoryNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const category of categories) map[category.id] = category.name;
    return map;
  }, [categories]);

  const openCategory = (id: string) => navigate(`/seller/inventory/category/${id}`);
  const openProduct = (id: string) => navigate(`/seller/inventory/product/${id}`);
  /** «+» в категории ведёт сразу в создание товара в контексте категории (без выбора). */
  const addProduct = (categoryId: string) => navigate(createProductPath(categoryId));
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };

  return (
    <div className="screen inv">
      <InventoryHeader
        searchOpen={searchOpen}
        query={query}
        onOpenSearch={() => setSearchOpen(true)}
        onCloseSearch={closeSearch}
        onQueryChange={setQuery}
      />

      {error ? (
        <div className="inv-state">
          <p className="inv-state__title">Не удалось загрузить каталог</p>
          <p className="inv-state__subtitle">Проверьте соединение и попробуйте снова.</p>
          <button type="button" className="inv-add-btn" onClick={() => window.location.reload()}>
            Повторить
          </button>
        </div>
      ) : loading ? (
        <InventorySkeleton />
      ) : searchOpen ? (
        <InventorySearchState
          query={query}
          categories={search.categories}
          products={search.products}
          categoryNameById={categoryNameById}
          onOpenCategory={openCategory}
          onOpenProduct={openProduct}
        />
      ) : (
        <section className="inv-section">
          <div className="inv-section__head">
            <h2 className="inv-section__title">Категории</h2>
            <button
              type="button"
              className="inv-add-btn inv-add-btn--header"
              onClick={() => setAddOpen(true)}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Добавить</span>
            </button>
          </div>
          <CategoryGrid
            rows={rows}
            productsByCategory={productsByCategory}
            onOpenCategory={openCategory}
            onOpenProduct={openProduct}
            onAddProduct={addProduct}
          />
        </section>
      )}

      <AddInventorySheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreateProduct={() => {
          setAddOpen(false);
          navigate('/seller/inventory/product/new');
        }}
        onCreateCategory={() => {
          setAddOpen(false);
          navigate('/seller/inventory/category/new');
        }}
      />
    </div>
  );
}
