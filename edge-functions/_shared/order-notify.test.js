import { describe, expect, it } from 'vitest';
import {
  CONTACT_LABEL_BUYER,
  CONTACT_LABEL_SELLER,
  formatMoneyMinor,
  formatOrderNotification,
  normalizeTelegramUsername,
  resolveOrderNotifications,
  telegramContactUrl,
} from './order-notify.js';

describe('normalizeTelegramUsername', () => {
  it('приводит @/t.me/url к чистому username', () => {
    for (const raw of ['@john', 'john', 't.me/john', 'https://t.me/john', ' https://telegram.me/john ']) {
      expect(normalizeTelegramUsername(raw)).toBe('john');
    }
  });

  it('невалидный/пустой → пустая строка', () => {
    for (const raw of ['', '   ', '1john', 'jo hn', '@', null, undefined, 'a'.repeat(33)]) {
      expect(normalizeTelegramUsername(raw)).toBe('');
    }
  });

  it('telegramContactUrl строит t.me-ссылку либо null', () => {
    expect(telegramContactUrl('@shop_support')).toBe('https://t.me/shop_support');
    expect(telegramContactUrl('bad name')).toBeNull();
    expect(telegramContactUrl('')).toBeNull();
  });
});

describe('formatMoneyMinor', () => {
  it('minor units → человекочитаемо', () => {
    expect(formatMoneyMinor(125000, '₽')).toBe('1250 ₽');
    expect(formatMoneyMinor(1234, '₽')).toBe('12.34 ₽');
    expect(formatMoneyMinor(1000, '$')).toBe('10 $');
    expect(formatMoneyMinor(0, '')).toBe('0');
  });

  it('нечисловой вход → только символ (не падает)', () => {
    expect(formatMoneyMinor(undefined, '₽')).toBe('₽');
    expect(formatMoneyMinor('abc', '₽')).toBe('₽');
    expect(formatMoneyMinor(null, '')).toBe('0');
  });
});

describe('resolveOrderNotifications', () => {
  it('transition → buyer по целевому статусу', () => {
    expect(resolveOrderNotifications({ action: 'transition', status: 'IN_TRANSIT' })).toEqual([
      { recipient: 'buyer', event: 'STATUS_IN_TRANSIT' },
    ]);
    expect(resolveOrderNotifications({ action: 'transition', status: 'DELIVERED' })).toEqual([
      { recipient: 'buyer', event: 'STATUS_DELIVERED' },
    ]);
    expect(resolveOrderNotifications({ action: 'transition', status: 'NEW' })).toEqual([]);
  });

  it('delivery-outcome → buyer по исходу', () => {
    expect(resolveOrderNotifications({ action: 'delivery-outcome', outcome: 'RECEIVED' })).toEqual([
      { recipient: 'buyer', event: 'OUTCOME_RECEIVED' },
    ]);
    expect(resolveOrderNotifications({ action: 'delivery-outcome', outcome: 'REFUSED' })).toEqual([
      { recipient: 'buyer', event: 'OUTCOME_REFUSED' },
    ]);
    expect(resolveOrderNotifications({ action: 'delivery-outcome', outcome: 'X' })).toEqual([]);
  });

  it('cancel: buyer → buyer+seller, seller → buyer', () => {
    expect(resolveOrderNotifications({ action: 'cancel', actorType: 'buyer' })).toEqual([
      { recipient: 'buyer', event: 'BUYER_CANCELLED' },
      { recipient: 'seller', event: 'BUYER_CANCELLED' },
    ]);
    expect(resolveOrderNotifications({ action: 'cancel', actorType: 'seller' })).toEqual([
      { recipient: 'buyer', event: 'SELLER_CANCELLED' },
    ]);
  });

  it('неизвестное действие → пусто', () => {
    expect(resolveOrderNotifications({ action: 'reconcile' })).toEqual([]);
    expect(resolveOrderNotifications({})).toEqual([]);
  });
});

