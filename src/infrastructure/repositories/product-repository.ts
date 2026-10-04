import { insforge } from '../insforge/client';
import type {
  Inventory,
  Product,
  ProductAttribute,
  ProductImage,
  ProductLink,
  ProductLinkAttribute,
  ProductStatus,
  Variant,
  VariantPriceMode,
  VariantStatus,
} from '../../domain/models/product';
import {
  ProductStatusError,
  type ProductStatusErrorCode,
} from '../../application/contracts/product-status';
import type {
  AddVariantInput,
  NewProductInput,
  NewVariantInput,
  ProductCatalog,
  UpdateProductPatch,
  VariantStockPatch,
} from '../../application/contracts/product';
import {
  createProduct as createProductViaApi,
  updateProduct as updateProductViaApi,
  createVariant as createVariantViaApi,
  setStatus as setStatusViaApi,
  deleteProduct as deleteProductViaApi,
  linkProduct as linkProductViaApi,
  unlinkProduct as unlinkProductViaApi,
} from '../functions/catalog-api';

interface ProductImageRow {
  id: string;
  product_id: string;
  storage_key: string;
  thumb_storage_key: string | null;
  sort_order: number;
}

interface ProductAttributeRow {
  id: string;
  product_id: string;
  name: string;
  value: string;
  sort_order: number;
}

interface ProductLinkAttributeRow {
  id: string;
  product_id: string;
  name: string;
  value: string;
  sort_order: number;
}

interface InventoryRow {
  variant_id: string;
  available_quantity: number;
  held_quantity: number;
}

interface ProductLinkRow {
  id: string;
  store_id: string;
  product_id: string;
  related_product_id: string;
  created_at: string;
}

interface VariantRow {
  id: string;
  product_id: string;
  name: string;
  value: string;
  sort_order: number;
  status: VariantStatus;
  price_mode: VariantPriceMode;
  custom_original_amount_minor: number | null;
  custom_discount_percent: number | null;
  inventory?: InventoryRow | InventoryRow[] | null;
}

interface ProductRow {
  id: string;
  store_id: string;
  product_group_id: string | null;
  category_id: string | null;
  title: string;
  description: string;
  status: ProductStatus;
  sort_order: number;
  original_amount_minor: number;
  discount_percent: number;
  created_at: string;
  updated_at: string;
  product_images?: ProductImageRow[];
  product_attributes?: ProductAttributeRow[];
  product_link_attributes?: ProductLinkAttributeRow[];
  variants?: VariantRow[];
}

function mapInventory(row: InventoryRow): Inventory {
  return {
    variantId: row.variant_id,
    availableQuantity: row.available_quantity,
    heldQuantity: row.held_quantity,
  };
}

function mapVariant(row: VariantRow): Variant {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    value: row.value,
    sortOrder: row.sort_order,
    status: row.status,
    priceMode: row.price_mode,
    customOriginalAmountMinor: row.custom_original_amount_minor ?? null,
    customDiscountPercent: row.custom_discount_percent ?? null,
  };
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    storeId: row.store_id,
    productGroupId: row.product_group_id ?? null,
    categoryId: row.category_id ?? null,
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    sortOrder: row.sort_order ?? 0,
    originalAmountMinor: Number(row.original_amount_minor ?? 0),
    discountPercent: row.discount_percent ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function pickInventory(row: VariantRow): InventoryRow | null {
  const inv = row.inventory;
  if (!inv) return null;
  return Array.isArray(inv) ? (inv[0] ?? null) : inv;
}

function mapProductLink(row: ProductLinkRow): ProductLink {
  return {
    id: row.id,
    storeId: row.store_id,
    productId: row.product_id,
    relatedProductId: row.related_product_id,
    createdAt: row.created_at,
  };
}

function splitCatalog(rows: ProductRow[]): ProductCatalog {
  const products: Product[] = [];
  const variants: Variant[] = [];
  const inventories: Inventory[] = [];
  const images: ProductImage[] = [];
  const attributes: ProductAttribute[] = [];
  const linkAttributes: ProductLinkAttribute[] = [];

  for (const row of rows) {
    products.push(mapProduct(row));
    for (const i of row.product_images ?? []) {
      images.push({
        id: i.id,
        productId: i.product_id,
        storageKey: i.storage_key,
        thumbStorageKey: i.thumb_storage_key ?? null,
        sortOrder: i.sort_order,
      });
    }
    for (const a of row.product_attributes ?? []) {
      attributes.push({
        id: a.id,
        productId: a.product_id,
        name: a.name,
        value: a.value,
        sortOrder: a.sort_order,
      });
    }
    for (const l of row.product_link_attributes ?? []) {
      linkAttributes.push({
        id: l.id,
        productId: l.product_id,
        name: l.name,
        value: l.value,
        sortOrder: l.sort_order,
      });
    }
    for (const v of row.variants ?? []) {
      variants.push(mapVariant(v));
      const inv = pickInventory(v);
      if (inv) inventories.push(mapInventory(inv));
    }
  }

  return { products, variants, inventories, images, attributes, linkAttributes, productLinks: [] };
}

