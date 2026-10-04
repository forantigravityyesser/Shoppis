import { useEffect, useRef, useState } from 'react';
import { Check, Heart } from 'lucide-react';
import { motion } from 'framer-motion';

const ADDED_FEEDBACK_MS = 1200;

interface Props {
  priceLabel: string;
  originalPriceLabel: string | null;
  soldOut: boolean;
  /** Можно ли добавить (есть доступный выбранный вариант). */
  canAdd: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onAddToCart: () => void;
}

/**
 * Плавающий нижний CTA — без фоновой полосы: белый круг с сердцем (избранное,
 * store-scoped) + белая капсула с ценой и кнопкой «Добавить в корзину».
 * Корзина ничего не резервирует; checkout перепроверит цену/остаток. docs/14 §5, §10-11.
 */
export default function DetailsCtaBar({
  priceLabel,
  originalPriceLabel,
  soldOut,
  canAdd,
  isFavorite,
  onToggleFavorite,
  onAddToCart,
}: Props) {
  // Локальный морф кнопки «✓ Добавлено» после успешного добавления (PD-12).
  const [added, setAdded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleAdd = () => {
    if (!canAdd) return;
    onAddToCart();
    setAdded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS);
  };

  return (
    <div className="pd-cta" data-testid="product-cta">
      <motion.button
        type="button"
        className={`pd-cta__fav${isFavorite ? ' pd-cta__fav--active' : ''}`}
        aria-label={isFavorite ? 'Убрать из избранного' : 'В избранное'}
        aria-pressed={isFavorite}
        onClick={onToggleFavorite}
        whileTap={{ scale: 0.88 }}
      >
        {/* key = состояние → remount даёт «pop» при переключении (docs/14 §16). */}
        <motion.span
          key={isFavorite ? 'on' : 'off'}
          className="pd-cta__fav-icon"
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 18 }}
        >
          <Heart size={22} strokeWidth={2.4} fill={isFavorite ? 'currentColor' : 'none'} />
        </motion.span>
      </motion.button>

      <span className="pd-cta__buy">
        <span className="pd-cta__price">
          <span className="pd-cta__price-label">Итого</span>
          <span className="pd-cta__price-current">{priceLabel}</span>
          {originalPriceLabel ? <s className="pd-cta__price-old">{originalPriceLabel}</s> : null}
        </span>

        <motion.button
          type="button"
          className={`pd-cta__add${added ? ' pd-cta__add--added' : ''}`}
          disabled={!canAdd}
          onClick={handleAdd}
          whileTap={canAdd ? { scale: 0.96 } : undefined}
        >
          {/* Обе надписи в одной grid-ячейке: ширина = самой длинной,
              поэтому появление «Добавлено» не сдвигает цену (без layout shift). */}
          <span className="pd-cta__add-inner">
            <span aria-hidden={added} className={added ? 'is-hidden' : undefined}>
              {soldOut ? 'Нет в наличии' : 'Добавить в корзину'}
            </span>
            <span aria-hidden={!added} className={`pd-cta__add-added${added ? '' : ' is-hidden'}`}>
              <Check size={16} aria-hidden /> Добавлено
            </span>
          </span>
        </motion.button>
      </span>
    </div>
  );
}
