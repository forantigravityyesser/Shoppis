# SHOPPIS — SELLER INVENTORY SPEC

**Version:** 0.1 (draft for review)
**Статус:** рабочая спецификация. Заменяет/уточняет `02 §17` в части вкладки «Инвентарь».
**Дата:** 2026-09-24
**Ссылки:** `01` принципы, `02` продукт, `03` домен/БД, `04` техника, `08` расхождения.
**Бренд:** продукт и документация называются **Shoppis**. Серия документов `00–05`, `08`
переименована `VUTRINA → SHOPPIS`.

---

## 0. Назначение документа

Inventory — это **панель управления товарным каталогом продавца**, а не «список товаров».
Главный экран — визуальная карта каталога: категории → товары → карточка товара.

Остатки (`в наличии` / `в ожидании`) — часть карточки товара, а не отдельная самостоятельная сущность UI.
Inventory — рабочая зона каталога; Dashboard — центр управления (см. §13).

Документ фиксирует:
- принятые архитектурные решения (ADR) и их влияние на locked-спеку;
- итоговую доменную модель маппинга UI ↔ БД;
- маршруты, информационную архитектуру и компонентную карту;
- по-экранную спецификацию (7 экранов), данные in/out, состояния;
- необходимые изменения InsForge (миграция, storage);
- релизные срезы и тестовые сценарии.

Документ **не** описывает Dashboard, Заказы, Настройки. Отзывы/вопросы — только как read-only
показатели (код и UI отсутствуют, см. `08 §2.1`).

---

## 1. Ключевая концепция

Три уровня интерфейса:

```
Level 1  Inventory Home     /seller/inventory
   Категории + превью товаров + счётчики + поиск + добавление
                 │
Level 2  Category           /seller/inventory/category/:categoryId
   Обложка, счётчик, поиск, список ProductMiniCard
                 │
Level 3  Product            /seller/inventory/product/:productId
   Галерея, цена, остаток, атрибуты, отзывы/вопросы, редактирование

Параллельно:
+ Добавить → [ Товар | Категория ]   (bottom sheet)
+ внутри категории → создать товар сразу в этой категории
```

Товар без категории (`category_id = null`) — легальное состояние. Это ускоряет первичное
наполнение магазина. В UI такие товары показываются в виртуальной группе **«Без категории»**.

---

## 2. Locked decisions (ADR-06)

### ADR-06.1 — Вкладка Inventory = каталог + остатки внутри
- **Решение:** `/seller/inventory` становится панелью каталога (категории → товары → карточка).
  Остатки показываются внутри карточки товара. `inventory_reconcile` остаётся как есть.
- **Почему:** locked `02 §17` описывал только сток/перемещения и не давал продавцу места для
  управления каталогом. Каталог — ежедневный сценарий продавца.
- **Влияние:** обновить формулировку `02 §17` (столбец «Инвентарь»: каталог + остатки).
  `inventory_movements` / reconcile **не** меняются.

### ADR-06.2 — Остаток товара = агрегат по Variant/Inventory
- **Решение:** в UI остаток товара считается суммой по активным вариантам:
  `stock = Σ inventory.available_quantity` (+ отдельно `held = Σ inventory.held_quantity`).
- **Почему:** `03 §11` — источник истины по остатку; `01 §6` — инвентарь атомарен; два баланса
  из `02 §4`. Плоский `stockQuantity` ввёл бы второй источник истины и рассинхрон.
- **Влияние:** **не** добавляем `Product.stockQuantity` и **не** добавляем `ProductMedia`.
  Агрегация — доменное правило `domain/rules/inventory-rules.ts`, не логика компонента.

### ADR-06.3 — Обложка категории
- **Решение:** добавить nullable `categories.image_storage_key` (миграция `0009`).
- **Почему:** референс строит CategoryCard вокруг изображения; без обложки карточка теряет смысл.
- **Влияние:** `03 §4` дополнить полем `image_storage_key`. Storage bucket для обложек.

### ADR-06.4 — SKU товара
- **Решение:** добавить nullable `products.sku` + partial unique `(store_id, sku)`.
- **Почему:** поиск по `name + SKU` (`§12`), полезно продавцу.
- **Влияние:** `03 §6` дополнить `sku`; `04 §8` (Search) добавить `sku` в MVP-поиск.

### ADR-06.5 — Что НЕ добавляем в v1
- Видео в карточке (`01 §3`: video — out of scope). Только изображения, max 4 (`03 §7`).
- `ProductMedia` как отдельная таблица — используем существующий `product_images`.
- Отдельные edit-routes: карточка товара сама переходит в режим редактирования.
- Глобальный search engine: простой поиск по `title`/`sku` (и `description`), shop-scoped.