/** Весь каталог витрины одним запросом (без N+1). */
export async function fetchCatalog(storeId: string): Promise<ProductCatalog> {
  const [{ data, error }, linksResult] = await Promise.all([
    insforge.database
      .from('products')
      .select(
        '*, product_images(*), product_attributes(*), product_link_attributes(*), variants(*, inventory(*))',
      )
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    insforge.database.from('product_links').select('*').eq('store_id', storeId),
  ]);
  if (error) throw error;
  if (linksResult.error) throw linksResult.error;
  const catalog = splitCatalog((data ?? []) as ProductRow[]);
  catalog.productLinks = ((linksResult.data ?? []) as ProductLinkRow[]).map(mapProductLink);
  return catalog;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

async function insertVariants(productId: string, variants: NewVariantInput[]): Promise<void> {
  if (!variants.length) return;
  const { data: variantRows, error } = await insforge.database
    .from('variants')
    .insert(
      variants.map((v, index) => ({
        product_id: productId,
        name: v.name,
        value: v.value,
        normalized_value: normalize(v.value),
        sort_order: index,
        price_mode: v.priceMode ?? 'USE_PRODUCT_PRICE',
        custom_original_amount_minor: v.customOriginalAmountMinor ?? null,
        custom_discount_percent: v.customDiscountPercent ?? null,
      })),
    )
    .select();
  if (error) throw error;

  const inventoryRows = ((variantRows ?? []) as Array<{ id: string }>).map((row, index) => ({
    variant_id: row.id,
    available_quantity: variants[index]?.availableQuantity ?? 0,
    held_quantity: 0,
  }));
  if (inventoryRows.length) {
    const { error: invError } = await insforge.database.from('inventory').insert(inventoryRows);
    if (invError) throw invError;
  }
}

export async function addProduct(input: NewProductInput, token: string | null): Promise<void> {
  if (token) {
    await createProductViaApi(token, input);
    return;
  }
  const status = input.status ?? 'ACTIVE';
  const { data, error } = await insforge.database
    .from('products')
    .insert({
      store_id: input.storeId,
      title: input.title,
      description: input.description,
      category_id: input.categoryId,
      original_amount_minor: input.originalAmountMinor,
      discount_percent: input.discountPercent,
      status,
      archived_at: status === 'ARCHIVED' ? new Date().toISOString() : null,
    })
    .select();
  if (error) throw error;
  const row = (data ?? [])[0] as ProductRow | undefined;
  if (!row) throw new Error('Product insert returned no data');

  if (input.images.length) {
    const { error: imgError } = await insforge.database.from('product_images').insert(
      input.images.map((image, index) => ({
        product_id: row.id,
        storage_key: image.storageKey,
        thumb_storage_key: image.thumbStorageKey ?? null,
        sort_order: index,
      })),
    );
    if (imgError) throw imgError;
  }
  if (input.attributes.length) {
    const { error: attrError } = await insforge.database.from('product_attributes').insert(
      input.attributes.map((a, index) => ({
        product_id: row.id,
        name: a.name,
        value: a.value,
        sort_order: index,
      })),
    );
    if (attrError) throw attrError;
  }
  if (input.linkAttributes.length) {
    const { error: linkError } = await insforge.database.from('product_link_attributes').insert(
      input.linkAttributes.map((l, index) => ({
        product_id: row.id,
        name: l.name,
        value: l.value,
        sort_order: index,
      })),
    );
    if (linkError) throw linkError;
  }
  await insertVariants(row.id, input.variants);
}

export async function updateProduct(
  id: string,
  patch: UpdateProductPatch,
  token: string | null,
): Promise<void> {
  if (token) {
    await updateProductViaApi(token, id, patch);
    return;
  }
  const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.status !== undefined) values.status = patch.status;
  if (patch.categoryId !== undefined) values.category_id = patch.categoryId;
  if (patch.originalAmountMinor !== undefined)
    values.original_amount_minor = patch.originalAmountMinor;
  if (patch.discountPercent !== undefined) values.discount_percent = patch.discountPercent;

  const { error } = await insforge.database.from('products').update(values).eq('id', id);
  if (error) throw error;

  if (patch.images !== undefined) {
    const { error: delError } = await insforge.database
      .from('product_images')
      .delete()
      .eq('product_id', id);
    if (delError) throw delError;
    if (patch.images.length) {
      const { error: insError } = await insforge.database.from('product_images').insert(
        patch.images.map((image, index) => ({
          product_id: id,
          storage_key: image.storageKey,
          thumb_storage_key: image.thumbStorageKey ?? null,
          sort_order: index,
        })),
      );
      if (insError) throw insError;
    }
  }
  if (patch.attributes !== undefined) {
    const { error: delError } = await insforge.database
      .from('product_attributes')
      .delete()
      .eq('product_id', id);
    if (delError) throw delError;
    if (patch.attributes.length) {
      const { error: insError } = await insforge.database.from('product_attributes').insert(
        patch.attributes.map((a, index) => ({
          product_id: id,
          name: a.name,
          value: a.value,
          sort_order: index,
        })),
      );
      if (insError) throw insError;
    }
  }
  if (patch.linkAttributes !== undefined) {
    const { error: delError } = await insforge.database
      .from('product_link_attributes')
      .delete()
      .eq('product_id', id);
    if (delError) throw delError;
    if (patch.linkAttributes.length) {
      const { error: insError } = await insforge.database.from('product_link_attributes').insert(
        patch.linkAttributes.map((l, index) => ({
          product_id: id,
          name: l.name,
          value: l.value,
          sort_order: index,
        })),
      );
      if (insError) throw insError;
    }
  }
  if (patch.variants !== undefined) {
    const { error: delError } = await insforge.database
      .from('variants')
      .delete()
      .eq('product_id', id);
    if (delError) throw delError;
    await insertVariants(id, patch.variants);
  }
}

