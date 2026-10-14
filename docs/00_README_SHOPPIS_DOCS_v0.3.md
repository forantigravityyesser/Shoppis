# SHOPPIS — DOCUMENTATION SET v0.3

Статус: рабочая техническая база. v0.3 синхронизирует документы с фактически реализованным
Identity-слоем и Seller App Shell (маршруты панели продавца, нижняя навигация, разделение
Dashboard ↔ Settings).

**Ревизия 2026-10-14:** проведена сквозная сверка **всего набора `00`–`25`** с фактическим кодом и
БД (по партиям; см. changelog ниже и `05` для полной истории). Каждый документ приведён к текущей
реализации либо помечен статусом. Полный индекс — в разделе «Документы».

**Актуализация v0.4 (2026-10-01):** зафиксировано направление buyer storefront MVP — вкладка
Главная, Каталог, Product Card, карточка товара, избранное, корзина, заказы, нижняя навигация
покупателя и storefront-read layer (`13`). Синхронизированы `02` §18–19, `03` §29–30,
`04` §6/§8/§9/§17/§18/§19, `05` Stage 3, `08`.

**Актуализация (2026-10-04):** hardening вкладки **Главная** покупателя **выполнен**
(HOME-HARDEN-01…11): buyer avatar (а не seller), public store boundary вместо `select('*')`,
progressive/cursor product loading вместо `slice(0,6)`, семантика `ProductCard`, единый `SafeImage`,
удаление `originalPrice` из Home, keyset-индекс (замер 0.9 ms / 2000 товаров). Разбор, план и
финальный аудит — `15`; `13` приведён в соответствие (v0.5). Home считается hardened; следующий
крупный блок — Catalog (server-side) и Product Detail (`14`).

**Актуализация (2026-10-04):** вкладка **Каталог** покупателя **реализована** (server-driven): RPC
`storefront_catalog_products_read` + `storefront_catalog_price_bounds_read` (миграция `0026`,
hardening `0033`: PAUSED-boundary + literal search), продавец управляет порядком категорий
(`category_reorder_atomic`, миграция `0027`, edge `catalog-actions`), application-контур
`StorefrontCatalogRepository`/`useStorefrontCatalog` (`useInfiniteQuery` + `keepPreviousData`),
URL-состояние (`category`/`q`/`minPrice`/`maxPrice`), поиск с debounce, фильтр цены, чипсы,
infinite loading, состояния. План/аудит — `17` (CAT-00…CAT-16).
Осталось: ручная визуальная проверка в Telegram; RLS — вне scope.

**Актуализация (2026-10-05) — migration hygiene:** убран дубль номера
(`0030_storefront_catalog_hardening` → `0033_storefront_catalog_hardening`), введён трекинг
применённых проектных миграций — таблица `public.schema_migrations` (`0034`), проверки
`npm run migrations:check` / `migrations:record`, конвенция `migrations/README.md`. InsForge CLI
`db migrations` не используется (timestamp-имена + нет backfill) — обоснование в README.
`record-migration.mjs` переведён на прямой admin REST (Windows-баг `spawnSync('npx.cmd')` падал молча).

**Актуализация (2026-10-05) — Cart реализован:** вкладка **Корзина** (`/cart`) и граница до checkout —
`18_SHOPPIS_CART_PLAN.md`, этапы `CART-01…CART-06` **выполнены**. buy-side read-model `CartItemView`
(RPC `storefront_cart_items_read`, миграция `0036`), реконсиляция, selection/select-all, inline-удаление,
один итог в CTA, checkout-форма (ФИО / телефон / **адрес доставки**), экран успеха, Telegram-разрешение
на первый заказ и **серверный гейт** уведомлений (`process-checkout` по `notifications_enabled`).
**Правка относительно внешнего spec:** получатель — это **адрес доставки, а не email** (email не
запрашиваем/не храним; snapshot `buyer_address_snapshot` уже существует в `0003`). Стоимость/опции
доставки в MVP не считаем, но адрес доставки запрашиваем. Осталось: ручная проверка в Telegram;
Orders-вкладка — всё ещё заглушка (фундамент `ordersByStore`/`lastOrder` готов).

