# SHOPPIS — SELLER DASHBOARD / ГЛАВНАЯ ПРОДАВЦА — ТЕХНИЧЕСКИЙ ПЛАН

**Version:** 1.0
**Дата:** 2026-10-11
**Репозиторий:** `forantigravityyesser/Shoppis`
**Базовый срез кода:** `main` после закрытия Cart/Commerce (`18`/`21`), Seller Inventory (`19`/`20`),
Product Copy (`23`) и Orders (`22` + hardening `24`, текущая миграция `0052`).
**Объект:** вкладка **Главная** продавца (`/seller/dashboard`) — операционная сводка из четырёх блоков
(Продажи, Заказы, Инвентарь, Требует внимания) с навигацией в рабочие зоны, и новая отдельная вкладка
**Продажи** (`/seller/sales`) — итоги и список полученных/потенциальных продаж.
**Вне области:** аналитика/графики, фильтры по периодам, конверсии, воронки, 5-я вкладка нижней
навигации, промокоды/доставка-как-услуга/налоги/платёжный шлюз, RLS как прод-гейт (`11 §S1`),
мультивалютная агрегация (конвертации/курсы), push/in-app уведомления, изменения контура заказов
(жизненный цикл/actions), изменения Seller Inventory.

**Связанные документы:** `00` (индекс), `01` (Constitution), `02` (Product Spec §17 — Seller App),
`03` (Domain & Database Spec §13–18), `04` (Technical Spec §4/§9/§11), `05` (Implementation Plan §2.3),
`06` (Seller Inventory — §13 `Dashboard ↔ Inventory`, устаревает, см. §8), `11` (Hardening Backlog §S1),
`16` (Remaining Work), `17` (Catalog Plan — keyset-конвенция), `18` (Cart Plan — границы), `20`
(Seller Inventory hardening — инвентарь как источник counts), `22`/`24` (Orders — read-контур,
`OrderCard`/`OrdersListBody`, гранты), `23` (Product Copy — конвенция «один этап за раз»).

**Статус документа:** authoritative для захода Seller Dashboard. Сверяет требования заказчика с
фактическим кодом (`файл:строка`), фиксирует целевую архитектуру (Onion), контракты RPC/edge, UX
блоков и порядок этапов `SDB-00…SDB-10`. Продуктовые решения `00`/`02` не пересматриваются.

**Прогресс (2026-10-11):** `SDB-00` ✅ — этот документ. `SDB-01` ✅ — миграция
`0053_seller_dashboard_read.sql` (`seller_dashboard_read` + `seller_sales_list_read`) применена на dev,
записана (`public.schema_migrations`), гранты закрыты (anon/authenticated = false, `project_admin` =
true), smoke-shapes проверены. `SDB-02` ✅ — edge `seller-dashboard` создан и задеплоен
(deployment `b7qmkcp6a140`), `order-queries` расширен action `sales` и передеплоен
(deployment `my7y7he764tx`); без токена → 401. `SDB-03` ✅ — application-фундамент: read models
(`SellerDashboardSummary`, `SalesListPage`/`SalesGroup`), порты (`SellerDashboardRepository`,
`OrderRepository.listSales`), мапперы (`dashboard-mappers`, `mapSalesListPage`), инфра-репозитории +
`dashboard-api`/`requestSalesList`, кэш-ключи (`dashboardKeys`, `orderKeys.sales`), хуки
`useSellerDashboard`/`useSellerSales`, DI (container/composition-root), юнит-тесты
(`test` **1139/1139**). `SDB-04` ✅ — harness Test 31–34: authz/гранты dashboard-RPC, счётчики-зеркала
табов (DELIVERED включает RECEIVED; history = REFUSED+CANCELLED), sales-суммы (received/frozen,
текущая валюта), sales-list (`earned`/`potential`, `totalMinor` = зеркало сводки, keyset-пагинация);
`commerce:harness` **175/175**. `SDB-05` ✅ — UI-каркас главной:
`presentation/seller/dashboard/` (`dashboard.css`, `DashboardCard`, `DashboardStat` с тонами,
`DashboardSkeleton`, `DashboardError`, `DashboardEmpty`, `AttentionBlock`), `SellerDashboard` переведён
на `useSellerDashboard` + состояния (loading/error/disabled), блоки Продажи/Заказы/Инвентарь — каркасы.
`SDB-06` ✅ — блок «Заказы»: `DashboardOrdersBlock` (4 индикатора `new/transit/delivered/history` из
`summary.orders`, цвета-тоны, `0` валиден), клик по индикатору → `/seller/orders?status=…`, клик по
заголовку → `/seller/orders` (заголовок-кнопка; карточка — секция, чтобы не было вложенных кнопок);
`DashboardCard`/`DashboardStat` получили `onTitleClick`/`onClick`. `SDB-07` ✅ — блок «Инвентарь»:
`DashboardInventoryBlock` (ряд из двух карточек: «Товары» — на витрине/в архиве с тонами
`active`/`archive`, «Категории» — активные; `.dash-row`/`.dash-stats--compact`), ведут в
`/seller/inventory` и `/seller/inventory?mode=categories`. `SDB-08` ✅ — блок «Продажи»:
`DashboardSalesBlock` (ряд из двух карточек «Заработано»/«Потенциально» с цветом earned/frozen),
`DashboardMoney` (`formatMoneyMinor`, символ текущей валюты из `currentStore`), клик → `/seller/sales`;
все три блока главной наполнены реальными данными. `SDB-09` ✅ — экран «Продажи» `/seller/sales`:
`SellerSalesView` (2 секции «Заработано»/«Потенциальные» с суммой и списком через `useSellerSales`,
клик → деталь заказа, realtime-инвалидация), `OrderCard.priceTone` + `OrdersListBody.emptyText`/
`priceTone`, CSS-тоны, роут + store-guard; тесты (секции/суммы/тоны/навигация/пусто/ошибка).
`SDB-10` ✅ — финальный аудит и docs-sync: гейты `typecheck`/`lint`/`test` **1233/1233**/`build`/
`build:edge`/`migrations:check` 0001..0055/`commerce:harness` **175/175** зелёные; синхронизированы
`00`/`02 §17`/`16`/`06 §13`. **Заход Seller Dashboard (`SDB-00…SDB-10`) закрыт**; открыто только
ручное `LOCAL`/`TELEGRAM`-smoke (за человеком). Миграции захода — `0053`, правка `0055`; текущая в
проекте — `0055`. Отчёт — §9.

