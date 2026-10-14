# SHOPPIS — DOMAIN & DATABASE SPECIFICATION

**Version:** 0.3  
**Актуализировано:** 2026-10-14 (ревизия документации, партия 2: `03`, `04`). Сверено с
**фактической схемой dev-проекта**: 23 таблицы `public`, индексы/уникальности, RPC-функции и
grants. Явно отмечены расхождения с прежним описанием: Cart/CartItem, Favorite и
NotificationDelivery **не являются таблицами**, ProductGroup — зарезервирован.

## 1. Domain foundation

Core:
`User, Shop, Product, Variant, Inventory, Order, OrderItem`

Supporting (фактически в БД):
`TelegramIdentity, Category, ProductGroup (reserved), ProductImage, ProductAttribute,
ProductLinkAttribute, ProductLink, Review, ReviewReply, Question, QuestionAnswer,
OrderStatusHistory, InventoryMovement, OrderIdempotency, BuyerStoreVisit, SchemaMigration`

Сознательно **не в БД** (текущая реализация, см. `01 D14/D17`):
- `Cart`/`CartItem` — локальное состояние (`cartByStore` в zustand persist), per-store;
  сервер отдаёт read-model (`storefront_cart_items_read`) и остаётся источником истины по
  ценам/остаткам. Перенос в БД — optional future (`16`).
- `Favorite` — локальное (`favoritesByStore`, zustand persist), per-store; сервер гидратирует
  список по id (`storefront_favorite_products_read`).
- `NotificationDelivery` — таблицы нет. Уведомления — best-effort side effects, согласие хранится
  в `telegram_identities.notifications_enabled`; таблица с ретраями — `ПЛАН` (`08 §2.7`).

### Таблицы (23)

| Группа | Таблицы |
|---|---|
| Identity | `users`, `telegram_identities` |
| Shop | `stores` |
| Каталог | `categories`, `products`, `product_groups`, `product_images`, `product_attributes`, `product_link_attributes`, `product_links`, `variants` |
| Инвентарь | `inventory`, `inventory_movements` |
| Заказы | `orders`, `order_items`, `order_status_history`, `order_idempotency` |
| Соц. слой | `reviews`, `review_replies`, `questions`, `question_answers` |
| Прочее | `buyer_store_visits`, `schema_migrations` |

## 2. Identity

### User
`id uuid PK`, `status` (`ACTIVE`), `created_at`, `updated_at`.
Пользователь не несёт роли: один User может владеть магазином и покупать в других (`01 §5`).

### TelegramIdentity
`id uuid PK`, `user_id FK → users`, `telegram_user_id BIGINT UNIQUE`, `username` nullable,
`first_name`/`last_name` nullable, `language_code` nullable, `photo_url` nullable,
`notifications_enabled boolean NOT NULL DEFAULT false`, `notifications_enabled_at` nullable,
`created_at`, `updated_at`.

Две «неидентификационные» колонки — часть продуктового поведения:
- `photo_url` — аватар покупателя в шапке (заполняется из `initData.user.photo_url`);
- `notifications_enabled` — **серверный** источник истины согласия на уведомления (`04 §11`).

### Bootstrap
1. принять raw signed Telegram `initData`;
2. проверить HMAC-подпись по токенам ботов + окно свежести `auth_date` (24 ч, сдвиг 60 с);
3. резолвить identity по `telegram_user_id` (постоянный Telegram id, не username);
4. найти или создать `User` + `TelegramIdentity`;
5. **обновлять профиль identity при каждом входе** (`username`, `first_name`, `last_name`,
   `language_code`, `photo_url`) — чтобы аватар/имя не «застревали» устаревшими;
6. выдать HMAC-сессию `{ uid, tg, iat, exp }`; ответ содержит `bot: buyer|seller|null`
   (источник входа, `01 D4`).

Repeated launches resolve to the same User. Invalid identity fails closed. Client user IDs are
never authorization evidence.

