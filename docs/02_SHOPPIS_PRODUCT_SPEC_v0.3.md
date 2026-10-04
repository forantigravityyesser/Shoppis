# SHOPPIS — PRODUCT SPECIFICATION

**Version:** 0.3

## 1. Product card architecture

### Product = one concrete card
Example:
- Nike T-shirt — White
- Nike T-shirt — Black
- Nike T-shirt — Olive

These are separate Product cards. Each has its own photos, attributes, variants, stock and pricing.

### ProductGroup
Related cards can be connected through one ProductGroup. The product detail page contains `Другие варианты` / `Похожие карточки`.

MVP:
- Product belongs to zero or one ProductGroup;
- all group members belong to the same Shop;
- group membership never merges stock or price;
- relation is explicit, not inferred;
- each card remains independently editable and purchasable.

## 2. Three attribute concepts

### Ordinary attribute
Informational key/value shown in characteristics:
`Material → Leather`, `Country → Italy`.

### Linking/differentiating attribute
Explains why a separate Product card differs:
`Color → White`, `Finish → Matte`, `Formula → Oil-based`, `Brand → Nike`.

It is descriptive. ProductGroup membership is the actual navigation relation.

### Purchase variant
Required selectable purchase option:
`Size → S/M/L`, `Volume → 100/300/500 ml`, `Capacity → 64/128 GB`.

Seller freely names the dimension. Each value has its own stock and may have its own price.

MVP intentionally supports one purchase-variant dimension per Product. No Color × Size matrix.

## 3. Pricing
Seller edits original price and discount %. Current price is calculated server-side.

Variant pricing:
- `USE_PRODUCT_PRICE`;
- `CUSTOM_PRICE`.

For custom price the variant has its own original amount + discount %. Thus one card can have common pricing or different prices for M/L/XL, 100/300/500 ml, etc.

Money is integer minor units. No delivery fee or tax calculation in MVP.

## 4. Inventory UX
Two visible balances:
- `В наличии` — physically available for a new order;
- `В ожидании` — held/reserved/reconciliation quantity not currently purchasable.

Manual action:
`Переместить в наличии`.

Example:
`48 available + 2 held → 50 available + 0 held`.

## 5. Inventory lifecycle
On order creation:
`available -= qty; held += qty`.

Cancel in NEW:
`held -= qty; available += qty`.

Cancel in IN_TRANSIT:
no automatic return to available; quantity remains held for reconciliation.

REFUSED:
no automatic return to available; seller later reconciles physically returned goods.

DELIVERED:
item has left seller inventory; `held -= qty`, with audit movement `HELD → DELIVERED`.

## 6. Orders
Technical statuses remain exactly five:
`NEW`, `IN_TRANSIT`, `DELIVERED`, `REFUSED`, `CANCELLED`.

Meaning:
- `NEW` — order created;
- `IN_TRANSIT` — seller sent it / delivery is underway;
- `DELIVERED` — delivery physically reached the buyer, but seller has not yet recorded the final outcome;
- `REFUSED` — buyer did not accept the delivery;
- `CANCELLED` — order cancelled before successful completion.

After `DELIVERED`, the seller gets a simple action:
- `Покупатель забрал` → keep `DELIVERED` and set delivery outcome to `RECEIVED`;
- `Покупатель отказался` → change status to `REFUSED` and store a refusal reason.

Thus `DELIVERED` is a short-lived operational confirmation stage, not the final business outcome by itself.

Buyer cancels only NEW. Seller cancels NEW and IN_TRANSIT.

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

The buyer sees the post-delivery feedback only after the seller confirms `RECEIVED`.

Refusal uses a small controlled reason list. Suggested:
`BUYER_CHANGED_MIND`, `COULD_NOT_CONTACT_BUYER`, `DELIVERY_TERMS`, `PRODUCT_NOT_MATCHED_EXPECTATIONS`, `OTHER`.

## 8. Buyer feedback
After seller confirms `RECEIVED` for a `DELIVERED` order, buyer sees an unread feedback state and may:
- rate 1–5;
- submit;
- skip.

For REFUSED, buyer may select a refusal reason or skip.

Feedback must never block order completion.

## 9. Reviews
MVP:
- max one active review per buyer/product;
- seller can hide/delete;
- deletion does not restore eligibility;
- review is not dependent on verified purchase.