**Правка (2026-10-11, по указанию заказчика):** (1) экран «Продажи» разделён на два раздела с
переключателем (`SectionSwitcher`, визуал как в Inventory; `?group=earned|potential`), карточки —
прежний `OrderCard` без изменения фронта; (2) в «Потенциальные» добавлены заказы в статусе `NEW`
(миграция **`0055`** пересоздаёт `seller_dashboard_read`/`seller_sales_list_read`), суммы/списки
потенциального дохода включают `NEW`; (3) индикаторы блока «Заказы» на главной оформлены как отдельные
нажимаемые карточки (рамка). Harness Test 33/34 обновлён.

> **Карта кода — обязательна к прочтению:** `Приложение A` — сверка тезисов плана с фактическим кодом.

---

## 0. Метод и легенда

1. **Один этап за раз** (`SDB-00…SDB-10`): реализация → `npm run typecheck` → `npm run lint` →
   `npm run test` → `npm run build` (+ `npm run build:edge` при edge-изменениях) →
   `npm run migrations:check` при новой миграции → `npm run commerce:harness` при backend-этапах →
   ручная сверка → следующий этап.
2. **Двойная среда проверки** (`00` README): `LOCAL VERIFIED` (браузер) + `TELEGRAM VERIFIED`
   (Mini App на dev). Глобальный этап не закрывается без обоих.
3. **Слоистость:** `View → Hook → Application → Repository → Edge/RPC`. Запрещено `UI → InsForge/SQL`,
   `UI → бизнес-логика`. Presentation не импортирует infrastructure напрямую (доступ — через application).
4. **Переиспользование.** Не создаём вторую карточку заказа, второй формат денег. Повторно используем:
   `OrderCard`/`OrdersListBody`/`OrderListItem` (список заказов), `formatMoneyMinor` (деньги),
   keyset-пагинацию `0026`/`0046`, конвенцию грантов `0048`, паттерн read-контура `22`/`24`.
5. **Фундамент вперёд визуала.** Этапы `SDB-01…SDB-04` — backend/application без UI.
6. **Порядок качества:** `correct → beautiful → polished`.
7. **Server авторитетен.** Клиентские guard'ы — UX; counts/суммы считает только сервер.

Легенда статуса:

| Метка | Значение |
|---|---|
| ✅ | Реализовано/проверено в коде (указан файл/строка) |
| 🟡 | Частично |
| ❌ | Не реализовано |
| 🔒 | Решение зафиксировано этим документом |
| 🧊 | Deferred: осознанно отложено, с триггером включения |

Severity: **H1** обязательно · **H2** высоко · **H3** средне · **H4** косметика.

---

## 1. Продуктовая модель (зафиксировано)

Главная продавца — **операционная сводка** (не профиль магазина): четыре блока, каждый ведёт в свою
рабочую зону.

```text
Главная = срез состояния магазина и быстрый вход в работу
```

### 1.1 Блок «Заказы»

- **Четыре индикатора** с разными цветами: `Новые` / `В пути` / `Доставлено` / `История`.
- Значение каждого = **количество заказов** в бакете (не единицы товара, не позиции).
- Бакеты **зеркалят табы** экрана «Заказы» (инвариант «нажал → увидел ровно столько же»):
  - `Новые` → `status = 'NEW'`;
  - `В пути` → `status = 'IN_TRANSIT'`;
  - `Доставлено` → `status = 'DELIVERED'` (**включая** заказы с исходом `RECEIVED`, т.к. статус
    остаётся `DELIVERED` — `0049`);
  - `История` → `status in ('REFUSED','CANCELLED')` (UI-группировка `history`, не доменный статус).
- Клик по индикатору → `/seller/orders?status=NEW|IN_TRANSIT|DELIVERED|history`;
  клик по заголовку блока → `/seller/orders` (все).

### 1.2 Блок «Продажи»

- **Получено** (реализованный доход): Σ `total_minor` по заказам, где `delivery_outcome = 'RECEIVED'`
  (покупатель забрал с почты после доставки). Зелёный цвет.
- **Заморожено** (потенциальный доход): Σ `total_minor` по заказам, где
  `status in ('NEW','IN_TRANSIT')` **или** (`status = 'DELIVERED'` и `delivery_outcome IS NULL`). Жёлтый цвет.
  (`NEW` включён по правке заказчика — 2026-10-11.)
