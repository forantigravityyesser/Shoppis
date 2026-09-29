# SHOPPIS — INVENTORY UX SPEC

**Version:** 0.1
**Дата:** 2026-09-24
**Роль:** что пользователь видит и делает. Данные/БД/релизы — в `06_SHOPPIS_SELLER_INVENTORY_SPEC_v0.1.md`.
**Статус:** Inventory переведён на реальный бэкенд InsForge (PostgreSQL + PostgREST + Storage `shoppis-media`); in-memory mock удалён. Порядок и статус работ — `09 SHOPPIS_INVENTORY_IMPLEMENTATION_PLAN`, детали миграции — `inventory_real_backend_migration_plan.md`.

---

## 0. Разделение документов

- `06 … INVENTORY_SPEC` — домен, БД, маршруты, слои, миграция, релизы, тесты.
- **этот документ** — UX экранов Inventory.
- `09 … IMPLEMENTATION_PLAN` — в каком порядке кодируем и что уже сделано.

---

## 1. Назначение и главный принцип

`/seller/inventory` — рабочее пространство управления каталогом. Не таблица склада, не CRUD.

Две визуальные сущности:

- **Категория** — большой визуальный контейнер с превью товаров.
- **Товар** — миниатюра (`ProductThumbnail`) внутри категории.

Правило: **Home = визуальная навигация**, **Category = операционная навигация**, **Product = управление**.
На Home товар не превращается в полноценную карточку.

---

## 2. Структура экрана (5 зон)

```
InventoryView
├── 1. InventoryHeader      заголовок + мета + «+ Добавить» + поиск
├── 2. Category section     заголовок «Категории»
├── 3. Category grid        композиция wide / pair
└── 4. BottomNavBar         существует, вне задачи Inventory
```

Скролл — внутри `.scrollable-content` (`SellerLayout`), навбар неподвижен.

---

## 3. Header (`InventoryHeader`)

Обычный режим:

```
            Инвентарь                🔍
                          [+ Добавить]  ← строкой ниже, справа
```

- Заголовок 26px / 700, **по центру** шапки.
- `🔍` — иконка справа, **не** постоянное поле. Клик → search state.
- `+ Добавить` — на строке ниже шапки, выровнена вправо.
- Мета `N товаров · M категорий` **пока не показывается**.

Search state (тот же экран, не отдельный маршрут):

```
←  🔍 Найти товар или категорию
```

Поле раскрывается по необходимости; `←` закрывает и сбрасывает запрос.

---

## 4. Add

Строкой ниже шапки, справа — главная CTA `[+ Добавить]` (видна всегда). Клик → **bottom sheet** `AddInventorySheet`:

Клик → **bottom sheet** `AddInventorySheet`:

```
Добавить
┌────────────┐  ┌────────────┐
│    📦      │  │    ▦       │
│  Товар     │  │  Категория │
└────────────┘  └────────────┘
```

Только два действия. Товар → CreateProduct (`initialCategoryId = null`); Категория → CreateCategory.

---

## 5. Compose-грид (не равномерная сетка)

Три паттерна:

- **Pattern A — Compact Pair** — две карточки 50/50.
- **Pattern B — Wide** — карточка на всю ширину, больше превью и padding.
- **Pattern C — Featured** — крупный блок (позже, автоматически; не пользовательская настройка в v1).

Детерминированный алгоритм (спека §15), без masonry:

```
index 0 → wide
1,2     → pair
3       → wide
4,5     → pair
6       → wide …
```

Почему не masonry: непредсказуемый порядок, сложнее a11y/responsive/touch/анимации.

Layout **не хранится** в БД — считается на фронте (`inventory/layout.ts`).

---

## 6. CategoryCard — анатомия

```
CategoryCard
├── CategoryHeader (CategoryName, ProductCount, [CategoryMoreButton])
└── ProductPreviewGrid
    ├── ProductThumbnail × N
    └── AddProductTile (+)
```

- `wide`: имя крупнее, в строке превью видно 5 карточек + `+`.
- `compact`: имя меньше, в строке превью видно 3 карточки + `+`.
- `⋯` (More) — **не** открывает категорию, открывает actions sheet. Не подключён.
- Превью показывает **все** товары категории (активные первыми, затем архивные) в одну строку;
  лишние доступны **листанием стрелками** ←/→ (см. §6.1).

## 6.1 Превью: порядок, архив и прокрутка

- **Порядок:** сначала активные, затем архивные; внутри группы — по `sortOrder`, затем `createdAt`.
- **Архивные** показываются приглушённо (grayscale + opacity) — товар не пропадает из каталога.
- **Листание (mobile-first):** нативного скролла/свайпа нет — строка `ProductPreviewRow`
  сдвигается **ровно на одну карточку** по клику `→` / `←` (сдвиг трансформом). Так карточки
  не «выпадают» и поведение предсказуемо на телефоне.
- **Видимо сразу:** `wide` — 5 карточек, `compact` — 3 (стрелки в compact меньше).
- Стрелка `→` видна, пока справа есть карточки; `←` — пока есть слева. Последний элемент — `+`
  (`AddProductTile`).

---

## 7. ProductThumbnail

