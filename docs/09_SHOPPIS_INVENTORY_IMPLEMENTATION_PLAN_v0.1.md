# SHOPPIS — INVENTORY IMPLEMENTATION PLAN

**Version:** 0.1  
**Актуализировано:** 2026-10-14 (ревизия документации, партия 4: `06`, `07`, `09`).  
**Роль:** порядок и статус этапов Inventory. Этап закрыт, поэтому документ приобрёл
статусно-историческую роль: актуальная спецификация — `06`/`07`, реконструкция — `19`,
hardening — `20`, копирование карточки — `23`.

Легенда: `[x]` готово · `[~]` частично/за человеком · `[ ]` не начато.  
Каждый этап закрывается дважды: **LOCAL VERIFIED** (браузер) и **TELEGRAM VERIFIED** (Mini App).

---

## Phase 0 — Подготовка проекта `[x]`
`SellerLayout`, `SellerNavBar`, `BottomNavBar` не менялись; `/seller/inventory` — точка входа;
`npm run build` проходит.

## Phase 1 — Маршрутизация `[x]`
Фактические маршруты (`src/router.tsx`):
`/seller/inventory`, `/seller/inventory/category/new`, `/seller/inventory/category/:categoryId`,
`/seller/inventory/product/new`, `/seller/inventory/product/:productId` (+ вложенные `reviews`,
`questions`, `preview`), `/seller/inventory/product/:productId/edit`.
`SellerNavBar.resolveActive` подсвечивает «Инвентарь» на вложенных путях.

## Phase 2 — Mock-модель `[x]` _(исторический; мок удалён в Phase 7)_
`src/mock/inventory/*` + `domain/rules/inventory-rules.ts` (агрегат остатка, `stockState`, порог),
`Category.imageStorageKey?/lowStockThreshold?`, `DEFAULT_LOW_STOCK_THRESHOLD`. Вью-модели вынесены
в domain; мок-слой удалён. (SKU в приложение не попадал.)

## Phase 3 — Inventory Home `[x]` _(перестроен в `19`)_
Исходный Home (grid wide/pair, глобальный `InventorySearchState`, `AddInventorySheet`) заменён на
секции **«Товары»/«Категории»** (`InventoryModeSwitcher`, `?mode=`), полноширинные строки
категорий, инлайн-поиск в «Товарах», `CategoryAddSheet` вместо `AddInventorySheet`.

## Phase 4 — CategoryView `[x]`
`CategoryView`: назад, шапка (обложка, название, счётчик), `EditCategorySheet`
(название/обложка/**порог**/reorder/удаление), список `ProductMiniCard`. «Без категории» —
виртуальная (§ADR-06.9).

## Phase 5 — ProductView `[x]` _(расширен)_
Стеклянная шапка (галерея, цена, статус, предпросмотр как покупатель) + табы
**Карточка / Отзывы / Вопросы / Витрина**. `ProductOverview` (остатки, варианты, атрибуты,
действия «В архив»/«На витрину»/«Редактировать»/«Удалить из архива»), `StockControlSheet` и
`AddVariantSheet`; ADR-06.8 guard. Отзывы/вопросы — не read-only заглушка, а seller-ленты с
ответами/скрытием и индикаторами непросмотренных (`14`, `19`).

## Phase 6 — Creation `[x]`
Создание/редактирование вынесено в `ProductDraftEditor` + `ProductForm` (сессия независимых
черновиков, лимит 6; `23`) поверх роутов `/product/new` и `/product/:id/edit`.
`CreateCategoryView` — обложка + название. Загрузка фото — клиентский pipeline (`prepareCardImage`
4:5, `prepareSquareImage` квадрат) → Storage `shoppis-media`. **«+ Создать копию»** — независимый
товар (фото/остатки/резервы не переносятся, связи карточек нет).

## Phase 7 — Real backend `[x]`
Миграция `0009_inventory_columns.sql` (`categories.image_storage_key`, `categories.low_stock_threshold`,
`products.sku`) + `0010_product_image_thumb.sql`; репозитории расширены; данные Inventory живут в
Zustand-слайсах с ленивой догрузкой (`ensureCatalog`/`ensureCategories`) — **TanStack Query для
Inventory не используется**. Мутации переведены на edge `catalog-actions` + атомарные RPC
(`product_*_atomic`, `category_*_atomic`, `variant_create_atomic`). Детали —
`inventory_real_backend_migration_plan.md`.

## Phase 8 — Operations `[x]`
- **Поиск:** инлайн по `title` в секции «Товары» (не в шапке); поиск по SKU/`description` и
  фильтры — нет.
- **Stock-состояния:** агрегат по активным вариантам, порог категории/дефолт.
- **Перенос `held → available`:** через **серверный `inventory_reconcile`** (order-aware, аудит
  движений) — не прямой UPDATE (как было в ранней версии). При активном заказе —
  `INVENTORY_RESERVED_BY_ORDERS`.
- **Отзывы/вопросы:** подключены как seller-ленты/индикаторы (не «0»), `14`/`19`.

## Phase 8.5 — Архивные товары, превью-скролл, статус-ошибки `[x]`
Архивные видны после активных (приглушённо); порядок `ACTIVE → ARCHIVED`, затем `sortOrder`,
`createdAt`; счётчик «+N в архиве»; `ProductPreviewRow` листается стрелками по одной карточке;
`ProductStatusResult`/`ProductStatusErrorCode` + `NO_ACTIVE_VARIANT` (UI и репозиторий);
inline-ошибка + «Повторить».

## Phase 9 — Telegram polish `[~]`
Safe area, BackButton на вложенных маршрутах, haptics, bottom sheets, image picker, анимации,
малые устройства — реализованы; Inventory функционально используется в Telegram. Формальная
финальная `TELEGRAM VERIFIED`-сверка — за человеком.

## Phase 10 — Реконструкция Inventory (`19`) `[x]` LOCAL
`INV-R-01…37`: секции Товары/Категории (Товары по умолчанию), explicit variant
inheritance (`INHERITED`/`CUSTOM`), mutation lifecycle (submitting/disable/error/retry),
чистка `ProductView`, полноширинные строки категорий, per-product индикаторы
отзывов/вопросов. Закрыт как `LOCAL`-этап (`19` Phase G).

## Phase 11 — Hardening Inventory (`20`) `[x]` LOCAL
`INV-HARDEN-01…09`: независимые оси custom-цены/скидки (JS + 7 SQL-функций + checkout; `0037`),
единый mutation API (`throw`), тесты категорий/responsive, переименование
`CategoryGrid/CategoryCard` → `InventoryCategoryList/InventoryCategoryRow`, вынос derived data из
`InventoryView`, lint-гигиена. Закрыт как `LOCAL`-этап (`20 §16`).

## Phase 12 — Копирование карточки (`23`) `[x]` LOCAL
«+ Создать копию» из формы редактирования: независимые черновики, лимит 6; локальное
преобразование значений, сохранение через существующий create/update.

---

## Правила на каждом этапе
- Не добавлять фичи «на будущее» (`01 §17`).
- Компоненты не знают про InsForge — данные и callbacks через props.
- Loading / empty / error — обязательны (`04 §10`).
- Архитектура: `presentation → application → domain`, инфраструктура из `application`.
- Docs-sync: изменение поведения отражается в `06`/`07`/`19`/`20`.
