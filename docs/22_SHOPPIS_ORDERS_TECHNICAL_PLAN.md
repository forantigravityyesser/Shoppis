# SHOPPIS — ORDERS / ЗАКАЗЫ (покупатель и продавец) — ТЕХНИЧЕСКИЙ ПЛАН

**Version:** 1.0
**Дата:** 2026-10-10
**Репозиторий:** `forantigravityyesser/Shoppis`
**Базовый срез кода:** `main` (после закрытия Cart/Commerce `18`/`21` и Seller Inventory `19`/`20`).
**Объект:** вкладки **Заказы** (покупатель `/orders`, продавец `/seller/orders`) и **Детали заказа**
(shared) целиком: authenticated read API → application read models → React Query → shared presentation →
buyer/seller actions → tests.
**Вне области:** промокоды, доставка как услуга/цена, налоги, платёжный шлюз, payment status, трекинг,
чат, in-app центр уведомлений, CRM, reorder, invoice PDF, расширенный поиск, аналитика, межмагазинная
агрегация заказов, активация RLS (`11 §S1`), buyer feedback/review-контур после заказа (`02 §8` —
отдельный блок), видимый timeline истории статусов (аудит уже пишется в БД — `03 §15`).

**Связанные документы:** `00` (индекс), `01` (Constitution), `02` (Product Spec §6–7, §11–12, §14),
`03` (Domain & Database Spec §13–18, §23–25), `04` (Technical Spec §4–5, §9, §11–12, §17), `05`
(Implementation Plan), `08` (Divergence), `11` (Hardening Backlog S1–S3), `16` (Remaining Work, FD-3),
`17` (Catalog Plan — конвенция keyset-cursor), `18` (Cart Plan — граница checkout и lifecycle), `19`/`20`
(Seller Inventory), `21` (Commerce Hardening — idempotency / quantity-contract / harness).

**Статус документа:** authoritative для захода Orders. Переносит внешний план `19_SHOPPIS_ORDERS_TECHNICAL_PLAN.md`
в формат проекта. Номер `19` в репозитории занят (`19_SHOPPIS_SELLER_INVENTORY_RECONSTRUCTION_SPEC_v0.1.md`),
поэтому документ пронумерован `22`. Там, где внешний план расходится с уже закрытыми работами (`21`) или
с зафиксированными решениями (`00`/`02`/`18`), документ это явно помечает (`⏭️`/`🔄`) и не превращает в
работу. Продуктовые решения `00`/`02`/`18` не пересматриваются.

> **Карта кода — обязательна к прочтению:** `Приложение C` — сверка каждого тезиса с фактическим кодом
> (`файл:строка`), матрица текущего состояния и нумерация миграций.

---

## 0. Главный принцип этапа

```text
Главная         = заинтересовать
Каталог         = найти
Карточка товара = изучить и решиться
Корзина         = купить
Заказы          = что я купил и что с этим сейчас
```

> **Orders не изобретает бизнес-логику заказа заново.** Он читает уже созданный заказ, показывает его
> immutable snapshots и отправляет изменения статуса через единственный авторитетный command-path.

Три инварианта:

1. **Checkout — единственная точка создания заказа.** `Cart → process-checkout → create_order_atomic`
   (`edge-functions/process-checkout.js`, `migrations/0040...`). Orders не создаёт заказы и не имеет
   собственного пути записи.
2. **`order-actions` — единственный command-path.** `cancel / transition / delivery-outcome / reconcile`
   (`edge-functions/order-actions.js`). Frontend никогда не пишет `orders.status` напрямую.
3. **Orders — витрина над immutable snapshot.** Исторические title/price/variant/image берутся только из
   `order_items`; текущий Product не перечитывается.

```text
Cart → Checkout → server authoritative checkout → create_order_atomic
                                                       │
                                                       ▼
                                                 Order (snapshot)
                                                       │
                 ┌─────────────────────────────────────┼──────────────────────────────┐
                 ▼                                     ▼                              ▼
          Order Query API                       order-actions                  Notifications
          (buyer/seller scope)             (single command path)              (best-effort, вне tx)
                 │                                     │
                 ▼                                     ▼
          Order Read Model                    RPC lifecycle (атомарно)
                 │                        order + inventory + status history
                 ▼
          React Query → Shared Orders UI (buyer/seller)
```

---

## 1. Метод и легенда

### 1.1 Как мы работаем (обязательно весь этап)

1. **Один этап за раз** (`ORD-00…ORD-13`). Реализация → `npm run typecheck` → `npm run lint` →
   `npm run test` → `npm run build` (плюс `npm run migrations:check` при новой миграции, плюс
   `npm run commerce:harness` при backend-изменениях контура заказа) → ручная сверка → следующий этап.
2. **Двойная среда проверки** (`00` README): `LOCAL VERIFIED` (браузер/локальный контур) +
   `TELEGRAM VERIFIED` (Mini App на dev-окружении). Глобальный этап не закрывается без обоих.
3. **Слоистость:** `View → Hook → Application → Repository/RPC/Edge`. Запрещено `UI → InsForge/SQL`,
   `UI → бизнес-логика`. Presentation не импортирует infrastructure.
4. **Переиспользование.** Не создаём второй калькулятор цены, вторую модель товара, отдельные
   buyer/seller копии карточек. Повторно используем: `StoreContactLink` + `normalizeTelegramUsername`
   (контакт), `formatMoneyMinor` (деньги, `product-rules.ts:81`), `SafeImage` (изображения),
   keyset-cursor конвенцию `17`/`0026` (пагинация), паттерн read-model из `18` (`CartItemView`).
5. **Первые этапы — без визуала.** `ORD-01…ORD-04` (query layer/read models/hooks) не трогают UI.
6. **Порядок качества:** `correct → beautiful → polished`.
7. **Server авторитетен.** Клиентские guard'ы (`canTransition`) — только UX; решение принимает сервер
   по актуальному DB-статусу внутри атомарной операции.

### 1.2 Легенда статуса

| Метка | Значение |
|---|---|
| ✅ | Реализовано в коде и проверено (указан файл/строка) |
| 🟡 | Частично: часть уже есть, часть остаётся |
| ❌ | Не реализовано / отсутствует |
| 🔒 | Решение зафиксировано этим документом |
| 🔄 | Решение адаптируется относительно внешнего плана |
| ⏭️ | Пункт внешнего плана уже закрыт/не требует работы (указано, где закрыт) |
| 🧊 | Deferred: осознанно отложено, с триггером включения |

Severity этапов: **H1** обязательно · **H2** высоко · **H3** средне · **H4** косметика.

---

## 2. Аудит текущего фундамента (сверено по коду)

### 2.1 Что готово и переиспользуется

