import { calcSalePrice } from '../../domain/rules/product-rules';
import type {
  Product,
  ProductCharacteristic,
  ProductVariant,
} from '../../domain/models/product';
import { insforge } from '../insforge/client';

interface ProductVariantRow {
  id: string;
  product_id: string;
  size: string;
  stock_quantity: number;
}

interface ProductCharacteristicRow {
  id: string;
  product_id: string;
  label: string;
  value: string;
}

interface ProductRow {
  id: string;
  store_id: string;
  title: string;
  description: string;
  price: number;
  old_price: number | null;
  category_id: string | null;
  image_url: string;
  image_urls: string[];
  created_at: string;
  product_variants?: ProductVariantRow[];
  product_characteristics?: ProductCharacteristicRow[];
}

export interface ProductCatalog {
  products: Product[];
  variants: ProductVariant[];
  characteristics: ProductCharacteristic[];
}

function mapVariant(row: ProductVariantRow): ProductVariant {
  return {
    id: row.id,
    productId: row.product_id,
    size: row.size,
    stockQuantity: row.stock_quantity,
  };
}

function mapCharacteristic(row: ProductCharacteristicRow): ProductCharacteristic {
  return {
    id: row.id,
    productId: row.product_id,
    label: row.label,
    value: row.value,
  };
}

function deriveDiscountPercent(price: number, oldPrice: number | null): number {
  // TODO (этап карточек товара): миграция БД — колонка products.discount_percent,
  // чтобы % хранился явно для редактирования. Сейчас выводится из price/old_price,
  // т.к. колонки в схеме пока нет.
  if (!oldPrice || oldPrice <= 0) return 0;
  return ((oldPrice - price) / oldPrice) * 100;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    storeId: row.store_id,
    title: row.title,
    description: row.description ?? '',
    price: Number(row.price),
    oldPrice: row.old_price == null ? null : Number(row.old_price),
    discountPercent: deriveDiscountPercent(Number(row.price), row.old_price == null ? null : Number(row.old_price)),
    categoryId: row.category_id,
    imageUrl: row.image_url ?? '',
    imageUrls: row.image_urls ?? [],
    createdAt: row.created_at,
  };
}

function splitCatalog(rows: ProductRow[]): ProductCatalog {
  const products: Product[] = [];
  const variants: ProductVariant[] = [];
  const characteristics: ProductCharacteristic[] = [];
  for (const row of rows) {
    products.push(mapProduct(row));
    for (const v of row.product_variants ?? []) variants.push(mapVariant(v));
    for (const c of row.product_characteristics ?? []) characteristics.push(mapCharacteristic(c));
  }
  return { products, variants, characteristics };
}

/** Весь каталог витрины одним запросом */
export async function fetchCatalog(storeId: string): Promise<ProductCatalog> {
  const { data, error } = await insforge.database
    .from('products')
    .select('*, product_variants(*), product_characteristics(*)')
    .eq('store_id', storeId);
  if (error) throw error;
  return splitCatalog((data ?? []) as ProductRow[]);
}

export interface NewProductInput {
  storeId: string;
  title: string;
  description: string;
  /** Изначальная цена (истина) — ляжет в old_price */
  originalPrice: number;
  /** % скидки — цена продажи считается через calcSalePrice, без округлений */
  discountPercent: number;
  categoryId: string | null;
  imageUrls: string[];
  variants: Array<{ size: string; stockQuantity: number }>;
  characteristics: Array<{ label: string; value: string }>;
}

export async function addProduct(input: NewProductInput): Promise<Product> {
  const salePrice = calcSalePrice(input.originalPrice, input.discountPercent);
  const { data, error } = await insforge.database
    .from('products')
    .insert({
      store_id: input.storeId,
      title: input.title,
      description: input.description,
      price: salePrice,
      old_price: input.originalPrice,
      category_id: input.categoryId,
      image_url: input.imageUrls[0] ?? '',
      image_urls: input.imageUrls,
    })
    .select();
  if (error) throw error;
  const row = (data ?? [])[0] as ProductRow | undefined;
  if (!row) throw new Error('Product insert returned no data');

  if (input.variants.length) {
    const { error: vError } = await insforge.database.from('product_variants').insert(
      input.variants.map((v) => ({
        product_id: row.id,
        size: v.size,
        stock_quantity: v.stockQuantity,
      })),
    );
    if (vError) throw vError;
  }
  if (input.characteristics.length) {
    const { error: cError } = await insforge.database.from('product_characteristics').insert(
      input.characteristics.map((c) => ({
        product_id: row.id,
        label: c.label,
        value: c.value,
      })),
    );
    if (cError) throw cError;
  }
  return mapProduct(row);
}

export interface UpdateProductPatch {
  title?: string;
  description?: string;
  originalPrice?: number;
  discountPercent?: number;
  categoryId?: string | null;
  imageUrls?: string[];
  variants?: Array<{ size: string; stockQuantity: number }>;
  characteristics?: Array<{ label: string; value: string }>;
}

export async function updateProduct(id: string, patch: UpdateProductPatch): Promise<Product> {
  const { data: currentData, error: currentError } = await insforge.database
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (currentError) throw currentError;
  const current = currentData as ProductRow | null;
  if (!current) throw new Error('Product not found');

  const values: Record<string, unknown> = {};
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.categoryId !== undefined) values.category_id = patch.categoryId;
  if (patch.imageUrls !== undefined) {
    values.image_urls = patch.imageUrls;
    values.image_url = patch.imageUrls[0] ?? '';
  }
  if (patch.originalPrice !== undefined || patch.discountPercent !== undefined) {
    const original = patch.originalPrice ?? Number(current.old_price ?? current.price);
    const discount =
      patch.discountPercent ?? deriveDiscountPercent(Number(current.price), Number(current.old_price));
    values.old_price = original;
    values.price = calcSalePrice(original, discount);
  }

  if (Object.keys(values).length) {
    const { error } = await insforge.database.from('products').update(values).eq('id', id);
    if (error) throw error;
  }
  if (patch.variants !== undefined) {
    const { error: delError } = await insforge.database
      .from('product_variants')
      .delete()
      .eq('product_id', id);
    if (delError) throw delError;
    if (patch.variants.length) {
      const { error: insError } = await insforge.database.from('product_variants').insert(
        patch.variants.map((v) => ({
          product_id: id,
          size: v.size,
          stock_quantity: v.stockQuantity,
        })),
      );
      if (insError) throw insError;
    }
  }
  if (patch.characteristics !== undefined) {
    const { error: delError } = await insforge.database
      .from('product_characteristics')
      .delete()
      .eq('product_id', id);
    if (delError) throw delError;
    if (patch.characteristics.length) {
      const { error: insError } = await insforge.database
        .from('product_characteristics')
        .insert(
          patch.characteristics.map((c) => ({
            product_id: id,
            label: c.label,
            value: c.value,
          })),
        );
      if (insError) throw insError;
    }
  }

  const { data, error } = await insforge.database
    .from('products')
    .select('*, product_variants(*), product_characteristics(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  const row = data as ProductRow | null;
  if (!row) throw new Error('Product not found after update');
  return mapProduct(row);
}

/** Варианты/характеристики удаляются каскадом (FK ON DELETE CASCADE) */
export async function removeProduct(id: string): Promise<void> {
  const { error } = await insforge.database.from('products').delete().eq('id', id);
  if (error) throw error;
}
