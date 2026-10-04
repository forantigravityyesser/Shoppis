# SHOPPIS — BUYER PRODUCT DETAIL PLAN

**Version:** 0.3 (2026-10-04)
**Статус:** `PD-01…PD-14` выполнены (реализация + тесты); `PD-13` — код-level QA закрыт,
финальные `LOCAL/TELEGRAM VERIFIED` — за владельцем. Отложенное — в `16_SHOPPIS_REMAINING_WORK.md`.
Предпосылки выполнены: `H-01…H-11` (buyer Home/Catalog, docs/13) и seller-домен
(варианты, inventory, эффективные цены, изображения full/thumb).

**Область:** покупательский экран товара `/product/:id` — галерея, идентичность товара,
варианты/цена/наличие, избранное, добавление в корзину, вкладки «О товаре / Отзывы / Вопросы»
(отзывы и вопросы — **чтение + запись**: покупатель пишет/удаляет своё, продавец отвечает/
модерирует), related-товары (**явные двусторонние связи** `product_links`, «Похожее»),
routing/immersive layout, motion, публичный read layer (миграции `0015`/`0019`/`0024`) и
write layer (edge `review-actions`/`question-actions`/`catalog-actions`; миграции
`0017`/`0020`/`0024`). Seller-управление связями — во вкладке «Витрина» (`PD-14b`).

**Вне области:**
- Home / Каталог / навигация — закрыты в docs/13;
- пагинация/фильтры/сортировка social-лент;
- экраны Cart / Favorites / Orders и checkout — отдельные блоки;
- linking attributes (descriptive meta у названия) — вынесено в `16_SHOPPIS_REMAINING_WORK.md` (FD-1);
- RLS, доставка, промокоды, рекомендации, чат с продавцом.

**Связанные документы:** `00` (индекс), `02` (Product Spec), `03` (Domain & Database Spec),
`04` (Technical Spec), `05` (Implementation Plan), `08` (Divergence), `11` (Hardening backlog),
`13` (Buyer Home Plan), `мысли о деталях товара.md` (исходные идеи, приняты как основа).

---

## 0. Продуктовый принцип

```text
Главная = заинтересовать
Каталог = найти
Карточка товара = изучить и решиться
Корзина = купить
```

Product Detail — самый насыщенный экран buyer-части. Он одновременно связывает:
read model, изображения (full/thumb), варианты, inventory, цену, избранное, корзину,
отзывы, вопросы, ProductGroup и routing. Именно поэтому он делается отдельным блоком
маленькими этапами, а не одним «сделай карточку».

Главный тезис блока:

> **Buyer Product Detail — это самостоятельный публичный read-model, а не seller ProductView.**

---

## 1. Текущее состояние (аудит)

Аудит проведён по `main` (`21a6aa9`, buyer Home/Catalog UI), миграциям `0001…0014` и коду `src/`.

### 1.1 Что уже готово

| Область | Состояние |
|---|---|
| Роут `/product/:id` | ✅ существует, lazy `DetailsView`, переход с `ProductCard` (`navigate('/product/${id}')`) |
| Storefront read-паттерн | ✅ `storefront_home_read` (0014) → `StorefrontRepository` → `mapStorefrontHome` → `useStorefrontHome` |
| Store context | ✅ `viewedStore` / `publicId` / `storeId` (`loadBuyerStore`, start-param `shop_<publicId>`) |
| Seller-домен товара | ✅ `Product`, `ProductImage` (full/thumb), `Variant`, `Inventory`, `effectivePrice`, `productStock` |
| Цены | ✅ `currentPriceMinor` / `effectivePrice` (`product-rules.ts`), та же формула в SQL (0014/0004) |
| Изображения | ✅ pipeline: full 1000×1250 + thumb 512×640, fallback `thumb ?? full`, `useImageFallback` |
| Избранное | ✅ `favoritesByStore` (store-scoped), `useFavorites` |
| Корзина | ✅ `cartByStore`, `addToCart`, `CartItem {productId, productVariantId, quantity, price, selected}`, checkout перепроверяет цену/остаток |
| БД social | ✅ `reviews`, `questions`, `question_answers` (0008) с нужными constraints |
| UI-фидбек | ✅ `UiSlice`: `toast`, flying-анимации (`target: 'cart' | 'favorites'`), `useHaptic` |
| Общие компоненты | ✅ `BackButton`, `BottomSheet`, `PlaceholderScreen`, `BottomNavBar` |

### 1.2 Что отсутствует (границы блока)

| Область | Состояние |
|---|---|
| `DetailsView` | ⏳ заглушка (`PlaceholderScreen`) |
| Публичный read model товара | ⏳ нет; `storefront_product_detail_read` не существует, миграция `0015` свободна |
| Buyer-хуки товара | ⏳ нет |
| Вложенные роуты | ⏳ `/product/:id/reviews`, `/product/:id/questions` отсутствуют |
| Navbar на карточке | ⏳ `BuyerLayout` **всегда** показывает `FloatingNavBar`; на `/product/*` нет active tab |
| Отзывы/вопросы | ⏳ БД есть, но их никто не читает; `review-slice` — локальный фейк без UI-потребителей (мёртвый код) |
| ProductGroup / linking attributes | ⏳ `products.product_group_id` никогда не пишется; seller-форма всегда шлёт `linkAttributes: []`; `buildProductDetail` их отбрасывает |
| Экраны Favorites/Cart/Orders | ⏳ `return null` (вне блока; зависимость для проверки CTA) |
| RLS | ⏳ сознательно отложен; публичный доступ проектируется через `security definer` RPC |

### 1.3 Ключевые правила, которые уже действуют

- `storage_key` / `thumb_storage_key` фактически содержат **публичные URL** (legacy-название);
  мапперы не должны достраивать bucket-путь.
- `held_quantity` **никогда не раскрывается** покупателю (03 §24) — только `available_quantity`.
- Cart ничего не резервирует; финальная проверка stock/price — на checkout.
- «Похожее» — только явные связи `product_links`; «похожесть» по названию/категории не угадываем.
- Избранное store-scoped: один и тот же товар в разных магазинах — разное состояние.

---

## 2. Экран: структура

### 2.1 Главный экран (вкладка «О товаре»)

```text
┌──────────────────────────────┐
│ ←                         ↗  │   back / share — поверх фото, в углах
│                              │
│          MAIN PHOTO          │   ≈ половина экрана (50dvh), object-fit: contain
│                              │
│     [img] [img] [img]        │   миниатюры внутри блока фото, снизу по центру
├──────────────────────────────┤
│  ╭────────────────────────╮  │   белый лист со скруглением поверх фото
│  │ Nike T-Shirt White  ★0 │  │   название + рейтинг-пилюля (0 при 0 отзывах)
│  │                        │  │
│  │ Размер           [▭ 4] │  │   подпись + визуальный счётчик вариантов
│  │ [S] [M] [L] [XL »]     │  │   таблетки; sold-out disabled; » — есть ещё (скролл)
│  ╰────────────────────────╯  │
│                              │
│  ╭─ голубая панель ─────────╮ │   скругление голубое; всё ниже — на нём
│  │ О товаре Отзывы Вопросы  │ │   4 вкладки по центру + нижняя линия-рельс
│  │        Похожее           │ │   (Отзывы/Вопросы — слои, nested routes)
│  ├──────────────────────────┤ │
│  │ Описание / характеристики│ │
│  ╰──────────────────────────╯ │
│                              │
│  ♡  ╭ Итого 2 490 ₽  Добавить в корзину ╮   плавающий CTA без фоновой полосы
└──────────────────────────────┘
```

> Примечание (уточнение визуала): цена выбранного варианта показывается **в CTA**
> (как `Total` в эскизе); отдельный блок цены в белой зоне не выводим.

### 2.2 Блоки