### ADR-06.6 — Порог `low_stock` настраивается в настройках категории
- **Решение:** nullable `categories.low_stock_threshold`. Если не задан — берётся глобальная
  константа `DEFAULT_LOW_STOCK_THRESHOLD` (`domain/constants/limits.ts`).
- **Почему:** продавцу нужен разный порог для разных категорий (скоропорт/напитки vs косметика).
- **Влияние:** `03 §4` дополнить `low_stock_threshold`; UI «Настройки категории» получает поле
  (необязательное). Товары «Без категории» используют глобальный дефолт.

### ADR-06.7 — Никакого ручного изменения порядка категорий в v1
- **Решение:** убираем drag&drop, reorder и действие «Изменить порядок». Категории сортируются
  существующим `sort_order` (порядок создания). Order-механики — только после доказанной нужды.
- **Почему:** `01 §17` — не добавлять фичи «на будущее»; порядок не влияет на рабочий сценарий.
- **Влияние:** `CategoriesActionsSheet` = только «Редактировать» + «Архивировать».
  Домен/БД не меняются (`sort_order` остаётся для детерминированной сортировки).

### ADR-06.8 — Товар без purchase-варианта не публикуется
- **Решение:** товар нельзя выставить «На витрину» без хотя бы одного активного `Variant`
  (варианта выбора при заказе). Такой товар можно только сохранить `В архив`.
- **Почему:** без варианта покупатель не может оформить заказ; `01 §13` — Variant — покупаемая
  опция. Публикация неполного товара создала бы нерабочую витрину.
- **Влияние:** `CreateProduct` / `EditProduct` требуют ≥1 варианта. Два действия вместо одного:
  **«В архив»** и **«На витрину»** (с подсказками, почему кнопка недоступна). Дефолтный «невидимый»
  вариант не создаётся — вариант задаёт продавец явно. Публикация «На витрину» (`status = ACTIVE`)
  разрешена только при ≥1 активном варианте.

### ADR-06.9 — Системная «Без категории»
- **Решение:** у каждого магазина есть системная категория **«Без категории»** (`is_system = true`).
  Создаётся автоматически при создании магазина и присутствует сразу при первом входе;
  её нельзя редактировать и удалять. Товар без валидной категории автоматически попадает в неё.
- **Хранение:** **реальная запись** `categories` для каждого магазина (не виртуальная сборка UI).
  Инвариант — один `is_system = true` на магазин. В mock — `SYSTEM_CATEGORY` в seed магазина.
- **Кнопка Add:** `+ Добавить` показывается всегда.
- **Слой (не во фронте):** `domain/rules/category-rules.ts` (`isSystemCategory`,
  `resolveProductCategoryId`); `application/hooks/useInventory.ts` только читает; компоненты рисуют.
- **Идентификаторы:** `UNCATEGORIZED_ID`/`UNCATEGORIZED_NAME` — `domain/constants/categories.ts`.
- **Backend:** создание системной категории — провижининг магазина / DB-триггер (Phase 7).

---

## 3. Доменная модель — итоговый маппинг

Модели уже существуют (`src/domain/models/`). Изменения — только `§9` (миграция).

### Category (`domain/models/category.ts` + ADR-06.3, ADR-06.6)
```
id, storeId, name, sortOrder, status(ACTIVE|ARCHIVED), createdAt
+ imageStorageKey: string | null     // новое, ADR-06.3
+ lowStockThreshold: number | null   // новое, ADR-06.6
```
- Уникальность `(store_id, normalized_name)` уже есть.
- Удаление категории: товары не удаляются, теряют привязку (`category_id = null`) и попадают
  в «Без категории» (`02 §`); обложка удаляется из Storage (`removeFileByUrl`). Системную
  «Без категории» удалить нельзя.
- Архив категории (`setCategoryStatus(ARCHIVED)`) — отдельное действие: товары сохраняют
  привязку, категория скрывается (`02 §13`).
- `lowStockThreshold = null` → глобальный дефолт `DEFAULT_LOW_STOCK_THRESHOLD`.

### Product (`domain/models/product.ts` + ADR-06.4)
```
id, storeId, productGroupId|null, categoryId|null,
title, description, status(ACTIVE|ARCHIVED), sortOrder,
originalAmountMinor, discountPercent, createdAt, updatedAt
+ sku: string | null                 // колонка в БД (ADR-06.4); в приложении не используется
```
Цена — integer minor units, текущая цена считается сервером (`03 §10`, `01 §5`).

### ProductImage (уже есть)
`id, productId, storageKey, sortOrder`. Max 4 активных (`03 §7`). Видео нет.

