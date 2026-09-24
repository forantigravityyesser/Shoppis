# VUTRINA — CODEX IMPLEMENTATION PLAN

**Version:** 0.2

## Rule
Codex receives one bounded task at a time. Each task states objective, files/modules, constraints, acceptance criteria and tests.

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
Seller new-order; buyer status; write-access handling; retries/logging.

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