| Что | Где | Готовность |
|---|---|---|
| Модели `Order` / `OrderItem` / `OrderStatusHistory`, `OrderStatus`, `DeliveryOutcome`, `RefusalReasonCode` | `src/domain/models/order.ts:1-71` | ✅ |
| Правила переходов: `canTransition`, `isCancellable`, `isTerminal`, `nextAllowedStatus`, `isAwaitingDeliveryOutcome` | `src/domain/rules/order-rules.ts:9-51` | ✅ |
| Метаданные статусов и причин отказа (RU-подписи) | `src/domain/constants/order-statuses.ts:3-17` | ✅ |
| Domain-тесты матрицы переходов | `src/domain/rules/order-rules.test.ts` | ✅ |
| Command-edge: сессия → dispatch → RPC → best-effort уведомления | `edge-functions/order-actions.js:50-177` | ✅ |
| RPC lifecycle: `order_cancel` / `order_transition` / `order_delivery_outcome` | `migrations/0007_inventory_lifecycle.sql:8,103,154` | ✅ |
| `inventory_reconcile` (order-aware, held-custody) | `migrations/0041_inventory_reconcile_order_aware.sql:29` | ✅ |
| Checkout: reserve-before-order idempotency, обязательный ключ, `VARIANT_DUPLICATE`, границы 1..99, независимые оси цены | `migrations/0040_checkout_price_axes_idempotency.sql:30-263` | ✅ |
| Edge checkout (серверная валидация, уведомления вне транзакции) | `edge-functions/process-checkout.js:43-164` | ✅ |
| Application-граница команд (уже через edge, не прямой UPDATE) | `src/infrastructure/functions/order-api.ts:25-66`; `src/application/store/slices/order-slice.ts:117-179` | ✅ |
| Checkout-контракт (`idempotencyKey` обязателен; `CheckoutResult`) | `src/application/contracts/checkout.ts:5-24` | ✅ |
| Экран успеха checkout → `/orders` | `CheckoutSuccess` + `CartView.tsx:105-112` | ✅ |
| Роуты-каркасы: `/orders`, `/seller/orders`, `/seller/orders/history` | `src/router.tsx:99-106,140` | ✅ (каркас) |
| Нижняя навигация: вкладка «Заказы» у buyer и seller | `FloatingNavBar.tsx:7-13`; `SellerNavBar.tsx:6-11` | ✅ |
| Контакт продавца: компонент + правила username | `StoreContactLink.tsx:18-62`; `store-contact-rules.ts` | ✅ (переиспользуем) |
| Деньги: `formatMoneyMinor(minor, symbol)` | `src/domain/rules/product-rules.ts:81` | ✅ |
| Изображения: `SafeImage` (fallback, без broken UI) | `src/presentation/shared/components/SafeImage.tsx` | ✅ |
| React Query конвенции: ключи, `keepPreviousData`, invalidate | `useBuyerCart.ts:83-88`; `useCheckout.ts:176`; `queryClient.ts` | ✅ |
| Commerce harness (idempotency/inventory/цены; Test 1–12) | `scripts/commerce-harness.mjs` (+ `npm run commerce:harness`) | ✅ |
| Индексы БД заказов (базовые) | `migrations/0003_orders.sql:27-29,54,67` | 🟡 (нет keyset-композитов — ORD-01) |

### 2.2 Что отсутствует / опасно (границы блока)

| Область | Состояние |
|---|---|
| Authenticated read-контур заказов | ❌ прямые client-side reads `select('*')` из `orders` / `order_items` (`order-repository.ts:128-157`) |
| Server-side authorization чтения | ❌ нет: клиент сам передаёт `buyerUserId`/`storeId`; RLS выключен (`11 §S1`) |
| Read models списка/деталей (`OrderListItem`, `OrderDetails`, `OrderItemView`) | ❌ нет |
| Серверные проекции (без `select('*')`, без N+1, preview 1..3) | ❌ нет |
| Cursor-пагинация (`created_at DESC, id DESC`) | ❌ нет; список тянется целиком |
| Telegram username в snapshot заказа | ❌ `process-checkout.js:92` всегда передаёт `p_telegram_username: null` |
| Dead bypass-helpers записи в репозитории | ❌ `updateOrderStatus:159`, `fetchOrderStatusHistory:189`, `appendOrderStatusHistory:199` — не вызываются, но остаются альтернативным путём |
| Orders server state | 🟡 в Zustand (`order-slice.ts`); `useOrders.ts:3-27` — pass-through, не используется ни одним view |
| `OrdersView` покупателя | ❌ заглушка `return null` (`OrdersView.tsx:1-3`) |
| Seller Orders / History | ❌ `PlaceholderScreen` (`SellerOrdersView.tsx:4-11`, `SellerOrdersHistoryView.tsx:4-11`) |
| Detail-роуты | ❌ `/orders/:orderId`, `/seller/orders/:orderId` отсутствуют |
| Shared order-компоненты | ❌ нет |
| Блок «Заказы» дашборда продавца | 🟡 заглушка-подсказка (`SellerDashboard.tsx:18`) |
| Тесты application/UI/security контура Orders | ❌ нет (есть только domain matrix) |

**Вывод:** command-path и checkout уже готовы и корректны (`21`). Реальная работа Orders: (а) authenticated
read-контур с проекциями и cursor-пагинацией, (б) backend-hardening (username snapshot, чистка,
регрессия), (в) read models + React Query, (г) shared UI списка/деталей, (д) buyer/seller actions,
(е) тесты безопасности/lifecycle/интеграции.

---

## 3. Разбор внешнего плана против кода

Внешний документ писался без опоры на фактическое состояние репозитория. Часть его требований уже
закрыта работами `21` (`CART-HARDEN-*`, миграции `0038`–`0041`), часть адаптируется под зафиксированные
решения. Разбор — ниже; полная сверка тезисов — `Приложение B`, карта кода — `Приложение C`.

### 3.1 Уже закрыто (`⏭️`/`✅` — работы нет, только регрессия)

| Тезис внешнего плана | Факт в коде | Вывод |
|---|---|---|
| §14 «Idempotency race: два конкурентных запроса могут создать два заказа» | `0038`+`0040`: `INSERT reservation ON CONFLICT DO NOTHING` → `SELECT ... FOR UPDATE` → создание заказа → `UPDATE ... SET order_id`; пустой ключ отвергается (`IDEMPOTENCY_KEY_REQUIRED`, `0040:70-73`, `:82-110`) | ⏭️ закрыто `21` (`CART-HARDEN-01/02`); регрессия — harness Test 2/3 |
| §50 «Конкурентный checkout-тест: один ключ → один заказ» | harness Test 3: два параллельных checkout с одним ключом → один заказ, одинаковая разметка резерва (`commerce-harness.mjs:225-236`) | ⏭️ есть; прогон при backend-этапах |
| §44 «Инварианты инвентаря» (`NEW`-cancel возвращает stock, `IN_TRANSIT`-cancel оставляет held, `REFUSED` держит и т.д.) | harness Test 7 (NEW cancel → available+), Test 8 (IN_TRANSIT cancel → held остаётся), Test 9 (REFUSED → held, затем reconcile), Test 11/12 (`INVENTORY_RESERVED_BY_ORDERS`, order-aware reconcile) | ⏭️ закрыто; UI обязан эти инварианты **отражать**, а не дублировать |
| §40/§41 «Актуальный статус проверяет сервер; мутация атомарна» | Lifecycle-RPC (`0007`) проверяют текущий DB-статус и меняют order + inventory + history в одной транзакции; server quantity-contract (`VARIANT_DUPLICATE`, `1..99`) — `0039`/`0040` | ⏭️ закрыто |
| §16 «Commands через authoritative boundary» | `cancelOrder`/`transitionOrder`/`recordDeliveryOutcome` уже идут через `order-actions` (`order-api.ts:25-50`) | ✅ подтверждено |
| §28 «Notification failure не ломает заказ» | Уведомления вне транзакции, `catch` best-effort (`process-checkout.js:135-153`; `order-actions.js:163-174`), гейт `notifications_enabled` (`18 CART-05d`) | ✅ подтверждено |
| §12 «RLS не включаем сейчас; authorization — обязательна» | Совпадает с `11 §S1`; RLS off — осознанный статус-кво | ✅ подтверждено (🔒) |