**Актуализация (2026-10-05) — реконструкция Seller Inventory:** зафиксированы спецификация и полный
план исправлений/рефакторинга инвентаря — `19_SHOPPIS_SELLER_INVENTORY_RECONSTRUCTION_SPEC_v0.1.md`
(этапы `INV-R-01…INV-R-37`). Ключевое: разделение Inventory на секции **Товары/Категории** (Товары —
по умолчанию), явное наследование вариантов (`INHERITED/CUSTOM` вместо эвристики по пустому полю),
mutation lifecycle (submitting / disable / error / retry) для всех seller-мутаций. По правке
заказчика секции «Отзывы/Вопросы» **остаются** в навигации seller-карточки с индикаторами, а из
`ProductOverview` убраны только действия; секция «Категории» — полноширинные строки (визуал блока
сохранён).
Приложение A содержит сверку спеки с фактическим кодом (файлы/строки); ADR-06.7 (`06`)
переопределён — reorder реализован (`17`, `0027`); синхронизация `06/07/09` — фаза G.

**Прогресс `19`:** Phase A `[x]` (явное наследование вариантов, submitting/error lifecycle,
проброс ошибок мутаций), Phase B `[x]` (правка заказчика: секции «Отзывы/Вопросы» **остаются**
в навигации seller-карточки с индикаторами непросмотренного/без ответа, из `ProductOverview`
удалены действия; INV-R-08 переопределён), Phase C `[x]` (общий `useCategoryReorder`, lifecycle
реордера с await/disable/error/retry, порядок «N из M» в `EditCategorySheet`), Phase D `[x]`
(переключатель **Товары/Категории**, Товары по умолчанию, инлайн-поиск и список товаров,
индикатор внимания на карточке товара) и Phase E `[x]` (категории — **полноширинные строки**,
визуал блока сохранён, мёртвый wide/pair-код удалён; «+» разделены: в «Товарах» — сразу форма
товара, в «Категориях» — сразу форма категории; «+» в блоке категории — выбор «Новый товар /
Товар из магазина» с мультивыбором и быстрым переносом). Phase F `[x]` (`CategoryView`:
список/редактирование/контекст; поиск в секции «Категории» убран — категорий немного) и
Phase G `[x]` LOCAL (typecheck/тесты/build зелёные, мёртвый код удалён, `06/07/08/09`
синхронизированы, аудит §45.1; ручная `LOCAL`/`TELEGRAM`-сверка — за человеком).

**Актуализация (2026-10-05) — commerce hardening (Cart/Checkout/Order):** внешний аудит контура
Cart→Checkout→Order→Inventory перенесён в `21_SHOPPIS_CART_COMMERCE_HARDENING_AUDIT.md` (этапы
`CART-HARDEN-01…12`). Вердикт: Cart архитектурно готов (Onion 9.2, read-model/reconciliation 9.0),
но commerce-фундамент **не закрыт**: P0 — idempotency retry (один attempt = один key) и SQL race
(reserve-before-order), серверный quantity-contract `1..99` + reject duplicate variant, `held_quantity`
custody (seller read-only, переносы через `inventory_reconcile`), SQL/integration/concurrency тесты.
Отклонены как противоречащие решениям `00`/`18`: email-получатель и отдельный `CartTotalCard`
(итог только в CTA). `P0` независимых осей цены/скидки — общая зависимость с `20` (`INV-HARDEN-02`,
SQL `0037`); commerce-миграции начинаются с `0038`. **Прогресс:** `CART-HARDEN-01` ✅ (ключ на
checkout-попытку, reuse на retry), `CART-HARDEN-02` ✅ (миграция `0038`: `create_order_atomic`
reserve-before-order, применена и записана), `CART-HARDEN-03` ✅ (серверный quantity-contract `1..99` +
reject duplicate variant: `_shared/checkout-items.js`, миграция `0039`, edge задеплоен), `CART-HARDEN-04` ✅
(`held_quantity` custody: seller read-only, переносы через `inventory_reconcile`). **Phase A+B+C закрыты:** `CART-HARDEN-05` ✅ (harness `npm run commerce:harness`, Test 1–9 — 24/24),
`CART-HARDEN-06` ✅ (гейт: `test` 812/812, `build`, `migrations:check` 0001..0039; `0037` записана),
`CART-HARDEN-07…09` ✅ (checkout→reconcile, select-all только orderable + `MAX_CART_ITEMS`, split
`cart-rules`/`checkout-rules`), `CART-HARDEN-10…12` ✅ (`BuyerCartItem`, selection summary, финальный
docs-sync/аудит). **Commerce-фундамент закрыт;** осталась ручная `LOCAL`/`TELEGRAM`-проверка за человеком.

