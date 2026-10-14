import { useEffect, useRef, useState } from 'react';
import { Ruler } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { StorefrontProductVariant } from '../../../../application/read-models/storefront-product';

interface Props {
  variants: StorefrontProductVariant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Селектор вариантов (Size/Volume). Таблетки не растягиваются; выбранная
 * подсвечена, sold-out (0 в наличии) недоступна. Справа от подписи — визуальный
 * счётчик размеров; при переполнении ряда появляется градиент-подсказка, что
 * есть ещё (горизонтальный скролл). Цена каждого варианта — забота shell (PD-07).
 */
export default function VariantSelector({ variants, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  const rowRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollWidth > el.clientWidth + 1);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [variants, selectedId]);

  if (variants.length === 0) return null;

  const label = variants[0]?.name || t('buyer.product.variantFallback');

  return (
    <div className="pd-variants" data-testid="product-variants">
      <div className="pd-variants__head">
        <span className="pd-variants__label">{label}</span>
        <span
          className="pd-variants__count"
          aria-label={t('buyer.product.variantsCountAria', { count: variants.length })}
        >
          <Ruler size={13} strokeWidth={2.4} aria-hidden />
          {variants.length}
        </span>
      </div>

      <div className="pd-variants__scroll">
        <div className="pd-variants__row" ref={rowRef}>
          {variants.map((variant) => {
            const classes = [
              'pd-variant',
              variant.id === selectedId ? 'pd-variant--selected' : '',
              variant.available ? '' : 'pd-variant--soldout',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={variant.id}
                type="button"
                className={classes}
                disabled={!variant.available}
                aria-pressed={variant.id === selectedId}
                onClick={() => onSelect(variant.id)}
              >
                {variant.value}
              </button>
            );
          })}
        </div>
        {overflow ? <span className="pd-variants__fade" aria-hidden /> : null}
      </div>
    </div>
  );
}
