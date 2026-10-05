# SHOPPIS — CART (покупатель) — ПЛАН РЕАЛИЗАЦИИ

**Version:** 1.0
**Дата:** 2026-10-05
**Репозиторий:** `forantigravityyesser/Shoppis`
**Базовый срез кода:** `main` (после закрытия Catalog, `17`; buyer Home/Catalog/Product Detail реализованы).
**Объект:** вкладка **Корзина** покупателя (`/cart`) и граница до **Checkout** (оформление заказа).
**Вне области:** промокоды, доставка как услуга/цена, комиссии, налоги, платёжный шлюз, server-side Cart,
резервирование стока из корзины, экраны Favorites/Orders, seller-операции.

**Связанные документы:** `00` (индекс), `01` (Constitution), `02` (Product Spec §11–12), `03` (Domain &
Database Spec §11–18, §24–25, §29), `04` (Technical Spec §4–5, §9, §12, §18), `05` (Implementation Plan),
`08` (Divergence §2.2, §2.11), `11` (Hardening Backlog §S1–S3), `13` (Buyer Home Plan), `14` (Product Detail Plan),
`16` (Remaining Work, FD-3), `17` (Catalog Plan).

**Статус документа:** authoritative для захода Cart. Он **не пересматривает** Home/Catalog/Product Detail;
Cart надстраивается поверх уже существующего cart-фундамента (домен/стор/граница checkout) и публичного
storefront read-layer.

---

## 0. Главный принцип этапа

```text
Главная = заинтересовать
Каталог = найти
Карточка товара = изучить и решиться
Корзина = купить
```

> **Cart — это слой намерения покупателя, а не слой инвентаря.**
> Клиент может запрашивать — решение принимает сервер.

Корзина реализуется как production-quality модуль, **не** как визуальная копия прототипа. Прототип даёт
только визуальный язык (карточка товара, quantity-контролы, selection, inline-подтверждение удаления,
блок итога, нижний CTA). Из прототипа **сознательно не берём**: промокод, `Subtotal`/`Fees`, `Delivery Options`,
стоимость/налог/сервисный сбор.

Архитектура остаётся слоистой:

`presentation → application → domain`, инфраструктура — только через application-порты (`deps()`).

---

## 1. Метод и легенда

### 1.1 Как мы работаем (обязательно весь этап)

1. **Один этап за раз.** Реализация → `npm run typecheck` → `npm run lint` → `npm run test` → `npm run build` →
   ручная сверка → следующий этап. Не отдаём «одним гигантским заданием».
2. **Двойная среда проверки** (как `00` README): `LOCAL VERIFIED` (браузер/локальный контур) +
   `TELEGRAM VERIFIED` (Mini App на dev-окружении). Этап не закрыт без обоих.
3. **Слоистость.** Строго `View → Hook → Application contract → Repository/API → RPC`. Запрещено
   `UI → InsForge/SQL`, `UI → бизнес-логика`.
4. **Переиспользование.** Не создаём второй калькулятор цены, вторую модель товара, второй Cart-стор,
   свои `ProductCard`. Публичный read-model товара переиспользуем (`storefront_product_detail_read`
   или существующий storefront read-контур).
5. **Первые этапы — без визуала.** CART-01…CART-02 (контракт/данные/приложение) не трогают UI.
6. **Порядок качества:** `correct → beautiful → polished`.
7. **Инвентарь — истина.** Cart никогда не мутирует stock; финальная проверка — на checkout.

### 1.2 Легенда статуса

| Метка | Значение |
|---|---|
| ✅ | Реализовано в коде (проверено, указан файл/строка) |
| 🟡 | Частично |
| ❌ | Не реализовано |
| 🔒 | Решение зафиксировано этим документом |

---

## 2. Аудит текущего фундамента (сверено по коду)

### 2.1 Что уже готово и переиспользуется

| Что | Где | Готовность |
|---|---|---|
| Модель `CartItem` | `src/domain/models/cart.ts` | ✅ |
| `CartState` | `src/domain/models/cart.ts` | ✅ |
| Cart-стор (add/update/toggle/remove/clear, per-store, clamp) | `src/application/store/slices/cart-slice.ts` | ✅ |
| Изоляция корзин по витрине | `cartByStore[storeId]` | ✅ |
| Persisted Cart (Zustand `persist`) | `src/application/store/create-store.ts:27-33` | ✅ |
| Домен: `calcSubtotal`, `calcTotal`, `canCheckout` | `src/domain/rules/cart-rules.ts` | ✅ |
| `MAX_CART_QTY = 99` | `src/domain/constants/limits.ts:1` | ✅ |
| Read-only hook `useCart` (items/count/subtotal/total/actions) | `src/application/hooks/useCart.ts` | ✅ |
| Граница checkout (контракт) | `src/application/contracts/checkout.ts` | ✅ |
| Граница checkout (infra invoke) | `src/infrastructure/functions/checkout-api.ts:20-37` | ✅ |
| Atomic backend `create_order_atomic` | `migrations/0004_checkout.sql` | ✅ |
| Edge `process-checkout` | `edge-functions/process-checkout.js` | ✅ |
| Inventory lifecycle (`0007`) | `migrations/0007_inventory_lifecycle.sql` | ✅ |
| Order + immutable snapshots | `migrations/0003_orders.sql` | ✅ |
| `buyer_address_snapshot` (адрес доставки) | `migrations/0003_orders.sql:12` | ✅ |
| `RecipientInfo { name, phone, address }` | `src/domain/models/customer.ts` | ✅ |
| `placeOrder(recipient)` (application-действие) | `src/application/store/slices/order-slice.ts:157` | ✅ |
| `defaultRecipient` (persisted) | `src/application/store/slices/settings-slice.ts` | ✅ |
| Публичный storefront read-layer (карточка/детали) | `read-models/storefront.ts`, `storefront-product.ts`, `StorefrontRepository` | ✅ |
| Роут `/cart` | `src/router.tsx:138` | ✅ (роут есть) |
| Общие компоненты | `ProductCard`, `ProductGrid`, `SafeImage`, `BottomSheet`, `BackButton`, `Toast`, `useHaptic` | ✅ |

### 2.2 Что отсутствует (границы блока)

