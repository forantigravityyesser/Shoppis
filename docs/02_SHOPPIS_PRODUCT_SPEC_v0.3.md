# SHOPPIS — PRODUCT SPECIFICATION

**Version:** 0.3  
**Актуализировано:** 2026-10-14 (ревизия документации, партия 1: `01`, `02`). Полная сверка с
текущей реализацией: онбординг продавца, entry points/боты, i18n, профиль покупателя, список
магазинов, статусы фич. Где поведение ещё не реализовано — явно помечено `ПЛАН`.

## 1. Product card architecture

### Product = one concrete card
Example:
- Nike T-shirt — White
- Nike T-shirt — Black
- Nike T-shirt — Olive

These are separate Product cards. Each has its own photos, attributes, variants, stock and pricing.

### Связь карточек (текущая реализация)
Связь карточек — **явная** (`product_links`), редактируется продавцом из карточки товара
(вкладка «Витрина» → блок «Связи», `14 PD-14b`). Покупатель видит их как «Похожие товары»
(related) на карточке товара.

`ProductGroup` / `products.product_group_id` в схеме зарезервированы, но **в UI не используются**:
статус `DECIDE` (`16 FD-5`) — либо удалить при чистке схемы, либо задействовать под будущую
группировку. Никакая автоматическая группировка/слияние карточек не выполняется.

MVP-правила остаются:
- all linked cards belong to the same Shop;
- link never merges stock or price;
- relation is explicit, not inferred;
- each card remains independently editable and purchasable.

## 2. Three attribute concepts

### Ordinary attribute
Informational key/value shown in characteristics:
`Material → Leather`, `Country → Italy`.

### Linking/differentiating attribute
Explains why a separate Product card differs:
`Color → White`, `Finish → Matte`, `Formula → Oil-based`, `Brand → Nike`.

It is descriptive. Навигацию даёт явная связь карточек (§1), а не совпадение атрибута.

### Purchase variant
Required selectable purchase option:
`Size → S/M/L`, `Volume → 100/300/500 ml`, `Capacity → 64/128 GB`.

Seller freely names the dimension. Each value has its own stock and may have its own price.

MVP intentionally supports one purchase-variant dimension per Product. No Color × Size matrix.

### Статус реализации
Покупатель **отображает** linking-атрибуты (блок у названия в Product Detail), БД
(`product_link_attributes`) и репозитории читают/пишут их. **Seller-редактора linking-атрибутов
пока нет** — форма отправляет пустой список, поэтому у покупателя блок пуст (`16 FD-1`, `TODO`).

## 3. Pricing
Seller edits original price and discount %. Current price is calculated server-side.

Variant pricing:
- `USE_PRODUCT_PRICE`;
- `CUSTOM_PRICE`.

For custom price the variant has its own original amount + discount %. **Оси независимы**: custom-
цена варианта не наследует скидку товара, а скидка товара не применяется повторно к custom-цене
(`01 D9`; `20 INV-HARDEN-02`, миграция `0037`). Thus one card can have common pricing or different
prices for M/L/XL, 100/300/500 ml, etc.

Money is integer minor units. No delivery fee or tax calculation in MVP.

## 4. Inventory UX
Two visible balances:
- `В наличии` — physically available for a new order;
- `В ожидании` — held/reserved/reconciliation quantity not currently purchasable.

Manual action:
`Переместить в наличии` (`inventory_reconcile`, order-aware, аудит через `InventoryMovement`).

Example:
`48 available + 2 held → 50 available + 0 held`.

## 5. Inventory lifecycle
On order creation (атомарно, reserve-before-order):
`available -= qty; held += qty`.

Cancel in NEW (`held → available`):
`held -= qty; available += qty`.

Cancel in IN_TRANSIT:
no automatic return to available; quantity remains held for reconciliation.

REFUSED:
no automatic return to available; seller later reconciles physically returned goods.

