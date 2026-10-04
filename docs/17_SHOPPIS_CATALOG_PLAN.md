# SHOPPIS — CATALOG (покупатель) — ПЛАН РЕАЛИЗАЦИИ

**Version:** 1.0
**Дата:** 2026-10-04
**Репозиторий:** `forantigravityyesser/Shoppis`
**Базовый срез кода:** `main @ 96e6946` («Functioning product detail block + reviews & questions + related, home quality pass»).
**Объект:** вкладка **Каталог** покупателя — server-driven discovery/search (категория, поиск, цена, pagination), полностью на существующем storefront-фундаменте.
**Вне области:** сортировка, brand/rating/color/size/material/availability/favorites-фильтры, рекомендации, «популярное/новое», отдельный search-engine, отдельные карточки товаров, новая пагинация, общий navigation-polish.

**Связанные документы:** `02` (Product Spec), `03` (Domain & Database Spec), `04` (Technical Spec), `08` (Divergence), `11` (Hardening Backlog), `13` (Buyer Home Plan), `14` (Product Detail Plan), `15` (Buyer Home Hardening Audit), `16` (Remaining Work).

**Статус документа:** authoritative для захода Catalog. Он **не пересматривает** Home; Catalog надстраивается поверх уже hardened Home-контура (`15`).

---

## 0. Главный принцип этапа

> **Мы не строим новый механизм каталога. Мы достраиваем существующий фундамент Shoppis до полноценного server-driven Catalog, максимально переиспользуя Home, `ProductCard`, `ProductGrid`, категории, price semantics, routing и существующие read-model/repository-паттерны.**

Текущий `CatalogView` (`src/presentation/buyer/views/CatalogView.tsx`) — прототип (`doc 15` §8.1): тянет `CATALOG_PRODUCTS_LIMIT = 200` товаров через `useStorefrontHomeProducts` и фильтрует **на клиенте** в `useMemo`. Как финальная архитектура **не принимается**. Целевой поток:

```text
                    SHOP
                     │
          ┌──────────┴──────────┐
          │                     │
        HOME                 CATALOG
          │                     │
    discovery layer       discovery/search
          │                     │
          └──────────┬──────────┘
                     │
                PRODUCT CARD
                     │
               PRODUCT DETAIL
                     │
                   CART
```

Внутри Catalog:

```text
URL / Query State
       ↓
CatalogView
       ↓
useStorefrontCatalog()
       ↓
StorefrontCatalogRepository
       ↓
storefront_catalog_products_read
       ↓
PostgreSQL
```

Это — основной контракт этапа.

---

## 1. Метод и легенда

### 1.1 Как мы работаем (обязательно весь этап)

1. **Один этап за раз.** Реализация → `npm run typecheck` → `npm run lint` → `npm run test` (зелёный suite) → ручная сверка → следующий этап. Не отдаём «одним гигантским заданием».
2. **Двойная среда проверки** (как `00` README): `LOCAL VERIFIED` (браузер/локальный контур) + `TELEGRAM VERIFIED` (Mini App на dev-окружении). Этап не закрыт без обоих.
3. **Слоистость.** Строго `View → Hook → Application contract → Repository → RPC`. Запрещено `UI → Supabase` и `UI → SQL/business logic`.
4. **Переиспользование.** Не создаём `CatalogProductCard` / `SearchProductCard` / `FilteredProductCard`, не создаём `CatalogCategory` при наличии `StorefrontCategory`, не создаём вторую формулу цены.
5. **Первые этапы — без визуала.** CAT-01…CAT-05 (данные/приложение) не трогают UI. Сначала фундамент данных, потом фронтенд.
6. **Порядок качества:** `correct → beautiful → polished`. Catalog functional не смешиваем с navigation-polish.

### 1.2 Легенда статуса

| Метка | Значение |
|---|---|
| ✅ | Реализовано в коде (проверено, указан файл/строка) |
| 🟡 | Частично |
| ❌ | Не реализовано |
| 🔒 | Решение зафиксировано этим документом |

### 1.3 Уже существующий фундамент (проверено по коду)

