# SHOPPIS — TECHNICAL SPECIFICATION

**Version:** 0.3  
**Stack:** React 18 + Vite 8 + Tailwind 3.4 + TypeScript + InsForge + Telegram Mini App  
**Актуализировано:** 2026-10-14 (ревизия документации, партия 2: `03`, `04`). Сверено с текущим
кодом: edge-функции, `_shared`-модули, auth-примитивы, image-pipeline, CI и деплой.

## 1. System shape

```text
Seller Bot ─┐
            ├── Telegram Mini App (React, один frontend) ── InsForge
Buyer Bot  ─┘        │                                        ├── Postgres + RPC (security definer)
  (+ admin bot — операционный, не пользовательский)           ├── Edge Functions (Deno)
                                                             ├── Storage (shoppis-media)
                                                             └── Realtime (orders:* channels)
```

One frontend, one backend, two user-facing bot entry points + один операционный admin-edge.
Контекст (seller/buyer) определяется средой запуска и серверной сессией, а не ролями (`01 §5`).

## 2. Telegram auth

Server validates raw Telegram Mini App `initData` before protected operations.

Flow:
`Signed Telegram identity → User → TelegramIdentity → application session`

Реализация (`telegram-auth.js` + `_shared/auth.js`):

1. HMAC-подпись: `secret = HMAC_SHA256("WebAppData", bot_token)`; подпись сравнивается
   **постоянным по времени** способом (`timingSafeEqual`); перебор токенов `BUYER_BOT_TOKEN` /
   `SELLER_BOT_TOKEN` (fallback `BOT_TOKEN`) определяет **источник входа** `bot = buyer|seller|null`
   (`01 D4`).
2. Окно свежести `auth_date`: не старше `AUTH_MAX_AGE_SECONDS` (default 24 ч) и не из будущего
   больше 60 с (clock skew) — защита от replayed/просроченного `initData` (`24 §2.7 D4`).
3. Идентичность резолвится по `telegram_user_id` (не username): повторный запуск приводит к тому же
   `User`; профиль identity (`username`, имена, `language_code`, `photo_url`) обновляется при каждом
   входе.
4. Сессия — HMAC-токен `b64url(payload).b64url(HMAC)`: `{ uid, tg, iat, exp }`, TTL default 6 ч
   (`SESSION_TTL_SECONDS`). Подпись проверяется на каждом защищённом edge-вызове.
5. Клиент хранит токен в zustand persist и шлёт его как `Authorization: Bearer <session>`;
   при каждом открытии Mini App выполняется **новая** аутентификация (свежий `initData`), поэтому
   сессия короткоживущая, а не «30 дней».

Do not trust `initDataUnsafe`, client role flags, client shop IDs or client user IDs.
A repeated launch must resolve to the existing User rather than create a duplicate.

## 3. Backend boundaries

Critical mutations go through backend/domain functions (edge → atomic SQL-RPC):
- create order;
- cancel order;
- status transition;
- delivery result;
- inventory adjustment/reconciliation;
- seller authorization;
- permanent product deletion;
- все catalog/social/store мутации.

Simple reads may use public read-проекции (RPC) или authenticated edge. Прямые anon-`select`
из таблиц в клиентском коде не используются.

### Edge functions (18, все active)

| Slug | Назначение |
|---|---|
| `telegram-auth` | валидация `initData` → `User`/`TelegramIdentity` → HMAC-сессия + `bot` |
| `shop-create` | создание магазина (онбординг продавца) |
| `store-actions` | профиль/статус магазина (через `store_*_atomic`) |
| `catalog-actions` | товары/категории/варианты/связи (через `*_atomic`) |
| `process-checkout` | checkout: валидация, `create_order_atomic`, уведомления (best-effort) |
| `order-actions` | lifecycle заказов: transition/cancel/outcome/reconcile |
| `order-queries` | authenticated read заказов: `list`/`detail`/`sales` |
| `seller-dashboard` | сводка главной продавца (`seller_dashboard_read`) |
| `review-actions` | отзывы/ответы (`review_*_atomic`) |
| `question-actions` | вопросы/ответы (`question_*_atomic`) |
| `notifications-actions` | opt-in уведомлений (`notifications_enabled`) |
| `share-actions` | подготовка карточки товара для нативного шаринга |
| `store-visit` | фиксация визита покупателя (`buyer_store_visit_upsert`) |
| `buyer-stores` | список посещённых витрин (`buyer_store_list_read`) |
| `telegram-notify` | транспорт отправки сообщений через Bot API (вызывается edge-to-edge) |
| `telegram-bot-buyer` | webhook Buyer Bot: меню, «Мои магазины», активные заказы |
| `telegram-bot-seller` | webhook Seller Bot: панель, статистика, ссылка-приглашение |
| `telegram-bot-admin` | операционный: `status`/`set-webhooks`/`delete-webhooks`/`set-commands`/`set-menu-buttons` (guard `API_KEY`) |

