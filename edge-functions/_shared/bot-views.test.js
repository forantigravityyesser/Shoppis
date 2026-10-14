import { describe, expect, it } from 'vitest';
import {
  buyerHowText,
  buyerMainMenu,
  buyerNoStoresText,
  buyerOrdersKeyboard,
  buyerStoreKeyboard,
  buyerStoreWelcomeText,
  buyerStoresView,
  buyerWelcomeGrantText,
  buyerWelcomeText,
  formatBuyerOrdersText,
  formatSellerInviteText,
  formatSellerStatsText,
  normalizeStoreList,
  sellerAppUrl,
  sellerInviteKeyboard,
  sellerMainMenu,
  sellerNeedStoreKeyboard,
  sellerNeedStoreText,
  sellerWelcomeText,
} from './bot-views.js';

const BOT = 'BuyShoppis_bot';
const APP = 'shop';

describe('sellerMainMenu — кнопка магазина меняет смысл по состоянию', () => {
  it('без магазина: «Создать магазин» + статистика + ссылка', () => {
    const kb = sellerMainMenu({ appUrl: 'https://app.example/', hasStore: false });
    expect(kb.inline_keyboard[0][0]).toEqual({
      text: '🛍️ Создать магазин',
      web_app: { url: 'https://app.example?startapp=seller' },
    });
    expect(kb.inline_keyboard[1][0].callback_data).toBe('seller_stats');
    expect(kb.inline_keyboard[2][0].callback_data).toBe('seller_invite');
  });

  it('с магазином: «Управление магазином»', () => {
    const kb = sellerMainMenu({ appUrl: 'https://app.example', hasStore: true });
    expect(kb.inline_keyboard[0][0].text).toBe('🏪 Управление магазином');
    expect(kb.inline_keyboard[0][0].web_app.url).toBe('https://app.example?startapp=seller');
  });

  it('без APP_URL web_app-кнопки нет, остальное на месте', () => {
    const kb = sellerMainMenu({ appUrl: '', hasStore: true });
    expect(kb.inline_keyboard).toHaveLength(2);
    expect(kb.inline_keyboard[0][0].callback_data).toBe('seller_stats');
  });
});

describe('sellerWelcomeText', () => {
  it('с магазином — название экранировано', () => {
    expect(sellerWelcomeText('Tom & Jerry')).toContain('Tom &amp; Jerry');
  });

  it('без магазина — подсказка про создание', () => {
    expect(sellerWelcomeText('')).toContain('Создать магазин');
  });
});

describe('formatSellerStatsText', () => {
  const stats = {
    store: { name: 'Тест', currencySymbol: 'Br' },
    visitors: 12,
    orders: { total: 34, new: 2, inTransit: 1, delivered: 3, history: 4 },
    money: { ordersTotalMinor: 5670000, receivedMinor: 1200000, potentialMinor: 340000 },
  };

  it('все метрики на месте, суммы в валюте магазина', () => {
    const text = formatSellerStatsText(stats);
    expect(text).toContain('Посетители: <b>12</b>');
    expect(text).toContain('Заказов всего: <b>34</b>');
    expect(text).toContain('56700 Br');
    expect(text).toContain('Доход (забрали): <b>12000 Br</b>');
    expect(text).toContain('Потенциальный доход: <b>3400 Br</b>');
    expect(text).toContain('• Отказ/отмена: 4');
  });

  it('пустые значения → нули, а не null', () => {
    const text = formatSellerStatsText({ store: { name: 'X', currencySymbol: '$' } });
    expect(text).toContain('Посетители: <b>0</b>');
    expect(text).toContain('Заказов всего: <b>0</b> · <b>0 $</b>');
    expect(text).toContain('Доход (забрали): <b>0 $</b>');
  });

  it('нет данных → null', () => {
    expect(formatSellerStatsText(null)).toBeNull();
    expect(formatSellerStatsText({})).toBeNull();
  });
});

describe('seller invite', () => {
  it('текст содержит Direct Mini App ссылку', () => {
    const text = formatSellerInviteText(BOT, APP, 'abc123');
    expect(text).toContain('https://t.me/BuyShoppis_bot/shop?startapp=shop_abc123');
  });

  it('клавиатура: копировать ссылку + открыть витрину + назад', () => {
    const kb = sellerInviteKeyboard(BOT, APP, 'abc123');
    const link = 'https://t.me/BuyShoppis_bot/shop?startapp=shop_abc123';
    expect(kb.inline_keyboard[0][0]).toEqual({ text: '📋 Скопировать ссылку', copy_text: { text: link } });
    expect(kb.inline_keyboard[1][0].url).toBe(link);
    expect(kb.inline_keyboard[2][0].callback_data).toBe('seller_menu');
  });
});

describe('seller «нужен магазин»', () => {
  it('для статистики и ссылки — разные тексты', () => {
    expect(sellerNeedStoreText('stats')).toContain('статистику');
    expect(sellerNeedStoreText('invite')).toContain('ссылку');
  });

  it('клавиатура ведёт в онбординг продавца', () => {
    const kb = sellerNeedStoreKeyboard({ appUrl: 'https://app.example/' });
    expect(kb.inline_keyboard[0][0].web_app.url).toBe('https://app.example?startapp=seller');
    expect(kb.inline_keyboard[1][0].callback_data).toBe('seller_menu');
  });
});