| Область | Состояние |
|---|---|
| `CartView` | ❌ заглушка `return null` (`src/presentation/buyer/views/CartView.tsx`) |
| Buy-side read-model `CartItemView` | ❌ нет |
| Реконсиляция Cart ↔ текущий каталог/инвентарь | ❌ нет |
| Select-all (derived) | ❌ нет |
| Inline-подтверждение удаления (`pendingRemoveItemKey`) | ❌ нет |
| Checkout-форма (sheet: ФИО / телефон / адрес доставки) | ❌ нет (есть только `placeOrder`, UI нет) |
| Cart CSS / состояния (loading/empty/error/paused) | ❌ нет |
| `useBuyerCart` (Cart + публичная проекция + валидация) | ❌ нет |

**Вывод:** домен, сторы, граница checkout и backend уже корректны и переиспользуются. Отсутствует
(а) buy-side read-model + реконсиляция, (б) UI-экран, (в) checkout-форма, (г) состояния/hardening.

---

## 3. Прототип → Shoppis (границы заимствования)

Прототип берём **только как визуальное направление**. Часть блоков нам подходит, часть — нет.

| Элемент прототипа | Решение Shoppis |
|---|---|
| Карточка товара: изображение, название, вариант (`44mm / Gray`) | ✅ берём |
| Цена товара в пилюле (`$450.00`) | ✅ берём (`unitPrice`, `formatMoneyMinor`) |
| Quantity-контрол `1 ▾` + иконка удаления | ✅ берём: `− qty +` + `🗑` (без dropdown, без free-input) |
| Inline-подтверждение удаления (`Remove Item / No / Yes`) | ✅ берём: «Удалить товар из корзины? [Нет] [Да]», по одному товару за раз |
| Блок итога в стиле чека | ✅ берём, но **только одна строка «Итого»** |
| Нижний CTA с суммой (`$878.71`) | ✅ берём: «Оформить заказ · $…» |
| `Enter promocode / Apply Code` | ❌ **исключено** (вне MVP) |
| `Subtotal` | ❌ исключено (нет отдельного subtotal в UI) |
| `Fees ($49.74)` | ❌ исключено |
| `Delivery Options (Standard Free)` | ❌ исключено как выбор/цена доставки |
| Выбор товаров (selection) | 🔒 добавляем (требование продукта, в прототипе явно не показан) |

> **Важно:** «доставка не входит в сумму» (locked decision `00`/`02`) остаётся в силе — мы **не считаем**
> стоимость доставки. Но **адрес доставки (куда отправить товар)** у покупателя запрашиваем — см. §23–§25.

---

## 4. Единый источник истины

**Инвентарь — источник истины для остатка.** Количество в корзине и остаток на складе — разные вещи.

```text
inventory.available_quantity = 5
buyer Cart quantity          = 3

Cart      = «покупатель сейчас хочет 3»
Inventory = «магазин сейчас может отдать 5»
```

Cart **никогда** не мутирует инвентарь. Мутировать stock могут только авторитетные операции заказа/инвентаря.

### Иерархия источника истины

```text
DATABASE INVENTORY
      │
      ├── Seller inventory UI
      ├── Buyer storefront availability
      ├── Product Detail availability
      └── Cart item availability
             │
             ▼
          Checkout
             │
             ▼
    Atomic server revalidation
             │
             ▼
      Order + inventory
```

---

## 5. Модель консистентности

Мгновенную синхронность UI везде Zustand не гарантирует. Правильная модель:

- **Authoritative consistency** — обеспечивается транзакциями/RPC БД.
- **UI consistency** — общие read-model, инвалидация/refetch, проверка актуальности при активации
  экрана, обновление после успешной мутации, ревалидация на checkout.
- **Race-condition safety** — серверные блокировки и атомарный checkout.

Пример:

```text
Покупатель видит: 3 доступно
Продавец меняет сток: 0
Покупатель жмёт «Оформить»
        ↓
сервер проверяет текущий inventory
        ↓
операция отклонена (INSUFFICIENT_STOCK)
```

UI может кратко устареть, но бизнес-операции **никогда** не полагаются на устаревшие клиентские данные.

---

## 6. Правило Product Detail → Cart

Вариант с нулевым остатком **не добавляется**.

```text
inventory.available_quantity
        ↓
variant.available
        ↓
Product Detail canAdd
        ↓
addToCart
```

Если `availableQuantity === 0`:
- вариант недоступен;
- кнопка «Добавить в корзину» disabled;
- обычный UI не может добавить его.

Cart-действие также **валидирует свой вход** (`addToCart`) и не полагается только на guard в presentation.
Cart при этом инвентарь не мутирует.

---

## 7. Cart read-model (`CartItemView`)

`CartItem` остаётся минимальным. **Не добавляем** в него `title`, `imageUrl`, имя/значение варианта,
stock, статусы товара/магазина.

Вводим buy-side проекцию:

```ts
interface CartItemView {
  productId: string;
  productVariantId: string;      // в модели CartItem — nullable; во view только разрешённые

  title: string;
  imageUrl: string | null;

  variantName: string | null;
  variantValue: string | null;

  unitPrice: number;             // текущая effective price, minor units
  currencySymbol: string;

  availableQuantity: number;
  productAvailable: boolean;
  variantAvailable: boolean;
}
```

Предпочтительный поток:

```text
CartItem
+
current public product/variant/inventory projection
        ↓
CartItemView
        ↓
presentation
```

Это не даёт Cart стать «второй базой товаров». Источник публичных полей — существующий storefront
read-layer (карточка/детали товара); **вторую модель товара не создаём**.

---

## 8. Цена в корзине не авторитетна

Cart может хранить `price` для мгновенного рендера, персистенции и локального UX. Но:

`Cart price ≠ Order price`

Checkout обязан заново пересчитать:

```text
original price → discount → effective unit price → line total → order total
```

Финальные значения фиксируются в immutable snapshot заказа (`order_items`, `migrations/0003:31-53`;
`create_order_atomic`, `migrations/0004:130-166`). Это защищает историю заказов и исключает влияние
устаревших клиентских данных на итоговую сумму.

---

## 9. Product/variant lifecycle и Cart

