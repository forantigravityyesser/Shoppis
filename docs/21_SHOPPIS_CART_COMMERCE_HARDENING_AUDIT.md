# SHOPPIS — CART / COMMERCE HARDENING AUDIT

**Version:** 1.0
**Дата:** 2026-10-05
**Репозиторий:** `forantigravityyesser/Shoppis`
**Базовый срез кода:** `main @ dfcde99` («docs: inventory reconstruction changelog row») + рабочее дерево (`INV-HARDEN-01` — независимые оси цены/скидки в JS, не закоммичено).
**Объект:** сквозной коммерческий контур **Cart → Checkout → Order → Inventory lifecycle**: Cart domain/state/read-model/reconciliation, checkout-форма и её граница, order slice, SQL checkout (`create_order_atomic`), idempotency, inventory lifecycle (AVAILABLE/HELD), seller stock mutation, tests, docs.
**Вне области:** buyer Home/Catalog/Product Detail (hardened — `15`/`17`/`14`), seller Inventory UI-корректность (отдельный hardening — `19`/`20`), RLS/безопасность (`11` S1), промокоды/доставка-как-услуга/налоги/платёжный шлюз, экраны Favorites/Orders (roadmap — `16` FD-3), языки/валюты.

**Связанные документы:** `01` (Constitution), `02` (Product Spec §11–12), `03` (Domain & Database Spec §9–10, §11–18, §24–25, §29), `04` (Technical Spec §4–5, §9, §11–12, §18), `05` (Implementation Plan), `08` (Divergence), `11` (Hardening Backlog), `16` (Remaining Work, FD-3), `17` (Catalog Plan), `18` (Cart Plan — authoritative для Cart), `19` (Inventory Reconstruction), `20` (Seller Inventory Hardening Audit — владелец P0 независимых осей цены).

**Статус документа:** authoritative для **commerce hardening** (второй слой поверх реализованного Cart). Переносит внешний аудит Cart/Commerce в формат проекта, сверяет его с фактическим кодом, фиксирует целевые решения и порядок исправлений. Он **не пересматривает** продукт/UX-решения, уже зафиксированные в `00`/`18` (в частности: получатель — адрес доставки, а не email; итог — только в CTA). Там, где внешний аудит расходится с зафиксированными решениями, документ это явно помечает (⏭️) и не превращает в работу.

> **Разбор кода — обязателен к прочтению:** `Приложение A` содержит сверку каждого тезиса с фактическим кодом (`файл:строка`), карту живых SQL-функций, матрицу покрытия тестами и нумерацию миграций.

---

## 0. Метод и легенда

Документ построен в два движения:

1. **Разбор** — сверка каждого тезиса внешнего аудита с фактическим кодом на срезе `dfcde99` + рабочее дерево. Аудит писался по памяти и частично по устаревшему состоянию: одно требование противоречит зафиксированному продуктовому решению (email), другой P0 уже частично закрыт (`INV-HARDEN-01`), третий тезис (UI) отменён решением `CART-03`. Разбор — §2; детальная таблица — `Приложение A.2`.
2. **Идея** — зафиксированная целевая модель, решения и порядок hardening — §3–§16.

Легенда статуса:

| Метка | Значение |
|---|---|
| ✅ | Реализовано в коде и проверено (указан файл/строка) |
| 🟡 | Частично: часть уже есть, часть остаётся |
| ❌ | Не реализовано / отсутствует |
| 🔄 | Решение меняется относительно внешнего аудита |
| ⏭️ | Устарело / противоречит зафиксированному решению: работы нет |
| 🧊 | Deferred: осознанно отложено, с триггером включения |

Severity hardening: **H1** обязательно · **H2** высоко · **H3** средне · **H4** косметика.

---

## 1. Финальный вердикт

Оценка внешнего аудита сохранена как позиция аудитора; в скобках — уточнение после сверки с кодом.

| Область | Оценка |
|---|---|
| Onion / слои | **9.2/10** (подтверждено) |
| Cart state / model | **8.8/10** (подтверждено) |
| Read-model / reconciliation | **9.0/10** (подтверждено) |
| UI decomposition | **9.0/10** (подтверждено) |
| UX states | **8.7/10** (подтверждено) |
| Product → Cart связь | **8.2/10** (подтверждено) |
| Cart → Checkout | **7.5/10** (подтверждено) |
| Price correctness | **6/10** 🔴 (в рабочем дереве JS-часть закрыта → **7.5/10**; SQL ждёт `20 INV-HARDEN-02`) |
| Inventory/order consistency | **6.5/10** 🔴 (подтверждено) |
| Idempotency/retry safety | **5.5/10** 🔴 (подтверждено) |
| Test coverage критических commerce-сценариев | **7/10** (подтверждено; SQL/интеграции нет) |
| Документация/код в синхроне | **6.5/10** (подтверждено для commerce-части) |
| **Общая готовность блока** | **~7.4/10** |

### Главное

- Архитектурно Cart сделан **хорошо**: это один из наиболее качественно построенных buyer-блоков. Переписывать Zustand/React Query/Onion/базу **не надо**.
- Но **commerce-фундамент не закрыт**. Причина не в Cart, а в том, что Cart — первая точка, где сходятся Product → Variant → Inventory → Price → Order, и здесь обнажаются денежные и целостностные дефекты.
- Реальная работа — **commerce hardening**:
  1. 🔴 **P0/H1** — idempotency retry + SQL race; серверный quantity contract; `held_quantity` custody; SQL/integration/concurrency тесты.
  2. 🔴 **P0/H1 (наследие)** — независимые оси цены/скидки: JS закрыт (`INV-HARDEN-01`), SQL — `INV-HARDEN-02` (`20`).
  3. 🟠 **P1/H2** — checkout error → reconciliation; select-all только orderable; `MAX_CART_ITEMS` вместо silent truncation; deterministic unavailable; разделение `cart-rules`/`checkout-rules`; Cart→Checkout integration-тесты.
  4. 🟡 **P2/H3–H4** — `BuyerCartItem` (non-null variant), selection summary.
  5. 🧊 Deferred с триггером — realtime availability.
- Два тезиса аудита **отклоняются** как противоречащие зафиксированным решениям: **email вместо адреса** (⏭️) и **отдельный `CartTotalCard`** (⏭️).

### Что сделано реально хорошо (не трогаем)

