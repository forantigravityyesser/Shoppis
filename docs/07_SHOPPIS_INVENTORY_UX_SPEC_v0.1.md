# SHOPPIS — INVENTORY UX SPEC

**Version:** 0.1  
**Актуализировано:** 2026-10-14 (ревизия документации, партия 4: `06`, `07`, `09`).  
**Роль:** что пользователь видит и делает. Данные/БД/маршруты/статусы — `06`; реконструкция —
`19`; hardening — `20`; план/история этапов — `09`.  
**Статус:** Inventory работает на реальном backend (InsForge PostgreSQL + PostgREST + Storage
`shoppis-media`), mock-слой удалён. Разделы ниже соответствуют текущему экрану (секции
«Товары»/«Категории», `19`).

---

## 0. Разделение документов

- `06 … INVENTORY_SPEC` — домен, БД, маршруты, слои, миграции, тесты.
- **этот документ** — UX экранов Inventory.
- `09 … IMPLEMENTATION_PLAN` — порядок этапов и их статус (историко-статусный).

---

## 1. Назначение и главный принцип

`/seller/inventory` — рабочее пространство управления каталогом. Не таблица склада, не CRUD.

Две единицы:

- **Категория** — контейнер с превью товаров (полноширинная строка).
- **Товар** — строка списка (секция «Товары») или миниатюра-превью внутри категории.

Правило: **Home = навигация по каталогу**, **Category = список товаров категории**,
**Product = управление товаром**. На Home товар не превращается в полноценную карточку.

---

## 2. Структура экрана (актуально)

```
InventoryView
├── InventoryHeader         «назад» (залипающий рейл) + центрированный заголовок
├── InventoryModeSwitcher   «Товары» (по умолчанию) / «Категории»
├── секция по режиму:
│   ├── InventoryProductsSection        (mode=products)
│   │     ├── InventorySectionHead («Товары» + «+»)
│   │     ├── InventoryProductSearch
│   │     └── InventoryProductList → InventoryProductRow
│   └── InventoryCategoryList           (mode=categories)
│         └── InventoryCategoryRow → ProductPreviewRow → ProductThumbnail[] + AddProductTile
└── BottomNavBar (существует вне задачи Inventory)
```

Скролл — внутри `.scrollable-content` (`SellerLayout`), навбар неподвижен.

---

## 3. Header (`InventoryHeader`)

```
←            Инвентарь
```

- Кнопка «назад» в залипающем рейле: пока шапка видна — в шапке, при скролле залипает слева
  вверху и бледнеет (`useStuck`).
- Заголовок «Инвентарь» — по центру.
- **Поиска в шапке нет:** он разнесён по секциям — в «Товарах» инлайн-поиск, в «Категориях»
  поиска нет. Глобальный `InventorySearchState` удалён (`19` Phase D/F).

---

## 4. Переключатель секций (`InventoryModeSwitcher`)

Компактный `role="tablist"` из двух вкладок: **«Товары»** (по умолчанию) и **«Категории»**.
Активный раздел хранится в URL: `?mode=categories` (чтобы «назад» из карточки категории
возвращал в «Категории», а не в «Товары»). Переключение не сбрасывает состояние других секций.

---

## 5. Секция «Товары» (`InventoryProductsSection`)

- `InventorySectionHead` — заголовок «Товары» + «+» (создать товар, `/seller/inventory/product/new`).
- Пустой каталог → empty-state: иконка, «Нет товаров» + `+ Добавить товар` (без поиска).
- Иначе — `InventoryProductSearch` (инлайн-поле, фильтр по `title` по уже загруженному read-model)
  и `InventoryProductList` (`InventoryProductRow` на товар).
- «Ничего не найдено» — при непустом запросе без совпадений.

`InventoryProductRow`: миниатюра/эмодзи, название, цена, статус/остаток, переход в карточку.

---

## 6. Секция «Категории» — `InventoryCategoryList` / `InventoryCategoryRow`

