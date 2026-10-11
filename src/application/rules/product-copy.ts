import type { VariantForm } from './variant-form';

/**
 * Данные текущей формы товара, которые имеет смысл копировать (docs/23 §3.1, §13.1).
 *
 * Структурно совместимо с `ProductFormValues` (presentation), но описано здесь, чтобы
 * application-правило не зависело от presentation. Список полей — только копируемые;
 * фото, остатки и идентификаторы сюда сознательно не входят (они сбрасываются).
 */
export interface ProductCopySource {
  title: string;
  description: string;
  categoryId: string;
  attributes: Array<{ name: string; value: string }>;
  variants: VariantForm[];
}

/** Результат подготовки копии: данные нового черновика (фото всегда пусты). */
export interface ProductCopyDraft {
  title: string;
  description: string;
  categoryId: string;
  images: [];
  attributes: Array<{ name: string; value: string }>;
  variants: VariantForm[];
}

/**
 * Локальное преобразование данных формы в независимый черновик товара (docs/23 §13.1).
 *
 * Правила:
 * - копируются только разрешённые поля (§3.1): название, описание, категория, характеристики,
 *   структура/порядок вариантов, базовая цена, скидка и оси custom-цены/скидки;
 * - сбрасываются фотографии (`images: []`) и остатки (`quantity: '0'`, решение Q1);
 * - исключается `id` товара и вариантов (Q4/R4);
 * - создаются независимые вложенные объекты (явный маппинг, без ссылок на исходные);
 * - функция чистая: не обращается к БД/Storage, не сохраняет товар, не меняет источник.
 *
 * Не является контрактом сохранения: режим `create` и привязка нового `productId` — задача
 * сессии черновиков (PC-02/PC-04), а не этой функции.
 */
export function createProductCopy(source: ProductCopySource): ProductCopyDraft {
  return {
    title: source.title,
    description: source.description,
    categoryId: source.categoryId,
    images: [],
    attributes: source.attributes.map((attribute) => ({
      name: attribute.name,
      value: attribute.value,
    })),
    variants: source.variants.map((variant) => ({
      name: variant.name,
      value: variant.value,
      quantity: '0',
      price: variant.price,
      discount: variant.discount,
      priceMode: variant.priceMode,
      discountMode: variant.discountMode,
    })),
  };
}

/**
 * Есть ли в форме данные, которые имеет смысл копировать (docs/23 §7.2).
 *
 * Простая проверка наличия содержимого, **не** бизнес-валидация товара: кнопка «+ Создать копию»
 * неактивна для пустой формы. Категория не учитывается (у неё есть значение по умолчанию).
 */
export function hasCopyableContent(source: ProductCopySource): boolean {
  return (
    source.title.trim().length > 0 ||
    source.description.trim().length > 0 ||
    source.attributes.some((attribute) => attribute.name.trim() || attribute.value.trim()) ||
    source.variants.some(
      (variant) => variant.value.trim() || variant.name.trim() || variant.price.trim(),
    )
  );
}