- `CartItem` остаётся минимальным (`productId`, `productVariantId`, `quantity`, `price`, `selected`) — без `title`/`image`/`stock` в состоянии (`cart.ts:1-9`).
- Трёхслойность `state ≠ read model ≠ UI model`: `CartItem` + `storefront_cart_items_read` → `CartItemView` → `CartItemCard`.
- Реконсиляция построена верно: если товар/вариант исчез из витрины — удаляется из Cart; устаревшие ссылки чистятся идемпотентно (`cart-reconciliation.ts`, `useBuyerCart.ts:97-99`).
- Cart **не резервирует** inventory; checkout делает `lock variant → lock inventory → check stock → price → order → AVAILABLE→HELD`.
- **Server-side price revalidation**: checkout отправляет `variantId + quantity`, а не сумму; цену считает сервер (`checkout-api.ts:20-23`, `0004:130-138`).
- Onion-дисциплина соблюдена; God-файлов нет; `CartView` — не God.

---

## 2. Разбор аудита против кода

### 2.0 Что в аудите устарело / противоречит решениям

| Тезис аудита | Реальность | Вывод |
|---|---|---|
| P0 №1: получатель — **ФИО / телефон / email**; перевести всю цепочку на `buyer_email_snapshot` | `00` (стр. 39–40), `18 §24` и Приложение B.1 фиксируют: получатель — **адрес доставки**, email не запрашиваем/не храним; `RecipientInfo { name, phone, address }` (`customer.ts:1-5`), `checkout-rules.ts` (адрес), `process-checkout` (`p_address`), `0003:12` `buyer_address_snapshot` | ⏭️ **отклонено** (подтверждено заказчиком). Работы нет |
| §21 / P2: нужен отдельный `CartTotalCard` («чековый» блок «Итого») | `18 §13/§21–22` и `CART-03` фиксируют: отдельный блок **удалён**, итог только в CTA (`CartCheckoutBar.tsx:11-27`; `CartView.test.tsx:193`) | ⏭️ **отклонено** (подтверждено заказчиком). Работы нет |
| §12 / P0 №4: `useInventoryActions` всё ещё `custom = priceMode==='CUSTOM' || discountMode==='CUSTOM'`; `effectivePrice` гейтит скидку по custom-цене | В рабочем дереве `INV-HARDEN-01` закрыт: `toCatalogFields`/`resolveCategoryId` вынесены в `application/rules/product-mapping.ts`; `addVariant` — независимые оси; `effectivePrice` (`product-rules.ts:40-56`) — per-axis `coalesce` | 🟡 **JS закрыт, SQL ждёт** — наследие `20 INV-HARDEN-02`. Дублировать план в `21` не нужно |
| §23 (Test 4): «checkout должен уметь пересчитать цену» | Уже так: сервер — источник истины цены (`0004:130-138`), клиент не отправляет сумму | ✅ подтверждено; остаётся **тест** на stale price (P1) |
| §24: «CI зелёный» | Верно, `dfcde99` — `typecheck/lint/test/build` success | ✅ подтверждено; но «green CI ≠ correctness» (§2.3) |

### 2.1 Ревизия подтверждённых тезисов

| № | Тезис аудита | Статус | Факт в коде |
|---|---|---|---|
| 1 | `placeOrder` генерирует новый `idempotencyKey` каждый вызов | ❌ подтверждён | `order-slice.ts:184` `idempotencyKey: crypto.randomUUID()`; fallback `checkout-api.ts:19` |
| 2 | SQL idempotency — check-then-insert (mapping пишется **после** заказа) | ❌ подтверждён | `0004:46-66` select → `0004:84-93` insert order → `0004:198-202` insert `on conflict do nothing` |
| 3 | Конкурентные запросы с одним ключом могут создать два заказа | ❌ подтверждён | Тот же участок: до вставки mapping обе транзакции проходят select |
| 4 | Server не ограничивает quantity по `MAX_CART_QTY = 99` | ❌ подтверждён | `process-checkout.js:69-72` только `Number.isInteger && >0`; `0004:97-100` только `v_qty <= 0` |
| 5 | Duplicate variant в payload не отклоняется | ❌ подтверждён | `checkout-api.ts:20-23` и `process-checkout.js:69-72` мапят каждый item отдельно; RPC цикл `0004:95+` — каждый item отдельной строкой |
| 6 | `held_quantity` можно менять вручную из seller stock editor | ❌ подтверждён | `StockControlSheet.tsx:76-98` (`patch.heldQuantity`) + `:156-166` input; `product-repository.ts:415-421` прямой UPDATE `inventory` |
| 7 | `moveHeldToAvailable` — клиентский read-modify-write через generic UPDATE | ❌ подтверждён | `product-slice.ts:263-273` → `updateVariantStock(...)`; серверный `inventory_reconcile` существует (`0007`), но не используется для этого действия |
| 8 | Checkout error не триггерит Cart reconciliation | ❌ подтверждён | `useCheckout.ts:116-139` только `setError(mapCheckoutError(...))`; `buyer-cart` query не инвалидируется |
| 9 | `setAllSelected(true)` выбирает и неоформляемые позиции | ❌ подтверждён | `cart-slice` `setAllSelected`; `canCheckoutReconciled` затем блокирует CTA |
| 10 | RPC Cart молча режет список ссылок (`ord <= 100`) | ❌ подтверждён | `0036:64-68` `where ord <= 100`; `MAX_CART_ITEMS` во frontend отсутствует |
| 11 | `canCheckout(items, recipient)` смешивает Cart и recipient | 🟡 подтверждён | `cart-rules.ts:81-90` тянет `recipient`; но `checkout-rules.ts:59-69` (`validateRecipient`) уже выделен |
| 12 | `productVariantId` nullable | 🟡 подтверждён | `cart.ts:4`; `checkedOutItemKeys` фильтрует `!== null` (`cart-rules.ts:55-59`) |
| 13 | Нет SQL/интеграционных/concurrency тестов checkout | ❌ подтверждён | Нет тестов `process-checkout`, `create_order_atomic`, `order_idempotency`; нет теста `CartCheckoutBar` |
| 14 | Onion не нарушен | ✅ подтверждено | `presentation → insforge/SQL` — 0; `domain → React/Zustand` — 0 |
| 15 | `CartView` — не God | ✅ подтверждено | композиция + hooks; логика в `useBuyerCart`/`useCheckout` |

**Вывод разбора:** архитектуру трогать не нужно; реальная работа — §4–§8. Тезиз об email и `CartTotalCard` — отклонены; variant price — наследие `20`.

### 2.2 Точная граница P0 (важно)