Общий код — `edge-functions/_shared/`: `auth` (HMAC/сессии/initData), `clients` (`anonClient`/
`adminClient`), `env`, `http` (json/cors/preflight/readJson), `errors`, `validate`,
`checkout-identity` (резолв username), `checkout-items` (контракт `1..99`/дубликаты),
`checkout-notify`/`order-notify`/`telegram`/`bot-api`/`bot-views`/`share-message`/`order-context`.

### SDK и роли

Edge работают через официальный InsForge SDK (`npm:@insforge/sdk`), не raw REST:

- `anonClient` — роль `anon` (публичные чтения/identity-записи в auth);
- `adminClient` (`createAdminClient({ apiKey: API_KEY })`) — роль `project_admin` для защищённых
  RPC, у которых `EXECUTE` **отозван** у `public`/`anon`/`authenticated` (`0048`): order-RPC,
  `create_order_atomic`, `inventory_reconcile`, dashboard/sales. Прямой вызов с клиента невозможен,
  доверенный путь — только edge.

### Контракт ответов

`{ success: true, ... }` либо `{ success: false, error: 'CODE' }` с HTTP-статусом; коды доменных
ошибок (`FORBIDDEN`, `STORE_PAUSED`, `IDEMPOTENCY_KEY_REQUIRED`, `OUTCOME_ALREADY_RECORDED`,
`INVENTORY_RESERVED_BY_ORDERS`, …) стабильны и используются клиентом для сообщений. Вход
валидируется `_shared/validate`, ошибки парсятся `_shared/errors`.

Multi-step critical mutations are implemented as PL/pgSQL functions and invoked via `rpc()` so they
run atomically (`search_path = public, pg_temp` — конвенция `0032`/`0052`).

## 4. Order creation

Фактический конвейер (`process-checkout` → `create_order_atomic`, `0038`/`0039`/`0040`):

1. authenticate buyer (сессия, actor из токена);
2. validate cart lines (`_shared/checkout-items`: quantity `1..99`, `VARIANT_DUPLICATE`,
   `EMPTY_CART`, `INVALID_CART_ITEM`);
3. **idempotency reserve**: вставить ключ (обязателен, `IDEMPOTENCY_KEY_REQUIRED`); повтор с тем же
   ключом возвращает исходный заказ (`idempotent: true`) и не создаёт второй;
4. resolve + lock store, verify `ACTIVE` (`STORE_PAUSED`);
5. create order row (`NEW`, totals 0, `public_order_number`, currency);
6. по каждой позиции: lock variant (`FOR UPDATE`) → verify own store/`ACTIVE` → lock inventory
   (`FOR UPDATE`) → verify stock (`INSUFFICIENT_STOCK`) → рассчитать цену per-axis (server-side) →
   собрать snapshots (title/description/image/linking attrs/variant);
7. move `available → held` + `inventory_movements(ORDER_RESERVE)`;
8. записать totals и `currency_symbol_snapshot`;
9. commit;
10. notify asynchronously (снаружи транзакции).

Any failure before commit rolls back order/inventory writes. Notification failure never rolls back.
Ключ генерируется клиентом на checkout-попытку и переиспользуется при retry (`01 D10`);
цена и остаток не берутся из клиентского ввода.

## 5. Concurrency

Two buyers cannot both purchase the last unit: inventory rows блокируются `FOR UPDATE` /
атомарными conditional update; заказ и резерв — в одной транзакции.