/** Прямое редактирование остатков варианта (контроль остатков). 02 §4 */
export async function updateVariantStock(
  variantId: string,
  patch: VariantStockPatch,
): Promise<void> {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.availableQuantity !== undefined) {
    updateData.available_quantity = Math.max(0, Math.round(patch.availableQuantity));
  }
  if (patch.heldQuantity !== undefined) {
    updateData.held_quantity = Math.max(0, Math.round(patch.heldQuantity));
  }
  const { error } = await insforge.database
    .from('inventory')
    .update(updateData)
    .eq('variant_id', variantId);
  if (error) throw error;
}

/** Быстрое добавление одного варианта из «Контроля остатков»: variants + inventory. */
export async function addVariantToProduct(
  productId: string,
  variant: AddVariantInput,
  token: string | null,
): Promise<void> {
  if (token) {
    await createVariantViaApi(token, productId, variant);
    return;
  }
  const { data: maxData, error: maxError } = await insforge.database
    .from('variants')
    .select('sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (maxError) throw maxError;
  const maxIndex = (maxData ?? [])[0] as { sort_order: number } | undefined;
  const isFirst = !maxIndex;

  const { data, error } = await insforge.database
    .from('variants')
    .insert({
      product_id: productId,
      name: variant.name,
      value: variant.value,
      normalized_value: normalize(variant.value),
      sort_order: (maxIndex?.sort_order ?? -1) + 1,
      price_mode: variant.priceMode ?? 'USE_PRODUCT_PRICE',
      custom_original_amount_minor: variant.customOriginalAmountMinor ?? null,
      custom_discount_percent: variant.customDiscountPercent ?? null,
    })
    .select();
  if (error) throw error;
  const row = (data ?? [])[0] as VariantRow | undefined;
  if (!row) throw new Error('Variant insert returned no data');

  const { error: invError } = await insforge.database.from('inventory').insert({
    variant_id: row.id,
    available_quantity: Math.max(0, Math.round(variant.availableQuantity ?? 0)),
    held_quantity: 0,
  });
  if (invError) throw invError;

  // Первый вариант задаёт базовую цену/скидку товара (без вариантов товар — только архив).
  if (isFirst && variant.baseOriginalAmountMinor !== undefined) {
    const { error: productError } = await insforge.database
      .from('products')
      .update({
        original_amount_minor: variant.baseOriginalAmountMinor,
        discount_percent: variant.baseDiscountPercent ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);
    if (productError) throw productError;
  }
}

/** Код ошибки смены статуса из ответа edge-диспетчера. */
function mapStatusError(error: unknown): ProductStatusErrorCode {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('NO_ACTIVE_VARIANT')) return 'NO_ACTIVE_VARIANT';
  if (message.includes('PRODUCT_NOT_FOUND')) return 'NOT_FOUND';
  return 'UNKNOWN';
}

/**
 * Архив-first: товар помечается ARCHIVED, остаётся в истории заказов. 03 §27
 * ADR-06.8: вернуть на витрину (ACTIVE) можно только при ≥1 активном варианте.
 * Бросает `ProductStatusError` с машинным кодом.
 */
export async function setProductStatus(
  id: string,
  status: ProductStatus,
  token: string | null,
): Promise<void> {
  if (token) {
    try {
      await setStatusViaApi(token, id, status);
    } catch (e) {
      throw new ProductStatusError(mapStatusError(e), (e as Error).message);
    }
    return;
  }
  const { data: found, error: findError } = await insforge.database
    .from('products')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (findError) throw findError;
  if (!found) throw new ProductStatusError('NOT_FOUND', 'Товар не найден');

  if (status === 'ACTIVE') {
    const { data: activeVariants, error: variantsError } = await insforge.database
      .from('variants')
      .select('id')
      .eq('product_id', id)
      .eq('status', 'ACTIVE')
      .limit(1);
    if (variantsError) throw variantsError;
    if (!activeVariants || activeVariants.length === 0) {
      throw new ProductStatusError(
        'NO_ACTIVE_VARIANT',
        'Нельзя выставить на витрину товар без варианта покупки',
      );
    }
  }

  const { error } = await insforge.database
    .from('products')
    .update({ status, archived_at: status === 'ARCHIVED' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Постоянное удаление — только для товара из архива. 03 §27
 * Возвращает storage-ключи фото (full+thumb), чтобы вызывающий очистил Storage
 * (не зависит от того, загружен ли каталог в стейт).
 */
export async function deleteProduct(
  id: string,
  token: string | null,
): Promise<Array<{ storageKey: string; thumbStorageKey: string | null }>> {
  if (token) {
    return deleteProductViaApi(token, id);
  }
  const { data, error } = await insforge.database
    .from('products')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if ((data as { status?: ProductStatus } | null)?.status !== 'ARCHIVED') {
    throw new Error('Товар можно удалить только из архива');
  }

  const { data: images, error: imagesError } = await insforge.database
    .from('product_images')
    .select('storage_key, thumb_storage_key')
    .eq('product_id', id);
  if (imagesError) throw imagesError;

  const { error: delError } = await insforge.database.from('products').delete().eq('id', id);
  if (delError) throw delError;

  return ((images ?? []) as Array<{ storage_key: string; thumb_storage_key: string | null }>).map(
    (row) => ({ storageKey: row.storage_key, thumbStorageKey: row.thumb_storage_key }),
  );
}

/** Каноничный порядок пары (product_id < related_product_id) — один ряд на связь. */
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Связать два товара («Похожее»); двусторонне, без транзитивности. */
export async function linkProducts(
  productId: string,
  targetId: string,
  token: string | null,
): Promise<void> {
  if (token) {
    await linkProductViaApi(token, productId, targetId);
    return;
  }
  if (productId === targetId) throw new Error('SELF_LINK');
  const { data, error } = await insforge.database
    .from('products')
    .select('id, store_id')
    .in('id', [productId, targetId]);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string; store_id: string }>;
  if (rows.length !== 2) throw new Error('PRODUCT_NOT_FOUND');
  if (rows[0]?.store_id !== rows[1]?.store_id) throw new Error('SAME_STORE_REQUIRED');

  const [a, b] = canonicalPair(productId, targetId);
  const { data: existing, error: findError } = await insforge.database
    .from('product_links')
    .select('id')
    .eq('product_id', a)
    .eq('related_product_id', b)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return;

  const { error: insError } = await insforge.database
    .from('product_links')
    .insert({ store_id: rows[0]?.store_id, product_id: a, related_product_id: b });
  if (insError) throw insError;
}

/** Убрать связь двух товаров. */
export async function unlinkProducts(
  productId: string,
  targetId: string,
  token: string | null,
): Promise<void> {
  if (token) {
    await unlinkProductViaApi(token, productId, targetId);
    return;
  }
  const [a, b] = canonicalPair(productId, targetId);
  const { error } = await insforge.database
    .from('product_links')
    .delete()
    .eq('product_id', a)
    .eq('related_product_id', b);
  if (error) throw error;
}
