# VUTRINA — ОТЧЁТ О РАСХОЖДЕНИЯХ ДОКУМЕНТАЦИИ И КОДА

**Version:** 0.1
**Статус:** рабочий документ (реестр расхождений и недостатков)
**Дата:** 2026-09-24
**Область:** сверка `docs/01…05` (source of truth) с фактическим кодом `src/`, `edge-functions/` и реальной схемой БД InsForge.

## 0. Как читать

Типы записей:
- **ПРОТИВОРЕЧИЕ** — код реализует поведение, отличное от зафиксированного в документации (или нарушает инвариант/правило).
- **ПРОБЕЛ** — задокументированное поведение отсутствует в коде (ещё не реализовано).
- **БД** — расхождение между кодом и фактической схемой базы.

Severity: **S1** (критично, блокирует release gate) · **S2** (высокая) · **S3** (средняя) · **S4** (низкая/гигиена).

Легенда ссылок: `файл:строка`.

---

## 1. Критические противоречия (S1)

### 1.1 Статусы заказа — реализована другая модель
- **Док:** `02 §6`, `03 §16`, `05 slice 11` — ровно 5 статусов `NEW / IN_TRANSIT / DELIVERED / REFUSED / CANCELLED`; `DELIVERED` — промежуточный этап с `delivery_outcome = RECEIVED/REFUSED` и обязательной `refusal_reason`; каждый переход пишется в `OrderStatusHistory`.
- **Код:** `src/domain/models/order.ts:2` — 4 статуса `pending | shipped | delivered | cancelled`. Нет `REFUSED`, нет `delivery_outcome`, нет `refusal_reason`, нет истории статусов.
- **Код:** `src/domain/rules/order-rules.ts:3` — переходы `pending→shipped→delivered`, `delivered→null`, `cancelled→null`.
- **Нарушает:** инвариант `03 §24` «REFUSED/CANCELLED cannot transition; DELIVERED may only record RECEIVED or move to REFUSED» — сам набор статусов отсутствует.

### 1.2 Отмена заказа противоречит правилам ролей и стока
- **Док:** `02 §6` — buyer отменяет только `NEW`; seller — `NEW` и `IN_TRANSIT`; отмена в `IN_TRANSIT` не возвращает товар в `available`.
- **Код:** `src/domain/rules/order-rules.ts:14` — `isCancellable` = `pending || shipped`, без разделения buyer/seller и без каких-либо инвентарных последствий.
- **Нарушает:** `02 §5`, `03 §12`, инварианты `03 §24`.

### 1.3 Деньги считаются во float (нарушение «Money never uses floating point»)
- **Док:** `01 §4.5`, `03 §10` — integer minor units; централизованная формула `current = round(original * (100 - discount_percent) / 100)`; хранится `original + discount%`, текущая цена считается на сервере.
- **Код:** `src/domain/rules/product-rules.ts:8` `calcSalePrice` — деление без округления; `:31` `formatMoney` — `toFixed(2)`; типы `number` (`src/domain/models/product.ts:6-11`); в БД `price/old_price` — `numeric`.
- **Код:** `src/infrastructure/repositories/product-repository.ts:62` — вместо хранения `discount_percent` он выводится обратно из `price/old_price` (TODO в коде подтверждает отсутствие колонки).
- **Нарушает:** release gate `01 §9` «money uses float».

### 1.4 Инвентаря (available/held) нет как понятия
- **Док:** `03 §11-12`, `02 §5` — `available_quantity` / `held_quantity`, переходы `AVAILABLE→HELD` при заказе, `HELD→AVAILABLE` при отмене NEW, `HELD→DELIVERED`, `InventoryMovement` как audit trail, атомарность.
- **Код:** `src/domain/models/product.ts:22` — единственное поле `stockQuantity`; нет `available/held`, нет `InventoryMovement`.
- **Код:** `edge-functions/process-checkout.js` — остаток не читается и не изменяется вовсе: заказ не резервирует и не списывает сток, нет row lock / conditional update.
- **Нарушает:** инварианты `03 §24` (`available >= 0`, `held >= 0`), release gate `01 §9` («stock can go negative»), `04 §5` (конкурентная покупка последней единицы).