**Актуализация (2026-10-10) — пост-аудит регрессии commerce (`21` §13):** закрыты P0 №1 (`0039` заново
вернула старый гейт цены, затёрв per-axis из `0037` → миграция **`0040`** пересоздаёт `create_order_atomic`
один раз с независимыми осями и обязательным idempotency key `IDEMPOTENCY_KEY_REQUIRED`), P0 №2
(`inventory_reconcile` стал order-aware: миграция **`0041`**, `p_order_id` + `INVENTORY_RESERVED_BY_ORDERS`),
P0 №3 (ключ идемпотентности обязателен на клиенте/edge/RPC) и P1 (`useBuyerCart.resolved` — нет ложного
экран ошибки при полном удалении устаревших позиций). Harness расширен **Test 10** (4 комбинации осей —
800/960/900/1080 в Product Detail / Cart / `order_items`) + Test 11/12. Гейт: `test` **816/816**,
`migrations:check` 0001..0041, `commerce:harness` **44/44**.

**Актуализация (2026-10-05) — hardening Seller Inventory:** повторный аудит после `19` перенесён в
`20_SHOPPIS_SELLER_INVENTORY_HARDENING_AUDIT.md` (этапы `INV-HARDEN-01…09`). Ключевое: P0 — независимые
оси custom-цены и custom-скидки варианта, причём **шире внешнего аудита** (не только seller-маппинг и
`effectivePrice`, но и 7 живых SQL-функций buyer/checkout). Далее: единый mutation API (`throw`),
тесты категорий/responsive, переименование `CategoryGrid/CategoryCard` → `InventoryCategoryList`/
`InventoryCategoryRow` (✅ `INV-HARDEN-06`), вынос derived data из `InventoryView`, lint-гигиена.
Пункты, уже закрытые в `19` (Reviews/Questions, submit-tests, AddVariantSheet fire-and-forget), в
аудите помечены устаревшими. Производительность 100+ товаров (N+1 social summary) — deferred с
триггером. **Прогресс:** `INV-HARDEN-01` ✅ (независимые оси в JS:
`product-mapping`/`addVariant`/`effectivePrice`) и `INV-HARDEN-02` ✅ (миграция `0037`: 7 SQL-функций
per-axis, применена/записана, 0 регрессий; `P0` закрыт). `INV-HARDEN-04` ✅ — единый mutation API
(`throw` + `ProductStatusError`, без `console.error`-глотания), `INV-HARDEN-05` ✅ — тесты категорий и
responsive, `INV-HARDEN-06` ✅ — переименование `CategoryGrid/CategoryCard` + CSS, `INV-HARDEN-07` ✅ —
derived data вынесена из `InventoryView`, `INV-HARDEN-08` ✅ — lint полностью чист (8→0 warnings),
`INV-HARDEN-09` ✅ — docs-sync и финальный аудит. **Seller Inventory закрыт как LOCAL-этап** (`20 §16`);
полный гейт зелёный (`typecheck`/`lint` 0/0/`test` 812/`build`/`migrations:check`), открыто — ручная
`LOCAL`/`TELEGRAM`-сверка. Зависимость: `0038` (`21`) не должна откатывать per-axis логику
`create_order_atomic`.

**Актуализация (2026-10-10) — Orders (заказы покупателя и продавца):** внешний технический план
Orders перенесён в формат проекта и сверен с кодом — `22_SHOPPIS_ORDERS_TECHNICAL_PLAN.md` (этапы
`ORD-00…ORD-13`). Сверка показала: idempotency (reserve-before-order `0038`/`0040`), серверный
quantity-contract (`0039`) и инварианты инвентаря (harness Test 2/3/7/8/9/11/12) уже закрыты `21` —
в `22` помечены `⏭️` и не дублируются. Работа закрыта полностью (**ORD-01…ORD-13 ✅**):
authenticated order read-контур (`0046` + edge `order-queries` + repository на RPC), серверный
резолв Telegram username в checkout (`_shared/checkout-identity.js`), read models/mappers,
React Query hooks (`useOrders`/`useOrderDetails`/`useOrderActions`, server state выведен из Zustand),
shared UI списка/деталей + actions (buyer cancel, 6 seller-действий), routing/compat, QA.
Гейты: `typecheck`/`lint`/`test` 940/940 · `commerce:harness` 102/102 · `build`. Экран Orders
реализован (buyer `OrdersView` + shared detail; seller `SellerOrdersView` + detail); остаётся
ручной `LOCAL`/`TELEGRAM` smoke. `16` FD-3 синхронизирован.

