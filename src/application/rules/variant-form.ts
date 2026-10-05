/**
 * Модель варианта товара для формы создания/редактирования.
 *
 * Наследование цены/скидки от базового (первого) варианта задаётся ЯВНО режимом
 * INHERITED/CUSTOM. Пустое значение поля — это временное состояние редактирования,
 * а не признак наследования (docs/19 §14–§22).
 */

export type InheritanceMode = 'INHERITED' | 'CUSTOM';

export interface VariantForm {
  /** id существующего варианта (при редактировании); новые варианты его не имеют. */
  id?: string;
  name: string;
  value: string;
  quantity: string;
  price: string;
  discount: string;
  priceMode: InheritanceMode;
  discountMode: InheritanceMode;
}

export function emptyVariant(): VariantForm {
  return {
    name: '',
    value: '',
    quantity: '0',
    price: '',
    discount: '',
    priceMode: 'INHERITED',
    discountMode: 'INHERITED',
  };
}

/** Новый вариант, предзаполненный значениями базового (наследование по умолчанию). */
export function variantFromBase(base?: VariantForm): VariantForm {
  return {
    ...emptyVariant(),
    name: base?.name ?? '',
    price: base?.price ?? '',
    discount: base?.discount ?? '',
  };
}

/**
 * Пересчитывает inherited-поля от базового (первого) варианта.
 * Единственное место, где применяется наследование; CUSTOM-поля не трогает.
 */
export function syncInherited(list: VariantForm[]): VariantForm[] {
  const base = list[0];
  if (!base) return list;
  return list.map((variant, index) =>
    index === 0
      ? variant
      : {
          ...variant,
          price: variant.priceMode === 'CUSTOM' ? variant.price : base.price,
          discount: variant.discountMode === 'CUSTOM' ? variant.discount : base.discount,
        },
  );
}

function patchVariant(
  list: VariantForm[],
  index: number,
  patch: Partial<VariantForm>,
): VariantForm[] {
  return syncInherited(list.map((v, i) => (i === index ? { ...v, ...patch } : v)));
}

/** Правка поля без смены режима (значение/остаток). */
export function updateVariantField(
  list: VariantForm[],
  index: number,
  patch: Partial<VariantForm>,
): VariantForm[] {
  return patchVariant(list, index, patch);
}

/** Правка названия размерности: у варианта собственное имя, синхронизации нет. */
export function setVariantName(list: VariantForm[], index: number, value: string): VariantForm[] {
  return patchVariant(list, index, { name: value });
}

/**
 * Правка цены. Для небазового варианта это явный переход в CUSTOM;
 * пустая строка остаётся CUSTOM (docs/19 §17).
 */
export function setVariantPrice(list: VariantForm[], index: number, value: string): VariantForm[] {
  return patchVariant(
    list,
    index,
    index === 0 ? { price: value } : { price: value, priceMode: 'CUSTOM' },
  );
}

export function setVariantDiscount(
  list: VariantForm[],
  index: number,
  value: string,
): VariantForm[] {
  return patchVariant(
    list,
    index,
    index === 0 ? { discount: value } : { discount: value, discountMode: 'CUSTOM' },
  );
}

/** Явный возврат к наследованию цены/скидки от варианта 1 (docs/19 §18). */
export function inheritVariantField(
  list: VariantForm[],
  index: number,
  field: 'price' | 'discount',
): VariantForm[] {
  return patchVariant(
    list,
    index,
    field === 'price' ? { priceMode: 'INHERITED' } : { discountMode: 'INHERITED' },
  );
}

export function parsePriceMinor(value: string): number {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

export function parseDiscountPercent(value: string): number {
  const n = Number(value.replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Эффективная цена варианта до скидки: CUSTOM → своя, INHERITED → базовая товара. */
export function variantEffectivePriceMinor(variant: VariantForm, basePriceMinor: number): number {
  return variant.priceMode === 'CUSTOM' ? parsePriceMinor(variant.price) : basePriceMinor;
}

export function variantEffectiveDiscount(variant: VariantForm, baseDiscountPercent: number): number {
  return variant.discountMode === 'CUSTOM'
    ? parseDiscountPercent(variant.discount)
    : baseDiscountPercent;
}

/**
 * Валидация публикации по эффективному бизнес-состоянию (docs/19 §22):
 * первый заполненный вариант задаёт цену товара; CUSTOM-цена не может быть пустой/нулевой.
 */
export function validateVariantsForPublish(variants: VariantForm[]): string[] {
  const filled = variants.filter((v) => v.value.trim());
  if (!filled.length) return ['Добавьте хотя бы один вариант выбора'];

  const errors: string[] = [];
  const base = filled[0];
  if (parsePriceMinor(base.price) <= 0) errors.push('Укажите цену товара');

  filled.forEach((variant, index) => {
    if (index === 0) return;
    if (variant.priceMode === 'CUSTOM' && parsePriceMinor(variant.price) <= 0) {
      errors.push(`Укажите свою цену для варианта ${index + 1}`);
    }
  });
  return errors;
}