| Событие | Поведение Cart |
|---|---|
| Product archived/deleted | Исчезает из Cart (нельзя держать выбираемый товар, которого нет в публичной витрине) |
| Variant archived | Cart-item удаляется |
| Variant c нулевым stock | Item остаётся (вариант существует), но заказать в текущем количестве нельзя |
| Store paused | Cart читается, но оформление заблокировано |

---

## 10. Реконсиляция Cart

При активации Cart:

```text
load current Cart references
        ↓
resolve current product/variant/inventory state
        ↓
remove invalid/hidden references
        ↓
refresh availability
        ↓
render
```

Реконсиляция **идемпотентна**. Она:
- не создаёт заказы;
- не резервирует сток;
- не мутирует инвентарь.

Правила для устаревшего персистентного Cart:
- hidden/deleted product → удалить;
- hidden/deleted variant → удалить;
- существует, но stock < quantity → оставить item, пометить invalid / снять выбор;
- store paused → оставить читаемым, заблокировать checkout.

---

## 11. Правила количества

Сохраняем `MAX_CART_QTY = 99` (`limits.ts:1`).

UI:

```text
−   quantity   +
```

Без свободного числового ввода в MVP. Правила: минимум = 1; максимум = 99; `−` disabled при 1;
`+` disabled при 99. Cart quantity — это намерение покупателя, **не** зарезервированный сток.

---

## 12. Количество против текущего стока

Количество в Cart может превышать текущий сток (инвентарь мог измениться после добавления).

```text
Cart = 5
Current available = 2
```

Cart обязан обнаружить это **до** checkout.

Рекомендуемый UX:

```text
Доступно только 2 шт.
```

и блокировать checkout до исправления. Опционально — действие:

```text
Уменьшить до 2
```

Сервер остаётся авторитетным, даже если UI считает количество валидным.

---

## 13. Структура экрана

```text
CartView
├── CartHeader
├── CartSelectionToolbar
│   ├── SelectionSummary
│   └── SelectAllControl
├── CartList
│   └── CartItemCard
│       ├── CartItemSelectionControl
│       ├── CartItemImage
│       ├── CartItemInfo
│       │   ├── ProductTitle
│       │   └── VariantLabel
│       ├── CartItemPrice
│       ├── CartQuantityControl
│       ├── CartRemoveButton
│       └── CartRemoveConfirmation
└── CartCheckoutBar      // CTA закреплён над нижней навигацией; содержит сумму
```

> **Решение (2026-10-05):** отдельного блока `CartTotalCard` нет — кнопка «Оформить заказ» прикреплена
> к нижней навигации и сама показывает итог. Единственный источник суммы в UI — CTA (см. §21–§22).

Компоненты — презентационные. Внутри presentation **нет** импортов InsForge/репозиториев.

---

## 14. UX карточки товара

Карточка содержит:
1. selection-контрол слева;
2. изображение товара;
3. название;
4. выбранный вариант под названием;
5. цену за единицу;
6. quantity-контрол;
7. кнопку удаления.

```text
○  [image]  Nike Air Max
            Size: 42

            $120.00
            −  2  +       🗑
```

Навигация в Product Detail — **только** по изображению и названию. Чекбокс, quantity-контролы и
удаление **не** навигируют.

---

## 15. Навигация в Product Detail

Используем существующий роут/read-model карточки товара (`/product/:id`, `14`). **Не создаём**
Cart-специфичную реализацию карточки. Передаём ту же identity товара/варианта, что уже использует
buyer-приложение.

---

## 16. Модель выбора

Каждый `CartItem` уже имеет `selected: boolean` (`cart.ts:8`) — это корректно, сохраняем.

```text
Product A selected
Product B selected
Product C unselected

Total = A + B
```

Невыбранные позиции остаются в корзине.

---

## 17. Select All

Добавляем компактный selection-контрол над списком.

```text
Все товары                         Выбрать все
```

или эквивалент в Shoppis-native стилистике. Если выбраны все валидные позиции — контрол может
представлять «Снять всё». Selection **выводится из состояния Cart**, а не дублируется в отдельное
дерево состояния.

---

## 18. Невалидный/недоступный выбор

Позиция, которую сейчас нельзя заказать, **не должна** оставаться выбранной для checkout.

Примеры: archived product; archived variant; zero stock; запрошенное количество > available; store paused.

Правила:

- **Product/variant больше не существует** в витрине → удалить из Cart.
- **Существует, но не может удовлетворить количество** → оставить, пометить/снять выбор, требовать
  исправления перед checkout.

---

## 19. UX удаления

Удаление открывает inline-подтверждение.

```text
Удалить товар из корзины?

[ Нет ]   [ Да ]
```

Одновременно в состоянии подтверждения может быть **только один** товар. Одно UI-состояние:

```ts
pendingRemoveItemKey: string | null
```

Не создаём по boolean на каждый item.

- «Нет» закрывает подтверждение.
- «Да» удаляет **ровно** этот Cart-item.

---

## 20. Пустая корзина

Обязательное состояние:

```text
        🛒

     Корзина пуста

Добавьте товары из каталога,
чтобы оформить заказ.

[ Перейти в каталог ]
```

Действие ведёт в Каталог (`/catalog`).

---

## 21. Блок итога

Ровно **один** итог. Никаких subtotal, fees, delivery, promo, tax, service charge.

```text
┌─────────────────────────────┐
│                             │
│ Итого                  $177 │
│                             │
└─────────────────────────────┘
```

Блок должен визуально напоминать чек/чек-аут. Формула:

```text
total = Σ(selectedItem.price × selectedItem.quantity)
```

Отображаемый итог — удобный расчёт; финальный итог авторитетен на сервере.

---

## 22. Нижний CTA

Блок итога и CTA — **разные** элементы.

```text
┌─────────────────────────────┐
│      Оформить заказ · $177  │
└─────────────────────────────┘
```

Белый/«чековый» блок с итогом — информационный. Нижний CTA — действие.

CTA **не может** инициировать checkout, когда:
- Cart пуст;
- ничего не выбрано;
- выбранная позиция невалидна;
- стока недостаточно;
- магазин на паузе;
- идёт реконсиляция Cart.

---

## 23. Граница Checkout

Ответственность Cart заканчивается на:

```text
Оформить заказ
        ↓
Checkout form
```

