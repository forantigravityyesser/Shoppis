import { MAX_IMAGES } from '../constants/limits';
import type { Product } from '../models/product';

/**
 * Цена продажи из изначальной цены и % скидки.
 * Округлений нет — истина продавца хранится как есть.
 */
export function calcSalePrice(originalPrice: number, discountPercent: number): number {
  if (!discountPercent) return originalPrice;
  return originalPrice - (originalPrice * discountPercent) / 100;
}

export function validateProduct(
  input: Pick<Product, 'title' | 'price' | 'discountPercent' | 'imageUrls'>,
): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('Название товара обязательно');
  if (!(input.price > 0)) errors.push('Цена должна быть больше нуля');
  if (input.discountPercent < 0 || input.discountPercent > 100)
    errors.push('Скидка должна быть от 0 до 100%');
  if (input.imageUrls.length > MAX_IMAGES)
    errors.push(`Максимум ${MAX_IMAGES} изображений`);
  return errors;
}

export function isInStock(stockQuantity: number): boolean {
  return stockQuantity > 0;
}

/** Только для отображения — данные не меняет */
export function formatMoney(value: number, symbol: string): string {
  const trimmed = String(Number(value.toFixed(2)));
  return symbol ? `${trimmed} ${symbol}` : trimmed;
}
