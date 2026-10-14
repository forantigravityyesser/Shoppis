# SHOPPIS — ORDERS HARDENING AUDIT

**Version:** 1.0
**Дата:** 2026-10-11  
**Актуализировано:** 2026-10-14 (ревизия документации, партия 11: `21`, `24`) — статус закрыт;
ссылка на `08 §2.11` историческая (пункт закрыт и удалён из реестра `08`); «следующая `0053`» —
сейчас проект на `0056`.
**Репозиторий:** `forantigravityyesser/Shoppis`
**Базовый срез кода:** `main @ df67079` («завершил заказы — детали заказов функционально…») + рабочее дерево (in-flight доработка ORD-14: persistent-сокет, retry/backoff, `onResync`, патч детали, снят `keepPreviousData`, manual refresh заказов — **не закоммичено**).
**Объект:** вкладка/функциональный блок **Заказы** (buyer `/orders`, seller `/seller/orders`, shared детали) — read-контур (`order-queries` + `0046`), command-контур (`order-actions` + `0007`), checkout-snapshot (`create_order_atomic`), application/read-models/hooks, shared UI, actions.
**Вне области:** realtime ORD-14 (`0047`) — **по указанию заказчика не меняем** (см. §2.4/§3.5); продуктовые решения `00`/`02`/`18`; промокоды/доставка-как-услуга/налоги/платёж/tracking/чат/reorder/invoice; активация RLS как отдельный прод-гейт (`11 §S1`); прочие таб-контуры.

**Связанные документы:** `00` (индекс), `01` (Constitution), `02` (Product Spec §6–7, §11–12, §14), `03` (Domain & Database Spec §13–18, §23–25), `04` (Technical Spec §4–5, §9, §11–12, §17), `08` (Divergence), `11` (Hardening Backlog §S1–S3), `16` (Remaining Work, FD-3), `17` (Catalog Plan — keyset-конвенция), `18` (Cart Plan — граница checkout), `21` (Commerce Hardening), `22` (Orders Technical Plan — authoritative для блока Orders), `23` (Product Copy).

**Статус документа:** authoritative для **hardening-захода Orders** (второй слой поверх реализованного `22 ORD-00…ORD-14`). Переносит внешний аудит блока заказов в формат проекта, сверяет каждый тезис с фактическим кодом (`файл:строка`), фиксирует целевые решения и порядок исправлений. Продуктовые/UX-решения `00`/`02`/`18`/`22` не пересматриваются.

**Итог захода (2026-10-11):** `ORD-HARDEN-00…12` **закрыты** — автогейты зелёные (§7/§9).
Открыто только ручное `LOCAL VERIFIED` + `TELEGRAM VERIFIED` (за человеком); realtime (ORD-14/`0047`)
остаётся accepted risk. Текущая миграция — `0052`, следующие — с `0053`.

> **Карта кода — обязательна к прочтению:** `Приложение A` — сверка тезисов аудита с фактическим кодом.

---

## 0. Метод и легенда

Документ построен в два движения:

1. **Разбор** — сверка каждого тезиса внешнего аудита с фактическим кодом (`§2`). Пункты, где аудит прав, помечаются и становятся работой; где расходится с зафиксированными решениями или уже закрыт — отменяются/помечаются.
2. **Идея** — целевые решения (`§3`), приоритеты (`§4`–`§6`) и порядок hardening (`§7`).

Легенда статуса:

| Метка | Значение |
|---|---|
| ✅ | Реализовано/проверено в коде (указан файл/строка) |
| ❌ | Не реализовано / дефект подтверждён |
| 🟡 | Частично |
| 🔒 | Решение зафиксировано этим документом |
| 🔄 | Решение/объём адаптируется относительно аудита |
| ⏭️ | Работы нет (устарело/противоречит решению) |
| 🧊 | Deferred: осознанно отложено, с триггером включения |

Severity: **H1** обязательно · **H2** высоко · **H3** средне · **H4** косметика.

---

## 1. Вердикт

Блок Orders **функционально закрыт** (`22 ORD-00…ORD-14`); гейты на базовом срезе зелёные. Hardening-заход отвечает на внешний аудит и **не переписывает** ни архитектуру, ни realtime.

| Область | Оценка аудита | Уточнение после сверки с кодом |
|---|---|---|
| Read-контур / проекции | — | Проекции корректны, keyset-clamp/курсор безопасны; **но** RPC напрямую доступны клиентским ролям и доверяют `p_actor_user_id` → 🔴 P0 |
| Изоляция актора (authz) | риск | SQL-authz по существу верна, но не является единственной точкой входа → обходится прямым вызовом RPC |
| Lifecycle actions | — | Матрица переходов верна; **delivery outcome не терминален** → 🟠 P1 |
| Денежная консистентность | — | Сумма snapshot'ится (`total_minor`), а **символ берётся из текущего магазина** → 🟠 P1 |
| Cache/identity | — | RQ-кэш заказов не привязан к личности → 🟡 P2 |
| Enum-safety (refusal/status) | — | Касты без валидации, `REFUSAL_REASON_META` может упасть → 🟡 P2 |
| Тесты | — | Unit/компонентные сильны; **интеграционных RPC-проверок мало** → 🟡 P2 |
| Realtime каналы | открыты | Подтверждено `0047`; **принято как осознанный риск** (не меняем) |

### Главное

- Переписывать невозможно: менять надо **точечно** — доступ к RPC, терминальность outcome, символ валюты, кэш/личность, enum-safety, edge-валидацию, тесты.
- **P0 — не косметика:** прямой вызов `order_list_read`/`order_detail_read` (и mutation-RPC) с публичным anon-ключом подменяет актор → чужие заказы/PII.
- Realtime (ORD-14) — **заморожен**: он не часть этого захода.

