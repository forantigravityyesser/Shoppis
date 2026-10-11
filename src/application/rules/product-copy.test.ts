import { describe, expect, it } from 'vitest';
import { createProductCopy, hasCopyableContent, type ProductCopySource } from './product-copy';
import type { VariantForm } from './variant-form';

function variant(overrides: Partial<VariantForm> = {}): VariantForm {
  return {
    name: 'Размер',
    value: 'M',
    quantity: '12',
    price: '1900',
    discount: '0',
    priceMode: 'INHERITED',
    discountMode: 'INHERITED',
    ...overrides,
  };
}

function source(overrides: Partial<ProductCopySource> = {}): ProductCopySource {
  return {
    title: 'Футболка',
    description: 'Хлопок',
    categoryId: 'cat-1',
    attributes: [{ name: 'Материал', value: 'Хлопок' }],
    variants: [variant({ id: 'v1' }), variant({ id: 'v2', value: 'L', quantity: '7' })],
    ...overrides,
  };
}

describe('createProductCopy — копируемые поля (docs/23 §3.1)', () => {
  it('копирует название и описание', () => {
    const copy = createProductCopy(source());
    expect(copy.title).toBe('Футболка');
    expect(copy.description).toBe('Хлопок');
  });

  it('копирует ссылку на категорию', () => {
    expect(createProductCopy(source()).categoryId).toBe('cat-1');
  });

  it('копирует характеристики', () => {
    const copy = createProductCopy(
      source({
        attributes: [
          { name: 'Материал', value: 'Хлопок' },
          { name: 'Цвет', value: 'Белый' },
        ],
      }),
    );
    expect(copy.attributes).toEqual([
      { name: 'Материал', value: 'Хлопок' },
      { name: 'Цвет', value: 'Белый' },
    ]);
  });

  it('копирует варианты, сохраняя порядок и значения', () => {
    const copy = createProductCopy(source());
    expect(copy.variants.map((v) => v.value)).toEqual(['M', 'L']);
    expect(copy.variants[0].name).toBe('Размер');
  });

  it('копирует базовую цену и скидку', () => {
    const copy = createProductCopy(
      source({ variants: [variant({ id: 'v1', price: '1900', discount: '10' })] }),
    );
    expect(copy.variants[0].price).toBe('1900');
    expect(copy.variants[0].discount).toBe('10');
  });

  it('сохраняет оси custom-цены/скидки без изменения семантики', () => {
    const copy = createProductCopy(
      source({
        variants: [
          variant({ id: 'v1' }),
          variant({
            id: 'v2',
            value: 'L',
            price: '2200',
            discount: '20',
            priceMode: 'CUSTOM',
            discountMode: 'CUSTOM',
          }),
        ],
      }),
    );
    expect(copy.variants[1]).toMatchObject({
      price: '2200',
      discount: '20',
      priceMode: 'CUSTOM',
      discountMode: 'CUSTOM',
    });
  });
});

describe('createProductCopy — сброс состояния копии', () => {
  it('сбрасывает фотографии', () => {
    expect(createProductCopy(source()).images).toEqual([]);
  });

  it('обнуляет остатки всех вариантов (решение Q1)', () => {
    const copy = createProductCopy(
      source({ variants: [variant({ quantity: '12' }), variant({ value: 'L', quantity: '7' })] }),
    );
    expect(copy.variants.map((v) => v.quantity)).toEqual(['0', '0']);
  });

  it('исключает id товара и вариантов', () => {
    const copy = createProductCopy(source());
    expect(copy.variants[0]).not.toHaveProperty('id');
    expect(copy.variants[1]).not.toHaveProperty('id');
    expect(Object.keys(copy)).not.toContain('id');
  });
});

describe('createProductCopy — независимость и чистота', () => {
  it('создаёт независимые массивы и объекты', () => {
    const src = source();
    const copy = createProductCopy(src);

    expect(copy.variants).not.toBe(src.variants);
    expect(copy.variants[0]).not.toBe(src.variants[0]);
    expect(copy.attributes).not.toBe(src.attributes);
    expect(copy.attributes[0]).not.toBe(src.attributes[0]);
  });

  it('изменение копии не влияет на источник', () => {
    const src = source();
    const copy = createProductCopy(src);

    copy.title = 'Другое';
    copy.variants[0].name = 'Объём';
    copy.variants.push(variant({ value: 'XL' }));
    copy.attributes.push({ name: 'Бренд', value: 'X' });

    expect(src.title).toBe('Футболка');
    expect(src.variants).toHaveLength(2);
    expect(src.variants[0].name).toBe('Размер');
    expect(src.attributes).toHaveLength(1);
  });

  it('не мутирует исходный объект', () => {
    const src = source();
    const before = JSON.parse(JSON.stringify(src)) as ProductCopySource;
    createProductCopy(src);
    expect(src).toEqual(before);
  });

  it('повторное копирование готового черновика предсказуемо (без id, остаток 0)', () => {
    const first = createProductCopy(source());
    const second = createProductCopy(first);
    expect(second).toEqual(first);
    expect(second.variants.every((v) => v.quantity === '0')).toBe(true);
    expect(second.variants.every((v) => !('id' in v))).toBe(true);
  });
});

describe('hasCopyableContent (docs/23 §7.2)', () => {
  const empty: ProductCopySource = {
    title: '',
    description: '',
    categoryId: 'cat-1',
    attributes: [],
    variants: [variant({ name: '', value: '', price: '', discount: '' })],
  };

  it('пустая форма — нет содержимого', () => {
    expect(hasCopyableContent(empty)).toBe(false);
  });

  it('достаточно названия', () => {
    expect(hasCopyableContent({ ...empty, title: 'Футболка' })).toBe(true);
  });

  it('достаточно описания', () => {
    expect(hasCopyableContent({ ...empty, description: 'Хлопок' })).toBe(true);
  });

  it('учитывает характеристики и варианты, не считая категорию', () => {
    expect(hasCopyableContent({ ...empty, attributes: [{ name: 'Материал', value: '' }] })).toBe(
      true,
    );
    expect(hasCopyableContent({ ...empty, variants: [variant({ value: 'M' })] })).toBe(true);
    expect(hasCopyableContent({ ...empty, categoryId: 'cat-1' })).toBe(false);
  });
});
