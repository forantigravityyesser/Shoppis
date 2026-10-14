# SHOPPIS — SELLER INVENTORY SPEC

**Version:** 0.1  
**Актуализировано:** 2026-10-14 (ревизия документации, партия 4: `06`, `07`, `09`). Сверено с
фактическим кодом. Реконструкция Inventory зафиксирована в `19`, hardening — в `20`; при
расхождении «спека ↔ код» приоритет имеют `19`/`20` (реконструкция и её аудит).  
**Статус:** рабочая спецификация Inventory; заменяет/уточняет `02 §17` в части «Инвентарь».  
**Ссылки:** `01` принципы, `02` продукт (`§17`), `03` домен/БД, `04` техника, `07` (UX),
`09` (план/статус), `19` (реконструкция), `20` (hardening), `23` (копирование карточки),
`25` (главная продавца).

---

## 0. Назначение документа

Inventory — это **панель управления товарным каталогом продавца**, а не «список товаров».
Рабочая зона: товары, категории, остатки, карточка товара. Dashboard — центр управления,
Inventory — зона ежедневной работы (§13).

Остатки (`в наличии` / `в ожидании`) — часть карточки товара, а не отдельная сущность UI.

> **Историческая справка.** v0.1 (2026-09-24) описывал Inventory как визуальную карту
> «категории → товары» с mock-данными. Реальность ушла дальше: реконструкция `19` разделила
> экран на секции **«Товары»** (по умолчанию) и **«Категории»**, добавила explicit variant
> inheritance и mutation lifecycle; hardening `20` закрыл независимые оси цены, объединил API
> мутаций и переименовал компоненты категорий. Разделы ниже приведены к этой реальности.

---

## 1. Ключевая концепция (актуально)

Три уровня интерфейса:

```
Level 1  Inventory Home     /seller/inventory
   Переключатель «Товары» (по умолчанию) / «Категории» (?mode=categories)
   • Товары: инлайн-поиск + масштабируемый список (InventoryProductRow)
   • Категории: полноширинные строки категорий (InventoryCategoryList/Row) + «+»
                 │
Level 2  Category           /seller/inventory/category/:categoryId
   Обложка, счётчик, поиск, список ProductMiniCard; создание/редактирование категории
                 │
Level 3  Product            /seller/inventory/product/:productId
   Стеклянная шапка (галерея/цена/статус/предпросмотр) + табы
   «Карточка | Отзывы | Вопросы | Витрина»; редактирование — /edit
```

Товар без категории (`category_id = null`) — легальное состояние. В UI он попадает в
**виртуальную** группу «Без категории» (константа `UNCATEGORIZED_ID`, строка в секции
«Категории»); реальной записи категории для этого нет (§2 ADR-06.9).

---

## 2. Locked decisions (ADR-06) и фактический статус

### ADR-06.1 — Вкладка Inventory = каталог + остатки внутри — ✅ реализовано
`/seller/inventory` — панель каталога; остатки — в карточке товара (`ProductOverview` +
`StockControlSheet`). `inventory_reconcile` — единственный механизм переноса `held → available`
(см. §6 SCREEN 3).

### ADR-06.2 — Остаток товара = агрегат по Variant/Inventory — ✅ реализовано
`productStock(productId, variants, inventories)` (`domain/rules/inventory-rules.ts`) суммирует
только `ACTIVE`-варианты. `Product.stockQuantity`/`ProductMedia` не вводились. Компонент не
складывает остаток сам — только вызывает правило.

### ADR-06.3 — Обложка категории — ✅ реализовано
`categories.image_storage_key` (миграция `0009_inventory_columns.sql`); квадратный `thumb` 320px,
загрузка через `uploadCategoryCoverImage` (`04 §6`).

### ADR-06.4 — SKU товара — ⚠️ частично / фактически не реализовано
Колонка `products.sku` **есть** (миграция `0009`), но в приложении **не используется**:
поля в формах нет, поиск по SKU не делается, unique-индекс `(store_id, sku)` **не создан**.
Колонка оставлена «на будущее».

### ADR-06.5 — Что не добавляем — ✅ с одной оговоркой
Видео нет; `ProductMedia` нет; глобального поиска нет. **Исключение:** отдельный edit-маршрут
появился — `/seller/inventory/product/:id/edit` (`EditProductView` + сессия черновиков `23`)
поверх карточки. Исходная идея «edit внутри карточки внутренним состоянием» superseded.