### 1.5 Снапшоты заказа не сохраняются
- **Док:** `02 §11`, `03 §14`, инвариант `03 §24` «snapshots do not mutate» — хранить title, description, image, linking attributes, variant name/value, original/discount/current price.
- **Код:** `src/domain/models/order.ts:17` — `OrderItem` содержит только `productId, productVariantId, quantity, unitPrice`; `process-checkout.js:355` пишет в `order_items` только эти поля.
- **Следствие:** правка/удаление каталога меняет историю существующих заказов. Нарушает release gate `01 §9` («snapshots mutate»).

### 1.6 Идемпотентность checkout отсутствует
- **Док:** `02 §12`, `03 §17`, `04 §12` — обязательный клиентский idempotency key, повторный запрос возвращает исходный результат и не создаёт второй заказ.
- **Код:** ключа нет ни в `src/infrastructure/functions/checkout-api.ts`, ни в `process-checkout.js`. Повторный клик/ретрай создаёт дубликат заказа.
- **Нарушает:** release gate `01 §9` («checkout can duplicate»).

### 1.7 Telegram identity не валидируется на сервере
- **Док:** `01 §4.2-4.3`, `04 §2` — серверная валидация `initData`; нельзя доверять `initDataUnsafe`, client role flags, client user/shop IDs.
- **Код:** `src/infrastructure/telegram/telegram-app.ts:88` — `getTelegramUser()` берёт данные из SDK → `initDataUnsafe` → ручного парсинга URL → в DEV возвращает мок `mock_12345` (`:108-116`). Серверной проверки подписи нет.
- **Код:** `src/infrastructure/repositories/store-repository.ts:74` — `owner_telegram_id` пишется из значения, пришедшего с клиента (`auth-slice.ts:113-119`); `checkOwnership` (`store-repository.ts:89`) сравнивает владельца по этому же client-supplied ID.
- **Код:** нет таблиц `User` / `TelegramIdentity`, нет серверной сессии (`03 §2`).
- **Нарушает:** `01 §9` «Telegram identity can be forged», `03 §24`, `04 §12`.

### 1.8 Глобальная взаимоисключающая роль buyer/seller
- **Док:** `01 §5` — нет глобальной роли; один User может быть и продавцом, и покупателем. `01 §6` — контекст представления может отличаться, авторизация — всегда от серверной identity.
- **Код:** `src/domain/constants/roles.ts:1` — `UserRole = 'buyer' | 'seller'`; весь роутинг ветвится по глобальной роли (`src/router.tsx:26`).
- **Нарушает:** `01 §5`, `01 §6`.

### 1.9 RLS отключён, backend-границы не соблюдены
- **Док:** `03 §23`, `04 §3`, `04 §12` — критические мутации через backend/domain functions; RLS как defense-in-depth; критическая логика не в React.
- **БД:** таблицы `stores`, `customers` — `rlsEnabled = false`, политик нет (проверено через схему БД).
- **Код:** фронт напрямую меняет статус заказа (`src/infrastructure/repositories/order-repository.ts:100`), делает CRUD каталога и категорий с anon-ключом; нет серверной авторизации переходов.
- **Нарушает:** `03 §23`, `04 §3`, `04 §12`, release gate `01 §9` («foreign data is accessible»).

### 1.10 Checkout не выполняет шаги спецификации
- **Док:** `02 §12`, `04 §4` — authenticate → shop ACTIVE → product/variant ACTIVE → lock inventory → revalidate stock/price → atomic order + snapshots + movements → idempotency → commit → notify отдельно.
- **Код:** `edge-functions/process-checkout.js` — `telegramId` берётся из тела без аутентификации; статус магазина/товара не проверяется (колонок нет); сток не проверяется и не двигается; нет транзакции/лока; цена берётся только из `products.price`.
- **Доп.:** `src/infrastructure/functions/checkout-api.ts:35` кладёт `recipientInfo.address` в поле `email`, и `process-checkout.js:178` читает адрес из `recipientInfo.email` — семантическая подмена поля.
- **Нарушает:** `02 §12`, `04 §4`, release gate `01 §9`.