```text
FRONTEND checkout attempt
  order-slice.placeOrder            ❌ P0-01 (key per call)
        ↓
EDGE process-checkout               ❌ P0-03 (нет max/дублей)
        ↓
SQL create_order_atomic             ❌ P0-02 (idempotency race)
   └── inventory AVAILABLE→HELD      ❌ P0-04 (held editable снаружи)
        ↓
ORDER + immutable snapshots         ✅ (цена/товар — уже snapshot)
```

`P0-05` (независимые оси цены) — **общий** с `20`:
`JS ✅ (INV-HARDEN-01)` → `SQL 0037 ⬜ (INV-HARDEN-02)`. Пока SQL не применён, buyer/checkout считают цену по связанному гейту (`0004:130-136`).

### 2.3 «Зелёный CI ≠ correctness»

На `dfcde99` pipeline (`typecheck / lint / test / build`) — `success`. Но:
- тесты контура Cart/Checkout — **unit/mock**, SQL и edge не исполняются;
- concurrency/idempotency не проверяются вовсе;
- `test` зелёный не доказывает инвариант «не создать два заказа» и «не зарезервировать чужой сток».

Найденные P0 — это ровно те места, которые `11 §S2` («критические SQL-тесты перед первыми реальными заказами») помечал как гейт. Аудит их подтвердил, а не открыл заново.

---

## 3. Authoritative решения

### 3.1 Idempotency: один checkout attempt — один ключ

Ключ создаётся **на attempt**, а не на каждый `placeOrder`:

```text
Оформление (submit)
    ↓
создать checkoutAttemptId / idempotencyKey
    ↓
отправка
    ↓ (network timeout / неизвестный результат)
повтор
    ↓
ТОТ ЖЕ idempotencyKey
    ↓
сервер возвращает уже созданный заказ
```

- Frontend: ключ живёт в рамках открытой checkout-сессии (например, `useCheckout` держит `useRef`/состояние, сброс при `reset`/успехе); повторный submit не генерирует новый.
- Fallback в `checkout-api.ts` сохраняется только как защита от отсутствия ключа; UI всегда передаёт явный.
- UX при повторном submit: кнопка блокируется (`submitting`), ошибка — с явным «Повторить»; повтор использует тот же ключ.

### 3.2 SQL idempotency: reserve-before-order

Атомарная схема get-or-create записи idempotency **до** создания заказа:

```text
1. INSERT INTO order_idempotency (key, buyer, order_id = null)
       ON CONFLICT (buyer, key) DO NOTHING
2. SELECT ... FOR UPDATE  (взять строку под блокировку)
3. если order_id IS NOT NULL → вернуть существующий заказ (idempotent: true)
4. если order_id IS NULL → создать Order и заполнить строки
5. UPDATE order_idempotency SET order_id = v_order_id WHERE ...
```

Плюс: строки `order_idempotency` с `order_id = null` — это «резерв», он не мешает повтору завершить операцию, но гарантирует, что второй параллельный запрос не создаст второй заказ (он дождётся или вернёт существующий). Совместимость: существующая таблица (`0003:69-76`) уже имеет `unique (buyer_user_id, idempotency_key)` и `order_id` nullable — переиспользуем, добавляем только `FOR UPDATE`-семантику в функции.

### 3.3 Server quantity contract

Единый контракт:

```text
MIN_QTY = 1
MAX_ORDER_ITEM_QTY = 99   (= MAX_CART_QTY, docs/18 §11)
```

- Общий доменный источник `MAX_CART_QTY` (`limits.ts:1`) — эталон; SQL/edge отражают то же число (константа в миграции + проверка в edge).
- **Duplicate variant:** проверенный клиент не должен отправлять два раза один variant; сервер обязан не доверять. Принимается **reject** на границе checkout (клиент обязан отправлять нормализованный Cart): edge и/или RPC отклоняют `VARIANT_DUPLICATE`, если один `variantId` встречается >1 раза в payload. (Альтернатива «aggregate» отклонена: усложняет счётчик и скрывает баг клиента.)
- Проверка верхней границы — в edge (`process-checkout.js`) **и** в RPC (`create_order_atomic`), а не только во frontend.

### 3.4 `held_quantity` — очередь заказа, не поле стока

`held_quantity` означает «зарезервировано конкретными заказами». Его меняют **только** lifecycle-операции:

```text
checkout            AVAILABLE → HELD
buyer cancel NEW    HELD → AVAILABLE
delivered RECEIVED  HELD → DELIVERED
cancel IN_TRANSIT   HELD (без движения)
REFUSED             HELD (без движения, до reconcile)
inventory_reconcile HELD → AVAILABLE (явная операция)
```

Решения:
- В `StockControlSheet` поле «В ожидании» — **read-only** (показ). Продавец не редактирует `held`.
- «Всё в наличии» (held → available) заменяется на **явную lifecycle-aware операцию** `inventory_reconcile` (серверный RPC, `0007`), а не client read-modify-write через generic `updateVariantStock`.
- `updateVariantStock` перестаёт принимать `heldQuantity` в публичном seller-контракте (или получает серверный guard, отвергающий прямую запись `held`).

### 3.5 `MAX_CART_ITEMS`

Вводим явный лимит числа позиций корзины, единый для UI, application и RPC:

```text
MAX_CART_ITEMS = 100
```

- Application/store отказывает/останавливает добавление сверх лимита (а не молча теряет при чтении).
- RPC `storefront_cart_items_read` перестаёт быть единственным местом cap'а: либо совместимый cap с явным сигналом усечения, либо chunked read для legacy-корзины (предпочтительно: не терять молча).
- Нормальный UI никогда не приближается к лимиту; контракт защищает от старых/ручных данных.

### 3.6 Checkout error → Cart reconciliation

При ошибках, означающих «состояние корзины устарело» (`INSUFFICIENT_STOCK`, `PRODUCT_NOT_ACTIVE`, `VARIANT_NOT_FOUND`, `INVENTORY_NOT_FOUND`, `STORE_PAUSED`), `useCheckout` инициирует refetch/reconcile активной `buyer-cart` query (targeted invalidation по текущему `publicId`). Пользователь видит актуальное состояние без ручного выхода/обновления.

### 3.7 Select All — только orderable

«Выбрать все» выбирает **только заказываемые** позиции (`orderable` из reconciliation). Неоформляемые остаются `selected = false` и не блокируют CTA; покупатель может исправить количество вручную.

### 3.8 Разделение правил

