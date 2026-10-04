# SHOPPIS — BUYER HOME / STOREFRONT PLAN

**Version:** 0.5
**Статус:** зафиксированное направление buyer storefront MVP. Один документ: продуктовое видение (ЧТО) + техническая архитектура + глобальный путь разработки (КАК, этапы 1–11). **Hardening Home (HOME-HARDEN-01…11) выполнен** — актуальный источник правды `15_SHOPPIS_BUYER_HOME_HARDENING_AUDIT.md`; устаревшие детали `13` исправлены/помечены ниже.

**Область:** покупательская (buyer) часть Shoppis — вкладка **Главная**, связанные **Каталог**, **Product Card**, **Карточка товара**, **Избранное**, **Корзина**, **Заказы**, нижняя навигация и storefront-read layer.
**Вне области:** кабинет продавца (см. `06`, `07`, `09`, `10`, `12`).

**Связанные документы:** `02` (Product Spec), `03` (Domain & Database Spec), `04` (Technical Spec), `05` (Implementation Plan), `08` (Divergence), `12` (Store Settings, S-08).

> **⚠ Актуализация 2026-10-04 — `15_SHOPPIS_BUYER_HOME_HARDENING_AUDIT.md` переопределяет части этого документа:**
> - §3 — нижняя навигация: **5 равнозначных вкладок** (особого «сердца по центру» в коде нет);
> - §5 — верхний правый аватар: **аккаунт покупателя** (`serverUser.photoUrl` / `firstName`), а не `sellerAvatarUrl`;
> - §9-10 — цена карточки Home: **только effective price**, `originalPrice` из Home удаляется;
> - §19 — модель Home: split `{store, categories}` + отдельный `HomeProductPage {products, nextCursor}`;
> - §20-21 — вместо одного `storefront_home_read` — **split-чтение**: `storefront_home_context_read` (store + категории) + `storefront_home_products_read` (товары, keyset-курсор);
> - §28 H-07 — вместо фикс. 6 товаров — **progressive/cursor stream**.
>
> Полный разбор и план (HOME-HARDEN-01…11) — в документе `15`.

---

## 0. Продуктовый принцип

> **Home — не место, где пользователь должен искать всё. Home — место, где пользователь должен захотеть посмотреть магазин.**

Поток:

```text
Красивый баннер → категории → привлекательные карточки
    → быстрый переход в Каталог → товар → покупка
```

Вся тяжёлая работа — **поиск + фильтры + все категории + весь ассортимент** — уходит в **Каталог**. Home остаётся визуально богатой и технически лёгкой.

Главный продуктовый тезис:

> `Главная = заинтересовать → Каталог = найти → Карточка товара = изучить → Корзина = купить.`

Эти зоны не смешиваются.

---

## 1. Новая структура покупательской части

Итоговая нижняя навигация:

| № | Раздел | Маршрут | Назначение |
|---|---|---|---|
| 1 | 🏠 **Главная** | `/` | Витрина, первое впечатление, привлечение к покупке |
| 2 | 🔎 **Каталог** | `/catalog` | Все товары, категории, поиск, фильтры |
| 3 | ❤️ **Избранное** | `/favorites` | Локально сохранённые товары (store-scoped, Zustand persist) |
| 4 | 📦 **Заказы** | `/orders` | Заказы покупателя |
| 5 | 🛒 **Корзина** | `/cart` | Текущая корзина |

Все пять вкладок **равнозначны** (особый центральный элемент не выделяется) — документация приведена к реализации (`15 §3.10`).

Профиль покупателя доступен **только** через аватар/имя продавца в правом верхнем углу хедера (§4); это сквозная для всего приложения иконка справа вверху. **Уведомлений нет** (§16).

---

## 2. Что теперь представляет собой Главная

Главная **не является каталогом**. Она ощущается как полноценная страница магазина:

```text
┌──────────────────────────────────────┐
│ Название магазина       🔎     👤   │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │          STORE BANNER            │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Категории                    Все →   │
│  ○       ○       ○       ○       →  │
│  Фото    Фото    Фото    Фото        │
│  Обувь   Одежда  ...                 │
│                                      │
│ Товары                               │
│ ┌────────────┐  ┌────────────┐      │
│ │       ♡    │  │       ♡    │      │
│ │    PHOTO   │  │    PHOTO   │      │
│ └────────────┘  └────────────┘      │
│ Название         Название            │
│ 2 490 ₽          3 990 ₽             │
│                                      │
│              Смотреть все →          │
└──────────────────────────────────────┘
```

Главная не показывает весь каталог: она отдаёт **первую страницу товарного потока** (progressive/cursor, `15 §5`) и кнопку **«Смотреть все товары →»** → **Каталог**.

---

## 3. Нижняя навигация (форма)

- 5 вкладок: `Главная · Каталог · ❤️ · Заказы · Корзина`.
- **Все вкладки равнозначны.** Единый `BottomNavBar` (pill, liquid-индикатор, haptic); покупательский адаптер `FloatingNavBar` передаёт 5 вкладок. Особого «крупного сердца» в центре нет — документация приведена к фактической реализации (`15 §3.10`).

---

## 4. Header

### Слева

**Название магазина.** Если длинное — усекается без разрастания header:

```text
Very Long Store Na...
```

### Справа

```text
🔎    👤
```

- `🔎` — поиск. Ведёт в **Каталог** с автофокусом поиска (§8).
- `👤` — аватар/имя продавца (см. §5). **Единственный вход в профиль покупателя.** Иконка сквозная для всего приложения и располагается справа вверху.
- **Уведомления полностью убраны** — нет bell, счётчиков, ленты (§16).

---

## 5. Аватар покупателя

Верхний правый профиль Home — это **текущий Telegram-аккаунт покупателя** (`serverUser`), а **не** продавец. При авторизации Telegram получаем `photo_url` и `first_name` текущего пользователя; `serverUser.photoUrl` уже заполняется на auth.

```text
serverUser.photoUrl есть  → фото покупателя
serverUser.photoUrl пуст  → getInitial(serverUser.firstName)  → первая буква
```

Fallback — generic-правило `getInitial` (`domain/rules/initial.ts`; не режет эмодзи/суррогатные пары).

### Storefront vs ServerUser (зафиксировано)

Продавец и покупатель не смешиваются:

```text
StorefrontStore → публичные данные магазина (name, logoUrl, bannerUrl, status, supportHandle, currency)
ServerUser      → данные текущего покупателя (photoUrl, firstName)
```

`sellerAvatarUrl` (Telegram-фото продавца) в buyer storefront **не используется** и удалён из проекции (миграция `0022`). На pause-экране показывается **публичный логотип магазина** (`logoUrl`), fallback — `getInitial(storeName)`. Полное обоснование — `15 §3.3-3.4`.

---

## 6. Баннер

Фиксируем:

- один баннер;
- никакого carousel;
- никаких dots;
- никакого autoplay;
- никаких нескольких рекламных блоков в MVP.

Визуально: `border-radius: ~20px`, `aspect-ratio: ~2.2 / 1`, `object-fit: cover`. Баннер загружается быстро — не тянем каждый раз оригинал.

> Примечание по прототипу: в мокапе под баннером есть точки-индикаторы и стрелка. Точки **убираем** (один баннер). Стрелка может быть использована как переход в Каталог, но не является обязательной для MVP.

---

## 7. Категории на Home

Горизонтальная лента с изображением и названием:

```text
[ image ]  [ image ]  [ image ]  [ image ]
  Одежда     Обувь     Аксесс.    Косметика
```

- горизонтальный свайп;
- справа — **«Все →»**;
- ведёт **не** на отдельную страницу категорий, а непосредственно в **Каталог**.

> Адаптация прототипа: секция «Popular Brands» (логотипы брендов) **не берётся** — brands вне MVP (§28, Приложение A). Вместо неё — категории магазина с фото и названием.

Home только даёт вход; полная структура — в Каталоге.

