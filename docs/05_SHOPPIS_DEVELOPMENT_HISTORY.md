# SHOPPIS — DEVELOPMENT HISTORY

**Назначение:** хронология разработки — что и когда было сделано, какими коммитами, какие решения
и инциденты сопровождали каждый этап. Заменяет прежний «OpenCode Implementation Plan»: сам план
как жанр закрыт — незавершённое живёт в `16` (remaining work), отложенный hardening — в `11`,
расхождения — в `08`.

**Источники:** git-история репозитория (28 коммитов, `7c2e2cd`…`33f77be` + текущие незакоммиченные
изменения), changelog `00` и тематические документы `06`–`25`.

**Дата ревизии:** 2026-10-14 (партия 3 ревизии документации: `05`).

---

## 0. Как шла работа

- **Одна ограниченная задача за раз**: objective → файлы/модули → ограничения → acceptance
  criteria → тесты. Правило действовало с первых дней и не менялось.
- **Два состояния проверки этапа:** `LOCAL VERIFIED` (браузер/локальный контур) и
  `TELEGRAM VERIFIED` (реальный Mini App на development-окружении). Этап не закрывался без обоих.
- **Hardening — отдельная дисциплина:** после крупного блока шёл «второй слой» — аудит против
  кода и исправления (`15` Home, `20` Inventory, `21` Cart/Checkout, `24` Orders).
- **Документация шла параллельно коду** и часто фиксировала решения раньше реализации:
  план → этапы → аудит → сверка с фактическим кодом.

## 1. Пролог: «Vutrina» (до 2026-09-24)

Проект начинался под именем **Vutrina**: docs v0.2 (`00`–`05` + `08`), legacy-идеология
(клиентская авторизация, глобальные роли, «customers»), первые версии ботов и checkout.

**Initial commit `7c2e2cd` (2026-09-24):** 125 файлов, ~9.3k строк — Vite/React/TS-каркас,
Telegram bridge, Mini App, боты buyer/seller, `process-checkout`, docs-набор v0.2.

## 2. Этапы

### Stage 0 — Foundation и смена идеологии (2026-09-24)

**Коммиты:** `7c2e2cd` → `fa4fb7e` → `2521fc9` → `a9a3639` → `fa26836`

За один день проект был переработан из legacy-состояния в текущую идеологию:

- **`fa4fb7e` — Rework project creation & authorization, drop legacy ideology** (58 файлов,
  +2926/−1231): отказ от клиентской авторизации и глобальных ролей; новая схема БД — миграции
  `0001_identity_and_shop` … `0008_social` (identity, catalog, orders, checkout, delivery outcome,
  drop customers, inventory lifecycle, social).
- **`2521fc9` — Improve authorization architecture** (17 файлов): серверная валидация `initData`,
  сессия, контексты.
- **`a9a3639` — Seller navigation bar and per-page seller routes** (22 файла): `SellerNavBar`,
  маршруты `/seller/{dashboard,inventory,orders,settings}`, docs v0.2 → v0.3.
- **`fa26836`** — цвета нижней навигации.

**Решения этапа:** один frontend + один backend + два бота; identity только серверная; деньги —
minor units; Bot API deep-link как точка входа. **Итог:** вертикальный срез
`Telegram identity → User → Shop` заработал через backend.

### Stage 1 — Inventory v0.1 и Onion-рефакторинг (2026-09-29)

**Коммиты:** `1bd7cec` → `fe31387` → `0e43b43`

- **`1bd7cec` — Inventory tab fully functional v0.1 + image & upload optimization** (79 файлов,
  +7365): рабочая вкладка инвентаря (товары, категории, остатки), клиентская оптимизация
  изображений; миграции `0009_inventory_columns`, `0010_product_image_thumb`; пришли docs `06`
  (Inventory Spec), `07` (Inventory UX), `inventory_real_backend_migration_plan`.
  Здесь же — **переименование Vutrina → Shoppis** во всём docs-наборе.