### ADR-06.6 — Порог `low_stock` настраивается в категории — ✅ реализовано
`categories.low_stock_threshold` (`0009`); правило `lowStockThresholdFor` (категория → глобальный
`DEFAULT_LOW_STOCK_THRESHOLD = 5`); поле «Порог» есть в `EditCategorySheet`. Сток-состояния
(§3) используют его.

### ADR-06.7 — Порядок категорий — ✅ реализован (пересмотрено 2026-10-05)
Ручной порядок: `0027_category_reorder.sql`, edge `catalog-actions` (`category-reorder`),
`CategoryRepository.setCategoryOrder`, `category-slice.reorderCategory`, `ReorderCategorySheet`,
бейдж позиции на `InventoryCategoryRow`, блок «Порядок на витрине N из M» в `EditCategorySheet`.
Без drag&drop. `sortOrder` — источник истины порядка витрины.

### ADR-06.8 — Товар без purchase-варианта не публикуется — ✅ реализовано
`ProductOverview`: `canPublish = product.variants.length > 0`; `NO_ACTIVE_VARIANT` guard и в UI,
и в репозитории; кнопки «В архив» / «На витрину» с подсказкой. Дефолтный невидимый вариант не
создаётся.

### ADR-06.9 — Системная «Без категории» — ⚠️ реализовано иначе (виртуально)
«Без категории» — **виртуальная** группа: константа `UNCATEGORIZED_ID = '__uncategorized__'`
(`domain/constants/categories.ts`), правила `isSystemCategory`/`resolveProductCategoryId`
(`domain/rules/category-rules.ts`). Реальной строки `categories` и колонки `is_system` **нет**
(миграция из v0.1 §9 не применялась). Поведение сохраняется: товар без валидной категории
попадает в «Без категории», которую нельзя редактировать/удалить.

---

## 3. Доменная модель — фактический маппинг

### Category
```
id, storeId, name, normalizedName, sortOrder, status(ACTIVE|ARCHIVED),
imageStorageKey: string | null, lowStockThreshold: number | null, timestamps
```
Уникальность `(store_id, normalized_name)`. Удаление категории: товары теряют привязку
(`category_id = null`) → «Без категории», обложка удаляется из Storage. Архивация
(`status = ARCHIVED`) привязку не трогает, категория скрывается у покупателя (`02 §19`).

### Product
```
id, storeId, categoryId|null, title, description, status(ACTIVE|ARCHIVED),
sortOrder, originalAmountMinor, discountPercent, sku(null, не используется), timestamps
```
Цена — integer minor units; текущая цена считается сервером (`03 §11`).

### Variant + Inventory
```
Variant  id, productId, name, value, normalizedValue, sortOrder, status,
         priceMode(USE_PRODUCT_PRICE|CUSTOM_PRICE),
         customOriginalAmountMinor|null, customDiscountPercent|null
Inventory variantId, availableQuantity, heldQuantity
```
**Независимые оси** (ADR-06.2 «цены», `20 §3.1`, `01 D9`): каждая из осей custom-цены и
custom-скидки переопределяется отдельно (вариант из формы — `INHERITED`/`CUSTOM` на каждую ось);
в SQL — `0037`/`0043`.

### Производные величины (не хранятся)
```
productStock(product)         → { available, held, variantCount }   (только ACTIVE-варианты)
stockStateFor(available, thr) → 'in_stock' | 'low_stock' | 'out_of_stock'
```
Порог: `lowStockThresholdFor(category) = category.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD`.

---

## 4. Маршруты (фактические, `src/router.tsx`)

```
/seller/inventory                          InventoryView
/seller/inventory?mode=categories          тот же экран, секция «Категории»
/seller/inventory/category/new             CreateCategoryView
/seller/inventory/category/:categoryId     CategoryView
/seller/inventory/product/new              CreateProductView   (?categoryId=…)
/seller/inventory/product/:productId       ProductView (layout)
   ├── (index)                             ProductOverview
   ├── reviews                             ProductReviewsView
   ├── questions                           ProductQuestionsView
   └── preview                             ProductPreviewView
/seller/inventory/product/:productId/edit  EditProductView
```
`SellerNavBar.resolveActive` подсвечивает «Инвентарь» на вложенных путях (`startsWith`).

---

## 5. Компонентная карта (фактическая)

