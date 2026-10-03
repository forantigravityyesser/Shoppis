# SHOPPIS — OPENCODE IMPLEMENTATION PLAN

**Version:** 0.3

## Rule
OpenCode receives one bounded task at a time. Each task states objective, files/modules, constraints, acceptance criteria and tests.

## Delivery stages (ход работ)

- **Stage 0 — Foundation** — выполнено: React/Vite/TS, Tailwind 3.4, InsForge client, Telegram bridge, app shell.
- **Stage 1 — Identity** — выполнено: серверная валидация `initData` (`telegram-auth`), Shoppis User + runtime-сессия,
  контекст входа buyer/seller, онбординг продавца. Vertical slice 1 закрыт.
- **Stage 2 — Seller App Shell** — выполнено:
  - **2.1** `SellerLayout`: app shell, safe-area, внутренний скролл, отсутствие перекрытия контента навбаром;
  - **2.2** `SellerNavBar` на переиспользуемом `BottomNavBar` (pill, liquid-анимации);
  - **2.3** маршруты: `/seller/dashboard`, `/seller/inventory`, `/seller/orders`, `/seller/orders/history`, `/seller/settings`;
  - **2.4** пустые экраны-каркасы без API и расчётов;
  - разделение Dashboard (операционный) ↔ Settings → Магазин (профиль витрины).
- **Между Stage 2 и Stage 3 (выполнено):** Inventory (`06`–`09`, реальный backend + image
  optimization), Store Settings и storefront link (`10`, `12`: профиль/валюта/язык/контакт/шара,
  pause, Deep Link `shop_<public_id>`).
- **Stage 3 — Buyer storefront (Главная + Каталог)** — текущее направление. Полная спецификация и
  этапы `H-01…H-11` — `13_SHOPPIS_BUYER_HOME_PLAN.md §28`. Кратко:
  - **H-01** storefront contracts + SQL `storefront_home_read` (+ `telegram_identities.photo_url`); миграция `0014`;
  - **H-02** seller avatar (`photo_url` → projection);
  - **H-03** `StorefrontRepository` + `useStorefrontHome` (loading/error/retry/cache);
  - **H-04** Home shell (Header, баннер, safe-area, skeleton);
  - **H-05** Categories (`CategoryCarousel`, «Все →» → Catalog);
  - **H-06** Product Grid (`ProductGrid`, `ProductCard`, `FavoriteButton`, heart cutout);
  - **H-07** Home product section (6–8 + «Смотреть все»);
  - **H-08** Catalog (search, all, categories, filters, grid; Home search → focus);
  - **H-09** buyer Bottom Navigation (5 вкладок, крупное сердце по центру);
  - **H-10** pause store state;
  - **H-11** performance polish (skeleton/images/network/UI/Telegram QA).
  Правило сохраняется: один этап за раз → тесты → ручная сверка владельцем → следующий этап.
- **Далее** — остальные vertical slices (Product Detail, Cart, Orders, Reviews/Questions, …).

Правило сохраняется: одна ограниченная задача за раз, с objective, файлами, ограничениями, acceptance и тестами.

## Vertical slices

### 0 — Foundation
React/Vite/TS, lint/test, env, InsForge client, Telegram bridge, UI shell.

### 1 — Identity
Telegram initData validation, User/TelegramIdentity, session, repeat-login.

Acceptance: one Telegram user = one User; forged client IDs fail.

### 2 — Shop
Shop ownership, ACTIVE/PAUSED, settings, public_id, seller contact, Seller Bot entry.

### 3 — Categories
CRUD, ordering, archive/delete, product unassignment.

### 4 — Product
Product, images, ordinary/linking attributes, ACTIVE/ARCHIVED, archive-first deletion.

### 5 — ProductGroup
Create/connect/disconnect linked cards; same-shop enforcement; related-product navigation.

### 6 — Variants
One purchase dimension per Product; free-form name/value; stock; optional custom pricing.

Examples:
- Size S/M/L;
- Volume 100/300/500 ml.

No Color × Size matrix.

### 7 — Inventory
Available/held buckets, InventoryMovement, atomic updates, manual held→available.

### 8 — Buyer storefront
Shop, pause screen, categories, search title+description, product detail, variants, favorites, related products.
Home и Catalog разделены: Home — витрина/завлечение, Catalog — поиск/фильтры/весь ассортимент.
Storefront-read — `storefront_home_read(public_id)`. Детали и этапы `H-01…H-11` — `13`.

### 9 — Cart
Shop-scoped cart, quantities, selected checkout items. No reservation.

### 10 — Orders
Checkout revalidation, immutable snapshots, idempotency, atomic inventory movement, seller/buyer order views.

### 11 — Order state machine
NEW, IN_TRANSIT, DELIVERED, REFUSED, CANCELLED; delivery outcome RECEIVED/REFUSED; history; refusal reasons.

### 12 — Delivery feedback
After DELIVERED: seller chooses `Покупатель забрал` or `Покупатель отказался`; buyer feedback appears only after RECEIVED; 1–5 rating; skip; refusal reason.

### 13 — Questions
One question → one answer; seller deletion.

### 14 — Notifications
Seller new-order; buyer status; write-access handling (best-effort, bounded deadline — order is never blocked by the Telegram permission prompt); retries/logging.

### 15 — Security hardening
RLS matrix, endpoint authorization, rate limits, upload validation, public/private response audit, secrets audit.

### 16 — Telegram mobile QA
Android/iOS, slow network, repeated clicks, reopen/back, pause, archive, low stock, concurrent checkout.

## End-to-end acceptance
`Telegram identity → shop → category → white T-shirt Product → Size S/M/L → stock → optional black Product linked → public storefront → variant → cart → checkout → atomic order → available→held → seller notification → IN_TRANSIT → DELIVERED or REFUSED → buyer status/feedback`.

## DoD
- [ ] TypeScript types
- [ ] validation
- [ ] authorization
- [ ] RLS
- [ ] loading/empty/error
- [ ] negative case
- [ ] tests
- [ ] migration
- [ ] no unrelated refactor
- [ ] no unjustified abstraction

Critical slices additionally:
- [ ] concurrency
- [ ] idempotency
- [ ] snapshot immutability
- [ ] security regression

## First task
Do not start with storefront styling. First prove:
`Telegram identity → User → Shop → Product → Variant → Inventory → Order`

The first milestone is a secure, transactionally correct vertical slice.