### 3.2 Что реально остаётся (`❌` — работа этапа)

| Тема внешнего плана | Факт в коде | Где закрываем |
|---|---|---|
| §3/§11 Read security: «клиент может запросить `orders?id=...`» | `order-repository.ts:128-157` — прямые чтения; фильтры передаёт клиент | **ORD-01** |
| §9/§10 Проекции и cursor-пагинация | Нет лимита, preview и курсора | **ORD-01/ORD-03** |
| §13 Telegram username snapshot | `process-checkout.js:92` → `p_telegram_username: null` | **ORD-02** |
| §15 Убрать bypass-helpers | `updateOrderStatus` / `appendOrderStatusHistory` / `fetchOrderStatusHistory` — dead code | **ORD-02** |
| §31/§32 Orders в React Query | Server state в Zustand; hook — pass-through | **ORD-04** |
| §5–§7, §19–§26, §29–§30, §33–§37 UI | Экранов нет | **ORD-05…ORD-11** |
| §45–§49 Тесты | Только domain matrix | **ORD-12** + по этапам |

### 3.3 Что адаптируется (`🔄` — меняем относительно внешнего плана)

| Внешний план | Решение Shoppis |
|---|---|
| §37/§43 «Укажите причину отказа» (свободный ввод) | 🔄 Контролируемый список `RefusalReasonCode` — 5 кодов (`order.ts:8-13`), подписи `REFUSAL_REASON_META` (`order-statuses.ts:11-17`). Сервер уже требует `REASON_REQUIRED` (`order-actions.js:39`); UI — выбор из списка, не textarea |
| §18/§43 «DELIVERED → RECEIVED» как переход | 🔄 Это `delivery_outcome = RECEIVED` **при сохранении статуса** `DELIVERED` (+`completed_at`); смена статуса только `DELIVERED → REFUSED` (`02 §6–7`, `03 §16`, `0007:154`) |
| §22 «Что НЕ переносим из прототипа» | ✅ Совпадает: только «Итого», без subtotal / shipping / tax / promo / payment breakdown |
| §58 Store scope | ✅ Совпадает: buyer — заказы текущей витрины; межмагазинная агрегация — future |
| §25/§26 Контакты | ✅ Зафиксировано в `00` (locked): buyer → `support_handle` из БД без подстановки TG username продавца; seller → `buyer_telegram_username_snapshot` + телефон из delivery |
| §12 «Edge/RPC authorization + позже RLS» | ✅ Совпадает: сейчас — authenticated edge + authz в SQL; RLS — финальный hardening (`11 §S1`) |
| §19 Tabs «Все/Новые/В пути/Доставлено/История» | 🔒 Принимаем; «История» — UI-группировка `REFUSED+CANCELLED`, не domain status |
| §30 `/seller/orders/history` | 🔒 Оставляем как compatibility-роут → `/seller/orders?status=history` |

---

## 4. Целевая архитектура

### 4.1 Разделение Queries / Commands

```text
READ                                   COMMAND
order-queries.js (новый)               order-actions.js (существует; контракт не меняем)
  list / detail                          cancel / transition / delivery-outcome / reconcile
        │                                      │
        ▼                                      ▼
RPC order_list_read                    RPC order_cancel / order_transition /
RPC order_detail_read                  order_delivery_outcome / inventory_reconcile
(проекции, cursor, authz в SQL)        (атомарный lifecycle: order + inventory + history)
```

🔒 Направления не смешиваем: `order-queries` — только чтение; `order-actions` — только изменения.
`order-actions` не превращается в query+command God-function.

### 4.2 Слои (Onion)

```text
presentation  →  application  →  domain
                   │
                   └─ infrastructure — только через application-порты (`deps()`)
```

- **presentation:** shared orders-компоненты + тонкие buyer/seller views; **0** импортов
  infrastructure/InsForge.
- **application:** read models (`read-models/order.ts`), mappers (`mappers/order-mappers.ts`), hooks
  (`useOrders`, `useOrderDetails`, `useOrderActions`), порт `OrderRepository` (query-only;
  переписывается) + существующий command-порт `OrderApi`.
- **infrastructure:** invoke edge `order-queries` (`functions/order-query-api.ts` /
  `repositories/order-repository.ts`), маппинг RPC-проекций; edge `order-actions` — как есть.

### 4.3 Read-контур (целевой)

```text
React Query hook
   │  queryKey: ['orders', scope, storeRef, filter] | ['order', scope, orderId]
   ▼
order-repository (infrastructure) — invokeFunction('order-queries')
   ▼
edge order-queries.js
   ├─ verifySession(Authorization)                 // _shared/auth.js:46-59
   ├─ actor = session.uid                          // identity — только из сессии
   └─ RPC order_list_read / order_detail_read
        (p_actor_user_id, p_scope, p_store_ref, p_status_filter, p_cursor, p_limit)
          ├─ authorization в БД:
          │    buyer  → orders.buyer_user_id = p_actor_user_id
          │    seller → stores.owner_user_id = p_actor_user_id
          ├─ проекция (jsonb, без select('*'), без избыточного PII)
          └─ keyset: created_at DESC, id DESC  // cursor "<epoch_microseconds>:<id>" (17/0026)
   ▼
Order Read Model (mapper)
   ▼
Shared UI
```

`p_scope`/`p_store_ref` от клиента — **requested context**, не доказательство доступа: несовпадение
scope и фактического владения → безопасный пустой результат/denial.

### 4.4 Security/scope (🔒)

- Identity — только из подписанной сессии (`verifySession`, `_shared/auth.js:46-59`). Поля
  `buyerUserId`, `storeId`, `scope` из payload не являются permission.
- Buyer: читает/меняет только заказы, где `orders.buyer_user_id = actor`.
- Seller: читает/меняет только заказы магазинов, где `stores.owner_user_id = actor`.
- Detail чужого/несуществующего заказа → **одинаковый безопасный ответ** «Заказ не найден»
  (существование чужого заказа не раскрывается).
- RLS не включаем на этом этапе (статус-кво `11 §S1`); server-side authorization обязательна уже сейчас.
  В будущем RLS — defence-in-depth поверх, а не единственная защита.

