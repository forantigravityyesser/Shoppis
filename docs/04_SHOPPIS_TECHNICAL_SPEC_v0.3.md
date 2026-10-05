# SHOPPIS — TECHNICAL SPECIFICATION

**Version:** 0.3  
**Stack:** React + Vite + Tailwind + TypeScript + InsForge + Telegram Mini App

## 1. System shape
`Seller Bot ─┐`
`            ├── Telegram Mini App / React ── InsForge`
`Buyer Bot ──┘`

One frontend, one backend, two bot entry points.

## 2. Telegram auth
Server validates raw Telegram Mini App `initData` before protected operations.

Flow:
`Signed Telegram identity → User → TelegramIdentity → application session`

Do not trust `initDataUnsafe`, client role flags, client shop IDs or client user IDs.

A repeated launch must resolve to the existing User rather than create a duplicate.

## 3. Backend boundaries
Critical mutations go through backend/domain functions:
- create order;
- cancel order;
- status transition;
- delivery result;
- inventory adjustment;
- seller authorization;
- permanent product deletion.

Simple reads may use InsForge APIs under RLS.

Edge functions access the database and run server-side logic through the official InsForge SDK (`npm:@insforge/sdk`): `client.database.from(...)` for CRUD and `client.database.rpc(...)` for stored functions. Raw REST calls are not used. The SDK provides typed access, consistent error handling and a single call convention, which improves reliability and keeps edge functions small and predictable. Multi-step critical mutations are implemented as PL/pgSQL functions and invoked via `rpc()` so they run atomically.

## 4. Order creation
1. authenticate buyer;
2. verify shop ACTIVE;
3. validate cart lines;
4. lock affected inventory;
5. verify Product/Variant ACTIVE;
6. calculate current price;
7. verify stock;
8. create Order + snapshots;
9. move available→held;
10. write movements/history;
11. persist idempotency result;
12. commit;
13. notify asynchronously.

Any failure before commit rolls back order/inventory writes. Notification failure never rolls back.

## 5. Concurrency
Two buyers cannot both purchase the last unit. Use row locking or equivalent atomic conditional updates.

Required test: stock=1, two concurrent checkout requests → exactly one success.

## 6. Image standard
MVP:
- max 4 images/Product;
- JPEG/PNG/WebP;
- max original upload 10 MB;
- max practical dimension 4096 px longest side;
- server validates MIME/content;
- optimize before public delivery;
- create mobile/web derivative around 1600 px;
- create thumbnail around 600 px;
- strip unnecessary metadata where possible;
- reject malformed files.

10 MB is a safety ceiling, not a target upload size. Client should compress/resize first.

**Implemented (v1, client-side):** aspect crop → WebP via `createImageBitmap` + canvas
(`src/utils/image.ts`). Product photo — portrait **4:5** (`prepareCardImage`): `full` 1000×1250 q0.75 +
`thumb` 512×640 q0.75 (`uploadCatalogImage`, stored in `product_images.storage_key` /
`thumb_storage_key`). Category cover: square `thumb` 320px only (`prepareSquareImage`).
Store banner: 1024px q0.78. Lists load `thumb`, hero/gallery load `full`. Buyer storefront: карточки
Home/Каталога грузят `thumb` (512×640), карточка товара — `full` (1000×1250). Detached files are removed
from storage on update/delete (best-effort). Server-side derivatives/validation remain future work.
Загрузка из UI идёт через `application/services/image-service.ts` (§9.0), а не напрямую в `infrastructure/storage`.

## 7. Storage
Use controlled storage keys. Never expose arbitrary internal storage paths. Seller may mutate only owned product images.

## 8. Search
MVP: title + description, shop-scoped, active products only.

Поиск живёт в Каталоге. Нажатие `🔎` на Главной не открывает отдельный overlay, а ведёт в
`/catalog` с автофокусом поля поиска и открытием клавиатуры (`Home → Catalog + focus`). `13 §8`.

## 9. Frontend boundaries

Фактическая структура (`src/`):

```text
domain/          # модели, константы, правила — без React
  models/ constants/ rules/
application/     # состояние и сценарии
  store/         # zustand-слайсы (auth, product, cart, order, settings, ui …)
  hooks/ services/ i18n.ts queryClient.ts
infrastructure/  # адаптеры к внешнему миру
  insforge/ functions/ repositories/ storage/ telegram/ auth/ i18n/
presentation/    # React UI
  layouts/       # BuyerLayout, SellerLayout (app shell)
  buyer/ seller/ shared/ styles/
router.tsx  App.tsx  main.tsx
```

Направление зависимостей: `presentation → application → domain`; инфраструктура вызывается из `application`.