- `cart-rules.ts` → `canCheckoutCart(items)` (только корзина: есть выбранные + валидные количества).
- `checkout-rules.ts` → `validateRecipient(recipient)` (только получатель; уже существует).
- Application (`useCheckout`/`placeOrder`) комбинирует обе проверки.

---

## 4. P0 — Commerce correctness (`H1`)

### P0-01 — Idempotency retry safety (frontend)

**Проблема.** `order-slice.ts:184` генерирует новый `crypto.randomUUID()` на каждый `placeOrder`. При потере ответа/повторе создаётся второй заказ.

**Решение.** §3.1. Один ключ на checkout attempt; повтор использует тот же.

**Файлы.** `order-slice.ts` (`placeOrder`), `contracts/checkout.ts`, `useCheckout.ts`, `checkout-api.ts` (fallback), `order-slice.test.ts`, `useCheckout.test.tsx`.

**Тесты.** Lost-response retry → один заказ; повторный submit при ошибке → тот же key.

### P0-02 — SQL idempotency race (reserve-before-order)

**Проблема.** `0004:46-66` (select) → `0004:84-93` (insert order) → `0004:198-202` (insert mapping). Два параллельных запроса с одним ключом создадут два заказа.

**Решение.** §3.2 — миграция (следующий свободный номер `0038`, `0037` зарезервирован под `20 INV-HARDEN-02`) пересоздаёт `create_order_atomic` с reserve-before-order.

**Тесты.** Retry с тем же ключом → 1 заказ, 1 резерв; параллельные одинаковые ключи → 1 заказ (§9, Test 2–3).

### P0-03 — Server quantity contract (1..99 + duplicate variant)

**Проблема.** `process-checkout.js:69-72` и `0004:97-100` принимают любое положительное целое; дубли variant не отклоняются.

**Решение.** §3.3: `1..99` (общая константа), reject duplicate variant на checkout boundary; проверка в edge **и** RPC.

**Файлы.** `edge-functions/process-checkout.js`, миграция `create_order_atomic`, `limits.ts`, `checkout-api.ts`.

**Тесты.** `quantity=100`/`0`/`-1` → reject; `[A50, A50]` → reject; нормализованный `[A50]` → ok.

### P0-04 — `held_quantity` custody (seller не редактирует напрямую)

**Проблема.** `StockControlSheet.tsx:76-98,156-166` → `product-repository.ts:415-421` пишет `inventory.held_quantity` прямым UPDATE, минуя `inventory_reconcile`/movements. Рассинхрон с заказами → нарушение инвариантов.

**Решение.** §3.4: `held` read-only в seller UI; «Всё в наличии» → серверный `inventory_reconcile`; `updateVariantStock` не принимает `heldQuantity` (или серверный guard).

**Файлы.** `StockControlSheet.tsx`, `useInventoryActions.ts`, `product-slice.ts` (`moveHeldToAvailable`), `product-repository.ts`, `ports/product-repository.ts`, `inventory-view.ts`, SQL guard (при необходимости).

**Тесты.** Seller не может задать `held`; перенос held→available идёт через `inventory_reconcile` с movement; попытка прямой записи отклоняется.

### P0-05 — Независимые оси custom-цены и custom-скидки (наследие `20`)

**Проблема.** Buyer/checkout SQL (`0004:130-136` и 7 read-функций) гейтят цену **и** скидку по `custom_original_amount_minor is not null`. При custom только по скидке цена замораживается.

**Статус.** JS-часть закрыта (`INV-HARDEN-01`, рабочее дерево: `product-mapping.ts`, `addVariant`, `product-rules.ts:40-56`). Остаётся SQL — **уже запланирован в `20` как `INV-HARDEN-02`** (миграция `0037`).

**Решение.** В `21` **не дублируем**. `P0-05` считается закрытым только после `INV-HARDEN-02`; `21` фиксирует зависимость и порядок (`0037` → `0038`).

### P0-06 — SQL / integration / concurrency тесты (DoD commerce)

**Проблема.** Нет тестов `process-checkout`, `create_order_atomic`, `order_idempotency`, `CartCheckoutBar`; unit-тесты не доказывают инварианты.

**Решение.** Тестовый harness (SQL/функциональный) + сценарии §9 (Test 1–9). Без них commerce-контур не считается hardened.

---

## 5. P1 — Консистентность и UX (`H2`)

1. **Checkout conflict → Cart reconciliation** (§3.6): `INSUFFICIENT_STOCK` / `PRODUCT_NOT_ACTIVE` / `VARIANT_NOT_FOUND` / `INVENTORY_NOT_FOUND` / `STORE_PAUSED` → refetch `buyer-cart`, закрыть/актуализировать форму.
2. **Select All → только orderable** (§3.7).
3. **`MAX_CART_ITEMS` вместо silent `ord <= 100`** (§3.5): не терять позиции молча.
4. **Deterministic unavailable states**: единая модель `orderable`/причина (`zero stock` / `insufficient` / `product not active` / `paused`) вместо разрозненных проверок.
5. **Разделение `cart-rules` / `checkout-rules`** (§3.8).
6. **Cart → Checkout integration-тесты**: Product Detail → Cart → Checkout → успех/ошибка, сохранение Cart при ошибке, удаление только оформленных позиций.
7. **Stale price тест**: цена изменилась между Cart и Checkout → заказ по серверной (новой) цене.
8. **Archived-between-cart-and-checkout тест**: товар архивирован после Cart → нет заказа, нет изменения стока.

---

## 6. P2 — Чистота (`H3`–`H4`)

1. **`BuyerCartItem` vs `StoredCartItem`** (`H3`): разделить persisted-модель (nullable variant) и buy-side проекцию (variant гарантированно non-null); убрать `if (variantId)` из buyer-путей. Не срочно, но снижает defensive-шум.
2. **Selection toolbar** (`H4`): показывать «Выбрано 0» вместо «Все товары» как состояние по умолчанию/пустого выбора.

---

## 7. Deferred (🧊 с триггером)

| Пункт | Решение | Триггер включения |
|---|---|---|
| **Realtime inventory updates** (WebSocket/InsForge Realtime) | Не тащим ради Cart: authoritative checkout + refetch/reconciliation достаточно | Реальная потребность в live-доступности (частые конфликты стока у активных магазинов) — отдельный infrastructure-adapter |
| **`CartTotalCard`** | ⏭️ отклонён (решение `18`/`CART-03`: итог только в CTA) | Возврат к вопросу только при смене UX-решения заказчиком |
| **Email-получатель** | ⏭️ отклонён (решение `00`/`18`: адрес доставки) | Только явная смена продукт-контракта |
| **Broad P1.5/P2.2 крупный рефакторинг** | Отложен: hardening, не реконструкция | Не включать без новой реальной проблемы |