- В сумму **не входят**: `REFUSED`, `CANCELLED`.
- Только **текущая валюта магазина** (`stores.currency_code`) — см. §3.5.
- Клик по блоку (или по любой карточке) → экран `/seller/sales`.

### 1.3 Блок «Инвентарь»

- **Товары**: два значения — **на витрине** (`status = 'ACTIVE'`) и **в архиве** (`status = 'ARCHIVED'`),
  с цветовым различием. Клик → `/seller/inventory` (раздел «Товары» по умолчанию).
- **Категории**: количество **активных** категорий магазина (пользовательские; системная
  «Без категории» — виртуальная константа, не строка БД, не считается). Клик →
  `/seller/inventory?mode=categories`.

### 1.4 Блок «Требует внимания»

- **Без изменений.** Плейсхолдер с текстом о будущих улучшениях приложения (задачи, требующие действия).

### 1.5 Вкладка «Продажи» (`/seller/sales`)

- Отдельный экран с кнопкой «Назад» (не 5-я вкладка навигации).
- Две секции с переключением (как в Inventory, `?group=earned|potential`, по умолчанию `earned`),
  сверху активной секции — надпись и **сумма секции** (без счётчиков):
  - **«Заработано»** — зелёный акцент заголовка/цены; заказы с `delivery_outcome = 'RECEIVED'`;
  - **«Потенциальные»** — жёлтый акцент; заказы `NEW` / `IN_TRANSIT` / `DELIVERED` без исхода.
- Карточка заказа — визуал существующего `OrderCard` (как в списке заказов), отличается **цветом
  цены** (зелёный/жёлтый).
- Клик по карточке → `/seller/orders/:orderId` (экран деталей заказа; «Назад» по истории возвращает в
  «Продажи»).
- Фильтров по периодам и прочих дополнений нет.

---

## 2. Аудит текущего фундамента (сверено по коду)

### 2.1 Что готово и переиспользуется

| Что | Где | Готовность |
|---|---|---|
| Каркас главной: 4 блока, кликабелен только «Заказы» | `src/presentation/seller/views/SellerDashboard.tsx:19-26` | 🟡 каркас |
| Роут `/seller/dashboard` (store-guard) | `src/router.tsx:72-75` | ✅ |
| Нижняя навигация 4 таба | `src/presentation/seller/components/SellerNavBar.tsx:6-11` | ✅ |
| Orders read-контур: `order_list_read`/`order_detail_read` (keyset, authz по владельцу) | `migrations/0046_orders_query_read.sql` | ✅ |
| Grants: защищённые order-RPC закрыты от `public/anon/authenticated` | `migrations/0048_order_rpc_grants.sql` | ✅ |
| Edge-конвенция: `verifySession` + `adminClient` + маппинг ошибок | `edge-functions/order-queries.js:53-105` | ✅ |
| Read models/mappers/keyset-пагинация заказов | `src/application/read-models/order.ts`, `src/application/mappers/order-mappers.ts` | ✅ |
| React Query: ключи с identity, короткий `staleTime`, инвалидация root `['orders']` | `src/application/orders/order-cache.ts:20-42` | ✅ |
| Realtime заказов + инвалидация | `src/application/hooks/useOrdersRealtime.ts:38-70`, `migrations/0047` | ✅ |
| Список заказов UI: `OrderCard` / `OrdersListBody` / статусы / фильтр `?status=` | `src/presentation/shared/orders/*` | ✅ |
| Исход вручения терминален (`RECEIVED` остаётся `DELIVERED`) | `migrations/0049_order_delivery_outcome_gate.sql:47-53,77-82` | ✅ |
| Статус-метаданные заказов (RU-подписи, safe-getters) | `src/domain/constants/order-statuses.ts:3-9,56-59` | ✅ |
| Инвентарь: Zustand-каталог, derived totals (активные товары/категории) | `src/application/hooks/useInventory.ts:47-150` (`totals` — `:134`) | ✅ источник |
| Секции Inventory через URL (`?mode=categories`) | `src/presentation/seller/views/InventoryView.tsx:45-51` | ✅ |
| Деньги `formatMoneyMinor(minor, symbol)`; валюта магазина в сторе | `src/domain/rules/product-rules.ts:81`, `src/domain/models/store.ts:20-21` | ✅ |
| CSS-каркас: `.screen__header`, `.card`, `button.card`, карточка-кнопка дашборда | `src/presentation/styles/components.css:425-458` | ✅ |
| Конвенция миграций + трекинг | `migrations/README.md`, `public.schema_migrations` (`0034`) | ✅ |
| Harness (в т.ч. read-authz Test 24, grants Test 25) | `scripts/commerce-harness.mjs` (`npm run commerce:harness`) | ✅ |

### 2.2 Что отсутствует / границы блока

| Область | Состояние |
|---|---|
| Серверные агрегаты для главной (counts/sums/inventory) | ❌ нет ни функции, ни edge |
| Экран `/seller/sales` и его данные | ❌ нет роута/read-контура |
| Read-контур «продаж» как проекции заказов | ❌ нет (`order_list_read` не фильтрует по `delivery_outcome`) |
| Порты/read-models/hooks главной | ❌ нет |
| Dashboard-кэш, realtime-обновление сводки | ❌ нет |
| Блоки-компоненты главной (индикаторы/цвета/skeleton) | ❌ |
| `priceTone` в карточке заказа | ❌ |
| Тесты главной/продаж | ❌ |
| Инвентарь: realtime-сигнал об изменении каталога | 🧊 нет (осознанно; обновление — mount-refetch) |