describe('buyerMainMenu / welcome', () => {
  it('без витрин — список, заказы, «как это работает»', () => {
    const kb = buyerMainMenu({ botUsername: BOT, appShortname: APP, lastStore: null });
    expect(kb.inline_keyboard.map((r) => r[0].callback_data)).toEqual([
      'buyer_myshops',
      'buyer_orders',
      'buyer_how',
    ]);
    expect(buyerWelcomeText(null)).toContain('ссылку-приглашение');
  });

  it('с последней витриной — ярлык первым и ссылка на неё', () => {
    const kb = buyerMainMenu({
      botUsername: BOT,
      appShortname: APP,
      lastStore: { name: 'Цветы', publicId: 'p1' },
    });
    expect(kb.inline_keyboard[0][0].url).toBe('https://t.me/BuyShoppis_bot/shop?startapp=shop_p1');
    expect(kb.inline_keyboard[0][0].text).toContain('Цветы');
    expect(buyerWelcomeText({ name: 'Цветы', publicId: 'p1' })).toContain('«Цветы»');
  });
});

describe('normalizeStoreList — разбор ответа buyer_store_list_read', () => {
  it('jsonb-массив витрин отдаётся как есть (а не первый элемент)', () => {
    const stores = [
      { publicId: 'p1', name: 'Рыбалка' },
      { publicId: 'p2', name: 'Книги' },
    ];
    expect(normalizeStoreList(stores)).toEqual(stores);
  });

  it('пустой jsonb-массив → пустой список', () => {
    expect(normalizeStoreList([])).toEqual([]);
  });

  it('обёртка {value:[...]} тоже принимается', () => {
    const stores = [{ publicId: 'p1', name: 'Рыбалка' }];
    expect(normalizeStoreList({ value: stores })).toEqual(stores);
  });

  it('null / объект без массива → пустой список', () => {
    expect(normalizeStoreList(null)).toEqual([]);
    expect(normalizeStoreList({ orders: [] })).toEqual([]);
  });
});

describe('buyerStoresView', () => {
  it('каждый магазин — кнопка с названием и ссылкой', () => {
    const view = buyerStoresView({
      stores: [
        { name: 'Рыбалка', publicId: 'r1' },
        { name: 'Книги', publicId: 'k1' },
      ],
      botUsername: BOT,
      appShortname: APP,
    });
    expect(view.keyboard.inline_keyboard[0][0].text).toBe('🛍️ Рыбалка');
    expect(view.keyboard.inline_keyboard[0][0].url).toContain('shop_r1');
    expect(view.keyboard.inline_keyboard[1][0].url).toContain('shop_k1');
    expect(view.keyboard.inline_keyboard[2][0].callback_data).toBe('buyer_menu');
  });

  it('пустой список — текст онбординга', () => {
    expect(buyerNoStoresText()).toContain('Пока пусто');
  });
});

describe('formatBuyerOrdersText', () => {
  it('пусто — подсказка', () => {
    expect(formatBuyerOrdersText({ orders: [], total: 0 })).toContain('Активных заказов нет');
  });

  it('заказ: магазин, номер, статус и сумма', () => {
    const text = formatBuyerOrdersText({
      orders: [
        {
          storeName: 'Тест',
          publicOrderNumber: 'S-100',
          status: 'IN_TRANSIT',
          totalMinor: 125000,
          currencySymbol: '₽',
        },
      ],
      total: 1,
    });
    expect(text).toContain('Тест');
    expect(text).toContain('№S-100');
    expect(text).toContain('🚚 В пути');
    expect(text).toContain('1250 ₽');
  });

  it('лимит списка: сообщает, что показаны не все', () => {
    const orders = Array.from({ length: 3 }, (_, i) => ({
      storeName: `S${i}`,
      publicOrderNumber: `N${i}`,
      status: 'NEW',
      totalMinor: 100,
      currencySymbol: '$',
    }));
    const text = formatBuyerOrdersText({ orders, total: 10 });
    expect(text).toContain('(10)');
    expect(text).toContain('…и ещё 7.');
  });

  it('название магазина экранируется', () => {
    const text = formatBuyerOrdersText({
      orders: [{ storeName: '<b>x</b>', publicOrderNumber: '1', status: 'NEW', totalMinor: 1 }],
      total: 1,
    });
    expect(text).not.toContain('<b>x</b>');
    expect(text).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('buyerWelcomeGrantText (доступ к сообщениям выдан)', () => {
  it('знакомит с возможностями и указывает последнюю витрину', () => {
    const text = buyerWelcomeGrantText({ name: 'Цветы', publicId: 'p1' });
    expect(text).toContain('Уведомления включены');
    expect(text).toContain('Shoppis');
    expect(text).toContain('«Цветы»');
    expect(text).toContain('заказов');
  });

  it('без витрины — подсказка про ссылку', () => {
    expect(buyerWelcomeGrantText(null)).toContain('ссылке-приглашению');
  });
});

describe('buyerStoreWelcomeText / keyboard (вход по ссылке)', () => {
  it('название экранируется, кнопка открывает витрину и ведёт в список', () => {
    const text = buyerStoreWelcomeText('Tom & Jerry');
    expect(text).toContain('«Tom &amp; Jerry»');
    const kb = buyerStoreKeyboard(BOT, APP, 'p1');
    expect(kb.inline_keyboard[0][0].url).toBe('https://t.me/BuyShoppis_bot/shop?startapp=shop_p1');
    expect(kb.inline_keyboard[1][0].callback_data).toBe('buyer_myshops');
  });

  it('без названия — без пустых кавычек', () => {
    expect(buyerStoreWelcomeText('')).toContain('Добро пожаловать!');
  });
});

describe('мелкие хелперы', () => {
  it('sellerAppUrl нормализует слэш', () => {
    expect(sellerAppUrl('https://a/')).toBe('https://a?startapp=seller');
  });

  it('клавиатуры обновления/назад', () => {
    expect(buyerOrdersKeyboard().inline_keyboard[0][0].callback_data).toBe('buyer_orders_refresh');
    expect(buyerHowText()).toContain('Как это работает');
  });
});