---

## 8. CART-HARDEN — план этапов

Один этап за раз: реализация → `typecheck`/`lint`/`test`/`build` → сверка → следующий.

### Phase A — P0 корректность

- **`CART-HARDEN-01`** 🔴 `H1` — ✅ выполнено (2026-10-05). Idempotency frontend: ключ живёт в рамках checkout-попытки (`useCheckout` `idempotencyKeyRef`), генерируется лениво при первом submit, переиспользуется при повторе, сбрасывается при успехе и `reset`; `placeOrder(recipient, idempotencyKey)` пробрасывает ключ; fallback остаётся в `checkout-api`. Тесты: `useCheckout` (повтор → тот же key; успех/reset → новый), `order-slice` (проброс/отсутствие ключа). Cart/Checkout suite — **130/130**, `typecheck` чистый.
- **`CART-HARDEN-02`** 🔴 `H1` — ✅ выполнено (2026-10-05). SQL idempotency → reserve-before-order: миграция **`0038_checkout_idempotency_reserve.sql`** пересоздаёт `create_order_atomic` (`INSERT reservation ON CONFLICT DO NOTHING` → `SELECT … FOR UPDATE` → существующий `order_id` вернуть / иначе создать заказ → `UPDATE` mapping). Применена на dev и записана в `schema_migrations`; `migrations:check` — 38 файлов зелёный. Проверено: тело функции содержит reserve/`for update`/link (pg_proc); при ошибке reservation откатывается (0 «протечек»). Поведенческие concurrency-тесты (Test 2–3) — `CART-HARDEN-05`.
- **`CART-HARDEN-03`** 🔴 `H1` — ✅ выполнено (2026-10-05). Server quantity contract: новый `edge-functions/_shared/checkout-items.js` (`MAX_ITEM_QTY = 99`, reject `INVALID_CART_ITEM`/`INVALID_QUANTITY`/`VARIANT_DUPLICATE`), `process-checkout` валидирует позиции до RPC; миграция **`0039_checkout_item_contract.sql`** добавляет в `create_order_atomic` верхнюю границу `c_max_item_qty = 99` и `VARIANT_DUPLICATE`. Применена + записана (`migrations:check` 0001..0039). Edge пересобран и задеплоен (`6gw9q2czwr6p`). Коды локализованы в `useCheckout`. Тесты: `checkout-items` (+6).
- **`CART-HARDEN-04`** 🔴 `H1` — `held_quantity` custody: seller read-only, `inventory_reconcile`-перенос, guard (§3.4, P0-04).
- **`CART-HARDEN-04`** 🔴 `H1` — ✅ выполнено (2026-10-05). `held_quantity` custody: `VariantStockPatch`/`UpdateVariantStockPatch` больше не содержат `heldQuantity`; `product-repository.updateVariantStock` пишет только `available_quantity`; `StockControlSheet` показывает «В ожидании» **read-only**, а кнопка «Всё в наличии» вызывает `moveHeldToAvailable` → серверный `inventory_reconcile` (с movement и проверкой владельца), а не прямую запись. Тесты: `StockControlSheet` (+3). Серверный DB-guard на прямую запись `held` — часть permission-слоя (RLS, `11` S1).
- **`CART-HARDEN-05`** 🔴 `H1` — ✅ выполнено (2026-10-05). Harness `scripts/commerce-harness.mjs` (`npm run commerce:harness`): сидирует временный магазин на dev, гоняет **Test 1–9** через admin raw-SQL, ловит SQL-ошибки временным `_harness_try` (для точных кодов), затем чистит данные. **24/24 PASS**: нет оверселла (stock=1), retry и concurrent с одним ключом → 1 заказ, server-authoritative цена, archived/qty/duplicate reject, NEW cancel освобождает held, IN_TRANSIT cancel и REFUSED удерживают held до reconcile. Утечек нет.
- **`CART-HARDEN-06`** 🔴 `H1` — ✅ выполнено (2026-10-05). Гейт: `typecheck` ✅ · `lint` 0 errors (8 прежних warnings) · `test` **804/804** · `build` ✅ · `migrations:check` (0001..0039) ✅. Зависимость `20 INV-HARDEN-02` закрыта: миграция `0037` применена и записана; `P0-05` снят.

### Phase B — P1 консистентность

- **`CART-HARDEN-07`** 🟠 `H2` — ✅ выполнено (2026-10-05). Checkout conflict → reconciliation: `useCheckout` извлекает машинный код (`checkoutErrorCode`) и на `INSUFFICIENT_STOCK`/`PRODUCT_NOT_ACTIVE`/`VARIANT_NOT_FOUND`/`FOREIGN_VARIANT`/`INVENTORY_NOT_FOUND`/`STORE_PAUSED` инвалидирует `['buyer-cart']` (refetch → reconcile → актуальный UI). Тесты `useCheckout` (+2).
- **`CART-HARDEN-08`** 🟠 `H2` — ✅ выполнено (2026-10-05). Select-all только orderable + `MAX_CART_ITEMS`: `useBuyerCart` считает выбор и `selectionState` по orderable-позициям (`toggleAllOrderable`), неоформляемые не выбираются; `MAX_CART_ITEMS = 100` (enforcement при добавлении в `cart-slice`, chunked read в `cart-repository` — без молчаливой потери). Тесты `cart-slice`/`cart-repository`/`useBuyerCart`.
- **`CART-HARDEN-09`** 🟠 `H2` — ✅ выполнено (2026-10-05). Правила разделены: `cart-rules.canCheckoutCart(items)` (только корзина) + `checkout-rules.validateRecipient` (получатель), объединяются в `order-slice.placeOrder`. Integration-покрытие: stale price/archived — Test 4/5 harness, Cart→Checkout success/error — `order-slice`/`useCheckout`/`CartView`.

### Phase C — P2 чистота

- **`CART-HARDEN-10`** 🟡 `H3` — ✅ выполнено (2026-10-05). `BuyerCartItem` (`read-models/cart.ts`): persisted `CartItem` сохраняет nullable вариант, buy-side позиция — non-null; `ReconciledCartItem.item` сужен, `CartItemCard` принимает `BuyerCartItem`; non-null фиксируется при реконсиляции.
- **`CART-HARDEN-11`** 🟡 `H4` — ✅ выполнено (2026-10-05). Selection toolbar показывает «Выбрано N» (в т.ч. «Выбрано 0») вместо «Все товары».
- **`CART-HARDEN-12`** 🟠 `H1` — ✅ выполнено (2026-10-05). Docs-sync (`00`, `11`, `16`, `18`, `21`), финальный аудит (§12). `LOCAL`/`TELEGRAM VERIFIED` — за человеком.

