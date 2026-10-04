# SHOPPIS — BUYER HOME / STOREFRONT HARDENING AUDIT

**Version:** 1.0
**Дата:** 2026-10-04
**Репозиторий:** `forantigravityyesser/Shoppis`
**Базовый срез кода:** `main @ 21a6aa9` («Buyer storefront UI/UX ready: home cards + catalog tab logic») + рабочее дерево (Product Detail / Reviews в процессе, отдельный трек).
**Объект:** вкладка **Главная** покупателя, storefront read layer, buyer state, изображения, публичный резолв магазина, производительность Home.
**Вне области:** Каталог (прототип, не считается реализованным), Product Detail (параллельная независимая разработка), кабинет продавца.

**Связанные документы:** `02` (Product Spec), `03` (Domain & Database Spec), `04` (Technical Spec), `08` (Divergence), `11` (Hardening Backlog), `13` (Buyer Home Plan — продуктовое+техническое направление), `14` (Product Detail Plan).

**Статус документа:** authoritative для hardening-захода Home. Он **уточняет и в части переопределяет** `13` там, где старые решения больше не действуют. Полный список переопределений — §2.0 и Приложение C.

---

## 0. Метод и легенда

Документ построен в два движения:

1. **Разбор** — сверка каждого тезиса аудита с фактическим кодом на базовом срезе. Аудит писался по памяти/по более раннему состоянию, поэтому часть пунктов уже сделана, часть сформулирована неточно, а часть действительно остаётся работой. Разбор — §2.
2. **Идея** — зафиксированная целевая модель и порядок hardening — §3–§13.

Легенда статуса:

| Метка | Значение |
|---|---|
| ✅ | Реализовано в коде и проверено (указан файл/строка) |
| 🟡 | Частично: часть уже есть, часть остаётся |
| ❌ | Не реализовано |
| 🔄 | Решение меняется относительно `13` (переопределение) |

Severity hardening: **H1** обязательно · **H2** высоко · **H3** средне · **H4** косметика.

---

## 1. Финальный вердикт

Аудит даёт следующую оценку (сохранена как позиция аудитора; в скобках — уточнение по коду):

| Область | Оценка |
|---|---|
| Общая архитектура | 8.5/10 |
| Onion / Clean Architecture | 8.5/10 |
| Storefront read layer | 8/10 |
| Структура Home | 8.5/10 |
| Типизация / contracts | 8.5/10 |
| Тестируемость | 9/10 |
| Чистота кода | 8/10 |
| Безопасность public data boundary | 6.5–7/10 |
| Производительность Home | 7/10 |
| Потенциал масштабирования | 8/10 |

**Главное:**

- Переписывать архитектуру **не надо**. Onion/Clean-ориентированная структура уже есть и работает:
  ```text
  Presentation → Application → Ports/Contracts → Infrastructure → InsForge / Telegram / Storage
  ```
  Composition root существует (`src/composition-root.ts`, `src/application/composition/container.ts`) и выполняет свою задачу.
- Это **не «великий рефакторинг»**, а точечный **hardening Home**.
- Две реальные проблемы, которые надо закрыть:
  1. **Public data boundary** — резолв магазина для покупателя тянет `select('*')` (утечка `owner_user_id` / `owner_telegram_id` и private-полей). §4.
  2. **Модель загрузки товаров Home** — сейчас «все товары → `slice(0, 6)`»; нужен progressive/cursor-stream. §5.
- Одна семантическая ошибка: **верхний правый аватар** привязан к продавцу/магазину, а должен быть аккаунтом покупателя. §3.3.
- Мелкая чистка: семантика `ProductCard`, generic image-initial helper, удаление `originalPrice` из Home.

---

## 2. Разбор аудита против кода

### 2.0 Переопределения относительно `13`

| Тема | Было в `13` | Стало (этот документ) | Обоснование |
|---|---|---|---|
| Аватар в хедере | `sellerAvatarUrl` продавца (`13 §5`) | аватар **покупателя**: `serverUser.photoUrl`, fallback `serverUser.firstName` | Верхний правый ведёт в профиль покупателя; смешение seller/buyer identity — семантическая ошибка |
| Pause-шапка | `sellerAvatarUrl` (`13 §15`) | публичный **логотип магазина** (`logoUrl`), fallback первая буква названия | Seller Telegram identity не является частью buyer storefront |
| Товары Home | фикс. 6–8 (`13 §2`, `H-07`) | progressive stream + cursor pagination | 6 жёстко ограничивает Home; все сразу — убивает производительность |
| Цена на карточке Home | текущая + зачёркнутая original (`13 §9-10`) | только **effective price**; `originalPrice` убрать из Home read-model | Детали скидки — в Product Detail; меньше payload |
| `StorefrontHome` | `{store, categories, products}` одним объектом | split: `HomeContext {store, categories}` + `HomeProductPage {products, nextCursor}` | Малое/статичное отдельно от большого/пагинируемого |
| Нижняя навигация | сердце — крупный особый центральный элемент (`13 §3`) | 5 равнозначных вкладок | Docs → факт. Текущий `FloatingNavBar` уже без особого размера |
| `originalPrice` в модели | присутствует (`13 §19`) | удалить из Home | См. выше |

Переопределения синхронизированы кросс-ссылкой в `13` (Приложение C).

### 2.1 Ревизия тезисов аудита