Required test: stock=1, two concurrent checkout requests → exactly one success.
Покрыто живым harness (`npm run commerce:harness`, Test 1–34): гонка за последним стоком,
идемпотентные ретраи, cancel/reconcile-гонки, price axes, grants, terminal outcomes.

## 6. Image standard

MVP:
- max 4 images/Product;
- JPEG/PNG/WebP вход;
- max original upload 10 MB (client guard);
- max practical dimension 4096 px;
- клиентская нормализация до WebP через canvas (`createImageBitmap` + canvas, fallback JPEG);
- сервер validates MIME/content — `ПЛАН` (сейчас клиент + storage);
- optimize before public delivery — клиентский pipeline;
- strip metadata — canvas-перезапись удаляет EXIF;
- reject malformed — клиент отсеивает, серверная проверка `ПЛАН`.

**Implemented (client-side v1, `src/utils/image.ts` + `application/services/image-service.ts`):**

| Назначение | Формат | Полный | Thumb |
|---|---|---|---|
| Фото товара (портрет 4:5) | WebP q0.75 | 1000×1250 (`storage_key`) | 512×640 (`thumb_storage_key`) |
| Обложка категории (квадрат) | WebP | — | 320×320 (`image_storage_key`) |
| Баннер магазина (≈2.2:1) | WebP q0.78 | 1100 px | — |

Списки грузят `thumb`, галерея/hero — full. Откреплённые файлы удаляются из storage best-effort.
Server-side derivatives/валидация — future work (`08 §2.4`).

## 7. Storage

- Бакет `shoppis-media` (public): публичные URL без подписи — это окно витрины.
- Ключи контролируются приложением (стухшие/откреплённые удаляются); произвольные внутренние пути
  не отдаются наружу.
- Продавец может менять только изображения своих товаров (actor проверяется в RPC каталога).
- Загрузка из UI — через `application/services/image-service.ts` (параллелизм 2, удаление
  «сирот» при сбое партии), а не напрямую из `presentation`.

## 8. Search

MVP: title + description, shop-scoped, active products only.

Фактически: server-side поиск в Каталоге (`storefront_catalog_products_read`) — `title ILIKE`
literal search, `ACTIVE` товары, shop-scoped; ввод с debounce, состояние в URL (`q`).
Поиск по `description` — `ПЛАН` (`02 §15`).

Поиск живёт в Каталоге. Нажатие `🔎` на Главной не открывает отдельный overlay, а ведёт в
`/catalog` с автофокусом поля поиска и открытием клавиатуры (`Home → Catalog + focus`). `13 §8`.

## 9. Frontend boundaries

Фактическая структура (`src/`):

```text
domain/          # модели, константы, правила — без React
  models/ constants/ rules/
application/     # состояние и сценарии
  store/         # zustand-слайсы (auth, catalog, cart, order, settings, ui …)
  hooks/ services/ read-models/ mappers/ rules/ ports/ contracts/
  composition/   # container с deps (ports → infra)
infrastructure/  # адаптеры к внешнему миру
  insforge/ functions/ repositories/ storage/ telegram/ auth/ i18n/
presentation/    # React UI
  layouts/       # BuyerLayout, SellerLayout (app shell)
  buyer/ seller/ shared/ styles/
router.tsx  App.tsx  main.tsx
```

Направление зависимостей: `presentation → application → domain`; инфраструктура вызывается из
`application` через порты (`application/ports`, `composition/container`).

Security, money, inventory and state transitions are not React-only logic.

### 9.0 Граница `presentation` → `application` (без прямых импортов из `infrastructure`)

Правило соблюдается в код-ревью: `presentation` **не импортирует** `infrastructure` напрямую.
Инфраструктурные возможности выставляются наружу только через `application`:

- `application/hooks/useHaptic.ts` — тактильная отдача (Telegram Haptics). Компонент вызывает
  `const { selectTick } = useHaptic()` и не знает о Telegram SDK; вне Telegram — безопасный no-op.
- `application/services/image-service.ts` — Use Case загрузки изображений: `uploadCatalogImages(File[])`
  и `uploadCategoryCoverImage(File)`; presentation отдаёт `File` и получает готовые публичные URL.