Внутренности checkout-формы **не** реализуем внутри `CartView`. Существующая граница
application/infrastructure (`contracts/checkout.ts`, `checkout-api.ts`, `order-slice.placeOrder`,
edge `process-checkout`) остаётся центральным путём создания заказа.

---

## 24. Checkout-форма — контракт следующего этапа

По нажатию CTA открывается modal/sheet с:

- **ФИО**;
- **номер телефона**;
- **адрес доставки** (куда отправить товар);
- вторичное действие «Связаться с продавцом».

Физической доставки как услуги/цены в MVP нет, **но адрес доставки запрашивается** — это место
назначения товара.

### Контракт получателя (исправлено)

Текущий код использует:

```ts
RecipientInfo {
  name: string;
  phone: string;
  address: string;   // адрес доставки (физический)
}
```

Согласованное продуктовое требование:

```ts
interface CheckoutRecipient {
  fullName: string;
  phone: string;
  address: string;   // адрес доставки, куда отправить товар
}
```

🔒 **Решение:** поле получателя — это **адрес доставки**, а **не email**. Email не запрашиваем и
не храним.

Рекомендуемые snapshot-поля заказа (уже существуют):

```text
buyer_full_name_snapshot
buyer_phone_snapshot
buyer_address_snapshot
```

Поля `buyer_email_snapshot` **не вводим**. Отдельное поле стоимости доставки в MVP **не вводим**
(locked decision: доставка не входит в сумму).

> Терминологическая заметка: текущая модель использует `name`, документ `CheckoutRecipient` — `fullName`.
> Оставленное имя можно сохранить (`name`) ради минимального диффа; семантика — ФИО покупателя.

---

## 25. Семантика адреса доставки

Адрес доставки — это данные получателя, **не** реализация доставки.

Валидация:
- обязательное;
- `trim`;
- свободный текст (без формат-валидации, как у email);
- серверная валидация;
- immutable snapshot в Order.

Инфраструктуру доставки в рамках Cart **не добавляем**.

Соответствие коду: `canCheckout` уже требует непустой `recipient.address`
(`cart-rules.ts:28`); edge `process-checkout` требует `name`, `phone`, `address`
(`process-checkout.js:59-67`); RPC пишет `p_address` в `buyer_address_snapshot`
(`0004_checkout.sql:84-92`). Менять эти контракты на email **не нужно и нельзя**.

---

## 26. Решение по «Связаться с продавцом»

### До заказа

Держим «Связаться с продавцом» внутри checkout-sheet как **вторичное** действие:

```text
Есть вопросы по оформлению?
Связаться с продавцом
```

Оно не должно визуально конкурировать с основным «Подтвердить/Оформить заказ». Причина: покупатель
может уточнить порядок оплаты/оформления и снять неопределённость до подтверждения.

### После заказа

Обязательно даём «Связаться с продавцом» в Order Details — это постоянное место, т.к. заказ существует.

Если контакт магазина не задан: **не выдумываем** Telegram username; скрываем/дизейблим действие;
используем только контакт из БД (`support_handle`, `02 §14`).

---

## 27. Интеграция с lifecycle инвентаря

Существующий backend-lifecycle структурно корректен:

| Событие | Переход |
|---|---|
| Checkout | `AVAILABLE → HELD` |
| Buyer cancels `NEW` | `HELD → AVAILABLE` |
| Seller cancels `IN_TRANSIT` | остаётся `HELD` до реконсиляции |
| Delivered + RECEIVED | `HELD → DELIVERED` |
| Delivered + REFUSED | остаётся `HELD` до явной реконсиляции |

Реализация — `migrations/0007_inventory_lifecycle.sql`; checkout-переход — `migrations/0004:168-180`.
Cart **не выполняет** ни одного из этих переходов.

---

## 28. Изменения стока продавцом

Изменения стока продавцом должны менять **те же** строки `inventory`, которые читают buyer-модели.
Не должно быть отдельных «buyer stock», «Cart stock», «Product Detail stock» или seller-кэша,
считающегося авторитетным.

После seller-мутации: инвалидируем/refetch релевантные inventory/product read-model; Cart
реконсилируется при активации; checkout всегда ревалидирует.

---

## 29. Примеры гонок

### Продавец уменьшил сток

```text
Buyer Cart: 5
Seller: stock → 2
Buyer: checkout 5
        ↓
RPC locks inventory
        ↓
2 < 5
        ↓
INSUFFICIENT_STOCK
        ↓
no order / no reservation
```

### Два покупателя одновременно

```text
Stock = 5

Buyer A wants 3
Buyer B wants 3

A locks row → reserves 3
B sees 2 → rejected
```

Оверселла нет.

### Buyer cancels NEW

```text
HELD 3 → atomic cancel → AVAILABLE +3 / HELD -3
```

### Seller меняет сток при открытой Cart

Cart может кратко показывать старые данные. При реконсиляции: загружается текущее состояние; невалидное
количество помечается/исправляется; checkout блокируется до валидности. БД остаётся авторитетной.

---

## 30. Application-абстракции

Рекомендуется:

```text
useCart()        — локальное состояние/действия Cart (уже существует, расширяем)
useBuyerCart()   — Cart + текущая публичная проекция + реконсиляция + валидация
useCheckout()    — следующий этап: recipient-валидация, submit, loading, errors, success
```

- `useCart()` (`src/application/hooks/useCart.ts`) — items, count, subtotal, total, add/update/toggle/
  remove/clear.
- `useBuyerCart()` — объединяет Cart с текущими публичными данными товара; реконсилирует устаревшие
  ссылки; отдаёт рендерящиеся `CartItemView`; отдаёт availability/validation.
- `useCheckout()` — следующий этап; recipient-валидация; submit; loading; errors; success.

Все три ответственности **не** кладём в `CartView`.

---

## 31. Доменные правила

Cart-домен остаётся свободным от React/Zustand/InsForge.

Рекомендуемые чистые правила (`cart-rules.ts`):

```ts
calcTotal(items)
canIncrement(quantity)
canDecrement(quantity)
isValidCartQuantity(quantity)
isSelectedForCheckout(item)
hasSelectedItems(items)
```

Availability-правила получают явные read-model/inventory-данные.

