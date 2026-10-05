# SHOPPIS — ОСТАТОК РАБОТ (незакрытые расхождения)

**Version:** 0.3
**Статус:** рабочий список незавершённого. Закрытые пункты удалены.
**Дата:** 2026-09-24

Документ содержит только то, что ещё предстоит сделать. Пункты привязаны к `docs/01…05` и к текущей базе: миграции `migrations/0001…0011` применены, edge-функции `telegram-auth`, `shop-create`, `process-checkout`, `order-actions`, `catalog-actions` задеплоены и работают через `npm:@insforge/sdk`.

Severity: **S1** критично · **S2** высоко · **S3** средне.

---

## S1 — критично

### [ ] 1.9 RLS и backend-границы
- **Док:** `03 §23`, `04 §3`, `04 §12`, release gate `01 §9` («foreign data is accessible»).
- **Сейчас:** RLS выключен на всех таблицах, политик нет. Чтения каталога/заказов идут напрямую с anon-ключом; **записи каталога уже переведены на edge `catalog-actions` + атомарные RPC (`migrations/0011`), actor из серверной сессии**; заказы — через `process-checkout`/`order-actions`.
- **Задача:** перевести оставшиеся чтения (и записи вне каталога) на серверные функции (или смапить Telegram-identity на auth-пользователей InsForge), затем включить RLS и написать политики (public / buyer-private / seller-private).
- **Блокер:** кастомная Telegram-сессия не распознаётся PostgREST, поэтому RLS-политики не могут опираться на identity. Включать RLS раньше перевода доступа — сломать фронт.

---

## S2 — высоко

### [ ] 2.2 Cart и Favorite в БД
- **Док:** `03 §18-19`.
- **Сейчас:** `cartByStore` / `favoritesByStore` живут только в zustand persist (`src/application/store/create-store.ts`), в БД не пишутся.
- **Задача:** таблицы `carts(id, buyer_user_id, store_id)`, `cart_items(cart_id, variant_id, quantity)`, `favorites(buyer_user_id, store_id, product_id)`; изоляция по витрине; уникальность favorite `(buyer_user_id, store_id, product_id)`; корзина не резервирует сток.

### [x] 1.13 Pause-экран витрины и `public_id` в ссылках
- **Док:** `02 §13, §19`, `03 §3, §29`, `04 §18`, `13 §15`.
- **Сейчас:** `stores.status` (`ACTIVE/PAUSED`) и `public_id` есть; резолв витрины по `shop_<public_id>` и
  базовый pause-экран реализованы (`StorefrontView`, S-08); серверный guard `STORE_PAUSED` срабатывает в
  checkout (`create_order_atomic`).
- **Закрыто:** полноценный storefront-state — `StoreStatusView` (брендовая шапка, сообщение, контакт) с
  гейтом на Home и Catalog (покупка/поиск недоступны), серверный guard `STORE_PAUSED` сохранён. `H-10`.

### [x] 1.14 Buyer storefront (Главная + Каталог) — новый слой
- **Док:** `13` (весь документ), `02 §18-19`, `03 §29`, `04 §6, §8, §17, §18, §19`, `05 Stage 3`.
- **Сейчас:** есть только резолв витрины + pause/шапка (`StorefrontView`); `HomeView` показывает
  заглушку «Каталог товаров появится на следующем этапе». `DetailsView`/`FavoritesView`/`OrdersView` —
  пустые; `FloatingNavBar` пуст; роута `/catalog` нет. Каталог-чтение (`fetchCatalog`) отдаёт все
  товары и product-level цену, без storefront-проекции и availability.
- **Задача:** реализовать этапы `H-01…H-11` из `13 §28`: `storefront_home_read`, `photo_url`,
  `StorefrontRepository`, Home shell, Categories, Product Grid/Card, Home section, Catalog, buyer nav,
  pause state, performance polish. Один этап за раз с тестами и ручной сверкой.
- **Заменено:** старый `presentation/buyer/components/StorefrontView.tsx` (+тесты) удалён — его роль
  разделена на `HomeView` (оркестрация) + `StoreStatusView` (notFound/PAUSED) + `HomeHeader`/`HomeBanner`.