### 4.5 Scope витрины

Buyer читает заказы **текущей витрины** (store-scoped; store-контекст резолвится на входе приложения —
`useAppInit.ts:62-100`, `auth-slice.ts:175-202`). Глобальный «Мои заказы по всем магазинам» — future;
БД multi-shop-ready (`00` locked decision).

---

## 5. Authoritative решения (freeze)

### 5.1 Статусы и UI-группировки

- Ровно пять статусов: `NEW`, `IN_TRANSIT`, `DELIVERED`, `REFUSED`, `CANCELLED`. Новых не вводим.
- `REFUSED`/`CANCELLED` — терминальные; `DELIVERED` — операционная стадия до фиксации исхода
  (`02 §6–7`, `03 §16`).
- Tabs: `Все | Новые | В пути | Доставлено | История`.
  Маппинг: Все→all · Новые→`NEW` · В пути→`IN_TRANSIT` · Доставлено→`DELIVERED` ·
  История→`REFUSED+CANCELLED`. «История» — **фильтр-группировка**, не domain status.
- Delivery outcome (`RECEIVED`/`REFUSED`) — не статус, а отдельное поле заказа.

### 5.2 Матрица действий

| Переход | Актор | Inventory (сервер, `0007`/`0041`) | UI-нюанс |
|---|---|---|---|
| `NEW → IN_TRANSIT` | Seller | — | «Передать в доставку» |
| `NEW → CANCELLED` | Buyer / Seller | `held → available` | confirmation; текст про возврат резерва |
| `IN_TRANSIT → DELIVERED` | Seller | — | «Отметить доставленным» |
| `IN_TRANSIT → CANCELLED` | Seller | **held остаётся** | обязательный warning: «остаток не вернётся автоматически, потребуется ручная сверка» |
| `DELIVERED → outcome RECEIVED` | Seller | held released (lifecycle) | статус остаётся `DELIVERED`; «Покупатель забрал» |
| `DELIVERED → REFUSED` | Seller | held остаётся до reconcile | reason обязателен (коды) |
| `CANCELLED`/`REFUSED` → * | — | — | терминальные |

Клиентские guard'ы (`canTransition`, `order-rules.ts:38-51`) — UX-подсказка; решение принимает сервер
по актуальному DB-статусу (race-safe, `21 §3.6`).

### 5.3 Read models

`OrderListItem` (список — лёгкая проекция):

```ts
interface OrderListItem {
  id: string;
  publicOrderNumber: string;
  status: OrderStatus;
  createdAt: string;
  totalMinor: number;
  currencyCode: string;
  currencySymbol: string;
  itemCount: number;
  previewItems: Array<{
    imageUrl: string | null;
    title: string;
    variantLabel: string | null;
    quantity: number;
  }>; // 1..3
}
```

Если `itemCount > previewItems.length` — UI показывает `+N`. Seller-проекция дополнительно может
включать краткое buyer-представление (имя) — точные поля фиксируются в `ORD-03`.

`OrderDetails` (деталь — одна composed-граница): identity/status/timestamps, items, delivery snapshot,
контакты по актору, delivery outcome, причина отказа, доступные действия. Поля соответствуют DB
(`03 §13–14`); фактический состав — `ORD-03`. Покупателю не отдаём ничего сверх собственного snapshot;
продавцу — не больше, чем зафиксировано в snapshot заказа.

`OrderItemView`: `productTitleSnapshot`, `productImageSnapshot`, `variantNameSnapshot` /
`variantValueSnapshot`, `linkingAttributesSnapshot`, `quantity`, `unitPriceMinor`, `lineTotalMinor`.
Текущий Product никогда не привлекается (см. §5.6).

### 5.4 Контакты

- **Buyer → seller:** `support_handle` из БД (в detail-проекции). Подстановка Telegram username продавца
  запрещена (`00` locked decision). Контакт не задан → «Продавец не указал контакт для связи»
  (паттерн `StoreContactLink.tsx:25-33`). Ссылка — `https://t.me/<username>` через `openTelegramLink`.
- **Seller → buyer:** `buyer_telegram_username_snapshot`. `null` → Telegram-CTA скрыт/disabled, телефон
  из delivery остаётся. Профиль покупателя не перечитываем — исторический snapshot важнее.

### 5.5 Пагинация и производительность

- Keyset-cursor `"<epoch_microseconds>:<id>"`, сортировка `created_at DESC, id DESC` — конвенция
  `17`/`0026:77-85,149`. `offset` и fetch-all запрещены.
- Страница 20–50 заказов без N+1: одна SQL-проекция (jsonb) на страницу, включая preview items.
- Detail — один authenticated read-вызов, одна composed-проекция (order + items + контакты + derived).
- Keyset-индексы заказов (по образцу `0024`) добавляются в `ORD-01`.

### 5.6 Immutable snapshots

- Items всегда из `order_items` (title/price/variant/image/linking attributes).
- Изменения каталога после покупки не переписывают историю (locked decision `00`, `03 §14`).
- Нет изображения → `SafeImage` fallback (без broken image).

### 5.7 Ошибки и безопасность ответов

- List: два уровня — полный экран ошибки с retry; detail: понятная ошибка.
- Чужой/несуществующий заказ → единый «Заказ не найден» (не раскрываем существование).
- Никаких сырых RPC/SQL-ошибок в UI — детерминированный маппинг (паттерн `18 §32`).
- Mutation-ошибки по кодам `order-actions.js:30-48`: `ORDER_NOT_FOUND`, `ORDER_TERMINAL`,
  `TRANSITION_NOT_ALLOWED`, `CANCEL_NOT_ALLOWED`, `NOT_DELIVERED`, `INVALID_OUTCOME`,
  `REASON_REQUIRED`, `FORBIDDEN`, + транспортные `NETWORK`/`UNKNOWN`.

### 5.8 Confirmations и мутации

- Confirmation обязателен для: buyer cancel `NEW`; seller cancel `NEW`; seller cancel `IN_TRANSIT`
  (с явным предупреждением, что held не вернётся автоматически); refusal — обязательный reason.
- **Без агрессивных optimistic updates** для статусов: `mutation → server result → invalidate/refetch`
  (статус связан с inventory/history; UI всегда отражает backend truth).
- `useOrders` не God-hook: список / деталь / действия — отдельные хуки с отдельными ответственностями.

### 5.9 Zustand vs React Query (граница)

- Orders server state → в React Query (единственный server cache; ключи и invalidation — `ORD-04`).
- Zustand сохраняет **только checkout-исход**: `placeOrder`, `lastOrder`/`lastOrderId`,
  `requestNotifications`, `resetCheckout` (`order-slice.ts:181-255`) — не ломаем CART-поток
  `useCheckout`/`CheckoutSuccess`.