## 10. Questions
One buyer question → max one seller answer. No follow-up threads. Seller can delete. Public buyers of the shop can see it.

## 11. Order snapshot
Store order number, timestamps, buyer-entered name/phone/address, Telegram username if available at order time, item snapshots, variant snapshot, quantities, original/discount/current prices, currency, line totals and order total.

No delivery charge.

Catalog edits/deletion never alter an existing order.

## 12. Cart and checkout
Cart is shop-scoped and never reserves stock.

Checkout:
1. authenticate;
2. verify shop ACTIVE;
3. verify products/variants ACTIVE;
4. revalidate inventory;
5. recalculate current prices;
6. create order atomically;
7. move inventory;
8. write snapshots;
9. commit;
10. notify separately.

If price/stock changed, return conflict and create no partial order. Final request requires idempotency.

## 13. Product/category/shop states
Product: `ACTIVE | ARCHIVED`. Permanent deletion only from archive.

Category: `ACTIVE | ARCHIVED`. One product has zero or one category. Deleting category only removes assignment. `sort_order` controls category order.

Shop: `ACTIVE | PAUSED`. Paused storefront shows a technical-pause screen and blocks new orders while seller can continue management.

## 14. Seller contact
Optional manually configured Telegram username/link/contact. Do not automatically expose seller's own Telegram identity.

Buyer sees a contact button if configured; otherwise a message that seller did not provide contact.

## 15. Search
MVP search uses title + description, shop-scoped.

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
| Инвентарь | `/seller/inventory` | остатки (`в наличии` / `в ожидании`), перемещения |
| Заказы | `/seller/orders` | активные заказы и смена статусов |
| Настройки | `/seller/settings` | профиль магазина, валюта/язык, поддержка, ссылка-приглашение |

История заказов — вложенный маршрут `/seller/orders/history`.

Разделение ответственности:
- **Dashboard** — операционная сводка, а не профиль магазина.
- **Settings → Магазин** — баннер, название, валюта, язык, контакт для связи (`support_handle`).
  Описание магазина в MVP в настройках не редактируется (колонка `description` в БД остаётся).

Без магазина панель показывает онбординг (`/seller`) без нижней навигации; после создания
магазина — переход на `/seller/dashboard`.

Нижняя навигация — переиспользуемый компонент (один визуал и анимации для продавца и будущего
покупателя, отличается только набор вкладок): pill-shaped bar, активная вкладка с label, «жидкое»
скольжение акцентного индикатора. См. `04 §9`.

## 18. Buyer App — навигация и экраны

Покупательская часть — Telegram Mini App с нижней навигацией из пяти разделов:

| № | Раздел | Маршрут | Назначение |
|---|---|---|---|
| 1 | 🏠 Главная | `/` | Витрина, первое впечатление, привлечение к покупке |
| 2 | 🔎 Каталог | `/catalog` | Все товары, категории, поиск, фильтры |
| 3 | ❤️ Избранное | `/favorites` | Локально сохранённые товары (store-scoped) |
| 4 | 📦 Заказы | `/orders` | Заказы покупателя |
| 5 | 🛒 Корзина | `/cart` | Текущая корзина |

Карточка товара — вложенный маршрут `/product/:id`.

Ключевое разделение: **Home — витрина (заинтересовать), Catalog — поиск/фильтры (найти)**. Home
не является каталогом: он показывает баннер, категории и **первую страницу товарного потока**
(progressive/cursor) с кнопкой «Смотреть все →» в Каталог.

Header: слева название магазина (с усечением), справа поиск и **аватар/имя покупателя**. Иконка
профиля — сквозная для всего приложения, справа вверху, и является **единственным** входом в
профиль покупателя. In-app-уведомлений нет (§16 в `13`): нет bell, ленты и счётчиков; остаются
только Telegram-bot уведомления.

Поиск: нажатие `🔎` на Home ведёт в Каталог с автофокусом поля и открытием клавиатуры, а не
открывает отдельный search overlay. «Все →» у категорий и «Смотреть все» у товаров ведут в
Каталог.

Избранное — store-scoped: `favoritesByStore[storeId]` в zustand persist, без БД. Товар, у
которого все активные варианты закончились, остаётся в каталоге со статусом «Нет в наличии».

Полная спецификация Главной, Каталога, карточки товара, storefront-модели и этапов — `13`.

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