> Реализация: `telegram-auth.js` пишет identity через anon-клиент **после** успешной проверки
> подписи; author-решение всегда принимает edge по actor из сессии, а не по телу запроса.

## 3. Shop (`stores`)

`id uuid PK`, `owner_user_id uuid FK → users` (nullable в БД, но фактически всегда заполнен),
`owner_telegram_id text NOT NULL` (**legacy**; оставлен для ранних данных),
`name text NOT NULL`, `description text DEFAULT ''` (`≤300`, публичное описание витрины, `0056`),
`logo_url`, `banner_url`, `support_handle`, `seller_contact` (**legacy**), `currency`
(`USD|RUB|BYN`), `currency_symbol`, `language` (`ru|en`), `status` (`ACTIVE|PAUSED`),
`public_id text UNIQUE` (opaque ссылка), `created_at`, `updated_at`.

- MVP UI: один магазин на продавца; БД поддерживает много (по `owner_user_id`) — `01 D2`.
- `support_handle` — вручную задаваемый общий контакт (продавец/менеджер/бот), не подменяется
  Telegram-username автоматически (`01 D20`).
- Имя/описание/символ валюты попадают в снимки заказа только через checkout-снимки, не ссылками.

## 4. Category

`id uuid PK`, `store_id FK`, `name`, `normalized_name`, `sort_order int DEFAULT 0`,
`status` (`ACTIVE|ARCHIVED`), `image_storage_key` nullable (обложка), `low_stock_threshold int`
nullable (порог «мало остатка» для инвентарных подсказок категории), `created_at`, `updated_at`.

- Unique `(store_id, normalized_name)`.
- Product has zero or one category; архивная категория не удаляет связь (`02 §19`).
- Порядок категорий (`sort_order`) управляется вручную продавцом через
  `category_reorder_atomic` (`0027`), а не алфавитом.

## 5. ProductGroup (reserved)

`product_groups(id, store_id, created_at, updated_at)` + `products.product_group_id` существуют,
но **не используются** ни UI, ни бизнес-логикой. Связь карточек — явная (`product_links`).
Статус: `DECIDE` (`16 FD-5`) — удалить при чистке или задействовать под будущую группировку.

## 6. Product

`id uuid PK`, `store_id FK`, `product_group_id nullable`, `category_id nullable`,
`title text NOT NULL`, `description text DEFAULT ''`, `status` (`ACTIVE|ARCHIVED`),
`sort_order int`, `original_amount_minor bigint DEFAULT 0`, `discount_percent smallint DEFAULT 0`,
`sku text` nullable (**зарезервировано**, бизнес-логикой не используется), `created_at`,
`updated_at`, `archived_at`, `deleted_at`.

Product stores the seller's original price (`original_amount_minor`, integer minor units) and
`discount_percent` (0..100). Current price is derived server-side (`10. Money`). A variant may
override pricing via `price_mode = CUSTOM_PRICE` (`9. Variant`).

Дополнительно: unique `(store_id, id)` — техническая опора для тенант-целостности
`product_links` (связь не может пересечь магазины, `0031`).

## 7. ProductImage

`id uuid PK`, `product_id FK`, `storage_key text NOT NULL`, `thumb_storage_key` nullable,
`sort_order int`, `width`/`height` nullable, `mime_type` nullable, `file_size_bytes` nullable,
`created_at`.

- Max 4 active images per Product (проверяется в `product_create_atomic`/`product_update_atomic`).
- `storage_key` — «полное» изображение (галерея/карточка товара), `thumb_storage_key` — карточки
  списков. Файлы — в публичном бакете `shoppis-media`; откреплённые файлы удаляются best-effort.

## 8. Product attributes

`ProductAttribute`: `id, product_id, name, value, sort_order` — информационные характеристики.

`ProductLinkAttribute`: `id, product_id, name, value, sort_order` — differentiating-атрибуты
(«чем эта карточка отличается»).