### 1.11 Варианты игнорируются в расчёте
- **Док:** `02 §3`, `03 §9`, `05 slice 6` — variant — free-form `name/value`, `price_mode USE_PRODUCT_PRICE | CUSTOM_PRICE`.
- **Код:** `src/domain/models/product.ts:18` — жёсткое поле `size` (не `name/value`), только `stockQuantity`; `process-checkout.js` игнорирует `variantId`, custom-цену варианта и его остаток.
- **Нарушает:** `02 §3`, `03 §9`.

### 1.12 Жизненный цикл удаления — hard delete вместо archive-first
- **Док:** `02 §13`, `03 §27` — `ACTIVE → ARCHIVED → DELETED`; товар удаляется только из архива; категория архивируется; архивный товар нельзя купить.
- **Код:** `src/infrastructure/repositories/product-repository.ts:254` `removeProduct` — hard delete; `src/infrastructure/repositories/category-repository.ts:56` `removeCategory` — hard delete. Нет `status`, `archived_at`, `deleted_at`.
- **Нарушает:** `02 §13`, `03 §27`, инвариант `03 §24`.

### 1.13 Нет Shop ACTIVE/PAUSED и public_id
- **Док:** `02 §13`, `03 §3`, `04 §18` — Shop `ACTIVE | PAUSED`, `public_id` (opaque), pause-экран блокирует новые заказы.
- **Код/БД:** в таблице `stores` нет колонки `status`, нет `public_id`; используется внутренний UUID. Pause-логики нет, `process-checkout.js` не проверяет активность магазина.
- **Нарушает:** `02 §13`, `03 §3`, release gate `01 §9` («paused shops accept orders»).

---

## 2. Прочие противоречия и недостатки (S2–S4)

### 2.1 Промокоды реализованы, хотя вне scope (S2)
- **Док:** `01 §3` («complex promo codes» в Out of scope), `02 §3` («No … promo code … in MVP»).
- **Код:** `edge-functions/process-checkout.js:244-283` (таблица `promo_codes`, `simple_promocodes`, расчёт скидки, счётчик `used_count`); `src/presentation/seller/components/PromoCodeForm.tsx`; `orders.discount_applied`, `orders.promo_code_id`.
- **Статус:** противоречие. *(См. §4 — упоминания в документации удалены; вопрос о судьбе функции в коде открыт.)*

### 2.2 Уровни лояльности реализованы, хотя вне scope (S2)
- **Док:** `01 §3` («loyalty» в Out of scope).
- **Код:** `src/domain/models/store.ts:1` `LoyaltyLevel`; `src/infrastructure/repositories/settings-repository.ts` читает/пишет `stores.loyalty_levels`; `settings-slice.ts`.
- **Статус:** противоречие. *(См. §4 — упоминания в документации удалены; вопрос о судьбе функции в коде открыт.)*

### 2.3 Отзывы и вопросы только в памяти (S2)
- **Док:** `02 §9-10`, `03 §20-21` — DB-таблицы `Review`, `Question`, `QuestionAnswer`; max 1 активный отзыв на `(buyer, product)`; hide/delete.
- **Код:** `src/domain/models/review.ts:1` прямо «в БД их нет»; живут в zustand (`src/application/store/slices/review-slice.ts`); нет привязки к покупателю/покупке, нет уникальности и модерации.

### 2.4 Cart/Favorite не персистятся в БД (S3)
- **Док:** `03 §18-19` — таблицы `Cart`, `CartItem`, `Favorite` (уникальность `buyer_user_id + shop_id + product_id`).
- **Код:** `cartByStore` и `favoritesByStore` хранятся локально в zustand persist (`create-store.ts:29-36`), в БД не пишутся. Не резервируют сток — это ок.

### 2.5 Лимит изображений: 4 в доке vs 5 в коде (S3)
- **Док:** `03 §7`, `03 §24`, `04 §6` — максимум 4 активных изображения.
- **Код:** `src/domain/constants/limits.ts:2` — `MAX_IMAGES = 5`.