DELIVERED (переход `IN_TRANSIT → DELIVERED`): **остатки не двигаются** — товар ещё не подтверждён.
Outcome `RECEIVED` (продавец подтвердил «Покупатель забрал»):
`held -= qty`, аудит-движение `HELD → DELIVERED`; остаток покидает инвентарь.

Все переходы выполняются атомарными RPC (`order_cancel`, `order_delivery_outcome`,
`inventory_reconcile`) с записью в `inventory_movements` и `order_status_history`.

## 6. Orders
Technical statuses remain exactly five:
`NEW`, `IN_TRANSIT`, `DELIVERED`, `REFUSED`, `CANCELLED`.

Meaning:
- `NEW` — order created;
- `IN_TRANSIT` — seller sent it / delivery is underway;
- `DELIVERED` — delivery physically reached the buyer, but seller has not yet recorded the final
  outcome;
- `REFUSED` — buyer did not accept the delivery;
- `CANCELLED` — order cancelled before successful completion.

After `DELIVERED`, the seller gets a simple action:
- `Покупатель забрал` → keep `DELIVERED` and set delivery outcome to `RECEIVED`;
- `Покупатель отказался` → change status to `REFUSED` and store a refusal reason.

Thus `DELIVERED` is a short-lived operational confirmation stage, not the final business outcome by
itself.

Actors:
- Buyer cancels only `NEW`;
- Seller cancels `NEW` and `IN_TRANSIT`;
- Seller moves `NEW → IN_TRANSIT`, `IN_TRANSIT → DELIVERED`, records delivery outcome.

Реализация: buyer — «Заказы» (табы `Все / Новые / В пути / Доставлено / История`), деталь заказа,
отмена NEW; seller — «Заказы» (те же табы), деталь, 6 действий, история-фильтр `?status=history`
(`22`, `24`).

## 7. Delivery result
When the order reaches `DELIVERED`, the seller sees:
- `Покупатель забрал`;
- `Покупатель отказался`.

If the buyer took the order:
- status remains `DELIVERED`;
- `delivery_outcome = RECEIVED`;
- the held quantity is removed from inventory;
- buyer feedback becomes available.

If the buyer refused:
- status becomes `REFUSED`;
- `delivery_outcome = REFUSED`;
- refusal reason is required;
- held quantity remains until manual inventory reconciliation.

Исход **терминален**: после фиксации RECEIVED/REFUSED перезапись запрещена (`0049`,
ORD-HARDEN). Причина отказа — controlled enum (`0051`):
`BUYER_CHANGED_MIND`, `COULD_NOT_CONTACT_BUYER`, `DELIVERY_TERMS`,
`PRODUCT_NOT_MATCHED_EXPECTATIONS`, `OTHER`.

## 8. Buyer feedback
After seller confirms `RECEIVED` for a `DELIVERED` order, buyer sees an unread feedback state and may:
- rate 1–5;
- submit;
- skip.

For REFUSED, buyer may select a refusal reason or skip.

Feedback must never block order completion.

> **Статус: `ПЛАН`.** Отдельного post-delivery feedback-флоу (непрочитанное состояние, причина
> отказа от покупателя) в приложении пока нет. Сейчас покупатель может оставить обычный отзыв на
> карточке товара в любой момент (§9) — гейт «verified purchase» не используется.

## 9. Reviews
MVP:
- max one active review per buyer/product — **в текущей реализации одна запись навсегда**:
  `Review` создаётся один раз, повторный запрос отклоняется (`ALREADY_REVIEWED`); скрытие
  (`HIDDEN`) **не** возвращает право на новый отзыв;
- rating 1..5 required, text optional (≤2000);
- seller can hide any review; buyer can hide own;
- review is not dependent on verified purchase;
- продавец может ответить на отзыв; покупатель может ответить один раз на чужой отзыв
  (`review_replies`, один ответ на пару «отзыв × автор»);
- публичный read: summary (average/count), гистограмма 5→1, список с ответами, пометки `isOwn`.

См. `14 §8`, миграции `0016`/`0017`.

