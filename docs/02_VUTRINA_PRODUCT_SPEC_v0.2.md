# VUTRINA — PRODUCT SPECIFICATION

**Version:** 0.2

## 1. Product card architecture

### Product = one concrete card
Example:
- Nike T-shirt — White
- Nike T-shirt — Black
- Nike T-shirt — Olive

These are separate Product cards. Each has its own photos, attributes, variants, stock and pricing.

### ProductGroup
Related cards can be connected through one ProductGroup. The product detail page contains `Другие варианты` / `Похожие карточки`.

MVP:
- Product belongs to zero or one ProductGroup;
- all group members belong to the same Shop;
- group membership never merges stock or price;
- relation is explicit, not inferred;
- each card remains independently editable and purchasable.

## 2. Three attribute concepts

### Ordinary attribute
Informational key/value shown in characteristics:
`Material → Leather`, `Country → Italy`.

### Linking/differentiating attribute
Explains why a separate Product card differs:
`Color → White`, `Finish → Matte`, `Formula → Oil-based`, `Brand → Nike`.

It is descriptive. ProductGroup membership is the actual navigation relation.

### Purchase variant
Required selectable purchase option:
`Size → S/M/L`, `Volume → 100/300/500 ml`, `Capacity → 64/128 GB`.

Seller freely names the dimension. Each value has its own stock and may have its own price.

MVP intentionally supports one purchase-variant dimension per Product. No Color × Size matrix.

## 3. Pricing
Seller edits original price and discount %. Current price is calculated server-side.

Variant pricing:
- `USE_PRODUCT_PRICE`;
- `CUSTOM_PRICE`.

For custom price the variant has its own original amount + discount %. Thus one card can have common pricing or different prices for M/L/XL, 100/300/500 ml, etc.

Money is integer minor units. No delivery fee or tax calculation in MVP.

## 4. Inventory UX
Two visible balances:
- `В наличии` — physically available for a new order;
- `В ожидании` — held/reserved/reconciliation quantity not currently purchasable.

Manual action:
`Переместить в наличии`.

Example:
`48 available + 2 held → 50 available + 0 held`.

## 5. Inventory lifecycle
On order creation:
`available -= qty; held += qty`.

Cancel in NEW:
`held -= qty; available += qty`.

Cancel in IN_TRANSIT:
no automatic return to available; quantity remains held for reconciliation.

REFUSED:
no automatic return to available; seller later reconciles physically returned goods.

DELIVERED:
item has left seller inventory; `held -= qty`, with audit movement `HELD → DELIVERED`.

## 6. Orders
Technical statuses remain exactly five:
`NEW`, `IN_TRANSIT`, `DELIVERED`, `REFUSED`, `CANCELLED`.

Meaning:
- `NEW` — order created;
- `IN_TRANSIT` — seller sent it / delivery is underway;
- `DELIVERED` — delivery physically reached the buyer, but seller has not yet recorded the final outcome;
- `REFUSED` — buyer did not accept the delivery;
- `CANCELLED` — order cancelled before successful completion.

After `DELIVERED`, the seller gets a simple action:
- `Покупатель забрал` → keep `DELIVERED` and set delivery outcome to `RECEIVED`;
- `Покупатель отказался` → change status to `REFUSED` and store a refusal reason.

Thus `DELIVERED` is a short-lived operational confirmation stage, not the final business outcome by itself.

Buyer cancels only NEW. Seller cancels NEW and IN_TRANSIT.

## 7. Delivery result
When the order reaches `DELIVERED`, the seller sees:
- `Покупатель забрал`;
- `Покупатель отказался`.

If the buyer took the order:
- status remains `DELIVERED`;
- `delivery_outcome = RECEIVED`;
- the held quantity is removed from inventory;
- buyer feedback becomes available.

If the buyer refused:
- status becomes `REFUSED`;
- `delivery_outcome = REFUSED`;
- refusal reason is required;
- held quantity remains until manual inventory reconciliation.

The buyer sees the post-delivery feedback only after the seller confirms `RECEIVED`.

Refusal uses a small controlled reason list. Suggested:
`BUYER_CHANGED_MIND`, `COULD_NOT_CONTACT_BUYER`, `DELIVERY_TERMS`, `PRODUCT_NOT_MATCHED_EXPECTATIONS`, `OTHER`.

## 8. Buyer feedback
After seller confirms `RECEIVED` for a `DELIVERED` order, buyer sees an unread feedback state and may:
- rate 1–5;
- submit;
- skip.

For REFUSED, buyer may select a refusal reason or skip.

Feedback must never block order completion.

## 9. Reviews
MVP:
- max one active review per buyer/product;
- seller can hide/delete;
- deletion does not restore eligibility;
- review is not dependent on verified purchase.

## 10. Questions
One buyer question → max one seller answer. No follow-up threads. Seller can delete. Public buyers of the shop can see it.

## 11. Order snapshot
Store order number, timestamps, buyer-entered name/phone/address, Telegram username if available at order time, item snapshots, variant snapshot, quantities, original/discount/current prices, currency, line totals and order total.

No delivery charge.

Catalog edits/deletion never alter an existing order.

## 12. Cart and checkout
Cart is shop-scoped and never reserves stock.

Checkout:
1. authenticate;
2. verify shop ACTIVE;
3. verify products/variants ACTIVE;
4. revalidate inventory;
5. recalculate current prices;
6. create order atomically;
7. move inventory;
8. write snapshots;
9. commit;
10. notify separately.

If price/stock changed, return conflict and create no partial order. Final request requires idempotency.

## 13. Product/category/shop states
Product: `ACTIVE | ARCHIVED`. Permanent deletion only from archive.

Category: `ACTIVE | ARCHIVED`. One product has zero or one category. Deleting category only removes assignment. `sort_order` controls category order.

Shop: `ACTIVE | PAUSED`. Paused storefront shows a technical-pause screen and blocks new orders while seller can continue management.

## 14. Seller contact
Optional manually configured Telegram username/link/contact. Do not automatically expose seller's own Telegram identity.

Buyer sees a contact button if configured; otherwise a message that seller did not provide contact.

## 15. Search
MVP search uses title + description, shop-scoped.

## 16. First 30 days
Track:
1. users who created a shop;
2. number/% of them who created at least one product;
3. number/% who created 5+ product cards;
4. number/% of shops receiving first order;
5. validation target: 7 people / 20% of shop creators reaching the defined success point.