---

## 3. Целевая архитектура (Onion)

### 3.1 Слои и поток

```text
SellerDashboard / SellerSalesView (presentation)
      │  (route: /seller/dashboard, /seller/sales)
      ▼
useSellerDashboard / useSellerSales (application, React Query)
      │
      ├── SellerDashboardRepository (port) ──▶ dashboard-api.ts ──▶ edge `seller-dashboard` (summary)
      │                                                            └─ SQL seller_dashboard_read()
      │
      └── OrderRepository.listSales (port, существующий) ─▶ order-query-api.ts ─▶ edge `order-queries`
                                                                            (action `sales`)
                                                                            └─ SQL seller_sales_list_read()
```

- **Сводка главной** (counts + sums + inventory) — одиночный RPC → один запрос на весь экран.
- **Список продаж** — это **проекция заказов** (`OrderListItem`), поэтому живёт в контуре заказов
  (`order-queries` + `OrderRepository` + `orderKeys`), а не в dashboard-контуре. Так переиспользуются
  маппер, карточка, keyset-пагинация и realtime-инвалидация без дублирования.

### 3.2 Контракты RPC / edge

**`public.seller_dashboard_read(p_actor_user_id uuid, p_store_ref text) returns jsonb`** (SECURITY DEFINER,
`search_path = public, pg_temp`):

```json
{
  "orders":    { "new": 0, "inTransit": 0, "delivered": 0, "history": 0 },
  "sales":     { "receivedMinor": 0, "frozenMinor": 0 },
  "inventory": { "activeProducts": 0, "archivedProducts": 0, "activeCategories": 0 }
}
```

Семантика:
- `orders` — `count(*)` заказов магазина по бакетам (§1.1). Инвариант зеркала табов.
- `sales` — Σ `total_minor` по §1.2, только `currency_code = stores.currency_code`.
- `inventory.activeProducts/archivedProducts` — `count(*)` из `products` по `status` (без
  `deleted_at`-фильтра — как `fetchCatalog`, чтобы значение совпадало с экраном Inventory; удаление
  товара — hard-delete, `product-repository.ts:596`).
- `inventory.activeCategories` — `count(*)` из `categories` по `status = 'ACTIVE'` (системная
  «Без категории» — виртуальная, не строка БД).

**`public.seller_sales_list_read(p_actor_user_id uuid, p_store_ref text, p_group text,
p_cursor text default null, p_limit int default 20) returns jsonb`** (та же защита):

```json
{ "orders": [ OrderListItem... ], "nextCursor": "…|null", "totalMinor": 0 }
```

- `p_group = 'earned'` → `delivery_outcome = 'RECEIVED'`;
- `p_group = 'potential'` →
  `status in ('NEW','IN_TRANSIT') or (status = 'DELIVERED' and delivery_outcome is null)`;
- проекция `OrderListItem` — **та же**, что у `order_list_read` (номер, дата, статус, `total_minor`,
  `currency_symbol_snapshot` с fallback, `itemCount`, `previewItems` 1..3);
- `totalMinor` — сумма по группе в текущей валюте магазина (для заголовка секции);
- keyset-курсор `<epoch_microseconds>:<id>`, `order by created_at desc, id desc` (конвенция `0046`);
- только `currency_code = stores.currency_code` (§3.5).

**Edge:**
- новый `edge-functions/seller-dashboard.js`: `POST { storeRef }` → `verifySession` → `adminClient` →
  `seller_dashboard_read(p_actor_user_id=session.uid, p_store_ref=storeRef)`; ошибки через
  `_shared/errors.js`; валидация `storeRef` (непустая строка, лимит длины).
- расширение `edge-functions/order-queries.js`: новый `action: 'sales'` (`group`, `cursor`, `limit`) →
  `seller_sales_list_read`; списки валидируются существующим `_shared/validate.js`.

### 3.3 Авторизация, гранты, безопасность

- Identity — **только из проверенной сессии** (edge `verifySession`); `storeRef` — requested context,
  не permission. Авторизация — в SQL: `stores.owner_user_id = p_actor_user_id`, иначе **безопасный
  пустой результат/`null`** (без оракула существования), как в `0046:96-101`.
- Резолв магазина: `public_id` (канон) с legacy-совместимостью `id::uuid` (как `0046:80-91`).
- **Гранты:** новые функции не получают `grant execute to public`; follow-up `revoke` для
  `public, anon, authenticated` (паттерн `0048`). Доверенный путь — edge с `adminClient`
  (`_shared/clients.js`, роль `project_admin`).

### 3.4 Кэш, identity, realtime, инвалидация

- **Ключи главной:** `dashboardKeys.summary(userId, storeRef) = ['seller-dashboard', userId, storeRef]`;
  `staleTime: 0` (дешёвый одиночный RPC — всегда свежие счётчики при возврате с Inventory) +
  `refetchOnMount` (дефолт). `invalidateSellerDashboard(queryClient)` — для точечного сброса.
- **Ключи продаж:** `orderKeys.sales(userId, storeRef, group) = ['orders', userId, 'seller', storeRef,
  'sales', group]`. Т.к. корень — `['orders', …]`, существующие `invalidateOrderLists` (realtime,
  refresh, actions) обновляют продажи **бесплатно**, без нового кода инвалидации.