```
presentation/seller/views/
  InventoryView.tsx            секции + switcher + sheets
  CategoryView.tsx             /category/:id
  CreateCategoryView.tsx       /category/new
  ProductView.tsx              карточка-layout (шапка + табы + <Outlet/>)
  CreateProductView.tsx        /product/new  → ProductDraftEditor
  EditProductView.tsx          /product/:id/edit → ProductDraftEditor

presentation/seller/inventory/
  components/
    InventoryHeader.tsx          «назад» + центрированный заголовок
    InventoryModeSwitcher.tsx    «Товары» / «Категории» (role=tablist)
    InventorySectionHead.tsx     заголовок секции + «+»
    InventoryCategoryList.tsx / InventoryCategoryRow.tsx
    ProductPreviewRow.tsx        лента превью (стрелки ←/→), ProductThumbnail
    AddProductTile.tsx
    CategoryAddSheet.tsx         «+» в категории: Новый товар / Товар из магазина (мультивыбор)
    EditCategorySheet.tsx        название / обложка / порог / reorder / удаление
    ReorderCategorySheet.tsx     выбор позиции 1..N
    ProductMiniCard.tsx, InventorySkeleton.tsx
    products/ InventoryProductsSection.tsx | InventoryProductSearch.tsx |
              InventoryProductList.tsx | InventoryProductRow.tsx
  product/
    ProductOverview.tsx          вкладка «Карточка»
    StockControlSheet.tsx        правка «в наличии» + перенос held → available + «+ вариант»
    AddVariantSheet.tsx

presentation/seller/components/
  ProductDraftEditor.tsx         сессия независимых черновиков (create/edit/copy)
  ProductForm.tsx                форма: Основное/Продажа/Варианты (INHERITED/CUSTOM)
```

### 5.1 Размещение и слои
Направление зависимостей сохраняется: `presentation → application → domain`, инфраструктура
вызывается из `application`. Views живут в `presentation/seller/views/`, фича-компоненты — в
подпапке `inventory/`. Компоненты **не** знают про InsForge/store — только props + callbacks.

Мутации идут через `application/hooks/useInventoryActions.ts` → Zustand-слайсы (`product-slice`,
`category-slice`) → репозитории → InsForge. Признак `throw` (без `console.error`-глотания) — из
`20 INV-HARDEN-04`.

---

## 6. По-экранная спецификация (актуально)

### SCREEN 1 — Inventory Home (`/seller/inventory`)
1. `InventoryHeader` — «назад» (залипающий рейл) + центрированный «Инвентарь».
2. `InventoryModeSwitcher` — «Товары» (по умолчанию) / «Категории»; раздел в URL `?mode=` (чтобы
   «назад» из категории возвращал в «Категории»).
3. Секция:
   - **Товары** (`InventoryProductsSection`): «+» создаёт товар (`/product/new`); пустой каталог →
     empty-state с CTA; иначе инлайн-поиск (`title`) + `InventoryProductList`; «ничего не найдено».
   - **Категории**: `InventoryCategoryList` → полноширинные `InventoryCategoryRow`; «+» создаёт
     категорию (`/category/new`).
4. Sheets: `ReorderCategorySheet`, `CategoryAddSheet`.

**InventoryCategoryRow:** обложка/название (или «Без категории»), счётчик активных + «+N в
архиве», бейдж позиции (reorder), строка превью (`ProductPreviewRow` со стрелками, видимо 5),
`AddProductTile`. Клик по телу → CategoryView; по превью → ProductView; «+» → `CategoryAddSheet`.

### SCREEN 2 — CategoryView (`/seller/inventory/category/:categoryId`)
Назад, шапка (обложка, название, «N товаров»), редактирование категории (`EditCategorySheet`:
название/обложка/порог/reorder/удаление), список `ProductMiniCard`, «+ Добавить товар».
Системную «Без категории» редактировать нельзя.

### SCREEN 3 — ProductView (`/seller/inventory/product/:productId`)
Cтеклянная шапка: галерея (thumb, активное фото), цена (+скидка), статус (Активен/В архиве),
категория, описание, кнопка «предпросмотр как покупатель» (только для ACTIVE на активной
витрине). Табы с бейджами:
- **Карточка** (`ProductOverview`): статистика «в наличии/в ожидании», `StockControlSheet`,
  список вариантов (цена + остатки), атрибуты, действия: «В архив»/«На витрину» (guard ADR-06.8),
  «Редактировать» (→ `/edit`), «Удалить из архива» (только archived).
- **Отзывы** / **Вопросы**: seller-ленты с ответами/скрытием, бейджи непросмотренных.
- **Витрина** (`ProductPreviewView`): предпросмотр как покупатель / блок «Связи» (`product_links`).