### Attributes (уже есть)
`ProductAttribute` (информационные) и `ProductLinkAttribute` (дифференцирующие) — отдельные
семантики (`03 §8`). Используются как характеристики в ProductView.

### Variant + Inventory (уже есть)
```
Variant  id, productId, name, value, sortOrder, status, priceMode,
         customOriginalAmountMinor|null, customDiscountPercent|null
Inventory variantId, availableQuantity, heldQuantity
```

### Производные величины (не хранятся)
```
productAvailable(product) = Σ availableQuantity по ACTIVE-вариантам товара
productHeld(product)      = Σ heldQuantity по ACTIVE-вариантам товара
productVariantCount(product) = число ACTIVE-вариантов (ADR-06.8: 0 → нельзя на витрину)
productStockState(product, category) → 'in_stock' | 'low_stock' | 'out_of_stock' | 'hidden'
```
Порог `low_stock`: `category.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD`
(`domain/constants/limits.ts`), не хардкод в UI. Для «Без категории» — глобальный дефолт.

---

## 4. Маршруты

Существующие (не ломаем):
```
/seller/inventory                       InventoryView (сейчас заглушка)
```
Добавляем (внутри `<SellerLayout />`, под guard `storeId`):
```
/seller/inventory/category/:categoryId  CategoryView
/seller/inventory/product/:productId    ProductView
```
Не создаём `/edit`-маршруты: ProductView переключается в edit mode внутренним состоянием.
`SellerNavBar.resolveActive` уже подсвечивает «Инвентарь» для вложенных путей (`startsWith`) —
менять не нужно.

---

## 5. Компонентная карта

Статус: `[new]` создать · `[stub]` файл есть, пуст · `[reuse]` использовать существующий.

```
InventoryView                         [rewrite]  presentation/seller/views/InventoryView.tsx
├── InventoryHeader                   [new]
├── InventoryToolbar                  [new]
│   ├── SearchButton                  [new]
│   └── AddButton                     [new]
├── CategorySection                   [new]
│   └── CategoryCard                  [new]      compact | wide (responsive)
│       ├── CategoryHeader            [new]
│       ├── ProductThumbnailGrid      [new]
│       │   └── ProductThumbnail      [new]
│       └── AddProductButton          [new]
├── UncategorizedSection              [new]      «Без категории»
└── EmptyInventoryState               [new]

CategoryView                          [new]
├── CategoryHeader (обложка+счётчик)  [new]
├── SearchField                       [new]
├── ProductMiniCard (list)            [new]
└── CategoryActionsSheet              [new]      редактировать / архивировать (без порядка)

ProductView                           [new]
├── ProductGallery                    [reuse]    ProductImageCarousel.tsx [stub]
├── ProductInfo (название, цена)      [new]
├── StockPanel (наличие/в ожидании)   [new]
├── ProductMeta (SKU, категория)      [new]
├── ReviewsSummary / QuestionsSummary [new]      read-only
└── ProductActions (на витрину / в архив) [new]  + подсказки при недоступности

AddBottomSheet                        [new]      bottom sheet: Товар | Категория
CreateCategorySheet                   [new]      фото + название
CreateProductForm                     [new]      блоки: Основное / Продажа / Остаток
EditProductForm                       [new]      тот же form в edit mode

Переиспользуемые примитивы:
  BottomSheet.tsx        [stub → reuse]
  EmptyState.tsx         [stub → reuse]
  LoadingSpinner.tsx     [reuse]
  ProductCard.tsx        [stub]   // витрина покупателя, не использовать в seller
  styles/seller.css      [reuse]  // .screen, .card и т.п.
```

### 5.1 Размещение файлов (Фаза 0)

Направление зависимостей сохраняется: `presentation → application → domain`, инфраструктура
вызывается из `application` (`04 §9`). Views остаются в `presentation/seller/views/` (router
лениво импортирует именно их); фича-компоненты Inventory группируются в подпапке `inventory/`.