- **`fe31387`** — мелкие фиксы по Onion.
- **`0e43b43` — полноценный рефакторинг, чистка файлов и onion структура** (141 файл, +5419/−2036):
  принята Onion-архитектура (`domain/application/infrastructure/presentation`, ports/contracts/
  composition root/read-models), удалён legacy-код, добавлены vitest-тесты, eslint/prettier/scripts,
  `build-edge.mjs`, `_shared`-модули edge-функций; docs `10` (Store Settings) и `11` (Hardening
  Backlog).

**Решения этапа:** слоистость как обязательный контракт; «если это можно проверить код-ревью —
это правило, а не комментарий». **Итог:** дальнейшие фичи клеились уже к чистой структуре.

### Stage 2 — Атомарность и Store Settings (2026-09-30 — 2026-10-01)

**Коммиты:** `f7cf626` → `c4b0ab9` → `bf3b577`

- **`f7cf626` — чуть добавили атомарности** (24 файла, +1206): `catalog-actions` +
  `0011_catalog_atomic`; мутации каталога/инвентаря переведены с прямых записей на edge → атомарные
  RPC; появился `catalog-api` с тестами.
- **`c4b0ab9` — store settings & storefront link (WIP)** (55 файлов, +4137): `store-actions` +
  `0012_store_settings_atomic`, доменные правила контакта/настроек, `storefront-link` +
  `useStorefrontLink`; план переименован CODEX → OPENCODE.
- **`bf3b577` — Settings tab fully functional** (41 файл, +1548): hub + экраны профиля,
  локализации, контакта и share; `0013_buyer_notifications`.

**Решения этапа:** все мутации — только атомарными RPC с actor из серверной сессии; storefront
link — Direct Mini App `t.me/<bot>/<app>?startapp=shop_<public_id>` (позже закрепится в `04 §19`).

### Stage 3 — Buyer storefront: Home и Product Detail (2026-10-03 — 2026-10-04)

**Коммиты:** `21a6aa9` → `96e6946` → `9a688d1`

- **`21a6aa9` — Buyer storefront UI/UX ready** (71 файл, +4244): Home (шапка магазина, чипсы
  категорий, карточки товаров), покупательский навбар с приподнятым сердцем, каталог-прототип;
  read-model `0014_storefront_home_read`; docs `13` (Buyer Home Plan).
- **`96e6946` — Product detail + reviews & questions + related + home quality pass** (161 файл,
  +19118): рабочая карточка товара (галерея, варианты, SafeImage), отзывы/вопросы с записью,
  related; seller-экраны preview/reviews/questions и «Связи»; миграции `0015`–`0024`
  (rename `0024`→`0025` — следующим коммитом); docs `14`/`15`/`16`; в репозиторий добавлены
  клиентские материалы «Списки и детали товара».
- **`9a688d1` — Home refinement** (19 файлов): ревизия home data flow (уточнён split-read `0023`),
  создан docs `17` (Catalog Plan); здесь же **первый инцидент с дублем номера миграций**:
  `0024_product_link.sql` переименован в `0025`.

**Решения этапа:** Home — 2 read (context + первая страница товаров), progressive/cursor;
`ProductCard` = открытие + сердце; отзывы/вопросы — отдельный social-слой.

### Stage 4 — Каталог server-side (2026-10-05)

**Коммиты:** `0034bf9` → `c00a3c8` → `5d922cc`

- **`0034bf9` — каталог база, рабочая вкладка** (59 файлов, +4170): server-driven каталог —
  `0026_storefront_catalog_read` (категории/поиск/цена/keyset), `0027_category_reorder`; price
  bounds, фильтр цены, чипсы, URL-состояние, infinite loading; docs `17`/`18` (актуализация).