| Что | Где | Готовность |
|---|---|---|
| Backend read Home-потока + keyset-курсор | `migrations/0023_storefront_home_split_read.sql:66-209` | ✅ |
| Index для keyset | `migrations/0024_home_products_keyset_index.sql:11-13` | ✅ |
| Единая effective price | `0023:116-151,180-184` (`CUSTOM_PRICE`/discount) | ✅ |
| Read-model карточки/категории | `src/application/read-models/storefront.ts:11-51` | ✅ |
| Порт + инфра + mapper | `ports/storefront-repository.ts`, `infrastructure/repositories/storefront-repository.ts`, `mappers/storefront-mappers.ts` | ✅ |
| Hook на `useInfiniteQuery` + append/in-flight guard | `application/hooks/useStorefrontHomeProducts.ts` | ✅ |
| Sentinel InfiniteObserver | `presentation/buyer/hooks/useInfiniteScrollSentinel.ts` | ✅ |
| `ProductCard` / `ProductGrid` / `CategoryItem` / `SearchBar` / `SafeImage` | `presentation/buyer/components/*` | ✅ |
| DI-контейнер | `composition-root.ts` → `AppContainer` → `deps()` | ✅ |
| Router `/catalog` | `src/router.tsx:137` | ✅ |
| URL: `category`, `focus` | `CatalogView.tsx:33,36` | 🟡 (только чтение, локальный state) |
| Catalog UI | `CatalogView.tsx` + `catalog.css` + `category.css` | 🟡 прототип |

**Вывод:** отсутствует только (а) серверный catalog-read RPC, (б) application-контур Catalog, (в) URL/React Query state, (г) UI фильтров/поиска/pagination. Всё остальное переиспользуется.

---

## 2. Контракт Catalog (зафиксирован)

### 2.1 Backend read-model

```ts
storefront_catalog_products_read(
  p_public_id   text,
  p_category_id uuid   default null,
  p_search      text   default null,
  p_min_price   int    default null,
  p_max_price   int    default null,
  p_cursor      text   default null,
  p_limit       int    default 12
) → jsonb
```

Возврат:

```ts
{ products: StorefrontProductCard[]; nextCursor: string | null }
```

**Ровно те же поля**, что уже отдаёт Home (`id, title, categoryId, imageUrl, price, available`). Catalog **не создаёт свою модель товара** и не возвращает лишних seller/technical/внутренних полей.

### 2.2 Price boundaries

```ts
storefront_catalog_price_bounds_read(p_public_id text) → jsonb
```

Возврат: `{ minPrice: number | null; maxPrice: number | null }` — **реальные актуальные purchase price** активных товаров магазина. Не `original_price`, не `0–999999`, без хардкода. 🔒 **Решение:** границы **статичные store-wide** из активных товаров (не пересчитываются на каждый фильтр/категорию в MVP). Диапазон по категории — возможный follow-up, не строим под это отдельную систему.

### 2.3 Price semantics 🔒

Catalog фильтрует по **актуальной цене, которую покупатель сейчас видит на карточке** — то есть по `StorefrontProductCard.price` (effective price **первой активной вариации**, `price_mode = CUSTOM_PRICE` → custom, иначе product price). Отдельной `calculateCatalogPrice()` / `getFilteredPrice()` **не создаётся**: одна формула (`0023:180-184`) на `Home / Catalog / Product Detail / Cart / Order`.

**Принятое ограничение MVP (явно):** если у товара первая активная вариация дороже/дешевле других, фильтр ориентируется на отображаемую цену первой активной вариации. Согласовано с тем, что покупатель видит на карточке. «Товар попадает в диапазон, если хотя бы одна вариация в нём» — **не** текущее поведение; вынесено в `16` как возможный follow-up (`CATALOG-20`).

### 2.4 Сортировка и пагинация 🔒

Deterministic order и формат курсора — **как Home**:

```text
order by created_at desc, id desc
cursor = "<epoch_microseconds>:<id>"
```

Курсор непрозрачен для клиента; невалидный/битый → первая страница. `p_limit` зажимается `[1, 24]` (публичный RPC). Сортировка-как-feature — out of scope.

### 2.5 Поиск 🔒

`p_search` — case-insensitive подстрока по `title` (`ILIKE '%'||q||'%'`, `q` через `btrim`). Сложный ranking/search-engine — out of scope. Индекс под поиск (trigram) не строим в MVP; замер при необходимости.

