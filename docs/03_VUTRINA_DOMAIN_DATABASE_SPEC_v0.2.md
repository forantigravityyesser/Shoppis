# VUTRINA — DOMAIN & DATABASE SPECIFICATION

**Version:** 0.2

## 1. Domain foundation
Core:
`User, Shop, Product, Variant, Inventory, Order, OrderItem`

Supporting:
`TelegramIdentity, Category, ProductGroup, ProductImage, ProductAttribute, ProductLinkAttribute, Cart, CartItem, Favorite, Review, Question, QuestionAnswer, OrderStatusHistory, InventoryMovement, NotificationDelivery`.

## 2. Identity
### User
`id UUID PK`, timestamps, status.

### TelegramIdentity
`user_id FK`, `telegram_user_id BIGINT UNIQUE`, username nullable, first/last name, language_code, timestamps.

Bootstrap:
1. receive raw signed Telegram initData;
2. validate server-side;
3. resolve Telegram user;
4. find or create User + TelegramIdentity transactionally;
5. create/refresh application session.

Repeated launches resolve to the same User. Invalid identity fails closed. Client user IDs are never authorization evidence.

## 3. Shop
Fields: id, owner_user_id, name, banner, currency_code, language_code, status ACTIVE/PAUSED, seller_contact nullable, public_id unique, optional future slug, timestamps.

MVP UI: one shop. DB: many shops per User.

## 4. Category
`id, shop_id, name, sort_order, status, timestamps`.
Unique `(shop_id, normalized_name)`.
Product has zero or one category.

## 5. ProductGroup
`id, shop_id, timestamps`.
Product has zero or one `product_group_id`. All members must share the same shop.

## 6. Product
`id, shop_id, product_group_id nullable, category_id nullable, title, description, status ACTIVE/ARCHIVED, sort_order, created_at, updated_at, archived_at, deleted_at`.

## 7. ProductImage
`id, product_id, storage_key, sort_order, width, height, mime_type, file_size_bytes, created_at`.
Max 4 active images per Product.

## 8. Product attributes
`ProductAttribute`: id, product_id, name, value, sort_order.

`ProductLinkAttribute`: id, product_id, name, value, sort_order.

The separate tables encode separate semantics: informational vs card-differentiating/navigation context.

## 9. Variant
`id, product_id, name, value, sort_order, status, price_mode, custom_original_amount_minor nullable, custom_discount_percent nullable, timestamps`.

MVP: one purchase-variant dimension per Product. Therefore all active variants of a Product share the same `name`.

Unique active `(product_id, normalized_value)`.

## 10. Money
All money is integer minor units. Examples: RUB kopeks, USD cents, BYN kopeks.

`0 <= discount_percent <= 100`.

Central deterministic formula:
`current = round(original * (100 - discount_percent) / 100)`.

Rounding implementation is centralized and tested.

## 11. Inventory
One Inventory row per Variant:
`variant_id UNIQUE, available_quantity >= 0, held_quantity >= 0, updated_at`.

`available_quantity` is purchasable. `held_quantity` is not.

### InventoryMovement
`id, variant_id, order_id nullable, movement_type, quantity, from_bucket, to_bucket, actor_type, actor_user_id nullable, reason_code nullable, created_at, metadata JSONB`.

Inventory is the operational source of truth; movement ledger is the audit trail.

## 12. Inventory transitions
Order creation: `AVAILABLE → HELD`.
NEW cancellation: `HELD → AVAILABLE`.
IN_TRANSIT cancellation: stays held with reconciliation reason.
REFUSED: stays held until manual reconciliation.
DELIVERED: `HELD → DELIVERED`, quantity leaves inventory.

Manual reconciliation: `HELD → AVAILABLE`, atomic and audited.

## 13. Order
Fields:
`id, public_order_number, shop_id, buyer_user_id, buyer_full_name_snapshot, buyer_phone_snapshot, buyer_address_snapshot, buyer_telegram_username_snapshot, status, currency_code, subtotal_minor, total_minor, created_at, updated_at, cancelled_at, completed_at, refused_at, refusal_reason_code`.

No delivery charge.