Security, money, inventory and state transitions are not React-only logic.

### 9.0 Граница `presentation` → `application` (без прямых импортов из `infrastructure`)

Правило соблюдается в код-ревью: `presentation` **не импортирует** `infrastructure` напрямую.
Инфраструктурные возможности выставляются наружу только через `application`:

- `application/hooks/useHaptic.ts` — тактильная отдача (Telegram Haptics). Компонент вызывает
  `const { selectTick } = useHaptic()` и не знает о Telegram SDK; вне Telegram — безопасный no-op.
- `application/services/image-service.ts` — Use Case загрузки изображений: `uploadCatalogImages(File[])`
  (параллелизм 2, сохранение порядка, удаление «сирот» при сбое партии) и `uploadCategoryCoverImage(File)`
  (обложка категории). Presentation отдаёт `File` и получает готовые публичные URL.

Стор-слайсы (`product-slice`, `category-slice`) используют `infrastructure/storage` для очистки
откреплённых файлов при мутациях — это слой `application`, нарушение границы только со стороны UI.

### 9.1 App shell, safe-area, keyboard
- Один контекст — один layout-шелл: `.app-shell` (flex-колонка, `height: 100dvh`, `overflow: hidden`).
- Контент — `.scrollable-content` (`flex: 1`, внутренний скролл); навбар — flex-элемент снизу, поэтому
  последний блок не перекрывается навбаром.
- Нижний safe-area: `--safe-bottom = max(env(safe-area-inset-bottom), var(--tg-safe-area-bottom, 0px))`,
  применяется к обёртке `.bottom-nav`. `useAppInit` выставляет `--tg-safe-area-bottom` из `tg.safeAreaInset.bottom`.
- При открытой клавиатуре (или выбранном текстовом поле) `body.keyboard-is-open .bottom-nav { display: none }`,
  а контент теряет резерв под навбар; активное поле ввода центрируется в видимой области
  (`useKeyboardFix`, глобально для всех страниц). Детект — по `visualViewport` **и** фокусу ввода
  (в Telegram WebView ресайз visual viewport ненадёжен).
- Нижняя навигация — router-agnostic `BottomNavBar` (`presentation/shared/components`): активная
  вкладка и `onTabChange` передаются адаптерами (`SellerNavBar`; у покупателя — `FloatingNavBar`).
  Buyer-вариант: 5 равнозначных вкладок (`/`, `/catalog`, `/favorites`, `/orders`, `/cart`) на общем
  `BottomNavBar` (pill, liquid, haptic); особого центрального элемента нет. `15 §3.10`.
- Buyer Header — сквозной верхний блок (название магазина слева; поиск и профиль справа). Иконка
  профиля справа вверху — единственный вход в `AccountView`; bell/in-app-уведомлений нет. `13 §4, §16`.

## 10. UI states
Every critical screen has loading, empty, recoverable error and mutation-processing states. Critical mutations prevent double submission.

## 11. Notifications
MVP:
- new order → seller;
- status change → buyer when write access exists;
- relevant delivery result → buyer.

No write permission: order still succeeds, notifications simply do not send.

Client-side, the write-access prompt is triggered **at the checkout submit**, on the first
order only (`useCheckout.submit()` → `order-slice.requestNotifications()`), *before*
`invokeCheckout` — so the first «Заказ принят» notification has the best chance to be delivered.
The prompt is called synchronously inside the submit gesture; the order itself never depends on
the result. On consent the fact is persisted server-side (`notifications-actions` →
`telegram_identities.notifications_enabled`); the client remembers «already asked»
(`userSettings.notificationsPrompted`) and does not re-prompt.

The call is bounded by a short deadline (currently **1200 ms**) and never throws or hangs:
a denial or timeout does not affect the order — it only means notifications are not delivered.
The buyer notification in `process-checkout` is sent **only when** `notifications_enabled = true`
(server-side gate); the seller notification is always sent. See
`src/infrastructure/telegram/telegram-share.ts` (`MESSAGES_ACCESS_TIMEOUT_MS`),
`useCheckout`, and the `TelegramPort.requestMessagesAccess` contract.

> **Superseded (2026-10-05, docs/18 CART-05):** earlier this section required the prompt to be
> offered *after* a successful order, on the «Заказ оформлен» screen. The agreed flow now asks at
> checkout (first order), with the success screen only reporting whether notifications were granted.

Notification retries/logging are independent of order transaction.

## 12. Security baseline
Required:
- Telegram initData validation;
- RLS;
- backend authorization;
- input validation;
- rate limiting;
- idempotency;
- upload validation;
- secret management;
- no frontend secrets;
- opaque public IDs;
- audit logs;
- least-privilege storage;
- no sensitive buyer data in public responses.

