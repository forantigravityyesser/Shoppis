# SHOPPIS — RLS / ACCESS CONTROL (ADR-C, JWT-мост)

**Version:** 0.1  
**Дата:** 2026-10-15  
**Статус:** реализовано (гейт перед продом закрыт). Дополняет `01 D23`, `03 §26`, `04 §12`, `08 §1.1`,
`11 §S1`. Источник истины по решениям — этот документ + миграции `0062`–`0068`.

---

## 1. Контекст (что было)

- RLS выключен на всех таблицах; у `anon`/`authenticated` — полный CRUD на 22 бизнес-таблицах;
  публичный `anon`-ключ мог читать/писать любые строки.
- Атомарные RPC каталога/соц-слоя/настроек были исполняемы `PUBLIC`/`anon` и доверяли
  `p_actor_user_id` из аргументов → подмена UUID = запись в чужой магазин.
- Клиент ходил прямыми `select/update` (каталог, категории, остаток, `stores`) и писал в Storage;
  сообщения заказов публиковались в `orders:buyer/seller` без ограничения подписки.
- Кастомная HMAC-сессия не видна PostgREST → политики не могли опираться на `auth.uid()`.

## 2. Целевая модель (ADR-C — JWT-мост)

Выбран **вариант C**: edge выпускает платформенный access-JWT, клиент использует его в SDK, RLS
опирается на `auth.uid()`. Три роли доступа:

| Роль | Кто | Доступ |
|---|---|---|
| `anon` | публичный клиент до входа | только `storefront_*` RPC (проекции); таблицы — deny |
| `authenticated` | вошедший пользователь (JWT, `sub = users.id`) | SELECT своих/публичных строк по политикам; запись — deny |
| `project_admin` | edge/admin-клиент | полный обход RLS (мутации через edge) |

Поток входа: `telegram-auth` (edge) валидирует `initData`, резолвит `users`/`telegram_identities`
и возвращает **два** токена — HMAC-сессию (для edge) и платформенный RS256 access-JWT
(`sub = users.id`, `role = authenticated`). Клиент кладёт access-JWT в SDK
(`authApi.setAccessToken` из `auth-slice.setSession`), после чего database/storage/realtime
работают как `authenticated`. Ключи подписи — reserved-секреты `JWT_PRIVATE_KEY`/`JWT_KEY_ID`
(публичная половина — в JWKS `/.well-known/jwks.json`), поэтому PostgREST проверяет подпись сам.

Публичный покупательский контур остаётся на `storefront_*` (`security definer`, `anon`-execute):
эти функции не принимают actor и сами формируют безопасную проекцию.

## 3. Миграции

| # | Файл | Что делает |
|---|---|---|
| `0062` | `atomic_rpc_grants_sweep` | `REVOKE EXECUTE` у `public/anon/authenticated` на все не-storefront функции (атомарные RPC + хелперы + `currency_symbol_for` + `notify_order_realtime`); `storefront_*` остаются публичными |
| `0063` | `storage_media_policies` | `storage.objects`: RLS + public-read + запись для `authenticated` (позже сужена) |
| `0064` | `catalog_mutation_gaps` | недостающие атомарные мутации: `category_create/update/set_status_atomic`, `variant_stock_update_atomic` (guard только `available_quantity`) |
| `0065` | `rls_core` | хелперы владения, `REVOKE ALL` на 22 таблицах, `ENABLE RLS`, `GRANT SELECT` + 21 политика `authenticated`, индекс `stores(owner_user_id)` |
| `0066` | `rls_helper_grants` | `GRANT EXECUTE` на `app_*`-хелперы роли `authenticated` (Postgres требует EXECUTE у роли политики) |
| `0067` | `storage_owner_scope` | Storage: INSERT/UPDATE/DELETE только владельцу (`uploaded_by = sub`) |
| `0068` | `realtime_channels_rls` | Realtime: RLS на `realtime.channels`, подписка только на «свой» канал |

## 4. Матрица SELECT-политик (`authenticated`)

Хелперы (SECURITY DEFINER, `search_path = public, pg_temp`): `app_is_store_owner`, `app_owns_product`,
`app_owns_variant`, `app_order_readable`, `app_review_readable`, `app_question_readable`.