The separate tables encode separate semantics: informational vs card-differentiating context.
Навигацию дают явные `product_links`, а не совпадение атрибута (`01 D7`).

> Реализация: buyer **отображает** linking-атрибуты; seller-редактор linking-атрибутов пока не
> сделан (форма отправляет пустой список) — follow-up `16 FD-1`.

## 9. ProductLink

`id uuid PK`, `store_id FK`, `product_id FK`, `related_product_id FK`, `created_at`.
Unique `(product_id, related_product_id)`; обе стороны — товары одного магазина (`0031`).

Связь направленная: продавец добавляет её из карточки (вкладка «Витрина → Связи»), покупатель
видит как «Похожие товары». Не влияет на остатки/цены и не «сливает» карточки.

## 10. Variant

`id uuid PK`, `product_id FK`, `name`, `value`, `normalized_value`, `sort_order int`,
`status` (`ACTIVE|ARCHIVED`), `price_mode` (`USE_PRODUCT_PRICE|CUSTOM_PRICE`),
`custom_original_amount_minor bigint` nullable, `custom_discount_percent smallint` nullable,
`created_at`, `updated_at`.

- Unique **active** `(product_id, normalized_value)` — частичный индекс
  `WHERE status = 'ACTIVE'`; архивный вариант не мешает создать новый с тем же значением.
- MVP: одна purchase-variant dimension на Product; все активные варианты делят одно `name`.

## 11. Money

All money is integer minor units. Examples: RUB kopeks, USD cents, BYN kopeks.

`0 <= discount_percent <= 100`.

Central deterministic formula:
`current = round(original * (100 - discount_percent) / 100)`.

Rounding implementation is centralized and tested. Порядок округления — половина вверх
(`(original * (100 - discount) + 50) / 100`), единый для JS и SQL.

**Per-axis invariant** (`0037`/`0043`, `01 D9`): для `CUSTOM_PRICE` варианта
`effective = custom_original → custom_discount`, скидка товара не применяется; для
`USE_PRODUCT_PRICE` — скидка и цена товара. Смешение осей запрещено — был источник регрессий
в 7 SQL-функциях.

Символ валюты — `currency_symbol_for(code)`; в заказ пишется **снимок** символа
(`currency_symbol_snapshot`, `0050`), чтобы история не зависела от будущих правок.

## 12. Inventory

One Inventory row per Variant:
`variant_id uuid PK/FK`, `available_quantity int NOT NULL DEFAULT 0`,
`held_quantity int NOT NULL DEFAULT 0`, `updated_at`.

`available_quantity` is purchasable. `held_quantity` is not (заказ «держит» товар до исхода).
Отрицательные значения запрещены логикой RPC (инвариант `>= 0`); SQL-проверки количества —
часть atomic-функций.

### InventoryMovement
`id`, `variant_id FK`, `order_id` nullable, `movement_type`, `quantity`, `from_bucket`/`to_bucket`
nullable, `actor_type` (`system|buyer|seller`), `actor_user_id` nullable, `reason_code` nullable,
`metadata jsonb DEFAULT '{}'`, `created_at`.

Фактический словарь движений (текущий код):

| movement_type | from → to | Когда |
|---|---|---|
| `ORDER_RESERVE` | AVAILABLE → HELD | create_order_atomic |
| `ORDER_CANCEL_RELEASE` | HELD → AVAILABLE | отмена заказа в NEW |
| `ORDER_CANCEL_HELD` | HELD → HELD | отмена в IN_TRANSIT (остаётся held) |
| `ORDER_DELIVERED` | HELD → DELIVERED | исход RECEIVED (товар ушёл) |
| `MANUAL_RECONCILE` | HELD → AVAILABLE | ручная реконсиляция продавцом |

Inventory is the operational source of truth; movement ledger is the audit trail.

## 13. Inventory transitions