**Актуализация (2026-10-11) — Orders hardening (`24`):** внешний аудит блока заказов перенесён в
`24_SHOPPIS_ORDERS_HARDENING_AUDIT.md` (этапы `ORD-HARDEN-00…12`) и выполнен второй слой поверх `22`.
Закрыты: P0 прямой доступ к защищённым order-RPC (`0048` `REVOKE` + доверенный `adminClient`),
терминальность delivery outcome (`0049`), исторический символ валюты (`0050`
`currency_symbol_snapshot` + backfill), кэш↔личность и invalidation списка при ошибке (D10),
`/orders` без store-контекста (D5), enum-safety причины отказа (`0051`), edge-валидация/контракт
ошибок + анти-дубль уведомлений (D1/D2), `search_path = public, pg_temp` + timing-safe HMAC + окно
`auth_date` (D3/D4, `0052`), дедуп buyer/seller списков + domain-rules + a11y (D6–D9). Harness
расширен **Test 25–30**. Realtime (ORD-14 / `0047`) не менялся (accepted risk). Гейты: `typecheck` ·
`lint` (0 errors) · `test` 1081/1081 · `build` · `migrations:check` 0001..0052 · `commerce:harness`
143/143; ручные `LOCAL`/`TELEGRAM` — за человеком. Текущая миграция — `0052`.

**Актуализация (2026-10-11) — Seller Dashboard / Главная продавца (`25`):** вкладка **Главная**
продавца реализована из четырёх блоков (Продажи/Заказы/Инвентарь/Требует внимания) и добавлена
вкладка **Продажи** (`/seller/sales`) — `25_SHOPPIS_SELLER_DASHBOARD_PLAN.md` (этапы `SDB-00…SDB-10`
✅). Один серверный read главной `seller_dashboard_read` (counts по статусам-зеркалам табов, суммы
дохода, счётчики инвентаря) + `seller_sales_list_read` (проекция заказов по группам
`earned`/`potential`), миграция **`0053`**; edge `seller-dashboard` + `order-queries` action `sales`;
application-контур (read-модели/порты/мапперы/хуки/кэш); блоки главной (индикаторы заказов, товары/
категории, заработано/потенциально) с навигацией; экран «Продажи» — два раздела с переключателем
(«Заработано» зелёный / «Потенциальные» жёлтый; `?group=`), карточки → деталь заказа. Суммы — только
в текущей валюте магазина (MVP). **Правка (2026-10-11):** потенциальный доход включает заказы в
статусе `NEW` (миграция `0055`). Harness расширен **Test 31–34**. Гейты: `typecheck` · `lint`
(0 errors) · `test` 1233/1233 · `build` · `build:edge` · `migrations:check` 0001..0055 ·
`commerce:harness` 175/175; ручные `LOCAL`/`TELEGRAM` — за человеком. Миграции захода — `0053`/`0055`
(текущая в проекте — `0055`).

**Актуализация (2026-10-10) — Product Copy (независимые черновики):** добавлено ТЗ «+ Создать копию»
поверх существующих форм создания/редактирования — `23_SHOPPIS_PRODUCT_COPY_TECHNICAL_PLAN.md`
(этапы `PC-00…PC-08`). Копирование — локальное преобразование данных формы; сохранение — существующий
сценарий create/update; фото, остатки и резервы не переносятся; связи между карточками нет; лимит 6 —
клиентская сессия. Решения `Q1–Q6`/`R1–R9` **приняты** и зафиксированы (Приложение C): пустой остаток = `0`;
возврат `productId` из create-цепочки (вариант A); минимальный exit-guard; `crypto.randomUUID`;
локальный application-контроллер без нового Zustand-среза; существующее подтверждение удаления.
Stage 0 (карта кода `файл:строка`, расхождения и короткий аудит) — §2; `PC-00` учтён в плане.
**Прогресс:** `PC-00…PC-08` ✅ LOCAL — копирование черновиков реализовано (`createProductCopy`,
`product-draft-session` + `useProductDraftSession`/`useProductDraftSave`, `ProductDraftEditor`,
`useUnsavedChangesGuard`; сквозной возврат `productId` create-цепочки; `ProductForm` управляемый;
удаление черновика и уход карточки из списка после сохранения); гейт `typecheck`/`lint`/`test`
1011/1011/`build`/`migrations:check` зелёный; отчёт — `23 §14.1`; осталось ручное `TELEGRAM`-smoke.