## 14. OrderItem
Fields:
`id, order_id, product_id nullable, variant_id nullable, product_title_snapshot, product_description_snapshot nullable, product_image_snapshot, linking_attributes_snapshot, variant_name_snapshot, variant_value_snapshot, quantity, original_unit_price_minor, discount_percent, unit_price_minor, line_total_minor, currency_code`.

Foreign keys are historical references only; snapshots are the display source of truth.

## 15. OrderStatusHistory
`id, order_id, from_status, to_status, actor_type, actor_user_id, reason_code nullable, created_at, metadata`.

Every transition is recorded.

Every transition is recorded.

## 16. State matrix

| From | To | Actor |
|---|---|---|
| NEW | IN_TRANSIT | Seller |
| NEW | CANCELLED | Buyer/Seller |
| IN_TRANSIT | DELIVERED | Seller |
| IN_TRANSIT | CANCELLED | Seller |
| DELIVERED | REFUSED | Seller |

`DELIVERED → DELIVERED` is not a status transition: the seller records `delivery_outcome = RECEIVED`.

`REFUSED` and `CANCELLED` are terminal. `DELIVERED` is an operational confirmation stage and may only be finalized as RECEIVED (same status + outcome) or moved to REFUSED.

## 17. Idempotency
Order creation requires a client-generated idempotency key. Server persists it in a uniqueness-constrained record scoped safely to the buyer/order operation. Repeated request returns the original result and cannot create a second order.

## 18. Cart
`Cart(id, buyer_user_id, shop_id, timestamps)` unique `(buyer_user_id, shop_id)`.
`CartItem(cart_id, variant_id, quantity)`.

Cart is convenience state only; checkout never trusts stored price/stock.

## 19. Favorite
Unique shop-scoped favorite:
`buyer_user_id + shop_id + product_id`.

## 20. Reviews
`Review(id, shop_id, product_id, buyer_user_id, rating 1..5, text, status ACTIVE/HIDDEN, timestamps)`.
At most one active review per `(buyer_user_id, product_id)`.

## 21. Questions
`Question(id, shop_id, product_id, buyer_user_id, text, status, timestamps)`.
`QuestionAnswer(question_id UNIQUE, seller_user_id, text, timestamps)`.

## 22. NotificationDelivery
Minimal:
`id, user_id, shop_id, order_id, event_type, channel, status, attempt_count, last_error, timestamps`.

Notifications are asynchronous side effects.

## 23. Authorization / RLS
Public:
- active shop/products/categories;
- public images;
- public reviews/questions.

Buyer-private:
- own cart/favorites/orders/feedback.

Seller-private:
- shops owned by current user and their catalog/inventory/orders.

Forbidden:
- foreign-shop data;
- foreign buyer orders;
- direct client inventory arithmetic;
- unauthorized status transitions.

RLS is defense-in-depth; critical operations also require backend authorization.

## 24. Invariants
- available >= 0
- held >= 0
- operation quantity > 0
- money >= 0
- discount 0..100
- Product/Variant/Inventory tenant-scoped
- ProductGroup cannot cross shops
- max 4 active images/Product
- REFUSED/CANCELLED cannot transition; DELIVERED may only record RECEIVED or transition to REFUSED
- order total = sum(line totals)
- snapshots do not mutate
- cart never reserves
- paused/archived resources cannot create new orders
- public API never exposes internal held inventory
- Telegram identity must be server-verified

## 25. Atomic transactions
At minimum:
1. create order + reserve inventory + snapshots;
2. cancel NEW + release inventory;
3. order state transitions;
4. delivery result + inventory effect + history;
5. manual held→available;
6. category deletion/unassignment;
7. permanent Product deletion from archive.

Notifications are outside the order transaction.

## 26. Public IDs
Public storefront/order identifiers must be opaque and non-sequential. Default: random UUID/public ID. Human-readable slug can be introduced later.

## 27. Deletion
Product: `ACTIVE → ARCHIVED → DELETED`.
Orders survive catalog deletion because they use snapshots.

## 28. Future extension points
Delivery zones/prices; multi-shop UI; customer profiles; refusal analytics; aggregated ratings; payments; multi-dimensional variants; staff roles; advanced analytics. None are MVP implementations.