- **Realtime главной:** `useSellerDashboard` подписывается на `deps().orderRealtime.subscribeStoreOrders
  (storeRef, { onChange, onResync })` и инвалидирует сводку (best-effort; без сокета экран работает).
- **Инвентарь на главной:** обновляется при возврате на экран (mount-refetch, `staleTime: 0`);
  realtime каталога отсутствует (§8, 🧊).

### 3.5 Валюта (MVP-ограничение, 🔒)

- Суммы на главной и в продажах считаются **только в текущей валюте магазина**
  (`stores.currency_code`), без конвертаций и без бакетов по валютам. Историю в другой валюте не
  суммируем (согласовано с заказчиком).
- Символ для сумм берётся из `currentStore.currencySymbol` (UI); символ внутри карточек заказа —
  из их собственного `currency_symbol_snapshot` (`0050`), как сейчас.

---

## 4. UX-спецификации блоков

### 4.1 Блок «Заказы» (SDB-06)

- Компонент `DashboardOrdersBlock`: 4 ячейки-индикатора (`Новые/В пути/Доставлено/История`), у каждой
  цветной маркер/акцент и числовое значение. Индикаторы оформлены как отдельные нажимаемые карточки
  (рамка, `dash-stats--cards`) — визуальная подсказка, что по ним можно перейти.
- «Заголовок блока» (весь блок) кликабелен → `/seller/orders`; каждая ячейка → свой `?status=`.
- Состояния: `loading` (skeleton), `error` (сообщение + retry через refetch), `disabled`
  (нет сессии/магазина — отдельный текст, не «заказов нет»).
- Значение `0` — валидное (не скрываем ячейку).

### 4.2 Блок «Инвентарь» (SDB-07)

- Карточка «Товары»: два значения — **на витрине** (активный акцент) и **в архиве** (приглушённый/
  иной цвет). Клик → `/seller/inventory`.
- Карточка «Категории»: количество активных категорий. Клик → `/seller/inventory?mode=categories`.
- Состояния loading/error — как у блока заказов.

### 4.3 Блок «Продажи» (SDB-08) + экран продаж (SDB-09)

**Блок на главной:** две карточки рядом — «Заработано» (зелёная) и «Потенциально» (жёлтая) со
значениями из `summary.sales`. Клик по любой карточке → `/seller/sales` (без deep-link на секцию).

**Экран `/seller/sales`:**
- Шапка: `BackButton fallback="/seller/dashboard"` + заголовок «Продажи».
- Переключатель разделов `SectionSwitcher` (`role=tablist`, визуал как у Inventory): «Заработано» /
  «Потенциальные»; активный раздел в URL (`?group=earned|potential`, по умолчанию `earned`) — «назад»
  из детали возвращает в тот же раздел.
- Активный раздел: надпись + **сумма раздела** (`totalMinor` из `useSellerSales(group)`), список через
  `OrdersListBody` с `priceTone=group`. Пустые тексты: «Полученных продаж пока нет» / «Потенциальных
  продаж нет» (группа `potential` включает `NEW` — правка заказчика 2026-10-11).
- Карточки — существующий `OrderCard` без изменений фронта; клик → `/seller/orders/:orderId`.
- Realtime: `useOrdersRealtime({ scope: 'seller' })` на экране (инвалидирует `['orders']` → списки
  продаж и детали).

**Изменения shared-компонентов:**
- `OrderCard` (+`priceTone?: 'earned' | 'potential'`) → класс-модификатор на `.order-card__total`
  (зелёный/жёлтый). Прочие использования не меняются.
- `OrdersListBody` (+`emptyText?: string`, +`priceTone?`) → прокидывается в `OrderCard`; `emptyText`
  переопределяет текст по умолчанию (сейчас берётся из `statusFilter`). Существующие вызовы
  (buyer/seller) не затрагиваются.

### 4.4 Блок «Требует внимания» (без изменений)

- Оставляем как есть (плейсхолдер о будущих улучшениях). В рамках этого захода не трогаем.

---

## 5. Этапы `SDB-00…SDB-10`

| Этап | Содержание | Severity | Статус |
|---|---|---|---|
| **SDB-00** | Этот документ (требования, аудит, архитектура, этапы, DoD) | — | ✅ (2026-10-11) |
| **SDB-01** | Миграция `0053_seller_dashboard_read.sql`: `seller_dashboard_read` + `seller_sales_list_read`, гранты (revoke), индексы при необходимости; apply + record | H1 | ✅ (2026-10-11) |
| **SDB-02** | Edge `seller-dashboard` (summary) + `order-queries` action `sales`; `build:edge` + deploy | H1 | ✅ (2026-10-11) |
| **SDB-03** | Application: порты/read-models/mappers/репозитории/`dashboard-api`/hooks/cache; container + composition-root; юнит-тесты | H1 | ✅ (2026-10-11) |
| **SDB-04** | Harness Test 31–34 (authz, counts-зеркало, sales-list/total, grants) | H1 | ✅ (2026-10-11) |
| **SDB-05** | UI-каркас главной: блоки-компоненты, skeleton/error/empty, `dashboard.css` | H2 | ✅ (2026-10-11) |
| **SDB-06** | Блок «Заказы»: 4 индикатора/цвета, навигация `?status=`, тесты | H2 | ✅ (2026-10-11) |
| **SDB-07** | Блок «Инвентарь»: витрина/архив/категории, навигация `?mode=categories`, тесты | H2 | ✅ (2026-10-11) |
| **SDB-08** | Блок «Продажи»: 2 карточки → `/seller/sales`, тесты | H2 | ✅ (2026-10-11) |
| **SDB-09** | Экран `/seller/sales`: секции/итоги/`priceTone`, навигация в деталь, route + guard, тесты | H2 | ✅ (2026-10-11) |
| **SDB-10** | Финальный аудит, docs-sync (`00`/`02`/`16`, пометка `06 §13`), гейты, отчёт | H1 | ✅ (2026-10-11) |