---

## 8. Каталог — отдельная полноценная система

Catalog отвечает за:

- все товары;
- категории и «Все товары»;
- поиск;
- фильтрацию;
- сортировку (в будущем);
- полноценную сетку;
- переходы в Product Detail.

```text
Каталог

[ 🔎 Найти товар................ ]

Категории
[ Все ] [ Одежда ] [ Обувь ] [ Аксессуары ]

Фильтры

┌──────────┐ ┌──────────┐
│ product  │ │ product  │
└──────────┘ └──────────┘
...
```

### Поиск

При нажатии `🔎` в Home **не** открываем отдельный search overlay. Делаем:

```text
Home → Catalog → focus search input → keyboard/search
```

Пользователь ощущает: «нажал поиск → сразу оказался там, где можно искать».

---

## 9. Product Card — основа визуала

Карточка — один из главных визуальных элементов Shoppis. Две колонки.

```text
┌─────────────────┐
│             ┌───┐
│             │ ♡ │
│             └───┘
│                 │
│      PHOTO      │
│                 │
└─────────────────┘
Название товара
2 490 ₽
```

### Heart container

Не маленькое сердце поверх фото, а **отдельный белый контейнер**, который визуально вырезает угол карточки:

```text
       ┌──────────┐
       │    ♡     │
───────┘          │
                   │
                   │
```

Белая форма — часть дизайна карточки; один из узнаваемых визуальных паттернов Shoppis.

### Что показываем

- фото;
- название;
- **только конечную (effective) цену**;
- сердце.

### Что НЕ показываем

`% скидки`, характеристики, варианты, количество, категории, описание, рейтинг, вопросы и прочее. Карточка максимально чистая.

---

## 10. Цена

### Цена карточки

Берём **effective price первого активного варианта**.

```text
Product: Nike T-Shirt
Variants: S → 2 490 ₽, M → 2 690 ₽, L → 2 690 ₽
На Home:  2 490 ₽
```

На карточке Home показываем **только** конечную effective price — без зачёркнутой original и без процента скидки. Оригинальная цена и скидка относятся к Product Detail (`15 §3.9`); `originalPrice` удалён из Home read-model и SQL-проекции (`15 §7.4`).

Формула едина — `domain/rules/product-rules.ts` (`currentPriceMinor`, `effectivePrice`), без float на границах, деньги в minor units.

---

## 11. Sold out

Товар **не исчезает** из каталога, если закончился. Если:

```text
all active variants stock = 0
```

то:

```text
ProductCard → «Нет в наличии»
```

Внутри Product Detail: варианты недоступны; нельзя выбрать закончившийся вариант; если закончились все — покупка невозможна. **Карточка остаётся.**

Это правильно и для магазина: покупатель видит ассортимент, даже если конкретная позиция временно закончилась.

---

## 12. Логика категорий — три состояния

### 1. Product ACTIVE + Category ACTIVE

Обычный товар:

```text
Одежда └── Nike T-Shirt
```

Показывается: Home, Category, All, Search.

### 2. Product ACTIVE + Category ARCHIVED

Товар не остаётся внутри архивной категории. Для покупателя:

```text
Category = null
```

```text
Все товары └── Nike T-Shirt
```

Он не попадает в `Одежда`, потому что категория больше не публичная активная.

### 3. Category DELETED

То же самое:

```text
product.category_id = null
```

Товар остаётся активным и попадает в «Все товары».

---

## 13. Product ARCHIVED

Если `product.status = ARCHIVED`, покупатель его **вообще не видит**: не Home, не Catalog, не Category, не Search. Но сам product остаётся в БД (продавец/история/заказы). При возврате `ARCHIVED → ACTIVE` он снова появляется на витрине.

---

## 14. Category ARCHIVED → ACTIVE

```text
ACTIVE → ARCHIVED
```

Категория исчезает из публичной витрины; связанные активные товары становятся `uncategorized` и показываются в «Все товары».

При возврате `ARCHIVED → ACTIVE` связь **не должна** требовать ручного восстановления.