| Блок | Источник |
|---|---|
| Галерея | `images[]` (full + thumb), активное фото — состояние UI |
| Название, описание | `product.title`, `product.description` |
| Linking attributes («Color: White») | `linkAttributes[]` (у названия, отдельная семантика) |
| Рейтинг | `rating {average, count}` — только `ACTIVE`; пилюля видна всегда (`0` при отсутствии) |
| Цена | `variants[selected].price` / `originalPrice` — меняется по выбранному варианту |
| Варианты | `variants[]` (ACTIVE): выбор, своя цена, sold-out `disabled`; счётчик + скролл-подсказка |
| Вкладки | «О товаре» / «Похожее» (inline), «Отзывы» / «Вопросы» (слои, nested routes) |
| Характеристики | `attributes[]` |
| Похожее (вкладка) | `relatedProducts[]` (явные связи; нет связей → пустое состояние); сетка 2 колонки |
| CTA | плавающий (без полосы): ♡-круг + белая капсула «Итого» (цена прижата вправо) + «Добавить в корзину» |

### 2.3 Адаптация прототипа (Zara)

Прототип берём **только как визуальное направление**; вкладки и блоки адаптируем под Shoppis:

| Прототип | Shoppis |
|---|---|
| Вкладки `About / Reviews / Material / Brand` | **«О товаре / Отзывы / Вопросы / Похожее»** (4 вкладки) |
| `Material`, `Brand` как вкладки | уходят в **«Характеристики»** внутри «О товаре» (`product_attributes`) |
| `Size Guide` | не берём (нет данных в модели) |
| `Total $62.00` в CTA | цена **выбранного варианта**; зачёркнутая original при скидке |
| `Add to Bag` | **«Добавить в корзину»** |
| Фото ≈ половина экрана, кнопки ← / ↗ в углах фото | main full `50dvh`, back/share поверх фото по углам |
| Нижняя панель одним фоном | **плавающий CTA без полосы**: ♡-круг + белая капсула с ценой и кнопкой |
| Вкладки на цветной панели | вкладки в **голубой скруглённой панели** (`--color-bg-storefront-blue`) |
| Главное фото + 3 миниатюры | main full + до 3 thumb; **активное фото возвращается в миниатюры** |
| Рейтинг у названия | ★ рейтинг у названия, ведёт в «Отзывы» |

Цвет linking attribute отображаем **у названия** (`Color: White`) — это differentiating-семантика,
а обычные характеристики — в блоке «Характеристики». Две семантики не смешиваем.

Визуальные уточнения (PD-05): варианты — **таблетки естественной ширины** (один вариант не растягивается
на всю строку); вкладки **центрированы**, с нижней линией-рельсом и активным индикатором; у голубой
панели **скруглены верхние края**; подпись `Размер` и вкладки — крупнее и жирнее, активная вкладка жирнее.

---

## 3. Routes и immersive layout

### 3.1 Route tree

```tsx
<Route path="/product/:id" element={<DetailsView />}>
  <Route index element={<ProductAbout />} />
  <Route path="reviews" element={<ProductReviewsView />} />
  <Route path="questions" element={<ProductQuestionsView />} />
</Route>
```

- `DetailsView` становится **layout Product Detail** (shell), контент вкладки — через `<Outlet />`.
- `/product/:id` (About) — default state, без отдельного «экрана About».
- Прямое открытие `/product/:id/reviews` рендерит shell + слой отзывов (deep-link работает).

### 3.2 Immersive mode

- На `/product/*` глобальный `FloatingNavBar` **скрывается**: у карточки собственная нижняя CTA,
  два нижних блока недопустимы.
- `BuyerLayout` становится route-aware:

```tsx
const { pathname } = useLocation();
const immersive = pathname.startsWith('/product/');
...
{!immersive && <FloatingNavBar />}
```

- На `/`, `/catalog`, `/favorites`, `/orders`, `/cart` navbar возвращается.
- Область карточки — отдельный immersive shell: safe-area сверху/снизу, собственный sticky CTA.

### 3.3 Слои «Отзывы» / «Вопросы»

- Визуально — layer поверх Product Detail (не новая веб-страница).
- Анимация (PD-12): вход `y: 100% → 0` (framer-motion, spring); выход — self-managed:
  по кнопке «назад» слой уезжает вниз и только после `onAnimationComplete` идёт навигация.
  При `prefers-reduced-motion` — переход сразу, без ожидания анимации.
- Слой: собственный header (`←` + заголовок), собственный scroll, safe-area, **без global navbar**.
- Состояние Product Detail при открытии/закрытии слоя **не сбрасывается**:
  выбранное фото, выбранный вариант и позиция скролла сохраняются.
- Технически: shell (`DetailsView`) не размонтируется при навигации между child-роутами,
  поэтому состояние хранится в shell. Дополнительно при активном слое «О товаре» остаётся
  смонтированным под ним (высота карточки не схлопывается), а `useScrollToTop` не сбрасывает
  скролл при переходах «О товаре ↔ слой» внутри одного товара.

---

## 4. Gallery (state machine)

### 4.1 Модель

```text
images = [A, B, C, D]        // отсортированы по sort_order

active = A
thumbs = [B, C, D]
```

Нажали `C`:

```text
active = C
thumbs = [A, B, D]           // активное фото всегда возвращается в миниатюры
```

### 4.2 Изображения

- Main: `storage_key` (full, 1000×1250), показывается `object-fit: contain` на светлом фоне блока —
  фото целиком со всеми краями (без обрезки).
- Thumb: `thumb_storage_key ?? storage_key` (fallback как в проекте).
- **Никаких новых полей БД** (`main_photo`, `thumb_1`, …) не создаём.
- Клик по миниатюре — swap main ↔ thumb; `selectTick` haptic; без layout shift.
  **Активное фото исключается из ряда** (главное + до 3 миниатюр).
- Миниатюры расположены **внутри блока фото** — плавающая белая капсула снизу по центру
  (не в белом листе).
- Клик по главному фото → **fullscreen-просмотр** (оверлей через портал): фото целиком,
  закрытие (крестик/фон/Escape), переключение миниатюрами; со **свободным зумом** (пинч,
  двойной тап, панорамирование) — PD-12.

### 4.3 Edge cases

| Фото | Поведение |
|---|---|
| 0 | плейсхолдер (первая буква названия, как в `ProductCard`) |
| 1 | main, миниатюр нет |
| 2 | main + 1 миниатюра |
| 3 | main + 2 миниатюры |
| 4 | main + 3 миниатюры (макс. `MAX_IMAGES = 4`) |
| thumb отсутствует | fallback на full |
| загрузка битая | `useImageFallback` → плейсхолдер, без «прыжка» |

Seller: каждое фото обрабатывается в full (1000×1250) + thumb (512×640); в форме товара
и seller-просмотре превью берут `thumbUrl ?? url`. Buyer: миниатюр всегда `N−1`
(активное исключается из ряда).

**Fullscreen-просмотр (включён):** клик по главному фото открывает оверлей (портал) с плавным
появлением — фото целиком на тёмном фоне, закрытие крестиком/фоном/Escape, переключение между
фото миниатюрами внизу. **Зум включён (PD-12):** пинч двумя пальцами (1×…4×), двойной тап
(2.5× / сброс), панорамирование при увеличении, ограничение по границам.

MVP gallery **не включает**: свайп-карусель (в просмотре — только миниатюры), photo editor.

---

## 5. Варианты, цена, наличие

### 5.1 Состояние

```text
selectedVariantId
```

- **Один ACTIVE вариант** → выбирается автоматически.
- **Несколько** → пользователь выбирает; по умолчанию берём первый доступный (available), иначе первый.
- Вариант — покупаемая опция (Size/Volume/Capacity); одна dimension, без Color × Size матрицы.

### 5.2 Цена