- **Прогресс:** `H-01` — [x] (миграция `0014` применена, функция проверена на реальных данных;
  контракты + маппер + тесты). `H-02` — [x] (`telegram-auth` пишет `photo_url`, отдаёт `photoUrl`,
  передеплоен; `ServerUser.photoUrl`; fallback `initial.ts`; проекция `sellerAvatarUrl` позже удалена
  в hardening `15`). `H-03` — [x] (`StorefrontRepository` порт + infra RPC-репозиторий
  + `useStorefrontHome`; +9 тестов). `H-04` — [x] (Home shell: header/banner/skeleton/status, safe-area
  сверху, `/catalog`-заглушка; `StorefrontView` заменён; +16 тестов). `H-05` — [x] (Categories:
  `CategoryCarousel`/`CategoryItem`, свайп, «Все →» и категория → Каталог; +8 тестов). `H-06` — [x]
  (ProductGrid/ProductCard/FavoriteButton: 2 колонки, heart-cutout, цена/old/sold out; +11 тестов).
  `H-07` — [x] (ProductSection: «Товары», лимит 6, «Смотреть все →»; +4 теста).   `H-09` — [x]
  (FloatingNavBar покупателя на общем `BottomNavBar`: 5 вкладок, сердце по центру крупнее;
  +6 тестов).
  `H-08` — [x] (Catalog: поиск по названию, чипы категорий, сетка; Home search → автофокус;
  фильтры отложены; +8 тестов).   `H-10` — [x] (pause-стор: брендовая шапка, гейт Home+Catalog,
  покупка недоступна; +4 теста). `H-11` — [x] (performance polish: фолбэк изображений, Catalog
  skeleton, общий `.skel`; сеть без N+1; +3 теста). **Buyer storefront MVP (H-01…H-11) закрыт.**
- **Закрыто hardening'ом (`15`):** buyer resolver — минимальный `PublicStoreContext` (без `select('*')`);
  Home делает 2 read (context + первая страница товаров) с progressive/cursor-догрузкой; keyset-индекс
  `0024`; buyer avatar; `originalPrice` убран из Home. Catalog-прототип (client-side) — отдельная
  server-side feature в будущем.
- **Блокеры/зависимости:** `1.13` (pause UI), `2.2` (favorites/cart в БД — не блокирует MVP, сейчас
  zustand), `1.9` (RLS — `storefront_home_read` станет границей публичной проекции).

### [x] 2.1 Reviews и Questions — код и UI
- **Док:** `02 §9-10`, `03 §20-21`, `14` PD-10/11.
- **Реализовано (2026-10-05):** схема `0008` (`reviews`, `questions`, `question_answers`), edge
  `review-actions`/`question-actions`, buyer- и seller-экраны, ответы продавца, `review_replies`.
  Seller-карточка показывает per-product секции «Отзывы/Вопросы» с индикаторами непросмотренного
  (`19` §24–25).
- **Остаётся:** social follow-up'ы (`16` FD-4).

### [ ] 2.7 (остаток) Таблица `notifications` и ретраи
- **Док:** `04 §11`, `03 §22`.
- **Сейчас:** уведомления о создании заказа и о смене статуса покупателю отправляются best-effort; таблицы `NotificationDelivery` нет.
- **Задача:** таблица `notifications` (event_type, channel, status, attempt_count, last_error), ретраи/логирование независимо от транзакции заказа.

---

## S3 — средне

### [ ] 2.4 Image pipeline
- **Док:** `04 §6`, `03 §7`.
- **Сейчас:** клиентский resize/crop в WebP (`src/utils/image.ts`, `createImageBitmap` + canvas, fallback JPEG);
  товар — портрет 4:5: `full` 1000×1250 q0.75 + `thumb` 512×640 q0.75 (`product_images.storage_key`/`thumb_storage_key`),
  обложка категории 320×320, баннер 1024px; лимит `MAX_IMAGES = 4` соблюдён; откреплённые файлы удаляются из Storage.
