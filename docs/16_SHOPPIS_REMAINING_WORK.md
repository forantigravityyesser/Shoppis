# SHOPPIS — REMAINING WORK (незавершённое / отложенное)

**Назначение:** единый реестр того, что **ещё не реализовано** или **сознательно отложено**
(продуктовые пробелы и follow-up'ы). Дополняет, не заменяет:
- `11_SHOPPIS_HARDENING_BACKLOG.md` — архитектурный hardening (RLS, тесты, DRY, косметика);
- `08_SHOPPIS_DOCS_CODE_DIVERGENCE_v0.3.md` — расхождения кода и документации.

Статусы: `TODO` · `DEFERRED` (сознательно позже) · `DECIDE` (нужно решение).

---

## FD — Product Detail / Storefront (follow-up к `14`)

### FD-1. Редактор linking attributes — `TODO` (перенесено из PD-14)
- **Что:** descriptive/differentiating meta у названия карточки (напр. `Color: White`).
- **Сейчас:** buyer уже умеет отображать `detail.linkAttributes` / `Product.linkAttributes`
  (блок `.pd-link-attrs` в `DetailsView`), БД-таблица `product_link_attributes` есть,
  `product-repository` читает/пишет их. **Но seller-форма всегда отправляет `linkAttributes: []`** —
  UI-редактора нет, поэтому у покупателя блок всегда пуст.
- **Сделать:** редактор в seller `ProductForm` (создание/редактирование), проброс через
  `NewProductInput.linkAttributes`/`UpdateProductPatch.linkAttributes` (поле уже есть в контрактах),
  проверка `buildProductDetail`/`useProductDetail` (сейчас link-атрибуты могут отбрасываться в
  seller-вьюхе — уточнить) и отображения у покупателя.
- **Почему отложено:** вынесено из `PD-14`, чтобы сфокусироваться на «Связях». Спецификация —
  `02 §2` (три концепции атрибутов), `03` (ProductLinkAttribute).

### FD-2. Preview покупательской карточки в seller «Витрине» — `DEFERRED`
- **Что:** вкладка «Витрина» сейчас содержит только блок «Связи» (PD-14b). Живой предпросмотр
  карточки глазами покупателя не сделали.
- **Сделать:** встроить read-only рендер карточки (можно переиспользовать buyer-компоненты с
  публичной проекцией `storefront_product_detail_read`).

### FD-3. Экраны Cart / Favorites / Orders (buyer) — `TODO` (частично)
- **Cart:** ✅ реализован — `18_SHOPPIS_CART_PLAN.md`, этапы `CART-01…CART-06`: read-model `CartItemView`
  (RPC `storefront_cart_items_read`, `0036`), реконсиляция, selection/select-all, inline-удаление,
  один итог в CTA, checkout-форма (ФИО / телефон / **адрес доставки**), экран успеха, серверный гейт
  уведомлений (`notifications_enabled`). Осталось: ручная проверка в Telegram.
- **Favorites:** ✅ реализован (`FavoritesView`, storefront-hydration по id).
- **Orders:** остаётся заглушкой (`OrdersView` → `null`). Фундамент готов: `fetchBuyerOrders` заполняет
  `ordersByStore`, заказ создаётся атомарно, `lastOrder` доступен после оформления. Нужен экран
  списка/деталей заказа.
- **Док:** `08 §2.11`, `11` S3 «Placeholder-экраны покупателя», `18`.

### FD-4. Social follow-ups — `DEFERRED`
- Пагинация / фильтры / сортировка лент отзывов и вопросов.
- Удаление **ответов** продавца (сейчас удаляются только отзывы/вопросы).
- **Док:** `14` §8/§9, приложение A.

### FD-5. `product_groups` / `product_group_id` не используются — `DECIDE`
- **Сейчас:** «Похожее» — на явных связях `product_links`; `product_groups` (и
  `products.product_group_id`) остаются неиспользуемыми.
- **Решение:** либо удалить (чистка схемы), либо задействовать под будущую группировку
  (напр. варианты одного товара). **Док:** `14` §7, `02 §1`.

### FD-6. Воспринимаемая загрузка карточки: blur-up + prefetch — `DEFERRED` (после всего приложения)
- **Что:** сгладить «холодные» ~1–2 с при первом открытии товара (архитектурно всё ок —
  это плата за ленивую загрузку, а не лаг).
- **Сейчас:** при входе в `/product/:id` идёт один RPC (`storefront_product_detail_read`)
  + загрузка full-фото; пока грузится — светлый фон галереи, затем `opacity 0→1`.
- **Идея (3 независимых рычага):**
  1. **Blur-up (LQIP):** мгновенно показать размытый `thumbUrl` (он **уже в кэше браузера**
     из списка), затем кроссфейд в full по `onLoad`. Доп. запрос не нужен — почти бесплатно.
  2. **Prefetch по намерению:** на `touchstart`/`pointerdown` по карточке —
     `queryClient.prefetchQuery(['storefront-product', publicId, id])` + `new Image().src = fullUrl`,
     чтобы запрос ушёл до навигации (реальная задержка ↓).
  3. **Skeleton** (`ProductDetailSkeleton`) — структура; дополняет, не заменяет.
- **Подводные камни:** зарезервировать `aspect-ratio` (4:5) против layout shift; размывать
  маленький thumb (`filter: blur(8px)`), а не full; выгружать thumb после `onLoad`; повторять
  геометрию `contain`; уважать `prefers-reduced-motion` (глобальный `MotionConfig`).
- **Почему отложено:** оптимизация воспринимаемой скорости сверх текущего pass'а
  (аудит: не расползаться). Делать как отдельное дополнение после основных блоков.
- **Док:** `14` §17.

---

## HB — Hardening / инфраструктура (детали в `11`)

- **RLS + закрытие anon-доступа (S1)** — гейт перед продом (`11` §S1, `08 §1.9`).
- **Критические SQL/интеграционные тесты** — идемпотентность checkout, гонка за последним
  стоком, RPC-переходы заказов, инварианты инвентаря (`11` §S2 «Тесты»).
- **Warning-и** `react-hooks/set-state-in-effect` (7 шт.) и `react-refresh` — `11` §S3/§S4.
- **DRY в ботах**, CSS-чистка, `npm audit` (valibot) — `11`.
- **Home infinite-query memory (`maxPages`)** — `DEFERRED`: все загруженные страницы остаются
  в `query.data.pages`/DOM. Лимит страниц делать вместе с виртуализацией списка (иначе теряются
  просмотренные карточки). Детали — `15 §17.1`.
- **Единый SQL-хелпер effective price (`fn_effective_price`)** — `DEFERRED`: формула
  `((original_amount_minor * (100 - discount_percent)) + 50) / 100` продублирована SQL-логически в
  `0004`, `0014`, `0015`, `0022`, `0023`, `0025`, `0026`, `0030_related`, `0033`. Вынос в общий
  helper — отдельный backend hardening, сознательно вне Catalog (`17` CAT-01/§9.2).
- **Migration hygiene / tracking** — `DONE (0034)`: проектные миграции теперь трекаются в
  `public.schema_migrations` (baseline `0001..0034`, `REVOKE` у `anon`/`authenticated`);
  `npm run migrations:check` ловит дубли/пропуски/битые имена, `npm run migrations:record -- <NNNN>`
  фиксирует применение, конвенция — `migrations/README.md`. InsForge CLI `db migrations` **не
  используется**: требует timestamp-версий и hyphen-имён и не умеет backfill — ретрофит невозможен
  без массового переименования; см. README.

---

## AR — Архитектурные/продуктовые блоки (roadmap)

- **Каталог server-side** — **сделан** (`17`, CAT-00…CAT-16): read-model `0026`, hardening `0033` (PAUSED-boundary + literal search), reorder категорий `0027`, application-контур, URL/поиск/фильтр/pagination/состояния. Осталось: ручная визуальная проверка в Telegram (`TELEGRAM VERIFIED`); RLS — отдельный гейт (`11 §S1`); trigram-индекс — по замеру (`17 §9.2`).
- **Доставка / промокоды / рекомендации / чат с продавцом** — вне MVP.