Цена — **серверные данные** варианта (`variants[].price`, `variants[].originalPrice`),
посчитанные в RPC по той же формуле, что и 0014/checkout:

```text
CUSTOM_PRICE + custom_original_amount_minor != null → берём custom
иначе → product.original_amount_minor / product.discount_percent

price = ((original * (100 - discount)) + 50) / 100
originalPrice = original при discount > 0, иначе null
```

UI **не дублирует формулу** (`product-rules.ts` остаётся seller-side; покупатель получает готовые minor units).
Форматирование — `formatMoneyMinor(minor, symbol)`.

- Смена варианта → мгновенно меняется цена в CTA.
- Есть скидка → current + зачёркнутая original.
- Нет скидки → только current.

### 5.3 Наличие

- Наличие — **per-variant** (`inventory.available_quantity`), не «сумма по товару».
- `available = false` (`availableQuantity = 0`) → вариант disabled, выбрать нельзя.
- Все варианты sold out → CTA disabled, состояние **«Нет в наличии»**.
- Sold-out товар на карточке остаётся видимым (как в Home/Catalog) — купить нельзя.
- `held_quantity` публично не отдаём.

### 5.4 Визуал и UX вариантов

- Вариант — **таблетка**; выбранная — акцентная, sold-out — приглушённая и зачёркнутая
  (кнопка `disabled`). Один вариант не растягивается на всю ширину.
- Ряд вариантов **не переносится**: горизонтальный скролл; при переполнении справа —
  **градиент-подсказка**, что есть ещё (сейчас видно ~4 без скролла).
- Справа от подписи (`Размер`) — **визуальный счётчик** количества вариантов
  (иконка + число), вместо `Size Guide` из эскиза.
- Смена варианта мгновенно меняет цену в CTA (у каждого варианта своя цена).

---

## 6. «О товаре»: описание, характеристики, rating, related

### 6.1 Описание

- `product.description`.
- Если длинное — **обрезка в 2 строки** (`-webkit-line-clamp: 2`) + «… Подробнее» → «Свернуть».
- Если короткое (порог ~90 символов) — не обрезаем и кнопку не показываем.
- Реализовано в PD-09 (`ProductAbout`); данные приходят через `<Outlet context={detail}>`.

### 6.2 Характеристики

```text
Характеристики
Материал     Хлопок
Бренд        Nike
Страна       Италия
```

- Источник — `attributes[]` (`product_attributes`), порядок `sort_order`.
- Если пусто — блока нет. Реализовано в PD-09 (список `dl` под описанием).

### 6.3 Linking attributes

- Источник — `linkAttributes[]` (`product_link_attributes`).
- Показываем у названия: `Color: White`. Если пусто — не показываем.
- Реализовано в PD-09 (блок `.pd-link-attrs` в белом листе shell).
- **Зависимость:** seller UI сейчас их не создаёт (`linkAttributes: []`) — наполнятся после `PD-14`.

### 6.4 Рейтинг

- Пилюля с иконкой звезды рядом с названием; считается из `reviews` со `status = ACTIVE`.
- С `count > 0` → `★ 4.5 (12)`; при `count = 0` → `★ 0` (элемент **показывается всегда**,
  т.к. отзывы ещё не функционируют — фиксируем место под будущую оценку).
- Клик/тап по рейтингу → откроет слой «Отзывы» (PD-10).

---

## 7. Related products (явные связи «Связи» / «Похожее»)

**Реализовано в PD-14a/b/c.** Источник — таблица `product_links` (одна каноничная
строка на неупорядоченную пару), а не `product_groups`.

- Связь **двусторонняя** и **без транзитивности**: `A↔B` и `B↔C` → A видит только B,
  B видит A и C, C видит только B (никакой «свалки похожестей»).
- Правила чтения: товары, связанные с текущим (в обе стороны), same store, `status = ACTIVE`,
  исключая текущий; сортировка по `created_at` связи; **без limit** (показываем все связи).
- Нет связей → **пустое состояние** вкладки (не угадываем «похожие» искусственно).
- UI: вкладка **«Похожее»** (`/product/:id/related`) — **сетка мини-карточек в 2 колонки**
  (вертикальный скролл панели): фото (`thumb ?? full`), название (2 строки), цена
  (+ зачёркнутая original), бейдж «Нет в наличии»; тап → `/product/:relatedId`
  (новый shell, новая галерея/варианты).
- Seller-управление — внутри вкладки **«Витрина»** карточки товара (блок «Связи» +
  `LinkProductsSheet` с поиском по всем товарам магазина); `PD-14b`.
- `product_groups` / `product_group_id` — общая группа (в т.ч. будущие варианты) — не используется
  для «Похожее»; `PD-14` не создаёт групп.
- **Linking attributes** (descriptive meta «Color: White» у названия) — вынесено в отдельный
  документ остатков: `16_SHOPPIS_REMAINING_WORK.md` (FD-1).
- AI/«похожие товары»/рекомендации — вне MVP.

---

## 8. Reviews

**Чтение — реализовано в PD-10a.** RPC: `storefront_product_reviews_read(p_public_id, p_product_id, p_viewer_user_id default null)`.
- UI — слой поверх карточки (nested route `/product/:id/reviews`, `SocialLayer`).
- **Гистограмма** (5 горизонтальных столбцов 5★→1★ + счётчики) показывается всегда, включая нули;
  сверху средняя оценка и общее число.
- `distribution` — массив из 5 бакетов `{rating, count}`.
- `ReviewCard`: аватар-инициал, имя автора, звёзды, дата, текст, **ответы** под отзывом.
- Автор/ответчик — только имя из Telegram identity (`first_name` → `username` → «Покупатель»),
  без username-ссылок; user id наружу не отдаём.
- Только `status = ACTIVE`, новые сверху (`created_at desc`), limit `REVIEWS_LIMIT = 50`.
- Пусто → «Пока нет отзывов» (гистограмма с нулями остаётся).
- **Ответы:** покупатель может ответить на *чужой* отзыв (1 раз), продавец — на любой (1 раз),
  таблица `review_replies` (`author_type BUYER/SELLER`, `UNIQUE(review_id, author_user_id)`).
  Удаление ответов — не сейчас.
- `viewerReview` (ACTIVE-отзыв зрителя) и `canReview` (false, если запись уже есть — в т.ч. HIDDEN);
  `isOwn` — на отзыве/ответе для UI действий.
- Запись отзывов/ответов — **PD-10b (реализовано)**: edge `review-actions` + atomic RPC (0017),
  UI-композер (звёзды + необязательный комментарий), удаление своего отзыва, ответ 1 раз;
  ошибки (`ALREADY_REVIEWED`, `DUPLICATE_REPLY`, `CANNOT_REPLY_OWN`, …) маппятся в понятные тексты.
- **Модерация продавца — PD-10c (реализовано):** seller-вкладка «Отзывы» с тем же визуалом
  (гистограмма + карточки); продавец **не** ставит оценку/отзыв, но может **отвечать** и
  **удалять** любой отзыв по своему товару (`review_hide_atomic` владельца); ответ помечен
  бейджем «Продавец»; владелец видит отзывы и у ARCHIVED-товара (миграция `0018`).
- Пагинация/фильтры/сортировка — вне MVP.

---

## 9. Questions (чтение + запись)

**Чтение — PD-11a (выполнено).** RPC:
`storefront_product_questions_read(p_public_id, p_product_id, p_viewer_user_id default null)`.
- UI — слой поверх карточки (nested route `/product/:id/questions`).
- Карточка: вопрос + (если есть) **один** ответ продавца (`question_answers.question_id UNIQUE` → 0..1).
- Нет ответа → показываем только вопрос, **без пустого блока ответа**; статус-пилюля
  **«Без ответа»** / **«Отвечен»**.
