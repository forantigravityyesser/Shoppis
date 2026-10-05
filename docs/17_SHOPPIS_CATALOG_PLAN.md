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

- Порт: **выделенный** `StorefrontCatalogRepository` (принято на CAT-04, чтобы не раздувать `StorefrontRepository`).
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

### CAT-01 — Backend read-model `H1` ✅ выполнено
- ✅ Миграция `0026_storefront_catalog_read.sql`: `storefront_catalog_products_read(...)` по образцу `storefront_home_products_read` (`0023:66-209`), плюс `storefront_catalog_price_bounds_read(...)`.
- ✅ Инварианты: `p.status = 'ACTIVE'`; `p.store_id = v_store.id`; `categoryId = null`, если категория не ACTIVE; image `thumb → full`; `available` = есть активный вариант с `available_quantity > 0`; фильтры `category_id`, `title ILIKE`, effective-price `BETWEEN`.
- ✅ `security definer`, `set search_path = public`, `grant execute ... to public`; `p_limit` clamp `[1,24]`; неверная/чужая категория и `min>max` → пустой результат (не ошибка).
- ✅ Индексы: новых не добавлялось (существующих `products_store_active_created_idx` + `products_category_id_idx` достаточно при текущем масштабе; price — вычисляемый, индекс не применим).
- ✅ Применено к live-backend и проверено на реальных данных (2 магазина, 13 товаров, 8 категорий):
  - пагинация `limit 3`/`5`: `total_rows = distinct_ids = 11` (без дублей/пропусков), последняя страница → `nextCursor = null`;
  - поиск `'nike'` → 7; категория Nike (store A) → 6; диапазон `15000–20000` → 4;
  - `min>max` → пусто; несуществующая/случайная категория → пусто; `public_id` не найден → `null`;
  - **кросс-магазин:** категория магазина B в запросе к магазину A → пусто; bounds B (min 13266 / max 1586666644) не влияют на bounds A (8000–320000);
  - битый курсор (`'garbage'`) → первая страница;
  - **паритет цены:** Catalog price == Home `price` на 11/11 товарах (0 расхождений).
- ✅ (CAT-02) Сценарии `CUSTOM_PRICE`, `ARCHIVED` product/category, отсутствие активной вариации и sold-out проверены на изолированном временном магазине — см. CAT-02.

### CAT-02 — Price semantics `H1` ✅ выполнено
- ✅ Переиспользована формула `((coalesce(v.orig, p.orig) * (100 - coalesce(v.disc, p.disc))) + 50) / 100` из `0023:183` и выбор первой активной вариации (`0023:135-151`) — второй калькулятор не вводился.
- ✅ Проверено на изолированном временном магазине `cat02test` (создан → проверен → удалён; каскад подтверждён, база вернулась к 2 stores / 13 products):

| Кейс (seed) | Ожидание | Факт |
|---|---|---|
| `discount` (100000, −20%) | 80000 | ✅ 80000 |
| `CUSTOM_PRICE` override (product −20%, variant 70000) | 70000 (override побеждает) | ✅ 70000 |
| нет активной вариации (product 50000) | fallback 50000, `available=false` | ✅ 50000 / false |
| sold-out активная вариация (30000, qty 0) | 30000, `available=false` | ✅ 30000 / false |
| `ARCHIVED` product | исключён | ✅ отсутствует |
| `ARCHIVED` category | включён, `categoryId=null` | ✅ price 20000 / null |
| bounds | min 20000 / max 80000 | ✅ 20000 / 80000 |
| фильтр `70000–70000` | только override | ✅ 1 («custom override») |
| фильтр `75000–85000` | только discount (80000), override (70000) исключён | ✅ 1 («discount product») |
| паритет Catalog ↔ Home | совпадение всех цен | ✅ 5/5, 0 расхождений |

- ✅ Итог: цена фильтра == цена карточки (Catalog == Home), включая discount и variant-override.