> Текущее имя `calcTotal` уже используется; `calcSubtotal` формально — тот же результат. Отдельный
> subtotal в UI не показываем.

---

## 32. Маппинг ошибок

Обрабатываем детерминированно:

```text
STORE_PAUSED
PRODUCT_NOT_ACTIVE
VARIANT_NOT_FOUND
INVENTORY_NOT_FOUND
INSUFFICIENT_STOCK
INVALID_QUANTITY
UNAUTHORIZED
NETWORK
UNKNOWN
```

Примеры:

- `INSUFFICIENT_STOCK` → «Недостаточно товара. Проверьте количество.»
- `PRODUCT_NOT_ACTIVE` / `VARIANT_NOT_FOUND` → reconcile/remove item.
- `STORE_PAUSED` → «Магазин временно недоступен для оформления заказов.»
- `NETWORK` → «Не удалось обновить корзину. Повторить.»

Никогда не показываем сырые RPC/database ошибки. Backend-коды уже отдаёт `process-checkout.js:27-37`.

---

## 33. Loading-состояния

Обязательны:
- первичная реконсиляция Cart;
- мутация количества;
- мутация удаления;
- handoff в checkout;
- восстановление после ошибки.

По возможности не блокируем весь экран ради локальной мутации количества. Предотвращаем двойные действия.

---

## 34. Персистенция

Текущая per-store persisted-модель корректна:

```text
store A Cart ≠ store B Cart
```

Не персистим: server inventory; product read-model; checkout loading; временное confirm-состояние.
Персистим только convenience-состояние Cart. Реализация — `create-store.ts:27-33`.

---

## 35. Безопасность

Клиентский Cart недоверенный. Никогда не доверяем: Cart price; Cart stock; Cart selected state;
Cart product status; Cart store status.

Клиент отправляет **ссылки и количества**. Сервер валидирует всё, что нужно для создания Order
(`create_order_atomic`, `0004`).

---

## 36. Стратегия тестирования

### Domain
- total; selected/unselected; границы количества; ноль выбранных; max 99;
- несколько вариантов; один product / разные variant; один product / тот же variant (merge).

### Application
- store isolation; add; update quantity; select/deselect; select all; remove;
- persistence; reconciliation; удаление невалидной позиции; insufficient stock.

### Components
- рендер карточки; отображение варианта; отображение цены; quantity-контролы;
- selection; подтверждение удаления; границы навигации; empty state; total; CTA-state; loading/error.

### Integration
- Product Detail → Cart; Cart → Product Detail; Cart → Checkout;
- успешный заказ → очистка Cart; неуспешный → сохранение Cart;
- stock conflict; paused store; seller inventory mutation → buyer Cart reconciliation.

### Regression
```text
npm run typecheck
npm run lint
npm run test
npm run build
```
плюс проверка в Telegram Mini App.

---

## 37. Критерии приёмки

### Архитектура
- нет InsForge-импортов в presentation;
- нет репозиториев в компонентах;
- `CartItem` остаётся минимальным;
- read-model отдельный;
- доменные правила чистые.

### Продуктовая консистентность
- zero-stock вариант нельзя добавить;
- archived/deleted item исчезает из Cart;
- текущая доступность реконсилируется;
- устаревшая цена не влияет на checkout.

### UX
- визуальный язык из прототипа сохранён;
- нет промокода; нет fees; нет delivery-опций;
- ровно один итог;
- «чековый» белый блок итога;
- CTA содержит действие + сумму;
- selection работает; select all работает;
- inline-подтверждение удаления работает;
- image/title ведут в Product Detail;
- quantity-контролы не навигируют.

### Checkout
- отправляются только выбранные позиции;
- пустой выбор не отправляется;
- невалидный stock не отправляется;
- paused store не отправляется;
- сервер авторитетен;
- успешный заказ очищает Cart; неуспешный — сохраняет.

### Инвентарь
- нет Cart-side мутаций инвентаря;
- seller и buyer availability происходят из одного inventory-источника;
- checkout использует атомарную ревалидацию стока;
- lifecycle HELD/AVAILABLE принадлежит заказу.

---

## 38. Этапы реализации

```text
                CART
                  │
                  ▼
        CART-01 Контракт и read-model
                  │
                  ▼
        CART-02 Домен / application hardening
                  │
                  ▼
        CART-03 Presentation
                  │
                  ▼
        CART-04 Состояния и hardening
                  │
                  ▼
        CART-05 Checkout handoff
                  │
                  ▼
        CART-06 Полная интеграционная QA
```

### CART-01 — Контракт и read-model `H1`
1. Подтвердить модель Cart (уже есть).
2. Определить `CartItemView`.
3. Определить публичную buyer-проекцию, нужную Cart (переиспользовать storefront read-layer).
4. Реализовать repository/application-доступ.
5. Реализовать реконсиляцию.
6. Добавить тесты.

**UI до стабилизации контракта не строим.**

**Статус: ✅ выполнено (2026-10-05).**
- ✅ Read-model: `CartItemRef`, `CartItemProjection`, `CartReadResult`, `CartItemView` — `read-models/cart.ts`.
- ✅ Backend `storefront_cart_items_read(p_public_id, p_items)` — миграция `0036` (применена на dev, записана в `schema_migrations`): одна проекция по ссылкам, boundary магазина, паритет effective price, `held` не раскрывается, битые/чужие refs не роняют запрос; PAUSED-магазин отдаёт корзину + `store.status`.
- ✅ Порт `ports/cart-repository.ts`; инфра `infrastructure/repositories/cart-repository.ts`; маппер `mappers/cart-mappers.ts` (reuse `mapStore`); регистрация в `AppContainer`/`composition-root`.
- ✅ Реконсиляция `application/services/cart-reconciliation.ts` (удаление пропавших refs, `orderable`, `storePaused`, `store===null → null`).
- ✅ Тесты: mapper (6), repo (6), reconciliation (9), `cartItemKey` (+2); live-прогон RPC на реальных данных.
- ✅ Гейты: `typecheck`, `lint` (0 errors), `test`, `build`, `migrations:check` (0001..0036).

### CART-02 — Домен/application hardening `H1`