### 2.6 Границы безопасности

RPC сам гарантирует `security definer` + `set search_path = public` и boundary:

```text
public_id → active shop → active category → active product
```

`public_id` магазина A + `product/category` магазина B **не должно** вернуть B. Catalog multi-shop safe уже сейчас, даже при сознательно отложенном RLS (`11` §S1).

### 2.7 Application-контракт

```ts
type StorefrontCatalogQuery = {
  publicId: string;
  categoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  cursor?: string;
  limit: number;
};

type StorefrontCatalogProductPage = {
  products: StorefrontProductCard[];
  nextCursor: string | null;
};
```

- Порт: `StorefrontCatalogRepository` (или методы в `StorefrontRepository` — решается на CAT-04 без распухания: выделенный порт предпочтительнее).
- Hook: `useStorefrontCatalog(query)` на `useInfiniteQuery`.
- Query key:

```ts
['storefront-catalog', publicId, { categoryId, search, minPrice, maxPrice }]
```

### 2.8 URL = source of truth 🔒

```text
/catalog
/catalog?category=shoes
/catalog?q=nike
/catalog?category=shoes&q=nike
/catalog?category=shoes&minPrice=50&maxPrice=150
```

URL — источник истины для `category`, `q`, `minPrice`, `maxPrice`. Home (`HomeView.tsx:81,88,89,95`) уже ведёт в `/catalog`, `/catalog?category=...`, `/catalog?focus=1` — **все дороги ведут в один Catalog Query**.

### 2.9 Результаты контракт-аудита (CAT-00, сверено по миграциям/коду)

Аудит проведён по `0002_catalog.sql`, `0004_checkout.sql`, `0009`, `0010`, `0011`, `0014`, `0015`, `0023`, `0025`; UI не трогался.

**Сущности и поля (фактические):**

| Таблица | Ключевые поля каталога | Статусы | Источник |
|---|---|---|---|
| `products` | `id`, `store_id`, `category_id` (nullable, FK `on delete set null`), `title`, `sort_order`, `original_amount_minor bigint>=0`, `discount_percent smallint 0..100`, `created_at` | `ACTIVE`/`ARCHIVED` | `0002:27-47` |
| `categories` | `id`, `store_id`, `name`, `normalized_name`, `image_storage_key`, `sort_order`, `created_at` | `ACTIVE`/`ARCHIVED` | `0002:6-18`, `0009:7-9` |
| `variants` | `id`, `product_id`, `name`, `value`, `normalized_value`, `sort_order`, `price_mode`, `custom_original_amount_minor`, `custom_discount_percent`, `created_at` | `ACTIVE`/`ARCHIVED`; `price_mode in ('USE_PRODUCT_PRICE','CUSTOM_PRICE')` | `0002:80-100` |
| `inventory` | `variant_id` PK, `available_quantity>=0`, `held_quantity>=0` | — | `0002:102-109` |
| `product_images` | `product_id`, `storage_key`, `thumb_storage_key`, `sort_order` | — | `0002:49-60`, `0010` |

Текущие индексы: `products_store_id_idx`, `products_category_id_idx` (`0002:46-47`), `products_store_active_created_idx` partial `where status='ACTIVE'` (`0024:11-13`).

**Единая price semantics — подтверждена:**

- Выбор варианта: первая **ACTIVE** вариация `order by sort_order asc, created_at asc` (`0023:135-151`).
- Условие custom: `price_mode='CUSTOM_PRICE' and custom_original_amount_minor is not null` → custom amount/discount, иначе product amount/discount.
- Вывод: `((original_amount_minor * (100 - discount_percent)) + 50) / 100` (`0023:183`) ≡ `round(original::numeric * (100-discount) / 100)` (`0004:137`) для неотрицательных сумм. ✔ Одна семантика.
- **DRY-наблюдение:** формула продублирована в `0004`, `0014`, `0015`, `0022`, `0023`, `0025`. CAT-01 обязан **буквально переиспользовать** её; вынос в общий SQL-helper (`fn_effective_price`) — отдельный hardening, **не** в этом этапе.