- List/status-действия слайса (`fetchBuyerOrders`, `fetchStoreOrders`, `fetchItems`, `changeStatus`,
  `cancelOrder`, `recordDeliveryOutcome`, `reconcileInventory`) после миграции потребителей удаляются
  (`ORD-04`); вызов `resetOrders` из `auth-slice.ts:91,135,165,179,195` перенаправляется на сброс
  checkout-состояния.
- Inventory state в Orders не копируем: после seller-мутаций инвалидируются существующие
  inventory-запросы по их контракту (seller-actions `ORD-10` → invalidation `ORD-04`).

### 5.10 Notifications и чат

- Уведомления — существующий механизм (`process-checkout`, `order-actions`, гейт
  `notifications_enabled`); failure не ломает заказ (best-effort).
- In-app центра уведомлений нет; in-app чата нет — контакт только через внешний Telegram-flow.

### 5.11 Non-goals этапа

payment status / online payment; shipping provider / tracking / fee; tax; promo; CRM; reorder;
invoice PDF; advanced search; analytics; multi-store aggregation; RLS activation; buyer
feedback/review после заказа (`02 §8`); видимый timeline истории статусов (данные пишутся, UI — future).

---

## 6. Этапы реализации

### 6.1 Карта «внешний PHASE → ORD»

| Внешний план | ORD | Содержание | Приоритет | Статус |
|---|---|---|---|---|
| PHASE 0 | **ORD-00** | Contract freeze (этот документ) | — | ✅ (2026-10-10) |
| PHASE 1 | **ORD-01** | Authenticated order query layer | H1 | ⬜ |
| PHASE 2 | **ORD-02** | Backend hardening: username, чистка, регрессия | H1 | 🟡 (idempotency/quantity — ⏭️ закрыто `21`) |
| PHASE 3 | **ORD-03** + **ORD-04** | Read models/mappers + React Query hooks | H1 | ⬜ |
| PHASE 4 | **ORD-05** | Shared presentation foundation | H2 | ⬜ |
| PHASE 5 | **ORD-06** | Buyer list `/orders` | H2 | ⬜ |
| PHASE 6 | **ORD-07** | Seller list `/seller/orders` | H2 | ⬜ |
| PHASE 7 | **ORD-08** | Shared Order Details (read-only) | H2 | ⬜ |
| PHASE 8 | **ORD-09** | Buyer actions (cancel) | H2 | ⬜ |
| PHASE 9 | **ORD-10** | Seller actions (6 действий) | H2 | ⬜ |
| PHASE 10 | **ORD-11** | Routing + compatibility | H3 | ⬜ |
| PHASE 11 | **ORD-12** | Integration / security / lifecycle QA | H1 | ⬜ |
| PHASE 12 | **ORD-13** | Final architecture + UX + performance audit | H1 | ⬜ |

> Почему не «UI → backend → security»: см. §9.1. Порядок фаз выбран так, чтобы UI строился на уже
> замороженном и проверенном контракте (иначе — переписывание hooks/repository/routing после готового UI).

### ORD-00 — Contract freeze `🔒`

Сделано этим документом: зафиксированы статусы, outcome-модель, матрица действий, контакты, табы,
read-модели, security-модель, пагинация, границы Zustand/React Query, non-goals.

**Done:** ни один разработчик UI не придумывает новые status semantics после публикации документа.
**Статус:** ✅ (2026-10-10).

### ORD-01 — Authenticated order query layer `H1`

**Задачи:**
1. Миграция `0042_orders_query_read.sql`: RPC `order_list_read` и `order_detail_read`
   (`security definer`, `set search_path = public` — конвенция `0032`), параметры:
   `p_actor_user_id`, `p_scope` (`buyer|seller`), `p_store_ref`, `p_status_filter`
   (`all|NEW|IN_TRANSIT|DELIVERED|history`), `p_cursor`, `p_limit`.
2. Authorization **в SQL**: buyer — `orders.buyer_user_id = p_actor_user_id`; seller —
   `stores.owner_user_id = p_actor_user_id`; несовпадение scope/владения → безопасный пустой
   результат / denial.
3. Серверные проекции: list — `public_order_number`, `status`, `created_at`, `total_minor`,
   `currency_code` + symbol, `item_count`, preview 1..3 (title/variant/quantity/image) одним
   запросом без N+1; detail — одна composed-проекция (order + items + snapshots + контакт по актору).
4. Keyset-cursor `"<epoch_microseconds>:<id>"` (`created_at DESC, id DESC`); конвенция `0026`.
5. Keyset-индексы: `(buyer_user_id, created_at desc, id desc)` и `(store_id, created_at desc, id desc)`
   (по образцу `0024`).
6. Edge `order-queries.js`: `verifySession` → dispatch `list|detail`; коды ошибок в стиле
   `order-actions.js:30-48`.
7. Infrastructure: invoke-обёртка `order-query-api.ts`; `order-repository.ts` переписывается на RPC
   (query-only); прямые client-reads удаляются.

**Не делать:** UI; новые статусы; RLS; изменение `create_order_atomic`.

**Done:** чужой заказ невозможно получить через query boundary; проекции не содержат избыточного PII;
cursor работает; прямой `select('*')` из `orders` в клиенте отсутствует.

### ORD-02 — Backend hardening `H1`

**Задачи:**
1. **Telegram username snapshot:** в `process-checkout.js` перед RPC — серверный резолв
   `telegram_identities.username` по `session.uid` (или `session.tg`) и передача в
   `p_telegram_username` вместо `null` (`process-checkout.js:92`). Клиент на это не влияет; отсутствие
   username — допустимо (`null`), checkout не падает.
2. **Чистка командного пути:** удалить `updateOrderStatus` (`order-repository.ts:159-187`),
   `fetchOrderStatusHistory` (`:189-197`), `appendOrderStatusHistory` (`:199-216`) и связанные строки
   маппинга истории, если не используются. Единственный путь записи — `order-actions`.
3. **Порт репозитория** сужается до query-методов (`ports/order-repository.ts`); command-методы — только
   `OrderApi` (уже так).
4. **Регрессия:** `npm run commerce:harness` (Test 2/3/7/8/9/11/12) остаётся зелёным; новый тест на
   username-snapshot (server-resolved).

**Не делать:** менять бизнес-логику `create_order_atomic`/lifecycle-RPC (кроме передачи username);
ломать checkout-контракт.

**Done:** новые заказы получают username в snapshot при его наличии; bypass-путей записи нет;
harness зелёный; `checkout` не деградировал.

### ORD-03 — Application: read models, mappers, port `H1`

**Создать:**
- `src/application/read-models/order.ts`: `OrderListItem`, `OrderListPage`, `OrderDetails`,
  `OrderItemView`, `OrderStatusFilter`.
- `src/application/mappers/order-mappers.ts`: RPC-проекция → read model (+ тесты: `null` image,
  `null` username, `null` support handle, `itemCount`, `+N`, currency, delivery snapshot).
- Порт query-методы: `listOrders(scope, storeRef, filter, cursor, limit)`,
  `getOrderDetails(scope, orderId)`; регистрация в composition-root (`deps()`).

**Done:** presentation не знает про DB/RPC/edge; мапперы покрыты тестами; контракт заморожен.