| Таблица | USING |
|---|---|
| `users` | `id = auth.uid()` |
| `telegram_identities` | `user_id = auth.uid()` |
| `stores` | `owner_user_id = auth.uid()` |
| `categories`, `products`, `product_groups`, `product_links` | `app_is_store_owner(store_id)` |
| `product_images`, `product_attributes`, `product_link_attributes`, `variants` | `app_owns_product(product_id)` |
| `inventory`, `inventory_movements` | `app_owns_variant(variant_id)` |
| `orders` | `buyer_user_id = auth.uid() OR app_is_store_owner(store_id)` |
| `order_items`, `order_status_history` | `app_order_readable(order_id)` |
| `reviews`, `questions` | `status = 'ACTIVE' OR buyer_user_id = auth.uid() OR app_is_store_owner(store_id)` |
| `review_replies` / `question_answers` | `app_review_readable(review_id)` / `app_question_readable(question_id)` |
| `buyer_store_visits` | `buyer_user_id = auth.uid()` |
| `order_idempotency`, `schema_migrations` | политик нет → deny (только edge) |

Записи для `authenticated` не выдаются вообще: все мутации — через edge (`project_admin`),
который RLS не подчиняется («ownership» проверяется в atomic-RPC по actor из сессии).

## 5. Storage и Realtime

- **Storage** (`storage.objects`, бакет `shoppis-media`): SELECT публичный (скачивание по URL RLS
  не гейтит); INSERT/UPDATE/DELETE — владелец (`uploaded_by = sub`). Платформа сама проставляет
  `uploaded_by` при authenticated-загрузке.
- **Realtime** (`realtime.channels`): подписка только `authenticated` и только на «свой» канал —
  `orders:buyer:<uid>` (совпадение с `sub`) или `orders:seller:<storeId>` (владение магазином).
  Handshake сокета шлёт access-JWT (`setAccessToken` синхронизирует realtime token manager).

## 6. Верификация

- Grants: `has_function_privilege` — не-storefront функции закрыты для `anon`/`authenticated`,
  `storefront_*` открыты (harness Test 38, авто-обход `pg_proc`).
- RLS-изоляция end-to-end через PostgREST с minted JWT: владелец видит только свои `stores`/
  `products`; не-владелец — 0 строк; `anon` — `401`.
- Публичный контур: `storefront_home_context_read`/`home_products_read`/`cart_items_read` как `anon`
  → `200` (definer-функции RLS обходят).
- Storage: owner upload/delete — OK; чужой delete — `Object not found` (RLS скрывает).
- Realtime-сокет: свои buyer/seller каналы → `ok`; чужие и anon → `REALTIME_UNAUTHORIZED`.
- Инварианты commerce: `npm run commerce:harness` — 207/0; `vitest` — 1447; `lint`/`typecheck` — чисто.

## 7. Rollback

Обратный порядок: `0068` (drop policy `app_realtime_orders_subscribe` + `disable row level security`
на `realtime.channels`); `0067` (вернуть broad-политики Storage, если нужно); `0065`
(`disable row level security` на 22 таблицах, `GRANT`-ы обратно у `anon/authenticated`,
`drop policy rls_*`); `0064`/`0062` (вернуть `GRANT EXECUTE` на функции, если требуется откат
гейта). Владелец таблиц (`project_admin`) RLS не подчиняется — edge-путь переживает любой откат.

## 8. Известные ограничения / follow-up

- **Legacy Storage-объекты** (`uploaded_by = NULL`, загружены бывшим admin-ключом) не удаляются
  клиентом (owner-only политика). Это orphans в бакете, не функционал; backfill невозможен —
  `storage.objects` принадлежит `postgres`, а SQL-путь идёт как `project_admin`
  (только SELECT; смена роли запрещена платформой).
- **DEV-режим без серверной сессии** (`DEV_AUTH_MODE`) читает как `anon` → под RLS упирается в
  ограничения. Прод не затронут; dev-token — необязательный follow-up.
- **Rate limiting** (checkout/upload/questions) — `11 §S3`, не закрыт.
- **NotificationDelivery** (ретраи) — `08 §2.1`, не закрыт.