describe('formatOrderNotification — buyer', () => {
  const base = { recipient: 'buyer', orderNumber: 'SH-1', totalMinor: 125000, currencySymbol: '₽' };

  it('ORDER_CREATED содержит номер, сумму, статус и контакт', () => {
    const out = formatOrderNotification({ ...base, event: 'ORDER_CREATED', contactHandle: '@shop' });
    expect(out.text).toContain('Заказ оформлен!');
    expect(out.text).toContain('SH-1');
    expect(out.text).toContain('1250 ₽');
    expect(out.text).toContain('Напишите продавцу');
    expect(out.contact).toEqual({ label: CONTACT_LABEL_SELLER, url: 'https://t.me/shop' });
  });

  it('без валидного контакта — нет строки-подсказки и кнопки', () => {
    const out = formatOrderNotification({ ...base, event: 'STATUS_IN_TRANSIT' });
    expect(out.text).toContain('Заказ в пути!');
    expect(out.text).not.toContain('Напишите продавцу');
    expect(out.contact).toBeNull();
  });

  it('все buyer-события дают текст и кнопку контакта при наличии handle', () => {
    const events = [
      'ORDER_CREATED',
      'STATUS_IN_TRANSIT',
      'STATUS_DELIVERED',
      'OUTCOME_RECEIVED',
      'OUTCOME_REFUSED',
      'BUYER_CANCELLED',
      'SELLER_CANCELLED',
    ];
    for (const event of events) {
      const out = formatOrderNotification({ ...base, event, contactHandle: 'shop' });
      expect(out, event).not.toBeNull();
      expect(out.contact?.url, event).toBe('https://t.me/shop');
      expect(out.text.length, event).toBeGreaterThan(0);
    }
  });

  it('OUTCOME_REFUSED — текст зависит от причины', () => {
    const changed = formatOrderNotification({
      ...base,
      event: 'OUTCOME_REFUSED',
      reasonCode: 'BUYER_CHANGED_MIND',
    });
    expect(changed.text).toContain('передумали');

    const other = formatOrderNotification({
      ...base,
      event: 'OUTCOME_REFUSED',
      reasonCode: 'MADE_UP',
    });
    expect(other.text).toContain('забрать заказ не получилось');
  });

  it('SELLER_CANCELLED — отдельный текст от BUYER_CANCELLED', () => {
    const seller = formatOrderNotification({ ...base, event: 'SELLER_CANCELLED' });
    const buyer = formatOrderNotification({ ...base, event: 'BUYER_CANCELLED' });
    expect(seller.text).toContain('продавец отменил');
    expect(buyer.text).toContain('Вы отменили');
  });

  it('неизвестное событие → null', () => {
    expect(formatOrderNotification({ ...base, event: 'NOPE' })).toBeNull();
  });

  it('ORDER_CREATED с составом и доставкой — для сверки данных', () => {
    const out = formatOrderNotification({
      ...base,
      event: 'ORDER_CREATED',
      items: [
        { title: 'Футболка', variantLabel: 'Размер M', quantity: 2, lineTotalMinor: 200000 },
        { title: 'Носки', variantLabel: 'Размер 42', quantity: 1, lineTotalMinor: 50000 },
      ],
      delivery: { fullName: 'Иван', phone: '+7 900 000-00-00', address: 'г. Москва, ул. Ленина 1' },
    });
    expect(out.text).toContain('Ваш заказ:');
    expect(out.text).toContain('• Футболка — Размер M × 2 — 2000 ₽');
    expect(out.text).toContain('• Носки — Размер 42 × 1 — 500 ₽');
    expect(out.text).toContain('Итого: <b>1250 ₽</b>');
    expect(out.text).toContain('Доставка:');
    expect(out.text).toContain('Получатель: Иван');
    expect(out.text).toContain('Адрес: г. Москва, ул. Ленина 1');
  });

  it('без состава/доставки — блоков нет', () => {
    const out = formatOrderNotification({ ...base, event: 'STATUS_IN_TRANSIT' });
    expect(out.text).not.toContain('Ваш заказ:');
    expect(out.text).not.toContain('Доставка:');
  });

  it('экранирует HTML в пользовательских данных', () => {
    const out = formatOrderNotification({
      ...base,
      event: 'ORDER_CREATED',
      items: [{ title: '<b>X</b>', variantLabel: 'M', quantity: 1, lineTotalMinor: 100 }],
      delivery: { address: 'ул. <b>A</b> & B' },
    });
    expect(out.text).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(out.text).toContain('ул. &lt;b&gt;A&lt;/b&gt; &amp; B');
  });

  it('более 8 позиций → «… и ещё N»', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      title: `Товар ${i + 1}`,
      variantLabel: 'M',
      quantity: 1,
      lineTotalMinor: 100,
    }));
    const out = formatOrderNotification({ ...base, event: 'ORDER_CREATED', items });
    expect(out.text).toContain('• Товар 8');
    expect(out.text).not.toContain('• Товар 9');
    expect(out.text).toContain('… и ещё 2');
  });
});

describe('formatOrderNotification — seller', () => {
  const base = {
    recipient: 'seller',
    orderNumber: 'SH-2',
    totalMinor: 9900,
    currencySymbol: '$',
    itemCount: 3,
  };

  it('ORDER_CREATED — номер, сумма, позиции и кнопка «Написать покупателю»', () => {
    const out = formatOrderNotification({ ...base, event: 'ORDER_CREATED', contactHandle: 'buyer_x' });
    expect(out.text).toContain('Новый заказ!');
    expect(out.text).toContain('99 $');
    expect(out.text).toContain('Позиций: 3');
    expect(out.contact).toEqual({ label: CONTACT_LABEL_BUYER, url: 'https://t.me/buyer_x' });
  });

  it('ORDER_CREATED без username покупателя — без кнопки/строки', () => {
    const out = formatOrderNotification({ ...base, event: 'ORDER_CREATED' });
    expect(out.contact).toBeNull();
    expect(out.text).not.toContain('Напишите покупателю');
  });

  it('ORDER_CREATED с позициями — названия и размеры, без сумм', () => {
    const out = formatOrderNotification({
      ...base,
      event: 'ORDER_CREATED',
      items: [
        { title: 'Футболка', variantLabel: 'Размер M', quantity: 2, lineTotalMinor: 200000 },
        { title: 'Носки', variantLabel: 'Размер 42', quantity: 1, lineTotalMinor: 50000 },
      ],
    });
    expect(out.text).toContain('Товары (2):');
    expect(out.text).toContain('• Футболка — Размер M × 2');
    expect(out.text).toContain('• Носки — Размер 42 × 1');
    expect(out.text).not.toContain('2000 ₽');
  });

  it('BUYER_CANCELLED — без кнопки контакта', () => {
    const out = formatOrderNotification({ ...base, event: 'BUYER_CANCELLED', contactHandle: 'buyer_x' });
    expect(out.text).toContain('Покупатель отменил заказ');
    expect(out.contact).toBeNull();
  });

  it('buyer-события не имеют seller-письма', () => {
    expect(formatOrderNotification({ ...base, event: 'STATUS_DELIVERED' })).toBeNull();
  });
});