- **`c00a3c8` — исправления полные каталога** (73 файла, +3034): стабилизация UI, security-миграции
  `0028`–`0031` (social write guard, related limit, catalog hardening, tenant integrity),
  shared product-social компоненты.
- **`5d922cc` — Latest product detail work** (27 файлов): **migration hygiene** — второй дубль
  номера: `0030_storefront_catalog_hardening` → `0033`; введён трекинг применённых миграций
  `0034_create_schema_migrations` + скрипты `migrations:check` / `migrations:record` и конвенция
  `migrations/README.md` (InsForge CLI-миграции отклонены: timestamp-имена + нет backfill).

**Решения этапа:** каталог — единственный владелец «найти»; Home — «заинтересовать»; RLS остаётся
отложенным, границы — read-проекции (`0032` search_path).

### Stage 5 — Inventory reconstruction и Cart MVP (2026-10-05)

**Коммиты:** `ee79300` → `6a54cdc` → `dfcde99` → `274e594`

- **`ee79300` — Обновления инвентаря** (133 файла, +11549): реконструкция seller-инвентаря
  (mode switcher, sheets категорий), foundation корзины (read-model, сервис реконсиляции,
  favorites), миграции `0035`/`0036`; docs `18`/`19`.
- **`6a54cdc` — вкладка функционально корзина закончена** (22 файла): корзина end-to-end
  (selection, checkout flow, экран успеха, контакт продавца).
- **`274e594` — Отрефакторены 2 вкладки: инвентарь и корзина** (83 файла, +4251): переименования
  `InventoryCategoryRow/List`, unit-тесты, **commerce harness** (`npm run commerce:harness`),
  checkout idempotency/reserve (`0038`), независимые оси вариантной цены (`0037`),
  item-contract (`0039`); docs `06`/`07`/`09`/`18`/`21`.

**Решения этапа:** `held_quantity` — custody продавца (read-only, переносы через
`inventory_reconcile`); серверный quantity-contract `1..99`; duplicate variant отклоняется;
`MAX_CART_ITEMS`; checkout-error → реконсиляция.

### Stage 6 — Commerce hardening и Orders (2026-10-10 — 2026-10-11)

**Коммиты:** `cd45e6d` → `b7f1afd` → `efb236a` → `df67079` → `4f5b2eb`

- **`cd45e6d` — MVP корзины готов** (23 файла): завершение корзины; **`0040`** — пересборка
  `create_order_atomic` с независимыми осями и обязательным idempotency-key после **регрессии
  `0039`, которая затёрла per-axis логику `0037`** (пост-аудит `21 §13`, harness Test 10);
  `0041` — старт order-aware reconcile.
- **`b7f1afd` / `efb236a`** — доделка логики и полировка корзины (11 и 4 файла): reconcile
  `0042`–`0045` (held-движения, инвариант price axis, variant-wide атрибуция, порядок блокировок).
- **`df67079` — заказы + product copy** (110 файлов, +9332): read-контур заказов
  `0046_orders_query_read`, realtime `0047`, `order-queries`/`order-actions`, детали заказов;
  копирование карточки и черновики (`23`); fullscreen-экран.
- **`4f5b2eb` — orders hardening + UX** (107 файлов, +4945): grants `0048`, терминальность исхода
  `0049`, снапшот валюты `0050`, enum причины `0051`, `pg_temp` `0052`; image crop, scroll polish;
  docs `22`/`23`/`24`.

**Решения этапа:** заказы читаются только через authenticated edge + RPC (PII);
delivery outcome терминален; история не зависит от будущих правок валюты; harness расширен до
Test 1–30.

### Stage 7 — Seller Dashboard, i18n и боты (2026-10-14)

**Коммиты:** `b29c28b` → `33f77be`