---

## 2. Разбор аудита против кода

### 2.0 P0 — RPC чтения доверяют подменённому ID

**Тезис аудита:** `order_list_read`/`order_detail_read` проверяют принадлежность по `p_actor_user_id`, переданному вызывающим; `order_list_read` доступна `public`, `order_detail_read` тоже получает grant. Edge проверяет сессию, но клиентский API не заставляет всех идти через edge. Прямой вызов RPC → подмена чужого UUID → раскрытие ПИИ (имя/телефон/адрес/товары). Простого включения RLS недостаточно, пока `SECURITY DEFINER`-функции прямо доступны и доверяют UUID.

**Факт в коде:** ❌ подтверждено.

| Артефакт | Где |
|---|---|
| `grant execute … to public` | `0046:206` (list), `0046:304` (detail) |
| Актор = параметр, identity из аргумента | `0046:37-44` (list), `0046:208-217` (detail) |
| Authz сравнивает только аргумент с владельцем | buyer `0046:99,125`; detail `0046:238-244` |
| Anon-ключ публичен (фронт + все edge) | `edge-functions/order-queries.js:54`, `order-actions.js:136`, `process-checkout.js:51` |
| Mutation-RPC без `REVOKE` | `0007` (нет `grant/revoke` → default PUBLIC), `create_order_atomic` (`0040:30-32`) |
| Утечка `buyerUserId` клиенту | `0007:96,148,227` → passthrough `order-actions.js:156,166,176` |

**Вывод:** P0 подтверждён и **шире** формулировки аудита: кроме чтения ПИИ, доступны и команды (`order_cancel`/`order_transition`/`order_delivery_outcome` с произвольным актором) и `create_order_atomic` (удержание стока). Закрывается в `ORD-HARDEN-01`.

### 2.1 P1 — Результат доставки не становится терминальным

**Тезис аудита:** сервер проверяет `status = DELIVERED`, но не проверяет `delivery_outcome IS NULL`. После `RECEIVED` статус остаётся `DELIVERED`; UI строит действия по статусу → снова показывает «Покупатель забрал»/«Отказ». Повторный `RECEIVED` снова уменьшает `held_quantity` (риск для резерва другого заказа); после `RECEIVED` можно отправить `REFUSED`, который не вернёт резерв и не отменит движение доставки. Тест продавца проверяет `CANCELLED`, но не `DELIVERED + RECEIVED`.

**Факт в коде:** ❌ подтверждено.

| Артефакт | Где |
|---|---|
| Проверяется только статус | `0007:182` (`if v_order.status <> 'DELIVERED'`) |
| `RECEIVED` повторно вычитает held | `0007:192-206` |
| `RECEIVED → REFUSED` меняет статус без возврата резерва | `0007:214-222` |
| UI-действия по статусу, не по outcome | `SellerOrderDetailsView.tsx:55-97`, `:104` (`status === 'DELIVERED'`) |
| Domain-правило тоже только по статусу | `order-rules.ts:33` (`isAwaitingDeliveryOutcome`) |

**Вывод:** P1 подтверждён. Серверный гейт + UI-гейт + тесты — `ORD-HARDEN-02`.

### 2.2 P1 — Историческая сумма с неправильным символом валюты

**Тезис аудита:** заказ хранит `currency_code`, сумма — в `total_minor`; символ берётся из текущего `v_store.currency_symbol`. Смена валюты магазина искажает старые заказы (BYN → отображение `$`). Нужно вычислять по сохранённому коду либо snapshot'ить символ при оформлении.

**Факт в коде:** ❌ подтверждено.

| Артефакт | Где |
|---|---|
| `orders.currency_code` есть, `currency_symbol` — нет | `0003:15` |
| list берёт символ магазина | `0046:149` (`v_store.currency_symbol`) |
| detail берёт символ магазина | `0046:254` |
| чек `create_order_atomic` пишет `currency_code`, не символ | `0040:30-32,133` |

**Решение (freeze):** колонка-снимок `orders.currency_symbol_snapshot` + backfill — `ORD-HARDEN-03`.

### 2.3 P2 — Кэш заказов не привязан к личности

**Тезис аудита:** ключи React Query списка/деталей не включают id пользователя; `clearSession()` не чистит кэш RQ.

**Факт в коде:** ❌ подтверждено.

| Артефакт | Где |
|---|---|
| Ключи без user id | `useOrders.ts:17-20` (`['orders', scope, storeRef, filter]`, `['order', scope, orderId]`) |
| `clearSession` не чистит RQ-кэш | `auth-slice.ts:85` (`set({ sessionToken: null, serverUser: null })`); `resetOrders` чистит только checkout-исход (`order-slice.ts:92`) |
| Долгий `staleTime` | `queryClient.ts:7` (5 мин) |

**Вывод:** `ORD-HARDEN-04`.

### 2.4 P2 — refusal-коды и enum-safety

**Тезис аудита:** `refusal_reason_code` без перечислимого ограничения на уровне схемы; сервер для отказа проверяет только непустую причину; маппер приводит неизвестные значения через cast → `REFUSAL_REASON_META` может сломаться.

**Факт в коде:** ❌ подтверждено.

| Артефакт | Где |
|---|---|
| `refusal_reason_code text` без CHECK | `0003:23` |
| Сервер: только непустая причина | `0007:188` |
| Маппер кастует вслепую | `order-mappers.ts:61-68` (`asStatus`, `asNullableEnum`) |

**Вывод:** `ORD-HARDEN-06` (сервер + маппер + UI-fallback; пересекается с enum-safety статуса).