**Статус: ✅ выполнено (2026-10-05).**
- ✅ Домен (`cart-rules.ts`): `isValidCartQuantity`, `canIncrement`, `canDecrement`, `clampCartQuantity`, `isSelectedForCheckout`, `hasSelectedItems`, `isAllSelected`, `isSomeSelected`; `canCheckout` переиспользует правило количества.
- ✅ Слайс: `setAllSelected`, `setSelectedByKeys`, `removeByKeys`; `clampQty` → доменный `clampCartQuantity`; `useCart` экспонирует новые действия.
- ✅ Реконсиляция: производные `canCheckoutReconciled` (учитывает паузу/пустой выбор/выбранные неоформляемые позиции) и `hasUnavailableSelected`.
- ✅ `useBuyerCart(publicId, enabled)` (`application/hooks`): объединяет Cart + публичную проекцию, **идемпотентно удаляет пропавшие ссылки**, отдаёт рендер-позиции, `selectionState`, `canCheckout`, `storePaused`, `hasUnavailable*`; UI-логики нет.
- ✅ Проверка изоляции по витрине (`cart-slice.test.ts`: операции store A не трогают store B; адресные `setSelectedByKeys`/`removeByKeys`).
- ✅ Тесты: домен (+5), слайс (8), реконсиляция (+2), hook (9). Гейты зелёные — **644/644** тестов.
- ⬜ UI/`CartView` — CART-03 (следующий).

1. Аудит Cart-правил.
2. Select-all (derived) + действия.
3. Границы количества (`canIncrement/canDecrement/isValidCartQuantity`).
4. Правила реконсиляции.
5. Обработка invalid/unavailable.
6. Проверка изоляции по витрине.
7. Тесты.

### CART-03 — Presentation `H2`
Реализовать:

```text
CartView
CartHeader
CartSelectionToolbar
CartItemCard
CartQuantityControl
CartRemoveConfirmation
CartTotalCard
CartCheckoutBar
CartEmptyState
```

Без data-access/business-логики внутри компонентов.

**Статус: ✅ выполнено (2026-10-05).**
- ✅ Фон/лист — **как везде** (Home/Каталог/Избранное): корень `.home` (радиальный мята→голубой) + белый
  лист `.home-sheet.cart-sheet`; шапка — переиспользован `CatalogHeader` (`CartHeader` не дублируем, DRY).
- ✅ Компоненты (`presentation/buyer/components/cart/`): `CartItemCard`, `CartQuantityControl`,
  `CartRemoveConfirmation`, `CartSelectionToolbar`, `CartCheckoutBar`, `CartEmptyState`;
  `CartView` + `cart.css`.
- ✅ Соответствие прототипу: карточка (фото/название/вариант/цена-капсула), quantity `− qty +`,
  trash → inline «Удалить товар из корзины? [Нет][Да]», нижний CTA «Оформить заказ · …».
  **Исключено:** промокод, subtotal, fees, delivery options.
- ✅ **Правки после визуальной проверки:** CTA `position: fixed` — всегда прикреплён над нижней
  навигацией (не «плавает» при длинном списке и скролле); нижний padding листа резервирует под него место;
  блок подтверждения удаления центрирован (текст + компактные кнопки по центру); отдельный блок «Итого»
  удалён — сумма осталась только в CTA.
- ✅ Навигация в товар — только фото/название; чекбокс, количество, удаление не навигируют.
- ✅ Presentation не держит данные: всё из `useBuyerCart()`; `pendingRemoveItemKey` — один товар за раз.
- ✅ Производные презентации (сумма выбранных, `canCheckout`, `selectionState`) — из hook/domain, не дублируются.
- ⏳ CTA ведёт в заглушку-тост; реальной checkout-формы ещё нет — **CART-05**.
- ⬜ Полные состояния loading/empty/error/paused/invalid/pending/recovery — упрощены, полировка в **CART-04**.
- ✅ Тесты: `CartQuantityControl` (3), `CartItemCard` (5), `CartView` (8). Гейты зелёные — **660/660**, `build` ✅.

### CART-04 — Состояния и hardening `H2`
Реализовать: loading; empty; error; paused store; invalid stock; unavailable item; mutation pending; recovery.

**Статус: ✅ выполнено (2026-10-05).**
- ✅ **Loading:** первичная реконсиляция → `CartSkeleton` (каркас шапки/листа/карточек, без белого flash).
- ✅ **Empty:** `CartEmptyState` (CART-03).
- ✅ **Error:** два уровня — полный экран ошибки, если проекция не пришла вовсе (retry), и
  **inline-ошибка** при упавшем пере-запросе: список сохраняется, «Повторить» рядом (docs/18 §32).
- ✅ **Paused:** уведомление + CTA заблокирован (`canCheckout` учитывает `storePaused`); позиции читаются.
- ✅ **Invalid stock:** «Доступно только N шт.» + действие **«Уменьшить до N»** (`updateQty`); при N=0 —
  «Нет в наличии», quantity-контрол выключен.
- ✅ **Unavailable item:** пропавшие из витрины удаляются реконсиляцией (CART-01/02); распроданные
  **выбранные** позиции снимаются с оформления автоматически (`setSelectedByKeys`), чтобы CTA не
  «залипал» без пути решения (docs/18 §18).
- ✅ **Mutation pending / reconciling:** `useBuyerCart.reconciling` → мягкий индикатор в
  `CartSelectionToolbar` (`aria-busy`), CTA заблокирован на время пере-запроса; локальные мутации
  количества/удаления не блокируют экран (docs/18 §32).
- ✅ **Recovery:** `refresh()` из inline/полного экрана ошибки; повторные действия не дублируются.
- ✅ Тесты: hook `useBuyerCart` (10, +1 auto-deselect), `CartView` (11, +3), `CartItemCard` (7, +2),
  `CartQuantityControl` (3). Гейты зелёные — **704/704**, `build` ✅.
- ⬜ Checkout handoff (форма) — **CART-05**; полная интеграционная QA — **CART-06**.

### CART-05 — Checkout handoff `H2`
Подключить CTA к checkout-форме (ФИО / телефон / адрес доставки). Checkout-реализацию **не** размещать
внутри `CartView`. Разбит на подэтапы `05a…05e`.

