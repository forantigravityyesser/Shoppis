import { useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router';
import { useProductDetail } from '../../../application/hooks/useProduct';
import { currencySymbol } from '../../../domain/constants/currencies';
import { formatMoneyMinor } from '../../../domain/rules/product-rules';
import BackButton from '../../shared/components/BackButton';
import '../inventory/inventory.css';

const TABS = [
  { to: '', label: 'Карточка', end: true },
  { to: 'reviews', label: 'Отзывы', end: false },
  { to: 'questions', label: 'Вопросы', end: false },
  { to: 'preview', label: 'Витрина', end: false },
];

/**
 * Карточка товара: стеклянная шапка (галерея, цена, статус) + таб-бар.
 * Контент вкладок рендерится через <Outlet/> (вложенные роуты /reviews, /questions, /preview).
 */
export default function ProductView() {
  const { productId = '' } = useParams();
  const { product, loading } = useProductDetail(productId);
  const [imageIndex, setImageIndex] = useState(0);

  if (!product) {
    return (
      <div className="screen">
        <div className="screen__header screen__header--row">
          <BackButton fallback="/seller/inventory" />
          <h1 className="screen__title">Товар</h1>
        </div>
        <div className="card card__muted">{loading ? 'Загрузка…' : 'Товар не найден.'}</div>
      </div>
    );
  }

  const base = `/seller/inventory/product/${product.id}`;
  const images = product.images;
  const activeImage = images[Math.min(imageIndex, images.length - 1)] ?? null;

  return (
    <div className="screen prod">
      <header className="prod-head">
        <BackButton fallback="/seller/inventory" />
        <h1 className="prod-head__title">{product.title}</h1>
        <span className={`prod-status prod-status--${product.status.toLowerCase()}`}>
          {product.status === 'ACTIVE' ? 'На витрине' : 'В архиве'}
        </span>
      </header>

      <section className="glass prod-hero">
        <div className="prod-hero__media">
          {activeImage ? (
            <img
              className="prod-hero__img"
              src={activeImage.url}
              alt=""
              decoding="async"
              fetchPriority="high"
            />
          ) : (
            <span className="prod-hero__emoji">{product.emoji}</span>
          )}
        </div>
        <div className="prod-hero__info">
          <div className="prod-hero__price">
            {formatMoneyMinor(product.priceMinor, currencySymbol(product.currency))}
            {product.discountPercent > 0 ? (
              <span className="prod-hero__discount">−{product.discountPercent}%</span>
            ) : null}
          </div>
          <div className="prod-hero__meta">
            <span>{product.categoryName}</span>
          </div>
          {product.description ? <p className="prod-hero__desc">{product.description}</p> : null}
        </div>
      </section>

      {images.length > 1 ? (
        <div className="prod-thumbs">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              className={`prod-thumb${index === imageIndex ? ' prod-thumb--active' : ''}`}
              onClick={() => setImageIndex(index)}
              aria-label={`Фото ${index + 1}`}
            >
              <img src={image.thumbUrl ?? image.url} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      ) : null}

      <nav className="glass prod-tabs">
        {TABS.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to ? `${base}/${tab.to}` : base}
            end={tab.end}
            className={({ isActive }) => `prod-tab${isActive ? ' prod-tab--active' : ''}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