### CAT-03 — Cursor pagination `H1` ✅ выполнено
- ✅ Формат курсора и order идентичны Home (`0023:97-107,159-166,193-201`): `<epoch_microseconds>:<id>`, `order by created_at desc, id desc`; курсор указывает на последнюю строку страницы, следующая — строго после неё; `limit+1` probe только сигналит о наличии следующей страницы.
- ✅ Проверено рекурсивным проходом всех страниц на live-данных магазина A (11 товаров): для каждой комбинации `total == distinct` (без дублей/пропусков), последняя страница → `nextCursor = null`, суммарное число совпадает с прямой выборкой без курсора:

| Комбинация | Страниц | Собрано = уникальных | Ожидалось | last cursor |
|---|---|---|---|---|
| без фильтра, limit 3 | 4 | 11 = 11 | 11 | null ✅ |
| `search='nike'`, limit 3 | 3 | 7 = 7 | 7 | null ✅ |
| `category=Nike`, limit 4 | 2 | 6 = 6 | 6 | null ✅ |
| `price=15000–20000`, limit 3 | 2 | 4 = 4 | 4 | null ✅ |
| `category + search + price`, limit 2 | 2 | 3 = 3 | 3 | null ✅ |

- ✅ Граничные случаи: ровно `limit == total` → последняя страница (`nextCursor=null`); `limit < total` → `nextCursor` есть. `CUSTOM_PRICE`/фильтры не ломают курсор.
- ✅ Clamp лимита: `p_limit=0` → 1 строка + есть следующая; `p_limit=1000` → зажат до 24 (в магазине A отдал 11, `nextCursor=null`). Битый курсор → первая страница (проверено в CAT-01).

### CAT-04 — Application contracts `H1` ✅ выполнено
- ✅ `application/read-models/storefront-catalog.ts`: `StorefrontCatalogQuery`, `StorefrontCatalogProductPage`, `StorefrontCatalogPriceBounds`. Карточка **переиспользует** `StorefrontProductCard`.
- ✅ Порт `application/ports/storefront-catalog-repository.ts` (выделенный, не расширение `StorefrontRepository`).
- ✅ Инфра `infrastructure/repositories/storefront-catalog-repository.ts`: `loadCatalogProducts` → `storefront_catalog_products_read` (все фильтры), `loadCatalogPriceBounds` → `storefront_catalog_price_bounds_read`; мапперы добавлены в `storefront-mappers.ts` и **переиспользуют `mapProduct`**.
- ✅ Проводка: `AppContainer.storefrontCatalogRepository` + `composition-root.ts`.
- ✅ Тесты: mapper (+4 кейса `mapStorefrontCatalogProductPage`/`PriceBounds`), repository (10: guard без `publicId`, полный набор параметров, null-дефолты, not-found → null, транспортная ошибка). Всего +30 тестов к suite.
- ✅ `npm run typecheck`, `npm run lint` (0 errors), `npm run test` — **465 / 75 файлов зелёные**.

### CAT-05 — React Query hook `H1` ✅ выполнено
- ✅ `application/hooks/useStorefrontCatalog.ts` на `useInfiniteQuery` по образцу `useStorefrontHomeProducts` (in-flight guard, дедуп по id, раздельные `initialError`/`nextPageError`, `enabled`).
- ✅ Query key `['storefront-catalog', publicId, { categoryId, search, minPrice, maxPrice }]` (`limit` вне ключа — константа `CATALOG_PRODUCTS_PAGE_SIZE = 12`).
- ✅ **Сброс курсора при смене фильтра:** новый набор фильтров → новая cache-запись → `pageParam = null`; старый курсор не «протекает». «Последний ввод побеждает» — за счёт изоляции React Query по ключу.
- ✅ Тесты (+11): без `publicId`/`enabled=false` не ходит; первая страница с полным набором фильтров; loadMore/конец/no-op; параллельный loadMore → 1 fetch; дедуп по id; **смена фильтра → `cursor=null` и товары нового фильтра**; `initialError` vs `nextPageError`; `refresh`.
- ✅ `npm run typecheck`, `npx eslint` (0 проблем), `npm run test` — **476 / 76 файлов зелёные**.