**Availability:** `coalesce(bool_or(inv.available_quantity > 0), false)` по ACTIVE-вариациям (`0023:153-158`). Товар без активных вариаций → `available=false`, но цена всё равно вычисляется (fallback на product). Зафиксировано: `available=false` товар **остаётся** в выдаче и попадает в price-bounds (согласованно с карточкой).

**Поиск:** `p.title ILIKE '%'||btrim(q)||'%'` (регистронезависимо). Индекса под поиск нет; для MVP приемлемо, триграм-индекс — по замеру.

**Категории:** фильтр `p.category_id = p_category_id` (uuid), только при переданном значении; в проекции `categoryId = null`, если категория не ACTIVE (архив/удалена). Отдельного статуса `DELETED` нет — удаление категории обнуляет `products.category_id` через FK.

**Multi-shop boundary — подтверждён:** RPC резолвит `v_store` по `public_id`, все джойны/фильтры ограничены `p.store_id = v_store.id`; чужой `category_id`/`product_id` не проходит.

**Правки контракта по итогам аудита:**

1. Диапазон `p_min_price > p_max_price` → RPC возвращает пустой список; UI дополнительно валидирует слайдер (min ≤ max).
2. Поиск/категория/цена комбинируются AND (см. §6 комбинированные).
3. Нумерация: последняя миграция — `0025_product_link.sql`; **следующая каталожная = `0026`** (исправлено; ранее в §9.2 было указано `0025`).

---

## 3. Тезисы по блокам (сводка)

Соответствие исходным разделам ТЗ (CATALOG-00…24):

| Блок | Смысл | Разделы ТЗ |
|---|---|---|
| **A. Границы** | Catalog — отдельный этап; Home ≠ Catalog; 1 Product Card = 1 product identity; варианты внутри карточки — решение продавца | Этап 0, CATALOG-19, CATALOG-22, CATALOG-23 |
| **B. Backend read-model** | `storefront_catalog_products_read`, только поля карточки | CATALOG-01 |
| **C. Price** | Единая effective purchase price; boundaries из реальных цен магазина | CATALOG-02, CATALOG-20 |
| **D. Pagination** | Keyset-курсор как Home, детерминированный order | CATALOG-03 |
| **E. Application** | Query/Page/Repository/Hook/React Query + reset курсора | CATALOG-04, CATALOG-05 |
| **F. URL state** | URL как источник истины, один Catalog Query | CATALOG-06 |
| **G. UI** | Quick categories, All Categories, Search, Filter Sheet, Applied filters, ProductGrid, infinite, loading/empty/error | CATALOG-07…16 |
| **H. Поведение** | Last-write-wins, локальный драфт фильтра, ошибка стр. 2 не рушит экран | CATALOG-10, CATALOG-13, CATALOG-16, CATALOG-17 |
| **I. Навигация** | Home→Catalog→Product→Back, сохранение query | CATALOG-18 |
| **J. Безопасность** | Multi-shop boundary | CATALOG-21 |
| **K. Аудит/DoD** | Три слоя аудита, Definition of Done | CATALOG-24 |

---

## 4. Этапы разработки (порядок и «как делать»)

```text
                CATALOG
                   │
                   ▼
          CAT-00 Контракт-аудит
                   │
                   ▼
          CAT-01 Backend read-model
                   │
                   ▼
          CAT-02 Price semantics
                   │
                   ▼
          CAT-03 Cursor pagination
                   │
                   ▼
          CAT-04 Application contracts
                   │
                   ▼
          CAT-05 React Query hook
                   │
                   ▼
          CAT-06 URL query state
                   │
                   ▼
          CAT-07 Categories
                   │
                   ▼
          CAT-08 Search
                   │
                   ▼
          CAT-09 Filter + price slider
                   │
                   ▼
          CAT-10 Applied filters
                   │
                   ▼
          CAT-11 ProductGrid + infinite
                   │
                   ▼
          CAT-12 Loading / empty / error
                   │
                   ▼
          CAT-13 Navigation
                   │
                   ▼
          CAT-14 Hardening
                   │
                   ▼
          CAT-15 Full audit + DoD
```

