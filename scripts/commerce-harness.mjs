// commerce-harness.mjs — интеграционный/конкурентный harness контура
// Cart → Checkout → Order → Inventory (docs/21 §9, Test 1–9).
//
// Гоняет SQL/RPC на реальном dev-бэкенде через admin raw-SQL endpoint
// (`.insforge/project.json`), сидирует временный магазин/товары и убирает за собой.
// Проверяет коммерческие инварианты, которые unit-тесты не доказывают:
//   Test 1  stock=1, два покупателя (оверселл)
//   Test 2  retry с тем же idempotency key
//   Test 3  конкурентные запросы с одним idempotency key
//   Test 4  смена цены между Cart и Checkout
//   Test 5  архив между Cart и Checkout
//   Test 6  количество > стока / > 99 / дубль варианта
//   Test 7  buyer cancel NEW → held освобождается
//   Test 8  seller cancel IN_TRANSIT → held остаётся
//   Test 9  REFUSED → held остаётся до reconcile
//   Test 10 независимые оси variant price/discount: Cart / Product Detail / RPC / order_items
//   Test 11 held активного NEW защищён от variant-wide reconcile (P0-04)
//   Test 12 order-aware reconcile REFUSED освобождает только held заказа
//   Test 13 IN_TRANSIT held защищён (variant-wide и order-aware reconcile запрещены)
//   Test 14 повторная сверка отменённого заказа не крадёт резерв другого заказа
//   Test 15 повторная отмена терминального заказа → нет новых движений
//   Test 16 конкурентные order-aware сверки двух REFUSED → нет овер-релиза
//   Test 17 заказ с несколькими позициями: отмена/сверка по каждой
//   Test 18 повторная order-aware сверка того же заказа идемпотентна
//   Test 19 variant-wide атрибутирует освобождение заказу (нет повторного освобождения)
//   Test 20 variant-wide распределяет освобождение по нескольким релизабельным заказам
//   Test 21 конкурентные order_cancel ∥ order-aware reconcile (NEW): нет дедлока
//   Test 22 конкурентные order_cancel ∥ order-aware reconcile (REFUSED): нет дедлока
//
// Admin raw-SQL маскирует RAISE-сообщения в INTERNAL_ERROR, поэтому вызовы RPC
// идут через временный `public._harness_try(text)`, который ловит SQL-исключение
// и возвращает `{ok,result|error}` — так проверяются машинные коды.
//
// Запуск: npm run commerce:harness   (ненулевой exit code при падении)

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const config = JSON.parse(readFileSync(resolve(process.cwd(), '.insforge/project.json'), 'utf8'));
const URL = `${config.oss_host}/api/database/advance/rawsql`;
const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.api_key}` };

const S = Date.now().toString(36);

async function raw(query) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg = body?.error || body?.message || text || `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return body;
}

async function rows(query) {
  const body = await raw(query);
  return body?.rows ?? [];
}

async function scalar(query) {
  const r = await rows(query);
  return r[0] ? Object.values(r[0])[0] : null;
}

async function json(query) {
  let value = await scalar(query);
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      /* keep string */
    }
  }
  return value;
}

/** Вызов RPC через ловящий исключение хелпер: `{ok:true,result}` | `{ok:false,error}`. */
function callFn(name, argsSql) {
  const sql = `select public.${name}(${argsSql})`;
  return json(`select public._harness_try(${q(sql)}) as r`);
}

const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
const idOf = (r) => r[0]?.id ?? null;

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

let store = null;
let storePublic = null;
let owner = null;
let buyerA = null;
let buyerB = null;

async function seedUser() {
  return idOf(await rows(`insert into public.users (status) values ('ACTIVE') returning id`));
}

async function seedStore() {
  const ownerId = await seedUser();
  storePublic = `harness_${S}`;
  const r = await rows(
    `insert into public.stores (owner_telegram_id, name, owner_user_id, public_id, status, currency, currency_symbol)
     values (${q(`tg_harness_${S}`)}, ${q(`Harness ${S}`)}, ${q(ownerId)}, ${q(storePublic)}, 'ACTIVE', 'USD', '$')
     returning id`,
  );
  return { ownerId, storeId: idOf(r) };
}

async function seedProduct({ price = 1000, discount = 0, available = 5, status = 'ACTIVE' } = {}) {
  const product = idOf(
    await rows(
      `insert into public.products (store_id, title, status, original_amount_minor, discount_percent)
       values (${q(store)}, ${q(`Harness product ${S}`)}, ${q(status)}, ${price}, ${discount})
       returning id`,
    ),
  );
  const variant = idOf(
    await rows(
      `insert into public.variants (product_id, name, value, normalized_value, status)
       values (${q(product)}, 'Size', 'M', 'm', 'ACTIVE')
       returning id`,
    ),
  );
  await raw(
    `insert into public.inventory (variant_id, available_quantity, held_quantity)
     values (${q(variant)}, ${available}, 0)`,
  );
  return { product, variant };
}

