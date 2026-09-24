# VUTRINA — PROJECT CONSTITUTION

**Version:** 0.3  
**Status:** Locked project principles / source of truth

## 1. Identity
Vutrina — Telegram-first платформа для быстрого создания цифровой витрины бизнеса.

Первый сценарий:
`Seller Bot → Mini App → Shop → Catalog → Public storefront → Buyer → Order`

Telegram — первый distribution layer, но не вечное архитектурное ограничение.

## 2. Product principle
Главная задача MVP:

> Превратить хаотичный Telegram-каталог небольшого продавца в нормальную цифровую витрину и дать ему возможность получить реальный заказ.

Не строим маркетплейс до появления доказанной необходимости.

## 3. MVP
### Seller
Seller Bot; создание/настройки магазина; pause/activate; категории; товары; ProductGroup; изображения; обычные и linking attributes; purchase variants; inventory; price/discount; orders; status flow; delivery result; contacts; storefront link; operational dashboard; notifications.

### Buyer
Public storefront; categories; search; product cards/detail; related products; variants; quantity; favorites; shop-scoped cart; checkout; order history/details; cancellation in NEW; seller contact; reviews; questions.

### Out of scope
Payments; delivery pricing/integrations; internal chat; AI; video; CSV/Excel; marketplace; subscriptions; advanced CRM/analytics; employee roles; full localization platform.

## 4. Non-negotiable rules
1. Security and data integrity outrank speed.
2. Telegram identity is server-validated.
3. Client-supplied IDs are never trusted for authorization.
4. Tenant isolation is mandatory.
5. Money never uses floating point.
6. Inventory changes are atomic.
7. Cart does not reserve stock.
8. Checkout revalidates stock and price.
9. Orders are immutable historical snapshots.
10. Buyer cancellation is allowed only in NEW.
11. REFUSED does not automatically return inventory to available.
12. Different visual/differentiating cards are separate Products linked through ProductGroup.
13. Variant is a purchasable option, not a second product.
14. Product deletion is archive-first.
15. Shop can be PAUSED without deleting data.
16. Notifications never determine order transaction success.
17. No MVP feature is added only because it may be useful someday.
18. Codex tasks remain small and independently verifiable.

## 5. Roles
There is no mutually-exclusive global buyer/seller role. One User may own shops and buy from other shops.

## 6. Architecture
One frontend / one Mini App / one backend. Two bots are entry points:
- Seller Bot — management context;
- Buyer Bot — buyer context and notifications.

Presentation context may differ, but authorization always comes from the authenticated server-side identity and resource ownership.

## 7. Future-proofing
DB supports multiple shops per User although MVP UI exposes one. Future delivery pricing, customer profiles, refusal analytics, store/product ratings, payments and multi-dimensional variants must not complicate MVP without evidence.

## 8. Definition of Done
Implemented + typed; backend validation; authorization/RLS; loading/empty/error states; negative cases; concurrency tests for critical operations; reproducible migrations; no data leak; no critical TODO; manual happy/failure path; no unnecessary architecture.

## 9. Release gate
MVP cannot ship if stock can go negative, foreign data is accessible, Telegram identity can be forged, snapshots mutate, money uses float, checkout can duplicate, notifications can roll back orders, cancellation works after NEW, inventory movement is inconsistent, paused shops accept orders, or archived products can be purchased.