### Решение: не менять `product.category_id` при архивации категории

БД продолжает знать:

```text
product.category_id = category123
category123.status = ARCHIVED
```

Storefront-проекция вычисляет:

```ts
visibleCategoryId =
  category.status === 'ACTIVE' ? product.categoryId : null;
```

- на витрине товар считается без категории;
- категория возвращается → товар автоматически возвращается в неё.

При **удалении** категории — `product.category_id = NULL` (текущее поведение `deleteCategory` уже корректно).

---

## 15. Pause магазина

Storefront-архитектура, а не отдельный костыль. Если `store.status = PAUSED`, покупатель получает понятный экран:

> **Магазин временно закрыт**
> Сейчас заказы в этом магазине недоступны. Попробуйте зайти позже.

Визуал магазина полностью не уничтожаем — можно оставить название/аватар/часть фирменного визуала. Но:

- нельзя добавить в корзину;
- нельзя оформить заказ;
- нельзя создавать новые заказы.

**Существующие заказы не затрагиваются.** Серверный guard `STORE_PAUSED` уже срабатывает в checkout (`create_order_atomic`).

---

## 16. Уведомления — полностью вырезаем из MVP UI

### Внутри приложения

❌ Notifications screen · ❌ Bell icon · ❌ Notification feed · ❌ `buyer_notifications` как in-app feed · ❌ unread counter · ❌ notification center

### Остаётся

Telegram Bot notifications:

```text
Order created / Order status changed → Telegram Bot → buyer notification
```

Permission на Telegram notifications может оставаться инфраструктурно (`telegram_identities.notifications_enabled`, миграция `0013`), но это **не часть UI Home**.

---

## 17. Избранное

MVP:

```text
Zustand → persist → local device
```

Без БД. Структура обязательна (уже реализована):

```ts
favoritesByStore: {
  "store-A": ["product-1", "product-4"],
  "store-B": ["product-8"]
}
```

Избранное **не глобальное** — своё в каждой витрине. Сохраняем структуру сейчас, даже если позже перенесём favorites в backend (`carts`/`favorites` в БД — отдельный пункт `08 §2.2`).

---

## 18. Home ↔ Product Detail

Жёстко разделяем. Home ProductCard знает только:

```text
id, title, image, price, originalPrice, availability, favorite
```

Product Detail **сам** загружает: product, images, description, attributes, variants, inventory, related products, reviews, Q&A.

```text
HOME → Product ID → PRODUCT DETAIL → самостоятельная загрузка
```

Не таскаем большой `ProductDetail` через Home — это важно для производительности.

Полноценная реализация Product Detail вынесена в отдельный блок —
`docs/14_SHOPPIS_PRODUCT_DETAIL_PLAN.md` (этапы `PD-01…PD-14`): публичный read-model
(`storefront_product_detail_read`, миграция `0015`), галерея (main = full, миниатюры = thumb),
варианты/цена/наличие, вкладки «О товаре / Отзывы / Вопросы» (чтение), related (ProductGroup)
и immersive-режим без нижнего navbar.

---

## 19. Новая storefront-модель

```ts
interface StorefrontHome {
  store: StorefrontStore;
  categories: StorefrontCategory[];
}

interface StorefrontHomeProductPage {
  products: StorefrontProductCard[];
  nextCursor: string | null;
}
```

### Store

```ts
interface StorefrontStore {
  id: string;
  publicId: string;
  name: string;

  bannerUrl: string | null;

  status: 'ACTIVE' | 'PAUSED';

  currencyCode: string;
  currencySymbol: string;
}
```

### Category

```ts
interface StorefrontCategory {
  id: string;
  name: string;
  imageUrl: string | null;
  sortOrder: number;
}
```

### Product Card

```ts
interface StorefrontProductCard {
  id: string;
  title: string;

  categoryId: string | null; // null, если категория не ACTIVE (archived) или удалена

  imageUrl: string | null;
  price: number; // только конечная (effective) цена

  available: boolean;
}
```

