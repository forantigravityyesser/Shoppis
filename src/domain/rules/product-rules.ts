import { MAX_IMAGES } from '../constants/limits';
import type { Product, Variant } from '../models/product';

/**
 * Текущая цена в minor units: round(original * (100 - discount) / 100). 03 §10
 * Единая точка формулы, без float-арифметики на границах.
 */
export function currentPriceMinor(originalAmountMinor: number, discountPercent: number): number {
  if (!discountPercent) return originalAmountMinor;
  return Math.round((originalAmountMinor * (100 - discountPercent)) / 100);
}

export interface EffectivePrice {
  originalAmountMinor: number;
  discountPercent: number;
  currentAmountMinor: number;
}

/**
 * Цена позиции: вариант с CUSTOM_PRICE переопределяет цену товара. 02 §3, 03 §9.
 */
export function effectivePrice(
  variant: Pick<Variant, 'priceMode' | 'customOriginalAmountMinor' | 'customDiscountPercent'>,
  product: Pick<Product, 'originalAmountMinor' | 'discountPercent'>,
): EffectivePrice {
  const useCustom = variant.priceMode === 'CUSTOM_PRICE' && variant.customOriginalAmountMinor != null;
  const originalAmountMinor = useCustom ? (variant.customOriginalAmountMinor as number) : product.originalAmountMinor;
  const discountPercent = useCustom ? (variant.customDiscountPercent ?? 0) : product.discountPercent;
  return {
    originalAmountMinor,
    discountPercent,
    currentAmountMinor: currentPriceMinor(originalAmountMinor, discountPercent),
  };
}

export function validateProduct(input: {
  title: string;
  originalAmountMinor: number;
  discountPercent: number;
  imageCount: number;
}): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('Название товара обязательно');
  if (!(input.originalAmountMinor > 0)) errors.push('Цена должна быть больше нуля');
  if (input.discountPercent < 0 || input.discountPercent > 100)
    errors.push('Скидка должна быть от 0 до 100%');
  if (input.imageCount > MAX_IMAGES) errors.push(`Максимум ${MAX_IMAGES} изображений`);
  return errors;
}

export function isInStock(availableQuantity: number): boolean {
  return availableQuantity > 0;
}

/** Только для отображения. Minor units → человекочитаемая строка. */
export function formatMoneyMinor(minor: number, symbol: string): string {
  const value = String(Number((minor / 100).toFixed(2)));
  return symbol ? `${value} ${symbol}` : value;
}
