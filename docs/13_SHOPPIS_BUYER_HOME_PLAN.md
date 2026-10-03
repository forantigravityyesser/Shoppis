# SHOPPIS — BUYER HOME / STOREFRONT PLAN

**Version:** 0.4
**Статус:** зафиксированное направление buyer storefront MVP. Один документ: продуктовое видение (ЧТО) + техническая архитектура + глобальный путь разработки (КАК, этапы 1–11).

**Область:** покупательская (buyer) часть Shoppis — вкладка **Главная**, связанные **Каталог**, **Product Card**, **Карточка товара**, **Избранное**, **Корзина**, **Заказы**, нижняя навигация и storefront-read layer.
**Вне области:** кабинет продавца (см. `06`, `07`, `09`, `10`, `12`).

**Связанные документы:** `02` (Product Spec), `03` (Domain & Database Spec), `04` (Technical Spec), `05` (Implementation Plan), `08` (Divergence), `12` (Store Settings, S-08).

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
| 3 | ❤️ **Избранное** | `/favorites` | Локально сохранённые товары (**центральный выделенный элемент**) |
| 4 | 📦 **Заказы** | `/orders` | Заказы покупателя |
| 5 | 🛒 **Корзина** | `/cart` | Текущая корзина |

**Сердце по центру** — визуально выделенный центральный элемент навигации (см. §3).

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

Ограничение: **Главная не показывает весь каталог**. Показываем секцию из **6–8 товаров** (§7 этап 7) и кнопку **«Смотреть все товары →»** → **Каталог**.

---

## 3. Нижняя навигация (форма)

- 5 вкладок: `Главная · Каталог · ❤️ · Заказы · Корзина`.
- **Центральный элемент (сердце) крупный и визуально выделен.** Бар имеет вырез/скругление в центре: навбар не является простым прямоугольником — в месте сердца форма закругляется под крупный центральный элемент.
- При нажатии на сердце — **тот же accent-эффект заполнения**, что и у остальных вкладок (единый язык навигации).
- Визуал/анимации переиспользуются из `BottomNavBar` (pill, liquid-индикатор); для buyer-варианта добавляется конфигурация выреза и крупного центрального элемента. Реализация — покупательский адаптер `FloatingNavBar` поверх `BottomNavBar`.

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

## 5. Аватар продавца

При авторизации Telegram получаем:

```ts
photo_url?: string
```

Если Telegram предоставил фото:

```text
sellerAvatarUrl = photo_url
```

Если нет:

```text
sellerAvatarUrl = null
```

Fallback — первая буква имени пользователя / Telegram `first_name`:

```text
Александр → А     John → J     Мария → М
```

### Архитектура (зафиксировано)

Фото продавца **не** тянется из buyer Mini App напрямую. Поток:

```text
Seller opens Mini App
        ↓
Telegram initData (photo_url)
        ↓
backend (telegram-auth)
        ↓
telegram_identities.photo_url
        ↓
storefront projection
        ↓
store.sellerAvatarUrl  (buyer)
```

Хранение: колонка `photo_url` в `telegram_identities` (identity-слой); витрина получает `sellerAvatarUrl` через storefront-read (§20). Денормализация в `stores` не требуется.

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
- текущую цену;
- зачёркнутую оригинальную цену **если есть скидка**;
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

Если есть original price:

```text
3 490 ₽   2 490 ₽
```

**Процент скидки не показываем.**

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

---

## 19. Новая storefront-модель

```ts
interface StorefrontHome {
  store: StorefrontStore;
  categories: StorefrontCategory[];
  products: StorefrontProductCard[];
}
```

### Store

```ts
interface StorefrontStore {
  id: string;
  publicId: string;
  name: string;

  bannerUrl: string | null;
  sellerAvatarUrl: string | null;

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
  price: number;
  originalPrice: number | null;

  available: boolean;
}
```

**Никаких вариантов, inventory, attributes и прочего внутри Home.**

---

## 20. Backend / SQL

Отдельный публичный read layer:

```text
storefront_home_read(public_id)
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
  ↓ seller avatar (telegram_identities.photo_url владельца)
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

**Read-only SQL-функция `public.storefront_home_read(p_public_id text)`**, доступная через PostgREST RPC (один запрос). Проекция целиком на сервере — это будущая граница под RLS, покупатель не собирает данные на клиенте. Миграция — этап 1 (H-01).

---

## 21. Один запрос вместо N+1

Обязательное техническое требование. Не:

```text
getStore() getCategories() getProducts() getImages() getVariants() getInventory() …
```

А:

```text
loadStorefrontHome(publicId) → один контролируемый read → render
```

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

**Статус:** `H-01 — выполнено` (миграция `0014_storefront_home_read.sql` применена; `photo_url`; SQL-функция; контракты `read-models/storefront.ts` + маппер + тесты). `H-02 — выполнено` (`telegram-auth` читает `photo_url` → identity, ответ отдаёт `photoUrl`; `ServerUser.photoUrl`; fallback-правило `seller-avatar.ts`; функция передеплоена). `H-03 — выполнено` (порт `StorefrontRepository`, infra `loadStorefrontHome` (RPC + маппер), хук `useStorefrontHome` с loading/error/notFound/refresh; +9 тестов). `H-04 — выполнено` (Home shell: `HomeHeader` — название + поиск + аватар/fallback, `HomeBanner` (один, 2.2:1), `HomeSkeleton`, `StoreStatusView` (notFound/PAUSED), safe-area сверху, роут `/catalog`-заглушка; `StorefrontView` заменён; +16 тестов). `H-05 — выполнено` (`CategoryCarousel` + `CategoryItem`: фото категории + название, горизонтальный свайп, «Все →» и тап категории → Каталог; +8 тестов). `H-06 — выполнено` (`ProductGrid` (2 колонки) + `ProductCard` (фото/название/цена/зачёркнутая original/sold out, heart-cutout) + `FavoriteButton` (store-scoped, анимация, клик не открывает товар); `DetailsView` — заглушка; +11 тестов). `H-07 — выполнено` (`ProductSection`: заголовок «Товары», лимит `HOME_PRODUCTS_LIMIT = 6`, «Смотреть все →» в Каталог; +4 теста). `H-09 — выполнено` (вне очереди, по запросу): `FloatingNavBar` покупателя на том же `BottomNavBar`, что у продавца (pill, liquid-подсветка, haptic) — 5 вкладок (Главная · Каталог · ❤️(центр) · Заказы · Корзина), сердце по центру чуть крупнее (`iconSize: 28`); +6 тестов. `H-08 — выполнено` (`CatalogView`: поиск по названию (клиентский), чипы категорий «Все» + активные категории, сетка товаров; Home search → `/catalog?focus=1` + автофокус; данные через тот же `storefront_home_read` (кэш); фильтры/сортировка отложены по решению; +8 тестов). `H-10 — выполнено` (полноценный pause: `StoreStatusView` с брендовой шапкой (аватар+название)+контакт; гейт на Home **и** Catalog — покупка/поиск недоступны, добавление в корзину/оформление отсутствуют; существующие заказы не затрагиваются, серверный `STORE_PAUSED` остаётся; +4 теста). `H-11 — выполнено` (performance polish): изображения — thumb на карточках, `loading=lazy`/`decoding=async`, баннер `eager`, **фолбэк при сбое загрузки** (`useImageFallback`) в карточке/баннере/категории; загрузка — скелетоны Home и **Catalog** без белого flash/layout jump, базовый `.skel` вынесен в общий `components.css`; сеть — один `storefront_home_read` на Home и Catalog (общий кэш React Query, staleTime 5 мин, `refetchOnWindowFocus:false`), N+1 нет; UI — анимация сердца, плавный скролл категорий, `prefers-reduced-motion`. Telegram QA (iOS/Android/Desktop) — ручная проверка владельцем. **Все этапы H-01…H-11 закрыты.**

### Этап 1 — Storefront contracts + SQL `[H-01]`

- Миграция `0014_storefront_home_read.sql`:
  - `alter table telegram_identities add column photo_url text`;
  - функция `public.storefront_home_read(p_public_id text)` (RPC, один запрос) → store/categories/products;
  - grant execute.
- Проверяем: store, public_id, store status, seller avatar, active categories, archived categories, active products, archived products, product images, first active variant, effective price, availability.
- Фиксируем поведение: deleted category → uncategorized; archived category → временно uncategorized; archived product → invisible; sold out → visible; paused store → storefront paused.

### Этап 2 — Seller Telegram Avatar `[H-02]`

- В Telegram identity добавить `photoUrl`.
- При seller auth: `Telegram photo_url → backend → photo_url` в identity.
- Fallback: недоступно фото → первая буква.

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

- Ограниченное количество товаров: **6–8** + «Смотреть все →» → Catalog.

### Этап 8 — Catalog `[H-08]`

- `Catalog`: Search, All, Categories, Filters, ProductGrid.
- Home search → Catalog → auto focus → keyboard.

### Этап 9 — Bottom Navigation `[H-09]`

- Покупательский навбар: Home, Catalog, Favorites, Orders, Cart; центр — крупное сердце с вырезом и единым accent-эффектом (§3).

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
│   ├── Seller avatar / profile (top-right, app-wide)
│   ├── Search → Catalog + focus
│   ├── Banner (single)
│   ├── Categories carousel (+ «Все →»)
│   ├── Product preview grid (6–8)
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
Telegram identity (photo_url)
       │
       ▼
Seller / Store
       │
       ▼
storefront_home_read()
       │
       ├── Store
       ├── Categories
       └── Product Cards
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
- под фото: название в 2 строки, цена жирным;
- при скидке — зачёркнутая original рядом.

### D.2 Главная

- header: название магазина слева, справа поиск и профиль (**bell убираем**);
- один крупный баннер;
- секция категорий (в прототипе «Popular Brands» — **заменяем на категории магазина**, brands вне MVP);
- секция товаров (в прототипе «New Arrival») → наш «Товары» + «Смотреть все»;
- нижняя навигация с выделенным центральным сердцем.

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