```
src/domain/
  models/product.ts                     расширить: sku
  models/category.ts                    расширить: imageStorageKey, lowStockThreshold
  rules/inventory-rules.ts              [new] агрегаты и productStockState
  constants/limits.ts                   + DEFAULT_LOW_STOCK_THRESHOLD

src/mock/inventory/                     [new] временные данные (R1–R2), зеркалят domain
  categories.ts                         MOCK_CATEGORIES (Category[])
  products.ts                           MOCK_PRODUCT_RECORDS (Product/Variant/Inventory/…)
  types.ts                              MockProductRecord, InventoryProductItem, …
  index.ts                              MOCK_CATALOG + селекторы mockCategoryItems/mockProductItems

src/application/
  hooks/useInventory.ts                 [new] Query: categories + catalog
  hooks/useCategory.ts                  [new]
  hooks/useProduct.ts                   [new]
  services/inventory-service.ts         [new] мутации + инвалидация ключей
  services/inventory-keys.ts            [new] query keys

src/infrastructure/
  repositories/category-repository.ts   расширить: image, low_stock_threshold
  repositories/product-repository.ts    расширить: sku, status, варианты
  storage/file-storage.ts               обложки категорий

src/presentation/seller/
  views/InventoryView.tsx               [rewrite]  /seller/inventory
  views/CategoryView.tsx                [new]      /seller/inventory/category/:categoryId
  views/ProductView.tsx                 [new]      /seller/inventory/product/:productId
  inventory/components/*                [new] CategoryCard, ProductThumbnail, ProductMiniCard, StockBadge…
  inventory/forms/*                     [new] CreateCategorySheet, CreateProductForm, VariantEditor
  inventory/sheets/*                    [new] AddBottomSheet, CategoryActionsSheet
```

**Фаза 0 (готовность, без изменений shell):**
- `SellerLayout`, `SellerNavBar`, `BottomNavBar` — **не трогаем**; `resolveActive` уже подсвечивает
  «Инвентарь» на вложенных путях (`startsWith`).
- `/seller/inventory` остаётся точкой входа; `category/:id`, `product/:id` — добавляются в router.
- `npm run build` (`tsc --noEmit && vite build`) проходит; shell-структура и слои на месте.
- Данные Inventory будут читаться через TanStack Query (`application/queryClient.ts` уже настроен),
  Zustand остаётся для `auth`/`context`/`storeId`/`currentStore`.

---

## 6. По-экранная спецификация

### SCREEN 1 — Inventory Home (`/seller/inventory`)

**Назначение:** визуальная карта каталога.

**Раскладка (сверху вниз):**
1. `InventoryHeader` — заголовок «Инвентарь»; справа иконки поиска и Add.
2. `InventoryToolbar` — при активном поиске: строка ввода «Найти товар или категорию».
3. `CategorySection` — сетка `CategoryCard`:
   - 1 категория → `wide`;
   - 2 категории → две `compact`;
   - 3+ → adaptive grid (masonry по высоте).
4. `UncategorizedSection` — виртуальная карточка «Без категории» (товары с `categoryId = null`
   или архивной категорией), если такие есть.
5. `AddButton` — «+ Добавить».

**CategoryCard — ключевой компонент.**
```
compact                          wide
┌──────────────┐                ┌──────────────────────────────┐
│ Овощи     24 │                │ Косметика               42  │
│              │                │                              │
│ 🥕 🥦 🍅 🫑  │                │ 🧴 🧼 💄 🧴 🧽 🧴 🧴   +    │
│ 🍆 🧅    +   │                └──────────────────────────────┘
└──────────────┘
```
- Состав: обложка/название; счётчик; строка превью `ProductPreviewRow` + `+`.
- Превью — **все** товары категории в одну строку, листание стрелками `←/→` ровно на одну
  карточку (без скролла/свайпа): сначала активные, затем архивные (приглушённые, `grayscale` +
  `opacity`). Видимо сразу: `wide` — 5, `compact` — 3. Детали — `07 §6.1`.
- Счётчик — число активных товаров; рядом мелко «+N в архиве», если архивные есть.
- Layout задаётся адаптивной сеткой, **не** ручным выбором пользователя в v1.

**Правила кликов (жёстко):**
| Зона | Действие |
|---|---|
| Заголовок / фон карточки | открыть CategoryView |
| Превью товара | открыть ProductView |
| `+` в карточке | CreateProduct с `initialCategoryId` |
| `⋯` (если есть) | CategoryActionsSheet |

**Данные in:** `Category[]`, `Product[]` + агрегаты остатка, первые фото на категорию.
**Данные out:** нет (навигация) либо переход в Create.
**Запрос:** `['seller','catalog', storeId]` (один запрос, см. §7).
**Состояния:** loading (skeleton-карточки), empty (EmptyInventoryState), error (retry), search-empty.

---

### SCREEN 2 — CategoryView (`/seller/inventory/category/:categoryId`)

**Назначение:** список товаров категории + управление.

**Раскладка:**
1. Строка назад «← Инвентарь».
2. Header: обложка (если есть), название, «N товаров», `⋯` (CategoryActionsSheet).
3. `SearchField` — «Найти товар».
4. Список `ProductMiniCard`.
5. Sticky кнопка «+ Добавить товар» внизу.