**Никаких вариантов, inventory, attributes и прочего внутри Home.**

---

## 20. Backend / SQL

Отдельный публичный read layer:

```text
storefront_home_context_read(public_id)                 -- store + активные категории
storefront_home_products_read(public_id, cursor, limit) -- товарный поток, keyset-курсор
```

Возвращает только то, что разрешено покупателю. Логика:

```text
store (public_id)
  ↓ store.status
  ↓ active categories  (status = ACTIVE)
  ↓ active products    (status = ACTIVE)
  ↓ product image thumb
  ↓ first active variant
  ↓ effective price
  ↓ availability
```

### Product visibility

```text
product.status = ACTIVE — только такие товары.
```

### Category visibility

```text
category.status = ACTIVE — только такие категории.
```

### Если категория archived

Для storefront `categoryId = null`, но `product.category_id` в БД не меняется (§14).

### Если категория deleted

`product.category_id = null` в БД.

### Реализация (зафиксировано)

**Read-only SQL-функции `public.storefront_home_context_read(p_public_id text)` и `public.storefront_home_products_read(p_public_id text, p_cursor text, p_limit int)`** через PostgREST RPC. Проекция целиком на сервере — будущая граница под RLS. Миграции `0021`–`0024`; монолитный `storefront_home_read` (`0014`) удалён (`15 §6`).

---

## 21. Нет N+1, поток пагинируется

Обязательное техническое требование. Не:

```text
getStore() getCategories() getProducts() getImages() getVariants() getInventory() …
```

А:

```text
Home → 2 read: storefront_home_context_read(public_id) + storefront_home_products_read(public_id, cursor, limit)
```

Товарный поток догружается progressive-страницами (cursor), а не грузит весь магазин сразу (`15 §5`).

---

## 22. Производительность — отдельное требование MVP

> **Buyer storefront должен ощущаться как нативное современное приложение, а не как web-page, загруженная внутри Telegram.**

Images — существующий pipeline:

```text
product original → 4:5 full 1000×1250 → 4:5 thumbnail 512×640
```

Home: **thumb 512×640** (портрет 4:5). Product Detail: **full 1000×1250**.

---

## 23. Loading UX

Не белый экран с задержкой, а скелетоны:

```text
Header skeleton · Banner skeleton · Category skeleton
Product skeleton ×4–6
```

Данные постепенно заменяют skeleton. **Никакой искусственной задержки**: пришли за 100 ms — показываем за 100 ms; backend медленный — skeleton остаётся.

---

## 24. Image loading

```text
thumbnail → decode → fade / instant appearance
```

- lazy loading;
- правильные dimensions;
- отсутствие layout shift;
- `object-fit`;
- placeholder;
- обработка failed image.

Full-size фото для маленькой карточки не грузим.

---

## 25. Плавность интерфейса

- Telegram safe area;
- нормальный scroll;
- плавный горизонтальный scroll категорий;
- лёгкие transitions;
- haptic feedback там, где уместно;
- никакого тяжёлого animation framework ради простых эффектов (используем `framer-motion` дозированно);
- никакого постоянного remount компонентов;
- не делать повторные запросы при каждом рендере.

---

## 26. Архитектура загрузки

```text
Telegram Mini App
        │
        ▼
useAppInit
        │
        ▼
authenticate
        │
        ▼
resolve store/public_id
        │
        ▼
loadBuyerStore
        │
        ▼
loadStorefrontHome
        ├── store
        ├── categories
        └── products
              │
              ▼
           HomeView
```

Переходы:

```text
Home
 ├── Search → Catalog + focus search
 ├── All categories → Catalog
 ├── All products → Catalog
 ├── Category → Catalog(categoryId)
 └── Product → ProductDetail(productId)
```

---

## 27. Итоговая UX-архитектура

```text
                     STORE
                       │
             ┌─────────┴─────────┐
             │                   │
          HOME                CATALOG
             │                   │
       attraction            discovery
             │                   │
             └───────┬───────────┘
                     │
                     ▼
               PRODUCT DETAIL
                     │
                     ▼
                  CART
                     │
                     ▼
                  ORDER
```