> **Актуализация (2026-10-05, `19` Phase E):** compose-грид (wide/pair, 50/50) **удалён**.
> Категории — **полноширинные строки**, по одной на строку; визуал карточки сохранён.
> `buildCategoryRows`/`PREVIEW_VISIBLE.compact` удалены, превью — единый `PREVIEW_VISIBLE = 5`.

`InventoryCategoryRow` (анатомия):

```
InventoryCategoryRow
├── Head: Avatar (обложка/иконка) + Name (или «Без категории») + Rank-бейдж + Count (+N в архиве)
└── ProductPreviewRow (5 видимых + AddProductTile + стрелки ←/→)
```

- **Avatar** — `category.imageUrl` (thumb); если нет — иконка `Shapes`.
- **Name** — название; для `UNCATEGORIZED_ID` — «Без категории».
- **Rank** — 1-based позиция категории на витрине; клик открывает `ReorderCategorySheet`
  (порядок — `0027`). Показывается только для пользовательских категорий.
- **Count** — число активных товаров; мелко «+N в архиве», если архивные есть.
- Пустая категория → «Пока нет товаров» + «+ Добавить товар».
- «+» в карточке — `CategoryAddSheet`: «Новый товар» (форма в контексте категории) /
  «Товар из магазина» (мультивыбор товаров и быстрый перенос в категорию).

«+» в заголовке секции — создать категорию (`/seller/inventory/category/new`). Поиска в
«Категориях» нет (категорий немного).

## 6.1 Превью: порядок, архив и листание

- **Порядок:** сначала активные, затем архивные; внутри группы — по `sortOrder`, затем `createdAt`.
- **Архивные** — приглушённо (`grayscale` + `opacity`), товар не пропадает из каталога.
- **Листание (mobile-first):** без нативного скролла/свайпа — строка `ProductPreviewRow`
  сдвигается **ровно на одну карточку** по клику `→`/`←`. Сразу видимо **5** карточек.
- Стрелка `→` видна, пока справа есть карточки; `←` — пока есть слева. Последний элемент — `+`.

## 7. ProductThumbnail

- Квадрат `aspect-ratio: 1`, rounded 12px, `object-fit: cover`.
- Нет изображения → эмодзи-заглушка (`📦`).
- Архивный — приглушённый (`grayscale` + `opacity`), показывается после активных.
- Бейджей поверх миниатюр нет.

## 8. AddProductTile (`+`)

Последняя ячейка превью, dashed border, акцентный `+` — контекстное создание товара в категории
(`/seller/inventory/product/new?categoryId=…`).

## 9. Состояния карточки

- **0 товаров** → «Пока нет товаров» + `+ Добавить товар` (без пустой сетки).
- **1–2** → миниатюры остаются thumbnail-размера, не растягиваются.
- **много** → одна строка, всегда с `+`; при переполнении — листание стрелками.

## 10. Interaction map (актуально)

| Зона | Действие |
|---|---|
| «Товары» / «Категории» (switcher) | смена секции (`?mode=`) |
| «+» в секции «Товары» | `/seller/inventory/product/new` |
| «+» в секции «Категории» | `/seller/inventory/category/new` |
| Тело/заголовок категории | `/seller/inventory/category/:categoryId` |
| Rank-бейдж категории | `ReorderCategorySheet` |
| `ProductThumbnail` / `InventoryProductRow` | `/seller/inventory/product/:productId` |
| «+» в превью категории | `CategoryAddSheet` (новый товар / товар из магазина) |

## 11. Секция «Категории» и поиск

> **Устарело (2026-10-05, `19` Phase D/F):** глобальный поиск Home убран (`InventorySearchState`
> удалён). В секции «Товары» — инлайн-поиск по товарам; в «Категориях» поиска нет.
> «Ничего не найдено» показывается в секции «Товары».

## 12. Empty / Loading / Error

- **Пусто:** «Товары» — «Нет товаров» + «+ Добавить товар», поиск-empty — «Ничего не найдено»;
  «Категории» — «Пока нет товаров» в строке категории. Отдельного пустого экрана категорий нет:
  виртуальная «Без категории» присутствует всегда (ADR-06.9).