### CAT-06 — URL query state `H1` ✅ выполнено
- ✅ `CatalogView` читает `category`, `q`, `minPrice`, `maxPrice` из `useSearchParams`; локальный `useState` фильтров убран. Источник данных переведён с `useStorefrontHomeProducts` + клиентский `filter()` на `useStorefrontCatalog` (server-side).
- ✅ Запись в URL через `setSearchParams(..., { replace: true })`: категория/поиск/цена — единый `CatalogQuery`; пустое значение удаляет параметр; при интеракции снимается `focus`.
- ✅ `focus=1` сохранён (фокус поля поиска).
- ✅ Битый `minPrice`/`maxPrice` → `null` (не ломает запрос).
- ✅ Тесты `CatalogView.test.tsx` переписаны под URL/сервер (+13): `category`/`q`/`minPrice`/`maxPrice` → фильтры хука; записи в URL; активный чип; PAUSED; пусто; ошибка.
- ✅ Debounce поиска — CAT-08; All Categories/Filter Sheet — CAT-07/09 (пока пишут в тот же URL).
- ✅ `npm run typecheck`, `npx eslint` (0), `npm run test` — **482 / 76 файлов зелёные**.

### CAT-07 — Категории: порядок (продавец) + 8 карточек / All Categories (покупатель) 🟡
CAT-07 расширен seller-механикой управления порядком категорий. Решения (🔒):
full-порядок **1..N** для всех ACTIVE-категорий; общий `categories.sort_order` (сетка продавца и витрина — один порядок, WYSIWYG, новых столбцов нет); позиция применяется **сразу**; бейджи **1–4 акцентные / 5+ нейтральные**; «Без категории» всегда последняя и не переставляется; карточек категорий у покупателя — **8** (те же карточки, что на Home; заглушка красится по позиции 1..8).

#### CAT-07a — Backend + application (без UI) ✅ выполнено
- ✅ Миграция `0027_category_reorder.sql`: `category_reorder_atomic(p_category_id uuid, p_position int, p_actor_user_id uuid)` — `catalog_assert_store_owner`, ACTIVE-категории магазина упорядочиваются `(sort_order, created_at, id)`, цель вставляется в позицию (clamp 1..N), **перенумерация 0..N-1** одной транзакцией; возврат нового порядка.
- ✅ `catalog-actions` edge: action `category-reorder` (actor из сессии); **задеплоен** (active, deployment `01vmm7pt01yh`).
- ✅ `catalog-api.reorderCategory`; порт `CategoryRepository.setCategoryOrder` + инфра; `category-slice.reorderCategory` (оптимистично + откат при ошибке); `domain/rules/category-rules.reorderCategories` (чистая, зеркалит сервер); `useInventoryActions.reorderCategory`.
- ✅ Live-проверка на изолированном temp-магазине (5 ACTIVE + 1 ARCHIVED; создан → проверен → удалён; база вернулась к 2 stores / 8 categories):
  - last→1: `C5,C1,C2,C3,C4` (0..4); середина→3: `C5,C2,C1,C3,C4`; clamp 999 → позиция 5 (последняя);
  - ARCHIVED не участвует (sort_order сохранён, не в списке reorder); чужой actor → `FORBIDDEN`; archived/несуществующая цель → `CATEGORY_NOT_FOUND`.
- ✅ Тесты: `reorderCategories` (+4), `catalog-api.reorderCategory` (+1).
- ✅ `typecheck`, `eslint` (0), `test` — **487 / 76 файлов зелёные**.