### 2.5 P2 — Realtime-каналы открыты (не меняем)

**Тезис аудита:** каналы `0047` открыты для подписки; ID+статус не должны быть общедоступным потоком.

**Факт:** подтверждено (`0047:21-34`); риск задокументирован в самой миграции (`0047:21-26`) и `22 §4.4`.

**Решение (freeze):** ⏭️ **по указанию заказчика realtime не меняем** в этом заходе. Риск фиксируется как accepted в `§3.5`; пересмотр — отдельный заход (RLS realtime / InsForge Auth).

### 2.6 P2 — Тесты: интеграционные RPC-проверки

**Тезис аудита:** unit-тесты экранов подменяют hooks/команды; нужны интеграционные проверки RPC (изоляция buyer/seller, переходы статусов, остатки, гонки, повторные команды).

**Факт:** 🟡 частично. Harness покрывает Test 7/8/9/11–24 (`scripts/commerce-harness.mjs`), включая authz чтения (Test 24) и username (Test 23); новые сценарии из этого аудита (повтор outcome, currency, прямой anon-вызов) — `ORD-HARDEN-11` + по этапам.

### 2.7 Дополнительные находки (не из аудита; без realtime)

Подтверждены по коду в ходе разбора; включаются в план.

| № | Находка | Факт в коде | Этап |
|---|---|---|---|
| D1 | Edge не валидирует `orderId`/`limit`/`cursor`/`actorType` → типовые PostgREST-ошибки уходят как 500, не 400 | `order-queries.js:32-46,63-75`; `order-actions.js:56` (`actorType === 'buyer' ? … : 'seller'`) | 07 |
| D2 | Дубль уведомления покупателю при идемпотентном ретрае checkout | `process-checkout.js:147-167` (не учитывает `result.idempotent`) | 07 |
| D3 | `search_path = public` без `pg_temp` у lifecycle-RPC (конвенция `0032`) | `0007:16,111,162` | 08 |
| D4 | Непостоянное по времени сравнение HMAC сессии; нет окна свежести `auth_date` | `_shared/auth.js:50,66-80` | 08 |
| D5 | `/orders` без store-контекста → ложный empty (запрос disabled) | `useOrders.ts:57` (`enabled` требует `storeRef`); `OrdersView` не отличает «нет магазина» от «заказов нет» | 05 |
| D6 | Seller-view дублирует матрицу переходов вручную вместо domain-rules | `SellerOrderDetailsView.tsx:55-97` vs `order-rules.ts:17-51` | 09 |
| D7 | buyer/seller списки дублируют разметку/EMPTY/loading; sentinel-хук лежит в buyer-папке | `OrdersView.tsx` / `SellerOrdersView.tsx`; `useInfiniteScrollSentinel` | 09 |
| D8 | Мёртвый код/неиспользуемые экспорты в orders-контуре | напр. `useOrders.ts:11-12` (`ORDER_*_QUERY_ROOT`), неиспользуемые поля read-model/пропсы | 09 |
| D9 | a11y: tabs без клавиатурной семантики, нет `:focus-visible`, скелетон/confirm без live-объявления | `OrderStatusTabs.tsx`, `orders.css`, `OrderConfirm` | 10 |
| D10 | Ошибка команды обновляет только detail (не список) при 5-мин `staleTime` | `OrderDetailsView.tsx` / `SellerOrderDetailsView.tsx` (`refetch()`), `queryClient.ts:7` | 04/07 |

> Замечания `D3`/`D4` — про общий auth/SQL; меняем **точечно**, не расширяя scope блока заказов.

---

## 3. Зафиксированные решения (freeze)

### 3.1 Доступ к защищённым RPC (P0)

- `REVOKE EXECUTE` на защищённые RPC от `public`/`anon`/`authenticated`: `order_list_read`, `order_detail_read` (`0046`), `order_cancel`, `order_transition`, `order_delivery_outcome`, `inventory_reconcile` (`0007`), `create_order_atomic` (`0040`).
- Edge-функциям даётся отдельный доверенный server-only доступ: reserved-секрет `API_KEY` (роль `project_admin`, инжектится платформой) → `adminClient` из `_shared/clients.js` для RPC в `order-queries`/`order-actions`/`process-checkout` вместо `ANON_KEY`.
- `buyerUserId` **не** возвращается клиенту из `order-actions` (используется только внутри edge для уведомления).
- RLS сам по себе не закрывает проблему (совпадает с аудитом) — гейт именно на гранты + доверенный вызов.
- Паттерн применим и к другим trust-param RPC проекта — фиксируется как follow-up (`11 §S1`), вне scope этого захода.

### 3.2 Delivery outcome (P1)

- Фиксация результата допустима **только** при `status = 'DELIVERED' AND delivery_outcome IS NULL`.
- Повторная фиксация → **явная ошибка** `OUTCOME_ALREADY_RECORDED` (детерминированно, не no-op).
- UI: outcome-действия показываются только при `deliveryOutcome === null`.
- Действия строятся по domain-rules (`isAwaitingDeliveryOutcome` + outcome), а не только по статусу.

### 3.3 Валюта истории (P1)

- `orders.currency_symbol_snapshot` — immutable-снимок символа на момент checkout; backfill для существующих заказов из текущего символа магазина.
- `create_order_atomic` пишет снимок; проекции `0046` (list/detail) читают снимок; fallback — по сохранённому `currency_code`.

### 3.4 Кэш ↔ личность (P2)

- Orders-кэш привязан к личности: ключи включают user id **и/или** orders-кэш очищается при `clearSession`/смене `serverUser`.
- Явный короткий `staleTime` для orders-запросов вместо унаследованных 5 минут.

