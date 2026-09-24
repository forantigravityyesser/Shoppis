# VUTRINA — TECHNICAL SPECIFICATION

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

## 7. Storage
Use controlled storage keys. Never expose arbitrary internal storage paths. Seller may mutate only owned product images.

## 8. Search
MVP: title + description, shop-scoped, active products only.

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

### 9.1 App shell, safe-area, keyboard
- Один контекст — один layout-шелл: `.app-shell` (flex-колонка, `height: 100dvh`, `overflow: hidden`).
- Контент — `.scrollable-content` (`flex: 1`, внутренний скролл); навбар — flex-элемент снизу, поэтому
  последний блок не перекрывается навбаром.
- Нижний safe-area: `--safe-bottom = max(env(safe-area-inset-bottom), var(--tg-safe-area-bottom, 0px))`,
  применяется к обёртке `.bottom-nav`. `useAppInit` выставляет `--tg-safe-area-bottom` из `tg.safeAreaInset.bottom`.
- При открытой клавиатуре `body.keyboard-is-open .bottom-nav { display: none }` (см. `useKeyboardFix`).
- Нижняя навигация — router-agnostic `BottomNavBar` (`presentation/shared/components`): активная
  вкладка и `onTabChange` передаются адаптерами (`SellerNavBar`; в будущем `FloatingNavBar` для покупателя).

## 10. UI states
Every critical screen has loading, empty, recoverable error and mutation-processing states. Critical mutations prevent double submission.

## 11. Notifications
MVP:
- new order → seller;
- status change → buyer when write access exists;
- relevant delivery result → buyer.

No write permission: order still succeeds, notifications simply do not send.

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

Exact SLOs are set after real traffic data.

## 18. Pause/archive behavior
PAUSED shop resolves but shows technical-pause state and rejects new orders.

ARCHIVED product is excluded from normal catalog and cannot enter checkout.

## 19. Deep link
Conceptually:
`t.me/<configured-bot>?startapp=shop_<opaque_public_id>`

Exact production format follows the selected Telegram Mini App configuration. Never expose sequential database IDs.

## 20. Architecture decision records
For major changes record:
- problem;
- chosen solution;
- alternatives;
- reason;
- migration impact;
- MVP/future status.