- **`b29c28b` — seller dashboard + sales, storefront buyer UX, orders polish, i18n and telegram
  bots** (329 файлов, +15429 — крупнейший коммит проекта): главная продавца и «Продажи»
  (`0053`, правка `0055` — потенциальный доход включает `NEW`), визиты покупателей и статистика
  ботов (`0054`), описание магазина (`0056`); edge `seller-dashboard`, `share-actions`,
  `store-visit`, три бота (buyer/seller/admin), `order-notify`/`order-context`; i18n ru/en
  (i18next, локали, `LanguageSwitcher`); buyer/orders UX polish.
- **`33f77be` — докручивание деталей** (10 файлов): dashboard header (лого/имя/статус),
  онбординг-доработки, bot views, локали.

**Решения этапа:** суммы продаж — только в текущей валюте магазина (MVP); уведомления заказов —
из `order-notify` с серверным гейтом согласия; боты — тонкие entry points поверх тех же RPC.

### Stage 8 — Текущий WIP (незакоммичено, 2026-10-14)

- **Entry-bot detection:** `telegram-auth` возвращает `bot: buyer | seller | null` (токен, чья
  подпись `initData` совпала); `useAppInit` использует источник входа для открытий без
  `startapp` — seller-бот ведёт в панель, buyer-бот — к последней витрине.
- **Buyer stores:** edge `buyer-stores` + `loadVisitedStores` (серверный fallback последней
  витрины, т.к. localStorage не делится между точками входа); доработка `store-visit`.
- Тесты: `auth.test` (match токена), `useAppInit.test`.

---

## 3. Параллельная история документации

| Дата | Что произошло |
|---|---|
| 2026-09-24 | v0.2 → v0.3 (docs `00`–`05`, `08`); переписан `08` под новую идеологию |
| 2026-09-29 | Vutrina → Shoppis (rename всех docs); добавлены `06`, `07`, inventory migration plan; `10`, `11` |
| 2026-10-01 | `12` (Store Settings implementation); CODEX → OPENCODE |
| 2026-10-03…04 | `13` (Buyer Home, v0.5), `14` (Product Detail), `15` (Home Hardening Audit), `16` (Remaining Work); клиентские «Списки и детали товара» |
| 2026-10-05 | `17` (Catalog), `18` (Cart), `19` (Inventory Reconstruction), `20` (Inventory Hardening), `21` (Commerce Hardening); migration hygiene в `00` |
| 2026-10-10…11 | `22` (Orders), `23` (Product Copy), `24` (Orders Hardening), `25` (Seller Dashboard) |
| 2026-10-14 | Ревизия документации, партии: `01`+`02` (конституция и продукт), `03`+`04` (БД и техника), `05` (этот документ) |

## 4. Поперечные линии

- **Архитектура:** Onion-рефакторинг `0e43b43` (09-29) задал структуру `presentation → application
  → domain` и `_shared`-конвенцию edge-функций; позже закрепился порт/контейнер-подход и правило
  «presentation не импортирует infrastructure» (`04 §9.0`).
- **Атомарность и границы доступа:** прямые мутации → edge+atomic RPC (`0011`/`0012`, 09-30) →
  `security definer` + `search_path` (`0032`/`0052`) → `REVOKE` защищённых RPC + admin-client
  (`0048`).
- **Read-модели:** от одного `0014` (Home) до полного набора storefront-проекций (`0015`, `0026`,
  `0035`, `0036`, `0046`, `0053`): клиент никогда не читает таблицы напрямую.
- **Hardening-волны:** `15` → `20` → `21` → `24` — каждый крупный блок закрывался аудитом против
  кода, и только потом считался готовым.
- **Миграции:** два дубля номеров (`0024`, `0030`) → нумерация + `schema_migrations` +
  `migrations:check`/`record` (09-24 → 10-05).
- **Тесты и гейты:** vitest с Onion-рефакторинга → живой commerce harness (Test 1→34) →
  CI (typecheck/lint/test/build/build:edge).