### 3.5 Realtime (ORD-14 / `0047`) — заморозка

- ⏭️ **Не меняем.** Каналы остаются открытыми (accepted risk, задокументирован в `0047`/`22 §4.4`). UI-инвалидация/refresh поверх realtime — существующий контракт, не трогаем.
- Триггерные/канальные правки (best-effort publish и т.п.) — **вне этого захода**.

---

## 4. P0

| № | Проблема | Решение | Этап |
|---|---|---|---|
| P0-1 | Прямой вызов защищённых RPC с клиентских ролей + доверие `p_actor_user_id` → чтение ПИИ/команды/удержание стока от чужого имени | `REVOKE` + доверенный reserved `API_KEY` для edge; срезать `buyerUserId` из ответа | ORD-HARDEN-01 ✅ |

---

## 5. P1

| № | Проблема | Решение | Этап |
|---|---|---|---|
| P1-1 | Delivery outcome не терминален (повтор RECEIVED/RECEIVED→REFUSED) | Гейт `status=DELIVERED AND delivery_outcome IS NULL` + `OUTCOME_ALREADY_RECORDED`; UI по outcome; тесты | ORD-HARDEN-02 |
| P1-2 | Символ валюты берётся из текущего магазина | `currency_symbol_snapshot` + backfill; проекции/чек | ORD-HARDEN-03 |
| P1-3 | RQ-кэш заказов не привязан к личности | Ключи с user id / очистка на смену сессии; короткий `staleTime` | ORD-HARDEN-04 |
| P1-4 | `/orders` без store → ложный empty (D5) | Причина disabled из `useOrders`; отдельное состояние | ORD-HARDEN-05 |

---

## 6. P2

| № | Проблема | Решение | Этап |
|---|---|---|---|
| P2-1 | Enum-safety: `refusal_reason_code`/`status` без валидации | Валидация на сервере/маппере + safe-getters в UI | ORD-HARDEN-06 |
| P2-2 | Edge-валидация и контракт ошибок (D1); дубль уведомлений при idempotent (D2) | 400-коды, clamp; skip notify при `idempotent` | ORD-HARDEN-07 |
| P2-3 | `search_path` без `pg_temp` (D3); timing-safe HMAC + окно `auth_date` (D4) | Точечные правки | ORD-HARDEN-08 |
| P2-4 | Дубли frontend/ручная матрица (D6/D7); мёртвый код (D8) | Shared `OrdersListBody`; domain-rules; чистка | ORD-HARDEN-09 |
| P2-5 | A11y (D9) | Tabs/focus/live | ORD-HARDEN-10 |
| P2-6 | Мало интеграционных RPC-тестов | Harness: изоляция/переходы/остатки/гонки/повтор | ORD-HARDEN-11 |

---

## 7. Этапы

Порядок: baseline → P0-доступ → корректность lifecycle → консистентность данных → кэш/UX → гигиена → финальный аудит. Каждый этап: `typecheck → lint → test` (+ `commerce:harness` при backend) → следующий.

| Этап | Содержание | Severity | Статус |
|---|---|---|---|
| **ORD-HARDEN-00** | Baseline: заморозка in-flight ORD-14, гейты, этот документ | — | ✅ (2026-10-11) |
| **ORD-HARDEN-01** | P0-1: миграция `0048` (`REVOKE`), reserved `API_KEY` → `adminClient` в edge, срезать `buyerUserId`, harness Test 25 | H1 | ✅ (2026-10-11) |
| **ORD-HARDEN-02** | P1-1: миграция `0049` (гейт outcome), edge/UI/код ошибки, тесты | H1 | ✅ (2026-10-11) |
| **ORD-HARDEN-03** | P1-2: миграция `0050` (`currency_symbol_snapshot` + backfill), чек/проекции/рендер, тесты | H1 | ✅ (2026-10-11) |
| **ORD-HARDEN-04** | P1-3: ключи с user id / очистка кэша, `staleTime`, инвалидация списка при ошибке команды | H1 | ✅ (2026-10-11) |
| **ORD-HARDEN-05** | P1-4: `/orders` без store-контекста | H2 | ✅ (2026-10-11) |
| **ORD-HARDEN-06** | P2-1: enum/refusal-safety | H3 | ✅ (2026-10-11) |
| **ORD-HARDEN-07** | P2-2: edge-валидация + контракт ошибок, анти-дубль уведомлений | H3 | ✅ (2026-10-11) |
| **ORD-HARDEN-08** | P2-3: `pg_temp` + timing-safe HMAC + окно `auth_date` | H3 | ✅ (2026-10-11) |
| **ORD-HARDEN-09** | P2-4: дедуп frontend, domain-rules в действиях, мёртвый код | H3 | ✅ (2026-10-11) |
| **ORD-HARDEN-10** | P2-5: a11y | H4 | ✅ (2026-10-11) |
| **ORD-HARDEN-11** | P2-6: интеграционные RPC-тесты в harness | H3 | ✅ (2026-10-11) |
| **ORD-HARDEN-12** | Финальный аудит + docs-sync (`00/16/22/24`) + гейты; LOCAL/TELEGRAM — за человеком | H1 | ✅ (2026-10-11) |

### ORD-HARDEN-00 — Baseline (✅ 2026-10-11)

Рабочее дерево зафиксировано (in-flight ORD-14 + manual refresh), гейты на срезе `df67079` + рабочее дерево:

```text
npm run typecheck      ✅
npm run lint           ✅ (0 errors)
npm run test           ✅ 1028/1028 (157 files)
npm run commerce:harness ✅ 102/102
```