### Рекомендуемый порядок

```text
0037 (20 INV-HARDEN-02: SQL price axes)  — зависимость
   ↓
01 Idempotency frontend (attempt key)
   ↓
02 SQL idempotency reserve-before-order (0038)
   ↓
03 Server quantity contract (1..99 + duplicate)
   ↓
04 held_quantity custody (inventory_reconcile)
   ↓
05 SQL/integration/concurrency harness (Test 1–9)
   ↓
06 Gate
   ↓
07 Checkout error → Cart reconciliation
   ↓
08 Select-all orderable + MAX_CART_ITEMS + unavailable
   ↓
09 cart-rules/checkout-rules + integration tests
   ↓
10 BuyerCartItem non-null
   ↓
11 Selection toolbar
   ↓
12 Docs sync + final audit
   ↓
(deferred с триггером: realtime availability)
```

После этого commerce-контур не трогать без новой реальной проблемы.

---

## 9. Матрица тестов

### Test 1 — stock = 1, два покупателя

```text
Buyer A → 1     Buyer B → 1
Ожидаем: A = SUCCESS, B = INSUFFICIENT_STOCK
         available = 0, held = 1
```

### Test 2 — retry после потерянного ответа

```text
same idempotency key, same checkout
Ожидаем: 1 order, 1 reservation
```

### Test 3 — конкурентные запросы с одним ключом

```text
request A ∥ request B, same key
Ожидаем: 1 order
```

### Test 4 — цена изменилась между Cart и Checkout

```text
Cart = $10 → seller changes = $12 → checkout
Ожидаем: Order = $12
```

### Test 5 — archived между Cart и Checkout

```text
Cart → seller archive → checkout
Ожидаем: NO ORDER, NO STOCK CHANGE
```

### Test 6 — quantity изменилось

```text
Cart = 5, inventory = 2 → checkout
Ожидаем: NO ORDER, NO HELD
```

### Test 7 — NEW cancel

```text
AVAILABLE 5 → checkout 2 → AVAILABLE 3 / HELD 2
→ cancel → AVAILABLE 5 / HELD 0
```

### Test 8 — IN_TRANSIT cancel

```text
HELD remains
```

### Test 9 — REFUSED

```text
HELD remains; только reconcile → HELD → AVAILABLE
```

### Дополнительно

- **Quantity contract:** 0 / -1 / 100 → reject; duplicate variant → reject.
- **Idempotency:** отсутствующий/пустой ключ; повтор с тем же/другим ключом.
- **held custody:** seller не пишет `held`; перенос held→available через `inventory_reconcile` + movement.
- **P0-05 (общий с `20`):** 4 комбинации осей цены/скидки в `detail/home/catalog/cart/checkout`.
- **Cart→Checkout:** success очищает только оформленные; error сохраняет Cart; stale price/archived.

---

## 10. Definition of Done

- [x] Один checkout attempt = один idempotency key; retry переиспользует его. _(01)_
- [x] SQL idempotency: reserve-before-order; параллельные одинаковые ключи → 1 заказ. _(02, Test 3)_
- [x] Server quantity `1..99`, duplicate variant rejected (edge + RPC). _(03, Test 6)_
- [x] Seller не редактирует `held_quantity`; переносы — lifecycle-aware (`inventory_reconcile`). _(04)_
- [x] SQL/integration/concurrency Test 1–9 зелёные. _(05)_
- [x] `P0-05` закрыт вместе с `20 INV-HARDEN-02` (SQL price axes, миграция `0037`). _(0037 записана)_
- [x] Checkout conflict → Cart reconciliation; select-all только orderable; `MAX_CART_ITEMS` без молчаливой потери. _(07–08)_
- [x] `cart-rules`/`checkout-rules` разделены. _(09)_
- [x] Нет новых архитектурных нарушений; God-файлы не появились.
- [x] `typecheck` / `lint` / `test` / `build` / `migrations:check` — зелёные. _(06)_
- [x] Docs синхронизированы (`00`, `11`, `16`, `18`, `21`). _(12)_
- [x] Deferred-пункты зафиксированы с триггером.
- [x] Нет unrelated refactor.

---

## 11. Что НЕ делаем

❌ переписывать Zustand/DI/Onion · ❌ server-side Cart · ❌ второй Cart-стор/калькулятор цены/модель товара · ❌ email-получатель · ❌ `CartTotalCard` (решение CTA-only) · ❌ realtime ради Cart (deferred с триггером) · ❌ промокоды/доставка-как-услуга/налоги/платёж · ❌ RLS (гейт `11` S1, отдельно) · ❌ крупный рефакторинг `BuyerCartItem` до Phase C · ❌ ручную проверку вместо человека.

---

## 12. Финальный Commerce hardening audit

**Статус:** `CART-HARDEN-01…12` выполнены. Commerce-фундамент закрыт (осталась ручная `LOCAL`/`TELEGRAM`-проверка за человеком). Повторный внешний аудит после этого захода — отдельно.

| Этап | Что сделано | Артефакты |
|---|---|---|
| 01 Idempotency frontend | ключ на checkout-попытку, reuse на retry, сброс на успех/reset | `useCheckout.ts`, `order-slice.ts`, тесты (+4) |
| 02 SQL idempotency (`0038`) | reserve-before-order; применена + записана | `0038_checkout_idempotency_reserve.sql`, `schema_migrations` |
| 03 Quantity contract | 1..99 + reject duplicate (edge + RPC) | `_shared/checkout-items.js`, `0039`, edge deploy, тесты (+6) |
| 04 held custody | seller read-only; переносы через `inventory_reconcile` | `product-repository`, `product-slice`, `StockControlSheet`, тесты (+3) |
| 05 SQL harness (Test 1–9) | `commerce:harness` 24/24 PASS | `scripts/commerce-harness.mjs`, `package.json` |
| 06 Gate | typecheck/lint/test/build/migrations:check зелёные | 812 тестов; `0037` записана |
| 07 Checkout → reconcile | конфликтные коды → invalidate `buyer-cart` | `useCheckout.ts`, тесты (+2) |
| 08 Select-all / MAX_CART_ITEMS | orderable-selection; лимит + chunked read | `useBuyerCart.ts`, `limits.ts`, `cart-slice.ts`, `cart-repository.ts`, тесты |
| 09 Rules split + integration tests | `canCheckoutCart` + `validateRecipient` | `cart-rules.ts`, `checkout-rules.ts`, `order-slice.ts`, тесты |
| 10 BuyerCartItem | buy-side вариант non-null | `read-models/cart.ts`, `cart-reconciliation.ts`, `CartItemCard.tsx` |
| 11 Selection toolbar | «Выбрано N» вместо «Все товары» | `CartSelectionToolbar.tsx`, `CartView.test.tsx` |
| 12 Docs sync | `00`/`11`/`16`/`18`/`21`, финальный аудит | этот документ |
| (общая) `20 INV-HARDEN-02` | SQL price axes `0037` применена + записана → `P0-05` снят | `0037_variant_effective_price_independent.sql` |

