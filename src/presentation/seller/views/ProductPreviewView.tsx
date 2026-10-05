import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { useInventoryHome } from '../../../application/hooks/useInventory';
import { useProducts } from '../../../application/hooks/useProducts';
import { useHaptic } from '../../../application/hooks/useHaptic';
import { currencySymbol } from '../../../domain/constants/currencies';
import { formatMoneyMinor } from '../../../domain/rules/product-rules';
import SafeImage from '../../shared/components/SafeImage';
import LinkProductsSheet from '../inventory/components/LinkProductsSheet';
import '../inventory/inventory.css';

/**
 * Вкладка «Витрина» seller-карточки. PD-14b: блок «Связи» — двусторонние связи
 * товара (в «Похожее» у покупателя), без транзитивности. Управление — через
 * `LinkProductsSheet` (поиск по всем товарам магазина). docs/14 §7.
 */
export default function ProductPreviewView() {
  const { productId = '' } = useParams();
  const navigate = useNavigate();
  const { allProducts, loading, error } = useInventoryHome();
  const { productLinks, linkProducts, unlinkProducts } = useProducts();
  const { selectTick, notifySuccess } = useHaptic();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const linkedIds = useMemo(() => {
    const set = new Set<string>();
    for (const link of productLinks) {
      if (link.productId === productId) set.add(link.relatedProductId);
      else if (link.relatedProductId === productId) set.add(link.productId);
    }
    return set;
  }, [productLinks, productId]);

  const linkedProducts = useMemo(
    () => allProducts.filter((p) => linkedIds.has(p.id)),
    [allProducts, linkedIds],
  );
  const candidates = useMemo(
    () => allProducts.filter((p) => p.id !== productId),
    [allProducts, productId],
  );

  const toggle = async (targetId: string) => {
    setPendingId(targetId);
    try {
      if (linkedIds.has(targetId)) {
        await unlinkProducts(productId, targetId);
        selectTick();
      } else {
        await linkProducts(productId, targetId);
        notifySuccess();
      }
    } catch {
      /* ошибка мутации остаётся в catalogError стора */
    } finally {
      setPendingId(null);
    }
  };

  if (loading) {
    return (
      <div className="glass inv-state prod-tab-empty">
        <p className="inv-state__title">Загрузка…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass inv-state prod-tab-empty">
        <p className="inv-state__title">Не удалось загрузить каталог.</p>
      </div>
    );
  }

  return (
    <div className="prod-body" data-testid="product-links">
      <section className="glass prod-panel">
        <div className="prod-links__head">
          <span className="card__title">Связи</span>
          {linkedProducts.length > 0 ? (
            <span className="prod-links__count">{linkedProducts.length}</span>
          ) : null}
        </div>

        {linkedProducts.length === 0 ? (
          <p className="prod-links__empty">
            Пока нет связанных товаров. Добавьте — они появятся в разделе «Похожее» у покупателя.
          </p>
        ) : (
          <ul className="prod-links">
            {linkedProducts.map((product) => (
              <li className="prod-link" key={product.id}>
                <button
                  type="button"
                  className="prod-link__open"
                  onClick={() => navigate(`/seller/inventory/product/${product.id}`)}
                >
                  <span className="prod-link__thumb" aria-hidden>
                    <SafeImage
                      src={product.imageUrl}
                      alt=""
                      fallback={<span className="prod-link__emoji">{product.emoji || '📦'}</span>}
                    />
                  </span>
                  <span className="prod-link__body">
                    <span className="prod-link__title">{product.title}</span>
                    <span className="prod-link__price">
                      {formatMoneyMinor(product.priceMinor, currencySymbol(product.currency))}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="prod-link__remove"
                  aria-label={`Убрать «${product.title}» из связей`}
                  disabled={pendingId === product.id}
                  onClick={() => void toggle(product.id)}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="btn-ghost btn-primary--wide prod-links__add"
          onClick={() => setSheetOpen(true)}
        >
          <Plus size={16} />
          <span>Добавить связь</span>
        </button>
      </section>

      <LinkProductsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        products={candidates}
        linkedIds={linkedIds}
        pendingId={pendingId}
        onToggle={(id) => void toggle(id)}
      />
    </div>
  );
}