> Прежние наблюдения «плавающих» падений тестов относились к моменту, когда дерево редактировалось параллельно; на замороженном дереве гейты зелёные, `keepPreviousData`/детали/intents realtime — закоммичены вместе с baseline (по согласованию).

### ORD-HARDEN-01 — P0: закрытие прямого доступа к RPC (✅ 2026-10-11)

- Миграция `0048_order_rpc_grants.sql`: `REVOKE ALL ... FROM public, anon, authenticated` для `order_cancel`, `order_transition`, `order_delivery_outcome`, `inventory_reconcile`, `order_list_read`, `order_detail_read`, `create_order_atomic`. Применена на dev, записана в `public.schema_migrations`.
- Доверенный серверный путь: новый `edge-functions/_shared/clients.js` (`anonClient`/`adminClient`); `adminClient` использует reserved-секрет `API_KEY` (роль `project_admin`). `order-queries`/`order-actions`/`process-checkout` переведены на `adminClient` для защищённых RPC и задеплоены.
- `buyerUserId` не возвращается клиенту из `order-actions` (используется только для уведомления внутри edge).
- Проверка: guard edge проходит с `API_KEY` (вызов без токена → `401`, не `500`); живые гранты — `anon`/`authenticated` = `false`, `project_admin` = `true` по всем 7 функциям.
- Harness **Test 25** (grants). Гейты: `typecheck` ✅ · `lint` ✅ · `test` 1028/1028 ✅ · `build` ✅ · `commerce:harness` **105/105** ✅.

### ORD-HARDEN-02 — P1: терминальность delivery outcome (✅ 2026-10-11)

- Миграция `0049_order_delivery_outcome_gate.sql`: `order_delivery_outcome` пересоздана с гейтом `status = 'DELIVERED' AND delivery_outcome IS NULL`; повторный вызов (в т.ч. `RECEIVED → REFUSED`) → `OUTCOME_ALREADY_RECORDED`. Строка читается `for update`, поэтому два параллельных outcome сериализуются — успешен ровно один. Сигнатура не изменена, поэтому `create or replace` сохраняет отозванные в `0048` EXECUTE-гранты. Применена на dev, записана в `public.schema_migrations`.
- Edge `order-actions`: `OUTCOME_ALREADY_RECORDED → 409` в `ERROR_STATUS`; функция задеплоена.
- Domain `order-rules`: `isAwaitingDeliveryOutcome(status, deliveryOutcome)` — DELIVERED ждёт outcome, только пока `deliveryOutcome === null` (после RECEIVED статус остаётся DELIVERED, но результат терминален).
- `SellerOrderDetailsView`: outcome-действия строятся по domain-rule и показываются только при незафиксированном outcome; `order-action-error` — человекочитаемый текст для `OUTCOME_ALREADY_RECORDED`.
- Тесты: `order-rules.test` (терминальность), `SellerOrderDetailsView.test` (нет действий после фиксации outcome), `order-action-error.test`; harness **Test 26** (повтор RECEIVED, `RECEIVED → REFUSED`, гонка двух параллельных outcome).
- Гейты: `typecheck` ✅ · `lint` ✅ · `test` 1030/1030 ✅ · `build` ✅ · `migrations:check` (0001..0049) ✅ · `commerce:harness` **114/114** ✅.

### ORD-HARDEN-03 — P1: исторический символ валюты (✅ 2026-10-11)

- Миграция `0050_order_currency_symbol_snapshot.sql`: колонка `orders.currency_symbol_snapshot`; helper `public.currency_symbol_for(code)` (детерминированная карта `USD→$`, `RUB→₽`, `BYN→Br`, `EUR→€`); backfill существующих заказов (символ магазина при совпадении валюты, иначе — по сохранённому `currency_code`); `create_order_atomic` пишет снимок и возвращает `currencySymbol` в обеих ветках (в т.ч. идемпотентной); `order_list_read`/`order_detail_read` читают снимок с fallback по коду. Применена на dev, записана в `public.schema_migrations`; `create or replace` сохранил гранты/ownership — Test 25 зелёный.
- `order-mappers`: `currencySymbol` с детерминированным fallback по `currencyCode`, если проекция вернула пусто.
- Тесты: `order-mappers.test` (fallback символа), harness **Test 27** (снимок на checkout; смена валюты магазина не «переезжает» историю в list/detail; fallback по коду).
- Гейты: `typecheck` ✅ · `lint` ✅ · `test` 1032/1032 ✅ · `build` ✅ · `migrations:check` (0001..0050) ✅ · `commerce:harness` **120/120** ✅.

### ORD-HARDEN-04 — P1: кэш ↔ личность + короткий staleTime (✅ 2026-10-11)

- Ключи React Query заказов вынесены в `src/application/orders/order-cache.ts` и теперь включают identity: `['orders', userId, scope, storeRef, filter]` / `['order', userId, scope, orderId]`. Кэш одного пользователя физически не может быть выдан как свой при смене сессии.
- `clearOrderCache(queryClient)` вызывается в `clearSession` и при смене `serverUser` (`setSession`) — orders-кэш не переживает смену личности; `invalidateOrderLists` остаётся на root-ключах, поэтому инвалидация всех табов/деталей не меняется.
- Явный короткий `staleTime` (`ORDER_STALE_TIME_MS`, 15с) для `useOrders`/`useOrderDetails` вместо унаследованных 5 минут.
- D10: ошибка команды теперь инвалидирует список (`useOrderActions.onError`); views по-прежнему чинят открытую деталь (`refetch`), но список больше не остаётся со старым статусом.
- Тесты: `useOrders` (ключ включает identity), `useOrdersRealtime` (identity в ключах детали), `useOrderActions` (ошибка → инвалидация списка), новый `auth-slice.test` (clearSession / смена пользователя очищают orders-кэш).
- Гейты: `typecheck` ✅ · `lint` ✅ · `test` 1036/1036 ✅ · `build` ✅ · `migrations:check` (0001..0050) ✅ · `commerce:harness` **120/120** ✅.