- Автор — те же правила, что и у отзывов.
- Правило: **один вопрос на покупателя/товар** (`questions(buyer_user_id, product_id)` UNIQUE в 0019);
  удаление = `HIDDEN` и не восстанавливает право задать снова (`canAsk=false`).
- `viewerQuestion` (ACTIVE-вопрос зрителя) и `canAsk`; `isOwn` на каждом вопросе для UI действий.
- Владелец магазина читает вопросы и у ARCHIVED-товара (owner-exception, как в 0018).
- Только `status = ACTIVE`, новые сверху, limit `QUESTIONS_LIMIT = 50`.
- Пусто → «Пока нет вопросов».
- Пагинация — вне MVP.

**Запись — PD-11b (backend, выполнено) + PD-11c (UI, выполнено).**
- Покупатель (любой авторизованный, без проверки покупки): задаёт 1 вопрос (текст), удаляет **свой**;
  **отвечать не может**.
- Продавец (владелец): **отвечает** на любой вопрос (1 раз) и **удаляет** любой вопрос по своему товару;
  сам задавать вопрос не может.
- Запись только через edge `question-actions` + atomic RPC (actor из серверной сессии), по образцу
  `review-actions`/0017.

---

## 10. Favorite

- Использует существующий `useFavorites()` (`favoritesByStore`, store-scoped).
- Состояния: `♡` / `♥` (заполненное, акцентный/красный цвет); haptic (`selectTick`).
- Никакого backend/новых таблиц.
- ♡ один — в CTA в виде белого круга-кнопки (дублирование у названия не делаем).
- Реализовано в PD-08 (кнопка-сердце в `DetailsCtaBar`).

---

## 11. Add to Cart

- Использует существующий `useCart()`.
- Передаём:

```ts
addToCart({
  productId,
  productVariantId: selectedVariantId,   // обязателен на карточке
  quantity: 1,
  price: selectedVariant.price,          // текущая (со скидкой) цена, minor units
})
```

- Нет выбранного варианта (все sold out) → кнопка `disabled`.
- **Cart ничего не резервирует**; checkout перепроверяет цену и остаток.
- После успеха: haptic `notifySuccess` + **тост «Добавлено в корзину»**.
- Flying-анимация в корзину **не используется** на карточке: глобальный navbar (и иконка
  корзины) на `/product/*` скрыт, цель полёта отсутствует. Вместо неё — тост; лёгкий
  `Toast` читает `UiSlice.toast`/`clearToast` и авто-скрывается (общий компонент, смонтирован в `BuyerLayout`).
- Реализовано в PD-08. **Фидбек усилен в PD-12:** мини-карточка-тост с миниатюрой товара и
  зелёной галочкой (`UiSlice.toast` расширен до `{ id, text, imageUrl? }`) + морф кнопки
  «Добавить в корзину» → «✓ Добавлено» на 1.2с (ширина кнопки стабильна).

---

## 12. Backend / SQL — миграция `0015_storefront_product_detail_read.sql`

### 12.1 Принципы

- Следуем паттерну `0014_storefront_home_read`: `language plpgsql`, `security definer`,
  `set search_path = public`, возврат `jsonb`, camelCase-ключи, `null` для невалидных кейсов,
  `grant execute … to public`.
- Это **публичная проекция** — граница под будущий RLS; buyer не собирает данные напрямую
  из таблиц (никаких `.from('products')` в buyer-репозитории).
- RLS не включаем и не трогаем.

### 12.2 Валидация (общая для всех трёх функций)

```text
p_public_id пустой → null
store по public_id не найден → null
product по id не найден → null
product.store_id != store.id → null
product.status != 'ACTIVE' → null
иначе → данные
```

- `store.status = 'PAUSED'` **возвращается как есть** (не null) — UI сам показывает pause state
  и блокирует покупку; прямой URL не обходит pause.
- Товар archived / чужого магазина → `null` → UI «Товар не найден».

### 12.3 `storefront_product_detail_read(p_public_id text, p_product_id uuid) → jsonb`

```jsonc
{
  "store": {
    "id": "uuid",
    "publicId": "text",
    "name": "text",
    "currencyCode": "USD|RUB|BYN",
    "currencySymbol": "$|₽|Br",
    "status": "ACTIVE|PAUSED"
  },
  "product": {
    "id": "uuid",
    "title": "text",
    "description": "text",
    "categoryId": "uuid|null"          // null, если категория ARCHIVED/удалена
  },
  "images": [
    { "url": "text", "thumbUrl": "text|null", "sortOrder": 0 }
  ],
  "linkAttributes": [
    { "name": "Color", "value": "White" }
  ],
  "attributes": [
    { "name": "Материал", "value": "Хлопок" }
  ],
  "variants": [
    {
      "id": "uuid",
      "name": "Размер",
      "value": "M",
      "price": 249000,                  // текущая цена, minor units
      "originalPrice": 349000,          // null, если скидки нет
      "availableQuantity": 5,
      "available": true
    }
  ],
  "rating": { "average": 4.7, "count": 12 },
  "questionsCount": 3,
  "relatedProducts": [
    {
      "id": "uuid",
      "title": "text",
      "imageUrl": "text|null",          // thumb ?? full
      "price": 249000,
      "originalPrice": null,
      "available": true
    }
  ]
}
```

Правила:

- `images`: все изображения, `order by sort_order asc, created_at asc`; `thumbUrl = nullif(thumb_storage_key,'')`,
  `url = storage_key`; fallback — на клиенте (`thumbUrl ?? url`).
- `linkAttributes` / `attributes`: только по текущему продукту, `order by sort_order asc`.
- `variants`: только `status = 'ACTIVE'`, `order by sort_order asc, created_at asc`;
  `availableQuantity = coalesce(inventory.available_quantity, 0)`;
  `available = availableQuantity > 0`; цена — формула §5.2; `held_quantity` не отдаём.
- `rating`: `avg(rating)` + `count(*)` по `reviews` c `status = 'ACTIVE'`;
  нет отзывов → `average = 0, count = 0` (клиент не показывает рейтинг при `count = 0`).
- `questionsCount`: `count(*)` по `questions` c `status = 'ACTIVE'`.
- `relatedProducts` (переопределено в миграции `0024`): явные связи из `product_links`
  (текущий товар с любой стороны пары), same store, `status = 'ACTIVE'`, `id <> p_product_id`,
  `order by link.created_at asc`, **без limit**; изображение — первое по `sort_order`
  (`coalesce(nullif(thumb,...), nullif(storage,...))`); цена — первого ACTIVE варианта (как в 0014);
  если связей нет → `[]`.
- `categoryId`: `null`, если категория не ACTIVE (join по условию, `products.category_id` не мутируем).

### 12.4 `storefront_product_reviews_read(p_public_id text, p_product_id uuid) → jsonb`

```jsonc
{
  "summary": { "average": 4.7, "count": 12 },
  "reviews": [
    {
      "id": "uuid",
      "authorName": "Алексей",     // first_name → username → «Покупатель»
      "rating": 5,
      "text": "Отличный товар…",
      "createdAt": "2026-10-01T12:00:00Z"
    }
  ]
}
```

- `status = 'ACTIVE'`, `order by created_at desc`, `limit 50`.
- `authorName` — из `telegram_identities` покупателя (первая identity по `created_at`);
  только имя, без username-ссылки и аватара.
- При невалидных условиях (см. §12.2) → `null`.

### 12.5 `storefront_product_questions_read(p_public_id text, p_product_id uuid) → jsonb`

```jsonc
{
  "questions": [
    {
      "id": "uuid",
      "authorName": "Мария",
      "text": "Подойдёт ли размер M?",
      "createdAt": "2026-10-01T12:00:00Z",
      "answer": { "text": "Да, если…", "createdAt": "2026-10-02T09:00:00Z" }  // или null
    }
  ]
}
```