### CAT-00 — Контракт-аудит (без кода) ✅ выполнено
- ✅ Сверено по `migrations/0002,0004,0009,0010,0011,0014,0015,0023,0025` и коду storefront-слоя.
- ✅ Зафиксированы сущности/статусы/поля, единая price semantics, availability, поиск, boundary, indехсы — см. §2.9.
- ✅ Уточнено поведение краевых случаев: `min>max → пусто`; `available=false` остаётся в выдаче и bounds; поиск `ILIKE`.
- ✅ Исправлена нумерация: следующая миграция `0026`.
- **UI не трогался.** Артефакт — §2.9 этого документа.

### CAT-01 — Backend read-model `H1`
- Миграция `0026_storefront_catalog_read.sql`: `storefront_catalog_products_read(...)` по образцу `storefront_home_products_read` (`0023:66-209`), плюс `storefront_catalog_price_bounds_read(...)`.
- Инварианты: `p.status = 'ACTIVE'`; `p.store_id = v_store.id`; `categoryId = null`, если категория не ACTIVE; image `thumb → full`; `available` = есть активный вариант с `available_quantity > 0`; фильтры `category_id`, `title ILIKE`, effective-price `BETWEEN`.
- `security definer`, `set search_path = public`, `grant execute ... to public`; `p_limit` clamp `[1,24]`.
- Индексы: при необходимости добавить под `category_id`/price — только после замера (не преждевременно).
- Проверка на реальных данных: пустой каталог, одна категория, поиск, диапазон, несколько страниц, not-found, чужой category_id.

### CAT-02 — Price semantics `H1`
- Переиспользовать формулу `((original_amount_minor * (100 - discount_percent)) + 50) / 100` из `0023:183` и выбор первой активной вариации (`0023:135-151`) — **скопировать логику в catalog-RPC без изменения смысла**, не вводить второй калькулятор.
- Проверить: `CUSTOM_PRICE`, discount, отсутствие активной вариации, `available=false`.
- Тест-кейс: товар с discount и с variant-override — цена в фильтре совпадает с ценой на карточке.

### CAT-03 — Cursor pagination `H1`
- Формат курсора и order — идентично Home (`0023:97-107,159-166,193-201`).
- Тесты: page1/page2/last/invalid/not-found, без дублей и пропусков.

### CAT-04 — Application contracts `H1`
- Типы `StorefrontCatalogQuery`, `StorefrontCatalogProductPage` (`application/read-models/`).
- Порт `application/ports/storefront-catalog-repository.ts`; реализация `infrastructure/repositories/storefront-catalog-repository.ts` + mapper (переиспользовать `mapProduct`).
- Подключить в `AppContainer`/`composition-root.ts`.
- Тесты порта/маппера/repository (`null`, malformed, not-found).

### CAT-05 — React Query hook `H1`
- `application/hooks/useStorefrontCatalog.ts` на `useInfiniteQuery` по образцу `useStorefrontHomeProducts` (in-flight guard, дедуп по id, раздельные `initialError`/`nextPageError`).
- Query key `['storefront-catalog', publicId, {categoryId, search, minPrice, maxPrice}]`.
- **Обязательно:** при изменении любого фильтра курсор начинается с `null`. Старый курсор не «протекает» в новое состояние.
- Тесты: first/next/last, no duplicate fetch, filter-change → reset, error первой/следующей страницы.

### CAT-06 — URL query state `H1`
- `CatalogView` читает/пишет `category`, `q`, `minPrice`, `maxPrice` через `useSearchParams`; локальный `useState` фильтров убрать.
- Сохранить существующий `focus=1` (фокус поля поиска, `CatalogView.tsx:36-39`).
- Все входы (`Home`, `All Categories`, Filter Sheet) пишут в один и тот же URL.

### CAT-07 — Categories `H2`
- Вверху 4 быстрых категории + «Все категории →»; переиспользовать `CategoryItem`/`CategorySection`/`category.css` (визуальный язык Home/glow сохраняем, без копирования CSS).
- `AllCategoriesSheet` — отдельный sheet (переиспользовать существующий `BottomSheet`, если подходит).
- Тап → `navigate('/catalog?category=<id>')`; **никакого локального `setCategory`**.
- Модель — существующий `StorefrontCategory`, не создавать `CatalogCategory`.

