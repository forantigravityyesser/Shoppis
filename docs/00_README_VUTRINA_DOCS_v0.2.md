# VUTRINA — DOCUMENTATION SET v0.2

Статус: рабочая техническая база после фиксации ключевых решений.

## Документы
1. `01_VUTRINA_PROJECT_CONSTITUTION_v0.2.md` — принципы, границы MVP и правила.
2. `02_VUTRINA_PRODUCT_SPEC_v0.2.md` — точное поведение продукта и UX.
3. `03_VUTRINA_DOMAIN_DATABASE_SPEC_v0.2.md` — сущности, БД, состояния, инварианты, транзакции и RLS.
4. `04_VUTRINA_TECHNICAL_SPEC_v0.2.md` — React/Vite, InsForge, Telegram, auth, storage, security.
5. `05_VUTRINA_CODEX_IMPLEMENTATION_PLAN_v0.2.md` — маленькие независимые engineering tasks.
6. `06_VUTRINA_GLOBAL_DEVELOPMENT_ROADMAP_v0.1.md` — глобальные этапы разработки 0–15 и точки готовности Gate A–E.
7. `07_VUTRINA_STAGE_EXECUTION_PLAN_v0.2.md` — конкретные задачи текущего этапа, ход и решения (рабочий документ).

## Принцип двух сред проверки
Telegram — не финальная интеграция, а целевая среда исполнения и проверки с первых этапов. Каждый глобальный этап имеет два состояния: `LOCAL VERIFIED` (браузер / локальный контур) и `TELEGRAM VERIFIED` (реальный Telegram Mini App на development-окружении). Этап не закрывается без обоих.

## Source of truth
- Продуктовое решение → Product Spec.
- Схема данных → Domain & Database Spec.
- Инфраструктура → Technical Spec.
- Принцип/граница → Constitution.
- Порядок глобальных этапов → Global Development Roadmap.
- Состав и статус задач текущего этапа → Stage Execution Plan.
- Конкретная реализация → код.

## Domain foundation
`User → Shop → Product → Variant → Inventory → Order → OrderItem`

Supporting: `Category, ProductGroup, ProductImage, ProductAttribute, ProductLinkAttribute, Cart, CartItem, Favorite, Review, Question, QuestionAnswer, OrderStatusHistory, InventoryMovement, NotificationDelivery, TelegramIdentity`.

## Locked decisions
- Один пользователь может быть и покупателем, и продавцом.
- В MVP UI один магазин на продавца; БД сразу поддерживает несколько.
- Один Mini App/frontend и два Telegram-бота как entry points.
- Разные цвета/формы одного товара — отдельные Product, связанные через ProductGroup.
- Variant — покупаемая опция внутри Product: Size/Volume/Capacity и т.п.
- Одна Product в MVP имеет одну dimension вариантов, без Color × Size матрицы.
- Product attributes разделены на обычные и linking/differentiating.
- Inventory имеет `available_quantity` и `held_quantity`.
- Cart ничего не резервирует.
- Checkout заново проверяет цену и остаток.
- Order хранит immutable snapshot товара, варианта, покупателя и итогов.
- Доставка в MVP не входит в сумму.
- Статусы: `NEW`, `IN_TRANSIT`, `DELIVERED`, `REFUSED`, `CANCELLED`.
- Buyer cancellation — только `NEW`.
- После `REFUSED` товар не возвращается автоматически в available.
- Product/Category: `ACTIVE/ARCHIVED`; Product удаляется только из archive.
- Shop: `ACTIVE/PAUSED`.
- Seller contact задаётся вручную и не подменяется Telegram username автоматически.
- Public links используют opaque `public_id`, без последовательных DB IDs.
- Деньги — integer minor units, без float.