| № | Тезис аудита | Статус | Факт в коде |
|---|---|---|---|
| A | `loadBuyerStore → fetchStoreByPublicId → select('*')` | ✅ подтверждён | `src/application/store/slices/auth-slice.ts:181-188`; `src/infrastructure/repositories/store-repository.ts:59-69` |
| B | Buyer никогда не должен получать `owner_user_id` / `owner_telegram_id` | ✅ подтверждён | `StoreRow` содержит оба поля (`store-repository.ts:11-26`); buyer кладёт их в `viewedStore` |
| C | Legacy `fetchStore(publicId)` fallback | ✅ подтверждён | `auth-slice.ts:182-188`; `store-repository.ts:47-56` |
| D | Home читает данные одним RPC | ✅ уже так | `storefront-repository.ts:12` → `storefront_home_read` (`migrations/0014`) |
| E | Хедер получает `sellerAvatarUrl` | ✅ подтверждён | `HomeHeader.tsx:5,15,36-42`; прокинут из `HomeView.tsx:50,60` |
| F | Fallback — первая буква **названия магазина** | ✅ подтверждён | `HomeHeader.tsx:40` → `sellerAvatarInitial(storeName)` |
| G | Pause получает `sellerAvatarUrl` | ✅ подтверждён | `StoreStatusView.tsx:8,18-23,40-46`; `HomeView.tsx:47-53`; `CatalogView.tsx:64-73` |
| H | Home показывает фикс. 6 товаров | 🟡 частично | SQL отдаёт **все** ACTIVE-товары без `LIMIT` (`0014` строки 99-115); клиент режет `slice(0, 6)` (`ProductSection.tsx:5,33`) |
| I | Cursor pagination | ❌ нет | `useStorefrontHome` — одиночный `useQuery` (`useStorefrontHome.ts:22`) |
| J | IntersectionObserver | ❌ нет | grep: отсутствует в buyer |
| K | `StorefrontHome` — один объект | ✅ подтверждён | `read-models/storefront.ts:8-12` |
| L | `ProductCard` = `article role=button` + вложенный `button` | ✅ подтверждён | `ProductCard.tsx:35-42` (`role="button"`) + `:60` `<FavoriteButton/>` (`FavoriteButton.tsx:17`) |
| M | `originalPrice` в Home read-model | ✅ присутствует | `storefront.ts:42-43`; SQL `0014:108-109`; mapper `storefront-mappers.ts:65`; тесты |
| N | `originalPrice` **отображается** на карточке | ❌ не отображается | `ProductCard.tsx` его не деструктурирует; тест прямо проверяет отсутствие (`ProductCard.test.tsx:39`) |
| O | `sellerAvatarInitial(title)` как placeholder товара | ✅ подтверждён | `ProductCard.tsx:55` |
| P | Уведомления убраны из UI | ✅ подтверждено | Нет bell/экрана/ленты; остаётся только инфраструктурный opt-in (`order-slice.requestNotifications`, `notification-api.ts`, `settings-slice.ts`) |
| Q | Нижняя навигация — 5 равных вкладок | ✅ уже так | `FloatingNavBar.tsx:7-13,40`; `BottomNavBar` без особого размера. **Docs `13 §3` устарел** |
| R | Favorites — store-scoped | ✅ уже так | `favorites-slice.ts:16-25` (`favoritesByStore[storeId]`) |
| S | Каталог — клиентский прототип | ✅ подтверждён | `CatalogView.tsx:35-43` — `useMemo` filter по `home.products` |
| T | Pause — не только frontend, есть серверный инвариант | ✅ уже есть | `migrations/0004_checkout.sql:77` `raise exception 'STORE_PAUSED'`; также `0017:51` |
| U | Image pipeline: thumb на Home, full на Detail | ✅ уже так | `0014:64-69` (thumb→full); `0010_product_image_thumb.sql` |
| V | React Query `useInfiniteQuery` | ❌ нет | `useQuery`, staleTime 5 мин, retry 1 (`queryClient.ts:7-10`) |
| W | Cold start делает 2 запроса | ✅ подтверждён | `loadBuyerStore` (резолв) + `storefront_home_read`; зафиксировано в `08 §1.14` как S3-остаток |

**Вывод разбора:** архитектуру трогать не нужно; из «проблем аудита» уже закрыты D, P, Q, R, T, U. Реальная работа — E–G (avatar), A–C (boundary), H–K/V (pagination stream), L–O (семантика/чистка), плюс документация.

### 2.2 Точная граница проблемы `select('*')`

Аудит прав по сути, но неточен по месту:

- **Данные витрины** (store/categories/products) уже приходят **минимальной проекцией** через RPC `storefront_home_read` — это корректно.
- **Резолв магазина** (`viewedStore`, `storeId`) идёт **отдельным** `select('*')` в `fetchStoreByPublicId` и кладёт в buyer-state полный `Store` (`ownerUserId`, `ownerTelegramId`, `language`, `createdAt`, `logoUrl`, `supportHandle`, …).
- Именно этот путь и надо заменить на public resolver с минимальной проекцией. `storefront_home_read` уже возвращает подмножество store — целевую модель см. §4.

### 2.3 Почему `originalPrice` в модели, но не на карточке

Это уже «полу-удалённое» поле: SQL считает его, mapper прокидывает, read-model хранит, но `ProductCard` не рендерит (тест `ProductCard.test.tsx:39`). Аудит предлагает довести удаление до конца — из SQL, mapper, read-model, тестов и docs. Это уменьшает payload и снимает двусмысленность «Home показывает скидку или нет».

---

## 3. Authoritative product spec (Home)

### 3.1 Что такое Home

> **Home — не место, где пользователь ищет всё. Home — место, где пользователь хочет посмотреть магазин.**

```text
завлекает → показывает магазин → вызывает желание открыть товар → ведёт в Каталог → ведёт в Product Detail
```

Home **не** является полным каталогом. На Home:

- Header
- Banner
- Categories
- Product stream
- Bottom navigation

**Без:** notifications, filters, sorting, full search, all-products-immediately, тяжёлого product detail, recommendations.

### 3.2 Уведомления — окончательно вне UI

Внутри приложения нет и не должно быть:

❌ Bell · ❌ Notification center · ❌ Notification screen · ❌ Unread badge · ❌ Notification feed · ❌ `buyer_notifications` как UI-лента.

Остаётся только Telegram-канал:

```text
Order created / Order status changed → Telegram Bot → buyer notification
```

Инфраструктурный `telegram_identities.notifications_enabled` (миграция `0013`, `notifications-actions`) сохраняется — это разрешение/возможность Telegram-уведомлений, а не внутренняя лента. В коде Home это уже сделано правильно (`P`).

### 3.3 Аватар — семантика покупателя 🔄

Окончательное решение: **верхний правый профиль Home — это текущий Telegram-аккаунт покупателя.**

```text
serverUser.photoUrl
   ↓ есть
фото покупателя

serverUser.photoUrl пуст
   ↓
serverUser.firstName → первая буква (generic helper getInitial)
```

Целевой вызов:

```tsx
<HomeHeader
  storeName={home.store.name}
  buyerAvatarUrl={serverUser?.photoUrl ?? null}
  buyerName={serverUser?.firstName ?? ''}
  onSearch={...}
  onProfile={...}
/>
```

`serverUser.photoUrl` уже есть в контракте (`application/contracts/auth.ts:9`), заполняется на auth.

**Следствие:** `sellerAvatarUrl` больше не нужен в buyer storefront, если нигде реально не используется. После перевода pause-экрана на логотип (§3.4) — удалить из `StorefrontStore`, SQL-проекции, mapper и docs.

Разделение понятий:

```text
StorefrontStore → публичные данные магазина (name, logoUrl, bannerUrl, status, supportHandle, currency)
ServerUser      → данные текущего покупателя (photoUrl, firstName)
```

### 3.4 Pause-экран

Для `PAUSED` показываем:

- название магазина;
- **логотип магазина**, если задан (`logoUrl` — публичный storefront asset);
- публичный контакт продавца (`supportHandle`), если задан;
- сообщение:
  > Магазин временно закрыт. Сейчас заказы в этом магазине недоступны. Попробуйте зайти позже.

Telegram-идентичность продавца (его `photo_url`) **не** является частью buyer storefront — это одновременно правильнее, безопаснее, чище и меньше public data.

### 3.5 Sold out

```text
Product ACTIVE + все active variants = 0 → товар остаётся на Home.
```

Карточка: бейдж «Нет в наличии». В Product Detail: варианты недоступны, CTA disabled. Из каталога товар не исчезает.

### 3.6 Категории — три состояния

| Состояние | Buyer UI |
|---|---|
| Category ACTIVE | показывается (carousel) |
| Category ARCHIVED | категория исчезает из buyer UI; товары не удаляются и попадают в «Все» (`categoryId = null` в проекции) |
| Category DELETED | `product.category_id = null` (в БД), товар в «Все» |

`product.category_id` при архивации категории **не мутируется**; видимость вычисляется в storefront-проекции. Возврат `ARCHIVED → ACTIVE` не требует ручного восстановления.

### 3.7 Archived product

```text
product.status = ARCHIVED → не Home, не Catalog.
```

Остаётся только в seller/order исторических контекстах. Возврат в `ACTIVE` возвращает товар на витрину.

### 3.8 Pause — это и backend-инвариант

Даже если клиент остался на старой странице:

```text
POST create order → backend проверяет store.status → reject STORE_PAUSED
```

Уже реализовано (`0004_checkout.sql:77`). Frontend-гейт на Home и Catalog (`StoreStatusView`) — в дополнение, не вместо.

### 3.9 Цена на карточке — окончательно

Home card — **только** конечная effective price:

```text
2 490 ₽
```

Без оригинала и без процента. Product Detail — там уже `3 490 ₽ / 2 490 ₽ / −29%`, если применимо.

Effective price по-прежнему:

```text
first ACTIVE variant:
  price_mode = CUSTOM_PRICE and custom set → custom
  иначе → product price
```

### 3.10 Нижняя навигация 🔄

Решение меняется относительно прошлого аудита: **реализацию не трогаем**.

Факт (`FloatingNavBar.tsx:7-13`): `Главная · Каталог · Избранное · Заказы · Корзина` — пять равнозначных вкладок. Особого «сердца по центру» в коде нет. **Документацию приводим к фактической реализации** (`13 §3` устарел), а не наоборот.

### 3.11 Избранное

Фундамент оставляем как есть: `favoritesByStore` + `Zustand persist`, store-scoped. Отдельную БД favorites сейчас не создаём (`08 §2.2` — отдельная будущая задача).

---

## 4. Public data boundary

### 4.1 Контракт `PublicStoreContext`

Вместо полного `Store` в buyer-state:

```ts
interface PublicStoreContext {
  id: string;
  publicId: string;
  name: string;
  status: StoreStatus;          // 'ACTIVE' | 'PAUSED'
  supportHandle: string | null; // публичный контакт продавца
  logoUrl: string | null;       // публичный логотип (в т.ч. для pause)
}
```

`bannerUrl` и валюта в контекст **не** входят — они приходят из `storefront_home_read` и в резолвере были бы дублированием payload.

Buyer flow **никогда** не получает:

```text
owner_user_id
owner_telegram_id
private seller data (description/language/created_at, если не нужно витрине)
```

### 4.2 Резолвер

Вместо `select('*')` — минимальная публичная проекция через RPC (та же граница, что и `storefront_home_read`, и будущая граница RLS — `08 §1.9`):

```sql
storefront_public_context_read(p_store_ref text) → jsonb
```

`p_store_ref` — канонически opaque `public_id`. Внутри резолвера допущен fallback по внутреннему id (legacy). Категории могут идти вместе с context-read (малые, редко меняются). Товары — отдельным потоком (§5).

### 4.3 Legacy fallback

`fetchStoreByPublicId → (нет) → fetchStore(publicId)` — временная совместимость со старыми `store_<internalId>` ссылками.

- Канон: `shop_<public_id>` → `public_id` → `PublicStoreContext`.
- Legacy `store_<internalId>` резолвится тем же публичным RPC по внутреннему id (`id = p_store_ref::uuid`), невалидный uuid трактуется как «не найдено».
- Legacy-ветка допускается только для чтения старых ссылок и **позже удаляется** (`08 §2.12`).
- Legacy-резолв тоже возвращает **минимальную** проекцию, а не `select('*')`.

**Реализовано (HOME-HARDEN-01):** миграция `0021_storefront_public_context.sql`; read-model `application/read-models/public-store.ts`; mapper `mapPublicStoreContext`; порт/инфра `StorefrontRepository.loadPublicStoreContext`; `loadBuyerStore` переведён с `select('*')` на резолвер; `viewedStore: PublicStoreContext`.

### 4.4 Что меняется в состоянии

```text
viewedStore: Store | null      →   viewedStore: PublicStoreContext | null
storeId     используется для favorites/cart/catalog scope (см. §9)
```

`supportHandle` (сейчас берётся из полного `Store`) переезжает в `PublicStoreContext`.

---

## 5. Home product stream — progressive loading

### 5.1 Почему не 6 и не «все»

- **Фикс. 6/8** (текущее) — жёстко ограничивает Home у магазина с 300 товарами; порядок пока не контролирует продавец.
- **Все сразу** — 500 товаров = 500 карточек, 500 URL, 500 запросов изображений при открытии Home. Убивает ощущение быстрого приложения.

Третий вариант:

### 5.2 Progressive Product Loading

```text
Home → маленькая первая порция → скролл → автодогрузка → скролл → …
```

Без кнопки «Загрузить ещё».

**Важно:** не делать буквальный «запрос +2». Разделяем:

- что **видит** пользователь: ~2 карточки в первом viewport;
- что **получает** network: страница **4–6** карточек (буфер), чтобы скролл не упирался в сеть.

Backend не привязываем к числу «2» — это только оптимизация размера начальной страницы (`limit` выбирается, например, 6).

### 5.3 Cursor pagination

Не `offset`, а cursor — устойчиво к вставкам и дешевле на масштабе:

```json
{ "products": [ ... ], "nextCursor": "..." }
```

Порядок **deterministic**. Пока продавец не управляет порядком:

```text
created_at DESC, id DESC
```

`display_order` / merchandising — отдельная будущая feature.

### 5.4 IntersectionObserver

Не `window.addEventListener('scroll', …)` и не вычисление на каждый scroll event. Sentinel в конце `ProductGrid`:

```text
ProductGrid → sentinel → IntersectionObserver → fetchNextPage()
```

`rootMargin ≈ 600px` — запрос следующей страницы начинается до реального достижения конца. Ощущение: «листаю — товары появляются сами».

**Выполнено (HARDEN-06):** `useInfiniteScrollSentinel` (presentation-hook) — `IntersectionObserver`, `rootMargin = 600px`, без scroll-listener; sentinel в конце потока Home + индикатор `fetchingNextPage`. При `enabled=false` (нет страниц / идёт загрузка) observer снимается.

### 5.5 Без request waterfall

Защита `isFetchingNextPage`:

```text
next page request → loading → повторные запросы игнорируются → page appended
```

Никаких 4 одинаковых запросов на серию scroll-событий.

### 5.6 Split read-model

```ts
// статичный контекст (малое, редко меняется)
interface StorefrontHome {
  store: StorefrontStore;
  categories: StorefrontCategory[];
}

// поток товаров (большое, пагинируется)
interface StorefrontHomeProductPage {
  products: StorefrontProductCard[];
  nextCursor: string | null;
}
```

### 5.7 React Query

`useInfiniteQuery` (или application-adapter поверх него):

```text
page 1 → render → near bottom → page 2 → append → near bottom → page 3 → …
```

Prefetch — **не более одной** страницы вперёд; `rootMargin ≈ 400–800px`. Не «prefetch 10 pages».

**Выполнено (HARDEN-05):** `useStorefrontHomeProducts` на `useInfiniteQuery`; `loadMore` защищён in-flight ref, `products` дедуплицируются по id; наружу — `hasNextPage`, `fetchingNextPage`, `nextCursor`. UI-триггер (sentinel) — HARDEN-06.

### 5.8 Целевой flow

```text
Home open
   ├── Public Store Context (+ categories)
   └── Products Page #1
            ↓
        ProductGrid
            ↓
   IntersectionObserver
            ↓
      Products Page #2 → append → …
```

---

## 6. Backend design

### 6.1 RPC

```text
storefront_public_context_read(store_ref)               -- минимальный резолв магазина (без owner)
storefront_home_context_read(public_id)                 -- store + активные категории
storefront_home_products_read(public_id, cursor, limit) -- товарный поток, keyset-курсор
```

Категории идут с context-read (малые, редко меняются); товары — отдельным потоком с курсором.

### 6.2 Будущий Catalog (не сейчас)

```text
storefront_catalog_read(public_id, query, category, filters, sort, cursor, limit)
```

Таким образом:

```text
Home ≠ Catalog   и   Product Detail ≠ Home
```

### 6.3 Миграции

- **`0021_storefront_public_context.sql`** — `storefront_public_context_read` + grant (выполнено).
- **`0022_storefront_home_read_no_seller_avatar.sql`** — home-проекция без `sellerAvatarUrl` (выполнено).
- **`0023_storefront_home_split_read.sql`** — `storefront_home_context_read` + `storefront_home_products_read(p_public_id, p_cursor, p_limit)` с deterministic `order by (created_at, id desc)` и keyset-курсором; монолитный `storefront_home_read` удалён (выполнено).
- **`0024_home_products_keyset_index.sql`** — частичный индекс `products (store_id, created_at desc, id desc) where status='ACTIVE'` для O(page) keyset-пагинации (выполнено). Ранее существовавшая коллизия номера `0024` (`0024_product_link.sql`, Product Detail) устранена переименованием в `0025_product_link.sql` (`§17`, HOME-FIX-05).
- Обе — `security definer`, `set search_path = public`, доступ через PostgREST RPC (как `0014`).
- Возврат `originalPrice` **не включать** (§7.4).

Ключевые инварианты SQL:

- только `product.status = 'ACTIVE'`;
- продавец не виден (`owner_*` не в проекции);
- `available` = есть активный вариант с `available_quantity > 0`;
- `categoryId` = `null`, если категория не `ACTIVE`;
- image = `thumb` → fallback `full`.

---

## 7. ProductCard + image hardening

### 7.1 Семантика карточки

Проблема: `article role="button"` содержит вложенный `button` (`FavoriteButton`) — плохо для accessibility, keyboard, focus, screen readers, event handling.

Целевая структура:

```text
ProductCard (article, без role=button)
├── ProductLink / ProductOpenArea   ← единственный интерактивный «открыть товар»
│   ├── image
│   └── info (title, price)
└── FavoriteButton                  ← отдельный интерактивный элемент
```

- Heart **не** открывает Product Detail.
- Проверить: mouse, touch, keyboard (`Enter`/`Space`), heart, screen reader.

**Выполнено (HARDEN-07):** `<article>` больше не `role=button`; открытие товара — отдельный `<button aria-label={title}>` с фото и info внутри, `FavoriteButton` — соседний `<button>`. Нативная клавиатура (`Enter`/`Space`), `focus-visible`-обводка. Тесты ProductCard (+3): keyboard, heart не открывает, контейнер не кнопка.

### 7.2 Image loading

- Карточки: `loading="lazy"`, `decoding="async"`.
- Баннер: `eager` (главный visual Home).
- Обязательно сохранять aspect ratio **4:5** для товара — предотвращает layout shift.
- Home никогда не тянет full 1000×1250, если есть thumb.

**Выполнено (HARDEN-08):** размеры фиксирует CSS (banner 2.2:1, категория 68×68, товар 4:5), поэтому CLS нет; баннер — `loading="eager"`, карточки/категории — `lazy` + `decoding="async"`.

### 7.3 Image fallback — единый стандарт

```text
null URL      → placeholder
broken URL    → placeholder
slow URL      → skeleton/placeholder
success       → image
```

Никаких бесконечных повторных failed loads. `useImageFallback` — правильная основа (`useImageFallback.ts`).

**Выполнено (HARDEN-08):** единый компонент `SafeImage` (presentation/buyer) — `null`/broken → `fallback`, slow → виден контейнер-заглушка, success → изображение; `loading`/`decoding` централизованы. Мигрированы `HomeBanner`, `CategoryItem`, `ProductCard`. Смена `src` сбрасывает failed-состояние.

### 7.4 `originalPrice` — удалить из Home

Удалить из:

- `StorefrontProductCard` (`read-models/storefront.ts:42-43`);
- SQL-проекции (`0014:108-109`, и в новой `0023`);
- mapper (`storefront-mappers.ts:65`);
- тестов;
- docs.

Оставить только `price`.

**Выполнено (HARDEN-09):** `originalPrice` удалён из `StorefrontProductCard`, mapper (`mapProduct`), SQL-проекции `storefront_home_products_read` (миграция `0023`) и всех Home-фикстур/тестов. В `StorefrontProductVariant`/`StorefrontRelatedProduct` (Product Detail) поле сохранено.