function checkoutArgs(buyer, key, items) {
  return `${q(store)}, ${q(buyer)}, ${q(key)}, 'Тест', '+10000000000', 'Адрес 1', null, ${q(
    JSON.stringify(items),
  )}::jsonb`;
}

async function inventoryOf(variantId) {
  const r = await rows(
    `select available_quantity, held_quantity from public.inventory where variant_id = ${q(variantId)}`,
  );
  return r[0] ?? {};
}

const num = (v) => Number(v);
const isInv = (inv, available, held) =>
  num(inv.available_quantity) === available && num(inv.held_quantity) === held;
const orderCountFor = async (variantId) =>
  num(
    await scalar(
      `select count(*) from public.orders o join public.order_items oi on oi.order_id = o.id where oi.variant_id = ${q(variantId)}`,
    ),
  );

const HARNESS_TRY = `
create or replace function public._harness_try(p_sql text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  execute p_sql into v;
  return jsonb_build_object('ok', true, 'result', v);
exception when others then
  return jsonb_build_object('ok', false, 'error', SQLERRM);
end $$;`;

async function cleanup() {
  await raw(`drop function if exists public._harness_try(text)`);
  if (store) {
    const variants = `select id from public.variants where product_id in (select id from public.products where store_id = ${q(store)})`;
    const orders = `select id from public.orders where store_id = ${q(store)}`;
    await raw(`delete from public.inventory_movements where variant_id in (${variants})`);
    await raw(`delete from public.order_items where order_id in (${orders})`);
    await raw(`delete from public.order_status_history where order_id in (${orders})`);
    await raw(`delete from public.orders where store_id = ${q(store)}`);
    await raw(`delete from public.inventory where variant_id in (${variants})`);
    await raw(`delete from public.variants where product_id in (select id from public.products where store_id = ${q(store)})`);
    await raw(`delete from public.products where store_id = ${q(store)}`);
  }
  const users = [owner, buyerA, buyerB].filter(Boolean);
  if (users.length) {
    await raw(`delete from public.order_idempotency where buyer_user_id in (${users.map(q).join(',')})`);
    await raw(`delete from public.stores where id = ${q(store)}`);
    await raw(`delete from public.users where id in (${users.map(q).join(',')})`);
  }
}