**ProductMiniCard (вторая ключевая карточка):**
```
┌─────────────────────────────────────────────┐
│ 🥕  Морковь                                 │
│     130 шт.                                 │
│     €2.49        ★ 4.8   💬 12              │
│     В наличии                              › │
└─────────────────────────────────────────────┘
```
- Содержимое ограничено: фото, название, остаток, цена, 1–2 сигнала (отзывы/вопросы).
- Не перегружать: никаких описаний/атрибутов в мини-карточке.

**EditCategorySheet:** Редактировать категорию · Удалить. (Без «Изменить порядок» — ADR-06.7.)
В «Редактировать»: название, обложка и `lowStockThreshold` (ADR-06.6).
Удаление → подтверждение → товары переходят в «Без категории» (`category_id = null`),
обложка удаляется из Storage; система «Без категории» не удаляется.
Архивация (`setCategoryStatus(ARCHIVED)`) — отдельное действие: товары сохраняют привязку,
категория скрывается.

**Данные in:** `Category` + `Product[]` категории + агрегаты остатка.
**Данные out:** редактирование (rename/обложка/порог) и удаление категории.
**Состояния:** loading, empty category («В категории пока нет товаров» + `+`), search-empty, error.

---

### SCREEN 3 — ProductView (`/seller/inventory/product/:productId`)

**Назначение:** просмотр/управление товаром, вход в редактирование.

**Раскладка:**
1. «← <Категория>» (или «← Инвентарь»).
2. `ProductGallery` — изображения (max 4), свайп.
3. Название, текущая цена (и original/discount, если есть скидка).
4. `StockPanel`: «В наличии — N шт.», «В ожидании — M шт.»; действие
   «Переместить в наличии» при `held > 0` → `inventory_reconcile` (позже, Release 4).
5. `ProductMeta`: категория, атрибуты (informational + linking).
6. `VariantSection`: список вариантов покупки (имя размерности, значение, остаток).
7. `ReviewsSummary` (`★ 4.8`, «12 отзывов»), `QuestionsSummary` («3»).
8. `ProductActions`: **[На витрину] · [В архив] · [Редактировать]** (ADR-06.8).
   - «На витрину» (`status = ACTIVE`) disabled, если нет ни одного активного `Variant`;
     подсказка: «Добавьте хотя бы один вариант выбора при заказе (размер/объём), чтобы выставить
     товар на витрину».
   - «В архив» (`status = ARCHIVED`) доступно всегда (даже без вариантов).
   - Архивный товар: вместо «На витрину» — «Вернуть на витрину» (та же проверка вариантов) и
     «Удалить из архива».
   - Ошибки смены статуса типизированы (`ProductStatusResult`/`ProductStatusErrorCode`):
     `NO_ACTIVE_VARIANT` (guard и на клиенте, и в репозитории), `NOT_FOUND`, `FORBIDDEN`,
     `NETWORK`, `UNKNOWN`. UI: inline-сообщение + `[Повторить]`, кнопка disabled при `pending`.

**Режим редактирования:** тот же экран, внутренний toggle `isEditing` → `EditProductForm`.
Никаких отдельных `/edit`-маршрутов (ADR-06.5).

**Данные in:** `Product`, `Variant[]`, `Inventory[]`, `ProductImage[]`, attributes; агрегаты.
**Данные out:** `updateProduct` (patch), `setProductStatus` (ACTIVE/ARCHIVED), `deleteProduct`
(только из архива).
**Состояния:** loading, not found, error, mutation-processing (кнопка disabled).

---

### SCREEN 4 — Add (`+ Добавить`, bottom sheet)

Не отдельная страница. `AddBottomSheet`:
```
Добавить
  📦  Товар        → CreateProduct (initialCategoryId = null)
  ▦   Категорию    → CreateCategorySheet
```
**Данные in:** опционально `initialCategoryId`.
**Состояния:** открыт/закрыт, анимация translateY + opacity (framer-motion).

---

### SCREEN 5 — Create Category

MVP-минимум (не перегружать): **Фото + Название**.
```
← Назад
Новая категория
[      Фото       ]  → image picker → upload → storageKey
[  Добавить фото  ]
Название  [ Овощи__________ ]
[ Создать категорию ]
```
**Данные out:** `imageStorageKey`, `name` → `addCategory` (расширить: имя + ключ).
**После:** категория появляется на Inventory Home с empty-состоянием «Пока нет товаров — + Товар».
**Состояния:** upload (loading/error/retry), validation (непустое имя), submit-lock.

---

### SCREEN 6 — Create Product

Единый flow для глобального `+` и `+` из категории. Разница — `initialCategoryId`.