**Актуализация (2026-10-03):** следующий блок buyer-части — карточка товара: экран, галерея,
варианты/цена/наличие, избранное, корзина, «О товаре / Отзывы / Вопросы» (чтение), related
(ProductGroup), публичный read layer `0015` и seller mini-stage для linking attributes/ProductGroup —
`14_SHOPPIS_PRODUCT_DETAIL_PLAN.md` (этапы `PD-01…PD-14`).

Граница слоёв: `presentation` не импортирует `infrastructure` напрямую — доступ к haptics и
загрузке изображений идёт через `application` (`useHaptic`, `image-service`). Детали — Technical
Spec §9.0.

**Актуализация (2026-10-14) — ревизия документации, партия 1 (`01`, `02`):** начат сквозной проход
по docs от первых номеров (самые старые — первыми). `01` дополнена §10 «Реестр зафиксированных
решений» — 24 решения с обоснованием «что выбрано / почему / что отвергнуто» (контекст≠роль,
entry-bot по подписи `initData`, `product_links` вместо ProductGroup, per-axis цены, reserve-before-
order + обязательный idempotency key, адрес вместо email, локальные cart/favorites, границы order-
RPC, delivery outcome, i18n ru/en, `buyer_store_visits`, миграционный трекинг, RLS-гейт, realtime).
`02` приведена к текущей реализации: онбординг продавца, dashboard header, вкладка «Продажи»,
матрица статусов/актёров заказов и терминальность исхода, фактическое состояние Reviews/Questions
(свободные отзывы без verified purchase, ответы, hide; post-delivery feedback — `ПЛАН`),
cart/checkout-контракт (локальная корзина + серверный read-model, `1..99`, до 100 строк,
idempotency), новые §20 (entry points/боты/deep links), §21 (список магазинов покупателя), §22
(языки интерфейса и магазина).

**Актуализация (2026-10-14) — партия 2 (`03`, `04`):** сверка с фактической схемой dev-проекта
(23 таблицы, индексы, RPC, grants, RLS). `03` переписан по реальности: `product_links` вместо
ProductGroup (reserved), точные поля всех таблиц (`stores.description/currency_symbol`,
`telegram_identities.photo_url/notifications_enabled`, `orders.currency_symbol_snapshot/
delivery_outcome`, `order_idempotency`, `buyer_store_visits`, `schema_migrations`), словарь
`inventory_movements`, order-aware reconcile, раздел про local cart/favorites и отсутствие
NotificationDelivery, фактические unique/partial-индексы, grants/REVOKE-модель `0048`, полный
список storefront-проекций. `04` актуализирован: 18 edge-функций и `_shared`, HMAC-сессия
(TTL 6 ч) + окно `auth_date` + timing-safe, `entryBot`, admin/anon-клиенты, reserve-before-order
и контракт checkout `1..99`, image-pipeline (4:5 full 1000×1250 + thumb 512×640; категория 320;
баннер ≈2.2:1/1100), фактическая структура `src/` и слоёв, i18n, notifications-флоу, security
actual-vs-planned, testing (vitest + harness Test 1–34 + migrations:check + CI), deployment
(Vercel + InsForge, env-переменные), deep links и вход без `startapp`.

**Актуализация (2026-10-14) — партия 3 (`05`):** прежний «OpenCode Implementation Plan»
**переработан в историю разработки** — `05_SHOPPIS_DEVELOPMENT_HISTORY.md` (файл переименован,
ссылки обновлены): этапы 0–8 от первых коммитов (`7c2e2cd`: Vutrina → rework идеологии → Onion-
рефакторинг → атомарность и настройки → Buyer storefront → Каталог → Inventory/Cart → Orders →
Dashboard/i18n/боты → текущий WIP entry-bot/buyer-stores), сводная таблица 28 коммитов, параллельная
история документации, поперечные линии (архитектура, атомарность, read-модели, hardening-волны,
миграции, тесты, Telegram-платформа, i18n) и журнал инцидентов/уроков (дубли номеров миграций,
регрессия price axes, checkout-гонка, дедлайн opt-in уведомлений, REVOKE order-RPC, окно
`initData`). Остаток работ смотреть в `16`/`11`/`08`.

