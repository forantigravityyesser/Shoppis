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
`storefront_catalog_products_read` + `storefront_catalog_price_bounds_read` (миграция `0026`),
продавец управляет порядком категорий (`category_reorder_atomic`, миграция `0027`, edge
`catalog-actions`), application-контур `StorefrontCatalogRepository`/`useStorefrontCatalog`
(`useInfiniteQuery` + `keepPreviousData`), URL-состояние (`category`/`q`/`minPrice`/`maxPrice`),
поиск с debounce, фильтр цены, чипсы, infinite loading, состояния. План/аудит — `17` (CAT-00…CAT-15).
Осталось: ручная визуальная проверка в Telegram; RLS — вне scope.

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
14. `17_SHOPPIS_CATALOG_PLAN.md` — Каталог покупателя (server-driven): план реализации, единый контракт read-model/URL/React Query, переиспользование Home-фундамента; этапы CAT-00…CAT-15 (ЧТО+КАК).

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