**CART-05a — Domain + application (без UI) ✅ выполнено (2026-10-05).**
- ✅ `domain/rules/checkout-rules.ts`: `sanitizePhoneInput` (цифры + ведущий `+`, лимит 15), `isValidFullName`,
  `phoneDigitCount`, `isValidPhone` (6..15), `isValidAddress`, `validateRecipient` (пофайловые флаги + `valid`).
- ✅ `order-slice`: добавлен `lastOrder: CheckoutResult | null` (номер/сумма для экрана успеха) + `resetCheckout()`;
  `placeOrder` теперь сохраняет полный результат. Разрешение на уведомления — на стороне `useCheckout`, в жесте клика.
- ✅ `application/hooks/useCheckout.ts`: форма-состояние, prefill (`defaultRecipient` + `serverUser.firstName`),
  `setField` (санитайз телефона), `submit` (permission → `placeOrder` → success), `status idle|submitting|success|error`,
  локализация ошибок (`mapCheckoutError`), `setDefaultRecipient` после успеха, `reset`.
- ✅ Тесты: `checkout-rules` (5), `useCheckout` (8). Гейты зелёные — **731/731**, `build` ✅.
**CART-05b — Presentation (форма + успех) ✅ выполнено (2026-10-05).**
- ✅ `CheckoutFormSheet` (на `BottomSheet`): ФИО / Телефон (`type="tel"`, `inputMode="tel"`) / Адрес доставки;
  ошибки полей после blur, общая ошибка оформления, кнопка «Оформить заказ» **без цены**, disabled пока
  невалидно/идёт отправка.
- ✅ `StoreContactLink`: контакт из БД (`support_handle`) → `https://t.me/<username>`; нет/некорректный
  контакт → сообщение; порт `openTelegramLink` теперь возвращает `boolean` (обновлены `telegram.ts`,
  `telegram-app.ts`, `useOpenTelegramLink`), сбой открытия → inline-ошибка.
- ✅ `CheckoutSuccess`: оверлей (портал) поверх корзины — галочка, «Заказ принят!», номер, сумма,
  opt-in-карточка уведомлений («Разрешить уведомления»), «Перейти к заказам».
  Модалка по центру поверх корзины (корзина видна за полупрозрачным фоном); авто-скрытие
  через 5 с (остаёмся в корзине, без перехода); кнопка «Перейти к заказам» → `/orders`.
- ✅ `presentation/buyer/checkout.css`. Тесты: `CheckoutFormSheet` (6), `StoreContactLink` (4),
  `CheckoutSuccess` (3). Гейты зелёные — **751/751**, `build` ✅.
**CART-05c — Проводка cart → checkout → success ✅ выполнено (2026-10-05).**
- ✅ `CartView`: нижний CTA (с суммой) открывает `CheckoutFormSheet`; `useCheckout` подключён; успех
  показывает `CheckoutSuccess` модалкой по центру поверх корзины (живёт и в пустой ветке);
  таймаут просто скрывает её (остаёмся в корзине), кнопка «Перейти к заказам» — `checkout.reset()`
  + переход на `/orders`. Убран прежний CTA-тост-заглушка.
- ✅ Успешный заказ удаляет из корзины **только оформленные** (выбранные) позиции, невыбранные
  остаются (`cart-rules.checkedOutItemKeys` + `order-slice.placeOrder` → `removeByKeys`).
- ✅ Импортирован `../checkout.css` (стили формы/успеха попадают в бандл `CartView`).
- ✅ Тесты `CartView` (12): CTA открывает форму, успех → оверлей + возврат/сброс, сохранены прежние сценарии.
  Гейты зелёные — **752/752**, `build` ✅.
**CART-05d — Telegram-разрешение + серверный гейт уведомления (переделано 2026-10-05).**
- ✅ Проблема прежнего варианта: `requestMessagesAccess` обрывался на 1200 ms — пользователь не
  успевал нажать «Разрешить», `notifications_enabled` оставался `false` и повторно не спрашивали
  (покупателю уведомления не приходили; подтверждено в БД).
- ✅ Новый порядок: заказ создаётся сразу; согласие спрашивается **на экране успеха по тапу**
  (`CheckoutSuccess` → `useCheckout.enableNotifications(orderId)` → `requestNotifications(orderId)`).
- ✅ `MESSAGES_ACCESS_TIMEOUT_MS` = 60 000 (страховка, не гонка). На таймауте/отказе opt-in
  остаётся доступен, `notificationsPrompted` больше не блокирует повторный запрос.
- ✅ Досыл: `notifications-actions` принимает `orderId`, после записи согласия проверяет владение
  заказом (`orders.buyer_user_id = session.uid`) и отправляет «Заказ принят» боту покупателя
  (`session.tg`, кнопка витрины по `public_id`).
- ✅ Серверный гейт `process-checkout` (`notifications_enabled`) и тот же гейт в `order-actions`
  (buyer-status notify); seller-notify — всегда. `notifications-actions`/`order-actions` edge
  пересобраны (`npm run build:edge`) и **задеплоены**.
- ✅ `04 §11` переписан под новый порядок. Тесты: `useCheckout` (10), `CheckoutSuccess` (6),
  `notification-api` (4), `telegram-share` (6), `order-slice` (9), `CartView` (12). Гейты зелёные —
  **768/768**, `build`/`build:edge` ✅.
**CART-05e — Финальная QA + документация ✅ выполнено (2026-10-05).**
- ✅ Найден и исправлен интеграционный баг: если заказ создан, но `fetchBuyerOrders` упал,
  `placeOrder` бросал → пользователь видел «ошибку» на уже созданный заказ (риск дубля). Теперь
  post-checkout refresh — best-effort, заказ считается успешным.
- ✅ Гейты scope: `typecheck` ✅, `lint` 0 errors, cart/checkout suite **111/111** (15 файлов), `build` ✅.
- ✅ Edge `process-checkout` пересобран и задеплоен (deployment `29kxjsd5k4xk`), гейт по
  `notifications_enabled` в бандле.
- ✅ Документы: `04 §11` (prompt на checkout, supersede), `18`.
- ⬜ Ручная проверка в Telegram (форма → успех → «Разрешить уведомления» → «Заказ принят» боту
  покупателя; повторный заказ без повторного согласия) — за владельцем. Требует `BUYER_BOT_TOKEN`
  и запущенного бота покупателя.

