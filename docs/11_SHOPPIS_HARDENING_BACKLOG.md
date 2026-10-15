# SHOPPIS — HARDENING BACKLOG

**Назначение:** отложенный **архитектурный hardening и тех-долг**, который не входил в фичевые
заходы. Дополняет (не заменяет): `08` (расхождения код/документы), `16` (продуктовые
follow-up'ы), `05` (история разработки).
**Дата:** 2026-09-29 · **Актуализировано:** 2026-10-14 (ревизия документации, партия 5).

Severity: **S1** критично · **S2** высоко · **S3** средне · **S4** косметика.

---

## 0. Журнал закрытого (исторический)

- **Этап 1 — гигиена:** удалены пустые файлы-заглушки/barrel, мёртвый `application/i18n.ts`;
  добавлены npm-скрипты.
- **Этап 2 — tooling:** ESLint (flat) + Prettier + Vitest; `@types/react(-dom)` → 18;
  `noUnusedLocals/noUnusedParameters`; TS `7.0.2 → 6.0.3`.
- **Этап 3 — domain:** `inventory-view.ts` → `application/read-models/`; `ProductStatusError*` →
  `application/contracts/product-status.ts`.
- **Этап 4 — edge DRY:** `_shared/{env,http,auth,telegram,errors}.js`; edge-функции переведены на
  общий код; `npm run build:edge`. Позже боты тоже вынесены в `_shared/bot-api.js`/`bot-views.js`.
- **Этап 5 — порты/DIP:** `application/ports/*` + `contracts/*` + `composition/container.ts` +
  `src/composition-root.ts`; `application` не импортирует `infrastructure` (проверено grep + tsc).
- **Этап 7 — тесты:** Vitest; далее — **live commerce harness** (`npm run commerce:harness`,
  Test 1–34): гонки, идемпотентность, quantity-контракт, price axes, reconcile, order-authz,
  grants, terminal outcome, dashboard/sales.
- **Этап 8 — атомарный каталог:** `0011_catalog_atomic.sql` (7 `security definer` функций) + edge
  `catalog-actions`; фронт-мутации каталога переведены на RPC.
- **Store settings:** `0012_store_settings_atomic.sql` + `store-actions` (`update-profile`/
  `update-status`), `0013_buyer_notifications`.
- **Notifications/checkout:** opt-in на экране успеха, safety-дедлайн 60 с, серверный гейт
  `notifications_enabled` + досыл «Заказ принят» (`11` больше не держит этот пункт).
- **Migration hygiene:** `0034_create_schema_migrations.sql` + `migrations:check`/`record`
  (после дублей номеров `0024`, `0030`).
- **Lint-гигиена:** `react-hooks/set-state-in-effect` и `react-refresh` закрыты в `20`
  (`INV-HARDEN-08`); `npm run lint` — **0 errors / 0 warnings** (проверено 2026-10-14).
- **Placeholder-экраны покупателя** (`return null`) — реализованы: Home (`13`/`15`), Product Detail
  (`14`), Catalog (`17`), Cart (`18`), Orders (`22`), Favorites, Account.
- **PD-R-01…04** (Product Detail residual) — DONE (галерея `contain`, gesture-фиксы, trailing
  slash, zoom-to-point).
- **RLS-gate (S1)** — закрыт: ADR-C JWT-мост, миграции `0062`–`0068` (2026-10-15); модель — `27`.

---

## S1 — RLS и закрытие anon-доступа (гейт перед продом) — ЗАКРЫТО (2026-10-15)

Реализован ADR-C (JWT-мост, `01 D23`): edge `telegram-auth` выпускает платформенный access-JWT
(`sub = users.id`), клиент ставит его в SDK (`setAccessToken`); RLS включён на всех 22 таблицах
(`0065`), гранты и EXECUTE сужены (`0062`/`0066`), недостающие мутации вынесены в atomic-RPC
(`0064`), Storage — owner-scope (`0067`), Realtime — channel RLS (`0068`). Остаточные seller-чтения
(`fetchStoresByOwnerUser`, `checkOwnership`) больше не анонимны — их легализуют `authenticated`-
политики. Полная модель, матрица, верификация и rollback — `27_SHOPPIS_RLS_PLAN.md`.

Follow-up (не блокеры): legacy storage-orphans (`uploaded_by IS NULL`); DEV-режим без серверной
сессии читает как `anon` (dev-token — optional); rate limiting — `§S3`.

---

## S2 — Остаточный тех-долг

- **`useAppInit` и `window.Telegram.WebApp`** — bootstrap-код презентационного уровня напрямую
  читает SDK для safe-area/fullscreen. Правило «presentation не знает про infrastructure» здесь
  сознательно нарушено (инициализация до применения слоёв). Кандидат на тонкий `bootstrap-слой`.
- **valibot (5 high)** — транзитивно через `@telegram-apps/*` (ReDoS в `EMOJI_REGEX`,
  `record()`/`flatten`). Профиль риска — клиентская валидация, не серверная угроза. `npm audit fix`
  не двигает; `--force`/override на major рискует сломать Telegram SDK. **Решение:** не форсить,
  пересмотреть при обновлении `@telegram-apps/*`.
- **Единый SQL-хелпер effective price** — `DEFERRED`: формула дублируется логически в нескольких
  миграциях (`0004`, `0014`, `0015`, `0022`/`0023`, `0025`, `0026`, `0030_related`, `0033`).
  Вынос в `fn_effective_price` — отдельный backend-заход.
- **Home infinite-query memory (`maxPages`)** — `DEFERRED`: все страницы остаются в
  `query.data.pages`/DOM; лимит делать вместе с виртуализацией списка (`15 §17.1`).
- **Версии TS/React** — TS зафиксирован на `^6.0.3` (typescript-eslint не поддерживает 7.0);
  React 18. Пересматривать при выходе поддержки TS ≥7.1 / при апгрейде на React 19.

---

## S3 — Средне

- **NotificationDelivery (таблица доставок/ретраев)** — `ПЛАН` (`08 §2.7`): сейчас уведомления
  best-effort + `telegram_identities.notifications_enabled`; таблица `notifications` с
  `attempt_count`/`last_error`/ретраями независима от транзакции заказа.
- **Rate limiting** (checkout, upload, questions/reviews/search) — не реализован; числа —
  deployment-параметр (`04 §13`).
- **Серверная upload-валидация** (MIME/контент, derivatives, strip metadata) — клиентский pipeline
  есть (`04 §6`), серверный — `08 §2.4`.

---

## S4 — Косметика

- **CSS-чистка:** в `presentation/styles/components.css` возможны секции под удалённые компоненты —
  вычищать при касании UI.
- **Мёртвые колонки БД:** `products.sku` (не используется), `stores.owner_telegram_id`/
  `seller_contact` (legacy), `product_groups` (см. `16 FD-5`) — решение: довести или удалить.

---

## Ссылки на продуктовые follow-up'ы (не hardening)

Экраны/фичи, которых ещё нет, — это roadmap, а не hardening; их реестр — `16`
(linking-атрибуты, preview карточки, social-пагинация, blur-up, `product_groups` и т.п.).