## 10. Questions
One buyer question per buyer/product → max one seller answer. No follow-up threads. Seller can hide;
buyer can hide own. Public buyers of the shop can see it (ACTIVE store only).

Реализация: `0008`/`0019`/`0020`; buyer-композер на карточке товара, seller-ответ и удаление —
из seller-экрана.

## 11. Order snapshot
Store order number (`public_order_number`), timestamps, buyer-entered name/phone/address, Telegram
username if available at order time (серверный резолв, `checkout-identity`), item snapshots,
variant snapshot, quantities, original/discount/current prices, **currency code + symbol snapshot**
(`0050`, исторический символ), line totals and order total.

No delivery charge.

Catalog edits/deletion never alter an existing order.

## 12. Cart and checkout
Cart is shop-scoped and never reserves stock.

Реализация cart: локальная (`cartByStore` в zustand persist) + серверный read-model для
реконсиляции — `storefront_cart_items_read` (`0036`) возвращает актуальные цену/остаток/доступность
по строкам; локальные данные — только UI-состояние (`18`, `21`).

Правила строки:
- quantity — целое `1..99` (`MAX_CART_QTY`, серверный контракт `_shared/checkout-items.js`);
- максимум `100` строк (`MAX_CART_ITEMS`);
- duplicate variant в одном заказе запрещён (серверный reject);
- строки без остатка/неактивные не блокируют корзину, но исключаются из checkout
  (select-all берёт только orderable).

Checkout:
1. authenticate;
2. verify shop ACTIVE;
3. verify products/variants ACTIVE;
4. revalidate inventory;
5. recalculate current prices;
6. create order atomically;
7. move inventory (`available → held`, reserve-before-order);
8. write snapshots;
9. commit;
10. notify separately.

If price/stock changed, return conflict and create no partial order. Final request requires
idempotency key (обязателен на клиенте/edge/RPC, `IDEMPOTENCY_KEY_REQUIRED`); retry с тем же ключом
возвращает исходный заказ и не создаёт второй.

Checkout-форма: **ФИО / телефон / адрес доставки** (не email, `01 D13`). Экран успеха содержит
opt-in уведомлений (повторяемый до согласия), который не влияет на результат заказа.

## 13. Product/category/shop states
Product: `ACTIVE | ARCHIVED`. Permanent deletion only from archive.

Category: `ACTIVE | ARCHIVED`. One product has zero or one category. Deleting category only removes
assignment. `sort_order` controls category order (ручной reorder продавцом, `0027`).

Shop: `ACTIVE | PAUSED`. Paused storefront shows a technical-pause screen and blocks new orders
while seller can continue management. Описание магазина (`description`, ≤300 символов) —
публичное, редактируется в настройках и показывается покупателю на Главной (popover по «i»).

## 14. Seller contact
Optional manually configured Telegram username/link/contact (`support_handle`). Do not automatically
expose seller's own Telegram identity (`01 D20`).

Buyer sees a contact button if configured; otherwise a message that seller did not provide contact.
Контакт используется и в детали заказа (`OrderContactButton`).

## 15. Search
MVP: title + description, shop-scoped, active products only.

Текущая реализация: серверный поиск в Каталоге `storefront_catalog_products_read` (`0026`,
hardening `0033`) ищет **по названию** (`title ILIKE`, literal search); поиск по `description` —
`ПЛАН` (зафиксировать в divergence, если решим делать). Поиск shop-scoped, только ACTIVE товары;
debounce на клиенте.

## 16. First 30 days
Track:
1. users who created a shop;
2. number/% of them who created at least one product;
3. number/% who created 5+ product cards;
4. number/% of shops receiving first order;
5. validation target: 7 people / 20% of shop creators reaching the defined success point.

## 17. Seller App — навигация и экраны

Панель продавца — Telegram Mini App с нижней навигацией из четырёх разделов:

| Раздел | Маршрут | Назначение |
|---|---|---|
| Главная | `/seller/dashboard` | операционная панель: продажи, заказы, инвентарь, требует внимания |
| Инвентарь | `/seller/inventory` | секции «Товары» / «Категории», остатки, перемещения |
| Заказы | `/seller/orders` | активные заказы и смена статусов |
| Настройки | `/seller/settings` | магазин (профиль, локализация, контакт), покупатели (share/preview), интерфейс |

**Онбординг (`/seller`).** Если у пользователя ещё нет магазина (или серверная аутентификация не
прошла), вместо панели показывается приветственный экран создания магазина: имя (≤60),
баннер (crop ≈2.2:1 → WebP, опционально), валюта (`USD`/`RUB`/`BYN`), язык (ru/en — одновременно
язык магазина и язык интерфейса). Нижней навигации на онбординге нет; после создания магазина —
переход на `/seller/dashboard`. Seller Bot «Open App» тоже ведёт сюда, а не на пустую витрину.

**Главная (`/seller/dashboard`).** Шапка магазина (`DashboardStoreHeader`): логотип, крупное имя
магазина, чип статуса (`Активен` / `На паузе`). Четыре блока (`25`):
- **Продажи** — карточки «Заработано» (исход RECEIVED, зелёный) и «Потенциально» (`NEW`,
  `IN_TRANSIT`, `DELIVERED` без исхода; жёлтый); суммы — в текущей валюте магазина; клик →
  `/seller/sales`.
- **Заказы** — четыре цветных индикатора с количеством (Новые / В пути / Доставлено / История);
  клик → список с фильтром `?status=`.
- **Инвентарь** — карточка «Товары» (на витрине / в архиве) → секция «Товары»; карточка
  «Категории» (активные) → секция «Категории».
- **Требует внимания** — плейсхолдер будущих улучшений (`AttentionBlock`).

**Продажи (`/seller/sales`).** Вложенный экран (не вкладка): два раздела с переключателем
(«Заработано» / «Потенциальные», `?group=`), сумма и список заказов; карточка → деталь заказа.
Потенциальный доход включает `NEW`, `IN_TRANSIT` и `DELIVERED` без исхода (`0055`); заработано —
только `RECEIVED`.

**Инвентарь (`/seller/inventory`).** Переключатель секций **Товары** (по умолчанию) /
**Категории** (`19`, `20`): инлайн-поиск, список товаров, индикатор внимания (варианты без
остатка/ошибки), «+» создаёт товар/категорию контекстно; категории — полноширинные строки,
редактирование и ручной reorder (`0027`), «+» в категории — «Новый товар / Товар из магазина»
с мультивыбором. Карточка товара: секции «Обзор / Витрина (связи) / Отзывы / Вопросы», остатки
(`в наличии`/`в ожидании`), варианты (explicit `INHERITED`/`CUSTOM`), «Создать копию»
(независимые черновики, `23`).

**Заказы (`/seller/orders`).** Табы `Все / Новые / В пути / Доставлено / История` + список с
keyset-пагинацией и обновлением; realtime-инвалидация. Деталь заказа: состав, снимки, контакты
покупателя, 6 действий (в пути, доставлено, забрал, отказался с причиной, отменить, …).
`/seller/orders/history` — legacy-редирект на `?status=history`.

**Настройки (`/seller/settings`).** Hub с тремя группами:
- **Магазин** — профиль (имя, описание ≤300, баннер), локализация (язык магазина + валюта),
  контакт (`support_handle`), inline-тумблер `ACTIVE ↔ PAUSED` (пауза с подтверждением);
- **Покупатели** — «Поделиться магазином» (ссылка + copy) и «Витрина» (открыть preview
  в Telegram);
- **Интерфейс** — переключатель языка интерфейса (`LanguageSwitcher`).

Разделение ответственности:
- **Dashboard** — операционная сводка, а не профиль магазина.
- **Settings → Магазин** — профиль витрины; описание публикуется на Главной покупателя.