- `infrastructure/i18n` — i18next-инициализация; `application` даёт контракт `AppLanguage` и
  `userSettings.language`, компоненты используют `useTranslation`/`LanguageSwitcher`.

Стор-слайсы (`product-slice`, `category-slice`) используют `infrastructure/storage` для очистки
откреплённых файлов при мутациях — это слой `application`, нарушение границы только со стороны UI.

### 9.1 App shell, safe-area, keyboard

- Один контекст — один layout-шелл: `.app-shell` (flex-колонка, `height: 100dvh`, `overflow: hidden`).
- Контент — `.scrollable-content` (`flex: 1`, внутренний скролл); навбар — flex-элемент снизу, поэтому
  последний блок не перекрывается навбаром.
- Нижний safe-area: `--safe-bottom = max(env(safe-area-inset-bottom), var(--tg-safe-area-bottom, 0px))`,
  применяется к обёртке `.bottom-nav`. `useAppInit` выставляет `--tg-safe-area-bottom`.
- При открытой клавиатуре (или выбранном текстовом поле) `body.keyboard-is-open .bottom-nav { display: none }`,
  активное поле ввода центрируется в видимой области (`useKeyboardFix`; детект — по `visualViewport`
  **и** фокусу ввода — в Telegram WebView ресайз visual viewport ненадёжен).
- Нижняя навигация — router-agnostic `BottomNavBar`: активная вкладка и `onTabChange` передаются
  адаптерами (`SellerNavBar`; у покупателя — `FloatingNavBar`, 5 равнозначных вкладок).
- Buyer Header — сквозной верхний блок (название магазина слева; описание/поиск/профиль справа).
  Иконки живут в «залипающем» рейле (`useStuck`): при скролле остаются в углу и бледнеют.
- Роутинг: все view — `lazy`, кроме `CatalogView` (синхронный рендер нужен, чтобы автофокус поиска
  сработал внутри тапа и в WebView открылась клавиатура).

## 10. UI states

Every critical screen has loading, empty, recoverable error and mutation-processing states. Critical
mutations prevent double submission (`submitting`/disable/retry — единый mutation lifecycle).

## 11. Notifications

MVP:
- new order → seller;
- status change → buyer when write access (согласие) exists;
- relevant delivery result → buyer.

No write permission: order still succeeds, notifications simply do not send.

Реализация:

- opt-in запрашивается на **экране успеха** checkout явным тапом
  (`CheckoutSuccess → useCheckout.enableNotifications(orderId)`); согласие хранится на сервере
  (`telegram_identities.notifications_enabled`), не в клиентском persist;
- вызов ограничен безопасным дедлайном `MESSAGES_ACCESS_TIMEOUT_MS` (60 с) и никогда не влияет на
  заказ; отказ/таймаут лишь означает «уведомления не отправляются», opt-in остаётся доступен;
- при согласии тем же вызовом **досылается** «Заказ принят» для только что созданного заказа;
- покупательские уведомления в `process-checkout`/`order-actions` отправляются **только при**
  `notifications_enabled = true` (серверный гейт); продавец получает уведомление всегда;
- транспорт — `telegram-notify` (HTML-текст + deep-link кнопки `shop_<public_id>`);
- таблицы доставок/ретраев пока нет — `ПЛАН` (`08 §2.7`); сбой отправки логируется, но не влияет
  на транзакцию.

> **Updated (2026-10-05):** superseded the «prompt at checkout submit, 1200 ms, ask once» order
> (docs/18 CART-05d). The prompt now lives on the success screen and is re-askable until consent.

## 12. Security baseline

Фактически закрыто:
- Telegram `initData` валидация (HMAC + окно `auth_date` + timing-safe);
- runtime-сессия HMAC с TTL, повторная проверка на каждом edge-вызове;
- actor из сессии в каждом критичном RPC, проверка владения (`stores_assert_owner`);
- защищённые order/dashboard RPC `REVOKE`-нуты от anon/authenticated, вызов только admin-клиентом;
- `search_path = public, pg_temp` у `security definer` функций;
- opaque public IDs; снимки в заказах; PII не попадает в публичные проекции;
- секреты — только в env edge-функций; на клиент отдаётся лишь anon key + bot username/shortname;
- вход валидируется на edge (`validate`), ошибки не раскрывают внутренности;
- **RLS включён на всех 22 бизнес-таблицах** (`0065`): `anon` — без грантов, `authenticated` —
  `SELECT` + строковые политики (`27_SHOPPIS_RLS_PLAN.md`); записи — только edge (`project_admin`);