Нижняя навигация:

```text
┌─────────────────────────────────────────┐
│  Home   Catalog    ❤️     Orders  Cart  │
│   🏠      🔎                📦    🛒    │
└─────────────────────────────────────────┘
```

---

## 28. Этапы разработки

Последовательность неизменна. Один этап за раз: реализация → проверка (`typecheck`/`lint`/`test`) → ручная сверка владельцем → следующий этап.

**Статус (H-01…H-11):** buyer storefront MVP закрыт. **Hardening Home (HOME-HARDEN-01…11) выполнен** — см. `15_SHOPPIS_BUYER_HOME_HARDENING_AUDIT.md` (актуальные решения, миграции `0019`/`0021`–`0024`, прогрессивная cursor-пагинация, buyer avatar, только effective price, 5 равных вкладок). Историческая детализация H-01…H-11 ниже устарела в части фикс. 6 товаров, seller-аватара и «центрального сердца» и оставлена для истории.

**Следующий блок:** Product Detail — `docs/14_SHOPPIS_PRODUCT_DETAIL_PLAN.md` (этапы `PD-01…PD-14`).

### Этап 1 — Storefront contracts + SQL `[H-01]`

- Миграция `0014` (исторически) заменена split-чтением `0021`/`0023`:
  - `alter table telegram_identities add column photo_url text` (остаётся);
  - `storefront_home_context_read(public_id)` + `storefront_home_products_read(public_id, cursor, limit)`;
  - grant execute.
- Проверяем: store, public_id, store status, active categories, archived categories, active products, archived products, product images, first active variant, effective price, availability.
- Фиксируем поведение: deleted category → uncategorized; archived category → временно uncategorized; archived product → invisible; sold out → visible; paused store → storefront paused.

### Этап 2 — Buyer Telegram Avatar `[H-02]`

- В Telegram identity добавить `photoUrl`; `telegram-auth` отдаёт `photoUrl`.
- Верхний правый Home — аватар **покупателя** (`serverUser.photoUrl`), fallback `getInitial(firstName)`.
- Pause-шапка — публичный `logoUrl` магазина.

### Этап 3 — Buyer Storefront Repository `[H-03]`

- `StorefrontRepository` + `loadStorefrontHome(storePublicId)`.
- Хук `useStorefrontHome` (loading/error/retry/state/cache).

### Этап 4 — Home shell `[H-04]`

- Header, store name, avatar, search button, banner, safe areas, skeleton. Сначала без товаров.

### Этап 5 — Categories `[H-05]`

- `CategoryCarousel`, `CategoryItem`: изображение, название, horizontal scroll, плавный свайп, «Все».
- Routing: Category → `Catalog(categoryId)`; Все → `Catalog`.

### Этап 6 — Product Grid `[H-06]`

- `ProductGrid`, `ProductCard`, `FavoriteButton`: 2 columns, image, белый heart cutout, title, price, crossed original price, sold out, favorite animation, click → ProductDetail.

### Этап 7 — Home product section `[H-07]`

- Первая страница progressive/cursor-потока + «Смотреть все →» → Catalog (`15 §5`).

### Этап 8 — Catalog `[H-08]`

- `Catalog`: Search, All, Categories, Filters, ProductGrid.
- Home search → Catalog → auto focus → keyboard.

### Этап 9 — Bottom Navigation `[H-09]`

- Покупательский навбар: Home, Catalog, Favorites, Orders, Cart — 5 равнозначных вкладок (`15 §3.10`).

### Этап 10 — Pause Store `[H-10]`

- Полноценный storefront state `ACTIVE/PAUSED`: понятный экран, объяснение, отключение покупки, никаких новых заказов, существующие заказы не затрагиваются.

### Этап 11 — Performance polish `[H-11]`