Нижняя навигация — переиспользуемый компонент (pill-shaped bar, активная вкладка с label,
«жидкое» скольжение индикатора). См. `04 §9.1`.

## 18. Buyer App — навигация и экраны

Покупательская часть — Telegram Mini App с нижней навигацией из пяти разделов:

| № | Раздел | Маршрут | Назначение |
|---|---|---|---|
| 1 | 🏠 Главная | `/` | Витрина, первое впечатление, привлечение к покупке |
| 2 | 🔎 Каталог | `/catalog` | Все товары, категории, поиск, фильтры |
| 3 | ❤️ Избранное | `/favorites` | Локально сохранённые товары (store-scoped) |
| 4 | 📦 Заказы | `/orders` | Заказы покупателя по текущей витрине |
| 5 | 🛒 Корзина | `/cart` | Текущая корзина |

Вложенные маршруты: карточка товара `/product/:id` (`О товаре` / `Отзывы` / `Вопросы` /
`Похожие`), деталь заказа `/orders/:orderId`, профиль покупателя `/account`.

Ключевое разделение: **Home — витрина (заинтересовать), Catalog — поиск/фильтры (найти)**. Home
показывает баннер, описание магазина (popover), категории и **первую страницу товарного потока**
(progressive/cursor) с кнопкой «Смотреть все →». Каталог — server-driven: категории, поиск с
debounce, фильтр цены, чипсы активных фильтров, infinite loading, пустые/ошибочные состояния;
состояние в URL (`category`/`q`/`minPrice`/`maxPrice`, `17`).

Header (Home/Catalog/Orders): слева название магазина (с усечением), справа — кнопка описания
(только если описание задано), поиск и аватар/имя покупателя. Иконки живут в «залипающем» рейле:
при скролле остаются справа вверху и становятся прозрачнее. Иконка профиля — **единственный**
вход в `/account`. In-app-уведомлений нет (`13 §16`): нет bell, ленты и счётчиков; остаются только
Telegram-bot уведомления.

**Профиль (`/account`).** Пока содержит выбор языка интерфейса; остальные разделы профиля —
`ПЛАН`.

Поиск: нажатие `🔎` на Home ведёт в Каталог с автофокусом поля и открытием клавиатуры, а не
открывает отдельный search overlay. «Все →» у категорий и «Смотреть все» у товаров ведут в
Каталог.

Избранное — store-scoped: `favoritesByStore[storeId]` в zustand persist, без БД; список
гидратируется серверной проекцией по id (`storefront_favorite_products_read`). Товар, у которого
все активные варианты закончились, остаётся в каталоге со статусом «Нет в наличии».

Заказы — store-scoped: показываются заказы текущей открытой витрины (без витрины — отдельное
состояние «нет контекста», не «пустой список»). Деталь заказа: состав, статус, доставка, контакт
продавца; отмена доступна только в `NEW`.

Полная спецификация Главной, Каталога, карточки товара, storefront-модели и этапов — `13`, `14`,
`17`, `18`, `22`.

## 19. Buyer storefront: видимость ассортимента

- **Product ACTIVE + Category ACTIVE** — показывается в Home, Category, All, Search.
- **Product ACTIVE + Category ARCHIVED** — для покупателя категория не публична: storefront
  трактует `categoryId = null` и товар попадает в «Все товары». `product.category_id` в БД при
  архивации категории **не обнуляется** — при возврате категории в ACTIVE товар автоматически
  возвращается в неё.
- **Category DELETED** — `product.category_id = null` в БД (существующее поведение).
- **Product ARCHIVED** — покупатель не видит товар нигде; product остаётся в БД для продавца,
  истории и заказов; при `ARCHIVED → ACTIVE` снова появляется на витрине.
- **Sold out** (все активные варианты `stock = 0`) — товар виден, но с «Нет в наличии»; покупка
  невозможна.
- **Shop PAUSED** — витрина показывает экран «Магазин временно закрыт», новые заказы запрещены,
  существующие заказы не затрагиваются.