- **платформенный access-JWT** (`sub = users.id`) как мост к PostgREST/Storage/Realtime (`27`);
- **REVOKE EXECUTE** у `public`/`anon`/`authenticated` на все не-storefront RPC (`0062`);
- **Storage** — запись только владельцем (`uploaded_by = sub`, `0067`); **Realtime** — подписка
  только на «свой» канал (`0068`).

Планово / не закрыто:
- rate limiting (SQL/edge) для checkout/upload/questions;
- серверная upload-валидация MIME/контента;
- `audit logs` как отдельный слой (сейчас — movement/history ledger + console-логи).

## 13. Operational limits

Initial rate limits should be strict for order creation/image uploads and moderate for
questions/reviews/search. Exact numbers are deployment parameters, not product rules. Сейчас —
не реализованы (см. §12).

## 14. Observability

Operational telemetry only:
- application/backend errors (`console.error` в edge);
- order failures;
- inventory conflicts;
- auth failures;
- notification failures (`bot was blocked`/`chat not found` — успешный ответ функции с
  `success:false` внутри);
- important transitions (ledger `order_status_history`, `inventory_movements`).

No analytics dashboard in MVP. Optional event structure:
`event_name, user_id, shop_id, product_id, order_id, occurred_at, metadata`.

## 15. Testing

- **Unit/integration:** `vitest` (`npm run test`) — правила, мапперы, слайсы, компоненты, роутер;
  edge-модули `_shared/*.test.js` тоже под vitest (Node-совместимые).
- **Live commerce harness:** `npm run commerce:harness` — SQL/RPC на dev-базе через admin raw-SQL
  (`.insforge/project.json`); Test 1–34: гонки, идемпотентность, quantity-контракт, price axes,
  cancel/reconcile, order read-authz, grants, terminal outcome, dashboard/sales.
- **Миграции:** `npm run migrations:check` (дубли/пропуски/имена, сверка с `schema_migrations`).
- **CI** (`.github/workflows/ci.yml`, push/PR): `npm ci` → `typecheck` → `lint` → `test` →
  `build` → `build:edge`.

Required categories (release gate): price calculation; status transitions; inventory transitions;
idempotency; authorization/PII; Telegram identity validation; concurrent last-stock purchase;
archive/pause; snapshot immutability; notification failure isolation.

## 16. Deployment

Frontend: **Vercel** (`vercel.json` → `outputDirectory: dist`), сборка `npm run build`
(`tsc --noEmit && vite build`). Backend: **InsForge** — Postgres, edge functions, storage, realtime.

- Edge деплой: `npm run build:edge` (esbuild бандлит каждую функцию + `_shared` в один ESM;
  `npm:@insforge/sdk` остаётся внешним) → деплой `.dist/<slug>.js` через InsForge (MCP/CLI).
- Миграции: применяются на проект и фиксируются `npm run migrations:record -- <NNNN>`;
  нумерация `NNNN_name.sql`, без timestamp-имён (`01 D22`).
- Env: фронт — `VITE_INSFORGE_URL`, `VITE_INSFORGE_ANON_KEY`, `VITE_BUYER_BOT_USERNAME`,
  `VITE_BUYER_APP_SHORTNAME`; edge — `INSFORGE_BASE_URL`, `ANON_KEY`, `API_KEY`,
  `SESSION_SECRET`, `SESSION_TTL_SECONDS?`, `AUTH_MAX_AGE_SECONDS?`, `BUYER_BOT_TOKEN`,
  `SELLER_BOT_TOKEN` (`BOT_TOKEN` fallback), `APP_URL`, `BUYER_BOT_USERNAME`,
  `BUYER_APP_SHORTNAME`, `TELEGRAM_WEBHOOK_SECRET?`, `TELEGRAM_NOTIFY_URL`.
- Секреты — только в env/InsForge, не в репозитории (`.env` в `.gitignore`).

No VPS requirement.

## 17. Performance

