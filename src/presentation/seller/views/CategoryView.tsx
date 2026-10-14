import { useMemo, useRef, useState } from 'react';
import { Package, Pencil, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useCategoryPage } from '../../../application/hooks/useCategory';
import { createProductPath } from '../../../application/hooks/useInventoryActions';
import { UNCATEGORIZED_ID } from '../../../domain/constants/categories';
import { isSystemCategory } from '../../../domain/rules/category-rules';
import BackButton from '../../shared/components/BackButton';
import { useResetScroll } from '../../shared/hooks/useResetScroll';
import { useStuck } from '../../shared/hooks/useStuck';
import ProductMiniCard from '../inventory/components/ProductMiniCard';
import EditCategorySheet from '../inventory/components/EditCategorySheet';
import '../inventory/inventory.css';

/** CategoryView: список товаров категории, поиск, фильтры, редактирование категории. */
export default function CategoryView() {
  const { t } = useTranslation();
  const { categoryId = '' } = useParams();
  const navigate = useNavigate();
  const { category, products, orderPosition, orderTotal, loading } = useCategoryPage(categoryId);
  const [query, setQuery] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  /** Remount sheet при открытии: сброс формы без effect (docs/20 §11). */
  const [editKey, setEditKey] = useState(0);
  /** Системную «Без категории» нельзя редактировать. */
  const editable = !isSystemCategory(categoryId);

  // «Назад» залипает в левом верхнем углу при скролле (визуал как в других вкладках).
  const headerRef = useRef<HTMLDivElement>(null);
  const stuck = useStuck(headerRef);

  // Экран-деталь всегда открывается сверху (не переносим скролл с инвентаря).
  const rootRef = useRef<HTMLDivElement>(null);
  useResetScroll(rootRef, category?.id);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.title.toLowerCase().includes(q));
  }, [products, query]);

  if (!category) {
    return (
      <div className="screen">
        <div className="screen__header screen__header--row">
          <BackButton fallback="/seller/inventory?mode=categories" />
          <h1 className="screen__title">{t('seller.inventory.categoryView.title')}</h1>
        </div>
        <div className="card card__muted">
          {loading ? t('common.loading') : t('seller.inventory.categoryView.notFound')}
        </div>
      </div>
    );
  }

  return (
    <div className="screen cat" ref={rootRef}>
      <div className="sticky-rail sticky-rail--start">
        <BackButton
          fallback="/seller/inventory?mode=categories"
          className={stuck ? 'back-btn--floating' : undefined}
        />
      </div>
      <div className="cat-head" ref={headerRef}>
        <span className="screen__header-spacer" aria-hidden />
        <div className="cat-head__avatar" aria-hidden>
          {category.imageUrl ? (
            <img
              className="cat-head__avatar-img"
              src={category.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            category.emoji
          )}
        </div>
        <div className="cat-head__text">
          <h1 className="cat-head__title">
            {category.id === UNCATEGORIZED_ID
              ? t('seller.inventory.categoryPicker.uncategorized')
              : category.name}
          </h1>
          <p className="cat-head__meta">
            {t('seller.inventory.productCount', { count: category.productCount })}
            {category.archivedCount > 0
              ? ` · ${t('seller.inventory.archivedCount', { count: category.archivedCount })}`
              : ''}
          </p>
        </div>
        {editable ? (
          <button
            type="button"
            className="inv-icon-btn"
            onClick={() => {
              setEditOpen(true);
              setEditKey((k) => k + 1);
            }}
            aria-label={t('seller.inventory.categoryView.editAria')}
          >
            <Pencil size={18} />
          </button>
        ) : null}
      </div>

      <div className="inv-search cat-search">
        <Search size={16} className="inv-search__icon" aria-hidden />
        <input
          className="inv-search__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('seller.inventory.categoryView.searchProduct')}
          aria-label={t('seller.inventory.categoryView.searchProduct')}
        />
        {query ? (
          <button
            type="button"
            className="inv-search__clear"
            onClick={() => setQuery('')}
            aria-label={t('seller.inventory.categoryPicker.clear')}
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {products.length === 0 ? (
        <div className="inv-state inv-state--empty">
          <div className="inv-state__icon" aria-hidden>
            <Package size={40} strokeWidth={1.6} />
          </div>
          <p className="inv-state__title">{t('seller.inventory.categoryView.emptyTitle')}</p>
          <button
            type="button"
            className="inv-add-btn"
            onClick={() => navigate(createProductPath(category.id))}
          >
            + {t('seller.inventory.addProduct')}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="inv-state">
          <p className="inv-state__title">{t('seller.inventory.noResults')}</p>
          <p className="inv-state__subtitle">
            {t('seller.inventory.categoryView.noResultsHint')}
          </p>
        </div>
      ) : (
        <div className="cat-list">
          {filtered.map((product) => (
            <ProductMiniCard
              key={product.id}
              product={product}
              onClick={() => navigate(`/seller/inventory/product/${product.id}`)}
            />
          ))}
        </div>
      )}

      {products.length > 0 ? (
        <button
          type="button"
          className="cat-add"
          onClick={() => navigate(createProductPath(category.id))}
        >
          + {t('seller.inventory.addProduct')}
        </button>
      ) : null}

      {editable ? (
        <EditCategorySheet
          key={editKey}
          open={editOpen}
          category={category}
          orderPosition={orderPosition}
          orderTotal={orderTotal}
          onClose={() => setEditOpen(false)}
          onDeleted={() => navigate('/seller/inventory')}
        />
      ) : null}
    </div>
  );
}