### 7.5 Generic initial helper

`sellerAvatarInitial(title)` (`ProductCard.tsx:55`) — имя не соответствует смыслу. Сделать generic:

```ts
getInitial(name) // или getDisplayInitial(value)
```

Использовать для: buyer avatar fallback, category placeholder, product placeholder. `Array.from` сохраняем (не резать эмодзи/суррогатные пары).

**Выполнено (HOME-HARDEN-02):** `domain/rules/initial.ts` → `getInitial`; все прежние вызовы `sellerAvatarInitial` мигрированы.

---

## 8. Границы Home ↔ Catalog ↔ Product Detail

### 8.1 Catalog

- Сейчас — прототип (`CatalogView` + `useStorefrontHome` + клиентский filter). Как architectural final **не принимаем**.
- Будущий Catalog:
  ```text
  Catalog ├── search ├── categories ├── filters ├── sorting ├── pagination └── ProductGrid
  ```
- Всё тяжёлое — **server-side**: `query → backend → 20 products → browser`, а не `5000 products → browser → filter()`.

### 8.2 Home и Catalog — разные задачи

```text
HOME                     CATALOG
интерес                  поиск
маленький progressive    фильтрация
stream                   сортировка
                         весь ассортимент
                         pagination
```

**Home RPC нельзя превращать в универсальный Catalog API.**

### 8.3 Product Detail независим

```text
Home → productId → Product Detail (самостоятельный read-model)
```

Home не передаёт variants/inventory/attributes/reviews/Q&A/related. Detail сам получает свой read-model (`StorefrontProductDetail`, `docs/14`). Параллельная разработка не конфликтует.

---

## 9. Onion-дисциплина и `storeId`

### 9.1 Постоянное требование

Держим чистоту на протяжении всего проекта. Не допускать: God component · God hook · God repository · God service · God slice. Каждая feature раскладывается:

```text
Domain        → business rules, invariants, models
Application   → contracts, ports, read-models, mappers, use cases, orchestration
Infrastructure→ InsForge, Telegram, Storage, RPC, external API
Presentation  → views, components, UI state, animations, CSS
```

### 9.2 Application ↔ Zustand

Zustand в application store допустим. Но UI-only logic, visual behaviour, React-специфику не тащить в store — иначе он станет God object.

### 9.3 `storeId` смешивает роли

Сейчас `storeId` = seller store = buyer viewed store = favorites scope = cart scope = catalog scope.

Сценарий ошибки:

```text
User owns Store A + views Store B + buys from Store B
```

Будущее разделение — `currentSellerStoreId` / `viewedStoreId` (или `ViewedStoreContext`). **Сейчас большой рефакторинг не делать**, но новые feature не должны усиливать смешение. Для Home достаточно зафиксировать: `viewedStore.publicId` — источник для storefront-read, `viewedStore.id` — scope.

---

## 10. Производительность Home (постоянная задача)

Оптимизируем **только Home**; общий performance pass всего приложения — отдельно в конце проекта.

Проверяем на каждом этапе:

| Категория | Что смотрим |
|---|---|
| Network | response size, число запросов, дубли, cache, retry, pagination, unused fields |
| Images | bytes, thumb, lazy, decode, failed image, layout shift |
| Rendering | re-renders, remount, list keys, тяжёлые компоненты, анимации |
| UX | skeleton, first content, scroll, prefetch, navigation |

Никакой искусственной цели «100 ms». Правильно:

```text
fast network → быстро показываем
slow network → skeleton
slow image   → placeholder
large store  → не загружаем весь store
scroll       → без заметных задержек
```

Приложение должно **деградировать красиво**, а не зависать.

Профилирование — на тестовых магазинах: **10 / 100 / 500 / 1000+** товаров.

### 10.1 Результаты (HARDEN-10)

Бэкенд-замер на временном магазине **2000 товаров** (у каждого 1 вариант + inventory + thumb), затем данные удалены.

| Метрика | Значение |
|---|---|
| Страница товаров (limit 6), `storefront_home_products_read` | **0.9 ms** |
| «Голый» base-запрос страницы (limit 6) | 0.03 ms |
| Payload страницы (6 карточек) | **971 байт** (~162 B/карточку) |
| Индексный план | `Index Scan products_store_active_created_idx`, 7 строк, 3 буфера, ранний LIMIT |

Найденная и устранённая проблема: при **устаревшей статистике** (массовая вставка без `ANALYZE`) планировщик выбирал hash-join + `Seq Scan on inventory` **на каждый товар** (2000 итераций, ~50036 буферов) и сортировку всех товаров магазина на каждую страницу → **458–467 ms** на страницу. Свежий `ANALYZE` + составной частичный индекс `products_store_active_created_idx` `(store_id, created_at desc, id desc) where status='ACTIVE'` (миграция `0024`) дают O(page) вместо O(store size).

Сеть Home: **2 read-запроса** (context + первая страница товаров) + загрузка thumb-изображений браузером; N+1 отсутствует.

Осталось (ручная проверка в браузере/Telegram, недоступна в терминале): scroll FPS, память, re-render (React DevTools), размер изображений на устройстве, transitions, поведение на 10/100/500/1000+.

---

## 11. HOME-HARDEN — план этапов

Один этап за раз: реализация → `typecheck`/`lint`/`test` → ручная сверка → следующий.

### HOME-HARDEN-01 — Public Store Context `H1` ✅ выполнено
- ✅ Заменён `select('*')` в buyer-резолвере (`store-repository.ts`, `auth-slice.ts`) на `PublicStoreContext` через RPC `storefront_public_context_read` (миграция `0021`).
- ✅ `fetchStoreByPublicId` удалён; buyer-store не содержит `owner_*`/private seller data.
- ✅ Проверено на реальных данных: public_id, legacy internal id, not-found, пустой/`null` ref.
- Тесты: `loadPublicStoreContext` (+5), `mapPublicStoreContext` (+3).

### HOME-HARDEN-02 — Buyer Avatar `H1` ✅ выполнено
- ✅ `HomeHeader`: `buyerAvatarUrl` (`serverUser.photoUrl`) + `buyerName` (`serverUser.firstName`); fallback `getInitial(buyerName)`.
- ✅ `StoreStatusView`: `logoUrl` + `getInitial(storeName)`; `HomeView`/`CatalogView`/`DetailsView` передают `viewedStore.logoUrl`.
- ✅ `sellerAvatarUrl` удалён из `StorefrontStore`, обоих mappers и home-проекции (миграция `0022`).
- ✅ Generic helper: `domain/rules/seller-avatar.ts` → `domain/rules/initial.ts` (`getInitial`); мигрированы все вызовы (ProductCard, CategoryItem, ProductGallery, QuestionCard, ReviewCard, ReviewComposer).
- Тесты: photo exists / missing / firstName empty / Unicode; `initial.test` (+4), `HomeHeader` (+2).