- **Telegram-платформа:** два бота как entry points (09-24) → Direct Mini App `shop_<public_id>`
  (10-01) → три бота + admin (10-14) → entry-bot detection и buyer stores (10-14, WIP).
- **i18n:** контракт `AppLanguage` заложен в Onion-рефакторинг → полная реализация ru/en
  (локали, switchers, цепочка разрешения) в `b29c28b`.

## 5. Инциденты и их уроки

| Инцидент | Урок / решение |
|---|---|
| Дубль номера миграции `0024` (и `0030`) | Единая нумерация + `schema_migrations` + `migrations:check`; InsForge CLI-миграции отклонены |
| Регрессия price axes: `0039` затёрла per-axis из `0037` | `0040` + harness Test 10; «одна функция — одна процедура пересборки»; реестр решений `01 D9` |
| Гонка checkout / дубли заказов | reserve-before-order (`0038`) + обязательный idempotency-key; retry возвращает исходный заказ |
| Уведомления «залипали» выключенными (дедлайн 1200 мс) | Opt-in на экране успеха, safety-дедлайн 60 с, серверный гейт + досыл «Заказ принят» |
| Прямой доступ к order-RPC с anon | `REVOKE` + admin-client (`0048`), порядок «edge → RPC» |
| Просроченный/поддельный `initData` | Окно `auth_date` 24 ч + 60 с skew, timing-safe сравнение, `pg_temp` в search_path |
| «Пустые» экраны покупателя без магазина | Отдельные состояния `no-store`/`notFound` вместо пустых списков (D5 в `24`) |

## 6. Текущее состояние (2026-10-14)

- 28 коммитов; последний — `33f77be`; поверх него — незакоммиченный Stage 8 (entry-bot, buyer
  stores).
- Миграции: `0001`–`0056` (все записаны в `schema_migrations`); 23 таблицы; 18 edge-функций;
  RLS выключен осознанно (гейт перед продом — `11 §S1`).
- Гейт последнего закрытого этапа: `typecheck` · `lint` · `test` · `build` · `build:edge` ·
  `migrations:check` · `commerce:harness` (Test 1–34); ручные `LOCAL`/`TELEGRAM`-проверки — за
  человеком.
- Открытые контуры (детали — `08`, `11`, `16`): таблица доставки уведомлений,
  rate limiting, серверная upload-валидация, seller-редактор linking-атрибутов, blur-up/prefetch
  карточки, `product_groups` (DECIDE), мультивалютные суммы дашборда (MVP-ограничение).

## 7. Access control / RLS (2026-10-15, гейт перед продом закрыт)

Реализован **ADR-C (JWT-мост)**: edge `telegram-auth` выпускает платформенный RS256 access-JWT
(`sub = users.id`, `role = authenticated`), клиент ставит его в SDK (`setAccessToken`); PostgREST/
Storage/Realtime видят `auth.uid()`. Итог — полноценный RLS:

- `0062` — `REVOKE EXECUTE` у `public`/`anon`/`authenticated` на все не-storefront RPC;
- `0063`/`0067` — Storage: public-read + запись только владельцем (`uploaded_by = sub`);
- `0064` — недостающие атомарные мутации (`category_create/update/set_status`, `variant_stock_update`);
- `0065` — RLS на 22 таблицах: `anon` без грантов, `authenticated` — `SELECT` + политики, хелперы владения;
- `0066` — `GRANT EXECUTE` на `app_*`-хелперы для `authenticated`;
- `0068` — RLS на `realtime.channels` (подписка только на «свой» канал).

Верификация: harness Test 38 (grants-автообход), end-to-end PostgREST-изоляция (`owner`/`non-owner`/
`anon`), socket-тест каналов, `commerce:harness` 207/0, vitest 1447. Полная модель — `27_SHOPPIS_RLS_PLAN.md`.
До этого граница была «anon-ключ = полный доступ»; заодно исправлен клиентский ключ
(`VITE_INSForge_ANON_KEY` был admin-ключом → заменён на реальный anon, фронт редеплоен).