**Итог гейта:** `typecheck` ✅ · `lint` 0 errors · `test` **812/812** · `build` ✅ · `migrations:check` 0001..0039 ✅ · `commerce:harness` **24/24** ✅.

**Осталось за человеком:** ручная проверка Cart→Checkout в браузере и Telegram Mini App (`LOCAL`/`TELEGRAM VERIFIED`).

---

# Приложение A. Разбор относительно кода (2026-10-05)

## A.1 Метод

Сверка тезисов внешнего аудита и целевых решений с фактическим кодом `main @ dfcde99` + рабочее дерево. Источники: `src/**`, `edge-functions/**`, `migrations/**`, существующие тесты. Формат ссылок: `файл:строка`.

## A.2 Подтверждающие ссылки

| Место | Факт |
|---|---|
| `src/domain/models/cart.ts:1-9` | `CartItem` минимален; `productVariantId: string \| null` |
| `src/domain/constants/limits.ts:1` | `MAX_CART_QTY = 99` |
| `src/domain/rules/cart-rules.ts:19-21` | `isValidCartQuantity` (1..99) |
| `src/domain/rules/cart-rules.ts:55-59` | `checkedOutItemKeys` (filter `!== null`) |
| `src/domain/rules/cart-rules.ts:81-90` | `canCheckout(items, recipient)` — смешивает оси |
| `src/domain/rules/checkout-rules.ts:59-69` | `validateRecipient` уже выделен |
| `src/domain/models/customer.ts:1-5` | `RecipientInfo { name, phone, address }` |
| `src/application/read-models/cart.ts:53-71` | `CartItemView` (variant non-null во view) |
| `src/application/services/cart-reconciliation.ts:62-94` | `reconcileCart` (removedKeys, orderable, storePaused) |
| `src/application/services/cart-reconciliation.ts:101-105` | `canCheckoutReconciled` |
| `src/application/hooks/useBuyerCart.ts:81-87` | `useQuery(['buyer-cart', ...])` (цель инвалидации P1) |
| `src/application/hooks/useBuyerCart.ts:97-99` | идемпотентное удаление `removedKeys` |
| `src/application/hooks/useBuyerCart.ts:135` | `canCheckout` c `reconciling` |
| `src/application/hooks/useCheckout.ts:116-139` | `submit` → `placeOrder`, ошибка → message (нет reconcile) |
| `src/application/store/slices/order-slice.ts:164-200` | `placeOrder` |
| `src/application/store/slices/order-slice.ts:184` | `idempotencyKey: crypto.randomUUID()` — P0-01 |
| `src/application/contracts/checkout.ts:5-11` | `CheckoutPayload` (idempotencyKey optional) |
| `src/infrastructure/functions/checkout-api.ts:19` | fallback генерации key |
| `src/infrastructure/functions/checkout-api.ts:20-23` | items → `[{variantId, quantity}]` (без нормализации дублей) |
| `edge-functions/process-checkout.js:53-67` | body: storeId/idempotencyKey/items/recipient |
| `edge-functions/process-checkout.js:69-72` | quantity: только `integer && > 0` — P0-03 |
| `edge-functions/process-checkout.js:77-86` | RPC `create_order_atomic` (p_address) |
| `migrations/0004_checkout.sql:46-66` | idempotency select-first — P0-02 |
| `migrations/0004_checkout.sql:84-93` | insert order (snapshots, NEW) |
| `migrations/0004_checkout.sql:97-100` | `v_qty <= 0` → `INVALID_QUANTITY` (нет верхней границы) |
| `migrations/0004_checkout.sql:126-128` | `INSUFFICIENT_STOCK` (row lock inventory) |
| `migrations/0004_checkout.sql:130-136` | price gate по `custom_original_amount_minor is not null` — P0-05 |
| `migrations/0004_checkout.sql:168-172` | AVAILABLE → HELD |
| `migrations/0004_checkout.sql:198-202` | insert idempotency `on conflict do nothing` — P0-02 |
| `migrations/0003_orders.sql:10-13` | buyer snapshots (`buyer_address_snapshot`) — email не нужен |
| `migrations/0003_orders.sql:69-76` | `order_idempotency` (unique buyer+key, order_id nullable) |
| `migrations/0036_storefront_cart_items_read.sql:64-68` | `where ord <= 100` — P1-03 |
| `migrations/0036_storefront_cart_items_read.sql:104-108` | unit price (связанный гейт — P0-05) |
| `src/infrastructure/repositories/product-repository.ts:406-423` | `updateVariantStock` пишет `held_quantity` напрямую — P0-04 |
| `src/application/store/slices/product-slice.ts:263-273` | `moveHeldToAvailable` — client read-modify-write |
| `src/presentation/seller/inventory/product/StockControlSheet.tsx:76-98` | `patch.heldQuantity` |
| `src/presentation/seller/inventory/product/StockControlSheet.tsx:156-166` | editable input «В ожидании» |
| `migrations/0007_inventory_lifecycle.sql` | cancel NEW / RECEIVED / `inventory_reconcile` |

## A.3 Живые SQL-функции цены (общие с `20`)

Помечены как affected `P0-05`; SQL-фикс — `20 INV-HARDEN-02` (миграция `0037`): `create_order_atomic`, `storefront_product_detail_read`, `storefront_home_products_read`, `storefront_catalog_products_read`, `storefront_catalog_price_bounds_read`, `storefront_favorite_products_read`, `storefront_cart_items_read`. Полный список — `20` Приложение A.3.

## A.4 Инвентарь — карта `held_quantity`