### SCREEN 4 — Add
Отдельного `AddInventorySheet` нет (удалён в `19` Phase E/F). Секционные «+» ведут напрямую:
в «Товарах» → `CreateProductView`; в «Категориях» → `CreateCategoryView`; «+» в блоке категории →
`CategoryAddSheet` («Новый товар» → форма в контексте категории / «Товар из магазина» мультивыбор
+ быстрый перенос).

### SCREEN 5 — Create/Edit Category (`/category/new`, `EditCategorySheet`)
Минимум: обложка (квадрат) + название; в edit — + порог `lowStockThreshold`, reorder, удаление
(с подтверждением; товары → «Без категории»).

### SCREEN 6 — Create Product (`/product/new`)
Форма — `ProductForm` внутри `ProductDraftEditor` (сессия независимых черновиков, лимит 6, `23`).
Блоки: **Основное** (фото max 4, название, описание), **Продажа** (original-цена, скидка,
категория), **Варианты покупки** (обязателен ≥1: имя размерности + значение + остаток +
опц. price/discount с наследованием). Действия: **«В архив»** (доступно всегда) /
**«На витрину»** (только при ≥1 варианте и валидной цене). Сохранение возвращает `productId`,
после успеха открывается карточка товара.

### SCREEN 7 — Edit Product (`/product/:id/edit`)
Тот же `ProductForm` в режиме `edit` с предзаполнением; изменение остатка — через
`StockControlSheet`/`inventory`-операции, не через product-update. Доступна **«Создать копию»**
(`23`): локальное преобразование значений в независимый черновик (фото/остатки/резервы не
переносятся, связи между карточками нет).

---

## 7. Слой данных и состояния (фактически)

- **Zustand** хранит каталог Inventory: `product-slice` (products/variants/inventory/images),
  `category-slice` (categories), с ленивой догрузкой `ensureCatalog` / `ensureCategories`.
  **TanStack Query для Inventory не используется** (расхождение с исходным планом v0.1).
- Хуки: `useInventoryHome`, `useCategoryPage`, `useProductDetail` читают из стора + агрегируют
  через `domain/rules`; `useInventoryActions` — мутации (throw при ошибке).
- После мутаций слайсы обновляют локальное состояние (и инвалидируют связанные представления).
- **Backend-границы:** каталог-мутации идут через edge `catalog-actions` + атомарные RPC
  (`product_*_atomic`, `category_*_atomic`, `variant_create_atomic`) — актуализация к `03 §28`.
  В то время как v0.1 §7 предполагал прямые PostgREST-записи, теперь это серверные RPC с actor
  из сессии.

---

## 8. Агрегат остатка
Отдельная SQL-view `product_stock` **не создавалась**: агрегат считается правилом
`productStock` по уже загруженным `variants`/`inventory` (объём MVP мал). Компонент знает только
про `productStock(...)`.

---

## 9. Изменения InsForge (фактические)

| Миграция | Содержимое |
|---|---|
| `0009_inventory_columns.sql` | `categories.image_storage_key`, `categories.low_stock_threshold`, `products.sku` (idempotent) |
| `0010_product_image_thumb.sql` | `product_images.thumb_storage_key` |
| `0011_catalog_atomic.sql` | атомарные мутации каталога |
| `0027_category_reorder.sql` | ручной порядок категорий |
| `0037_variant_effective_price_independent.sql` | независимые оси custom-цены/скидки в 7 SQL-функциях |
| `0043_variant_price_axis_invariant.sql` | инвариант осей |

**Не применялось** из v0.1 §9: `categories.is_system` + `categories_store_system_key` (ADR-06.9
реализован виртуально), unique `(store_id, sku)` (ADR-06.4 не доведён).

**Storage:** публичный бакет `shoppis-media`. Товар — портрет 4:5: `full` 1000×1250 q0.75 +
`thumb` 512×640 q0.75; обложка категории — квадрат 320×320; баннер — 1100px (2.2:1). Откреплённые
файлы удаляются best-effort. Серверная валидация/derivatives — `ПЛАН` (`08 §2.4`).

---

## 10. UX-состояния (обязательны)