- Loading: skeleton, no white flash, no layout jump.
- Images: thumbs, lazy loading, dimensions, fallback, failed image.
- Network: отсутствие N+1, минимум запросов, повторные запросы только по причине.
- UI: 60fps-ish scrolling, smooth category swipe, favorite animation, navigation transitions, Telegram iOS/Android/Desktop.

---

## Приложение A. Что намеренно НЕ делаем сейчас

Home MVP **не включает**:

❌ in-app notifications · ❌ notification center · ❌ notification badge · ❌ recommendations · ❌ personalization · ❌ «popular» algorithm · ❌ stories · ❌ product reviews на Home · ❌ Q&A на Home · ❌ сложные filters · ❌ sorting на Home · ❌ backend favorites · ❌ seller chat · ❌ multiple banners · ❌ banner carousel · ❌ promo blocks · ❌ brands · ❌ AI recommendations

Всё это добавляется поверх уже правильной архитектуры.

---

## Приложение B. Роль Home (продуктовый принцип)

> **Home — не место, где пользователь должен искать всё. Home — место, где пользователь должен захотеть посмотреть магазин.**

**Красивый баннер → категории → привлекательные карточки → быстрый переход в каталог → товар → покупка.**

Тяжёлая работа (**поиск + фильтры + все категории + весь ассортимент**) — в **Каталоге**. Это позволяет Home быть визуально богатой и технически лёгкой одновременно.

---

## Приложение C. Итоговая структура MVP

```text
BUYER APP
│
├── 🏠 HOME
│   ├── Store name
│   ├── Buyer avatar / profile (top-right, app-wide)
│   ├── Search → Catalog + focus
│   ├── Banner (single)
│   ├── Categories carousel (+ «Все →»)
│   ├── Product stream (first page, progressive/cursor)
│   └── View all → Catalog
│
├── 🔎 CATALOG
│   ├── Search
│   ├── All products
│   ├── Categories
│   ├── Filters
│   └── Product grid
│
├── ❤️ FAVORITES
│   └── Zustand, scoped by store
│
├── 📦 ORDERS
│
├── 🛒 CART
│
└── PRODUCT DETAIL
    ├── Gallery
    ├── Description
    ├── Characteristics
    ├── Variants
    ├── Stock
    ├── Add to cart
    └── Related products
```

Backend:

```text
Telegram initData
       │
       ▼
ServerUser (buyer photo/name)  ·  Store (seller)

public_id
       │
       ▼
storefront_home_context_read()  → Store + Categories
storefront_home_products_read() → Product Cards (cursor)
              │
              ▼
             HOME
```

---

## Приложение D. Прототипы (визуальное направление)

Адаптируем под себя два мокапа покупательской части.

### D.1 Карточки товаров

- светлый холодный фон витрины; белые скруглённые карточки;
- фото товара по центру;
- сердце в **белом cutout-контейнере** в правом верхнем углу (у избранных — заполненное/акцентное);
- под фото: название в 2 строки, цена жирным (**только конечная effective price**; скидка/оригинал — в Product Detail).

### D.2 Главная

- header: название магазина слева, справа поиск и профиль покупателя (**bell убираем**);
- один крупный баннер;
- секция категорий (в прототипе «Popular Brands» — **заменяем на категории магазина**, brands вне MVP);
- секция товаров (в прототипе «New Arrival») → наш «Товары» (progressive/cursor) + «Смотреть все»;
- нижняя навигация — 5 равнозначных вкладок (без особого центрального элемента).

> Файлы прототипов положить в `docs/assets/buyer-home-proto-cards.png` и `docs/assets/buyer-home-proto-screen.png`; при необходимости вставим изображения в этот документ.

---

## Приложение E. Definition of Done (для этапов H-01…H-11)

- [ ] TypeScript types
- [ ] loading / empty / error
- [ ] negative case
- [ ] tests
- [ ] migration (где применимо)
- [ ] no unrelated refactor
- [ ] `npm run typecheck` + `npm run lint` + `npm run test` зелёные
- [ ] LOCAL VERIFIED (браузер)
- [ ] TELEGRAM VERIFIED (Mini App)