## 13. Operational limits
Initial rate limits should be strict for order creation/image uploads and moderate for questions/reviews/search. Exact numbers are deployment parameters, not product rules.

## 14. Observability
Operational telemetry only:
- application/backend errors;
- order failures;
- inventory conflicts;
- auth failures;
- notification failures;
- important transitions.

No analytics dashboard in MVP.

Optional standard event structure:
`event_name, user_id, shop_id, product_id, order_id, occurred_at, metadata`.

## 15. Testing
Required:
- price calculation;
- status transitions;
- inventory transitions;
- idempotency;
- RLS/authorization;
- Telegram identity validation;
- concurrent last-stock purchase;
- archive/pause;
- snapshot immutability;
- notification failure isolation.

## 16. Deployment
GitHub + InsForge. No VPS requirement.

Versioned migrations. Environment-separated configuration. Secrets managed outside source.

## 17. Performance
Priorities:
- fast-feeling mobile storefront;
- no N+1 catalog queries;
- optimized/lazy images;
- critical order flow prioritized over cosmetics.

Buyer storefront (требование MVP): Home делает **2 read** — `storefront_home_context_read` (store +
категории) и `storefront_home_products_read` (первая страница товаров, keyset-курсор); товары
догружаются progressive-страницами по скроллу. Никаких повторных запросов на каждый рендер; skeleton
без белого flash и layout shift; карточки — `thumb`, lazy. `15 §5-6`. Exact SLOs are set after real traffic data.

## 18. Pause/archive behavior
PAUSED shop resolves but shows technical-pause state and rejects new orders. Существующие заказы не
затрагиваются.

ARCHIVED product is excluded from normal catalog and cannot enter checkout.

Storefront-проекция (`storefront_home_context_read` / `storefront_home_products_read`):
- `ARCHIVED` product не попадает ни в Home, ни в Catalog, ни в Category, ни в Search;
- `ARCHIVED` category скрыта из списка категорий, а её активные товары показываются как
  `categoryId = null` («Все товары»); `product.category_id` в БД при этом не меняется, поэтому
  возврат категории в `ACTIVE` автоматически возвращает товар в неё;
- sold out product (все активные варианты `stock = 0`) остаётся видимым, но `available = false`.
`13 §11–§15, §20`.

## 19. Deep link
Первым шагом покупателя всегда должно открываться **приложение (Mini App)**, а не чат бота. Telegram поддерживает два формата открытия приложения по ссылке (см. Bot API — *Direct Link Mini Apps* и *Main Mini App*):

1. **Direct Link (именованное Mini App):** `t.me/<bot>/<app-short-name>?startapp=shop_<public_id>`
   - требует, чтобы в @BotFather было создано **именованное** Mini App (`/newapp`) с этим коротким именем;
   - short name допускает только **строчные** латинские буквы, цифры и `_`.
2. **Main Mini App:** `t.me/<bot>?startapp=shop_<public_id>`
   - требует, чтобы в @BotFather был настроен **Main Mini App** (*Bot Settings → Configure Mini App → Enable Mini App*), URL = production frontend.

В обоих случаях `startapp` попадает в Mini App как `initDataUnsafe.start_param` (и GET `tgWebAppStartParam`). Ссылка строится в `domain/rules/storefront-link.ts`: если `VITE_BUYER_APP_SHORTNAME` задан — формат (1), иначе (2). Внутренние последовательные DB IDs не раскрываются — только opaque `public_id`.

**Выбрано для Shoppis (вариант B, Direct Link):** бот `BuyShoppis_bot`, именованное Mini App `shop` → `VITE_BUYER_APP_SHORTNAME=shop`, публичная ссылка `https://t.me/BuyShoppis_bot/shop?startapp=shop_<public_id>`.

Точка входа после резолва `public_id` — Главная витрины (Home), откуда покупатель уходит в
Каталог/карточку. Порядок инициализации: `authenticate → resolve public_id → loadBuyerStore →
storefront_home_context_read + storefront_home_products_read → Home`. `13 §26`.

> Если `t.me/<bot>/<app>` открывает **чат бота**, значит именованное Mini App с таким short name в BotFather не создано (или имя невалидно — не строчное); если `t.me/<bot>?startapp=` открывает чат — не включён Main Mini App. Это конфигурация BotFather, а не формат ссылки.

## 20. Architecture decision records
For major changes record:
- problem;
- chosen solution;
- alternatives;
- reason;
- migration impact;
- MVP/future status.