- `status = 'ACTIVE'`, `order by created_at desc`, `limit 50`.
- `answer` — `question_answers` по `question_id` (0..1), без status-колонки.
- При невалидных условиях → `null`.

### 12.6 Backend verification checklist (ручной SQL-прогон, PD-01)

```text
detail:
  unknown public_id → null
  blank public_id → null
  unknown product → null
  product другого магазина → null
  product ARCHIVED → null
  store PAUSED → данные + status PAUSED
  product ACTIVE → полный ответ
images: 0 / 1 / 2 / 4; без thumb → thumbUrl null; порядок sort_order
variants: 1 ACTIVE / много / все stock = 0 / CUSTOM_PRICE / USE_PRODUCT_PRICE /
          ARCHIVED вариант не попадает
rating: 0 / 1 / много; HIDDEN отзыв не учитывается
questionsCount: 0 / с HIDDEN — не учитывается
related: нет группы → []; группа 2 / 4; ARCHIVED участник скрыт; чужой store скрыт;
         текущий исключён; limit 8
reviews read: 0 / 1 / много; HIDDEN скрыт; порядок desc; authorName fallback
questions read: 0 / без ответа / с ответом; HIDDEN скрыт
```

---

## 13. Application layer

### 13.1 Новые файлы

```text
src/application/read-models/storefront-product.ts
src/application/ports/storefront-product-repository.ts
src/application/mappers/storefront-product-mappers.ts
src/infrastructure/repositories/storefront-product-repository.ts
src/application/hooks/useStorefrontProduct.ts
```

### 13.2 Контракты

```ts
// read-models/storefront-product.ts
export interface StorefrontProductDetail {
  store: StorefrontStore;                       // reuse из storefront.ts
  product: { id: string; title: string; description: string; categoryId: string | null };
  images: Array<{ url: string; thumbUrl: string | null; sortOrder: number }>;
  linkAttributes: Array<{ name: string; value: string }>;
  attributes: Array<{ name: string; value: string }>;
  variants: Array<{
    id: string; name: string; value: string;
    price: number; originalPrice: number | null;
    availableQuantity: number; available: boolean;
  }>;
  rating: { average: number; count: number };
  questionsCount: number;
  relatedProducts: Array<{
    id: string; title: string; imageUrl: string | null;
    price: number; originalPrice: number | null; available: boolean;
  }>;
}

export interface StorefrontProductReview {
  id: string; authorName: string; rating: number; text: string; createdAt: string;
}

export interface StorefrontProductQuestion {
  id: string; authorName: string; text: string; createdAt: string;
  answer: { text: string; createdAt: string } | null;
}

export interface StorefrontProductReviews {
  summary: { average: number; count: number };
  reviews: StorefrontProductReview[];
}
```

```ts
// ports/storefront-product-repository.ts
export interface StorefrontProductRepository {
  loadProductDetail(storePublicId: string, productId: string): Promise<StorefrontProductDetail | null>;
  loadProductReviews(storePublicId: string, productId: string): Promise<StorefrontProductReviews>;
  loadProductQuestions(storePublicId: string, productId: string): Promise<StorefrontProductQuestion[]>;
}
```

- Мапперы — defensive, тем же стилем, что `mapStorefrontHome`; `storage_key`-значения
  считаются готовыми URL (не достраиваем).
- Репозиторий — RPC: `storefront_product_detail_read` / `..._reviews_read` / `..._questions_read`,
  `if (error) throw error`.
- Регистрация: `AppContainer.storefrontProductRepository` + `composition-root.ts`.

### 13.3 Хуки

```ts
useStorefrontProduct(publicId: string | null, productId: string | null)
  → { detail, loading, error, notFound, refresh }

useStorefrontProductReviews(publicId, productId, enabled)   // enabled = слой открыт
  → { reviews, summary, loading, error, refresh }

useStorefrontProductQuestions(publicId, productId, enabled)
  → { questions, loading, error, refresh }
```

- Query keys:

```text
['storefront-product', publicId, productId]
['storefront-product-reviews', publicId, productId]
['storefront-product-questions', publicId, productId]
```

- Состояния — по образцу `useStorefrontHome`: `enabled = Boolean(publicId && productId)`,
  `notFound = isSuccess && data === null`, `error = message`.
- Слои грузятся только при открытии (`enabled`) — 50 отзывов не едут вместе с товаром.
- Summary для слоя отзывов приходит в ответе reviews-RPC (`{summary, reviews}`) — отдельный
  запрос не нужен; `detail.rating` остаётся источником для шапки карточки.

### 13.4 Cleanup

- `src/application/store/slices/review-slice.ts` — мёртвый код (нет UI-потребителей,
  комментарий «в БД их нет» устарел). Удаляем вместе с проводкой в `store/index.ts`,
  `create-store.ts` и `src/domain/models/review.ts` (импортируется только слайсом).
- Новые social-модели живут в `read-models/storefront-product.ts`; доменные модели для
  записи отзывов появятся в следующем блоке.

---

## 14. Presentation layer

### 14.1 Файлы

```text
src/presentation/buyer/views/DetailsView.tsx            // (изменяется) layout shell
src/presentation/buyer/views/product/ProductAbout.tsx
src/presentation/buyer/views/product/ProductReviewsView.tsx
src/presentation/buyer/views/product/ProductQuestionsView.tsx
src/presentation/buyer/views/product/ProductRelated.tsx      // вкладка «Похожее»
src/presentation/buyer/components/product/ProductGallery.tsx
src/presentation/buyer/components/product/VariantSelector.tsx
src/presentation/buyer/components/product/ProductTabsBar.tsx
src/presentation/buyer/components/product/RelatedProducts.tsx
src/presentation/buyer/components/product/DetailsCtaBar.tsx
src/presentation/buyer/components/product/ProductDetailSkeleton.tsx
src/presentation/buyer/components/product/SocialLayer.tsx      // общий слой (header+scroll+safe-area)
src/presentation/buyer/components/product/ReviewCard.tsx
src/presentation/buyer/components/product/QuestionCard.tsx
src/presentation/buyer/product-detail.css
```

### 14.2 Было → стало

```text
БЫЛО:
/ product/:id → DetailsView (PlaceholderScreen)
  BuyerLayout всегда с FloatingNavBar

СТАЛО:
/ product/:id → DetailsView (shell: галерея, инфо, CTA, Outlet)
   ├── index      → ProductAbout
   ├── reviews    → ProductReviewsView   (слой)
   └── questions  → ProductQuestionsView (слой)
BuyerLayout скрывает FloatingNavBar на /product/*
```

### 14.3 Переиспользование

- `BackButton` — назад из карточки/слоя (с fallback `/`).
- `BottomSheet` — возможная база слоя (или собственный `SocialLayer` на framer-motion;
  выбираем на PD-10 — что даст одинаковое поведение со слоями без сюрпризов).
- `useImageFallback` — битые изображения (галерея, related).
- `useHaptic` — выбор фото/варианта, favorite, add-to-cart.
- `FavoriteButton` — если подходит по визуалу CTA; иначе — inline-кнопка с той же логикой.
- `useOpenTelegramLink` — share через `https://t.me/share/url` (ссылка на магазин + название
  товара); product deep-link вне MVP.
- `UiSlice` — toast и flying-анимация.

---

## 15. Loading / empty / error states

| Состояние | Поведение |
|---|---|
| Loading | skeleton: фото, название, цена, варианты, контент (без «Загрузка…» и без layout jump) |
| Product not found / archived / чужой | «Товар не найден» + `← Вернуться` |
| Store PAUSED | pause state (как Home/Catalog `StoreStatusView`), покупка заблокирована |
| Нет отзывов | «Пока нет отзывов» |
| Нет вопросов | «Пока нет вопросов» |
| Нет группы / related пусто | блок «Другие варианты» **не показываем** |
| Описание короткое | «Подробнее» не показываем |
| Нет характеристик / link attrs | соответствующий блок не показываем |
| Все варианты sold out | «Нет в наличии», CTA disabled |
| Изображение не загрузилось | плейсхолдер (буква), без разрыва layout |