#### CAT-07b — Seller UI ✅ выполнено
- ✅ `CategoryCard`: номерной бейдж позиции рядом с кол-вом товаров; `position` 1–4 → акцентные цвета (`inv-cat__rank--1..4`), 5+ → нейтральный (`--n`); системная категория без бейджа. Клик — `stopPropagation`, не открывает категорию.
- ✅ `ReorderCategorySheet` (на `BottomSheet`): сетка чисел `1..N`, текущая позиция `aria-pressed`, выбор применяется **сразу** (`onSelect`).
- ✅ `CategoryGrid` пробрасывает `positionsByCategory` и `onReorderCategory`; `InventoryView` считает позиции (1-based среди несистемных, из уже отсортированного списка `useInventoryHome`), хранит `reorderId`, вызывает `useInventoryActions.reorderCategory`. Сетка продавца переупорядочивается (общий `sort_order`, WYSIWYG).
- ✅ CSS (`inventory.css`): `.inv-cat__rank*`, `.reorder__*` (числа 1–4 окрашены, 5+ нейтральны).
- ✅ Тесты: `CategoryCard` (+4: бейдж/клик без открытия/нейтраль 5+/скрытие), `ReorderCategorySheet` (+3: 1..N/текущая/выбор).
- ✅ `typecheck`, `eslint` (0), `test` — **494 / 78 файлов зелёные**.

#### CAT-07c — Buyer UI ✅ выполнено
- ✅ **Визуал полностью от Home**: корень каталога — `.home` (радиальный фон мята→голубой), контент — `.home-sheet` (белый лист со скруглением сверху); `home.css` переиспользован, не скопирован.
- ✅ `CatalogHeader`: «назад» слева (`BackButton`, fallback `/`), название **по центру**, справа — **профиль** покупателя (`serverUser`, как на Home). Иконка-кнопка — общий `.home-icon-btn`.
- ✅ `CatalogCategoryTiles`: **8 карточек** первых категорий **того же вида, что на главной** (`CategoryItem`) в **гриде 4 колонки** (`catalog-cats__grid`). Фото категории показывается, если загружено; **иначе заглушка-инициал красится по позиции слота 1..8** (`category-item__placeholder--1..8`, 8 цветов; `CategoryItem.variant`). Home не затронут (без `variant` — базовая лавандовая заглушка). Тап → `category` в URL.
- ✅ Кнопка «Все категории» перенесена из шапки **в блок 4 карточек** — маленькая **стрелка сверху справа** (`catalog-all-arrow`).
- ✅ Ряд кнопок категорий (chips) **убран полностью**. Поиск перенесён **под** плитки (второй шаг — debounce, CAT-08).
- ✅ Каталожный лист (`.home-sheet.catalog-sheet`): **плавный выход в голубой начинается сразу после 4 плиток** (`#fff 0 → #fff 250px → storefront-blue 100%`), а не в середине сетки.
- ✅ `AllCategoriesSheet` (по стрелке): полный список в порядке продавца, переиспользует `CategoryItem`; выбор закрывает sheet и пишет URL.
- ✅ `CatalogSkeleton` приведён к тому же визуалу (фон/шапка/лист/плитки/поиск/сетка) — без белого flash.
- ✅ `CategoryItem`/`category.css` снова используются только внутри sheet (в Home — как было).
- ✅ Тесты: `CatalogCategoryTiles` (+4), `CatalogView` (14: шапка, плитки, sheet, URL, ошибки).
- ✅ `typecheck`, `eslint` (0), `test` — **499 / 79 файлов**, `build` — зелёные.
- ⬜ Осталось (визуал): ручная проверка в браузере/Telegram на реальных данных (в терминале недоступна).

