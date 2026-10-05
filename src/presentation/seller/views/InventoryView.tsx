import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useInventoryHome } from '../../../application/hooks/useInventory';
import {
  createProductPath,
  useInventoryActions,
} from '../../../application/hooks/useInventoryActions';
import { useCategoryReorder } from '../../../application/hooks/useCategoryReorder';
import { useInventoryCategoryAssignment } from '../../../application/hooks/useInventoryCategoryAssignment';
import InventoryHeader from '../inventory/components/InventoryHeader';
import InventoryModeSwitcher, {
  type InventoryMode,
} from '../inventory/components/InventoryModeSwitcher';
import InventoryProductsSection from '../inventory/components/products/InventoryProductsSection';
import InventoryCategoryList from '../inventory/components/InventoryCategoryList';
import CategoryAddSheet from '../inventory/components/CategoryAddSheet';
import InventorySkeleton from '../inventory/components/InventorySkeleton';
import ReorderCategorySheet from '../inventory/components/ReorderCategorySheet';
import '../inventory/inventory.css';

/**
 * Inventory Home — рабочая зона каталога продавца.
 * Две секции: «Товары» (по умолчанию) и «Категории».
 * Derived data (позиции/имена/назначение) живёт в `useInventoryHome`/application (docs/20 §8).
 */
export default function InventoryView() {
  const navigate = useNavigate();
  const {
    categories,
    productsByCategory,
    allProducts,
    userCategoryIds,
    positionsByCategory,
    categoryNameById,
    totals,
    loading,
    error,
  } = useInventoryHome();
  const reorder = useCategoryReorder();
  const { assignProductsToCategory } = useInventoryActions();
  const [mode, setMode] = useState<InventoryMode>('products');
  const [reorderId, setReorderId] = useState<string | null>(null);
  const [categoryAddId, setCategoryAddId] = useState<string | null>(null);
  /** Remount sheet при каждом открытии: сброс шага/выбора без effect (docs/20 §11). */
  const [categoryAddKey, setCategoryAddKey] = useState(0);

  const reorderTarget = reorderId ? (categories.find((c) => c.id === reorderId) ?? null) : null;
  const categoryAddTarget = categoryAddId
    ? (categories.find((c) => c.id === categoryAddId) ?? null)
    : null;
  const existingProductIds = useInventoryCategoryAssignment(
    allProducts,
    userCategoryIds,
    categoryAddTarget?.id ?? null,
  );

  const openCategory = (id: string) => navigate(`/seller/inventory/category/${id}`);
  const openProduct = (id: string) => navigate(`/seller/inventory/product/${id}`);
  /** «+» в категории открывает выбор: новый товар или товары из магазина. */
  const openCategoryAdd = (categoryId: string) => {
    setCategoryAddId(categoryId);
    setCategoryAddKey((k) => k + 1);
  };

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
          <InventoryCategoryList
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
          total={totals.categories}
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
        key={categoryAddKey}
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