Цена карточки Home — **только конечная (effective) цена первого активного варианта**. Зачёркнутая
original и процент скидки на карточке **не показываются** (скидка — в Product Detail). Что
показываем на карточке: фото, название, конечная цена, сердце. Варианты, характеристики,
количество, рейтинг, вопросы и прочее — не показываем.

## 20. Entry points, боты и deep links

Два пользовательских бота + один операционный (`telegram-bot-admin`, не для пользователей).

### Deep links
- **Витрина:** `https://t.me/<buyer_bot>/<app_short_name>?startapp=shop_<public_id>` (Direct Link,
  выбранный вариант — `04 §19`) или `t.me/<bot>?startapp=shop_<public_id>` (Main Mini App).
- **Товар:** `?startapp=prod_<public_id>_<product_id>` — открывается витрина, затем карточка
  товара поверх (кнопка «назад» возвращает на витрину).
- **Панель продавца:** `?startapp=seller`.
- **Legacy:** `store_<internal_id>` читается только для старых ссылок.

### Открытие без deep-link
`telegram-auth` определяет источник входа по токену, чья подпись `initData` совпала
(`bot = buyer | seller | null`), и клиент решает так:
- `seller` → панель продавца (или онбординг, если магазина нет);
- `buyer`/`null` → последняя посещённая витрина: `localStorage` → серверный список визитов
  (`buyer-stores` → `buyer_store_list_read`) → если пусто, покупательский экран «магазин не
  найден» (не пустая витрина).

### Buyer Bot
Команды: `/start` (главное меню), `/myshops` (мои магазины), `/orders` (активные заказы),
`/help`. Меню: кнопка «Открыть витрину ‹название›» (последняя посещённая), «Мои магазины»,
«Активные заказы», «Как это работает». Обновление статуса заказа приходит покупателю
уведомлением (при `notifications_enabled`).

### Seller Bot
Команды: `/start` (панель), `/stats` (статистика), `/mystores` (ссылка для покупателей),
`/help`. Меню: «Открыть панель» / «Создать магазин», «Статистика» (посетители, заказы по
статусам, заработано/потенциально), «Ссылка для покупателей» (copy/открыть).

### Уведомления
- новый заказ → продавцу (всегда);
- смена статуса → покупателю (только при согласии);
- согласие — opt-in на экране успеха checkout, хранится на сервере; сбой/отказ не влияет на заказ
  (`04 §11`, `01 D17`).

## 21. Список магазинов покупателя

Каждое открытие витрины покупателем фиксируется на сервере (edge `store-visit` →
`buyer_store_visits`: store, buyer, first/last visit, счётчик визитов; backfill из заказов в
`0054`). Это даёт:
- **покупателю** — «Мои магазины» в боте и fallback-вход в приложение без deep-link;
- **продавцу** — счётчик посетителей в статистике бота (`seller_bot_stats_read`).

Визит пишется fire-and-forget: его сбой не блокирует приложение.

## 22. Языки интерфейса и магазина

Поддерживаются ровно два языка: `ru` и `en`.

- **Язык интерфейса (`AppLanguage`)** — настройка пользователя: переключатель в профиле
  покупателя (`/account`) и в настройках продавца («Интерфейс»). Выбор персистится в
  `localStorage` (`shoppis-language`), смена мгновенная, `<html lang>` синхронизируется.
- **Язык магазина (`store.language`)** — публичный дефолт витрины; задаётся в онбординге и в
  «Настройки → Магазин → Локализация».
- **Цепочка разрешения:** сохранённый выбор пользователя → язык открытого магазина →
  язык Telegram → `ru`.
- В онбординге продавца выбор языка магазина и языка интерфейса — одно действие (продавец сразу
  видит результат, витрина получает выбранный язык).
- Валюта магазина: `USD`/`RUB`/`BYN`; суммы показываются в валюте магазина (исторический символ —
  в снимке заказа, `0050`).
