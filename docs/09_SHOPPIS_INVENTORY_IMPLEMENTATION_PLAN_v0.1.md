# SHOPPIS — INVENTORY IMPLEMENTATION PLAN

**Version:** 0.1
**Дата:** 2026-09-24
**Роль:** порядок кодирования Inventory и статус этапов.
**Ссылки:** `06 … INVENTORY_SPEC` (данные/БД/релизы), `07 … INVENTORY_UX_SPEC` (UX).

> **Обновление (2026-09-29):** инвентарь полностью переведён с in-memory мока на реальный
> InsForge (PostgreSQL + PostgREST + Storage `shoppis-media`), мок-слой `src/mock` удалён.
> Детали, этапы 1–10 и отклонения — `inventory_real_backend_migration_plan.md`.

Легенда статуса: `[x]` готово · `[~]` в работе · `[ ]` не начато.
Каждый этап закрывается дважды: **LOCAL VERIFIED** (браузер) и **TELEGRAM VERIFIED** (Mini App).

---

## Phase 0 — Подготовка проекта `[x]`
- Не меняем `SellerLayout`, `SellerNavBar`, `BottomNavBar`.
- `/seller/inventory` — точка входа.
- `npm run build` проходит.

## Phase 1 — Маршрутизация `[x]`
- Добавлены `/seller/inventory/category/:categoryId`, `/seller/inventory/product/:productId`
  (`src/router.tsx`), каркасы `CategoryView`, `ProductView`.

## Phase 2 — Mock-модель `[x]` _(исторический этап; мок удалён в Phase 7)_
- `src/mock/inventory/{constants,store,types,index}.ts` — модель повторяла domain
  (`Product/Variant/Inventory`), стартовое состояние **пустое** (демо-данные удалены).
- `src/domain/rules/inventory-rules.ts` — агрегат остатка, `stockState`, порог.
- `Category.imageStorageKey?/lowStockThreshold?`, `DEFAULT_LOW_STOCK_THRESHOLD`.
  (SKU убран из приложения; колонка `products.sku` осталась в БД.)
- Вью-модели вынесены в `src/domain/models/inventory-view.ts`, мок-слой удалён.

## Phase 3 — Inventory Home `[x]`
- `InventoryView` + `InventoryHeader`, `InventoryToolbar`, `CategoryGrid`, `CategoryCard`,
  `ProductThumbnail`, `AddProductTile`, `EmptyInventoryState`, `InventorySearchState`,
  `InventorySkeleton`, `AddInventorySheet`, общий `BottomSheet`.
- `src/application/hooks/useInventory.ts` (контракт под Query), `useInventoryActions.ts`.
- `src/presentation/seller/inventory/{layout.ts,inventory.css}`.
- In-memory `src/mock/inventory/store.ts` (`useSyncExternalStore`): первая загрузка пустая,
  созданные категории/товары встают в тот же детерминированный шаблон.
- LOCAL: `npm run build` — успешно. Визуальная проверка в браузере — за пользователем.

---

## Phase 4 — Category View `[x]`
- `CategoryView`: `BackButton`, шапка (эмодзи-аватар, название, счётчик, «Редактировать»),
  поиск по названию/SKU, список `ProductMiniCard`.
- `ProductMiniCard`: фото/эмодзи, название, остаток (цвет по состоянию), цена, сигналы ★/💬/❓.
- `EditCategorySheet` — название + порог (ADR-06.6), `mockInventoryStore.updateCategory`.
- `UNCATEGORIZED_ID` → «Без категории».
- Состояния: пустая категория («В этой категории пока нет товаров»), search/filter-empty.
- `src/application/hooks/useCategory.ts`, `domain/constants/currencies.ts`.

## Phase 5 — Product View `[x]`
- Галерея, название, цена, `StockPanel` (в наличии / в ожидании), мета (категория, атрибуты),
  отзывы/вопросы (read-only), действия «На витрину» / «В архив» / «Редактировать».