Order creation: `AVAILABLE → HELD` (в той же транзакции, что и заказ).
NEW cancellation: `HELD → AVAILABLE`.
IN_TRANSIT cancellation: stays held with reconciliation reason (`ORDER_CANCEL_HELD`).
REFUSED: stays held until manual reconciliation.
RECEIVED (исход DELIVERED): `HELD → DELIVERED`, quantity leaves inventory.

Manual reconciliation: `HELD → AVAILABLE`, atomic and audited; **order-aware** — привязывается к
конкретному заказу (`p_order_id`) и проверяет, что hold реально принадлежит ему
(`INVENTORY_RESERVED_BY_ORDERS`, `0041–0045`). Variant-wide fallback остаётся только для случаев
без заказа (исторические данные / ручные движения).

## 14. Order

Fields:
`id uuid PK`, `public_order_number text UNIQUE` (человекочитаемый номер),
`store_id FK`, `buyer_user_id FK`,
`buyer_full_name_snapshot`, `buyer_phone_snapshot`, `buyer_address_snapshot`,
`buyer_telegram_username_snapshot` nullable,
`status` (`NEW|IN_TRANSIT|DELIVERED|REFUSED|CANCELLED`),
`currency_code`, `currency_symbol_snapshot` nullable (`0050`),
`subtotal_minor bigint`, `total_minor bigint`,
`delivery_outcome` nullable (`RECEIVED|REFUSED`, `0005`),
`refusal_reason_code` nullable (controlled enum, `0051`),
`created_at`, `updated_at`, `cancelled_at`, `completed_at`, `refused_at`.

No delivery charge. Индексы: `(store_id, created_at DESC, id DESC)`,
`(store_id, buyer_user_id, created_at DESC, id DESC)` — keyset-пагинация списков.

## 15. OrderItem

Fields:
`id`, `order_id FK`, `product_id` nullable, `variant_id` nullable,
`product_title_snapshot`, `product_description_snapshot` nullable, `product_image_snapshot`
nullable, `linking_attributes_snapshot jsonb DEFAULT '[]'`, `variant_name_snapshot`,
`variant_value_snapshot`, `quantity int`, `original_unit_price_minor bigint`,
`discount_percent smallint DEFAULT 0`, `unit_price_minor bigint`, `line_total_minor bigint`,
`currency_code`.

Foreign keys are historical references only (nullable!); snapshots are the display source of truth.
`linking_attributes_snapshot` — массив `{name, value}` на момент заказа.

## 16. OrderStatusHistory

`id`, `order_id FK`, `from_status` nullable, `to_status`, `actor_type`, `actor_user_id` nullable,
`reason_code` nullable, `metadata jsonb`, `created_at`.

Every transition is recorded. Запись `DELIVERED → DELIVERED / RECEIVED` фиксирует исход, не меняя
статус.

## 17. State matrix

| From | To | Actor |
|---|---|---|
| NEW | IN_TRANSIT | Seller |
| NEW | CANCELLED | Buyer/Seller |
| IN_TRANSIT | DELIVERED | Seller |
| IN_TRANSIT | CANCELLED | Seller |
| DELIVERED | REFUSED | Seller |

`DELIVERED → DELIVERED` is not a status transition: the seller records `delivery_outcome = RECEIVED`.

`REFUSED` and `CANCELLED` are terminal (`order_cancel` → `ORDER_TERMINAL`). `DELIVERED` is an
operational confirmation stage and may only be finalized as RECEIVED (same status + outcome) or
moved to REFUSED. Повторная фиксация исхода запрещена (`OUTCOME_ALREADY_RECORDED`, `0049`).

## 18. Idempotency

`order_idempotency(id uuid PK, idempotency_key text, buyer_user_id uuid FK, order_id uuid
nullable FK, created_at)`, unique `(buyer_user_id, idempotency_key)`.