### CAT-08 — Search `H2` ✅ выполнено
- ✅ Debounce **300ms**: ввод держится в локальном `searchDraft`, URL `q` (и, значит, React Query) обновляется после паузы; **запроса на каждый символ нет**. Для debounced-записи используются актуальные URL-параметры (ref), курсор сбрасывается при изменении `q` (CAT-05).
- ✅ **Пустой ввод → мгновенно** удаляет `q` (без ожидания debounce и без лишнего запроса) → обычный каталог.
- ✅ Отложенная запись снимается при уходе с экрана (без setState после unmount).
- ✅ `focus=1` (переход с Home по поиску) сохранён — автофокус поля.
- ✅ **Визуал `SearchBar` переработан**: высота 48px, акцентная иконка, тонкая рамка + мягкая тень, **focus-ring** (`:focus-within`), круглая кнопка очистки; скрыт нативный крестик `type=search`; `enterKeyHint="search"`, `autoComplete=off`.
- ✅ **Пустой результат по поиску** → осмысленное сообщение: title «Ничего не нашлось» + текст «По запросу «{q}» товаров нет…»; без поиска → «Товаров пока нет». (Полный набор empty-состояний — CAT-12.)
- ✅ **Фикс потери фокуса при вводе:** `useStorefrontCatalog` использует `placeholderData: keepPreviousData`. Раньше смена `q`/фильтра создавала новый query key без данных → `isLoading` → `CatalogSkeleton` подменял экран и размонтировал поле ввода (обрыв ввода, закрытие клавиатуры). Теперь предыдущие товары остаются до прихода нового набора, экран не подменяется.
- ✅ Тесты `CatalogView` (+2: debounce «не на каждый символ» + мгновенная очистка; +пустые состояния) — 16 кейсов; `useStorefrontCatalog` +1 (keepPreviousData: смена фильтра не уходит в loading и не сбрасывает товары).
- ✅ `typecheck`, `eslint` (0), `test` — **505 / 79 файлов**, `build` — зелёные.
- Примечание: `q`-изменения идут через `replace:true` (без лишней истории); внешний источник `q` (кроме Home-фокуса) не меняет поле без перемонтирования.