### ORD-HARDEN-05 — P1: `/orders` без store-контекста (✅ 2026-10-11)

- `useOrders` теперь отдаёт `disabledReason` (`'disabled' | 'no-session' | 'no-store' | null`) вместо только неявного bool `enabled` (docs/24 §2.7 D5).
- `OrdersView` при `no-store`/`no-session` показывает отдельное состояние («Откройте магазин, чтобы посмотреть заказы» / «Войдите…»), а не ложное «Заказов пока нет» — заказы остаются store-scoped (docs/22 §58/283).
- Тесты: `useOrders` (причина disabled по всем веткам), `OrdersView` (нет store/сессии → отдельный текст, пустой список по-прежнему отдельно); база `listState` обновлена в buyer/seller view-тестах.
- Гейты: `typecheck` ✅ · `lint` ✅ · `test` 1039/1039 ✅ · `build` ✅ · `migrations:check` (0001..0050) ✅ · `commerce:harness` **120/120** ✅.

### ORD-HARDEN-06 — P2: enum / refusal-safety (✅ 2026-10-11)

- Миграция `0051_order_refusal_reason_check.sql`: CHECK `orders_refusal_reason_code_check` (только контролируемые коды 02 §7); `order_delivery_outcome` отвергает неизвестный код `INVALID_REFUSAL_REASON`. Применена на dev, записана (гранты/ownership сохранены).
- Domain `order-statuses.ts`: списки `ORDER_STATUSES`/`REFUSAL_REASON_CODES`/`DELIVERY_OUTCOMES`, type-guards `is*` и safe-getters `orderStatusLabel`/`refusalReasonLabel`.
- Mapper `order-mappers.ts`: `asStatus`/`asRefusalReasonCode`/`asDeliveryOutcome` валидируют значения вместо слепого cast; неизвестные → безопасный fallback (статус `NEW`, коды `null`).
- UI: `OrderStatusBadge`/`OrderDetailsContent` используют safe-getters — неизвестное значение не роняет рендер.
- Edge `order-actions`: `INVALID_REFUSAL_REASON → 400`, задеплоена; `order-action-error` — текст для кода.
- Тесты: `order-mappers` (fallback), `OrderStatusBadge`/`OrderDetailsContent` (неизвестное значение не падает), `order-action-error`; harness **Test 28** (неизвестный/пустой/валидный код); эталонные коды отказа в harness заменены с `DAMAGED` на `OTHER`.
- Гейты: `typecheck` ✅ · `lint` ✅ · `test` 1043/1043 ✅ · `build` ✅ · `migrations:check` (0001..0051) ✅ · `commerce:harness` **126/126** ✅.

### ORD-HARDEN-07 — P2: edge-валидация и контракт ошибок + анти-дубль уведомлений (✅ 2026-10-11)

- Новый `edge-functions/_shared/validate.js`: `isUuid`, `parseEnum`, `parseLimit` (clamp 1..50), `isValidCursor` (`<epoch>:<uuid>`), `parsePositiveInt`, `validateOrderAction`.
- `order-queries` (D1): detail требует валидный `orderId` (`INVALID_ORDER_ID`); list — числовой `limit` (`INVALID_LIMIT`, clamp) и строгий формат `cursor` (`INVALID_CURSOR`) → детерминированный 400 вместо PostgREST 500.
- `order-actions` (D1): `validateOrderAction` проверяет `action`/`orderId`/`actorType`/`toStatus`/`outcome`/`variantId`/`quantity`; `actorType` больше не «схлопывается» в `seller` (`INVALID_ACTOR`).
- `process-checkout` (D2): `shouldNotifyCheckout` — идемпотентный ретрай (тот же ключ) не дублирует уведомления покупателю/продавцу.
- Edge пересобраны и задеплоены: `order-queries`, `order-actions`, `process-checkout`.
- Тесты: `_shared/validate.test.js` (валидаторы + `validateOrderAction`), `_shared/checkout-notify.test.js` (анти-дубль).
- Гейты: `typecheck` ✅ · `lint` ✅ · `test` 1059/1059 ✅ · `build` ✅ · `migrations:check` (0001..0051) ✅ · `commerce:harness` **126/126** ✅.

### ORD-HARDEN-08 — P2: pg_temp + timing-safe HMAC + окно auth_date (✅ 2026-10-11)

- Миграция `0052_orders_search_path_pg_temp.sql`: lifecycle-RPC блока заказов (`order_cancel`, `order_transition`, `order_delivery_outcome`, `inventory_reconcile`, `create_order_atomic`) переведены на `search_path = public, pg_temp` (конвенция 0032) через `alter function` — тела не пересоздаются, гранты/ownership сохранены. Применена на dev, записана.
- `_shared/auth.js` (D4): `timingSafeEqual` (постоянное по времени сравнение) применён в `verifySession` и `isValidTelegramInitData`; добавлено окно свежести `auth_date` (default 24ч, допуск ±60с «из будущего»). `telegram-auth` читает необязательный `AUTH_MAX_AGE_SECONDS`.
- Edge пересобраны и задеплоены (10 функций, бандлящих `_shared/auth.js`).
- Тесты: новый `_shared/auth.test.js` (timing-safe, `verifySession` валид/подделка/просрочка, `auth_date` свежесть/просрочка/будущее/отсутствие/чужой токен).
- Замечание: тот же `search_path`-регресс наблюдается ещё у 19 SECURITY DEFINER функций вне блока заказов (catalog/store/storefront) — **вне scope** этого захода, follow-up `11 §S1`.
- Гейты: `typecheck` ✅ · `lint` ✅ (0 errors) · `test` 1078/1078 ✅ · `build` ✅ · `migrations:check` (0001..0052) ✅ · `commerce:harness` **126/126** ✅.