Визуальные блоки (не одна длинная форма):
```
Новый товар
── Основное ──
  Фото        [ + ] (max 4)
  Название    [____________]
  Описание    [ необязательно ]
── Продажа ──
  Цена        [ € 0.00 ]  (original), Скидка [ 0 % ]
  Категория   [ Овощи ▼ ]  (или «Без категории»)
── Варианты покупки ──   (ADR-06.8: обязательно ≥1)
  Размерность [ Объём ▼ ]  (имя: Размер/Объём/…)
  Вариант     [ 0.5 л ]  остаток [ 20 ]   [ + добавить вариант ]
  + подсказка: «Без варианта выбора товар нельзя
    выставить на витрину — только сохранить в архив»
── Остаток/прочее ──

[ В архив ]        [ На витрину ]
```
- Каждый `Variant` + строка `inventory` (`available_quantity` = остаток варианта).
- «На витрину»: создаёт `Product(status = ACTIVE)`; доступна только при ≥1 варианте и валидной цене.
- «В архив»: создаёт `Product(status = ARCHIVED)`; доступна всегда (даже без вариантов).
- Неявный/дефолтный вариант **не** создаётся: продавец задаёт вариант явно.
**Данные out:** `addProduct` (расширить `NewProductInput`: категория nullable, `variants[]`
с остатками, `status`; SKU в UI не используется).
**Состояния:** validation (`validateProduct`), image upload, submit-lock, error, disabled-actions
с подсказками.

---

### SCREEN 7 — Edit Product

Тот же `EditProductForm`, что `SCREEN 6`, с предзаполнением. Сохраняет через `updateProduct`.
Особые поля: изменение остатка — через inventory/reconcile (не через `product` update).
Правило ADR-06.8 действует и здесь: удалить все варианты можно, но тогда товар принудительно
уходит `В архив` (с подсказкой), а кнопка «На витрину» становится недоступной.
**Действия:** [В архив] / [На витрину] / [Сохранить] — с теми же проверками, что в SCREEN 6.
**Состояния:** dirty-tracking, confirm при уходе, submit-lock, error.

---

## 7. Слой данных и состояния

### Разделение (по плану §24–25)
- **TanStack Query** — данные Inventory (`categories`, `catalog`, `category`, `product`).
- **Zustand** — только `auth`, `context`, `storeId`, `currentStore`, app state. **Не** хранить данные
  Inventory в Zustand.

### Запросы
Один каталожный запрос без N+1 (`04 §17`), уже реализован: `fetchCatalog(storeId)`
(`infrastructure/repositories/product-repository.ts:159`).
```
['seller','categories', storeId]   → fetchCategories(storeId)
['seller','catalog',    storeId]   → fetchCatalog(storeId)   // products+variants+inventory+images
['seller','product',    productId] → select из catalog (или отдельный fetch)
```
Деривация (группировка по категориям, превью, агрегаты остатка) — в `application` /
`domain/rules`, не в компонентах.

### Application слой
```
presentation (InventoryView/CategoryView/ProductView)
   → application/hooks/useInventory.ts / useCategory.ts / useProduct.ts  (TanStack Query)
       → application/services/inventory-service.ts
           → infrastructure/repositories/{category,product}-repository.ts
               → insforge
```
Инвалидация после мутаций:
```
createCategory/updateCategory  → invalidate categories, catalog
createProduct/updateProduct    → invalidate catalog, ['seller','product',id], categories (счётчики)
archiveCategory                → invalidate categories, catalog
deleteCategory                 → invalidate categories, catalog (товары → «Без категории»)
setProductStatus/deleteProduct → invalidate catalog, product, categories
```

### Переходное состояние
Сейчас каталог живёт в `product-slice` (`src/application/store/slices/product-slice.ts`).
Новые хуки Inventory **читают через Query**; `product-slice` остаётся для витрины покупателя до
отдельного этапа. Дублирования записи не допускаем: источник на экране Inventory — только Query.

### Backend-границы
Каталог-мутации продавца пока идут через репозитории напрямую (PostgREST). RLS выключен
(`08 §1.9`). До включения RLS — это осознанный временный компромисс; после — критичные мутации
вывести в edge-функции (`04 §3`). Здесь Inventory **не** принимает решение о стоке — сток
изменяется только атомарными RPC (`0007_inventory_lifecycle.sql`).

---

## 8. Aggregate-запрос остатка