### CAT-09 — Filter Sheet + price slider `H2` ✅ выполнено
- ✅ `useStorefrontCatalogPriceBounds` — границы цен магазина (`storefront_catalog_price_bounds_read`), кэш 5 мин, `null` при магазине без товаров.
- ✅ Кнопка фильтров (`SlidersHorizontal`) в ряду поиска (`catalog-search-row`); при активном ценовом фильтре — акцент + точка. Открывает `CatalogFilterSheet`.
- ✅ `PriceRangeSlider` — двойной слайдер (От/До) на двух нативных `<input type=range>` с наложением: треки прозрачны, интерактивны только ползунки (`pointer-events`), кламп «от ≤ до» — атрибутами `min/max`. Значения в minor units, отображение через `formatMoneyMinor`.
- ✅ 🔒 Значения держатся **локально в sheet**; запрос уходит **только** по кнопке «Показать товары» (никаких запросов на движение слайдера). Есть «Сбросить».
- ✅ Наружу уходят только **сужающие** границы (равен store-wide → `null`); запись в URL `minPrice`/`maxPrice` одним батчем (`setParams`), курсор сбрасывается (CAT-05), `keepPreviousData` не даёт skeleton-мерцания.
- ✅ Нет границ → сообщение «Пока нет доступных цен для фильтра.»; применение просто закрывает.
- ✅ Тесты: `useStorefrontCatalogPriceBounds` (+3), `PriceRangeSlider` (+2), `CatalogFilterSheet` (+6), `CatalogView` (+2: открытие/применение и активная кнопка) — всего 519 / 82 файла.
- ✅ `typecheck`, `eslint` (0 errors; 1 warning set-state-in-effect — как у существующих sheet'ов), `test`, `build` — зелёные.

### CAT-10 — Applied filters `H2` ✅ выполнено
- ✅ `CatalogAppliedFilters`: чипсы применённых фильтров под рядом поиска — категория (`Обувь ×`) и цена (`50 € – 1000 € ×`, либо `от …`/`до …`). Рендерятся только при наличии фильтров.
- ✅ Снятие одного чипа трогает **только свой** параметр (цена → `minPrice`+`maxPrice`, категория → `category`); остальные сохраняются. Поиск чипом не дублируется — текст виден в поле.
- ✅ Подпись цены — через `formatMoneyMinor`; имя категории — из `home.categories`.
- ✅ Тесты: `CatalogAppliedFilters` (+3), `CatalogView` (+2: снятие категории/цены не сбрасывает другие) — всего 524 / 83 файла.
- ✅ `typecheck`, `eslint` (0), `test`, `build` — зелёные.

### CAT-11 — ProductGrid + infinite `H2` ✅ выполнено
- ✅ Переиспользованы `ProductGrid` + `ProductCard` (`onOpen → /product/:id`).
- ✅ Sentinel `useInfiniteScrollSentinel` → `catalog.loadMore` (`IntersectionObserver`, `rootMargin=600px`, без scroll-listener); `enabled = hasNextPage && !fetchingNextPage && !nextPageError`.
- ✅ Существующие карточки **не исчезают** при догрузке (append + дедуп по id из CAT-05); индикатор `fetchingNextPage` — внизу.
- ✅ Ошибка догрузки — отдельный блок у низа с «Повторить» (не рушит уже показанные товары); детальный empty/loading/error — CAT-12.
- ✅ Тесты `CatalogView` (+3: sentinel, индикатор догрузки, ошибка догрузки с retry) — всего 527 / 83 файла.
- ✅ `typecheck`, `eslint` (0), `test`, `build` — зелёные.

### CAT-12 — Loading / Empty / Error `H2` ✅ выполнено
- ✅ **Loading:** первая загрузка → `CatalogSkeleton` (фон/шапка/лист + 8 категорий + поиск + сетка, без белого flash); догрузка → сетка остаётся, снизу индикатор (CAT-11).
- ✅ **Empty (различаются по контексту фильтров, роль `status`):**
  - поиск → «Ничего не нашлось» + «По запросу «{q}» товаров нет…»;
  - цена → «Нет товаров в этом диапазоне» + «Попробуйте изменить фильтр по цене.»;
  - категория → «В этой категории пока нет товаров» + «Загляните в другие категории.»;
  - без фильтров → «Товаров пока нет» + «В этом магазине пока нечего показать.».
- ✅ **Error:** первая загрузка → `role="alert"` блок «Не удалось загрузить каталог» + «Повторить» (перезапрос home+catalog); ошибка догрузки → отдельный блок у низа, уже показанные товары сохраняются (CAT-11). `keepPreviousData` не даёт мигать skeleton/empty при смене фильтра.
- ✅ Тесты `CatalogView` (+2: пусто по цене и по категории; заголовок ошибки) — всего 529 / 83 файла.
- ✅ `typecheck`, `eslint` (0), `test`, `build` — зелёные.

### CAT-13 — Navigation `H2` ✅ выполнено
- ✅ Query сохраняется при возврате: все изменения фильтров/поиска идут через `replace:true`, поэтому `Home → Catalog → Product → Back` возвращает каталог с прежним `category`/`q`/ценой (URL — источник истины). Проверено роутер-тестом (MemoryRouter): `Catalog(category=c1) → Product → Back` → чип категории и фильтр `categoryId='c1'` на месте.
- ✅ Категории — inline-фильтр (replace), а не отдельный маршрут; `Catalog → Category → Product → Back` эквивалентен.
- ✅ `focus` одноразовый: после автофокуса (переход с Home по поиску) параметр убирается из URL, чтобы возврат из товара не открывал клавиатуру повторно.
- ✅ `onOpen → /product/:id` (тест: клик по карточке товара навигирует).
- ✅ Глобальный navigation-polish (scroll restoration, transitions, focus) — отложен (`CATALOG-23`).
- ✅ Тесты: `CatalogNavigation` (+1), `CatalogView` (+1: переход в товар) — всего 531 / 84 файла.
- ✅ `typecheck`, `eslint` (0), `test`, `build` — зелёные.

### CAT-14 — Hardening `H1` ✅ выполнено
- ✅ **Last-wins / стресс быстрых действий:** тест `useStorefrontCatalog` — при быстром переключении фильтров (`A` медленный → `B` быстрый) поздний ответ `A` **не перетирает** актуальный `B`. Опора: query key = набор фильтров (React Query рендерит только активный ключ) + `keepPreviousData` (нет мерцания) + сброс курсора при смене query (CAT-05).
- ✅ **Multi-shop boundary (live):** `storefront_catalog_products_read` магазина A с `category_id` магазина B → **0 товаров**; случайный `category_id` → пусто; неизвестный `public_id` → `null`. Изоляция подтверждена (также CAT-01/02).
- ✅ **DRY-аудит:** `CatalogProductCard`/`SearchProductCard`/`FilteredProductCard` — **0**; второй калькулятор цены (`calculateCatalogPrice`/`getFilteredPrice`) — **0** (цена считается только в RPC, `0026`, единая семантика); клиентский `filter()` в `CatalogView` — **0** (bulk-loading убран). Переиспользованы `ProductCard`/`ProductGrid`/`CategoryItem`/`SearchBar`/`BottomSheet`/`SafeImage`.
- ✅ **No UI → Supabase/SQL:** `CatalogView` работает только через hook → repository → RPC.
- ✅ Тесты: `useStorefrontCatalog` (+1 last-wins) — всего 532 / 84 файла.
- ✅ `typecheck`, `eslint` (0), `test`, `build` — зелёные.

### CAT-15 — Full audit + DoD `H1` ✅ выполнено

**Архитектурный аудит** — цепочка соблюдена:
```
CatalogView → useStorefrontCatalog / useStorefrontHome / useStorefrontCatalogPriceBounds
           → StorefrontCatalogRepository (port)
           → infrastructure/repositories/storefront-catalog-repository
           → storefront_catalog_products_read / storefront_catalog_price_bounds_read (RPC)
```
Проверка: `presentation → infrastructure/insforge` импортов — **0** (нет `UI → Supabase`/SQL); `presentation → application/domain` — как задумано.

**DRY-аудит** — дублей нет:
- `CatalogProductCard`/`SearchProductCard`/`FilteredProductCard` — **0**;
- второй калькулятор цены (`calculateCatalogPrice`/`getFilteredPrice`) — **0** (цена только в RPC `0026`, семантика совпадает с Home);
- клиентский bulk-`filter()` — **0**;
- второй механизм пагинации — нет (тот же `useInfiniteQuery`/keyset, что Home);
- переиспользованы `ProductCard`/`ProductGrid`/`CategoryItem`/`SearchBar`/`BottomSheet`/`SafeImage`.

**Behaviour-аудит (live, магазин A):** категория+поиск+цена → 4; инвертированный диапазон → 0; bounds 8000–320000; пагинация без дублей/пропусков (CAT-03); чужой `category_id` магазина B → 0, неизвестный `public_id` → `null` (CAT-14); паритет цены Catalog ↔ Home (CAT-02).

**Quality gates:** `npm run typecheck` ✅ · `npm run lint` — **0 errors** (8 warnings `set-state-in-effect`/`react-refresh`, как в остальном проекте) · `npm run test` — **532 / 84** ✅ · `npm run build` ✅.

**Осталось (вне кода):** ручная визуальная проверка в браузере/Telegram на реальных данных; RLS — сознательно вне scope (гейт перед продом, `11 §S1`).

Обновлены `00` README и `16` Remaining Work.

### CAT-16 — Hardening pass (ответ на пост-аудит) `H1` ✅ выполнено

Точечный hardening после аудита (8.7/10): без смены архитектуры, только границы и UX-состояния.

- ✅ **Backend `0030_storefront_catalog_hardening.sql`** (`create or replace` поверх `0026`):
  - **PAUSED-boundary:** `storefront_catalog_products_read` → `v_empty`, `storefront_catalog_price_bounds_read` → `null` при `store.status <> 'ACTIVE'` (паритет с Home `0023`). Live: временный `PAUSED` (в самооткатывающейся транзакции) → `products=0`, `bounds=null`; магазин возвращён в `ACTIVE`.
  - **Literal search:** `%`, `_`, `\` экранируются, паттерн `... escape '\'`. Live: `p_search='%'` → 0 из 11 товаров (раньше — все).
  - Shop-boundary, курсор, clamp, price semantics, проекция — без изменений.
- ✅ **Frontend gating (defense-in-depth):** `CatalogView` передаёт `enabled = home.store.status === 'ACTIVE'` в `useStorefrontCatalog` и `useStorefrontCatalogPriceBounds`; для PAUSED запросы не уходят вовсе.
- ✅ **URL = source of truth:** `searchDraft` синхронизируется с `q` через `useEffect` (+ снятие отложенного debounce), поэтому внешняя смена `q` (back/forward, ссылка) обновляет поле; рантайм-рассинхронизация `UI ≠ URL ≠ backend` устранена.
- ✅ **Price bounds state разделены:** `loading` / `error` / `empty` в `CatalogFilterSheet`; ошибка → «Не удалось загрузить фильтр цены» + «Повторить» (`boundsError`/`refreshBounds`), а не ложное «нет цен».
- ✅ **Stale-индикатор:** `useStorefrontCatalog.updating` (`isPlaceholderData && isFetching`); при смене фильтра/поиска предыдущие товары приглушаются (`catalog-results--updating` + `aria-busy`) с лёгким спиннером — `keepPreviousData` сохранён, skeleton не подменяет экран.
- ✅ **Решение по категориям (`CAT-07c`) подтверждено: 8 карточек.** Блок — 4 колонки × 2 ряда; white-stop `catalog-sheet` (250px) рассчитан ровно под 2 ряда плиток, визуальной правки не требует (обновлён только устаревший комментарий).
- ✅ **Filter button = только цена** — решение зафиксировано (категория остаётся primary browse через плитки + «Все категории» + чип); дублирование UI не вводим.
- ✅ **Тесты (+9):** `CatalogView` (external `q` sync, ACTIVE/PAUSED enabled, stale-индикатор, bounds error/loading), `useStorefrontCatalog` (`updating`), `useStorefrontCatalogPriceBounds` (`enabled=false`), `CatalogFilterSheet` (loading/error/retry/non-round), `PriceRangeSlider` (неокруглённые minor-границы).
- ⬜ **Вне scope (сознательно):** trigram-индекс — по замеру на большом каталоге; RLS — отдельный гейт (`11 §S1`).

---

## 5. Definition of Done (Catalog не закрывается, пока не выполнено)

### Backend
- [x] server-side catalog read-model (`storefront_catalog_products_read`);
- [x] search server-side;
- [x] category server-side;
- [x] price server-side;
- [x] актуальная effective purchase price (одна семантика с Home);
- [x] deterministic ordering `created_at desc, id desc`;
- [x] keyset pagination + clamp limit;
- [x] правильный shop boundary (multi-shop safe);
- [x] active-only entities;
- [x] корректные indexes (существующих достаточно; `0026` без новых индексов);
- [x] price semantics verified (card price == filter price).

### Application
- [x] `StorefrontCatalogQuery`;
- [x] `StorefrontCatalogProductPage`;
- [x] repository + mapper;
- [x] hook `useStorefrontCatalog`;
- [x] React Query + query key (+ `keepPreviousData`);
- [x] cursor reset при изменении query.

### UI
- [x] быстрые категории (8 карточек как на Home) + стрелка «Все категории»;
- [x] All Categories sheet;
- [x] Search (debounce 300ms, мгновенная очистка);
- [x] Filter button (активное состояние);
- [x] price range slider (store-wide bounds);
- [x] applied filter chips;
- [x] `ProductGrid` + существующий `ProductCard`;
- [x] infinite loading;
- [x] skeletons;
- [x] empty states (поиск/цена/категория/пусто);
- [x] error states (initial / next-page раздельно).

### Navigation
- [x] Home → Catalog;
- [x] Home category → Catalog filtered;
- [x] All Categories → Catalog filtered;
- [x] Catalog → Product;
- [x] Back (query preserved);
- [x] query preserved (роутер-тест).

### Quality
- [x] no mocks (в рантайме);
- [x] no duplicated product card;
- [x] no client-side bulk loading;
- [x] no business logic in View;
- [x] no duplicate price calculation;
- [x] no unnecessary new mechanism;
- [x] `npm run typecheck`;
- [x] `npm run lint` (0 errors);
- [x] `npm run test` (зелёный);
- [x] `npm run build`;
- [ ] Telegram real-data test (`TELEGRAM VERIFIED`) — ручная проверка в Mini App (в терминале недоступна).

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