Порядок в `create_order_atomic` (`0038`/`0040`):
1. вставить/найти запись идемпотентности (ключ **обязателен** — `IDEMPOTENCY_KEY_REQUIRED`);
2. при повторе с тем же ключом — вернуть существующий `order_id`, новую строку не создавать;
3. зарезервировать inventory **до** записи заказа (reserve-before-order).

Ключ генерируется клиентом **на checkout-попытку** и переиспользуется при retry той же попытки
(`01 D10`, `21`).

## 19. Cart (local, read-model)

В БД таблиц нет. Контракт данных живёт на клиенте:
`CartItemView` (серверная проекция `storefront_cart_items_read(p_public_id, p_items jsonb)`):
по присланным `{ variant_id, quantity }` сервер возвращает актуальные `price`, `stock`,
`available`, снимок названия/фото/варианта, `orderable`. Локальное состояние — удобство; checkout
всё равно переспрашивает цену/остаток (`02 §12`).

Ограничения: `1..99` на строку, `≤100` строк, duplicate variant запрещён (серверный reject).

## 20. Favorite (local)

В БД таблиц нет. `favoritesByStore[storeId]` (zustand persist) хранит id товаров; публичная
проекция `storefront_favorite_products_read(p_public_id, p_ids uuid[])` возвращает актуальные
карточки (только ACTIVE товары магазина), недоступные id молча отбрасываются.

## 21. Reviews

`reviews(id, store_id, product_id, buyer_user_id, rating smallint 1..5, text DEFAULT '', status
ACTIVE|HIDDEN, created_at, updated_at)`, unique `(buyer_user_id, product_id)` — **одна запись
навсегда**: `HIDDEN` не возвращает право на повторный отзыв.

`review_replies(id, review_id FK, author_user_id, author_type BUYER|SELLER, text, created_at)`,
unique `(review_id, author_user_id)`: продавец может ответить на любой отзыв; покупатель — один
раз на чужой отзыв (`author_type` резолвится на сервере по владению магазином).

Verified-purchase гейта нет: отзыв можно оставить в любой момент (`02 §9`). Публичное чтение —
`storefront_product_reviews_read` (summary + гистограмма + replies + viewer-контекст
`canReview`/`isOwn`).

## 22. Questions

`questions(id, store_id, product_id, buyer_user_id, text, status ACTIVE|HIDDEN, created_at)`,
unique `(buyer_user_id, product_id)` — один вопрос на покупателя и товар.

`question_answers(id, question_id UNIQUE, seller_user_id, text, created_at, updated_at)` — один
ответ на вопрос, отвечает только владелец магазина.

Публичное чтение — `storefront_product_questions_read` (viewer-контекст `canAsk`/`isOwn`);
скрытие — покупателем (свой) или продавцом (любой) через `question_hide_atomic`.

## 23. NotificationDelivery — `ПЛАН`

Текущая модель:
- уведомление продавцу о новом заказе — всегда, best-effort из `process-checkout`;
- уведомления покупателю (заказ принят, смена статуса, доставка) — только при
  `telegram_identities.notifications_enabled = true` (серверный гейт);
- фактические отправки живут в edge (`checkout-notify`, `order-notify`, `telegram-notify`);
- сбой отправки не влияет на заказ (вне транзакции).

Таблица `notifications`/`notification_deliveries` с цепочкой статусов, `attempt_count`,
`last_error` и ретраями — `ПЛАН` (`08 §2.7`, `11`).

## 24. BuyerStoreVisit

`buyer_store_visits(id, store_id FK, buyer_user_id FK, first_visited_at, last_visited_at,
visits_count int DEFAULT 1, CHECK visits_count > 0)`, unique `(store_id, buyer_user_id)`;
индекс `(buyer_user_id, last_visited_at DESC, id DESC)` — «Мои магазины» и fallback-вход без
deep-link (`01 D21`).