| Операция | Миграция/код | Меняет `held` |
|---|---|---|
| Checkout reserve | `0004:168-172` | +qty (AVAILABLE→HELD) |
| Buyer cancel `NEW` | `0007:58` | −qty (HELD→AVAILABLE) |
| Delivered `RECEIVED` | `0007:196` | −qty (HELD→DELIVERED) |
| `inventory_reconcile` | `0007:234-290` | −qty (HELD→AVAILABLE) |
| Seller `StockControlSheet` | `product-repository.ts:415-421` | ⚠️ прямая запись (P0-04) |
| Seller `moveHeldToAvailable` | `product-slice.ts:263-273` | ⚠️ client RMW (P0-04) |

## A.5 Карта ошибок checkout

`ProcessCheckoutError` (edge `process-checkout.js:27-37`): `STORE_PAUSED`, `PRODUCT_NOT_ACTIVE`, `VARIANT_NOT_FOUND`, `INVENTORY_NOT_FOUND`, `INSUFFICIENT_STOCK`, `INVALID_QUANTITY`, `UNAUTHORIZED`, `NETWORK`, `UNKNOWN`; RPC добавляет `EMPTY_CART`, `FOREIGN_VARIANT`, `STORE_NOT_FOUND`. Целевое (P1): для `INSUFFICIENT_STOCK`/`PRODUCT_NOT_ACTIVE`/`VARIANT_NOT_FOUND`/`INVENTORY_NOT_FOUND`/`STORE_PAUSED` — инициировать reconcile.

## A.6 Матрица покрытия тестами (Cart/Checkout)

| Область | Тест | Статус |
|---|---|---|
| Cart rules | `cart-rules.test.ts` | ✅ |
| Cart slice | `cart-slice.test.ts` | ✅ |
| Reconciliation | `cart-reconciliation.test.ts` | ✅ |
| Cart mappers / repository | `cart-mappers.test.ts`, `cart-repository.test.ts` | ✅ (repository — mock RPC) |
| `useBuyerCart` | `useBuyerCart.test.tsx` | ✅ |
| `CartView` / `CartItemCard` / `CartQuantityControl` | соответствующие `*.test.tsx` | ✅ |
| `CheckoutFormSheet` / `CheckoutSuccess` / `StoreContactLink` | соответствующие `*.test.tsx` | ✅ |
| `useCheckout` | `useCheckout.test.tsx` | ✅ |
| `order-slice` placeOrder | `order-slice.test.ts` | ✅ (unit) |
| `CartCheckoutBar` | — | ❌ |
| `process-checkout` (edge) | — | ❌ |
| `create_order_atomic` / `order_idempotency` | — | ❌ |
| Concurrency (stock=1, same key) | — | ❌ |
| Stale price / archived-between | — | ❌ |

## A.7 Нумерация миграций

Последняя в репозитории — `0036_storefront_cart_items_read.sql`. `0037` зарезервирован под `20 INV-HARDEN-02` (SQL price axes). Commerce-hardening `21` начинает с **`0038`** (idempotency), последующие — `0039+` при необходимости.

---

## История изменений

| Дата | Изменение |
|---|---|
| 2026-10-05 | Создан `21`: перенос внешнего аудита Cart/Commerce в формат проекта, сверка с кодом (`dfcde99` + рабочее дерево `INV-HARDEN-01`), решения (§3), P0 (§4), P1 (§5), P2 (§6), deferred с триггером (§7), план `CART-HARDEN-01…12` (§8), тесты Test 1–9 (§9), DoD (§10). Отклонены как противоречащие решениям: email-получатель и `CartTotalCard`. `P0-05` (независимые оси цены) — общая зависимость с `20 INV-HARDEN-02`. |
| 2026-10-05 | `CART-HARDEN-01` выполнен (P0-01): idempotency-ключ на checkout-попытку в `useCheckout` (reuse на retry, сброс на успех/reset), `placeOrder` пробрасывает ключ; fallback остаётся в `checkout-api`. Тесты `useCheckout`/`order-slice`; Cart/Checkout suite 130/130, `typecheck` чистый. |
| 2026-10-05 | `CART-HARDEN-02` выполнен (P0-02): миграция `0038_checkout_idempotency_reserve.sql` — `create_order_atomic` переведён на reserve-before-order (`INSERT … ON CONFLICT DO NOTHING` → `SELECT … FOR UPDATE` → `UPDATE order_id`). Применена на dev, записана в `schema_migrations`, `migrations:check` (0001..0038) зелёный; тело проверено по `pg_proc`, откат reservation на ошибке подтверждён. |
| 2026-10-05 | `CART-HARDEN-03` выполнен (P0-03): серверный item-contract — `_shared/checkout-items.js` (1..99, без дублей) в `process-checkout`; миграция `0039_checkout_item_contract.sql` (верхняя граница + `VARIANT_DUPLICATE` в RPC); edge задеплоен; коды локализованы. |
| 2026-10-05 | `CART-HARDEN-04` выполнен (P0-04): `held_quantity` custody — seller-патч без `held`, репозиторий пишет только `available_quantity`, «Всё в наличии» идёт через серверный `inventory_reconcile`; `StockControlSheet` held read-only. Тесты `StockControlSheet` (+3). DB-guard — RLS-слой (`11` S1). |
| 2026-10-05 | `CART-HARDEN-05` выполнен (P0-06): `scripts/commerce-harness.mjs` (`npm run commerce:harness`) — интеграционный/конкурентный harness Test 1–9 на dev (сид → проверки → cleanup, `_harness_try` для кодов ошибок). **24/24 PASS**, утечек нет. |
| 2026-10-05 | `CART-HARDEN-06` выполнен: гейт Phase A — `typecheck` ✅, `lint` 0 errors, `test` **804/804**, `build` ✅, `migrations:check` 0001..0039 ✅; `0037` (`20 INV-HARDEN-02`) записана → `P0-05` снят. |
| 2026-10-05 | `CART-HARDEN-07…09` (Phase B) выполнены: checkout-конфликт → invalidate `buyer-cart`; select-all только orderable + `MAX_CART_ITEMS` (enforcement + chunked read); split `canCheckoutCart`/`validateRecipient`. Гейт: `typecheck` ✅, `lint` 0 errors, `test` **812/812**, `build` ✅. |
| 2026-10-05 | `CART-HARDEN-10…12` (Phase C) выполнены: `BuyerCartItem` (non-null вариант), selection toolbar «Выбрано N», docs-sync + финальный аудит (§12). Commerce-фундамент закрыт; осталась ручная `LOCAL`/`TELEGRAM`-проверка. |
