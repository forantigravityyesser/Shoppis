# VUTRINA — ОСТАТОК РАБОТ (незакрытые расхождения)

**Version:** 0.2
**Статус:** рабочий список незавершённого. Закрытые пункты удалены.
**Дата:** 2026-09-24

Документ содержит только то, что ещё предстоит сделать. Пункты привязаны к `docs/01…05` и к текущей базе: миграции `migrations/0001…0008` применены, edge-функции `telegram-auth`, `shop-create`, `process-checkout`, `order-actions` задеплоены и работают через `npm:@insforge/sdk`.

Severity: **S1** критично · **S2** высоко · **S3** средне.

---

## S1 — критично

### [ ] 1.9 RLS и backend-границы
- **Док:** `03 §23`, `04 §3`, `04 §12`, release gate `01 §9` («foreign data is accessible»).
- **Сейчас:** RLS выключен на всех таблицах, политик нет. Фронт читает каталог/заказы напрямую с anon-ключом.
- **Задача:** перевести все чтения/записи на серверные функции (или смапить Telegram-identity на auth-пользователей InsForge), затем включить RLS и написать политики (public / buyer-private / seller-private).
- **Блокер:** кастомная Telegram-сессия не распознаётся PostgREST, поэтому RLS-политики не могут опираться на identity. Включать RLS раньше перевода доступа — сломать фронт.

---

## S2 — высоко

### [ ] 2.2 Cart и Favorite в БД
- **Док:** `03 §18-19`.
- **Сейчас:** `cartByStore` / `favoritesByStore` живут только в zustand persist (`src/application/store/create-store.ts`), в БД не пишутся.
- **Задача:** таблицы `carts(id, buyer_user_id, store_id)`, `cart_items(cart_id, variant_id, quantity)`, `favorites(buyer_user_id, store_id, product_id)`; изоляция по витрине; уникальность favorite `(buyer_user_id, store_id, product_id)`; корзина не резервирует сток.

### [ ] 1.13 (остаток) Pause-экран витрины и `public_id` в ссылках
- **Док:** `02 §13`, `03 §3`, `04 §18`.
- **Сейчас:** `stores.status` (`ACTIVE/PAUSED`) и `public_id` есть; серверный guard `STORE_PAUSED` уже срабатывает в checkout (`create_order_atomic`).
- **Задача:** pause-экран витрины (показывать техническую паузу, блокировать заказы в UI); перейти на opaque `public_id` в ссылках вместо внутреннего UUID.

### [ ] 2.1 Reviews и Questions — код и UI
- **Док:** `02 §9-10`, `03 §20-21`.
- **Сейчас:** схема готова (миграция `0008`: `reviews`, `questions`, `question_answers`); код и UI отсутствуют.
- **Задача:** репозитории/слайсы + экраны карточки товара. Правила: max 1 активный отзыв на `(buyer, product)` (удаление не возвращает право на повторный), продавец может скрыть/удалить; один вопрос → максимум один ответ, без тредов; публично видны покупателям магазина.

### [ ] 2.7 (остаток) Таблица `notifications` и ретраи
- **Док:** `04 §11`, `03 §22`.
- **Сейчас:** уведомления о создании заказа и о смене статуса покупателю отправляются best-effort; таблицы `NotificationDelivery` нет.
- **Задача:** таблица `notifications` (event_type, channel, status, attempt_count, last_error), ретраи/логирование независимо от транзакции заказа.

---

## S3 — средне

### [ ] 2.4 Image pipeline
- **Док:** `04 §6`, `03 §7`.
- **Сейчас:** только клиентский resize в WebP 1200 px (`src/utils/image.ts`); лимит `MAX_IMAGES = 4` уже соблюдён.
- **Задача:** JPEG/PNG/WebP, max original 10 МБ, max 4096 px; серверная MIME/контент-валидация; derivative ~1600 px и thumbnail ~600 px; strip metadata; reject malformed.

### [ ] 2.6 Search
- **Док:** `02 §15`, `04 §8`.
- **Сейчас:** `src/presentation/buyer/components/SearchBar.tsx` пуст; поиска нет.
- **Задача:** поиск по `title` + `description`, shop-scoped, только `ACTIVE` товары.

### [ ] 2.11 UI — заглушки
- **Док:** `05` (сквозной сценарий), `02` (UX).
- **Сейчас:** реально работают только `SellerOnboardingView`, заглушка `SellerDashboard`, `SettingsView`.
- **Задача:** buyer-экраны (`HomeView`, `DetailsView`, `CartView`, `FavoritesView`, `OrdersView`, `OrderDetailView`, `AccountView`), seller (`SellerOrdersView`, `SellerManagementView`, `InventoryView`, `SellerOrderDetailView`, `SellerProductFeedbackView`), компоненты (`ProductCard`, `ProductGrid`, `CartItemCard`, `CheckoutModal`, `SearchBar`, `ProductImageCarousel`, `OrderManagementCard`, `InventoryTable`, `ProductForm`, `StatsCard` и пр.), плюс delivery-feedback (RECEIVED/REFUSED, рейтинг 1–5, skip).

### [ ] 2.8 Монки-патч `invoke`
- **Файл:** `src/infrastructure/insforge/client.ts:29`.
- **Сейчас:** `insforge.functions.invoke` переопределён своим `fetch` на `function2`-хост с anon-ключом.
- **Задача:** заменить на штатный вызов SDK (после сквозной проверки вызовов функций).

---

Примечание: файл будет удалён после закрытия всех пунктов.
