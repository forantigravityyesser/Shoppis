import { UNCATEGORIZED_ID } from '../../domain/constants/categories';
import type { ProductStatus } from '../../domain/models/product';
import type { NewProductInput } from '../contracts/product';
import type { ProductFormPayload } from '../read-models/inventory-view';

/**
 * Форма товара → поля каталога (persistence).
 *
 * Первый (заполненный) вариант задаёт базовую цену/скидку товара. Наследование
 * цены и скидки — две НЕЗАВИСИМЫЕ оси (docs/20 §3.1): `CUSTOM_PRICE` означает
 * «переопределена хотя бы одна ось», а конкретное поле определяет, какая именно.
 * Наследуемая ось пишется как `null` (не «текущее значение, замороженное как custom»).
 */
export interface ProductCatalogFields {
  title: string;
  description: string;
  categoryId: string | null;
  originalAmountMinor: number;
  discountPercent: number;
  status: ProductStatus;
  images: NewProductInput['images'];
  variants: NewProductInput['variants'];
  attributes: Array<{ name: string; value: string }>;
  linkAttributes: Array<{ name: string; value: string }>;
}

/** Системная «Без категории» хранится в БД как category_id = null. */
export function resolveCategoryId(categoryId: string): string | null {
  return categoryId && categoryId !== UNCATEGORIZED_ID ? categoryId : null;
}

export function toCatalogFields(payload: ProductFormPayload): ProductCatalogFields {
  const filled = payload.variants.filter((v) => v.value.trim());
  const base = filled[0] ?? null;
  const basePrice = base?.priceMinor ?? 0;
  const baseDiscount = base?.discountPercent ?? 0;

  const variants = filled.map((v) => {
    const priceCustom = v.priceMode === 'CUSTOM';
    const discountCustom = v.discountMode === 'CUSTOM';
    const hasCustom = priceCustom || discountCustom;
    return {
      id: v.id,
      name: v.name.trim() || 'Вариант',
      value: v.value.trim(),
      availableQuantity: Math.max(0, Math.round(Number.isFinite(v.quantity) ? v.quantity : 0)),
      priceMode: hasCustom ? ('CUSTOM_PRICE' as const) : ('USE_PRODUCT_PRICE' as const),
      customOriginalAmountMinor: priceCustom ? v.priceMinor : null,
      customDiscountPercent: discountCustom ? v.discountPercent : null,
    };
  });

  return {
    title: payload.title.trim(),
    description: (payload.description ?? '').trim(),
    categoryId: resolveCategoryId(payload.categoryId),
    originalAmountMinor: basePrice,
    discountPercent: baseDiscount,
    status: payload.status,
    images: payload.images.map((image) => ({
      storageKey: image.url,
      thumbStorageKey: image.thumbUrl,
    })),
    variants,
    attributes: payload.attributes,
    linkAttributes: [],
  };
}