**Актуализация (2026-10-14) — партия 4 (`06`, `07`, `09` — Inventory):** сверено с фактическим
кодом экрана. `06`: ADR-06 получили статус реализации — ✅ 06.1/06.2/06.3/06.6/06.7/06.8; ⚠️ 06.4
(SKU: колонка есть, использования/unique-индекса нет), 06.9 («Без категории» реализовано
**виртуально** — `UNCATEGORIZED_ID`, колонка `is_system` не добавлялась), 06.5 (edit-маршрут
`/product/:id/edit` всё же появился); маршруты/компоненты/данные приведены к реальности (секции
«Товары»/«Категории», Zustand + ленивая догрузка вместо TanStack Query, `held → available` через
`inventory_reconcile`, мутации через `catalog-actions` + atomic RPC), таблица фактических миграций
(`0009`/`0010`/`0027`/`0037`/`0043`). `07`: структура экрана (header + mode switcher + секции),
interaction map, component tree и data contracts обновлены; поиск в шапке помечен удалённым.
`09`: Phase 8 исправлен (`held → available` через `inventory_reconcile`, отзывы/вопросы
подключены), добавлены Phase 10/11/12 (реконструкция `19`, hardening `20`, копирование `23`).
Следующая партия — `10`+`12` (настройки магазина).

**Актуализация (2026-10-14) — партия 5 (`10`, `11`, `12` — Store Settings / Hardening Backlog):**
`10` дополнен §1.1 — фактическая структура настроек (Hub + дочерние экраны профиль / локализация /
контакт / поделиться, inline-статус и язык интерфейса); все блоки помечены реализованными. `12`
актуализирован: статус `S-00…S-11` закрыт, исправлена карта файлов (Hub/child views), обновлена
модель магазина (убрано «0 строк»), добавлено примечание о Hub-структуре. `11` переписан: журнал
закрытого (атомарный каталог/settings, harness Test 1–34, lint 0/0, placeholder-экраны, PD-R) и
актуальный остаток — S1 RLS (главный гейт перед продом), notification-delivery таблица, rate
limiting, серверная upload-валидация, `useAppInit`/valibot/SQL-хелпер/версии, CSS-чистка.
Следующая партия — `08` (divergence) и далее `13`–`25`.

**Актуализация (2026-10-14) — партия 6 (`08`, divergence):** реестр приведён к фактическому
остатку после сверки `01`–`12`. Удалены закрытые/устаревшие пункты (pause-экран, buyer storefront,
reviews/questions, deep links, opt-in; «cart/favorite в БД» снято как **решение** `01 D14`; «поиска
нет» — устарело; placeholder-экраны реализованы). Открытые: **S1** RLS (гейт перед продом),
**S2** таблица `NotificationDelivery`, **S3** серверный image pipeline и scope поиска
`title`/`description`, **S4/DECIDE** — `products.sku`, `product_groups`, legacy-колонки/dev-пути,
buyer post-delivery feedback, `useAppInit`/`window.Telegram`. Следующая партия — feature-доки
`13`–`25`.

**Актуализация (2026-10-14) — партия 7 (`13`, `14` — Buyer Home / Product Detail):** `13` —
исправлены точечные несоответствия: профиль в шапке — аватар/имя **покупателя** (§1/§4), убран
`originalPrice` из Home ProductCard, related — через `product_links` (не `ProductGroup`), ссылка на
`01 D14` вместо устаревшего `08 §2.2`. `14` — обновлён раздел «Следующие блоки» (Cart/Favorites/
Orders реализованы; остаток — social-пагинация/фильтры, удаление ответов, RLS), добавлено
примечание о viewer-aware read-RPC (`0016`/`0019`). Обе — с отметкой ревизии. Следующая партия —
`15`+`16` (Home hardening + remaining work).

**Актуализация (2026-10-14) — партия 8 (`15`, `16` — Home Hardening / Remaining Work):** `15`
подтверждён актуальным (HOME-HARDEN-01…11 закрыт; ручные браузер/Telegram-проверки — за человеком);
обновлены cross-ссылки на перенумерованный `08` (RLS `§1.1`, legacy `§4.3`), «2 read на холодном
старте» помечен как осознанная модель (§5.8, не divergence), favorites — `01 D14`. `16` — сверен с
кодом: графы FD-3 (Cart/Favorites/Orders), AR (Каталог, Главная продавца) закрыты; ссылки на `08`
обновлены. Остаётся `TODO/DEFERRED/DECIDE`: linking-атрибуты (FD-1), seller preview (FD-2),
social follow-up'ы (FD-4), `product_groups` (FD-5), blur-up/prefetch (FD-6). Следующая партия —
`17`+`18` (Catalog + Cart).