async function run() {
  console.log(`[commerce-harness] seed store ${store} (owner ${owner}), buyers ${buyerA}/${buyerB}`);

  // Test 1 — stock=1, два покупателя
  {
    const t = await seedProduct({ available: 1 });
    const [rA, rB] = await Promise.all([
      callFn('create_order_atomic', checkoutArgs(buyerA, `t1a_${S}`, [{ variantId: t.variant, quantity: 1 }])),
      callFn('create_order_atomic', checkoutArgs(buyerB, `t1b_${S}`, [{ variantId: t.variant, quantity: 1 }])),
    ]);
    const ok = [rA, rB].filter((r) => r?.ok && r.result?.orderId).length;
    const insufficient = [rA, rB].filter((r) => !r?.ok && /INSUFFICIENT_STOCK/.test(String(r.error))).length;
    check('Test 1: ровно один заказ (нет оверселла)', ok === 1, `ok=${ok}`);
    check('Test 1: второй отклонён INSUFFICIENT_STOCK', insufficient === 1, `n=${insufficient}`);
    check('Test 1: available=0, held=1', isInv(await inventoryOf(t.variant), 0, 1));
  }

  // Test 2 — retry с тем же ключом
  {
    const t = await seedProduct({ available: 5 });
    const key = `t2_${S}`;
    const a1 = await callFn('create_order_atomic', checkoutArgs(buyerA, key, [{ variantId: t.variant, quantity: 2 }]));
    const a2 = await callFn('create_order_atomic', checkoutArgs(buyerA, key, [{ variantId: t.variant, quantity: 2 }]));
    check('Test 2: retry возвращает тот же заказ', a1?.ok && a2?.ok && a1.result.orderId === a2.result.orderId, `${a1?.result?.orderId} vs ${a2?.result?.orderId}`);
    check('Test 2: второй ответ idempotent=true', a2?.result?.idempotent === true);
    check('Test 2: ровно один заказ', (await orderCountFor(t.variant)) === 1);
    check('Test 2: резерв один раз (available=3, held=2)', isInv(await inventoryOf(t.variant), 3, 2));
  }

  // Test 3 — конкурентные запросы с одним ключом
  {
    const t = await seedProduct({ available: 5 });
    const key = `t3_${S}`;
    const [c1, c2] = await Promise.all([
      callFn('create_order_atomic', checkoutArgs(buyerA, key, [{ variantId: t.variant, quantity: 1 }])),
      callFn('create_order_atomic', checkoutArgs(buyerA, key, [{ variantId: t.variant, quantity: 1 }])),
    ]);
    const fulfilled = [c1, c2].filter((r) => r?.ok && r.result?.orderId);
    check('Test 3: оба запроса получили заказ', fulfilled.length === 2, `n=${fulfilled.length}`);
    check('Test 3: это один и тот же заказ', fulfilled.length === 2 && fulfilled[0].result.orderId === fulfilled[1].result.orderId);
    check('Test 3: создан ровно один заказ', (await orderCountFor(t.variant)) === 1);
  }

  // Test 4 — смена цены между Cart и Checkout
  {
    const t = await seedProduct({ price: 1000, available: 10 });
    const o1 = await callFn('create_order_atomic', checkoutArgs(buyerA, `t4a_${S}`, [{ variantId: t.variant, quantity: 1 }]));
    await raw(`update public.products set original_amount_minor = 1200 where id = ${q(t.product)}`);
    const o2 = await callFn('create_order_atomic', checkoutArgs(buyerA, `t4b_${S}`, [{ variantId: t.variant, quantity: 1 }]));
    const p1 = await scalar(`select unit_price_minor from public.order_items where order_id = ${q(o1.result.orderId)} and variant_id = ${q(t.variant)}`);
    const p2 = await scalar(`select unit_price_minor from public.order_items where order_id = ${q(o2.result.orderId)} and variant_id = ${q(t.variant)}`);
    check('Test 4: до изменения цена 1000', num(p1) === 1000, `p=${p1}`);
    check('Test 4: после изменения цена 1200 (сервер авторитетен)', num(p2) === 1200, `p=${p2}`);
  }

  // Test 5 — архив между Cart и Checkout
  {
    const t = await seedProduct({ available: 5 });
    await raw(`update public.products set status = 'ARCHIVED' where id = ${q(t.product)}`);
    const r = await callFn('create_order_atomic', checkoutArgs(buyerA, `t5_${S}`, [{ variantId: t.variant, quantity: 1 }]));
    check('Test 5: PRODUCT_NOT_ACTIVE', !r?.ok && /PRODUCT_NOT_ACTIVE/.test(String(r.error)), r?.error);
    check('Test 5: сток не изменён', isInv(await inventoryOf(t.variant), 5, 0));
    check('Test 5: заказ не создан', (await orderCountFor(t.variant)) === 0);
  }

  // Test 6 — количество > стока / > 99 / дубль
  {
    const t = await seedProduct({ available: 2 });
    const r1 = await callFn('create_order_atomic', checkoutArgs(buyerA, `t6a_${S}`, [{ variantId: t.variant, quantity: 5 }]));
    check('Test 6: qty > stock → INSUFFICIENT_STOCK', !r1?.ok && /INSUFFICIENT_STOCK/.test(String(r1.error)), r1?.error);
    const r2 = await callFn('create_order_atomic', checkoutArgs(buyerA, `t6b_${S}`, [{ variantId: t.variant, quantity: 100 }]));
    check('Test 6: qty=100 → INVALID_QUANTITY', !r2?.ok && /INVALID_QUANTITY/.test(String(r2.error)), r2?.error);
    const r3 = await callFn(
      'create_order_atomic',
      checkoutArgs(buyerA, `t6c_${S}`, [
        { variantId: t.variant, quantity: 1 },
        { variantId: t.variant, quantity: 1 },
      ]),
    );
    check('Test 6: дубль варианта → VARIANT_DUPLICATE', !r3?.ok && /VARIANT_DUPLICATE/.test(String(r3.error)), r3?.error);
    check('Test 6: сток не изменён', isInv(await inventoryOf(t.variant), 2, 0));
  }

  // Test 7 — buyer cancel NEW
  {
    const t = await seedProduct({ available: 5 });
    const o = await callFn('create_order_atomic', checkoutArgs(buyerA, `t7_${S}`, [{ variantId: t.variant, quantity: 2 }]));
    check('Test 7: после checkout available=3, held=2', isInv(await inventoryOf(t.variant), 3, 2));
    await callFn('order_cancel', `${q(o.result.orderId)}, ${q(buyerA)}, 'buyer'`);
    check('Test 7: cancel NEW → available=5, held=0', isInv(await inventoryOf(t.variant), 5, 0));
  }

  // Test 8 — seller cancel IN_TRANSIT
  {
    const t = await seedProduct({ available: 5 });
    const o = await callFn('create_order_atomic', checkoutArgs(buyerA, `t8_${S}`, [{ variantId: t.variant, quantity: 2 }]));
    await callFn('order_transition', `${q(o.result.orderId)}, ${q(owner)}, 'IN_TRANSIT'`);
    await callFn('order_cancel', `${q(o.result.orderId)}, ${q(owner)}, 'seller'`);
    check('Test 8: cancel IN_TRANSIT → held остаётся (available=3, held=2)', isInv(await inventoryOf(t.variant), 3, 2));
  }

  // Test 9 — REFUSED, затем reconcile
  {
    const t = await seedProduct({ available: 5 });
    const o = await callFn('create_order_atomic', checkoutArgs(buyerA, `t9_${S}`, [{ variantId: t.variant, quantity: 2 }]));
    await callFn('order_transition', `${q(o.result.orderId)}, ${q(owner)}, 'IN_TRANSIT'`);
    await callFn('order_transition', `${q(o.result.orderId)}, ${q(owner)}, 'DELIVERED'`);
    await callFn('order_delivery_outcome', `${q(o.result.orderId)}, ${q(owner)}, 'REFUSED', 'DAMAGED'`);
    check('Test 9: REFUSED → held остаётся (available=3, held=2)', isInv(await inventoryOf(t.variant), 3, 2));
    await callFn('inventory_reconcile', `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS'`);
    check('Test 9: reconcile → available=5, held=0', isInv(await inventoryOf(t.variant), 5, 0));
  }

  // Test 10 — независимые оси variant price/discount (docs/20 §4.3, docs/21 P0-05):
  // одна и та же эффективная цена во всех чтениях + снапшот заказа.
  {
    const t = await seedProduct({ price: 1000, discount: 20, available: 20 });

    const setAxes = async (mode, cprice, cdisc) => {
      await raw(
        `update public.variants set price_mode = ${q(mode)},
           custom_original_amount_minor = ${cprice === null ? 'null' : cprice},
           custom_discount_percent = ${cdisc === null ? 'null' : cdisc}
         where id = ${q(t.variant)}`,
      );
    };
    const detailPrice = async () => {
      const d = await json(
        `select public.storefront_product_detail_read(${q(storePublic)}, ${q(t.product)})`,
      );
      const v = (d?.variants ?? []).find((x) => x.id === t.variant);
      return v ? num(v.price) : null;
    };
    const cartPrice = async () => {
      const items = JSON.stringify([{ productId: t.product, variantId: t.variant }]);
      const d = await json(
        `select public.storefront_cart_items_read(${q(storePublic)}, ${q(items)}::jsonb)`,
      );
      return d?.items?.[0] ? num(d.items[0].unitPrice) : null;
    };
    const orderPrice = async (key) => {
      const o = await callFn(
        'create_order_atomic',
        checkoutArgs(buyerA, key, [{ variantId: t.variant, quantity: 1 }]),
      );
      return num(
        await scalar(
          `select unit_price_minor from public.order_items where order_id = ${q(o.result.orderId)}`,
        ),
      );
    };

    const cases = [
      { name: 'A inherited price + inherited discount', mode: 'USE_PRODUCT_PRICE', price: null, disc: null, expected: 800 },
      { name: 'B custom price + inherited discount', mode: 'CUSTOM_PRICE', price: 1200, disc: null, expected: 960 },
      { name: 'C inherited price + custom discount', mode: 'CUSTOM_PRICE', price: null, disc: 10, expected: 900 },
      { name: 'D custom price + custom discount', mode: 'CUSTOM_PRICE', price: 1200, disc: 10, expected: 1080 },
      // Zero is a valid custom discount and must NOT fall back to the product discount.
      { name: 'E custom price + zero custom discount', mode: 'CUSTOM_PRICE', price: 1200, disc: 0, expected: 1200 },
    ];
    for (let i = 0; i < cases.length; i += 1) {
      const c = cases[i];
      await setAxes(c.mode, c.price, c.disc);
      const detail = await detailPrice();
      const cart = await cartPrice();
      const order = await orderPrice(`t10_${i}_${S}`);
      check(`Test 10 ${c.name}: Product Detail = ${c.expected}`, detail === c.expected, `got ${detail}`);
      check(`Test 10 ${c.name}: Cart = ${c.expected}`, cart === c.expected, `got ${cart}`);
      check(`Test 10 ${c.name}: order_items = ${c.expected}`, order === c.expected, `got ${order}`);
      // Same product data in Cart and checkout → unit price must match exactly.
      check(`Test 10 ${c.name}: Cart == order_items`, cart === order, `cart ${cart} vs order ${order}`);
    }
  }

  // Test 11 — held активного заказа защищён от variant-wide reconcile (P0-04)
  {
    const t = await seedProduct({ available: 5 });
    const o = await callFn('create_order_atomic', checkoutArgs(buyerA, `t11_${S}`, [{ variantId: t.variant, quantity: 2 }]));
    check('Test 11: после checkout available=3, held=2', isInv(await inventoryOf(t.variant), 3, 2));

    const r = await callFn('inventory_reconcile', `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS'`);
    check(
      'Test 11: variant-wide reconcile активного NEW → INVENTORY_RESERVED_BY_ORDERS',
      !r?.ok && /INVENTORY_RESERVED_BY_ORDERS/.test(String(r.error)),
      r?.error,
    );
    check('Test 11: held не изменён (3,2)', isInv(await inventoryOf(t.variant), 3, 2));

    const orderAware = await callFn(
      'inventory_reconcile',
      `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS', ${q(o.result.orderId)}`,
    );
    check(
      'Test 11: order-aware reconcile NEW → ORDER_NOT_RECONCILABLE',
      !orderAware?.ok && /ORDER_NOT_RECONCILABLE/.test(String(orderAware.error)),
      orderAware?.error,
    );

    await callFn('order_cancel', `${q(o.result.orderId)}, ${q(buyerA)}, 'buyer'`);
    check('Test 11: cancel NEW без underflow → available=5, held=0', isInv(await inventoryOf(t.variant), 5, 0));
  }

  // Test 12 — order-aware reconcile REFUSED освобождает только held заказа
  {
    const t = await seedProduct({ available: 5 });
    const o = await callFn('create_order_atomic', checkoutArgs(buyerA, `t12_${S}`, [{ variantId: t.variant, quantity: 2 }]));
    await callFn('order_transition', `${q(o.result.orderId)}, ${q(owner)}, 'IN_TRANSIT'`);
    await callFn('order_transition', `${q(o.result.orderId)}, ${q(owner)}, 'DELIVERED'`);
    await callFn('order_delivery_outcome', `${q(o.result.orderId)}, ${q(owner)}, 'REFUSED', 'DAMAGED'`);
    const r = await callFn(
      'inventory_reconcile',
      `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS', ${q(o.result.orderId)}`,
    );
    check('Test 12: order-aware reconcile REFUSED → ok', r?.ok === true, r?.error);
    check('Test 12: available=5, held=0', isInv(await inventoryOf(t.variant), 5, 0));
    const linked = num(
      await scalar(
        `select count(*) from public.inventory_movements where order_id = ${q(o.result.orderId)} and movement_type = 'MANUAL_RECONCILE'`,
      ),
    );
    check('Test 12: movement привязан к order_id', linked === 1, `n=${linked}`);
  }

  // Test 13 — IN_TRANSIT: held защищён (variant-wide и order-aware reconcile запрещены)
  {
    const t = await seedProduct({ available: 5 });
    const o = await callFn('create_order_atomic', checkoutArgs(buyerA, `t13_${S}`, [{ variantId: t.variant, quantity: 2 }]));
    await callFn('order_transition', `${q(o.result.orderId)}, ${q(owner)}, 'IN_TRANSIT'`);
    check('Test 13: IN_TRANSIT → available=3, held=2', isInv(await inventoryOf(t.variant), 3, 2));

    const wide = await callFn('inventory_reconcile', `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS'`);
    check(
      'Test 13: variant-wide reconcile IN_TRANSIT → INVENTORY_RESERVED_BY_ORDERS',
      !wide?.ok && /INVENTORY_RESERVED_BY_ORDERS/.test(String(wide.error)),
      wide?.error,
    );

    const aware = await callFn(
      'inventory_reconcile',
      `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS', ${q(o.result.orderId)}`,
    );
    check(
      'Test 13: order-aware reconcile IN_TRANSIT → ORDER_NOT_RECONCILABLE',
      !aware?.ok && /ORDER_NOT_RECONCILABLE/.test(String(aware.error)),
      aware?.error,
    );

    check('Test 13: held не изменён (3,2)', isInv(await inventoryOf(t.variant), 3, 2));
  }

  // Test 14 — повторная сверка отменённого заказа не крадёт резерв другого (P0 №2).
  {
    const t = await seedProduct({ available: 5 });
    const oA = await callFn('create_order_atomic', checkoutArgs(buyerA, `t14a_${S}`, [{ variantId: t.variant, quantity: 2 }]));
    const oB = await callFn('create_order_atomic', checkoutArgs(buyerB, `t14b_${S}`, [{ variantId: t.variant, quantity: 3 }]));
    check('Test 14: A(2)+B(3) → available=0, held=5', isInv(await inventoryOf(t.variant), 0, 5));

    await callFn('order_cancel', `${q(oA.result.orderId)}, ${q(buyerA)}, 'buyer'`);
    check('Test 14: cancel A освободил 2 (available=2, held=3 = резерв B)', isInv(await inventoryOf(t.variant), 2, 3));

    // ORDER_CANCEL_RELEASE уже вернул held A; order-aware сверка A должна быть no-op.
    const r = await callFn(
      'inventory_reconcile',
      `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS', ${q(oA.result.orderId)}`,
    );
    check(
      'Test 14: order-aware reconcile отменённого A → INSUFFICIENT_HELD',
      !r?.ok && /INSUFFICIENT_HELD/.test(String(r.error)),
      r?.error,
    );
    check('Test 14: резерв B не тронут (available=2, held=3)', isInv(await inventoryOf(t.variant), 2, 3));
  }

  // Test 15 — повторная отмена терминального заказа не создаёт новых движений.
  {
    const t = await seedProduct({ available: 5 });
    const o = await callFn('create_order_atomic', checkoutArgs(buyerA, `t15_${S}`, [{ variantId: t.variant, quantity: 2 }]));
    await callFn('order_cancel', `${q(o.result.orderId)}, ${q(buyerA)}, 'buyer'`);
    const before = num(
      await scalar(`select count(*) from public.inventory_movements where order_id = ${q(o.result.orderId)}`),
    );

    const again = await callFn('order_cancel', `${q(o.result.orderId)}, ${q(buyerA)}, 'buyer'`);
    check(
      'Test 15: повторная отмена → ORDER_TERMINAL',
      !again?.ok && /ORDER_TERMINAL/.test(String(again.error)),
      again?.error,
    );
    const after = num(
      await scalar(`select count(*) from public.inventory_movements where order_id = ${q(o.result.orderId)}`),
    );
    check('Test 15: новых движений нет', after === before, `${before} → ${after}`);
    check('Test 15: сток остаётся available=5, held=0', isInv(await inventoryOf(t.variant), 5, 0));
  }

  // Test 16 — конкурентные order-aware сверки двух REFUSED-заказов: без овер-релиза.
  {
    const t = await seedProduct({ available: 5 });
    const oA = await callFn('create_order_atomic', checkoutArgs(buyerA, `t16a_${S}`, [{ variantId: t.variant, quantity: 2 }]));
    const oB = await callFn('create_order_atomic', checkoutArgs(buyerB, `t16b_${S}`, [{ variantId: t.variant, quantity: 3 }]));
    for (const o of [oA, oB]) {
      await callFn('order_transition', `${q(o.result.orderId)}, ${q(owner)}, 'IN_TRANSIT'`);
      await callFn('order_transition', `${q(o.result.orderId)}, ${q(owner)}, 'DELIVERED'`);
      await callFn('order_delivery_outcome', `${q(o.result.orderId)}, ${q(owner)}, 'REFUSED', 'DAMAGED'`);
    }
    check('Test 16: оба REFUSED → available=0, held=5', isInv(await inventoryOf(t.variant), 0, 5));

    const [rA, rB] = await Promise.all([
      callFn('inventory_reconcile', `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS', ${q(oA.result.orderId)}`),
      callFn('inventory_reconcile', `${q(t.variant)}, ${q(owner)}, 3, 'HARNESS', ${q(oB.result.orderId)}`),
    ]);
    const okN = [rA, rB].filter((r) => r?.ok === true).length;
    check('Test 16: обе конкурентные сверки прошли', okN === 2, `ok=${okN}`);
    check('Test 16: суммарно освобождено ровно 5 (available=5, held=0)', isInv(await inventoryOf(t.variant), 5, 0));
  }

  // Test 17 — заказ с несколькими позициями: отмена освобождает каждую; сверка отменённого no-op.
  {
    const t1 = await seedProduct({ available: 5 });
    const t2 = await seedProduct({ available: 5 });
    const o = await callFn(
      'create_order_atomic',
      checkoutArgs(buyerA, `t17_${S}`, [
        { variantId: t1.variant, quantity: 2 },
        { variantId: t2.variant, quantity: 1 },
      ]),
    );
    check(
      'Test 17: после checkout t1(3,2), t2(4,1)',
      isInv(await inventoryOf(t1.variant), 3, 2) && isInv(await inventoryOf(t2.variant), 4, 1),
    );

    await callFn('order_cancel', `${q(o.result.orderId)}, ${q(buyerA)}, 'buyer'`);
    check(
      'Test 17: cancel NEW освободил обе позиции',
      isInv(await inventoryOf(t1.variant), 5, 0) && isInv(await inventoryOf(t2.variant), 5, 0),
    );

    const r = await callFn(
      'inventory_reconcile',
      `${q(t1.variant)}, ${q(owner)}, 2, 'HARNESS', ${q(o.result.orderId)}`,
    );
    check(
      'Test 17: order-aware reconcile отменённой позиции → INSUFFICIENT_HELD',
      !r?.ok && /INSUFFICIENT_HELD/.test(String(r.error)),
      r?.error,
    );
    check(
      'Test 17: оба стока не тронуты',
      isInv(await inventoryOf(t1.variant), 5, 0) && isInv(await inventoryOf(t2.variant), 5, 0),
    );
  }

  // Test 18 — повторная order-aware сверка того же REFUSED-заказа идемпотентна.
  {
    const t = await seedProduct({ available: 5 });
    const o = await callFn('create_order_atomic', checkoutArgs(buyerA, `t18_${S}`, [{ variantId: t.variant, quantity: 2 }]));
    await callFn('order_transition', `${q(o.result.orderId)}, ${q(owner)}, 'IN_TRANSIT'`);
    await callFn('order_transition', `${q(o.result.orderId)}, ${q(owner)}, 'DELIVERED'`);
    await callFn('order_delivery_outcome', `${q(o.result.orderId)}, ${q(owner)}, 'REFUSED', 'DAMAGED'`);

    const first = await callFn(
      'inventory_reconcile',
      `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS', ${q(o.result.orderId)}`,
    );
    check('Test 18: первая сверка REFUSED → ok', first?.ok === true, first?.error);
    check('Test 18: available=5, held=0', isInv(await inventoryOf(t.variant), 5, 0));

    const second = await callFn(
      'inventory_reconcile',
      `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS', ${q(o.result.orderId)}`,
    );
    check(
      'Test 18: повторная сверка → INSUFFICIENT_HELD',
      !second?.ok && /INSUFFICIENT_HELD/.test(String(second.error)),
      second?.error,
    );
    check('Test 18: сток не изменился (5,0)', isInv(await inventoryOf(t.variant), 5, 0));

    const moves = num(
      await scalar(
        `select count(*) from public.inventory_movements
         where order_id = ${q(o.result.orderId)} and movement_type = 'MANUAL_RECONCILE'`,
      ),
    );
    check('Test 18: ровно одно MANUAL_RECONCILE движение', moves === 1, `n=${moves}`);
  }

  // Test 19 — variant-wide атрибутирует освобождение заказу (0044): после отмены
  // IN_TRANSIT-заказа variant-wide не даёт повторно освободить его резерв и не
  // трогает резерв активного заказа.
  {
    const t = await seedProduct({ available: 5 });
    await callFn('create_order_atomic', checkoutArgs(buyerB, `t19b_${S}`, [{ variantId: t.variant, quantity: 3 }]));
    const oA = await callFn('create_order_atomic', checkoutArgs(buyerA, `t19a_${S}`, [{ variantId: t.variant, quantity: 2 }]));
    await callFn('order_transition', `${q(oA.result.orderId)}, ${q(owner)}, 'IN_TRANSIT'`);
    await callFn('order_cancel', `${q(oA.result.orderId)}, ${q(owner)}, 'seller'`);
    check('Test 19: A(IN_TRANSIT cancel)+B → available=0, held=5', isInv(await inventoryOf(t.variant), 0, 5));

    // variant-wide «Всё в наличии»: релизабельно только held A (2), B активен (3).
    const wide = await callFn('inventory_reconcile', `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS'`);
    check(
      'Test 19: variant-wide освободил 2 → available=2, held=3',
      wide?.ok === true && isInv(await inventoryOf(t.variant), 2, 3),
      wide?.error,
    );

    const attributed = num(
      await scalar(
        `select coalesce(sum(quantity),0) from public.inventory_movements
         where order_id = ${q(oA.result.orderId)} and movement_type = 'MANUAL_RECONCILE'`,
      ),
    );
    check('Test 19: движение атрибутировано заказу A', attributed === 2, `n=${attributed}`);

    const again = await callFn(
      'inventory_reconcile',
      `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS', ${q(oA.result.orderId)}`,
    );
    check(
      'Test 19: order-aware сверка A → INSUFFICIENT_HELD',
      !again?.ok && /INSUFFICIENT_HELD/.test(String(again.error)),
      again?.error,
    );
    check('Test 19: резерв B не тронут (available=2, held=3)', isInv(await inventoryOf(t.variant), 2, 3));
  }

  // Test 20 — variant-wide распределяет освобождение по нескольким релизабельным заказам.
  {
    const t = await seedProduct({ available: 6 });
    const oA = await callFn('create_order_atomic', checkoutArgs(buyerA, `t20a_${S}`, [{ variantId: t.variant, quantity: 2 }]));
    const oB = await callFn('create_order_atomic', checkoutArgs(buyerB, `t20b_${S}`, [{ variantId: t.variant, quantity: 2 }]));
    for (const o of [oA, oB]) {
      await callFn('order_transition', `${q(o.result.orderId)}, ${q(owner)}, 'IN_TRANSIT'`);
      await callFn('order_transition', `${q(o.result.orderId)}, ${q(owner)}, 'DELIVERED'`);
      await callFn('order_delivery_outcome', `${q(o.result.orderId)}, ${q(owner)}, 'REFUSED', 'DAMAGED'`);
    }
    check('Test 20: два REFUSED → available=2, held=4', isInv(await inventoryOf(t.variant), 2, 4));

    const wide = await callFn('inventory_reconcile', `${q(t.variant)}, ${q(owner)}, 4, 'HARNESS'`);
    check(
      'Test 20: variant-wide освободил 4 → available=6, held=0',
      wide?.ok === true && isInv(await inventoryOf(t.variant), 6, 0),
      wide?.error,
    );

    const attributed = num(
      await scalar(
        `select count(*) from public.inventory_movements
         where variant_id = ${q(t.variant)} and movement_type = 'MANUAL_RECONCILE'`,
      ),
    );
    check('Test 20: два атрибутированных движения (по заказу)', attributed === 2, `n=${attributed}`);

    const again = await callFn(
      'inventory_reconcile',
      `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS', ${q(oA.result.orderId)}`,
    );
    check(
      'Test 20: повторная order-aware A → INSUFFICIENT_HELD',
      !again?.ok && /INSUFFICIENT_HELD/.test(String(again.error)),
      again?.error,
    );
    check('Test 20: сток не изменился (6,0)', isInv(await inventoryOf(t.variant), 6, 0));
  }

  // Test 21 — конкурентные order_cancel и order-aware inventory_reconcile одного
  // заказа не образуют дедлок (единый порядок блокировок orders -> inventory, 0045).
  {
    const t = await seedProduct({ available: 5 });
    const o = await callFn('create_order_atomic', checkoutArgs(buyerA, `t21_${S}`, [{ variantId: t.variant, quantity: 2 }]));

    const [cancel, reconcile] = await Promise.all([
      callFn('order_cancel', `${q(o.result.orderId)}, ${q(buyerA)}, 'buyer'`),
      callFn('inventory_reconcile', `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS', ${q(o.result.orderId)}`),
    ]);

    const deadlock = [cancel, reconcile].some((r) => !r?.ok && /deadlock/i.test(String(r.error)));
    check(
      'Test 21: нет дедлока между отменой и сверкой',
      deadlock === false,
      `${cancel?.error} | ${reconcile?.error}`,
    );
    check('Test 21: отмена NEW прошла', cancel?.ok === true, cancel?.error);
    check(
      'Test 21: сверка не освободила повторно',
      !reconcile?.ok && /ORDER_NOT_RECONCILABLE|INSUFFICIENT_HELD/.test(String(reconcile.error)),
      reconcile?.error,
    );
    check('Test 21: сток консистентен (available=5, held=0)', isInv(await inventoryOf(t.variant), 5, 0));
  }

  // Test 22 — те же две операции на REFUSED-заказе: без дедлока.
  {
    const t = await seedProduct({ available: 5 });
    const o = await callFn('create_order_atomic', checkoutArgs(buyerA, `t22_${S}`, [{ variantId: t.variant, quantity: 2 }]));
    await callFn('order_transition', `${q(o.result.orderId)}, ${q(owner)}, 'IN_TRANSIT'`);
    await callFn('order_transition', `${q(o.result.orderId)}, ${q(owner)}, 'DELIVERED'`);
    await callFn('order_delivery_outcome', `${q(o.result.orderId)}, ${q(owner)}, 'REFUSED', 'DAMAGED'`);

    const [cancel, reconcile] = await Promise.all([
      callFn('order_cancel', `${q(o.result.orderId)}, ${q(owner)}, 'seller'`),
      callFn('inventory_reconcile', `${q(t.variant)}, ${q(owner)}, 2, 'HARNESS', ${q(o.result.orderId)}`),
    ]);

    const deadlock = [cancel, reconcile].some((r) => !r?.ok && /deadlock/i.test(String(r.error)));
    check('Test 22: нет дедлока (REFUSED)', deadlock === false, `${cancel?.error} | ${reconcile?.error}`);
    check('Test 22: сверка REFUSED прошла', reconcile?.ok === true, reconcile?.error);
    check(
      'Test 22: отмена терминального → ORDER_TERMINAL',
      !cancel?.ok && /ORDER_TERMINAL/.test(String(cancel.error)),
      cancel?.error,
    );
    check('Test 22: сток консистентен (available=5, held=0)', isInv(await inventoryOf(t.variant), 5, 0));
  }
}

try {
  await raw(HARNESS_TRY);
  const seeded = await seedStore();
  owner = seeded.ownerId;
  store = seeded.storeId;
  buyerA = await seedUser();
  buyerB = await seedUser();
  await run();
} catch (e) {
  failed += 1;
  console.error('[commerce-harness] fatal:', e?.message || e);
} finally {
  try {
    await cleanup();
    console.log('[commerce-harness] cleanup done');
  } catch (e) {
    failed += 1;
    console.error('[commerce-harness] cleanup failed:', e?.message || e);
  }
}

console.log(`\n[commerce-harness] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