### SDB-01 — Backend-фундамент

- `migrations/0053_seller_dashboard_read.sql`: обе функции (§3.2), `security definer`,
  `search_path = public, pg_temp`; резолв/авторизация магазина; `revoke` от `public/anon/authenticated`
  (паттерн `0048`); при необходимости составные индексы под агрегаты (ожидаемо не требуются —
  `orders_store_id_idx`, `products_store_id_idx`).
- Apply на dev + `npm run migrations:record -- 0053`; `npm run migrations:check` (0001..0053).

### SDB-02 — Edge

- `edge-functions/seller-dashboard.js` (по образцу `order-queries.js`).
- `edge-functions/order-queries.js`: `action: 'sales'` + `SALES_GROUPS = ['earned','potential']`,
  валидация `group/cursor/limit`.
- `npm run build:edge`; деплой функций (InsForge MCP/CLI), smoke: без токена → 401.

### SDB-03 — Application (без UI)

- Read models: `src/application/read-models/seller-dashboard.ts` (`SellerDashboardSummary`),
  `src/application/read-models/order.ts` (`SalesGroup`, `SalesListPage`).
- Порт: `src/application/ports/seller-dashboard-repository.ts`; расширение `OrderRepository.listSales`.
- Mappers: `src/application/mappers/dashboard-mappers.ts` (+ расширение `order-mappers.ts` для totals).
- Infra: `src/infrastructure/functions/dashboard-api.ts`, `order-query-api.ts` (`requestSalesList`),
  `repositories/seller-dashboard-repository.ts`, `repositories/order-repository.ts` (`listSales`).
- Кэш: `src/application/dashboard/dashboard-cache.ts`; `order-cache.ts` (+`orderKeys.sales`).
- Hooks: `useSellerDashboard`, `useSellerSales`.
- DI: `container.ts` (+`sellerDashboardRepository`), `composition-root.ts`.
- Тесты: мапперы, хуки (disabled-причины, key с identity, realtime-инвалидация моком).

### SDB-04 — Harness

- **Test 31** authz: чужой продавец/несуществующий `storeRef` → пустой результат (без оракула);
  grants (anon/authenticated недоступны, `project_admin` доступен).
- **Test 32** counts: зеркало табов по каждому статусу (в т.ч. `DELIVERED` c исходом `RECEIVED`);
  `history` = REFUSED+CANCELLED.
- **Test 33** sales-суммы: `received` = RECEIVED; `frozen` = NEW + IN_TRANSIT + DELIVERED-без-исхода;
  NEW/REFUSED/CANCELLED не входят; учитывается только текущая валюта.
- **Test 34** sales-list: `earned`/`potential` корректны, `totalMinor` = сумма группы и **равен**
  `seller_dashboard_read.sales`; keyset-пагинация; authz.

### SDB-05…SDB-09 — UI

- `src/presentation/seller/dashboard/` — `components/DashboardOrdersBlock.tsx`,
  `DashboardInventoryBlock.tsx`, `DashboardSalesBlock.tsx`, `dashboard.css`, тесты.
- `src/presentation/seller/views/SellerDashboard.tsx` — сборка блоков (заменить текущий `Block`).
- `src/presentation/seller/views/SellerSalesView.tsx` (+ компоненты секций) — экран продаж.
- `src/router.tsx` — роут `/seller/sales` (store-guard), lazy-import.
- Изменения `OrderCard`/`OrdersListBody` (§4.3) + их тесты.

---

## 6. Тест-матрица

- **Unit (application):** мапперы (safe-getters, `sales` totals, disabled-причины), `useSellerDashboard`
  (ключ с identity, `staleTime: 0`, realtime-инвалидация через мок `orderRealtime`),
  `useSellerSales` (group в ключе, пагинация, зеркало с order-cache).
- **Unit (presentation):** `DashboardOrdersBlock` (4 значения, `0` валиден, клики → `?status=`, цвета),
  `DashboardInventoryBlock` (витрина/архив/категории, навигация, в т.ч. `?mode=categories`),
  `DashboardSalesBlock` (2 карточки → `/seller/sales`), `SellerSalesView` (2 секции, `priceTone`,
  пустые состояния, клик → `/seller/orders/:id`), `OrderCard`/`OrdersListBody` (новые пропсы не ломают
  существующее).
- **Harness (SQL, SDB-04):** Test 31–34.
- **Ручные:** `LOCAL VERIFIED` (браузер) + `TELEGRAM VERIFIED` (Mini App).

Гейты:

```text
npm run typecheck
npm run lint        (0 errors)
npm run test
npm run build
npm run build:edge            (при edge-этапах)
npm run migrations:check      (при новой миграции)
npm run commerce:harness      (при backend-этапах)
```

---

## 7. Definition of Done