- ADR-06.8: «На витрину» недоступна без ≥1 активного варианта.
- Данные — `useProductDetail` (Zustand + InsForge), деталь собирается маппером.

## Phase 6 — Creation `[x]`
- Роуты `/seller/inventory/product/new`, `/seller/inventory/category/new`; формы
  `CreateProductView` (Основное/Продажа/Вариант + «В архив»/«На витрину», ADR-06.8) и
  `CreateCategoryView` (название + порог).
- `EditProductView` (`ProductForm` в режиме редактирования), `EditCategorySheet` (Phase 4).
- Загрузка фото: товар — `prepareCardImage` (4:5) → `uploadFile` (Storage `shoppis-media`), обложки
  категорий — `prepareSquareImage` (квадрат).
- Удаление категории — в `EditCategorySheet` (подтверждение): товары переходят в «Без категории»
  (`category_id = null`), обложка удаляется из Storage; системную «Без категории» удалить нельзя.
- Поведение: `+` в категории → сразу форма товара в контексте категории; `+ Добавить` (toolbar)
  → выбор Товар/Категория, оба ведут в формы.
- Осталось: `CategoryMoreButton` (⋯) / `CategoryActionsSheet` (опционально).

## Phase 7 — Real backend `[x]`
- Миграция `0009_inventory_columns.sql` (`categories.image_storage_key`, `categories.low_stock_threshold`,
  `products.sku`); колонки применены в БД (idempotent).
- Расширены репозитории `category-repository.ts` / `product-repository.ts` (порог, обложка,
  `updateCategory`, `updateVariantStock`, `addVariantToProduct`).
- Хуки `useInventoryHome` / `useCategoryPage` / `useProductDetail` читают из Zustand с ленивой
  догрузкой (`ensureCatalog` / `ensureCategories`); TanStack Query не используется.
- Storage: обложки категорий и изображения товаров через `uploadFile` (`uploadAuto`).
- Полная детализация — `inventory_real_backend_migration_plan.md`.

## Phase 8 — Operations `[~]`
- Поиск по `title` — сделано (SKU убран; поиск по `description` и фильтры — нет).
- Stock-состояния — сделано (агрегат по активным вариантам, порог категории/дефолт).
- «Переместить в наличии» — сделано через прямой UPDATE `inventory` (`moveHeldToAvailable`),
  без RPC `inventory_reconcile` (журнал движений не пишется).
- Отзывы/вопросы как показатели — пока 0 (данные `reviews/questions` не подключены).

## Phase 8.5 — Архивные товары, превью-скролл, статус-ошибки `[x]`
- Архивные товары видны на Home (после активных), в CategoryView и поиске; приглушённые
  (`grayscale` + `opacity`), метка «Скрыт». Порядок: `ACTIVE` → `ARCHIVED`, затем `sortOrder`,
  `createdAt` (`compareProductsForDisplay`).
- Счётчик категории: активные + мелко «+N в архиве».
- `ProductPreviewRow`: листание стрелками `←`/`→` ровно на одну карточку (без скролла/свайпа);
  видимо сразу `wide` 5 / `compact` 3; последняя ячейка `+`.
- Смена статуса: `ProductStatusResult` + `ProductStatusErrorCode`; guard ADR-06.8 в UI и в
  репозитории (`NO_ACTIVE_VARIANT`); inline-ошибка + `[Повторить]` в карточке товара.
- Документация: `07 §6.1`, `06` (SCREEN 1, ProductActions, UX-состояния).

## Phase 9 — Telegram polish `[ ]`
- Safe area, BackButton на вложенных маршрутах, haptics, bottom sheets, image picker, анимации,
  малые устройства.

---

## Правила на каждом этапе
- Не добавлять фичи «на будущее» (`01 §17`).
- Компоненты не знают про InsForge — данные и callbacks через props.
- Loading / empty / error — обязательны (`04 §10`).
- Архитектура: `presentation → application → domain`, инфраструктура из `application`.