### ORD-04 — React Query hooks `H1`

**Создать/переписать:**
- `useOrders` — list через `useInfiniteQuery` (cursor), фильтр-таб, scope/store; `keepPreviousData`
  (конвенция `useBuyerCart.ts:83-88`).
- `useOrderDetails` — деталь через `useQuery`.
- `useOrderActions` — `useMutation` для `cancel` / `transition` / `deliveryOutcome`; после успеха —
  invalidate detail + списков; seller-действия дополнительно инвалидируют релевантные
  inventory/product-запросы (существующий контракт, не копировать state).
- Query keys (пример): `['orders', scope, storeRef, filter]`, `['order', scope, orderId]`.
- **Вывод server state из Zustand:** удалить из `order-slice` list/status-действия после миграции
  потребителей; сохранить checkout-исход (`placeOrder`/`lastOrder`/`requestNotifications`/
  `resetCheckout`); `resetOrders` из `auth-slice` — перенаправить на сброс checkout-состояния.
  `useOrders.ts` (pass-through) заменяется.

**Не делать:** optimistic status; God-hook; второй server cache.

**Done:** Cart/Checkout-поток не сломан (тесты `order-slice`/`useCheckout`/`CartView` зелёные);
invalidation детерминирован; server state живёт в React Query.

### ORD-05 — Shared presentation foundation `H2`

**Создать** (`src/presentation/shared/orders/`):
`OrderStatusBadge`, `OrderStatusTabs`, `OrderCard`, `OrderPreviewItems`, `OrderItemRow`, `OrderTotal`,
`OrderDeliveryDetails`, `OrderContactButton`, `OrderActionBar`, `OrderSkeleton` (каркас списка/деталей),
`OrderEmptyState`, `orders.css`.

**Правила:** общие компоненты не содержат buyer/seller бизнес-логики; различия (actions/contact/
labels) — через props/config от тонких view; не создавать `BuyerOrderCard`/`SellerOrderCard` копии;
не превращать shared-компонент в «монстра» c десятками boolean-пропсов — конфигурировать через
focused view-model.

**Done:** примитивы отрендерены и покрыты компонентными тестами; shared не знает про actor-specific
мутации.

### ORD-06 — Buyer list `/orders` `H2`

**Реализовать:** tabs (Все/Новые/В пути/Доставлено/История), карточки заказов, cursor infinite
loading, состояния: loading (skeleton без резкого layout shift), empty (per-tab тексты), error/retry,
переход в деталь. Без мутаций.

**Empty-тексты (пример):** Все — «Заказов пока нет»; Новые — «Новых заказов нет»; В пути — «Заказов
в пути нет»; Доставлено — «Доставленных заказов пока нет»; История — «История заказов пуста».

**Done:** покупатель полноценно просматривает свои заказы; детали ещё может не быть — переход
включается в ORD-08.

### ORD-07 — Seller list `/seller/orders` `H2`

**Реализовать:** те же shared-компоненты; seller-контекст карточки (buyer preview, если включено
проекцией), фильтр «История» (`?status=history`), переход в деталь; ссылка из блока «Заказы»
дашборда (`SellerDashboard.tsx:18`).

**Done:** продавец видит только заказы своего магазина; history-фильтр работает.

### ORD-08 — Shared Order Details (read-only) `H2`

**Реализовать:** роуты `/orders/:orderId`, `/seller/orders/:orderId`; общий detail-компонент
(header → статус → товары → доставка → итого → контакт); действия пока read-only.
`OrderContactButton`: buyer → `support_handle` (реюз механики `StoreContactLink`); seller → TG
snapshot покупателя, иначе телефон.

**Done:** buyer/seller получают корректный snapshot detail; чужой заказ → «Заказ не найден»;
skeleton без layout shift.

### ORD-09 — Buyer actions `H2`

**Реализовать:** `NEW → CANCELLED` c confirmation («Заказ будет отменён, а зарезервированный товар
вернётся в доступный остаток»). После мутации — invalidate detail + list. Inventory обновляет
сервер (`0007`), UI не дублирует.

**Done:** buyer cancellation работает end-to-end (LOCAL + TELEGRAM); повторный submit невозможен
(pending); ошибки маппируются.

### ORD-10 — Seller actions `H2`

По очереди, каждый — отдельный шаг с тестом:
1. `NEW → IN_TRANSIT` («Передать в доставку»);
2. `NEW → CANCELLED` (confirmation);
3. `IN_TRANSIT → DELIVERED` («Отметить доставленным»);
4. `IN_TRANSIT → CANCELLED` — confirmation **с предупреждением**, что held останется и потребуется
   ручная сверка (серверное поведение: `0007:8`, harness Test 8);
5. `DELIVERED → RECEIVED` («Покупатель забрал») — статус остаётся `DELIVERED`, outcome фиксируется;
6. `DELIVERED → REFUSED` — reason обязателен (коды `RefusalReasonCode`, подписи
   `REFUSAL_REASON_META`); held остаётся (harness Test 9).

**Done:** каждый action проверен отдельно; transition validation — серверная (race-safe);
после успеха detail/list/inventory-запросы инвалидированы по контракту.

### ORD-11 — Routing + compatibility `H3`

**Реализовать:** `/orders`, `/orders/:orderId`, `/seller/orders`, `/seller/orders/:orderId`;
compatibility `/seller/orders/history` → `/seller/orders?status=history`; подсветка вкладок
(`SellerNavBar.tsx:13-17` — nested-подсветка уже есть); back-behavior.

**Done:** обе навигации (buyer/seller) корректны; старые ссылки не ломаются; back из детали
возвращает к списку с сохранённым фильтром.

### ORD-12 — Integration / security / lifecycle QA `H1`

**Цепочки:**
- Buyer: `product → cart → checkout → order created → /orders → detail → cancel`;
- Seller: `new order → /seller/orders → detail → IN_TRANSIT → DELIVERED → RECEIVED`;
- Refusal: `DELIVERED → REFUSED → held remains → reconcile (order-aware)`.

**Security-тесты:** buyer A не читает заказ buyer B; seller A не читает заказ seller B; foreign detail
→ безопасный not-found; PII не утекает (name/phone/address/username/items/total).

**Регрессия:** `npm run commerce:harness`; полный `test` suite; гейты ниже.

**Done:** сценарии пройдены; ни одного отклонения inventory-инвариантов.

### ORD-13 — Final architecture audit `H1`

Отдельный проход (чеклист §8): Onion boundaries / dependency direction; God-файлы и дубли; ownership
и PII; N+1/pagination/query count/payload; UX-состояния; соответствие `00`/`02`/`18`/`21`.
Только после — финальный sign-off Orders.

---

## 7. Стратегия тестирования

### Domain
- Матрица переходов (расширить существующий `order-rules.test.ts`): `NEW→IN_TRANSIT` seller;
  `NEW→CANCELLED` buyer/seller; `NEW→DELIVERED` forbidden; `IN_TRANSIT→DELIVERED` seller;
  `IN_TRANSIT→CANCELLED` seller; `IN_TRANSIT→NEW` forbidden; outcome `RECEIVED`/`REFUSED` только из
  `DELIVERED`; терминальные `CANCELLED`/`REFUSED`.