---

## 16. Motion (PD-12 — реализовано)

- Слои: вход `initial y: 100% → animate y: 0` (spring); выход `y: 0 → 100%` по кнопке «назад»
  с self-managed закрытием (навигация после `onAnimationComplete`). Портал сохранён.
- Галерея: плавная смена main (фейд); активная миниатюра; без layout shift.
- Fullscreen-просмотр: плавное появление; **зум** — пинч (1×…4×), двойной тап (2.5×/сброс),
  панорамирование при увеличении, ограничение по границам.
- Favorite: «pop» сердца при переключении + `whileTap`.
- Add-to-cart: haptic + мини-тост с миниатюрой/галочкой (2с) + морф кнопки «✓ Добавлено» (1.2с).
- Уважаем `prefers-reduced-motion` — глобально через `<MotionConfig reducedMotion="user">`
  (transform/layout отключаются, opacity/color сохраняются) + существующие CSS media queries.
- Анимации делаются **после** функциональности (PD-12), сначала — корректные данные/скролл.

---

## 17. Performance

- Один RPC на detail; social-запросы — только при открытии слоя (lazy `enabled`).
- Кэш React Query: detail — `staleTime 5 мин` (глобальный), social — тоже; `refetchOnWindowFocus: false`.
- Main — full, миниатюры/related — thumb; `loading="lazy"` для миниатюр/related, main — eager.
- Никаких N+1: images/attributes/variants/related/review aggregate — внутри одного ответа detail-RPC.
- Кэш инвалидируется точечно (favorite/cart — локальный Zustand, инвалидация не нужна).

---

## 18. Этапы разработки

Последовательность неизменна. Один этап за раз: реализация → `typecheck`/`lint`/`test` →
ручная сверка владельцем → следующий этап. Каждый глобальный этап имеет два состояния:
`LOCAL VERIFIED` и `TELEGRAM VERIFIED`.

**Статус:** `PD-01 — выполнено` (миграция `0015_storefront_product_detail_read.sql` применена;
3 `security definer` RPC с `search_path=public`; чек-лист §12.6 пройден на фикстурах + PostgREST-путь).
`PD-02 — выполнено` (read-model + порт + маппер + infra-репозиторий, регистрация в
`AppContainer`/`composition-root`, удаление мёртвого `review-slice`; +23 теста).
`PD-03 — выполнено` (хуки `useStorefrontProduct`, `useStorefrontProductReviews`,
`useStorefrontProductQuestions` с loading/error/notFound/refresh и ленивым `enabled`; +11 тестов).
`PD-04 — выполнено` (вложенные маршруты `/product/:id` + `index/reviews/questions`,
`DetailsView` — layout-shell с `<Outlet/>`, `BuyerLayout` скрывает `FloatingNavBar` на `/product/*`; +6 тестов).
`PD-05 — выполнено` (каркас + визуал под эскиз: фото `50dvh` с back/share в углах, белый лист,
голубая панель вкладок, плавающий CTA без полосы, 4 вкладки (+ «Похожее»),
skeleton/not found/paused/error; `product-detail.css`; +6 тестов).
`PD-06 — выполнено` (галерея: `activeIndex`, main `contain`, миниатюры внутри блока фото снизу
по центру, активное фото исключается из ряда, swap + haptic; fullscreen-просмотр; +8 тестов).
`PD-07 — реализовано, ожидает ручной проверки владельцем` (рейтинг-пилюля видна всегда (0);
выбор варианта с ценой и availability, sold-out `disabled`; визуальный счётчик вариантов;
горизонтальный скролл + градиент-подсказка при переполнении; цена в CTA меняется по варианту;
+8 тестов).
`PD-08 — реализовано, ожидает ручной проверки владельцем` (избранное в CTA (store-scoped,
заполненное сердце + haptic); добавление в корзину: `productId + variantId + qty 1 + price`,
haptic-success + тост «Добавлено в корзину»; лёгкий `Toast` смонтирован в `BuyerLayout`;
flying в корзину не используется — navbar на `/product/*` скрыт; +8 тестов).
`PD-09 — реализовано, ожидает ручной проверки владельцем` (вкладка «О товаре»: описание с обрезкой
в 2 строки + «… Подробнее»/«Свернуть»; характеристики из `attributes[]` (нет — блока нет);
link-атрибуты у названия; данные через `<Outlet context>`; «Похожее» не трогали; +3 теста).
`PD-10a — выполнено` (миграция `0016`: таблица `review_replies` + read-RPC с
`distribution`/`replies`/`viewerReview`/`canReview`/`isOwn`; слой `SocialLayer` + гистограмма +
`ReviewCard` с ответами).
`PD-10b — реализовано, ожидает ручной проверки владельцем` (миграция `0017` + edge `review-actions`
(задеплоена): `review_create_atomic` / `review_hide_atomic` / `review_reply_create_atomic`;
порт `ReviewApi` + `review-api`, хуки `useReviewActions` с инвалидацией; UI: композер (звёзды +
необязательный текст), «мой отзыв» с удалением, ответ на чужой отзыв 1 раз, маппинг ошибок;
+17 тестов). `PD-10c — реализовано, ожидает ручной проверки владельцем` (seller-вкладка «Отзывы»: тот же визуал
(гистограмма + карточки), без композера; ответ на отзыв и **удаление любого отзыва** своего магазина;
ответ помечен бейджем «Продавец»; владелец видит отзывы и у архивных товаров — миграция `0018`;
+6 тестов).
`PD-11a — выполнено` (миграция `0019_question_social.sql`: unique `questions(buyer_user_id, product_id)`
+ viewer-aware `storefront_product_questions_read(p_public_id, p_product_id, p_viewer_user_id)` с
`questions[].isOwn`, `viewerQuestion`, `canAsk` и owner-exception для ARCHIVED (как 0018); read-model,
mapper, repo и hook обновлены — лента вопросов теперь объект `{ questions, viewerQuestion, canAsk }`;
тесты mapper/repo/hook обновлены). `PD-11b — выполнено` (миграция `0020_question_write.sql` + edge `question-actions` (задеплоена):
`question_create_atomic` / `question_hide_atomic` / `question_answer_create_atomic`; покупатель — 1 вопрос
на товар, удаление своего; продавец (владелец) — ответ 1 раз и удаление любого вопроса своего товара;
порт `QuestionApi` + `question-api`, `useQuestionActions` с инвалидацией; ручной SQL-прогон §12.6-стиля
пройден: create/ALREADY_ASKED,answer/DUPLICATE_ANSWER/FORBIDDEN, hide, canAsk/viewerQuestion).
`PD-11c — реализовано, ожидает ручной проверки владельцем` (`QuestionCard` + статусы «Без ответа»/«Отвечен»,
`QuestionComposer` (кнопка «Задать вопрос» → поле), buyer-слой (задать 1 вопрос, удалить свой, без ответов),
seller-вкладка (ответ 1 раз + удаление любого вопроса, без композера); CSS; +22 теста).
`PD-12 — реализовано, ожидает ручной проверки владельцем` (глобальный
`<MotionConfig reducedMotion="user">`; вход/self-managed выход слоёв Отзывы/Вопросы; сохранение
позиции скролла shell (`useScrollToTop` + «О товаре» под слоем); фейд галереи; зум/панорама в
fullscreen; «pop» сердца; мини-тост с фото + морф кнопки «✓ Добавлено»; motion-тесты
`BackButton`/`SocialLayer`/`useScrollToTop`/`DetailsCtaBar`/`Toast`).
`PD-14a — выполнено` (миграция `0025_product_link.sql`: таблица `product_links` + `product_link_add_atomic`/
`product_link_remove_atomic` + пересоздан `storefront_product_detail_read` с `relatedProducts` из связей,
обе стороны, без транзитивности, без limit; edge `catalog-actions` += `product-link-add/remove`
(задеплоена); модель `ProductLink` + `catalog-api` + `product-repository` + `product-slice`; ручной SQL-прогон:
A↔B/B↔C → A видит только B, B — A+C; SELF_LINK/SAME_STORE_REQUIRED/FORBIDDEN).
`PD-14b — реализовано, ожидает ручной проверки владельцем` (seller: вкладка «Витрина» → блок «Связи» +
`LinkProductsSheet` (поиск по всем товарам, связать/убрать); CSS; тесты).
`PD-14c — реализовано, ожидает ручной проверки владельцем` (buyer «Похожее»: сетка мини-карточек
в 2 колонки, вертикальный скролл, тап → товар, пустое состояние; тесты).
`PD-13 — реализовано (код-level QA), ожидает ручной проверки владельцем (LOCAL + TELEGRAM)`:
сверка §20 против кода, полировка loading/empty/error; robustness-фикс — битые/пустые фото
в «Похожее» и списке «Связей» теперь через единый `SafeImage` (плейсхолдер вместо broken image);
`typecheck`/`lint`/`test` зелёные. Финальные `LOCAL VERIFIED` + `TELEGRAM VERIFIED` (iOS/Android/
Desktop) — за владельцем. Отложенное вынесено в `16_SHOPPIS_REMAINING_WORK.md`
(linking attributes — FD-1; preview в «Витрине» — FD-2; экраны Cart/Favorites/Orders — FD-3 и т.д.).
Предпосылки (`H-01…H-11`, seller-домен) выполнены.