### Фундамент
- [x] `seller_dashboard_read`/`seller_sales_list_read` созданы, применены, записаны; гранты закрыты.
- [x] Edge `seller-dashboard` + `order-queries` (`sales`) собраны и задеплоены; без токена → 401.
- [x] Порты/read-models/mappers/hooks/DI на месте; `presentation` не импортирует `infrastructure`.

### Блоки главной
- [x] «Заказы»: 4 индикатора зеркалят табы, клики ведут в свой `?status=`.
- [x] «Инвентарь»: витрина/архив + активные категории; клики ведут в нужные секции.
- [x] «Продажи»: заработано (зелёное) / потенциально (жёлтое) → `/seller/sales`.
- [x] «Требует внимания» не изменён.

### Вкладка «Продажи»
- [x] Секции «Заработано»/«Потенциальные» с суммой и списком; цвет цены зелёный/жёлтый.
- [x] Клик по карточке → деталь заказа; «Назад» возвращает на продажи.

### Данные/консистентность
- [x] Counts главной совпадают с длиной списка соответствующего таба (harness Test 32).
- [x] `totalMinor` секции продаж = сумме в сводке; только текущая валюта (harness Test 33/34).
- [x] Realtime обновляет сводку и списки продаж; без сокета экран работоспособен.

### Гейты
- [x] `typecheck`/`lint`/`test`/`build`/`build:edge`/`migrations:check`/`commerce:harness` зелёные.
- [ ] `LOCAL VERIFIED` + `TELEGRAM VERIFIED` — ручная проверка (за человеком).

---

## 8. Открытые решения / риски

- **Валюта (🔒):** только текущая валюта магазина, без конвертаций. При смене валюты старые продажи в
  прежней валюте не попадут в суммы/списки. Осознанное MVP-ограничение; при необходимости — отдельный
  later-этап с бакетами.
- **Realtime инвентаря (🧊):** сигнала об изменении каталога нет; счётчики инвентаря обновляются при
  возврате на главную (mount-refetch, `staleTime: 0`). Триггер включения — если появится realtime-канал
  каталога.
- **Пагинация продаж:** keyset-курсор (конвенция `0046`); при малых объёмах список короткий.
- **`06 §13` устаревает:** старая формулировка («товаров всего / заканчиваются / без остатка / новых
  вопросов», `?filter=low-stock`) не соответствует новым требованиям; синхронизация — SDB-10.
- **RLS:** вне scope (общий прод-гейт `11 §S1`); безопасность чтения обеспечивается авторизацией в SQL
  + грантами + edge.

---

## 9. Отчёт захода (SDB-10, ✅ 2026-10-11)

**Результат:** вкладка **Главная** продавца из четырёх блоков и новая вкладка **Продажи** реализованы
целиком (backend → application → UI → тесты).

**Что сделано по этапам:**
- `SDB-00` — этот документ.
- `SDB-01` — миграция `0053_seller_dashboard_read.sql`: `seller_dashboard_read` (counts/sales/inventory)
  + `seller_sales_list_read` (проекция заказов по группе), `SECURITY DEFINER`, `search_path = public,
  pg_temp`, гранты закрыты (паттерн `0048`); применена и записана.
- `SDB-02` — edge `seller-dashboard` (action-less summary) создан/задеплоен; `order-queries` расширен
  `action: 'sales'`; без токена → 401.
- `SDB-03` — application-фундамент: read models (`SellerDashboardSummary`, `SalesGroup`/`SalesListPage`),
  порты (`SellerDashboardRepository`, `OrderRepository.listSales`), мапперы, инфра-репозитории +
  `dashboard-api`/`requestSalesList`, кэш-ключи (`dashboardKeys`, `orderKeys.sales`), хуки
  `useSellerDashboard`/`useSellerSales`, DI.
- `SDB-04` — harness Test 31–34 (authz/grants, counts-зеркало, sales-суммы, sales-list/total).
- `SDB-05…SDB-08` — UI-каркас и три блока главной (`DashboardCard`, `DashboardStat`, `DashboardMoney`,
  `DashboardSkeleton`, `DashboardError`, `DashboardEmpty`, `AttentionBlock`, `DashboardOrdersBlock`,
  `DashboardInventoryBlock`, `DashboardSalesBlock`, `dashboard.css`).
- `SDB-09` — экран `/seller/sales` (`SellerSalesView`), `OrderCard.priceTone`, `OrdersListBody`
  `emptyText`/`priceTone`, роут + store-guard.

**Итоговые автогейты (зелёные):**

```text
npm run typecheck        ✅
npm run lint             ✅ (0 errors)
npm run test             ✅ 1233/1233
npm run build            ✅
npm run build:edge       ✅ (16 функций)
npm run migrations:check ✅ 0001..0055, no duplicates/gaps
npm run commerce:harness ✅ 175/175
```

**Миграции захода:** `0053` (сводка + список продаж) и правка `0055`
(`seller_sales_include_new` — потенциальный доход включает `NEW`). Текущая применённая в проекте —
`0055`.

**Инварианты, доказанные harness:** бакеты главной = число заказов по статусу в БД (DELIVERED включает
RECEIVED; history = REFUSED+CANCELLED); `sales.received` = сумма RECEIVED; `sales.frozen` = сумма
IN_TRANSIT + DELIVERED без исхода (и `NEW`, правка `0055`); только текущая валюта магазина;
`seller_sales_list_read.totalMinor` =
сумма группы и зеркалит сводку; earned/potential не пересекаются; authz чужого магазина → `null`/пусто.