### HOME-HARDEN-03 — Home Product Read `H1` ✅ выполнено
- ✅ Разделены read-модели: `StorefrontHome { store, categories }` + `StorefrontHomeProductPage { products, nextCursor }`.
- ✅ Зависимость «all products + `slice(0, 6)`» убрана: `ProductSection` рендерит полученную страницу, лимит задаёт сервер.
- ✅ Новые RPC `storefront_home_context_read` / `storefront_home_products_read`; порт/инфра/хук `useStorefrontHomeProducts`.

### HOME-HARDEN-04 — Cursor Pagination `H1` ✅ выполнено
- ✅ Backend: `public_id`, `p_cursor`, `p_limit`; deterministic `order by created_at desc, id desc`.
- ✅ Keyset-курсор `<epoch_microseconds>:<id>`; invalid cursor → первая страница. Проверено на реальных данных: page1/page2/last/invalid/not-found, без дублей.
- ⬜ Осталось (тест-уровень): полноценный SQL-набор тестов на бо́льших выборках (см. HARDEN-10).

### HOME-HARDEN-05 — Infinite Query `H1` ✅ выполнено
- ✅ `useInfiniteQuery`: первая страница + append следующих; `products` — объединение страниц с дедупом по id.
- ✅ `loadMore` защищён in-flight ref (нет параллельных/повторных `fetchNextPage`) + `hasNextPage`; наружу отдаётся `fetchingNextPage`.
- Тесты: first page, next page, last page, no duplicate fetch, no duplicate products, custom limit, error.
- ⬜ UI-триггер догрузки (sentinel) — HARDEN-06.

### HOME-HARDEN-06 — IntersectionObserver `H1` ✅ выполнено
- ✅ Sentinel в конце товарного потока + `rootMargin = 600px` (prefetch до достижения конца); никакого scroll-listener.
- ✅ `useInfiniteScrollSentinel` (presentation-hook); `enabled = hasNextPage && !fetchingNextPage` — цепочка «догрузил → ещё видно → догрузил» без более чем одной страницы за раз (in-flight-защита из HARDEN-05).
- ✅ Индикатор догрузки; тесты hook (+5).

### HOME-HARDEN-07 — ProductCard semantics `H2` ✅ выполнено
- ✅ Убраны `article role=button` и вложенный `button`; отдельный open-area `<button>` + соседний `FavoriteButton`.
- ✅ Проверено: клик, keyboard (`Enter`/`Space`), heart не открывает товар, контейнер не кнопка, `focus-visible`.

### HOME-HARDEN-08 — Image hardening `H2` ✅ выполнено
- ✅ `sellerAvatarInitial` → generic `getInitial` (HARDEN-02).
- ✅ Единый `SafeImage` (null/broken → fallback, без повторов); banner eager, карточки/категории lazy + async.
- ✅ Размеры через CSS (banner 2.2:1, категория 68×68, товар 4:5) → без layout shift; Home использует thumb.
- Тесты `SafeImage` (+5).

### HOME-HARDEN-09 — Remove Home originalPrice `H2` ✅ выполнено
- ✅ Удалён из read-model, SQL-проекции (`0023`, переприменена), mapper, тестов; остаётся только `price`.
- ✅ Проверено на реальных данных: карточка отдаёт `id/title/categoryId/imageUrl/price/available`.

### HOME-HARDEN-10 — Performance profiling `H2` 🟡
- ✅ Бэкенд-замер на 2000 товарах: страница 0.9 ms, payload 971 B, keyset-индекс (миграция `0024`) — см. §10.1.
- ✅ N+1 нет: Home делает 2 read-запроса (context + страница товаров).
- ⬜ Ручная проверка браузер/Telegram: scroll FPS, memory, re-render, image bytes, transitions (в терминале недоступно).

### HOME-HARDEN-11 — Documentation sync `H1` ✅ выполнено
- ✅ `13` синхронизирован: §1/§2/§3 (5 равных вкладок), §5 (buyer avatar + pause logo), §9-10 (только effective price), §19 (split-модель), §20-21 (split-RPC), §28 (статус + H-07), Приложения C/D.
- ✅ Версия `13` → 0.5; вверху — актуализация, ссылающаяся на `15`.
- ✅ Финализирован `15` (этот документ): §16 — финальный Home audit.
- ✅ Синхронизированы `02`/`03`/`04`/`05` (buyer-home факты) и `00` README.

### Рекомендуемый порядок

```text
01 Public Store Resolver
 ↓
02 Buyer Avatar
 ↓
03 Home Product Pagination
 ↓
04 Cursor Pagination
 ↓
05 Infinite Query
 ↓
06 IntersectionObserver
 ↓
07 ProductCard semantics
 ↓
08 Image hardening
 ↓
09 Remove Home originalPrice
 ↓
10 Performance profiling
 ↓
11 Documentation sync
 ↓
Финальный Home audit
```

После этих шагов Home не трогать без необходимости — это база, поверх которой накладываются Catalog, Product Detail, Favorites, Orders, Cart.

---

## 12. Матрица тестов

**Backend**
active product · archived product · sold out · active category · archived category · deleted category · paused store · unknown store · cursor · last page · empty.

**Home**
loading · error · empty · paused · not found · pagination · append · retry.

**Avatar**
photo · no photo · first name · empty name · Unicode.

**Images**
valid · null · 404 · slow · changed src.

**ProductCard**
open · favorite · sold out · keyboard.

---

## 13. Definition of Done (каждый этап)

- [ ] Domain types актуальны
- [ ] Application contract актуален
- [ ] Port актуален
- [ ] Infrastructure актуальна
- [ ] Mapper актуален
- [ ] SQL migration при необходимости
- [ ] Tests
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test` (зелёный suite — постоянное требование)
- [ ] browser verification (LOCAL VERIFIED)
- [ ] Telegram Mini App verification (TELEGRAM VERIFIED)
- [ ] документация
- [ ] нет unrelated refactor
- [ ] нет новых архитектурных нарушений

---

## 14. Что НЕ делаем сейчас

❌ переписывать Zustand · ❌ переписывать DI · ❌ переписывать Onion · ❌ Redux · ❌ GraphQL · ❌ microservices · ❌ backend favorites · ❌ проектировать весь Catalog · ❌ in-app notifications · ❌ recommendations · ❌ AI · ❌ filters на Home · ❌ sorting на Home · ❌ загружать весь каталог · ❌ запрос на каждый «+2» · ❌ full-size images на Home.

---

## 15. Целевая архитектура

### 15.1 Home

```text
                    TELEGRAM
                        │
                        ▼
                  authenticate
                        │
                        ▼
                    ServerUser
                    /        \
            photoUrl/name      session
                 │
                 ▼
            Home Header