---

## Приложение A. Хронология коммитов

| # | Коммит | Дата | Сообщение | Масштаб |
|---|---|---|---|---|
| 1 | `7c2e2cd` | 2026-09-24 | Initial commit: Shoppis Telegram Mini App (Vutrina) | 125 файлов, +9310 |
| 2 | `fa4fb7e` | 2026-09-24 | Rework project creation & authorization, drop legacy ideology | 58, +2926/−1231 |
| 3 | `2521fc9` | 2026-09-24 | Improve authorization architecture and scalability | 17, +312/−281 |
| 4 | `a9a3639` | 2026-09-24 | Add seller navigation bar and per-page seller routes | 22, +533/−137 |
| 5 | `fa26836` | 2026-09-24 | Update bottom navigation bar colors | 2, +9/−6 |
| 6 | `1bd7cec` | 2026-09-29 | Inventory tab fully functional v0.1 + image & upload optimization | 79, +7365/−115 |
| 7 | `fe31387` | 2026-09-29 | маленькие фиксы по onion | 9, +77/−33 |
| 8 | `0e43b43` | 2026-09-29 | полноценный рефакторинг, чистка файлов и onion структура | 141, +5419/−2036 |
| 9 | `f7cf626` | 2026-09-30 | чуть добавили атомарности, мелкие фиксы проекта | 24, +1206/−49 |
| 10 | `c4b0ab9` | 2026-10-01 | store settings & storefront link (WIP) | 55, +4137/−171 |
| 11 | `bf3b577` | 2026-10-01 | Settings tab fully functional: hub + profile/localization/contact/share | 41, +1548/−162 |
| 12 | `21a6aa9` | 2026-10-03 | Buyer storefront UI/UX ready: home cards + catalog tab logic | 71, +4244/−309 |
| 13 | `96e6946` | 2026-10-04 | Product detail + reviews & questions + related, home quality pass | 161, +19118/−730 |
| 14 | `9a688d1` | 2026-10-04 | Home tab code & decisions refinement | 19, +786/−57 |
| 15 | `0034bf9` | 2026-10-05 | каталог базу сделал, рабочая вкладка | 59, +4170/−426 |
| 16 | `c00a3c8` | 2026-10-05 | исправления полные каталога | 73, +3034/−814 |
| 17 | `5d922cc` | 2026-10-05 | Latest product detail work | 27, +1300/−1221 |
| 18 | `ee79300` | 2026-10-05 | Обновления инвентаря | 133, +11549/−1008 |
| 19 | `6a54cdc` | 2026-10-05 | вкладка функционально корзина закончена | 22, +1077/−176 |
| 20 | `dfcde99` | 2026-10-05 | docs: inventory reconstruction changelog row | 1, +1 |
| 21 | `274e594` | 2026-10-05 | Отрефакторены 2 вкладки: инвентарь и корзина | 83, +4251/−617 |
| 22 | `cd45e6d` | 2026-10-10 | mvp корзина готова | 23, +1668/−32 |
| 23 | `b7f1afd` | 2026-10-10 | Доделывание блока корзина и логики | 11, +1131/−16 |
| 24 | `efb236a` | 2026-10-10 | улучшили снова корзину | 4, +279/−5 |
| 25 | `df67079` | 2026-10-11 | заказы + копирование карточки / черновики; fullscreen | 110, +9332/−722 |
| 26 | `4f5b2eb` | 2026-10-11 | orders hardening + catalog/home/inventory UX | 107, +4945/−561 |
| 27 | `b29c28b` | 2026-10-14 | seller dashboard + sales, storefront buyer UX, orders polish, i18n, bots | 329, +15429/−2222 |
| 28 | `33f77be` | 2026-10-14 | докручивание деталей: dashboard header, onboarding, bot views и локали | 10, +216/−11 |