Priorities:
- fast-feeling mobile storefront;
- no N+1 catalog queries;
- optimized/lazy images;
- critical order flow prioritized over cosmetics.

Реализация:
- Home делает **2 read**: `storefront_home_context_read` + первая страница
  `storefront_home_products_read` (keyset-курсор); товары догружаются progressive-страницами.
- Каталог — одна RPC с фильтрами и keyset-пагинацией; индекс `products_store_active_created_idx`.
- Карточки — `thumb` 512×640, галерея — full; `SafeImage` с fallback; lazy-загрузка.
- React Query: кэш/`staleTime`, `useInfiniteQuery`, realtime-инвалидация заказов вместо polling.
- Детальная карточка: один RPC + full-фото; blur-up/prefetch — `16 FD-6` (deferred).

Exact SLOs are set after real traffic data.

## 18. Pause/archive behavior

PAUSED shop resolves but shows technical-pause state (брендовая шапка, логотип, контакт) и
rejects new orders (и серверный guard `STORE_PAUSED` в checkout). Существующие заказы не
затрагиваются; поиск/каталог недоступны.

ARCHIVED product is excluded from normal catalog and cannot enter checkout.

Storefront-проекция:
- `ARCHIVED` product не попадает ни в Home, ни в Catalog, ни в Category, ни в Search;
- `ARCHIVED` category скрыта из списка категорий, а активные товары показываются как
  `categoryId = null` («Все товары»); `product.category_id` не меняется, поэтому возврат категории
  в `ACTIVE` автоматически возвращает товар в неё;
- sold out product (все активные варианты `stock = 0`) остаётся видимым, но `available = false`.
`13 §11–§15, §20`.

## 19. Deep link

Первым шагом покупателя всегда должно открываться **приложение (Mini App)**, а не чат бота.
Telegram поддерживает два формата открытия приложения по ссылке (Bot API — *Direct Link Mini Apps*
и *Main Mini App*):

1. **Direct Link (именованное Mini App):** `t.me/<bot>/<app-short-name>?startapp=shop_<public_id>`
   — требует именованного Mini App в @BotFather (`/newapp`); short name — строчные латинские буквы,
   цифры и `_`.
2. **Main Mini App:** `t.me/<bot>?startapp=shop_<public_id>` — требует настроенного Main Mini App
   (URL = production frontend).

В обоих случаях `startapp` попадает в Mini App как `initDataUnsafe.start_param`.
Ссылка строится в `domain/rules/storefront-link.ts`; внутренние sequential DB IDs не раскрываются.

**Выбрано (вариант B, Direct Link):** бот `BuyShoppis_bot`, именованное Mini App `shop` →
`VITE_BUYER_APP_SHORTNAME=shop`, ссылка `https://t.me/BuyShoppis_bot/shop?startapp=shop_<public_id>`.

Товарный deep-link: `prod_<public_id>_<product_id>` — открывается витрина, затем карточка поверх.
Legacy `store_<id>` читается только для старых ссылок.

**Открытия без `startapp`:** источник входа `bot` из подписанного `initData` (`§2`): seller-бот →
панель продавца (онбординг при отсутствии магазина); buyer-бот/null → последняя витрина
(localStorage → серверный `buyer_store_list_read` → notFound), иначе шаг входа не определён.
Порядок инициализации: `authenticate → entryBot/start_param → loadBuyerStore/loadSellerStore →
Home(2 read)`.

> Если `t.me/<bot>/<app>` открывает чат бота — именованное Mini App не создано (или short name
> невалиден); если `t.me/<bot>?startapp=` открывает чат — не включён Main Mini App. Это
> конфигурация BotFather, а не формат ссылки.

## 20. Architecture decision records

For major changes record: problem; chosen solution; alternatives; reason; migration impact;
MVP/future status.

Сводный реестр ключевых решений проекта — `01 §10` (D1–D24). Feature-level ADR'ы и обоснования —
в тематических документах: `04 §9/§11`, `13 §3` (Home-проекция), `15` (hardening Home),
`17 §3` (catalog read-model), `18 §11` (cart-rules), `20 §2.2` (price axes), `21 §3` (commerce
contracts), `22 §4` (orders read/command), `25 §3` (dashboard read).