### CAT-08 — Search `H2`
- `SearchBar` (reuse) + debounce ~300ms → обновление URL `q` → React Query → сервер.
- Пустой `q` → обычный Catalog. Без запроса на каждый символ.

### CAT-09 — Filter Sheet + price slider `H2`
- Отдельный `FilterSheet`: два draggable handle, значения «От … / До …», диапазон из `storefront_catalog_price_bounds_read`.
- 🔒 Значения держим **локально в sheet**; запрос — только по кнопке «Показать товары» (нет запроса на каждый пиксель слайдера).

### CAT-10 — Applied filters `H2`
- Chips после toolbar: `[ Category × ] [ €50–€150 × ]`. Поиск chip'ом не обязателен (текст виден в `SearchBar`).
- Снятие одного фильтра **не сбрасывает остальные**; снятие price → возврат в default, category → удаление.

### CAT-11 — ProductGrid + infinite `H2`
- Переиспользовать `ProductGrid` + `ProductCard` (reuse `onOpen → /product/:id`).
- Sentinel `useInfiniteScrollSentinel` → `fetchNextPage()`; существующие карточки **не исчезают** при догрузке.

### CAT-12 — Loading / Empty / Error `H2`
- Skeleton при первой загрузке (общий `.skel`); при pagination — существующий grid + маленький loader внизу.
- Empty-состояния: каталог пуст / ничего не найдено (поиск) / нет в диапазоне (фильтр) / категория пуста.
- Ошибка первой загрузки → «Не удалось загрузить каталог» + «Повторить». Ошибка следующей страницы → toast/inline у низа, **уже показанные товары сохраняются**.

### CAT-13 — Navigation `H2`
- Проверить `Home → Catalog → Product → Back → Catalog` и `Catalog(category) → Product → Back`; query сохраняется.
- Глобальный navigation-polish — отложен (`CATALOG-23`).

### CAT-14 — Hardening `H1`
- Стресс-тест быстрых действий (`Shoes → search Nike → filter → убрать Shoes → Adidas`): последний ввод всегда побеждает, старый запрос не «всплывает».
- Проверка multi-shop boundary: чужой `categoryId`/`product` не проходит.
- DRY-проверка: цена, маппинг, изображения, карточка, pagination, loading — без дублей.

### CAT-15 — Full audit + DoD `H1`
- **Архитектурный аудит:** цепочка `View → Hook → Contract → Repository → RPC`, нет `UI → Supabase`/SQL.
- **DRY-аудит:** нет `CatalogProductCard`, второй формулы цены, второго механизма пагинации.
- **Behaviour-аудит:** см. §6.
- Обновить `00` README и `16` Remaining Work.

---

## 5. Definition of Done (Catalog не закрывается, пока не выполнено)

### Backend
- [ ] server-side catalog read-model (`storefront_catalog_products_read`);
- [ ] search server-side;
- [ ] category server-side;
- [ ] price server-side;
- [ ] актуальная effective purchase price (одна семантика с Home);
- [ ] deterministic ordering `created_at desc, id desc`;
- [ ] keyset pagination + clamp limit;
- [ ] правильный shop boundary (multi-shop safe);
- [ ] active-only entities;
- [ ] корректные indexes (по замеру);
- [ ] price semantics verified (card price == filter price).

### Application
- [ ] `StorefrontCatalogQuery`;
- [ ] `StorefrontCatalogProductPage`;
- [ ] repository + mapper;
- [ ] hook `useStorefrontCatalog`;
- [ ] React Query + query key;
- [ ] cursor reset при изменении query.

### UI
- [ ] 4 quick categories;
- [ ] All Categories sheet;
- [ ] Search (debounce);
- [ ] Filter button;
- [ ] price range slider (bounds из store-wide активных);
- [ ] applied filter chips;
- [ ] `ProductGrid` + существующий `ProductCard`;
- [ ] infinite loading;
- [ ] skeletons;
- [ ] empty states;
- [ ] error states (initial / next-page раздельно).

### Navigation
- [ ] Home → Catalog;
- [ ] Home category → Catalog filtered;
- [ ] All Categories → Catalog filtered;
- [ ] Catalog → Product;
- [ ] Back;
- [ ] query preserved.