### 2.6 Image standard не реализован (S3)
- **Док:** `04 §6` — JPEG/PNG/WebP, max 10 МБ, max 4096 px, серверная MIME-валидация, derivative ~1600 px + thumbnail ~600 px.
- **Код:** `src/utils/image.ts` — только клиентский resize в WebP 1200 px; серверной валидации, деривативов и проверки размера нет.

### 2.7 Customer-профили вынесены в ядро (S3)
- **Док:** `03 §28` — customer profiles относятся к future extension.
- **Код:** `customers` — фактически центральная таблица (`customer-repository.ts`, `total_spent`, `email`, `timezone`), а `checkout` строит заказ через неё. Также `email`-колонка используется как адрес доставки (см. 1.10).

### 2.8 Search не реализован (S3)
- **Док:** `02 §15`, `04 §8` — поиск по title+description, shop-scoped, только активные товары.
- **Код:** `src/presentation/buyer/components/SearchBar.tsx` пуст; поиск отсутствует.

### 2.9 Notifications: частично (S3)
- **Док:** `04 §11` — new order → seller; смена статуса → buyer; delivery result → buyer; `NotificationDelivery` с ретраями.
- **Код:** уведомление о создании заказа есть (`process-checkout.js`, `telegram-notify.js`); уведомлений о смене статуса на стороне кода нет; таблицы `NotificationDelivery` нет.

### 2.10 Монки-патч SDK invoke (S3)
- **Код:** `src/infrastructure/insforge/client.ts:29` переопределяет `insforge.functions.invoke` собственным `fetch` на `function2`-хост с anon-ключом. Обходит штатный вызов SDK, хардкодит схему хоста, скрывает ошибки авторизации.

### 2.11 Именование денег/валюты (S4)
- **Док:** `03 §13` — `currency_code`.
- **Код:** `Store.currency` + `currencySymbol` (`store.ts:25-26`), в checkout используется `currency_symbol`. Расхождение понятий «код» и «символ».

### 2.12 i18n infra присутствует (S4)
- **Док:** `01 §3` — full localization platform вне scope.
- **Код:** `infrastructure/i18n` + `application/i18n.ts` подключены. Не противоречие, но расширение состава MVP.

### 2.13 UI — почти всё заглушки (S2, как недостаток готовности)
- Реально работают: `SellerOnboardingView`, заглушка `SellerDashboard`, `SettingsView` (текст-заглушка).
- Заглушки/пустые: все buyer-views (`HomeView`, `DetailsView`, `CartView`, `FavoritesView`, `OrdersView`, `OrderDetailView`, `AccountView`), seller `SellerOrdersView`, `SellerManagementView`, `InventoryView`, `SellerOrderDetailView`, `SellerProductFeedbackView`, `InventoryTable`, `OrderManagementCard`, `ProductForm`, `PromoCodeForm`, `StatsCard`, общие компоненты (`ProductCard`, `ProductGrid`, `CartItemCard`, `CheckoutModal`, `SearchBar`, `ProductImageCarousel`, `BottomSheet`, `EmptyState`, `FlyingAnimationOverlay`, `LoadingSpinner`, `FloatingNavBar`, `SellerNavBar`).
- **Следствие:** сквозной сценарий `05` (Telegram identity → … → checkout → status → feedback) не реализован.

---

## 3. Расхождение кода и фактической БД (S1)

- Фактически в схеме `public` существуют только две таблицы: **`stores`** и **`customers`** (проверено `information_schema.tables`).
- Код обращается к отсутствующим таблицам: `products`, `product_variants`, `product_characteristics`, `categories`, `orders`, `order_items`, `promo_codes`. Их нет → любой вызов этих репозиториев и checkout падает на этапе выполнения.
- В репозитории нет миграций (ни `supabase/migrations`, ни аналога), схема нигде не воспроизводится.
- `stores` содержит `owner_telegram_id text` (в доке — `owner_user_id` FK на User), нет `status`, `public_id`, `seller_contact` (есть только `support_handle`).
- `customers` содержит `total_spent numeric` (в доке профили — future), `timezone`, `email`.
- RLS выключен на обеих таблицах, политик нет.

---

## 4. Удалено из документации (выполнено)

В соответствии с решением убрать из документации любые упоминания промокодов и уровней лояльности (код при этом не трогаем), внесены правки:

| Файл | Было | Стало |
|---|---|---|
| `01_VUTRINA_PROJECT_CONSTITUTION_v0.2.md:29` | `… marketplace; loyalty; subscriptions; … employee roles; complex promo codes; full localization platform.` | `… marketplace; subscriptions; … employee roles; full localization platform.` |
| `02_VUTRINA_PRODUCT_SPEC_v0.2.md:54` | `Money is integer minor units. No delivery fee, promo code or tax calculation in MVP.` | `Money is integer minor units. No delivery fee or tax calculation in MVP.` |

Примечание: упоминания удалены только из документации. Код (промокоды в `process-checkout.js`, `PromoCodeForm`, `LoyaltyLevel`/`loyalty_levels`) не изменялся.

---

## 5. Гигиена документации (S4)

- `00_README_VUTRINA_DOCS_v0.2.md:11-12` ссылается на документы `06` (Global Development Roadmap) и `07` (Stage Execution Plan), которых нет в `docs/`.
- `03_VUTRINA_DOMAIN_DATABASE_SPEC_v0.2.md:108-110` — продублирована строка «Every transition is recorded.».
- Несоответствие нумерации: этот отчёт добавлен как `08`, тогда как `06`/`07` зарезервированы README, но отсутствуют.

---

## 6. Рекомендованный порядок устранения

1. **S1 — Identity & доступ:** серверная валидация `initData`, таблицы `User`/`TelegramIdentity`, сессия, RLS + политики, убрать доверие client IDs.
2. **S1 — Схема БД:** воспроизводимые миграции для всех сущностей домена (`products`, `variants`, `inventory`, `orders`, …), затем привести репозитории к схеме.
3. **S1 — Заказы:** статусы `NEW/IN_TRANSIT/DELIVERED/REFUSED/CANCELLED`, `delivery_outcome`, `refusal_reason`, `OrderStatusHistory`, правила отмены по ролям.
4. **S1 — Инвентарь:** `available/held` + `InventoryMovement`, атомарные переходы под локом/conditional update.
5. **S1 — Деньги:** integer minor units, централизованная и протестированная формула округления, хранение `original + discount%`.
6. **S1 — Checkout:** транзакция, revalidation stock/price, snapshots, идемпотентность, перемещение стока, отдельные уведомления.
7. **S2 — Архив/пауза:** `Shop ACTIVE/PAUSED`, `Product/Category ACTIVE/ARCHIVED`, archive-first удаление, `public_id`.
8. **S2 — Продуктовые решения:** определить судьбу промокодов и лояльности (оставить/удалить) — сейчас они вне документации, но живут в коде.
9. **S2 — Отзывы/вопросы:** перенести в БД с правилами уникальности/модерации.
10. **S3+ — Остальное:** лимит изображений, image pipeline, search, notifications, монки-патч, терминология валюты, реализация UI-заглушек.

---

## Приложение A. Карта расхождений по документам

- `01 Constitution`: §3 (out of scope vs промокоды/лояльность), §4.2/4.3/4.5 (auth/IDs/деньги), §5 (роли), §9 (release gate).
- `02 Product Spec`: §3 (промокоды/цены вариантов), §5 (инвентарь), §6 (статусы/отмена), §9-10 (отзывы/вопросы), §11 (снапшоты), §12 (checkout), §13 (архив/пауза), §15 (search).
- `03 Domain & DB`: §2 (identity), §3 (shop status/public_id), §7 (изображения), §9 (варианты), §10 (деньги), §11-12 (инвентарь), §14 (снапшоты), §16 (статусы), §17 (идемпотентность), §18-19 (cart/favorite), §20-21 (reviews/questions), §22 (notifications), §23 (RLS), §24 (инварианты), §27 (удаление).
- `04 Technical Spec`: §2 (Telegram auth), §3 (backend boundaries), §4 (order creation), §5 (concurrency), §6 (images), §8 (search), §9 (frontend boundaries), §11 (notifications), §12 (security), §18 (pause/archive).
- `05 Implementation Plan`: slices 1-16 — фактически не реализованы, кроме части slice 0-2.
