# SHOPPIS — DOCUMENTATION SET v0.3

Статус: рабочая техническая база. v0.3 синхронизирует документы с фактически реализованным
Identity-слоем и Seller App Shell (маршруты панели продавца, нижняя навигация, разделение
Dashboard ↔ Settings).

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

**Актуализация (2026-10-05) — hardening Seller Inventory:** повторный аудит после `19` перенесён в
`20_SHOPPIS_SELLER_INVENTORY_HARDENING_AUDIT.md` (этапы `INV-HARDEN-01…09`). Ключевое: P0 — независимые
оси custom-цены и custom-скидки варианта, причём **шире внешнего аудита** (не только seller-маппинг и
`effectivePrice`, но и 8 живых SQL-функций buyer/checkout). Далее: единый mutation API (`throw`),
тесты категорий/responsive, переименование `CategoryGrid/CategoryCard` (+ CSS-классы), вынос derived
data из `InventoryView`, lint-гигиена. Пункты, уже закрытые в `19` (Reviews/Questions, submit-tests,
AddVariantSheet fire-and-forget), в аудите помечены устаревшими. Производительность 100+ товаров
(N+1 social summary) — deferred с триггером.

**Актуализация (2026-10-03):** следующий блок buyer-части — карточка товара: экран, галерея,
варианты/цена/наличие, избранное, корзина, «О товаре / Отзывы / Вопросы» (чтение), related
(ProductGroup), публичный read layer `0015` и seller mini-stage для linking attributes/ProductGroup —
`14_SHOPPIS_PRODUCT_DETAIL_PLAN.md` (этапы `PD-01…PD-14`).

Граница слоёв: `presentation` не импортирует `infrastructure` напрямую — доступ к haptics и
загрузке изображений идёт через `application` (`useHaptic`, `image-service`). Детали — Technical
Spec §9.0.

## Документы
1. `01_SHOPPIS_PROJECT_CONSTITUTION_v0.3.md` — принципы, границы MVP и правила.
2. `02_SHOPPIS_PRODUCT_SPEC_v0.3.md` — точное поведение продукта и UX.
3. `03_SHOPPIS_DOMAIN_DATABASE_SPEC_v0.3.md` — сущности, БД, состояния, инварианты, транзакции и RLS.
4. `04_SHOPPIS_TECHNICAL_SPEC_v0.3.md` — React/Vite, InsForge, Telegram, auth, storage, security.
5. `05_SHOPPIS_OPENCODE_IMPLEMENTATION_PLAN_v0.3.md` — маленькие независимые engineering tasks.
6. `08_SHOPPIS_DOCS_CODE_DIVERGENCE_v0.3.md` — незакрытые расхождения кода и документации.
7. `10_SHOPPIS_STORE_SETTINGS_PLAN.md` — настройки магазина: product/UX spec (ЧТО).
8. `11_SHOPPIS_HARDENING_BACKLOG.md` — отложенный hardening (RLS, тесты, косметика).
9. `12_SHOPPIS_STORE_SETTINGS_IMPLEMENTATION_PLAN.md` — настройки магазина: реализация (КАК), этапы S-00…S-10.
10. `13_SHOPPIS_BUYER_HOME_PLAN.md` — покупательская часть: Главная/Каталог/карточка/навигация, storefront-модель и read layer, этапы H-01…H-11 (ЧТО+КАК).
11. `14_SHOPPIS_PRODUCT_DETAIL_PLAN.md` — карточка товара покупателя: экран/галерея/варианты/цена/наличие/избранное/корзина, отзывы и вопросы (чтение), related (ProductGroup), публичный read layer `0015`, seller mini-stage; этапы PD-01…PD-14 (ЧТО+КАК).
12. `15_SHOPPIS_BUYER_HOME_HARDENING_AUDIT.md` — hardening Главной покупателя: разбор аудита против кода, public store boundary, buyer avatar, progressive/cursor product loading, семантика `ProductCard`, image hardening, убрать `originalPrice` из Home; этапы HOME-HARDEN-01…11. Переопределяет `13` §3/§5/§9-10/§19/§28 — см. Приложение C.
13. `16_SHOPPIS_REMAINING_WORK.md` — реестр незавершённого/отложенного (product follow-up'ы, roadmap, ссылки на hardening `11` и divergence `08`). Сюда перенесён редактор linking attributes (из `14` PD-14).
14. `17_SHOPPIS_CATALOG_PLAN.md` — Каталог покупателя (server-driven): план реализации, единый контракт read-model/URL/React Query, переиспользование Home-фундамента; этапы CAT-00…CAT-16 (ЧТО+КАК).
15. `18_SHOPPIS_CART_PLAN.md` — Корзина покупателя (`/cart`) + граница до checkout: единый источник истины (inventory), buy-side read-model `CartItemView`, реконсиляция, selection/select-all, inline-удаление, один итог, checkout-форма (ФИО / телефон / **адрес доставки**, не email); этапы CART-01…CART-06 (ЧТО+КАК).
16. `19_SHOPPIS_SELLER_INVENTORY_RECONSTRUCTION_SPEC_v0.1.md` — реконструкция Seller Inventory: план исправлений и рефакторинга (секции Товары/Категории, explicit variant inheritance, mutation lifecycle, чистка ProductView, полноширинные строки категорий); этапы INV-R-01…INV-R-37, Приложение A — разбор относительно кода.
17. `20_SHOPPIS_SELLER_INVENTORY_HARDENING_AUDIT.md` — повторный hardening-audit Seller Inventory после `19`: независимые оси custom-цены/скидки (JS + 8 живых SQL-функций + checkout), единый mutation API (throw), тесты категорий/responsive, переименование `CategoryGrid/CategoryCard`, derived data, lint-гигиена; этапы INV-HARDEN-01…09, deferred-производительность 100+ с триггером.

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

Supporting: `Category, ProductGroup, ProductImage, ProductAttribute, ProductLinkAttribute, Cart, CartItem, Favorite, Review, Question, QuestionAnswer, OrderStatusHistory, InventoryMovement, NotificationDelivery, TelegramIdentity`.

## Locked decisions
- Один пользователь может быть и покупателем, и продавцом.
- В MVP UI один магазин на продавца; БД сразу поддерживает несколько.
- Один Mini App/frontend и два Telegram-бота как entry points.
- Разные цвета/формы одного товара — отдельные Product, связанные через ProductGroup.
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