### ORD-HARDEN-09 — P2: дедуп frontend, domain-rules в действиях, мёртвый код (✅ 2026-10-11)

- D7: новый `shared/orders/OrdersListBody` — единое тело списка (skeleton/error/disabled/empty/list + sentinel + loading-more) для `OrdersView` (buyer) и `SellerOrdersView` (seller); разметка и per-tab пустые тексты больше не дублируются между view.
- `useInfiniteScrollSentinel` перенесён `buyer/hooks → shared/hooks` (используется Home/Catalog/Orders обоих контуров), импорты обновлены; тест переехал вместе с хуком.
- D6: `SellerOrderDetailsView.buildActions` собирает действия из domain-rules (`isAwaitingDeliveryOutcome` + `nextAllowedStatus` + `isCancellable`); ручная матрица переходов удалена.
- D8: удалён мёртвый ре-экспорт `ORDER_*_QUERY_ROOT` из `useOrders`; корни кэша стали module-private в `order-cache` (потребители используют `orderKeys`).
- Гейты: `typecheck` ✅ · `lint` ✅ (0 errors) · `test` 1078/1078 ✅ · `build` ✅ · `migrations:check` (0001..0052) ✅ · `commerce:harness` **126/126** ✅.

### ORD-HARDEN-10 — P2: a11y (tabs / focus / live) (✅ 2026-10-11)

- `OrderStatusTabs` (D9): ARIA tabs с клавиатурной семантикой — roving tabindex (в tab-порядке только активный), `ArrowLeft/Right/Up/Down` + `Home/End` переключают таб и переносят фокус; необязательный `panelId` → `aria-controls`.
- `OrdersView`/`SellerOrdersView`: тело списка обёрнуто в `role="tabpanel"` (`aria-label`), связанное с tablist.
- `OrderSkeleton`: live-статус (`role="status"` + `sr-only` «Загрузка…»), визуальные блоки `aria-hidden`; `OrderEmptyState` — `role="status"`.
- `OrderConfirm`/`OrderRefusalPicker`: `aria-busy={pending}` (помимо уже существующего `role="alert"` на ошибке).
- `orders.css`: утилита `.sr-only` и единый `:focus-visible` (outline) для всех интерактивных элементов контура заказов.
- Тесты: `OrderStatusTabs` (клавиатура, roving tabindex, `aria-controls`), `OrderSkeleton` (`role=status` + `aria-hidden` блоки).
- Гейты: `typecheck` ✅ · `lint` ✅ (0 errors) · `test` 1081/1081 ✅ · `build` ✅ · `migrations:check` (0001..0052) ✅ · `commerce:harness` **126/126** ✅.

### ORD-HARDEN-11 — P2: интеграционные RPC-тесты в harness (✅ 2026-10-11)

- Harness расширен с read-контура (Test 24) на командный:
  - **Test 29** (изоляция актора): чужой buyer `cancel` → `FORBIDDEN`; не-владелец seller `cancel`/`transition`/`outcome` → `FORBIDDEN`; buyer `transition` → `FORBIDDEN`; владелец `cancel` NEW → ok; повтор → `ORDER_TERMINAL`.
  - **Test 30** (матрица переходов и повтор): `NEW→DELIVERED`, `transition→CANCELLED`, повтор/назад `IN_TRANSIT`, повтор `DELIVERED` → `TRANSITION_NOT_ALLOWED`; seller/buyer `cancel` DELIVERED → `CANCEL_NOT_ALLOWED`; `actorType=admin` → `INVALID_ACTOR`.
- Вместе с ранее добавленными Test 25–28 (grants, outcome-терминальность, currency, refusal enum) harness покрывает изоляцию/переходы/остатки/гонки/повторные команды.
- Гейты: `typecheck` ✅ · `lint` ✅ (0 errors) · `test` 1081/1081 ✅ · `build` ✅ · `migrations:check` (0001..0052) ✅ · `commerce:harness` **143/143** ✅.

### ORD-HARDEN-12 — Финальный аудит и docs-sync (✅ 2026-10-11)

- Прогнаны все гейты (§8) — зелёные; конфликтов между этапами нет, регрессий не внесено.
- docs-sync: `00` (запись 2026-10-11 — Orders hardening, текущая миграция `0052`), `16` (FD-3 Orders
  + строка hardening), `22` (связанные документы + секция `ORD-HARDEN-01…12`), `24` (§7 все этапы ✅,
  §9 DoD, Приложение A, нумерация миграций).
- Realtime (ORD-14 / `0047`) не менялся — accepted risk зафиксирован. Активация RLS и `pg_temp`-свип
  по остальным 19 SECURITY DEFINER функций — отдельные follow-up (`11 §S1`).
- Открыто: ручной `LOCAL VERIFIED` + `TELEGRAM VERIFIED` (за человеком).
- Гейты: `typecheck` ✅ · `lint` ✅ (0 errors) · `test` 1081/1081 ✅ · `build` ✅ · `migrations:check` (0001..0052) ✅ · `commerce:harness` **143/143** ✅.

---

## 8. Тестовый план