- **Loading**: skeleton полноширинных строк.
- **Error**: «Не удалось загрузить каталог» + «Повторить»; пустой каталог при ошибке не показываем
  (иначе кажется, что товары исчезли).
- **Ошибки смены статуса** — inline в карточке товара: сообщение + «Повторить», кнопка disabled
  на время операции. Коды: `NO_ACTIVE_VARIANT`, `NOT_FOUND`, `FORBIDDEN`, `NETWORK`, `UNKNOWN`.
- **Ошибка остатка** — в `StockControlSheet`: `INVENTORY_RESERVED_BY_ORDERS` → «товар зарезервирован
  под активным заказом».

## 13. Responsive

- Категории — всегда одна полноширинная строка; длинные названия усекаются ellipsis, без
  горизонтального overflow.
- Большой экран/tablet: shell ограничен `max-width` 480px, карточки не растягиваются.

## 14. Токены

Существующая система (`globals.css`): `--color-accent`, `--color-bg-card`, `--color-text-*`,
`--spacing-*`, `--radius-*`, `--shadow-card`, `--safe-bottom`. Карточки — subtle border + мягкая
тень. Категории **не** разноцветные — цвет системный. Стеклянные поверхности (`.glass`) — в
карточке товара.

## 15. Component tree (реализовано)

```
InventoryView
├── InventoryHeader (BackButton + centered title)
├── InventoryModeSwitcher
├── InventoryProductsSection
│   ├── InventorySectionHead
│   ├── InventoryProductSearch
│   └── InventoryProductList → InventoryProductRow
├── InventoryCategoryList
│   └── InventoryCategoryRow
│       ├── (head: avatar/name/rank/count)
│       └── ProductPreviewRow → ProductThumbnail[] + AddProductTile
├── InventorySkeleton
├── ReorderCategorySheet
└── CategoryAddSheet
```

Файлы: `src/presentation/seller/inventory/`; данные — `useInventoryHome` /
`useInventoryActions` (`src/application/hooks/`).

## 16. Data contracts (актуально)

```ts
type InventoryCategoryRowProps = {
  category: InventoryCategoryItem;
  previewProducts: InventoryProductItem[];
  onOpen(): void;
  onOpenProduct(productId: string): void;
  onAddProduct(): void;
  position?: number;     // 1-based позиция в каталоге; нет — бейдж не показывается
  onReorder?(): void;    // открыть выбор позиции (только пользовательские категории)
};

type ProductThumbnailProps = {
  product: InventoryProductItem;
  onClick(): void;
};
```

Компоненты **не** знают про InsForge/стор — только props + callbacks. `wide/compact`-вариант
строки удалён (всегда full-width).

## 17. Что НЕ делать

- таблицу товаров на Home (вместо списка/строк), полноценные product cards внутри категорий;
- scroll строки превью (только стрелки ←/→ по одной карточке); masonry; огромные баннеры;
- 10 фильтров; сортировку; графики/аналитику в Inventory;
- отдельную кнопку «Добавить товар» у каждого thumbnail; дублирование CTA;
- большие описания категорий; сложные dropdowns; лишние иконки;
- новую дизайн-систему только для Inventory.

## 18. Открытые вопросы (закрытые)

1. ~~`CategoryMoreButton` (⋯)~~ — **снято:** не нужен; действия категории — редактирование в
   `CategoryView`/`EditCategorySheet` и «+» в блоке категории.
2. ~~Действия `AddInventorySheet`~~ — **снято:** секционные «+» ведут напрямую в create-роуты;
   `AddInventorySheet` удалён. «+» в блоке категории открывает `CategoryAddSheet`.
3. ~~Показывать ли архивные на Home~~ — **решено:** архивные показываются приглушённо, после
   активных (в секциях, категориях и списках).
4. Edit-форма товара и загрузка фото — реализованы (`ProductDraftEditor`/`ProductForm`, Storage
   `shoppis-media`).
5. ~~Search state~~ / ~~порядок категорий~~ — закрыты (`19`, `0027`).