- Пишется edge `store-visit` (`buyer_store_visit_upsert`) при открытии витрины; fire-and-forget.
- Backfill из заказов `0054` (посещение = min/max `created_at` заказов).
- Чтение: `buyer_store_list_read` (приложение + Buyer Bot), `seller_bot_stats_read` (visitors).

## 25. SchemaMigration (миграционный трекинг)

`schema_migrations(version text PK, name text, applied_at)`. Baseline `0001..0034` + каждая
применённая проектная миграция (`0001..0056` сейчас). Трекинг появился после инцидента с дублем
номера (`0030`); проверка/запись — `npm run migrations:check` / `migrations:record`
(`01 D22`). Таблица закрыта от `anon`/`authenticated`.

## 26. Authorization / RLS

**Фактическое состояние:** RLS выключен на всех таблицах; политик нет. Граница доступа сейчас:

1. **Публичные read-проекции** (`security definer`, `search_path = public, pg_temp`) —
   storefront-функции отдают только разрешённые покупателю поля (`31`).
2. **Authenticated edge**: `telegram-auth`-сессия → edge проверяет actor и вызывает защищённые
   RPC через admin-клиент.
3. **REVOKE**: lifecycle- и приватные read-RPC недоступны `public`/`anon`/`authenticated` — только
   `project_admin` (`0048`, конвенция `0053`/`0054`): `create_order_atomic`, `order_cancel`,
   `order_transition`, `order_delivery_outcome`, `inventory_reconcile`, `order_list_read`,
   `order_detail_read`, `seller_dashboard_read`, `seller_sales_list_read`, `buyer_store_list_read`,
   `buyer_active_orders_read` (проверено `has_function_privilege` на dev-базе). Вызов — только из
   edge через admin-клиент.
4. **Actor из сессии**: все критичные RPC принимают `p_actor_user_id` и сами проверяют владение
   (`stores_assert_owner`/`catalog_assert_store_owner`); клиент не может выбрать чужой scope.

Плановое состояние (гейт перед продом, `11 §S1`): включить RLS и перевести оставшиеся anon-чтения
на серверные функции; кастомная Telegram-сессия не видна PostgREST, поэтому порядок — «сначала
перевод доступа, потом политики» (`01 D23`).

Публичный бакет `shoppis-media` — отдельный слой: файлы по opaque-ключам, прямые URL публичны.

## 27. Invariants

Логические (enforced RPC/UI):
- `available >= 0`, `held >= 0`; операционное quantity > 0;
- money >= 0; `discount 0..100`;
- order total = sum(line totals); snapshots не мутируют;
- cart never reserves; paused/archived ресурсы не создают заказы;
- REFUSED/CANCELLED терминальны; DELIVERED финализируется только RECEIVED/REFUSED;
- per-axis цена варианта не смешивает скидки (`11`).

Схемные (фактические unique/partial индексы):
- `telegram_identities.telegram_user_id` unique;
- `stores.public_id` unique;
- `categories(store_id, normalized_name)` unique;
- `variants(product_id, normalized_value) WHERE status='ACTIVE'` unique;
- `product_links(product_id, related_product_id)` unique;
- `reviews(buyer_user_id, product_id)` unique; `questions(buyer_user_id, product_id)` unique;
- `question_answers.question_id` unique; `review_replies(review_id, author_user_id)` unique;
- `buyer_store_visits(store_id, buyer_user_id)` unique;
- `order_idempotency(buyer_user_id, idempotency_key)` unique;
- `orders.public_order_number` unique.

## 28. Atomic transactions

Атомарные SQL-RPC (единственный путь мутаций из UI):

1. `create_order_atomic` — идемпотентность + snapshots + `AVAILABLE → HELD`;
2. `order_cancel` — NEW: release; IN_TRANSIT: hold остаётся;
3. `order_transition` — NEW → IN_TRANSIT → DELIVERED;
4. `order_delivery_outcome` — RECEIVED (release) / REFUSED (причина);
5. `inventory_reconcile` — order-aware `HELD → AVAILABLE`;
6. `product_create_atomic` / `product_update_atomic` / `product_set_status_atomic` /
   `product_delete_atomic` / `variant_create_atomic` / `product_link_add|remove_atomic`;