**Актуализация (2026-10-14) — партия 9 (`17`, `18` — Catalog / Cart):** `17` подтверждён
реализованным (CAT-00…CAT-16); обновлён номер миграции этапа (`0026`; проект уже на `0056`,
каталожный hardening — `0033`) и диапазон этапов. `18` подтверждён (CART-01…06 + commerce hardening);
обновлены ссылки на перенумерованный `08` и число harness-тестов (**Test 1–34**). В `16` добавлен
отсутствовавший follow-up **`CATALOG-20`** (фильтр цены по всем вариациям — `DEFERRED`), на который
ссылается `17`. Следующая партия — `19`+`20` (Inventory reconstruction + hardening audit).

**Актуализация (2026-10-14) — партия 10 (`19`, `20` — Inventory reconstruction/hardening):**
оба аудита подтверждены завершёнными (`INV-R-01…37`, `INV-HARDEN-01…09` — LOCAL). Упоминания
`08 §2.1/§2.11` (пункты реестра, закрытые и удалённые в партии 6) помечены как исторические;
в шапки добавлены отметки ревизии. Следующая партия — `21`+`24` (Commerce / Orders hardening).

**Актуализация (2026-10-14) — партия 11 (`21`, `24` — hardening audits):** оба закрыты
(`CART-HARDEN-01…12`, `ORD-HARDEN-00…12`); добавлены отметки ревизии. В `21` пояснено, что
«Test 1–9 / 24/24 / `0001..0039`» — момент этапа (harness позже расширен до Test 1–34, миграции до
`0056`). В `24` убрана ссылка на удалённый `08 §2.11`. Следующая партия — `22`+`23` (Orders
technical plan + Product Copy).

**Актуализация (2026-10-14) — партия 12 (`22`, `23` — Orders / Product Copy):** подтверждены
закрытыми (`ORD-00…13` + `ORD-14` realtime, `PC-00…08` — LOCAL); добавлены отметки ревизии; в `22`
диапазон приведён к `ORD-HARDEN-00…12`; в `23` отмечено, что число тестов (`1011/1011`) — снимок
этапа. Следующая партия — `25` (Seller Dashboard).

**Актуализация (2026-10-14) — партия 13 (`25` — Seller Dashboard):** подтверждён закрытым
(`SDB-00…SDB-10`; ручная `LOCAL`/`TELEGRAM`-свёрка за человеком); добавлена отметка ревизии. Этим
завершена сквозная ревизия всего набора; ниже — обновлённый полный индекс документов.

## Документы

Полный индекс набора (`docs/`). `[LAN]` — заход закрыт как LOCAL-этап (осталась ручная
`LOCAL`/`TELEGRAM`-свёрка за человеком). Source of truth: продукт — `02`, данные — `03`,
инфраструктура — `04`, принципы — `01`, конкретная реализация — код.

### Core
- `00` — этот README: индекс, принцип двух сред, locked decisions, changelog ревизий.
- `01` — Constitution: принципы, границы MVP, non-negotiable rules; **§10 — реестр решений (D1–D24)** с обоснованием.
- `02` — Product Spec: поведение продукта и UX (навигация, inventory, заказы, entry points/боты, i18n).
- `03` — Domain & Database Spec: фактическая схема (23 таблицы), инварианты, RPC/grants, storefront-проекции.
- `04` — Technical Spec: стек, edge/RPC, auth, storage, security, testing, deployment.
- `05` — Development History: этапы 0–8, хронология 28 коммитов, решения и инциденты.

### Seller
- `06` — Seller Inventory Spec: домен/UX/данные Inventory, ADR-06 со статусом реализации.
- `07` — Inventory UX Spec: что видит/делает продавец (секции Товары/Категории).
- `09` — Inventory Implementation Plan: этапы и статус (+ реконструкция и hardening).
- `10` — Store Settings Plan (ЧТО); §1.1 — фактическая Hub-структура.
- `12` — Store Settings Implementation Plan (КАК), этапы `S-00…S-11` `[LAN]`.
- `19` — Inventory Reconstruction (`INV-R-01…37`) `[LAN]`.
- `20` — Inventory Hardening Audit (`INV-HARDEN-01…09`) `[LAN]`.
- `25` — Seller Dashboard Plan: главная + «Продажи» (`SDB-00…SDB-10`) `[LAN]`.

