import { useState } from 'react';
import type {
  StorefrontProductDetail,
  StorefrontProductVariant,
} from '../../../application/read-models/storefront-product';
import { formatMoneyMinor } from '../../../domain/rules/product-rules';
import { useHaptic } from '../../../application/hooks/useHaptic';

export interface ProductSelection {
  selectedVariant: StorefrontProductVariant | null;
  selectedVariantId: string | null;
  priceLabel: string;
  originalPriceLabel: string | null;
  soldOut: boolean;
  canAdd: boolean;
  selectVariant: (variantId: string) => void;
}

/**
 * Выбор варианта и производные (цена/наличие) для Product Detail. Выбор привязан
 * к товару: при смене `detail.product.id` сбрасывается прямо во время рендера
 * (сравнение productId), без setState в эффекте. Haptic — при выборе.
 * docs/18 PD-H-15.
 */
export function useProductSelection(detail: StorefrontProductDetail | null): ProductSelection {
  const { selectTick } = useHaptic();
  const productId = detail?.product.id ?? null;
  const [choice, setChoice] = useState<{ productId: string | null; variantId: string } | null>(
    null,
  );

  const variants = detail?.variants ?? [];
  // Дефолт — первый доступный вариант; выбор пользователя имеет приоритет.
  const defaultVariant = variants.find((v) => v.available) ?? variants[0] ?? null;
  const selectedVariantId = choice && choice.productId === productId ? choice.variantId : null;
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? defaultVariant;
  const symbol = detail?.store.currencySymbol ?? '';

  const priceLabel = selectedVariant ? formatMoneyMinor(selectedVariant.price, symbol) : '';
  const originalPriceLabel =
    selectedVariant?.originalPrice != null
      ? formatMoneyMinor(selectedVariant.originalPrice, symbol)
      : null;
  const soldOut = variants.length > 0 && variants.every((v) => !v.available);
  const canAdd = Boolean(selectedVariant?.available);

  const selectVariant = (variantId: string) => {
    selectTick();
    setChoice({ productId, variantId });
  };

  return {
    selectedVariant,
    selectedVariantId: selectedVariant?.id ?? null,
    priceLabel,
    originalPriceLabel,
    soldOut,
    canAdd,
    selectVariant,
  };
}