Чтобы не тянуть сумму в JS по сотням строк, допустимо получить агрегат одним запросом:
```sql
-- необязательная derived view (Release 3+)
create or replace view public.product_stock as
select p.id as product_id,
       coalesce(sum(i.available_quantity) filter (where v.status = 'ACTIVE'), 0) as available,
       coalesce(sum(i.held_quantity)      filter (where v.status = 'ACTIVE'), 0) as held
from public.products p
left join public.variants v on v.product_id = p.id
left join public.inventory i on i.variant_id = v.id
group by p.id;
```
В v1 допустимо агрегировать в приложении из уже загруженного `fetchCatalog`, т.к. объём MVP мал.
Компонент не должен знать про `variants`/`inventory` — только про `productAvailable(product)`.

---

## 9. Изменения InsForge

### Миграция `0009_inventory_ui.sql`
```sql
-- ADR-06.3 обложка категории
alter table public.categories
  add column if not exists image_storage_key text;

-- ADR-06.6 настраиваемый порог low_stock
alter table public.categories
  add column if not exists low_stock_threshold integer;
alter table public.categories
  add constraint categories_low_stock_threshold_check
  check (low_stock_threshold is null or low_stock_threshold >= 0);

-- ADR-06.4 SKU товара
alter table public.products
  add column if not exists sku text;

create unique index if not exists products_store_sku_key
  on public.products (store_id, sku)
  where sku is not null;

-- ADR-06.9 системная «Без категории»: одна на магазин
alter table public.categories
  add column if not exists is_system boolean not null default false;
create unique index if not exists categories_store_system_key
  on public.categories (store_id) where is_system;
```

### Storage
- Единый публичный bucket `shoppis-media` (товары, обложки категорий, баннеры).
- Обработка на клиенте (без ручного редактора): центрированный квадратный crop → WebP
  (`createImageBitmap` + canvas, fallback JPEG) в `utils/image.ts`:
  - товар: `full` 1000px q0.75 + `thumb` 320px q0.75 (`uploadCatalogImage`);
  - обложка категории: только `thumb` 320px (`uploadCategoryCover`) — она везде мелкая;
  - баннер магазина: 1024px q0.78 (`compressImage`).
- Списки/мини-карточки/обложки грузят `thumb`; hero/галерея — `full`. У загруженных ранее фото
  `thumb_storage_key = null` → UI падает на `storage_key` (совместимо).
- `product_images.thumb_storage_key` — миграция `0010`.
- Чистка Storage: при правке/удалении товара и замене/снятии обложки откреплённые файлы удаляются
  (best-effort, `removeFilesByUrl`) — бакет не растёт «сиротами».
- Полный серверный image pipeline (MIME-валидация, strip metadata, серверные derivatives) — `08 §2.4`,
  вне v1.

### Документы к обновлению
- `02 §17` — Inventory = каталог + остатки (ADR-06.1).
- `03 §4` + `image_storage_key` и `low_stock_threshold`; `03 §6` + `sku` (ADR-06.3/06.4/06.6).
- `04 §8` — поиск по `title`/`sku` (+ `description`).
- `README` locked decisions — SKU, обложки, порог low_stock, бренд Shoppis.

---

## 10. UX-состояния (обязательны все)

| Состояние | Где | Вид |
|---|---|---|
| Loading | Home / Category / Product | skeleton-карточки/строки |
| Empty inventory | Home | «Ваш каталог пока пуст» + «Создайте первую категорию или добавьте товар» + [+ Добавить] |
| Empty category | Category | «В категории пока нет товаров» + [+ Добавить товар] |
| Search empty | Home / Category | «Ничего не найдено. Попробуйте изменить запрос» |
| Error | все | «Не удалось загрузить каталог» + [Повторить] |
| Offline / network | все | аккуратное сообщение, интерфейс не разрушается |
| Mutation processing | create/edit/archive | кнопка disabled, спиннер, защита от двойного submit (`04 §10`) |
| Status mutation error | Product | inline: сообщение + `[Повторить]`; коды `NO_ACTIVE_VARIANT` / `NOT_FOUND` / `NETWORK` / `UNKNOWN` |

Состояние остатка (`§3`) отображается **badge/текстом**, не заливкой всего интерфейса:
`130 шт.` / `⚠ 8 шт.` / `Нет в наличии` / `Скрыт`.

---

## 11. Дизайн-система (референс → Shoppis)

Референс (Inventix: складские слоты A1–A9, синий акцент) задаёт **UX-язык**, не визуал.
Берём: крупные блоки, карточки категорий, реальные фото, rounded corners, лёгкие тени, воздушность,
светлый фон, мелкие превью, компактную навигацию, понятную иерархию.
Не берём: чужую типографику, логотип, названия, цвета, иконки, композицию один-в-один.

