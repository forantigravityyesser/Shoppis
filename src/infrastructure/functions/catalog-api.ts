import { invokeFunction } from '../insforge/functions-gateway';
import type {
  AddVariantInput,
  NewProductInput,
  NewVariantInput,
  ProductImageInput,
  UpdateProductPatch,
} from '../../application/contracts/product';
import type { ProductStatus } from '../../domain/models/product';

/**
 * Клиент edge-диспетчера catalog-actions. Все мутации каталога уходят на сервер,
 * где атомарно выполняются PL/pgSQL-функциями (migrations/0011) с проверкой
 * владения магазином по actor из сессии.
 */
interface CatalogResponse {
  success?: boolean;
  result?: unknown;
  error?: string;
}

interface CatalogActionResult {
  productId?: string;
  variantId?: string;
  images?: Array<{ storage_key: string; thumb_storage_key: string | null }>;
  imageStorageKey?: string | null;
}

async function callCatalog(
  token: string,
  body: Record<string, unknown>,
): Promise<CatalogActionResult> {
  const { data, error } = await invokeFunction<CatalogResponse>('catalog-actions', { body, token });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Catalog action failed');
  return (data.result ?? {}) as CatalogActionResult;
}

function imagesPayload(images: ProductImageInput[]) {
  return images.map((i) => ({
    storage_key: i.storageKey,
    thumb_storage_key: i.thumbStorageKey ?? null,
  }));
}

function attributesPayload(rows: Array<{ name: string; value: string }>) {
  return rows.map((r) => ({ name: r.name, value: r.value }));
}

function variantPayload(v: NewVariantInput) {
  return {
    ...(v.id ? { id: v.id } : {}),
    name: v.name,
    value: v.value,
    available_quantity: v.availableQuantity,
    price_mode: v.priceMode ?? 'USE_PRODUCT_PRICE',
    custom_original_amount_minor: v.customOriginalAmountMinor ?? null,
    custom_discount_percent: v.customDiscountPercent ?? null,
  };
}

export async function createProduct(token: string, input: NewProductInput): Promise<void> {
  await callCatalog(token, {
    action: 'product-create',
    storeId: input.storeId,
    product: {
      title: input.title,
      description: input.description,
      category_id: input.categoryId,
      original_amount_minor: input.originalAmountMinor,
      discount_percent: input.discountPercent,
      status: input.status ?? 'ACTIVE',
    },
    images: imagesPayload(input.images),
    attributes: attributesPayload(input.attributes),
    linkAttributes: attributesPayload(input.linkAttributes),
    variants: input.variants.map(variantPayload),
  });
}

export async function updateProduct(
  token: string,
  productId: string,
  patch: UpdateProductPatch,
): Promise<void> {
  const p: Record<string, unknown> = {};
  if (patch.title !== undefined) p.title = patch.title;
  if (patch.description !== undefined) p.description = patch.description;
  if (patch.status !== undefined) p.status = patch.status;
  if (patch.categoryId !== undefined) p.category_id = patch.categoryId;
  if (patch.originalAmountMinor !== undefined) p.original_amount_minor = patch.originalAmountMinor;
  if (patch.discountPercent !== undefined) p.discount_percent = patch.discountPercent;
  if (patch.images !== undefined) p.images = imagesPayload(patch.images);
  if (patch.attributes !== undefined) p.attributes = attributesPayload(patch.attributes);
  if (patch.linkAttributes !== undefined)
    p.link_attributes = attributesPayload(patch.linkAttributes);
  if (patch.variants !== undefined) p.variants = patch.variants.map(variantPayload);
  await callCatalog(token, { action: 'product-update', productId, patch: p });
}

export async function createVariant(
  token: string,
  productId: string,
  variant: AddVariantInput,
): Promise<void> {
  await callCatalog(token, {
    action: 'variant-create',
    productId,
    variant: variantPayload(variant),
    baseOriginalAmountMinor: variant.baseOriginalAmountMinor ?? null,
    baseDiscountPercent: variant.baseDiscountPercent ?? null,
  });
}

export async function setStatus(
  token: string,
  productId: string,
  status: ProductStatus,
): Promise<void> {
  await callCatalog(token, { action: 'product-status', productId, status });
}

export async function deleteProduct(
  token: string,
  productId: string,
): Promise<Array<{ storageKey: string; thumbStorageKey: string | null }>> {
  const result = await callCatalog(token, { action: 'product-delete', productId });
  return (result.images ?? []).map((r) => ({
    storageKey: r.storage_key,
    thumbStorageKey: r.thumb_storage_key ?? null,
  }));
}

export async function deleteCategory(token: string, categoryId: string): Promise<string | null> {
  const result = await callCatalog(token, { action: 'category-delete', categoryId });
  return result.imageStorageKey ?? null;
}

/**
 * Перестановка категории на позицию 1..N (порядок отображения у покупателя).
 * Атомарно на сервере (`category_reorder_atomic`), владение магазином — по сессии.
 */
export async function reorderCategory(
  token: string,
  categoryId: string,
  position: number,
): Promise<void> {
  await callCatalog(token, { action: 'category-reorder', categoryId, position });
}

/** Связать два товара («Похожее»); связь двусторонняя, без транзитивности. */
export async function linkProduct(
  token: string,
  productId: string,
  targetId: string,
): Promise<void> {
  await callCatalog(token, { action: 'product-link-add', productId, targetId });
}

/** Убрать связь двух товаров. */
export async function unlinkProduct(
  token: string,
  productId: string,
  targetId: string,
): Promise<void> {
  await callCatalog(token, { action: 'product-link-remove', productId, targetId });
}