**docs-sync:** `00` (индекс + запись 2026-10-11, документ `25`), `02 §17` (состав блоков главной и
экран продаж), `16` (Seller Dashboard как выполненный), `06 §13` помечен устаревшим (переопределён `25`).

**Открыто:** ручные `LOCAL VERIFIED` + `TELEGRAM VERIFIED` (за человеком). Realtime инвентаря — deferred
(🧊 §8). Валюта — MVP-ограничение (§8).

---

## Приложение A. Карта кода (сверка на 2026-10-11)

| Тезис плана | Артефакт(ы) | Вывод |
|---|---|---|
| Главная — каркас, только «Заказы» кликабелен | `SellerDashboard.tsx:19-26` | ✅ переписать в блоки |
| Роут главной под store-guard | `router.tsx:72-75` | ✅ |
| Навигация 4 таба (продажи — не таб) | `SellerNavBar.tsx:6-11` | ✅ |
| Orders read-контур/keyset/authz | `0046:37-101,115-200` | ✅ переиспользуем проекцию |
| Grants-паттерн | `0048:21-44` | ✅ применить к новым RPC |
| Edge-конвенция (session+admin) | `order-queries.js:53-105`, `_shared/clients.js` | ✅ образец |
| Realtime/инвалидация | `useOrdersRealtime.ts:38-70`, `order-cache.ts:40-42` | ✅ переиспользуем |
| Список заказов UI | `OrderCard.tsx:32-82`, `OrdersListBody.tsx:16-88`, `order-tabs.ts:9-15` | ✅ +`priceTone`/`emptyText` |
| Исход вручения терминален | `0049:47-53,77-88` | ✅ `DELIVERED`+`RECEIVED` остаётся `DELIVERED` |
| Статус-метаданные | `order-statuses.ts:3-9,56-59` | ✅ |
| Фильтр URL заказов | `order-filter.ts:4-30` | ✅ цели навигации |
| Инвентарь counts | `useInventory.ts:88-134`, `products.status` (`0002:34`) | ✅ источник значений |
| Секции Inventory | `InventoryView.tsx:45-51` | ✅ `?mode=categories` |
| Валюта магазина | `store.ts:20-21`, `product-rules.ts:81` | ✅ |
| CSS-каркас карточек | `components.css:425-458` | ✅ расширить |
| Категории/товары статусы | `0002:12-16,34-45`, `category-repository.ts:38-43` | ✅ ACTIVE/ARCHIVED |
| Инфраструктура заказов | `order-repository.ts`, `order-query-api.ts`, `order-mappers.ts` | ✅ расширить за продажей |

### Нумерация миграций

Заход Seller Dashboard — **`0053`** (сводка главной + список продаж); правка `0055`
(`seller_sales_include_new` — потенциальный доход включает `NEW`). Текущий применённый номер в
проекте — `0055`. Следующие — по мере необходимости.

### Изменяемые/новые файлы (обзор)

```text
docs/25_SHOPPIS_SELLER_DASHBOARD_PLAN.md                      ← этот документ
migrations/0053_seller_dashboard_read.sql                     ← SDB-01
edge-functions/seller-dashboard.js                            ← SDB-02 (new)
edge-functions/order-queries.js                               ← SDB-02 (action sales)
src/application/read-models/seller-dashboard.ts               ← SDB-03
src/application/read-models/order.ts                          ← SDB-03 (SalesGroup/SalesListPage)
src/application/ports/seller-dashboard-repository.ts          ← SDB-03
src/application/ports/order-repository.ts                     ← SDB-03 (listSales)
src/application/mappers/dashboard-mappers.ts                  ← SDB-03
src/application/mappers/order-mappers.ts                      ← SDB-03 (totals)
src/application/dashboard/dashboard-cache.ts                  ← SDB-03
src/application/orders/order-cache.ts                         ← SDB-03 (orderKeys.sales)
src/application/hooks/useSellerDashboard.ts                   ← SDB-03
src/application/hooks/useSellerSales.ts                       ← SDB-03
src/infrastructure/functions/dashboard-api.ts                 ← SDB-03
src/infrastructure/functions/order-query-api.ts               ← SDB-03
src/infrastructure/repositories/seller-dashboard-repository.ts ← SDB-03
src/infrastructure/repositories/order-repository.ts           ← SDB-03
src/application/composition/container.ts                      ← SDB-03
src/composition-root.ts                                        ← SDB-03
scripts/commerce-harness.mjs                                  ← SDB-04 (Test 31–34)
migrations/0055_seller_sales_include_new.sql                  ← правка (potential включает NEW)
src/presentation/seller/dashboard/**                          ← SDB-05…08 (new)
src/presentation/seller/views/SellerDashboard.tsx             ← SDB-05
src/presentation/seller/views/SellerSalesView.tsx             ← SDB-09 + правка (switcher ?group=)
src/presentation/shared/components/SectionSwitcher.tsx        ← правка (new)
src/presentation/shared/components/section-switcher.css       ← правка (new)
src/presentation/shared/orders/OrderCard.tsx                  ← SDB-09 (priceTone)
src/presentation/shared/orders/OrdersListBody.tsx             ← SDB-09 (emptyText/priceTone)
src/router.tsx                                                 ← SDB-09 (/seller/sales)
```