Собственная система Shoppis: существующие shell-классы `.screen` / `.card` / `.bottom-nav`,
CSS-переменные Telegram theme, `BottomNavBar`, framer-motion для переходов.
Акцент/палитра — из текущей темы Shoppis, не синий Inventix.

---

## 12. Поиск

- Поиск контекстный: Home → «товар или категория»; Category → «товар».
- MVP: `title`, `sku` (+ `description`), `ilike`, shop-scoped, только `ACTIVE` (`04 §8`).
- Фильтры в CategoryView **не входят в MVP** (снято для простоты). Состояние остатка
  показывается текстом в `ProductMiniCard`: `130 шт.` / `⚠ 8 шт.` / `Нет в наличии`.
  Порог `low_stock` — `category.lowStockThreshold ?? default` (ADR-06.6). Фильтры — потенциально R4.
- `?filter=low-stock` из Dashboard — отложено вместе с фильтрами (`§13`).

---

## 13. Связь с Dashboard (после Inventory)

Dashboard читает реальные данные и показывает: товаров всего / заканчиваются / без остатка /
новых вопросов. Клик по «заканчиваются» → `/seller/inventory?filter=low-stock`.
Inventory — рабочая зона, Dashboard — центр управления.

---

## 14. Telegram UX (после браузера)

Проверяем после `LOCAL VERIFIED` (принцип двух сред, `README`):
safe areas, bottom nav, scroll, keyboard, bottom sheets, image picker, Telegram BackButton,
haptic, переходы, высота экрана, малые устройства.
Особое внимание: CategoryView / ProductView / Create* не конфликтуют с BackButton
(вложенные маршруты → BackButton ведёт на предыдущий уровень Inventory).

---

## 15. Релизные срезы

| Release | Состав | Данные |
|---|---|---|
| **R1 Visual Inventory** | InventoryView, CategoryCard, ProductThumbnail, CategoryView, ProductMiniCard, ProductView, навигация | mock |
| **R2 Creation** | AddBottomSheet, CreateCategory, CreateProduct, Create из категории | mock/частично |
| **R3 Real backend** | миграция 0009, CRUD через Query, storage | InsForge |
| **R4 Operations** | поиск, фильтры, сток, low/out-of-stock, «Переместить в наличии», отзывы/вопросы (read-only) | InsForge |
| **R5 Telegram polish** | haptics, BackButton, safe area, sheets, анимации, image picker | Telegram |

Каждый релиз заканчивается `LOCAL VERIFIED` и `TELEGRAM VERIFIED`.

---

## 16. Тестовые сценарии

- **A** Создать категорию → видна на Home.
- **B** Создать товар глобально → категория «Без категории».
- **C** CategoryView → `+` → товар появляется в категории (`initialCategoryId`).
- **D** Клик по товару → ProductView.
- **E** Изменить товар → вернуться → изменения отображаются (invalidate работает).
- **F** Архивировать категорию → товары не удаляются → видны в «Без категории».
- **G** Изменить категорию (имя/фото) → обновилось.
- **H** Изменить остаток → Dashboard получает новое состояние.
- **I** Товар без вариантов: «На витрину» недоступна + подсказка; сохранение возможно только «В архив».
- **J** Товар в архиве без вариантов → добавить вариант → «Вернуть на витрину» становится доступной.
- **K** Порог `low_stock` категории = 20 → товар на 15 шт. показывается как «заканчивается».
- Плюс: empty/loading/error/search-empty; защита от двойного submit; max 4 изображения.

---

## 17. Решения по открытым вопросам (v0.1)

| # | Вопрос | Решение |
|---|---|---|
| 1 | Бренд в docs | **Shoppis** во всей документации и новом коде. Серия `00–05`, `08` переименована `VUTRINA → SHOPPIS`. Возможен ребрендинг позже. |
| 2 | Порог `low_stock` | **Настраиваемый в настройках категории** (`low_stock_threshold`), с глобальным дефолтом. ADR-06.6. |
| 3 | Порядок категорий | **Не меняем вручную в v1.** Без drag&drop и reorder-действий. ADR-06.7. |
| 4 | Товар без вариантов | **Нельзя «На витрину», только «В архив»**; в форме — подсказки и две кнопки. ADR-06.8. |
| 5 | UI `inventory_reconcile` (held → available) | На усмотрение: в R1–R3 сток **read-only** («В ожидании — M шт.»). Действие «Переместить в наличии» — минимальное, в **R4**, т.к. уже описано в `02 §4`. |

Остаётся открытым к реализации R3: точная форма `NewProductInput` (варианты + `status`) и
необходимость отдельной edge-функции для каталог-мутаций после включения RLS (`08 §1.9`).