7. `category_delete_atomic` / `category_reorder_atomic`;
8. `review_create_atomic` / `review_hide_atomic` / `review_reply_create_atomic`;
   `question_create_atomic` / `question_hide_atomic` / `question_answer_create_atomic`;
9. `store_update_profile_atomic` / `store_set_status_atomic`;
10. `buyer_store_visit_upsert`.

Notifications are outside the order transaction.

## 29. Public IDs

Public storefront/order identifiers must be opaque and non-sequential:
- витрина — `stores.public_id` (random text);
- заказ — `public_order_number` (человекочитаемый, но не раскрывающий последовательность строк);
- ссылки не используют внутренние uuid (`01 D19`).

## 30. Deletion

Product: `ACTIVE → ARCHIVED → DELETED`.
Orders survive catalog deletion because they use snapshots (FK в `order_items` nullable).
Категория: удаление снимает привязку (`product.category_id = null`), архив — скрывает у покупателя,
не меняя привязку.

## 31. Buyer storefront projection (read layer)

Публичные read-функции (`security definer`, anon-execute):

```text
storefront_public_context_read(p_store_ref)                      -- минимальный контекст (resolver)
storefront_home_context_read(p_public_id)                        -- store (+description) + категории
storefront_home_products_read(p_public_id, cursor, limit)        -- первая/след. страницы (keyset)
storefront_catalog_products_read(p_public_id, category_id, search, min, max, cursor, limit)
storefront_catalog_price_bounds_read(p_public_id)                -- границы цен для фильтра
storefront_product_detail_read(p_public_id, product_id)          -- карточка + варианты + атрибуты
storefront_product_reviews_read(p_public_id, product_id, viewer) -- summary + distribution + replies
storefront_product_questions_read(p_public_id, product_id, viewer)
storefront_favorite_products_read(p_public_id, ids uuid[])       -- гидратация локальных избранных
storefront_cart_items_read(p_public_id, items jsonb)             -- реконсиляция корзины
```

Правила проекции:
- `store` — по `public_id`; `status` (`ACTIVE|PAUSED`); `bannerUrl`; `description`; `currency`;
  аватар продавца в buyer-проекцию не входит (`15`).
- `categories` — только `ACTIVE`, сортировка `sort_order`.
- `products` — только `ACTIVE`; keyset-порядок `created_at DESC, id DESC`
  (индекс `products_store_active_created_idx`).
- `categoryId` товара в проекции = `category_id`, если категория `ACTIVE`, иначе `null`.
- `imageUrl` — `thumb_storage_key` (fallback `storage_key`).
- `price` — **только конечная effective price** первого активного варианта; деньги в minor units;
  `originalPrice`/скидка на карточках Home/каталога не отдаются.
- `available` — `stock = 0` у всех активных вариантов → `false` (товар остаётся видимым).
- reviews/questions — только `ACTIVE`; viewer-контекст (`isOwn|canReview|canAsk`) — не
  авторизация, а UI-подсказка; запись всё равно проверяет actor в `*_atomic` RPC.

## 32. Telegram identity extras

Telegram `photo_url` фиксируется при серверной аутентификации:

```text
initData.user.photo_url → telegram-auth → telegram_identities.photo_url → ServerUser.photoUrl
```

Используется как аватар **текущего покупателя** в шапке Mini App (fallback — инициал из
`first_name`). В buyer storefront `photo_url` продавца не отдаётся. На pause показывается
публичный логотип/название магазина (`stores.logo_url`).

`language_code` из `initData` — fallback для выбора языка интерфейса (`02 §22`):
сохранённый выбор → язык магазина → язык Telegram → `ru`.
