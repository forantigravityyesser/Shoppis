import type { InventoryProductDetail } from '../../../application/hooks/useProduct';
import type { InventoryImageItem } from '../../../application/read-models/inventory-view';
import { emptyVariant, type VariantForm } from '../../../application/rules/variant-form';
import { UNCATEGORIZED_ID } from '../../../domain/constants/categories';

export interface Characteristic {
  name: string;
  value: string;
}

export interface ProductFormValues {
  title: string;
  description: string;
  categoryId: string;
  images: InventoryImageItem[];
  attributes: Characteristic[];
  variants: VariantForm[];
}

/**
 * Плоские данные товара → значения формы (для режима редактирования).
 * Вынесено из `ProductForm.tsx`, чтобы файл экспортировал только компонент
 * (react-refresh, docs/20 §11).
 */
export function detailToFormValues(detail: InventoryProductDetail): ProductFormValues {
  const variants: VariantForm[] = detail.variants.map((v, index) => ({
    id: v.id,
    name: v.name,
    value: v.value,
    quantity: String(v.availableQuantity),
    price: (v.originalAmountMinor / 100).toFixed(2),
    discount: String(v.discountPercent),
    priceMode:
      index > 0 && v.priceMode === 'CUSTOM_PRICE' && v.customOriginalAmountMinor != null
        ? 'CUSTOM'
        : 'INHERITED',
    discountMode:
      index > 0 && v.priceMode === 'CUSTOM_PRICE' && v.customDiscountPercent != null
        ? 'CUSTOM'
        : 'INHERITED',
  }));

  return {
    title: detail.title,
    description: detail.description,
    categoryId: detail.categoryId ?? UNCATEGORIZED_ID,
    images: detail.images,
    attributes: detail.attributes.map((a) => ({ name: a.name, value: a.value })),
    variants: variants.length ? variants : [emptyVariant()],
  };
}