| Состояние | Где | Вид |
|---|---|---|
| Loading | Home / Category / Product | skeleton |
| Empty products | Home «Товары» | «Нет товаров» + «+ Добавить товар» |
| No results | Home «Товары», Category | «Ничего не найдено» + подсказка |
| Empty category row | «Категории» | «Пока нет товаров» + «+ Добавить товар» |
| Error | все | «Не удалось загрузить каталог» + «Повторить» |
| Mutation processing | create/edit/archive/stock | кнопка disabled, спиннер, защита от двойного submit |
| Status error | Product | inline + «Повторить»; `NO_ACTIVE_VARIANT` / `NOT_FOUND` / `FORBIDDEN` / `NETWORK` / `UNKNOWN` |
| Reserved hold | Product | при `INVENTORY_RESERVED_BY_ORDERS` — «резерв под активным заказом» |

Состояние остатка показывается текстом/badge: `130 шт.` / `⚠ 8 шт.` / `Нет в наличии`.

---

## 11. Дизайн-система

Референс (Inventix) задаёт UX-язык, не визуал: крупные блоки, реальные фото, rounded corners,
воздушность, светлый фон. Своя система Shoppis: shell-классы `.screen`/`.card`/`.bottom-nav`,
CSS-переменные Telegram theme, `BottomNavBar`, framer-motion. Категории не разноцветные.

---

## 12. Поиск
Инлайн-поиск в секции **«Товары»** по `title` (по уже загруженному read-model); в «Категориях»
поиска нет (категорий немного). Поиск по SKU/description и фильтры — не в MVP. Витринный поиск
(покупатель) — отдельно, server-side (`17`).

---

## 13. Связь с Dashboard
Состав блока «Инвентарь» на главной продавца определён `25` (SDB): «на витрине / в архиве» +
количество активных категорий; клик → `/seller/inventory` и `/seller/inventory?mode=categories`.
«Заканчиваются / без остатка / новые вопросы» и `?filter=low-stock` — deferred.

---

## 14. Telegram UX
Safe areas, nav, scroll, keyboard, sheets, image picker, BackButton, haptics, малые устройства.
Вложенные маршруты (`/category/:id`, `/product/:id`, `/new`, `/edit`) используют Telegram
BackButton с корректным возвратом. Статус: функционально проверено в Telegram; формальная
финальная сверка Inventory — за человеком.

---

## 15. История релизов (v0.1) и реальные пост-планы

Исходные срезы R1–R5 **выполнены** (мок → реальный backend → операции → полировка). Поверх них:
- **`19` Реконструкция Inventory** (`INV-R-01…37`): секции Товары/Категории, explicit variant
  inheritance, mutation lifecycle, чистка `ProductView`, полноширинные строки категорий,
  per-product индикаторы отзывов/вопросов. Закрыт как `LOCAL`-этап (`19` Phase G).
- **`20` Hardening Inventory** (`INV-HARDEN-01…09`): независимые оси цены/скидки (JS + 7 SQL-
  функций + checkout, `0037`), единый mutation API (`throw`), тесты категорий/responsive,
  переименование `CategoryGrid/CategoryCard` → `InventoryCategoryList/InventoryCategoryRow`,
  вынос derived data из `InventoryView`, lint-гигиена. Закрыт как `LOCAL`-этап (`20 §16`).
- **`23` Копирование карточки**: «+ Создать копию» из формы редактирования — независимые
  черновики, лимит 6.

---

## 16. Тестовые сценарии (актуальные)
- Создать категорию → видна в «Категориях»; создать товар глобально / из категории.
- Клик по товару → ProductView; смена статуса «В архив»/«На витрину» (guard без вариантов).
- Редактирование → карточка обновляется; **«Создать копию»** → независимый товар (фото/остатки 0).
- Архивация категории → товары в «Без категории»; удаление категории → привязка снята.
- Reorder категории → позиция на витрине меняется (`0027`).
- Правка «в наличии»; перенос held → available через `inventory_reconcile`; при активном заказе —
  `INVENTORY_RESERVED_BY_ORDERS` (товар «резервирован»).
- Порог low_stock категории → состояние «заканчивается».
- Двойной submit не создаёт дубль; max 4 изображения; независимые оси price/discount варианта.

---

## 17. Открытые вопросы (актуально)
1. **SKU** — колонка есть, использования нет; решить: довести (поле+поиск+unique) или удалить.
2. **«Без категории»** — оставить виртуальной (текущий вариант) или перейти к реальной записи
   `is_system` (v0.1 §9) при необходимости серверной привязки.
3. **Серверный image pipeline** (MIME-валидация, derivatives) — `08 §2.4`, вне этапа.
4. **Фильтры/сортировка Inventory** (low-stock, без остатка) — deferred вместе с `?filter=low-stock`.
5. **RLS** — гейт перед продом (`11 §S1`); критичные мутации уже серверные.