- Capabilities/терминальность/`nextAllowedStatus`.

### Application
- Список: buyer/seller scope, фильтры табов (включая `history` = REFUSED+CANCELLED), cursor-пагинация
  (вторая страница, пустой результат), деталь, not-found.
- Мутации: cancel/transition/outcome; маппинг ошибок; invalidation (`['orders']`/`['order']`);
  buyer vs seller capabilities; hooks не конфликтуют с checkout-состоянием.

### Infrastructure (mapping)
- Проекция → `OrderListItem`/`OrderDetails`: snapshot title/price/variant; preview images; `null` image;
  `null` username; `null` support handle; `itemCount`/`+N`; currency/symbol; delivery snapshot.

### Security
- Buyer A ↛ order buyer B; Seller A ↛ order seller B; foreign detail → одинаковый not-found;
  клиентские `storeId`/`userId` не влияют на доступ; PII не течёт в список.

### Lifecycle/Inventory
- Regression harness: Test 7/8/9/11/12 (инварианты `held`), Test 2/3 (idempotency).
- Live-прогон detail/list RPC на реальных данных (паттерн CART-01).

### Components/UI
- Tabs, карточка (preview/+N/статус), skeleton, empty, error/retry, confirmation, mutation pending,
  contact states (нет поддержки/нет username), деталь-секции.

### Гейты
```text
npm run typecheck
npm run lint        (0 errors)
npm run test
npm run build
npm run migrations:check          (при новой миграции)
npm run commerce:harness          (при backend-этапах)
```
плюс `LOCAL VERIFIED` и `TELEGRAM VERIFIED` (для глобальных этапов).

---

## 8. Definition of Done

Orders считается завершённым только если одновременно выполнено всё.

### Архитектура
- [ ] Query/command разделены (`order-queries` / `order-actions`).
- [ ] Onion-границы сохранены; dependency direction корректен.
- [ ] Нет God-hook и God-компонента.
- [ ] Нет прямых sensitive DB-reads из presentation.
- [ ] Нет обходного пути записи статуса.

### Безопасность
- [ ] Buyer ownership — server-side.
- [ ] Seller ownership — server-side.
- [ ] Чужой заказ → безопасный not-found.
- [ ] PII защищён (список/деталь).
- [ ] `userId`/`storeId` клиента не являются permission.

### Данные
- [ ] Snapshots immutable; исторические price/title/variant стабильны.
- [ ] Telegram username резолвится сервером (ORD-02).
- [ ] Delivery outcome и refusal reason корректны и разделены со статусом.

### Lifecycle
- [ ] `NEW→IN_TRANSIT`, `NEW→CANCELLED`, `IN_TRANSIT→DELIVERED`, `IN_TRANSIT→CANCELLED`,
      `DELIVERED→RECEIVED`, `DELIVERED→REFUSED` работают.
- [ ] Терминальные состояния защищены.
- [ ] Все действия race-safe (сервер проверяет текущий статус).

### Инвентарь
- [ ] `NEW`-cancel возвращает stock (`held → available`).
- [ ] `IN_TRANSIT`-cancel оставляет held (+ UI-warning).
- [ ] `RECEIVED` освобождает held по lifecycle.
- [ ] `REFUSED` оставляет held до reconcile.

### UX
- [ ] Все табы; empty-состояния; loading; error; retry; confirmation; mutation pending; деталь;
      контакт; mobile-safe layout.

### Производительность
- [ ] Cursor-пагинация; нет fetch-all; нет N+1.
- [ ] Server projections; detail — одна composed read-граница.

### Тесты
- [ ] Domain matrix; application; mapping; security; lifecycle; inventory (harness);
      build/typecheck/lint/test зелёные; `LOCAL` + `TELEGRAM`.

---

## 9. Порядок, запреты и рабочий режим

### 9.1 Почему именно такой порядок

Нельзя: `UI → backend → security → refactor` — это приводит к переписыванию hooks/repository/routing
после готового UI. Правильно:

```text
security contract → data contract → application contract → presentation primitives
→ screens → mutations → integration → audit
```

Каждый следующий слой строится на уже стабильном предыдущем (§6.1).

### 9.2 Запрещено во время реализации

1. Читать orders напрямую из UI (`React → DB`) для sensitive reads.
2. Менять `orders.status` из client-repository (`UPDATE orders SET status = ...`).
3. Делать Zustand главным source of truth для server state заказов.
4. Копировать buyer/seller UI (только shared presentation).
5. Добавлять новые статусы ради UI («История» — фильтр, не статус).
6. Тянуть текущий Product для исторического order item (только snapshots).
7. Доверять client `userId`/`storeId` как permission.
8. Делать fetch-all / offset-пагинацию.
9. Переписывать архитектуру вне границ Orders (точечные изменения только в Orders-контуре; checkout
   контракт не трогаем).
10. Включать RLS посреди реализации (финальный hardening проекта, `11 §S1`).

### 9.3 Рабочий режим

Каждый этап отдельно; после каждого: `implementation → typecheck → tests → build → targeted audit`.
Не переходить дальше, если остались: bypass, broken contract, type errors, failing tests,
unresolved security issue. После всей вертикали — `full audit → refactor → test → build → sign-off`.

---

## Финальные схемы

### Read

```text
Telegram authenticated session
            │
            ▼
      order-queries.js
            │
      ┌─────┴─────┐
      ▼           ▼
 Buyer scope   Seller scope     ← authorization в БД, identity из сессии
      │           │
      └─────┬─────┘
            ▼
      RPC projections (jsonb, keyset cursor, preview)
            │
            ▼
      Order Read Model
            │
            ▼
      Application mapper
            │
            ▼
        React Query
            │
            ▼
     Shared Orders UI
      │           │
      ▼           ▼
    Buyer       Seller
```

### Mutation

```text
UI action
   │
   ▼
useOrderActions
   │
   ▼
order-actions (edge)
   │
   ▼
server authorization
   │
   ▼
domain transition validation (актуальный DB-статус)
   │
   ▼
atomic DB operation
   ├── order
   ├── inventory
   └── status history
   │
   ▼
authoritative result
   │
   ▼
React Query invalidation
   │
   ▼
fresh Order Read Model
```

### Checkout (не меняем)

```text
Cart → Checkout → server validation (price/stock/idempotency)
   → create_order_atomic (order snapshot + items + reserve AVAILABLE→HELD + history)
   → Orders (read) + order-actions (commands)
```

---

## Приложение A. Прототип → Shoppis (границы заимствования)

