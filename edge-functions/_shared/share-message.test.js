import { describe, expect, it } from 'vitest';
import {
  CAPTION_MAX,
  buildPreparedPhotoResult,
  buildShareCaption,
} from './share-message.js';

describe('buildShareCaption', () => {
  it('название + описание + характеристики + цена + магазин', () => {
    expect(
      buildShareCaption({
        title: 'Кроссовки',
        description: 'Лёгкие и удобные',
        attributes: [{ name: 'Цвет', value: 'Чёрный' }],
        storeName: 'Shop One',
        priceMinor: 125000,
        currencySymbol: '₽',
      }),
    ).toBe('<b>Кроссовки</b>\n\nЛёгкие и удобные\n\nЦвет: Чёрный\n\n💰 1250 ₽\n🏪 Shop One');
  });

  it('без описания/характеристик — название + цена + магазин', () => {
    expect(buildShareCaption({ title: 'Футболка', storeName: 'S', priceMinor: 10000 })).toBe(
      '<b>Футболка</b>\n\n💰 100\n🏪 S',
    );
    expect(buildShareCaption({ title: 'Футболка' })).toBe('<b>Футболка</b>');
    expect(buildShareCaption({})).toBe('<b>Товар</b>');
  });

  it('отбрасывает пустые характеристики', () => {
    expect(
      buildShareCaption({ title: 'T', attributes: [{ name: 'Цвет', value: '' }, { name: '', value: 'x' }] }),
    ).toBe('<b>T</b>');
  });

  it('экранирует HTML в пользовательских данных', () => {
    expect(buildShareCaption({ title: 'A<b>&"x', description: '<i>' })).toBe(
      '<b>A&lt;b&gt;&amp;"x</b>\n\n&lt;i&gt;',
    );
  });

  it('обрезает описание, но сохраняет цену и магазин (лимит)', () => {
    const caption = buildShareCaption({
      title: 'T',
      description: 'x'.repeat(5000),
      priceMinor: 125000,
      currencySymbol: '₽',
      storeName: 'Shop One',
    });
    expect(caption.length).toBeLessThanOrEqual(CAPTION_MAX);
    expect(caption.endsWith('💰 1250 ₽\n🏪 Shop One')).toBe(true);
  });
});

describe('buildPreparedPhotoResult', () => {
  it('собирает InlineQueryResultPhoto с кнопкой', () => {
    const result = buildPreparedPhotoResult({
      productId: 'p-1',
      photoUrl: 'https://cdn/share.jpg',
      thumbnailUrl: 'https://cdn/thumb.jpg',
      title: 'Кроссовки',
      description: 'Shop One',
      caption: '<b>Кроссовки</b>',
      buttonUrl: 'https://t.me/bot/shop?startapp=prod_abc_p-1',
    });

    expect(result).toMatchObject({
      type: 'photo',
      id: 'p-1',
      photo_url: 'https://cdn/share.jpg',
      thumbnail_url: 'https://cdn/thumb.jpg',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '🛍️ Открыть товар', url: 'https://t.me/bot/shop?startapp=prod_abc_p-1' }]],
      },
    });
  });

  it('thumbnail_url fallback на photo_url и нет кнопки без buttonUrl', () => {
    const result = buildPreparedPhotoResult({
      productId: 'p-1',
      photoUrl: 'https://cdn/share.jpg',
    });
    expect(result.thumbnail_url).toBe('https://cdn/share.jpg');
    expect(result.reply_markup).toBeUndefined();
  });
});