### Этап 1 — SQL read layer `[PD-01]`

- Миграция `0015_storefront_product_detail_read.sql`:
  - `storefront_product_detail_read(p_public_id text, p_product_id uuid)`;
  - `storefront_product_reviews_read(p_public_id text, p_product_id uuid)`;
  - `storefront_product_questions_read(p_public_id text, p_product_id uuid)`;
  - `security definer`, `search_path = public`, `grant execute to public`.
- Ручной SQL-чеклист §12.6 (все негативные и позитивные кейсы).

### Этап 2 — Contracts + repository `[PD-02]`

- `read-models/storefront-product.ts`, порт, мапперы (defensive), infra-репозиторий.
- Регистрация в `AppContainer` + `composition-root.ts`.
- Удаление мёртвого `review-slice` (+ `domain/models/review.ts`).
- Тесты маппера и репозитория.

### Этап 3 — Hooks `[PD-03]`

- `useStorefrontProduct`, `useStorefrontProductReviews`, `useStorefrontProductQuestions`.
- Тесты: loading / success / null → notFound / error / refresh, `enabled`.

### Этап 4 — Routing + immersive layout `[PD-04]`

- Nested routes `/product/:id` + index/reviews/questions, `DetailsView` → shell layout.
- `BuyerLayout`: скрытие `FloatingNavBar` на `/product/*`; тесты.

### Этап 5 — Detail shell `[PD-05]`

- Header (back/share), галерея-каркас, identity, цена, варианты-каркас, вкладки, CTA, skeleton,
  notFound / PAUSED. Без сложных анимаций.
- Share через `t.me/share/url` (не критично, можно отложить).

### Этап 6 — Gallery `[PD-06]`

- Main + миниатюры, swap, fallback thumb → full, активная миниатюра, 0–4 фото, no layout shift.
- Тесты логики выбора.

### Этап 7 — Варианты / цена / наличие `[PD-07]`

- `selectedVariantId`, авто-выбор единственного, disabled sold-out, «Нет в наличии»,
  цена меняется по варианту, зачёркнутая original.
- Тесты состояний.

### Этап 8 — Favorite + Add to Cart `[PD-08]`

- Подключение `useFavorites` и `useCart`, передача `productId + variantId + qty 1 + price`,
  haptic/toast/flying (если подходит).
- Тесты.

### Этап 9 — «О товаре» + «Похожее» `[PD-09]`

- Описание («Подробнее» только при обрезке), характеристики, linking attributes, рейтинг;
  related-вкладка («Похожее») наполнена в `PD-14c` (явные связи, сетка 2 колонки).
- Тесты.

### Этап 10 — Reviews layer `[PD-10]`

- Ленивая загрузка, summary, `ReviewCard`, empty state, слой поверх shell.
- Тесты.

### Этап 11 — Questions layer `[PD-11]`

- Ленивая загрузка, `QuestionCard` (0..1 ответ, без пустого блока), empty state.
- Тесты.

### Этап 12 — Motion + polish `[PD-12]` — выполнено

- Слои: вход `y: 100% → 0`, self-managed выход по кнопке «назад»; сохранение состояния
  (фото/вариант/скролл), safe-area, собственный scroll слоёв.
- Reduced-motion: глобальный `MotionConfig reducedMotion="user"` + существующие CSS media queries.
- Галерея: фейд смены main. Fullscreen: плавное появление + зум/панорама.
- Favorite: «pop» сердца. Add-to-cart: мини-тост с миниатюрой/галочкой + морф кнопки.

### Этап 13 — QA + Definition of Done `[PD-13]` — выполнено (код-level)

- QA-матрица §20 сверена с кодом; loading/empty/error закрыты; robustness: битые/пустые фото
  в «Похожее»/«Связях» — через `SafeImage` (плейсхолдер вместо broken image).
- `typecheck`/`lint`/`test` зелёные. `LOCAL VERIFIED` + `TELEGRAM VERIFIED` — ручная проверка
  владельцем (iOS/Android/Desktop).

### Этап 14 — «Связи» (Related) + seller UI `[PD-14]` — выполнено

- **Модель:** явные двусторонние связи `product_links` (одна каноничная строка на пару),
  без транзитивности; `product_group_id` не используется (остаётся дремать).
- **Backend (PD-14a):** миграция `0024` — таблица + `product_link_add_atomic`/`product_link_remove_atomic`
  + `storefront_product_detail_read.relatedProducts` из связей (обе стороны, ACTIVE, без limit);
  edge `catalog-actions` += `product-link-add/remove`; слой repo/slice/api.
- **Seller UI (PD-14b):** вкладка «Витрина» → блок «Связи» + `LinkProductsSheet` (поиск по всем
  товарам магазина, связать/убрать).
- **Buyer (PD-14c):** вкладка «Похожее» → сетка мини-карточек в 2 колонки (вертикальный скролл).
- **Отложено:** редактор linking attributes (descriptive meta) — перенесено в `16_SHOPPIS_REMAINING_WORK.md` (FD-1).

### Следующие блоки (вне этого документа)

1. Экраны Cart / Favorites / Orders (сейчас `return null`).
2. Пагинация/фильтры/сортировка social-лент; удаление ответов продавца.
3. RLS-hardening публичных данных (общая граница проекта, docs/08/11).

> Покупатель пишет отзыв/вопрос и seller-цикл (ответ на отзыв/вопрос, удаление/скрытие)
> завершены в этом блоке: отзывы — `PD-10b/10c`, вопросы — `PD-11b/11c`.

---

## 19. Tests

### Unit
- gallery selection (swap, 0–4 фото, fallback);
- variant selection (single auto, sold-out, all sold-out);
- цена варианта (current/original, discount/no discount — по серверным полям);
- related filtering (нет группы, исключение текущего).

### Mapper
- full/thumb, цены, варианты, доступность, атрибуты, rating summary, related, пустые ответы,
  битые/неполные данные → безопасный дефолт.

### Repository
- корректные RPC-имена и параметры, `error → throw`, `null → null`, маппинг ответа.

### Hook
- loading / success / notFound / error / refresh / disabled (нет publicId/productId).