- **P0 (01):** harness Test 25 — прямой вызов `order_list_read`/`order_detail_read`/`order_cancel`/`create_order_atomic` с anon-ключом и чужим `p_actor_user_id` → permission denied; сквозные checkout/actions через edge не сломаны; `buyerUserId` отсутствует в ответе `order-actions`.
- **Outcome (02):** harness — повторный `RECEIVED` → `OUTCOME_ALREADY_RECORDED`, `RECEIVED→REFUSED` → ошибка, два параллельных outcome → один успех; UI — действия скрыты при `deliveryOutcome !== null`; domain-rule.
- **Валюта (03):** проекция/detail старого заказа сохраняет символ после смены валюты магазина; `create_order_atomic` пишет снимок.
- **Кэш (04):** `clearSession`/смена `serverUser` очищает orders-кэш; смена пользователя не показывает чужие заказы.
- **Enum (06):** маппер — неизвестные `status`/`refusalReasonCode` → безопасный fallback; UI не падает.
- **Edge (07):** невалидные `orderId`/`limit`/`cursor`/`actorType` → 400 с кодами; idempotent-retry не шлёт второе уведомление.
- **Интеграция (11):** изоляция buyer/seller, переходы статусов, остатки, гонки, повторные команды (расширение Test 24).

Гейты:

```text
npm run typecheck
npm run lint        (0 errors)
npm run test
npm run build
npm run migrations:check          (при новой миграции)
npm run commerce:harness          (при backend-этапах)
```

---

## 9. Definition of Done

### Безопасность (P0)
- [x] Клиентские роли (`anon`/`authenticated`) не могут напрямую вызвать защищённые order-RPC.
- [x] Edge вызывает защищённые RPC доверенным server-only способом.
- [x] `buyerUserId` не утекает клиенту.
- [x] Harness Test 25 зелёный.

### Lifecycle (P1)
- [x] Повтор outcome → `OUTCOME_ALREADY_RECORDED`; `RECEIVED→REFUSED` запрещён.
- [x] UI не показывает outcome-действия после фиксации.
- [x] Тесты повтора/гонки зелёные.

### Данные (P1)
- [x] Исторический заказ сохраняет валюту/символ при смене настроек магазина.
- [x] Orders-кэш не переживает смену личности.

### Контракты/UI (P2)
- [x] Enum-safety на границе; edge-валидация → 400; нет дубль-уведомлений.
- [x] Нет дублей buyer/seller списков; действия из domain-rules; мёртвый код удалён.
- [x] a11y: tabs/focus/live.

### Realtime
- [x] ⏭ Не меняется (accepted risk зафиксирован).

### Гейты
- [x] `typecheck`/`lint`/`test`/`build`/`migrations:check`/`commerce:harness` зелёные.
- [ ] `LOCAL VERIFIED` + `TELEGRAM VERIFIED` — ручная проверка (за человеком).

> Статус: hardening закрыт (`ORD-HARDEN-00…12`). Автоматические гейты зелёные; остаётся ручной
> smoke в браузере/Telegram Mini App.

---

## Приложение A. Карта кода (сверка на 2026-10-11, рабочее дерево)

| Тезис аудита | Артефакт(ы) | Вывод |
|---|---|---|
| P0: RPC доверяют `p_actor_user_id` | `0046:206,304` (grants), `0046:37-44,208-217` (params), `0046:99,125,238-244` (authz), `0007` (нет revoke), `0040:30-32`, `0007:96,148,227` + `order-actions.js:156,166,176` (leak) | ✅ закрыт → 01 (`0048`) |
| P1: outcome не терминален | `0007:182,192-222`, `SellerOrderDetailsView.tsx:55-97,104`, `order-rules.ts:33` | ✅ закрыт → 02 (`0049`) |
| P1: символ валюты | `0003:15`, `0046:149,254`, `0040:133` | ✅ закрыт → 03 (`0050`) |
| P2: кэш личности | `useOrders.ts:17-20`, `auth-slice.ts:85`, `queryClient.ts:7` | ✅ закрыт → 04 |
| P2: refusal/enum | `0003:23`, `0007:188`, `order-mappers.ts:61-68` | ✅ закрыт → 06 (`0051`) |
| P2: realtime каналы | `0047:21-34` | ⏭ не меняем (accepted) |
| P2: интеграционные тесты | `scripts/commerce-harness.mjs` (Test 7–24) | ✅ закрыт → 11 (Test 25–30) |
| D1: edge-валидация | `order-queries.js:32-46,63-75`, `order-actions.js:56` | ✅ закрыт → 07 |
| D2: дубль уведомления | `process-checkout.js:147-167` | ✅ закрыт → 07 |
| D3: `search_path` | `0007:16,111,162` | ✅ закрыт → 08 (`0052`) |
| D4: HMAC/`auth_date` | `_shared/auth.js:50,66-80` | ✅ закрыт → 08 |
| D5: `/orders` без store | `useOrders.ts:57` | ✅ закрыт → 05 |
| D6: ручная матрица | `SellerOrderDetailsView.tsx:55-97`, `order-rules.ts:17-51` | ✅ закрыт → 09 |
| D7/D8: дубли/мёртвый код | `OrdersView.tsx`/`SellerOrdersView.tsx`, `useOrders.ts:11-12` | ✅ закрыт → 09 |
| D9: a11y | `OrderStatusTabs.tsx`, `orders.css` | ✅ закрыт → 10 |

### Нумерация миграций

`0040`–`0047` заняты. Заход Orders-hardening: `0048` (revoke грантов), `0049` (outcome-гейт), `0050`
(`currency_symbol_snapshot`), `0051` (refusal-reason CHECK), `0052` (`pg_temp` для lifecycle-RPC).
Текущий применённый номер — `0052`; следующие миграции — с `0053`.