- **Задача:** JPEG/PNG/WebP, max original 10 МБ, max 4096 px; серверная MIME/контент-валидация; серверные derivatives; strip metadata; reject malformed.

### [ ] 2.6 Search
- **Док:** `02 §15`, `04 §8`.
- **Сейчас:** `src/presentation/buyer/components/SearchBar.tsx` пуст; поиска нет.
- **Задача:** поиск по `title` + `description`, shop-scoped, только `ACTIVE` товары.

### [~] 2.11 UI — остальные экраны

> **Актуализация (2026-10-05):** Inventory / ProductForm / CategoryView **реализованы и
> реконструированы** (`09`, `17`, `19`); buyer-часть — `13`/`15`/`14`/`17`/`18`. Ниже — исторический
> снимок раннего этапа; в части Inventory неактуален.

- **Док:** `05` (сквозной сценарий), `02` (UX), `02 §17`.
- **Сделано (этап 2, Seller App Shell):** shell `SellerLayout` (safe-area, внутренний скролл, навбар не
  перекрывает контент); переиспользуемый `BottomNavBar` + адаптер `SellerNavBar`; маршруты
  `/seller/{dashboard,inventory,orders,orders/history,settings}` (clean rename `management` → `settings`);
  `SellerOnboardingView` и `SellerSettingsView` (профиль витрины) работают; `SellerDashboard` — операционный каркас.
- **Сейчас (остаток):** большинство экранов и компонентов — заглушки.
- **Задача:** buyer-экраны (`HomeView`, `DetailsView`, `CartView`, `FavoritesView`, `OrdersView`,
  `OrderDetailView`, `AccountView`), seller feature-экраны (`SellerOrdersView`, `SellerOrdersHistoryView`,
  `InventoryView`, `SellerOrderDetailView`, `SellerProductFeedbackView`), компоненты (`ProductCard`,
  `ProductGrid`, `CartItemCard`, `CheckoutModal`, `SearchBar`, `ProductImageCarousel`, `OrderManagementCard`,
  `InventoryTable`, `ProductForm`, `StatsCard` и пр.), `FloatingNavBar` покупателя, плюс delivery-feedback
  (RECEIVED/REFUSED, рейтинг 1–5, skip).
- **Уточнение:** buyer-часть (Home, Каталог, Product Card, нижняя навигация покупателя) вынесена в
  отдельный трек `1.14` и документ `13`; здесь остаётся seller-часть и общие buyer-экраны за пределами
  storefront (Cart/Orders/Account/Product Detail).

---

### [x] 2.12 Deep links витрины → Direct Mini App `shop_<public_id>`
- **Док:** `04 §19`, `12 S-08/S-08.1`.
- **Было:** боты и серверные уведомления генерировали `t.me/<bot>/<app>?startapp=store_<internalId>` (внутренний id).
- **Стало:** везде Direct Mini App ссылка `t.me/<bot>/<app>?startapp=shop_<public_id>` (клиент — domain-правило `storefront-link`; сервер — `_shared/telegram`, `process-checkout`, `order-actions`, `telegram-notify`, боты). Старый `store_<id>` читается как legacy (резолв по внутреннему id) и будет удалён после миграции внешних ссылок.
- **Остаток:** боты `telegram-bot-buyer/-seller` исторически опираются на удалённую таблицу `customers` (привязки покупателя) — graceful-деградация; «Мои магазины» нужно перевести на актуальную модель (отдельная задача).

### [x] 2.13 Разрешение на уведомления — opt-in после checkout
- **Док:** `04 §11`, `12 S-08.1`.
- **Было:** `requestWriteAccess` вызывался до checkout (в момент «Заказать»).
- **Стало:** `placeOrder` не трогает разрешения; `order-slice.requestNotifications()` — отдельный opt-in на экране «Заказ оформлен»; согласие сохраняется (`notifications-actions` → `telegram_identities.notifications_enabled`). Отказ не влияет на заказ.

Примечание: файл будет удалён после закрытия всех пунктов.

Закрыто: 2.8 (monkey-patch `invoke` убран — вызовы идут через `functions-gateway.ts`). Пустые файлы-заглушки и неиспользуемый `application/i18n.ts` удалены.