### Buyer
- `13` — Buyer Home Plan: Главная/Каталог/карточка/навигация, storefront-модель (`H-01…H-11`).
- `14` — Product Detail Plan: карточка товара, отзывы/вопросы (чтение+запись), related (`PD-01…PD-14`).
- `15` — Buyer Home Hardening Audit (`HOME-HARDEN-01…11`, + `HOME-FIX-01…05`); переопределяет части `13`.
- `17` — Catalog Plan (server-driven) `CAT-00…CAT-16` `[LAN]`.
- `18` — Cart Plan + граница checkout `CART-01…CART-06` `[LAN]`.
- `22` — Orders Technical Plan: заказы покупателя и продавца `ORD-00…ORD-14` `[LAN]`.
- `23` — Product Copy Plan: независимые черновики карточки `PC-00…PC-08` `[LAN]`.

### Cross-cutting
- `08` — Docs/Code Divergence: открытые расхождения (S1 RLS, notifications, search scope, SKU, …).
- `11` — Hardening Backlog: тех-долг (журнал закрытого + актуальный остаток, RLS-гейт).
- `16` — Remaining Work: продуктовые follow-up'ы (`FD-1…FD-6`, `CATALOG-20`).
- `21` — Cart/Commerce Hardening Audit (`CART-HARDEN-01…12`) `[LAN]`.
- `24` — Orders Hardening Audit (`ORD-HARDEN-00…12`) `[LAN]`.

### Source material (не пронумеровано)
- `Списки и детали товара.md` / `.txt` — исходные пожелания заказчика по карточке товара (основа `14`).
- `inventory_real_backend_migration_plan.md` — исторический план перехода Inventory на реальный backend (`09` Phase 7).

## Принцип двух сред проверки
Telegram — не финальная интеграция, а целевая среда исполнения и проверки с первых этапов. Каждый глобальный этап имеет два состояния: `LOCAL VERIFIED` (браузер / локальный контур) и `TELEGRAM VERIFIED` (реальный Telegram Mini App на development-окружении). Этап не закрывается без обоих.

## Source of truth
- Продуктовое решение → Product Spec.
- Схема данных → Domain & Database Spec.
- Инфраструктура → Technical Spec.
- Принцип/граница → Constitution.
- Конкретная реализация → код.

## Domain foundation
`User → Shop → Product → Variant → Inventory → Order → OrderItem`

Supporting (фактически в БД): `TelegramIdentity, Category, ProductImage, ProductAttribute,
ProductLinkAttribute, ProductLink, Review, ReviewReply, Question, QuestionAnswer, OrderStatusHistory,
InventoryMovement, OrderIdempotency, BuyerStoreVisit, SchemaMigration`.  
**Не в БД:** `Cart`/`CartItem` и `Favorite` — локально (Zustand persist, per-store); `NotificationDelivery`
— `ПЛАН` (`08 §2.1`); `ProductGroup` — зарезервирован, не используется (`16 FD-5`). Детали — `03`.

## Locked decisions
- Один пользователь может быть и покупателем, и продавцом.
- В MVP UI один магазин на продавца; БД сразу поддерживает несколько.
- Один Mini App/frontend; два пользовательских бота как entry points (buyer/seller) + операционный
  admin-edge (`telegram-bot-admin`).
- Разные цвета/формы одного товара — отдельные Product, связанные **явными двусторонними связями
  `product_links`**; `ProductGroup` зарезервирован и не используется.
- Variant — покупаемая опция внутри Product: Size/Volume/Capacity и т.п.
- Одна Product в MVP имеет одну dimension вариантов, без Color × Size матрицы.
- Product attributes разделены на обычные и linking/differentiating.
- Inventory имеет `available_quantity` и `held_quantity`.
- Cart ничего не резервирует.
- Checkout заново проверяет цену и остаток.
- Order хранит immutable snapshot товара, варианта, покупателя и итогов.
- Доставка в MVP не входит в сумму.
- Статусы: `NEW`, `IN_TRANSIT`, `DELIVERED`, `REFUSED`, `CANCELLED`.
- Buyer cancellation — только `NEW`.
- После `REFUSED` товар не возвращается автоматически в available.
- Product/Category: `ACTIVE/ARCHIVED`; Product удаляется только из archive.
- Shop: `ACTIVE/PAUSED`.
- Seller contact (`support_handle`) — общий контакт для связи (продавец/менеджер/бот), задаётся вручную и не подменяется Telegram username автоматически; возможна явная кнопка подстановки своего @username.
- Public links используют opaque `public_id`, без последовательных DB IDs.
- Деньги — integer minor units, без float.
