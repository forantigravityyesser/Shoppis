import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useInventoryHome, UNCATEGORIZED_ID } from '../../../application/hooks/useInventory';
import {
  createProductPath,
  useInventoryActions,
} from '../../../application/hooks/useInventoryActions';
import { useCategoryReorder } from '../../../application/hooks/useCategoryReorder';
import { resolveProductCategoryId } from '../../../domain/rules/category-rules';
import InventoryHeader from '../inventory/components/InventoryHeader';
import InventoryModeSwitcher, {
  type InventoryMode,
} from '../inventory/components/InventoryModeSwitcher';
import InventoryProductsSection from '../inventory/components/products/InventoryProductsSection';
import CategoryGrid from '../inventory/components/CategoryGrid';
import CategoryAddSheet from '../inventory/components/CategoryAddSheet';
import InventorySkeleton from '../inventory/components/InventorySkeleton';
import ReorderCategorySheet from '../inventory/components/ReorderCategorySheet';
import '../inventory/inventory.css';

/**
 * Inventory Home — рабочая зона каталога продавца.
 * Две секции: «Товары» (по умолчанию) и «Категории» (визуал не менялся).
 * docs/19 §5–§7, §27 (Phase D).
 */
export default function InventoryView() {
  const navigate = useNavigate();
  const { categories, productsByCategory, allProducts, loading, error } = useInventoryHome();
  const reorder = useCategoryReorder();
  const { assignProductsToCategory } = useInventoryActions();
  const [mode, setMode] = useState<InventoryMode>('products');
  const [reorderId, setReorderId] = useState<string | null>(null);
  const [categoryAddId, setCategoryAddId] = useState<string | null>(null);

  // Позиции для витрины: 1-based среди пользовательских (несистемных) категорий.
  const reorderable = useMemo(
    () => categories.filter((c) => c.id !== UNCATEGORIZED_ID),
    [categories],
  );
  const positionsByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    reorderable.forEach((category, index) => {
      map[category.id] = index + 1;
    });
    return map;
  }, [reorderable]);
  const reorderTarget = reorderId
    ? (reorderable.find((c) => c.id === reorderId) ?? null)
    : null;

  const categoryNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const category of categories) map[category.id] = category.name;
    return map;
  }, [categories]);

  const userCategoryIds = useMemo(
    () => categories.filter((c) => c.id !== UNCATEGORIZED_ID).map((c) => c.id),
    [categories],
  );
  const categoryAddTarget = categoryAddId
    ? (categories.find((c) => c.id === categoryAddId) ?? null)
    : null;
  const existingProductIds = useMemo(() => {
    if (!categoryAddTarget) return [];
    return allProducts
      .filter(
        (product) =>
          resolveProductCategoryId(product.categoryId, userCategoryIds) === categoryAddTarget.id,
      )
      .map((product) => product.id);
  }, [categoryAddTarget, allProducts, userCategoryIds]);

  const openCategory = (id: string) => navigate(`/seller/inventory/category/${id}`);
  const openProduct = (id: string) => navigate(`/seller/inventory/product/${id}`);
  /** «+» в категории открывает выбор: новый товар или товары из магазина. */
  const openCategoryAdd = (categoryId: string) => setCategoryAddId(categoryId);

  return (
    <div className="screen inv">
      <InventoryHeader />

      <InventoryModeSwitcher mode={mode} onChange={setMode} />

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
      ) : mode === 'products' ? (
        <InventoryProductsSection
          products={allProducts}
          onOpenProduct={openProduct}
          onAddProduct={() => navigate('/seller/inventory/product/new')}
        />
      ) : (
        <section className="inv-section">
          <div className="inv-section__head">
            <h2 className="inv-section__title">Категории</h2>
            <button
              type="button"
              className="inv-add-btn inv-add-btn--header"
              onClick={() => navigate('/seller/inventory/category/new')}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Добавить</span>
            </button>
          </div>
          <CategoryGrid
            categories={categories}
            productsByCategory={productsByCategory}
            onOpenCategory={openCategory}
            onOpenProduct={openProduct}
            onAddProduct={openCategoryAdd}
            positionsByCategory={positionsByCategory}
            onReorderCategory={(id) => {
              reorder.reset();
              setReorderId(id);
            }}
          />
        </section>
      )}

      {reorderTarget ? (
        <ReorderCategorySheet
          open
          categoryName={reorderTarget.name}
          total={reorderable.length}
          currentPosition={positionsByCategory[reorderTarget.id] ?? 1}
          pending={reorder.pending}
          error={reorder.error}
          onClose={() => {
            setReorderId(null);
            reorder.reset();
          }}
          onSelect={(position) => {
            void reorder.reorder(reorderTarget.id, position).then((ok) => {
              if (ok) setReorderId(null);
            });
          }}
        />
      ) : null}

      <CategoryAddSheet
        open={Boolean(categoryAddTarget)}
        categoryName={categoryAddTarget?.name ?? ''}
        products={allProducts}
        existingIds={existingProductIds}
        categoryNameById={categoryNameById}
        onClose={() => setCategoryAddId(null)}
        onCreateProduct={() => {
          const id = categoryAddId;
          setCategoryAddId(null);
          if (id) navigate(createProductPath(id));
        }}
        onAssign={async (productIds) => {
          if (!categoryAddId) return;
          await assignProductsToCategory(categoryAddId, productIds);
        }}
      />
    </div>
  );
}
