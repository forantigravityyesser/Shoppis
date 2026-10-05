import { describe, expect, it } from 'vitest';
import {
  emptyVariant,
  inheritVariantField,
  parseDiscountPercent,
  parsePriceMinor,
  setVariantDiscount,
  setVariantName,
  setVariantPrice,
  validateVariantsForPublish,
  variantEffectiveDiscount,
  variantEffectivePriceMinor,
  variantFromBase,
  updateVariantField,
  type VariantForm,
} from './variant-form';

function makeBase(overrides: Partial<VariantForm> = {}): VariantForm {
  return {
    ...emptyVariant(),
    name: 'Размер',
    value: 'M',
    price: '1900',
    discount: '0',
    ...overrides,
  };
}

function makeList(baseOverrides: Partial<VariantForm> = {}): VariantForm[] {
  const base = makeBase(baseOverrides);
  return [base, variantFromBase(base)];
}

describe('наследование варианта (docs/19 §14–§23)', () => {
  it('Тест 1 — INHERITED-вариант следует за базовой ценой', () => {
    let list = makeList();
    expect(list[1].priceMode).toBe('INHERITED');

    list = setVariantPrice(list, 0, '2000');

    expect(list[1].priceMode).toBe('INHERITED');
    expect(list[1].price).toBe('2000');
    expect(variantEffectivePriceMinor(list[1], parsePriceMinor(list[0].price))).toBe(200_000);
  });

  it('INHERITED-вариант следует за базовой скидкой', () => {
    let list = makeList();
    list = setVariantDiscount(list, 0, '15');
    expect(list[1].discountMode).toBe('INHERITED');
    expect(list[1].discount).toBe('15');
    expect(variantEffectiveDiscount(list[1], parseDiscountPercent(list[0].discount))).toBe(15);
  });

  it('Тест 2 — правка цены переводит вариант в CUSTOM', () => {
    let list = makeList();
    list = setVariantPrice(list, 1, '2200');
    expect(list[1].priceMode).toBe('CUSTOM');
    expect(list[1].price).toBe('2200');
  });

  it('Тест 3 — очистка поля НЕ возвращает наследование', () => {
    let list = makeList();
    list = setVariantPrice(list, 1, '2200');
    list = setVariantPrice(list, 1, '');
    expect(list[1].priceMode).toBe('CUSTOM');
    expect(list[1].price).toBe('');
  });

  it('Тест 4 — ввод после очистки работает', () => {
    let list = makeList();
    list = setVariantPrice(list, 1, '2200');
    list = setVariantPrice(list, 1, '');
    list = setVariantPrice(list, 1, '2');
    expect(list[1].priceMode).toBe('CUSTOM');
    expect(list[1].price).toBe('2');
  });

  it('Тест 5 — CUSTOM-цена переживает изменение базовой', () => {
    let list = makeList();
    list = setVariantPrice(list, 1, '2200');
    list = setVariantPrice(list, 0, '2000');
    expect(list[1].priceMode).toBe('CUSTOM');
    expect(list[1].price).toBe('2200');
  });

  it('Тест 6 — пустая CUSTOM-цена не проходит валидацию публикации', () => {
    let list = makeList();
    list = updateVariantField(list, 1, { value: 'L' });
    list = setVariantPrice(list, 1, '2200');
    list = setVariantPrice(list, 1, '');
    expect(validateVariantsForPublish(list)).toContain('Укажите свою цену для варианта 2');
  });

  it('явный возврат к наследованию подтягивает базовую цену', () => {
    let list = makeList();
    list = setVariantPrice(list, 1, '2200');
    list = inheritVariantField(list, 1, 'price');
    expect(list[1].priceMode).toBe('INHERITED');
    expect(list[1].price).toBe(list[0].price);
  });

  it('имя размерности не синхронизируется между вариантами', () => {
    let list = makeList();
    list = setVariantName(list, 1, 'Особый размер');
    list = setVariantName(list, 0, 'Объём');
    expect(list[0].name).toBe('Объём');
    expect(list[1].name).toBe('Особый размер');
  });
});

describe('validateVariantsForPublish', () => {
  it('требует хотя бы один заполненный вариант', () => {
    expect(validateVariantsForPublish([emptyVariant()])).toContain(
      'Добавьте хотя бы один вариант выбора',
    );
  });

  it('требует цену товара у базового варианта', () => {
    expect(validateVariantsForPublish([makeBase({ price: '' })])).toContain('Укажите цену товара');
  });

  it('принимает корректный набор', () => {
    expect(validateVariantsForPublish(makeList())).toEqual([]);
  });
});

describe('парсинг значений', () => {
  it('parsePriceMinor принимает запятую и отбрасывает неположительные', () => {
    expect(parsePriceMinor('19,90')).toBe(1990);
    expect(parsePriceMinor('0')).toBe(0);
    expect(parsePriceMinor('')).toBe(0);
  });

  it('parseDiscountPercent ограничивает 0..100', () => {
    expect(parseDiscountPercent('15')).toBe(15);
    expect(parseDiscountPercent('150')).toBe(100);
    expect(parseDiscountPercent('-3')).toBe(0);
  });
});
