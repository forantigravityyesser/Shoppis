import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PackagePlus } from 'lucide-react';
import { useInventoryActions } from '../../../../application/hooks/useInventoryActions';
import { useProductDetail } from '../../../../application/hooks/useProduct';
import { currencySymbol } from '../../../../domain/constants/currencies';
import type { ProductStatus } from '../../../../domain/models/product';
import { formatMoneyMinor } from '../../../../domain/rules/product-rules';
import {
  ProductStatusError,
  type ProductStatusErrorCode,
} from '../../../../application/contracts/product-status';
import StockControlSheet from './StockControlSheet';

/** Вкладка «Карточка»: сводка остатков, варианты, атрибуты, показатели и действия. */
export default function ProductOverview() {
  const { productId = '' } = useParams();
  const navigate = useNavigate();
  const { product } = useProductDetail(productId);
  const { setProductStatus, deleteProduct } = useInventoryActions();
  const [stockOpen, setStockOpen] = useState(false);
  /** Remount sheet при открытии: сброс правок без effect (docs/20 §11). */
  const [stockKey, setStockKey] = useState(0);
  const [pending, setPending] = useState<null | 'archive' | 'publish'>(null);
  const [lastStatus, setLastStatus] = useState<ProductStatus | null>(null);
  const [statusError, setStatusError] = useState<{
    code: ProductStatusErrorCode;
    message: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!product) return null;

  const base = `/seller/inventory/product/${product.id}`;
  const archived = product.status === 'ARCHIVED';
  /** ADR-06.8: без активного варианта товар нельзя выставить на витрину. */
  const canPublish = product.variants.length > 0;
  const currency = currencySymbol(product.currency);

  const changeStatus = async (status: ProductStatus) => {
    setLastStatus(status);
    setPending(status === 'ARCHIVED' ? 'archive' : 'publish');
    setStatusError(null);
    try {
      await setProductStatus(product.id, status);
    } catch (e) {
      setStatusError(
        e instanceof ProductStatusError
          ? { code: e.code, message: e.message }
          : { code: 'UNKNOWN', message: 'Не удалось изменить статус. Попробуйте ещё раз.' },
      );
    } finally {
      setPending(null);
    }
  };

  const archive = () => void changeStatus('ARCHIVED');
  const publish = () => void changeStatus('ACTIVE');
  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteProduct(product.id);
      navigate('/seller/inventory');
    } catch (e) {
      console.error('[inventory] deleteProduct failed', e);
      setDeleteError('Не удалось удалить товар. Попробуйте ещё раз.');
      setDeleting(false);
    }
  };

  return (
    <div className="prod-body">
      <section className="glass prod-panel">
        <div className="prod-stats">
          <div className="prod-stat">
            <span className="prod-stat__value">{product.stockAvailable}</span>
            <span className="prod-stat__label">В наличии</span>
          </div>
          <div className="prod-stat">
            <span className="prod-stat__value">{product.stockHeld}</span>
            <span className="prod-stat__label">В ожидании</span>
          </div>
        </div>
        <button
          type="button"
          className="btn-ghost btn-primary--wide prod-stock-btn"
          onClick={() => {
            setStockOpen(true);
            setStockKey((k) => k + 1);
          }}
        >
          <PackagePlus size={16} />
          <span>Контроль остатков</span>
        </button>
      </section>

      <section className="glass prod-panel">
        <div className="card__title">Варианты</div>
        {product.variants.length === 0 ? (
          <div className="card__muted">Нет вариантов</div>
        ) : (
          <div className="prod-variants">
            {product.variants.map((v) => (
              <div className="prod-variant" key={v.id}>
                <div className="prod-variant__main">
                  <span className="prod-variant__name">
                    {v.name}: {v.value}
                  </span>
                  <span className="prod-variant__price">
                    {formatMoneyMinor(v.priceMinor, currency)}
                  </span>
                </div>
                <div className="prod-variant__stock">
                  <span className="prod-variant__avail">{v.availableQuantity} шт.</span>
                  {v.heldQuantity > 0 ? (
                    <span className="prod-variant__held">{v.heldQuantity} в ожидании</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {product.attributes.length > 0 ? (
        <section className="glass prod-panel">
          <div className="card__title">Характеристики</div>
          {product.attributes.map((a, index) => (
            <div className="row" key={`${a.name}-${index}`}>
              <span className="row__label">{a.name}</span>
              <span className="row__value">{a.value}</span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="glass prod-panel prod-actions">
        {statusError ? (
          <p className="prod-hint prod-hint--error" role="alert">
            {statusError.message}
            {lastStatus ? (
              <>
                {' '}
                <button
                  type="button"
                  className="prod-retry"
                  disabled={pending !== null}
                  onClick={() => void changeStatus(lastStatus)}
                >
                  Повторить
                </button>
              </>
            ) : null}
          </p>
        ) : null}

        <div className="form-actions">
          {archived ? (
            <button
              type="button"
              className="btn-primary"
              disabled={!canPublish || pending === 'publish'}
              onClick={publish}
            >
              {pending === 'publish' ? 'Публикация…' : 'Вернуть на витрину'}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={pending === 'archive'}
              onClick={archive}
            >
              {pending === 'archive' ? 'В архив…' : 'В архив'}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={() => navigate(`${base}/edit`)}>
            Редактировать
          </button>
        </div>
        {archived ? (
          <button type="button" className="prod-remove" disabled={deleting} onClick={() => void remove()}>
            {deleting ? 'Удаление…' : 'Удалить из архива'}
          </button>
        ) : null}
        {deleteError ? (
          <p className="prod-hint prod-hint--error" role="alert">
            {deleteError}
          </p>
        ) : null}
        {!canPublish ? (
          <p className="prod-hint">
            Добавьте хотя бы один вариант выбора при заказе (размер/объём), чтобы выставить товар на
            витрину.
          </p>
        ) : null}
      </section>

      <StockControlSheet
        key={stockKey}
        open={stockOpen}
        productId={product.id}
        variants={product.variants}
        onClose={() => setStockOpen(false)}
      />
    </div>
  );
}