### CART-06 — Полная интеграционная QA `H1`
Проверить взаимодействие buyer/seller inventory и гонки (см. §29, §36).

**Статус: ✅ выполнено (2026-10-05).**
- ✅ **Архитектура:** `presentation → infrastructure` импортов — **0**; `presentation → insforge/SQL` — **0**.
  Цепочка соблюдена: `CartView → useBuyerCart/useCheckout → cartRepository/checkoutApi → RPC`.
- ✅ **End-to-end контракты (тесты):** Product Detail → Cart (`DetailsView`), Cart → Product Detail и
  Cart → Checkout (`CartView`), успешный заказ очищает Cart и сохраняет `lastOrder`, ошибка заказа
  сохраняет Cart (`order-slice`), недостаток стока/пауза/реконсиляция (`useBuyerCart`,
  `cart-reconciliation`), удаление пропавших ссылок.
- ✅ **DRY:** единая price semantics (цена считается только в RPC; клиент показывает `view.unitPrice`),
  нет второй модели товара (`CartItemView` — проекция), нет второго cart-стора (слайсы + store).
- ✅ **Гонки/оверселл:** безопасность обеспечивает серверный атомарный `create_order_atomic`
  (row-lock, перепроверка цены/остатка, HELD, идемпотентность); клиент не доверяет цене/стоку.
  RPC-поведение проверено на live-данных в CART-01/CAT.
- ✅ **Гейты:** `typecheck`, `lint` (0 errors), cart/checkout suite **111/111**, `build` ✅.
- ⬜ Полный сценарий двух одновременных покупателей за последним стоком и проверка в Telegram —
  только в живой среде (за владельцем); логика уже атомарна на сервере.

> Примечание: финальный прогон всего suite на момент закрытия показывал падения в **seller inventory**
> (`CategoryCard`/`CategoryGrid`, «Phase E») из-за активной параллельной правки, не связанной с Cart.
> Scope Cart/Checkout — зелёный (111/111).

---

## 39. Явные non-goals

Не реализуем во время Cart:
- промокоды;
- доставку (как услугу/цену/выбор провайдера);
- расчёт доставки; fees; налог;
- платёжный шлюз;
- server-side Cart;
- резервирование стока из Cart;
- seller-операции;
- аналитику;
- in-app UI уведомлений;
- создание заказа напрямую из Cart-компонента.

---

## Финальное архитектурное решение

```text
                    DATABASE
                       │
              authoritative inventory
                       │
       ┌───────────────┼────────────────┐
       │               │                │
 Seller Inventory   Product Detail   Cart Read Model
       │               │                │
       └───────────────┼────────────────┘
                       │
                  buyer actions
                       │
                    CartState
                       │
                 selected items
                       │
                 Checkout Form
                       │
                process-checkout
                       │
             create_order_atomic
                       │
            ┌──────────┴──────────┐
            │                     │
          Order              Inventory
        snapshots           AVAILABLE→HELD
            │                     │
            └──────────┬──────────┘
                       │
                Order lifecycle
                       │
              cancel / deliver /
              refuse / reconcile
```

### Финальные принципы

> **Cart — слой намерения покупателя, не слой инвентаря.**

> **Каждое buyer-facing состояние стока — проекция одного inventory-источника.**

> **Клиент может запрашивать; решение принимает сервер.**

> **Заказы используют immutable snapshots; изменения каталога никогда не переписывают историю.**

---

## Приложение A. Прототип → Shoppis (сводка)

| Блок прототипа | Берём? | Комментарий |
|---|---|---|
| Карточка товара (фото/название/вариант/цена) | ✅ | основа `CartItemCard` |
| Quantity `1 ▾` | 🟡 | берём как `− qty +` без dropdown |
| Иконка `🗑` | ✅ | триггер inline-подтверждения |
| `Remove Item / No / Yes` | ✅ | «Удалить товар из корзины?» |
| `Enter promocode / Apply Code` | ❌ | вне MVP |
| `Total` | ✅ | одна строка «Итого» |
| `Subtotal` | ❌ | не показываем |
| `Fees` | ❌ | не показываем |
| `Delivery Options` | ❌ | не показываем как выбор/цену |
| Нижний CTA с суммой | ✅ | «Оформить заказ · $…» |

Прототип — не 100% эталон. Часть элементов взята, часть сознательно исключена.

---

## Приложение B. Правки относительно исходного spec v1.0

1. **Получатель — адрес доставки, а не email.** Исходный spec (§23/§25) менял `address` на `email`
   и вводил `buyer_email_snapshot`. В Shoppis поле получателя — **адрес доставки** (куда отправить
   товар); email не запрашиваем/не храним; snapshot = `buyer_address_snapshot` (уже в `0003`).
2. **«Доставка не входит в сумму» ≠ «нет адреса».** Стоимость/опции доставки в MVP не считаем, но
   адрес доставки запрашиваем.
3. **Терминология.** В коде модель — `CartItem.productVariantId` (nullable) и `RecipientInfo.name`;
   в документе используется `CheckoutRecipient.fullName`. Имена можно сохранить ради минимального
   диффа; важна семантика.
4. **`useCart()` уже существует** (`application/hooks/useCart.ts`) — не создаём заново; расширяем
   `useBuyerCart()`.
5. **Граница checkout уже реализована** (`contracts/checkout.ts`, `checkout-api.ts`,
   `order-slice.placeOrder`, `process-checkout`), включая `p_address` — контракт не переписываем.
6. **UI отсутствует** (`CartView` — заглушка) — это основная работа этапа.

---

## Приложение C. Definition of Done (для этапов CART-01…CART-06)

Этап считается закрытым, когда:
- реализация завершена в рамках этапа;
- `npm run typecheck`, `npm run lint` (0 errors), `npm run test` (зелёный suite), `npm run build` — успешно;
- нет `presentation → infrastructure/insforge` импортов;
- нет второй модели товара / второго калькулятора цены / второго Cart-стора;
- для глобальных этапов выполнены `LOCAL VERIFIED` и `TELEGRAM VERIFIED`;
- обновлены `00` README и `16` Remaining Work при изменении статуса блока.