public_id
    │
    ▼
Public Store Context (+ categories)
    │
    ├──────────────┐
    ▼              ▼
Categories     Products Page #1
                    │
                    ▼
                ProductGrid
                    │
                    ▼
           IntersectionObserver
                    │
                    ▼
              Products Page #2 → append → …
```

### 15.2 Вся buyer-архитектура

```text
                         BUYER
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
       HOME             CATALOG          PRODUCT DETAIL
        │                  │                  │
  attraction          discovery           decision
        │             search/filter           │
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                         CART
                           │
                         ORDER
```

Переходы:

```text
Home
 ├── Search → Catalog + focus
 ├── Categories → Catalog(category)
 ├── View all → Catalog
 └── Product → Product Detail
```

### 15.3 Масштабирование

Home не мыслится как «покажем 6 товаров», а как:

> «Покажем небольшой initial viewport и будем незаметно доставлять следующий контент только тогда, когда он становится нужен».

```text
10 товаров   → легко
100 товаров  → легко
500 товаров  → initial Home всё ещё лёгкая
5000 товаров → Home не получает 5000 товаров
```

---

## 16. Финальный Home audit (HOME-HARDEN-11)

**Статус hardening:** HOME-HARDEN-01…11 выполнены (кроме явно отмеченных ручных проверок в браузере/Telegram).

| Этап | Что сделано | Артефакты |
|---|---|---|
| 01 Public Store Context | `select('*')` → минимальный resolver | `0021`, `PublicStoreContext`, `loadPublicStoreContext` |
| 02 Buyer Avatar | аватар покупателя + pause logo; `sellerAvatarUrl` удалён | `0022`, `HomeHeader`, `initial.ts` |
| 03 Home Product Read | split `StorefrontHome` + `StorefrontHomeProductPage` | `0023`, `useStorefrontHomeProducts` |
| 04 Cursor Pagination | keyset `(created_at desc, id desc)` | `0023`, проверено на данных |
| 05 Infinite Query | `useInfiniteQuery` + in-flight guard + дедуп | `useStorefrontHomeProducts` |
| 06 IntersectionObserver | sentinel + `rootMargin=600px` | `useInfiniteScrollSentinel` |
| 07 ProductCard semantics | open-area `<button>` + соседний heart | `ProductCard` |
| 08 Image hardening | единый `SafeImage` (fallback/lazy/eager) | `SafeImage` |
| 09 Remove originalPrice | только effective price | `0023`/mapper/read-model |
| 10 Performance | keyset-индекс; замер 0.9 ms / 2000 товаров | `0024`, §10.1 |
| 11 Documentation sync | `13`/`15`/`00`/`02`/`03`/`04`/`05` | этот документ |

**Итоговая оценка (после hardening):**

| Область | Было | Стало |
|---|---|---|
| Безопасность public data boundary | 6.5–7 | ~9 (buyer не получает owner/private) |
| Производительность Home | 7 | ~9 (0.9 ms/страница, keyset-индекс, 2 запроса) |
| Потенциал масштабирования | 8 | ~9.5 (O(page), progressive stream) |
| Чистота кода / семантика | 8 | ~9 (`SafeImage`, корректный `ProductCard`) |

**Осталось (ручное, вне терминала):** browser/Telegram verification — Home render, прогрессивная догрузка по скроллу, изображения (null/broken/slow), pause-экран, отсутствие layout shift, scroll FPS/память/re-render.

**Home считается hardened** — дальше на неё можно накладывать Catalog (server-side search/filter/sort/pagination) и Product Detail (параллельный трек) без переписывания.

---

## Приложение A. Карта кода (buyer home / storefront)

| Слой | Файл | Роль |
|---|---|---|
| Presentation | `src/presentation/buyer/views/HomeView.tsx` | оркестрация Home, статус-гейт |
| Presentation | `src/presentation/buyer/components/HomeHeader.tsx` | шапка (store name + search + avatar) |
| Presentation | `src/presentation/buyer/components/HomeBanner.tsx` | единственный баннер |
| Presentation | `src/presentation/buyer/components/CategorySection.tsx` / `CategoryItem.tsx` | категории-карусель |
| Presentation | `src/presentation/buyer/components/ProductSection.tsx` | секция «Товары» (рендерит полученную страницу потока) |
| Presentation | `src/presentation/buyer/components/ProductGrid.tsx` / `ProductCard.tsx` / `FavoriteButton.tsx` | сетка/карточка/сердце |
| Presentation | `src/presentation/buyer/components/StoreStatusView.tsx` | notFound / paused |
| Presentation | `src/presentation/buyer/components/HomeSkeleton.tsx` | skeleton |
| Presentation | `src/presentation/buyer/components/SafeImage.tsx` | единый стандарт изображений (fallback/lazy/eager) |
| Presentation | `src/presentation/buyer/hooks/useImageFallback.ts` | fallback изображений |
| Presentation | `src/presentation/buyer/hooks/useInfiniteScrollSentinel.ts` | IntersectionObserver-триггер догрузки |
| Presentation | `src/presentation/buyer/views/CatalogView.tsx` | прототип каталога (клиентский filter) |
| Presentation | `src/presentation/shared/components/FloatingNavBar.tsx` / `BottomNavBar.tsx` | нижняя навигация |
| Application | `src/application/hooks/useStorefrontHome.ts` | `useQuery` контекста витрины (store + категории) |
| Application | `src/application/hooks/useStorefrontHomeProducts.ts` | `useQuery` первой страницы товарного потока (HARDEN-05 → infinite) |
| Application | `src/application/read-models/storefront.ts` | `StorefrontHome` (контекст) + `StorefrontHomeProductPage` |
| Application | `src/application/mappers/storefront-mappers.ts` | jsonb → read-model |
| Application | `src/application/ports/storefront-repository.ts` | порт |
| Application | `src/application/store/slices/auth-slice.ts` | `loadBuyerStore`, `viewedStore`, `serverUser` |
| Application | `src/application/store/slices/favorites-slice.ts` | favorites store-scoped |
| Domain | `src/domain/rules/initial.ts` | generic fallback-инициал `getInitial` |
| Domain | `src/domain/models/store.ts` | `Store` (в buyer-boundary заменяется на `PublicStoreContext`) |
| Infrastructure | `src/infrastructure/repositories/storefront-repository.ts` | RPC `storefront_home_context_read` / `storefront_home_products_read` / `storefront_public_context_read` |
| Infrastructure | `src/infrastructure/repositories/store-repository.ts` | `select('*')` — источник проблемы §4 |
| Infrastructure | `src/infrastructure/functions/notification-api.ts` | инфраструктурный opt-in (не UI-лента) |
| DB | `migrations/0023_storefront_home_split_read.sql` | split-чтение Home (context + products, cursor); заменил `0014` |
| DB | `migrations/0024_home_products_keyset_index.sql` | keyset-индекс для O(page) пагинации товаров |
| DB | `migrations/0004_checkout.sql:77` | серверный `STORE_PAUSED` |

---

## Приложение B. Зафиксированные решения

1. Home — витрина, не каталог.
2. Уведомления — только Telegram Bot; UI-ленты нет.
3. Верхний правый профиль — покупатель (`serverUser`), не продавец.
4. Pause-шапка — логотип магазина, не Telegram-аватар продавца.
5. Buyer storefront не получает `owner_*` и private seller data.
6. Товары Home — progressive + cursor, а не фикс. 6 и не «все сразу».
7. Порядок товаров — deterministic (`created_at DESC, id DESC`) до merchandising.
8. Один prefetch вперёд; `IntersectionObserver` с `rootMargin`.
9. Цена карточки Home — только effective; `originalPrice` удаляется.
10. Sold out — карточка остаётся.
11. Archived product — скрыт; archived/deleted category — `categoryId = null`, товар в «Все».
12. Pause — frontend-экран + backend `STORE_PAUSED`.
13. 5 равнозначных вкладок нижней навигации.
14. Favorites — store-scoped в Zustand persist.
15. Catalog — отдельная будущая feature; Home RPC не превращается в Catalog API.
16. Product Detail — независимый read-model.
17. Onion-дисциплина — постоянное требование.
18. Home performance — постоянная задача; деградация должна быть красивой.

---

## Приложение C. Связь с другими документами

| Документ | Как связан |
|---|---|
| `13_BUYER_HOME_PLAN` | Продуктовое направление. Этот документ **переопределяет** §3 (heart), §5 (seller avatar), §9-10 (originalPrice), §19 (модель), §28 H-07 (фикс. 6). Добавлена кросс-ссылка. |
| `14_PRODUCT_DETAIL_PLAN` | Независимый трек. Home передаёт только `productId`. |
| `08_DIVERGENCE` | §1.9 (RLS) — public resolver станет границей; §1.14-остаток (2 запроса на холодном старте) закрывается через context-read; §2.2 (favorites в БД) — не сейчас. |
| `11_HARDENING_BACKLOG` | Общий backlog; этот документ — детализация Home-части. |
| `02`, `03`, `04` | Продукт/данные/инфраструктура; при расхождении — этот документ для Home. |

---

## Итог

- **Архитектура** — оставляем.
- **Onion** — оставляем и соблюдаем дисциплинированно.
- **Home UI** — в основном готова.
- **Home business logic** — нужен hardening.
- **Главная техническая задача** — progressive/cursor product loading вместо `all products → slice(6)`.
- **Главная security/architecture задача** — убрать `select('*')` из public buyer store resolver.
- **Главная semantic ошибка** — buyer avatar отвязать от seller/store и взять из `serverUser.photoUrl` / `firstName`.
- **Мелкая чистка** — `ProductCard` semantics + generic image helper + убрать `originalPrice` из Home.
- **Catalog** — не трогаем как готовую feature; проектируем отдельно после Home hardening.
- **Product Detail** — продолжается параллельно.
- **Performance** — оптимизируем сейчас только Home; общий pass — в конце проекта.

---

## 17. Post-hardening fixes (HOME-FIX-01…05)

Точечный ревью Home после финализации hardening (`§16`). Пять правок, каждая с тестами;
`typecheck` / `lint` / `test` зелёные.

| # | Проблема | Решение | Артефакты |
|---|---|---|---|
| **01** | Ошибка *догрузки* страницы рушила весь Home: `HomeView` считал fatal `productStream.error`, а `useInfiniteQuery.error` включает initial + append + refetch | Разделены `initialError` (`isLoadingError`) и `nextPageError` (`isFetchNextPageError`); fatal — только context error / `initialError`; append-сбой → локальный блок «Не удалось загрузить ещё товары» + `loadMore`; sentinel гаснет при `nextPageError` (нет авто-петли observer) | `useStorefrontHomeProducts.ts`, `HomeView.tsx`, `home.css` |
| **02** | `p_limit` публичного RPC без верхней границы (client 5000 → «весь магазин») | Clamp `least(greatest(coalesce(p_limit, 6), 1), 24)`. Общий RPC с прототипом Каталога → `CATALOG_PRODUCTS_LIMIT` 200 → 24 | `0023` (переприменена), `CatalogView.tsx` |
| **03** | PAUSED магазин всё равно грузил products (context + products стартовали вместе) | Frontend: `enabled = storeActive` (`home.store.status ?? viewedStore.status`, без waterfall); backend defense-in-depth: ранний `return {products:[], nextCursor:null}` при `store.status <> 'ACTIVE'` | `useStorefrontHomeProducts.ts`, `HomeView.tsx`, `0023` (переприменена) |
| **04** | Аватар покупателя / логотип магазина — сырой `<img>`, broken URL не фолбэкался | Переведены на единый `SafeImage` (`null`/broken → инициал `getInitial`) | `HomeHeader.tsx`, `StoreStatusView.tsx` |
| **05** | Коллизия номеров миграций: `0024_home_products_keyset_index.sql` и `0024_product_link.sql` | `0024_product_link.sql` → `0025_product_link.sql`; `0024` остаётся у home-keyset-index (соответствует хронологии Home → Product Detail) | `migrations/0025_product_link.sql` |

**Верификация на реальных данных (InsForge):** clamp `p_limit` `5→5`, `0→1`, `5000→≤24`;
PAUSED-магазин → `{products:[], nextCursor:null}`; ACTIVE-магазин → товары. Тестовый магазин
возвращён в `ACTIVE`.

### 17.1 Отложено (P2 / future)

- **`maxPages` у `useInfiniteQuery` (память Home).** Сейчас все загруженные страницы остаются
  в `query.data.pages` и DOM. Для витрины 10–500 товаров модель нормальна; лимит страниц имеет
  смысл делать вместе с виртуализацией списка (иначе пользователь теряет уже просмотренные
  карточки при скролле). Оставлено как future performance hardening; реестр — `16`.