### UI
- клик по товару с Home/Catalog → detail;
- галерея: клик по миниатюре;
- варианты: выбор, sold-out disabled, все sold-out;
- favorite, add to cart;
- вкладки: reviews/questions, back → detail с сохранённым состоянием;
- related → новый товар;
- notFound / PAUSED / empty states.

### Navigation
```text
Home → Product → Reviews → Back → Product (состояние сохранено)
Product → Related product → Product
```

---

## 20. QA matrix

| Сценарий | Должно работать |
|---|---|
| 1 / 2 / 3 / 4 фото | ✅ |
| Переключение фото, swap | ✅ |
| Full / thumb | ✅ |
| Нет thumb | fallback |
| Нет варианта | нельзя купить |
| Один вариант | выбран автоматически |
| Несколько вариантов | пользователь выбирает |
| Sold-out вариант | disabled |
| Все sold-out | «Нет в наличии», CTA disabled |
| Разная цена вариантов | цена меняется |
| Скидка | current + зачёркнутая original |
| Без скидки | только current |
| Description | отображается, «Подробнее» при обрезке |
| Attributes / link attributes | отображаются |
| Rating | из реальных ACTIVE отзывов |
| Favorite | работает, store-scoped |
| Add to cart | передаёт variant и price |
| Reviews | реальные данные БД |
| Questions + answer | реальные данные БД |
| Related | только явные связи `product_links` (двусторонние, без транзитивности) |
| Archived product | недоступен |
| Paused store (в т.ч. прямой URL) | покупка заблокирована |
| Back из слоя | состояние карточки сохранено |
| Telegram safe area | корректно |
| iOS / Android / Desktop Telegram | проверка |

---

## Приложение A. Что намеренно НЕ делаем сейчас

❌ свайп-карусель (в просмотре — только миниатюры) · ❌ photo editor ·
❌ color × size matrix · ❌ автоматические рекомендации · ❌ AI similarity ·
❌ backend favorites · ❌ сложные review-фильтры · ❌ сортировка отзывов ·
❌ пагинация вопросов · ❌ seller chat · ❌ отдельные экраны Material / Brand ·
❌ доставка / delivery information · ❌ промокоды

> Зум и жесты в fullscreen-просмотре **включены** (PD-12), в отличие от ранней версии плана.

Вне блока (следующие блоки): экраны Cart/Favorites/Orders, пагинация/фильтры social-лент,
удаление ответов продавца, RLS-hardening.

---

## Приложение B. Прототип (визуальное направление)

За основу визуала берём мокап карточки (Zara-style): светлый фон, крупное фото,
миниатюры под ним, sticky CTA, скругления, минимализм. Функционально адаптируем под нашу
модель (§2.3): вместо `Material`/`Brand` — «Вопросы»; вместо `Size Guide` — ничего;
цена и кнопка привязаны к выбранному варианту.

Файл прототипа (опционально): `docs/assets/buyer-product-detail-proto.png`.

---

## Приложение C. Зафиксированные решения (decision log)

1. Отдельный read-model `StorefrontProductDetail`; Home не расширяем.
2. Buyer Product Detail ≠ seller `ProductView`; seller `useProductDetail` не подключаем.
3. Публичный доступ — только через `security definer` RPC; RLS не трогаем.
4. Галерея без новых полей БД: main = full, миниатюры = thumb (fallback full);
   активное фото возвращается в миниатюры.
5. Цена/наличие — серверные per-variant данные; UI не дублирует формулу цены.
6. Отзывы/вопросы в этом блоке — только чтение; отдельные RPC и React Query.
7. Автор отзыва/вопроса — только имя (first_name → username → «Покупатель»).
8. Будущий блок записи отзывов: любой авторизованный покупатель, 1 отзыв на товар,
   без проверки факта покупки в MVP (в БД уже `UNIQUE (buyer_user_id, product_id)`).
9. «Похожее» — **явные двусторонние связи `product_links`** (одна каноничная строка на пару),
   **без транзитивности**; нет связей → пустое состояние; вкладка «Похожее» (4 вкладки);
   seller-управление — в «Витрине» (`PD-14b`). `product_groups` для Related не используем.
   Buyer-раскладка — сетка в 2 колонки с вертикальным скроллом. Лимит связей не ставим.
   Linking attributes (descriptive meta) — вынесено в `16_SHOPPIS_REMAINING_WORK.md` (FD-1).
10. На `/product/*` глобальный navbar скрыт (immersive); CTA карточки заменяет его.
11. Отзывы/вопросы — слои поверх shell; навигация nested routes; состояние shell сохраняется.
12. Paused store на прямом URL → pause state, покупка заблокирована.
13. Share — `t.me/share/url` (ссылка на магазин + название); product deep-link вне MVP.
14. `held_quantity` публично не раскрывается.
15. Рейтинг/счётчики — только по `ACTIVE` отзывам/вопросам.
16. `review-slice` удаляется как мёртвый код; источник истины — БД.
17. Fullscreen-просмотр фото включён (клик по главному фото): оверлей через портал,
    переключение миниатюрами; **зум/пинч/двойной тап/панорама включены** (PD-12).
18. Фидбэк добавления в корзину на карточке — haptic + мини-тост (`Toast` из `UiSlice`,
    с миниатюрой/галочкой) + морф кнопки «✓ Добавлено»;
    flying-анимация к корзине не используется, т.к. navbar на `/product/*` скрыт.
18a. Motion (PD-12): слои и оверлеи на `framer-motion`; reduced-motion — глобально через
    `MotionConfig reducedMotion="user"`; закрытие слоя self-managed (навигация после
    `onAnimationComplete`); `useScrollToTop` не сбрасывает скролл при переходах «О товаре ↔ слой»
    внутри одного товара.
19. Отзывы: гистограмма (5 столбцов) показывается всегда, включая нули.
20. Отзывы: отвечать могут и покупатель (1 раз на чужой), и продавец (1 раз); таблица
    `review_replies` + `author_type`; удаление ответов — не сейчас.
21. Отзывы: комментарий опционален (можно только оценку); повторный отзыв невозможен
    (`canReview=false` при любой записи, включая HIDDEN).
22. Запись отзывов/ответов идёт **только через edge `review-actions`**: `actor_user_id` берётся
    из серверной сессии, клиент его не передаёт; правила проверяются в atomic PL/pgSQL. RLS
    остаётся отложенным hardening (см. 08/11) — это общая граница проекта.

---

## Приложение D. Зависимости и риски

| Риск / зависимость | Влияние | Решение |
|---|---|---|
| Экраны Cart / Favorites / Orders пусты | нельзя визуально проверить добавление | вне блока; проверяем через стор/тосты; отдельные блоки |
| Связи «Похожее» не создаются в seller UI | вкладка «Похожее» пуста | закрыто `PD-14b` (блок «Связи» в «Витрине») |
| linking attributes не создаются в seller UI | meta у названия пусто | перенесено в `16_SHOPPIS_REMAINING_WORK.md` (FD-1) |
| `storage_key` содержит публичный URL (legacy-имя) | двойное достраивание URL | маппер не строит URL |
| RLS выключен | публичные данные | только RPC с валидацией внутри |
| `review-slice`/`models/review.ts` | устаревшая правда о БД | удаляем в PD-02 |
| Telegram QA | ручная проверка | iOS / Android / Desktop в PD-13 |

---

## Приложение E. Definition of Done (для этапов PD-01…PD-14)

- [ ] TypeScript types
- [ ] loading / empty / error
- [ ] negative case (archived / чужой магазин / not found / paused)
- [ ] tests
- [ ] migration (где применимо)
- [ ] no unrelated refactor
- [ ] `npm run typecheck` + `npm run lint` + `npm run test` зелёные
- [ ] LOCAL VERIFIED (браузер)
- [ ] TELEGRAM VERIFIED (Mini App)