- Квадрат, `aspect-ratio: 1`, rounded 12px, `object-fit: cover`.
- Нет изображения → эмодзи-заглушка (`📦`).
- Архивный (скрытый) — приглушённый: `filter: grayscale(1)` + `opacity: 0.5`;
  показывается в превью после активных.
- Никаких бейджей поверх каждой миниатюры.

## 8. AddProductTile (`+`)

- Последняя ячейка превью, dashed border, акцентный `+`.
- Не декор: контекстное создание товара **в этой категории** (`initialCategoryId`).

## 9. Состояния карточки

- **0 товаров** → «Пока нет товаров» + `+ Добавить товар` (без пустой сетки).
- **1–2** → миниатюры остаются thumbnail-размера, не растягиваются.
- **много** → одна строка, всегда с `+`; при переполнении — листание стрелками ←/→ по карточке.

---

## 10. Interaction map (жёстко)

| Зона | Действие |
|---|---|
| Тело/заголовок карточки | `/seller/inventory/category/:categoryId` |
| `ProductThumbnail` | `/seller/inventory/product/:productId` |
| `+` в превью | CreateProduct(`categoryId`) |
| `⋯` | CategoryActionsSheet |
| `+ Добавить` (toolbar) | AddInventorySheet |
| `🔍` | Search state |

---

## 11. Search state

Результаты внутри Home: группы **Категории** и **Товары**.
Категория → `▦ Овощи · 24 товара`; товар → `🥕 Морковь · 130 шт.`.
Пусто → «Ничего не найдено. Попробуйте изменить запрос».

## 12. Empty / Loading / Error

- **Системная «Без категории»** (ADR-06.9) присутствует всегда, поэтому отдельного «пустого экрана»
  на Home нет: при первом входе видна карточка «Без категории» (+ её `+` для товара).
- **Loading**: skeleton повторяет композицию — 2 compact, 1 wide, 2 compact.
- **Error**: «Не удалось загрузить каталог» + «Проверьте соединение…» + `[Повторить]`.
  При ошибке пустой каталог не показываем (иначе кажется, что товары исчезли).
- **Ошибки смены статуса** (архив/витрина) — inline в карточке товара: сообщение + `[Повторить]`,
  кнопка disabled и текст «…» на время операции. Коды: `NO_ACTIVE_VARIANT` (нельзя на витрину без
  варианта покупки, ADR-06.8), `NOT_FOUND`, `FORBIDDEN`, `NETWORK`, `UNKNOWN`.

---

## 13. Responsive

- Маленький (~320–360): pair схлопывается в одну колонку.
- Обычный (~375–430): основной режим wide/pair.
- Большой/tablet: карточки не растягиваются бесконечно (`max-width` shell 480px).

## 14. Токены

Используем существующую систему (`globals.css`), не создаём новую:
`--color-accent` (бренд Shoppis), `--color-bg-card`, `--color-text-*`, `--spacing-*`,
`--radius-*`, `--shadow-card`, `--safe-bottom`. Карточки — subtle border + мягкая тень, clean/premium/soft.
Категории **не** разноцветные — цвет системный.

---

## 15. Component tree (реализовано R1)

```
InventoryView
├── InventoryHeader
│   ├── InventoryTitle (по центру)
│   └── InventorySearchButton
├── AddButton («+ Добавить», строка справа)
├── CategoryGrid
│   └── CategoryCard
│       ├── (CategoryHeader)
│       └── ProductPreviewRow
│           ├── ProductThumbnail[]
│           └── AddProductTile
├── EmptyInventoryState
├── InventorySearchState
├── InventorySkeleton
└── AddInventorySheet → BottomSheet
```

Файлы: `src/presentation/seller/inventory/` (`components/`, `layout.ts`, `inventory.css`),
данные — `useInventoryHome` (`src/application/hooks/useInventory.ts`).

## 16. Data contracts

```ts
type CategoryCardProps = {
  category: InventoryCategoryItem;
  previewProducts: InventoryProductItem[];
  variant: 'wide' | 'compact';
  onOpen(): void;
  onOpenProduct(id: string): void;
  onAddProduct(): void;
  onMore?(): void;
};

type ProductThumbnailProps = {
  product: InventoryProductItem;
  onClick(): void;
};
```

Компоненты **не** знают про InsForge/стора. Только props + callbacks.

## 17. Что НЕ делать

- таблицу товаров на Home; полноценные product cards внутри категорий;
- scroll строки превью (управление только стрелками ←/→ по одной карточке); masonry; огромные баннеры;
- 10 фильтров; сортировку; графики/аналитику;
- отдельную кнопку «Добавить товар» у каждого thumbnail; дублирование CTA;
- большие описания категорий; сложные dropdowns; лишние иконки;
- новую дизайн-систему только для Inventory.

---

## 18. Открытые вопросы

1. `CategoryMoreButton` (⋯): подключать в R2 вместе с edit (сейчас в карточке есть prop `onMore`, не задействован).
2. Действия `AddInventorySheet` и `+` в категории ведут в create-роуты (`CreateProductView` /
   `CreateCategoryView`) — реализовано; сохранение идёт в InsForge через репозитории/Zustand.
3. ~~Показывать ли «Скрытые» на Home~~ — **решено**: архивные показываются на Home приглушённо,
   после активных (и в CategoryView, и в поиске).
4. Edit-форма товара и загрузка фото — реализовано (Storage `shoppis-media`, `uploadAuto`).