### Quality
- [ ] no mocks;
- [ ] no duplicated product card;
- [ ] no client-side bulk loading (никакого `limit 200` + `filter()`);
- [ ] no business logic in View;
- [ ] no duplicate price calculation;
- [ ] no unnecessary new mechanism;
- [ ] `npm run typecheck`;
- [ ] `npm run lint`;
- [ ] `npm run test` (зелёный);
- [ ] `npm run build`;
- [ ] Telegram real-data test (`TELEGRAM VERIFIED`).

---

## 6. Матрица проверок (behaviour audit)

**Search:** empty · short · long · no results · clear · rapid typing.
**Category:** first 4 · all categories · archived · empty category · invalid category.
**Price:** min · max · min == max · invalid range (min > max) · no products · discount · variant price.
**Pagination:** one page · multiple pages · end · duplicate prevention · error · retry.
**Combined:** category+search · category+price · search+price · category+search+price.
**Store:** active · paused · not found · empty store.
**Security:** чужой `categoryId` · чужой `product_id` · malformed `public_id`.

---

## 7. Out of scope (не делаем в этом этапе)

❌ сортировка; ❌ rating-filter; ❌ brand-filter; ❌ color-filter; ❌ size-filter; ❌ material-filter; ❌ availability-filter; ❌ favorites-filter; ❌ recommendations; ❌ «popular»; ❌ «new»; ❌ сложный search-ranking; ❌ отдельный search-engine; ❌ category-specific attribute filtering; ❌ отдельные карточки товаров для Catalog; ❌ новая pagination-система; ❌ RLS; ❌ тяжёлый navigation-polish.

## 8. Deferred polish (после функциональности)

Navigation back/transitions/scroll-restoration · focus-management · input position · keyboard-aware UI · Telegram viewport · header alignment · центрирование названий · animations/transitions · bottom-navigation behaviour. Принцип: сначала **correct**, потом **beautiful**, потом **polished**.

---

## 9. Зафиксированные решения и риски

### 9.1 Решения 🔒
1. Документ Catalog — этот файл; указатель в `00` README.
2. Price-фильтр — по **отображаемой** effective price (первая активная вариация), согласовано с карточкой.
3. Границы слайдера — **статичные store-wide** из активных товаров (RPC `storefront_catalog_price_bounds_read`).
4. UI-строки — хардкод RU (как текущая buyer-витрина); централизованный i18n — позже.
5. Модель данных — существующие `StorefrontProductCard` / `StorefrontCategory`; новых карточных моделей нет.

### 9.2 Риски / требует внимания
- **Price vs variation:** отображаемая цена ≠ минимум по вариациям. Зафиксировано как осознанное MVP-ограничение (follow-up в `16`, `CATALOG-20`).
- **Search perf:** `ILIKE` без индекса на больших магазинах. Приемлемо для MVP; триграм-индекс — по замеру.
- **Boundaries vs фильтр:** store-wide диапазон может оставлять «пустые» под-диапазоны внутри категории. Приемлемо для MVP.
- **`storeId` смешивает роли** (`15` §9.3): Catalog использует `viewedStore.publicId` для read и `viewedStore.id` для scope — новых усилений смешения не вводим.
- **Next migration number:** `0026` (последняя в репозитории — `0025_product_link.sql`; учтено в CAT-01).

---

## 10. Международная сводка одного абзаца

Catalog — это не новый каталог, а **серверный read-слой поверх уже готового Home-фундамента**: один RPC `storefront_catalog_products_read` (category + search + price + keyset-курсор) и лёгкий `storefront_catalog_price_bounds_read`, application-контур `StorefrontCatalogQuery → Repository → useStorefrontCatalog` на `useInfiniteQuery`, URL как единственный источник истины (`category/q/minPrice/maxPrice`), и UI, целиком собранный из существующих `ProductGrid/ProductCard/CategoryItem/SearchBar/SafeImage`. Единая price semantics, multi-shop boundary и отсутствие дублирующих механизмов — обязательные инварианты. Этапы идут строго по порядку CAT-00…CAT-15, первые пять — без визуала, каждый закрывается зелёными `typecheck`/`lint`/`test`/`build` и проверкой в Telegram.