| Элемент прототипа (внешний план §20–§26) | Решение Shoppis |
|---|---|
| Список заказов карточками: номер/дата/статус/превью/сумма | ✅ берём (`OrderCard`) |
| Preview-изображения (1..3) + `+N` | ✅ берём |
| Позиции заказа: image/title/variant × qty/price | ✅ берём (`OrderItemRow`), из snapshots |
| Блок статуса в деталях (badge + дата) | ✅ берём |
| Секции: Товары → Доставка → Итого → Контакт → Действия | ✅ берём (порядок «сначала состояние, затем содержание») |
| Buyer/Seller отдельные реализации карточек/деталей | ❌ исключено — shared components + тонкие view |
| Subtotal / Shipping / Tax / Promo / Payment breakdown | ❌ исключено (MVP domain model) |
| «Итого» одной строкой (`totalMinor`) | ✅ берём |
| In-app chat / message threads | ❌ исключено — внешний Telegram-контакт |
| Timeline истории статусов | 🧊 deferred (данные пишутся; UI — future) |

Прототип — направление, не бизнес-контракт.

## Приложение B. Правки относительно внешнего плана (сводка)

1. **Номер документа.** Внешний файл пронумерован `19`, в проекте `19` занят (Inventory
   Reconstruction) → план пронумерован `22`.
2. **PHASE 2 «Checkout/idempotency hardening» сокращён до `ORD-02`.** Idempotency race, quantity
   contract и инвентарь-инварианты уже закрыты `21` (`0038`–`0041`, harness Test 2/3/7/8/9/11/12) —
   помечены `⏭️`; остаются username snapshot, чистка bypass-helpers, регрессия.
3. **Refusal reason — контролируемые коды**, не свободный текст (в проекте
   `RefusalReasonCode` + `REFUSAL_REASON_META`; сервер требует `REASON_REQUIRED`).
4. **`DELIVERED → RECEIVED` — не смена статуса**: `delivery_outcome = RECEIVED` при сохранении
   `DELIVERED` (+`completed_at`).
5. **Границы Zustand/React Query уточнены**: checkout-исход (`placeOrder`/`lastOrder`/
   `requestNotifications`) остаётся в Zustand до отдельного решения; Orders server state — в React
   Query (`ORD-04`).
6. **Контакты** — уже зафиксированное в `00`/`18 §26` поведение (support_handle из БД; без
   подстановки TG username продавца).
7. **Compatibility-роут** `/seller/orders/history` сохраняется (`ORD-11`).
8. **Проектный процесс** (гейты, `LOCAL`/`TELEGRAM`, миграции `schema_migrations`, harness) —
   интегрирован в каждый этап (`§1.1`, `§7`).

## Приложение C. Карта кода (сверка на 2026-10-10)

### Domain
| Артефакт | Где |
|---|---|
| `OrderStatus` (5), `DeliveryOutcome`, `RefusalReasonCode` | `src/domain/models/order.ts:2,5,8-13` |
| `Order`, `OrderItem`, `OrderStatusHistory` | `src/domain/models/order.ts:18-71` |
| Переходы: `nextAllowedStatus`, `isCancellable`, `isTerminal`, `isAwaitingDeliveryOutcome`, `canTransition` | `src/domain/rules/order-rules.ts:9-51` |
| RU-метаданные статусов/причин | `src/domain/constants/order-statuses.ts:3-17` |
| Тесты матрицы | `src/domain/rules/order-rules.test.ts` |

### Backend
| Артефакт | Где |
|---|---|
| Command-edge (dispatch/notify) | `edge-functions/order-actions.js:50-177` |
| Checkout-edge (username gap) | `edge-functions/process-checkout.js:85-94` (`:92` null) |
| `order_cancel` / `order_transition` / `order_delivery_outcome` | `migrations/0007_inventory_lifecycle.sql:8,103,154` |
| `inventory_reconcile` (order-aware) | `migrations/0041_inventory_reconcile_order_aware.sql:29` |
| `create_order_atomic` (idempotency/quantity/price axes) | `migrations/0040_checkout_price_axes_idempotency.sql:30-263` |
| Cursor-конвенция | `migrations/0026_storefront_catalog_read.sql:77-85,149` |
| Cart-read RPC (паттерн проекции) | `migrations/0036_storefront_cart_items_read.sql` |
| `security definer` search_path | `migrations/0032_security_definer_search_path.sql` |
| Index-прецедент keyset | `migrations/0024_home_products_keyset_index.sql` |
| Базовые индексы orders | `migrations/0003_orders.sql:27-29,54,67` |
| Harness (Test 1–12) | `scripts/commerce-harness.mjs:7-18,225-236` и далее |

### Application / Infrastructure
| Артефакт | Где |
|---|---|
| `OrderRepository` порт (query, переписать) | `src/application/ports/order-repository.ts:3-7` |
| Прямые client-reads + dead helpers | `src/infrastructure/repositories/order-repository.ts:128-216` |
| Command-обёртка edge | `src/infrastructure/functions/order-api.ts:25-66` |
| Checkout-контракт | `src/application/contracts/checkout.ts:5-24` |
| `order-slice` (server state в Zustand) | `src/application/store/slices/order-slice.ts:77-255` |
| `useOrders` pass-through | `src/application/hooks/useOrders.ts:3-27` |
| React Query конвенции | `src/application/hooks/useBuyerCart.ts:83-88`; `src/application/queryClient.ts` |
| `resetOrders` callsites | `src/application/store/slices/auth-slice.ts:91,135,165,179,195` |
| Session verify | `edge-functions/_shared/auth.js:46-59` |
| Store-контекст buyer | `src/application/hooks/useAppInit.ts:62-100`; `auth-slice.ts:175-202` |

### Presentation / Shared
| Артефакт | Где |
|---|---|
| Buyer `OrdersView` (заглушка) | `src/presentation/buyer/views/OrdersView.tsx:1-3` |
| Seller Orders / History (заглушки) | `src/presentation/seller/views/SellerOrdersView.tsx:4-11`; `SellerOrdersHistoryView.tsx:4-11` |
| Роуты | `src/router.tsx:99-106,140` |
| Buyer-навигация (Заказы) | `src/presentation/shared/components/FloatingNavBar.tsx:7-13` |
| Seller-навигация (Заказы + nested-подсветка) | `src/presentation/seller/components/SellerNavBar.tsx:6-17` |
| Dashboard-блок «Заказы» | `src/presentation/seller/views/SellerDashboard.tsx:18` |
| Экран успеха → `/orders` | `src/presentation/buyer/views/CartView.tsx:105-112` |
| Контакт продавца | `src/presentation/buyer/components/cart/checkout/StoreContactLink.tsx:18-62` |
| `formatMoneyMinor` | `src/domain/rules/product-rules.ts:81` |
| `SafeImage` | `src/presentation/shared/components/SafeImage.tsx` |

### Документы-основания
| Решение | Где |
|---|---|
| Статусы и outcome | `02 §6–7`, `03 §16` |
| Snapshots | `02 §11`, `03 §13–14` |
| Idempotency | `03 §17`, `21 §3.1–3.2` |
| Граница checkout | `18 §23–27` |
| Инвентарь-lifecycle | `18 §27`, `21 §3.4–3.5` |
| Контакт продавца (locked) | `00` Locked decisions, `02 §14` |
| RLS-статус | `11 §S1` |
