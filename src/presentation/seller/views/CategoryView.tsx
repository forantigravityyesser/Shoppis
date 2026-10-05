import { useMemo, useState } from 'react';
import { Package, Pencil, Search, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { useCategoryPage } from '../../../application/hooks/useCategory';
import { createProductPath } from '../../../application/hooks/useInventoryActions';
import { isSystemCategory } from '../../../domain/rules/category-rules';
import BackButton from '../../shared/components/BackButton';
import ProductMiniCard from '../inventory/components/ProductMiniCard';
import EditCategorySheet from '../inventory/components/EditCategorySheet';
import { pluralRu } from '../inventory/layout';
import '../inventory/inventory.css';

/** CategoryView: список товаров категории, поиск, фильтры, редактирование категории. */
export default function CategoryView() {
  const { categoryId = '' } = useParams();
  const navigate = useNavigate();
  const { category, products, orderPosition, orderTotal, loading } = useCategoryPage(categoryId);
  const [query, setQuery] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  /** Системную «Без категории» нельзя редактировать. */
  const editable = !isSystemCategory(categoryId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.title.toLowerCase().includes(q));
  }, [products, query]);

  if (!category) {
    return (
      <div className="screen">
        <div className="screen__header screen__header--row">
          <BackButton fallback="/seller/inventory" />
          <h1 className="screen__title">Категория</h1>
        </div>
        <div className="card card__muted">{loading ? 'Загрузка…' : 'Категория не найдена.'}</div>
      </div>
    );
  }

  return (
    <div className="screen cat">
      <div className="cat-head">
        <BackButton fallback="/seller/inventory" />
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
          <h1 className="cat-head__title">{category.name}</h1>
          <p className="cat-head__meta">
            {category.productCount}{' '}
            {pluralRu(category.productCount, ['товар', 'товара', 'товаров'])}
            {category.archivedCount > 0 ? ` · ${category.archivedCount} в архиве` : ''}
          </p>
        </div>
        {editable ? (
          <button
            type="button"
            className="inv-icon-btn"
            onClick={() => setEditOpen(true)}
            aria-label="Редактировать категорию"
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
          placeholder="Найти товар"
          aria-label="Найти товар"
        />
        {query ? (
          <button
            type="button"
            className="inv-search__clear"
            onClick={() => setQuery('')}
            aria-label="Очистить"
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
          <p className="inv-state__title">В этой категории пока нет товаров</p>
          <button
            type="button"
            className="inv-add-btn"
            onClick={() => navigate(createProductPath(category.id))}
          >
            + Добавить товар
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="inv-state">
          <p className="inv-state__title">Ничего не найдено</p>
          <p className="inv-state__subtitle">Попробуйте изменить запрос</p>
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
          + Добавить товар
        </button>
      ) : null}

      {editable ? (
        <EditCategorySheet
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
