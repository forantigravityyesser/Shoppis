# SHOPPIS — PROJECT CONSTITUTION

**Version:** 0.3 · **Status:** Locked project principles / source of truth  
**Актуализировано:** 2026-10-14 (ревизия документации, партия 1: `01`, `02`; §10 — реестр
зафиксированных решений с обоснованием «что выбрано / почему / что отвергнуто»)

## 1. Identity

Shoppis — Telegram-first платформа для быстрого создания цифровой витрины бизнеса.

Два сквозных сценария:

- **Seller path:** `Seller Bot → Mini App (seller context) → Onboarding (создать магазин) →
  Каталог/Инвентарь → ссылка для покупателей → Заказы → Продажи`
- **Buyer path:** `Deep link shop_<public_id> (или Buyer Bot) → Mini App (buyer context) →
  Витрина → Корзина → Checkout → Заказ`

Telegram — первый distribution layer, но не вечное архитектурное ограничение: frontend — обычное
React-приложение, а весь Telegram SDK изолирован в `infrastructure/telegram` и не протекает в
бизнес-логику (`04 §9`).

Три Telegram-интеграции:

1. **Buyer Bot** — точка входа покупателя: deep links на витрины/товары, «Мои магазины», активные
   заказы, справка; шлёт покупателю уведомления о статусе заказа (при согласии).
2. **Seller Bot** — точка входа продавца: открытие панели / создание магазина, статистика,
   приглашение покупателей; шлёт продавцу уведомления о новых заказах.
3. **Admin Bot (операционный)** — не пользовательский: управление вебхуками, командами и
   меню-кнопками ботов через защищённый edge `telegram-bot-admin` (guard по `API_KEY`).

## 2. Product principle

Главная задача MVP:

> Превратить хаотичный Telegram-каталог небольшого продавца в нормальную цифровую витрину и дать
> ему возможность получить реальный заказ.

Не строим маркетплейс до появления доказанной необходимости.

## 3. MVP

### Seller

Seller Bot; онбординг (создание магазина: имя, баннер, валюта, язык); настройки магазина
(профиль, описание, локализация, контакт, share, pause/activate); категории; товары; изображения
(клиентский crop/сжатие); обычные и linking attributes (БД и чтение покупателем; UI-редактор
linking — follow-up `16 FD-1`); purchase variants; per-axis custom price/discount варианта;
inventory (`в наличии`/`в ожидании`, перемещения); заказы (список, фильтры, история, 6 действий);
delivery result (RECEIVED/REFUSED + причина); копирование карточки (независимые черновики);
operational dashboard (Продажи/Заказы/Инвентарь/Требует внимания) + экран «Продажи»; Telegram
notifications; ссылка-приглашение.

### Buyer

Public storefront; категории; server-side поиск; product cards/detail; related products; variants;
quantity; favorites (локально, per-store); shop-scoped cart (локально + серверная реконсиляция);
checkout (ФИО / телефон / адрес); order history/details (store-scoped); cancellation в NEW; seller
contact; reviews и вопросы (чтение и запись); профиль покупателя (язык интерфейса); список
посещённых магазинов (в приложении и в Buyer Bot); уведомления в Telegram по статусам заказов.

### Out of scope

Payments; delivery pricing/integrations; internal chat; AI; video; CSV/Excel; marketplace;
subscriptions; advanced CRM/analytics; employee roles; full localization platform (сверх ru/en);
in-app-уведомления (колокольчик/лента) — только Telegram-боты (`13 §16`).

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
12. Different visual/differentiating cards are separate Products linked through explicit relations.
13. Variant is a purchasable option, not a second product.
14. Product deletion is archive-first.
15. Shop can be PAUSED without deleting data.
16. Notifications never determine order transaction success.
17. No MVP feature is added only because it may be useful someday.
18. OpenCode tasks remain small and independently verifiable.
19. Интерфейс и витрина поддерживают ровно два языка (ru/en); язык интерфейса — пользовательская
    настройка, независимая от языка магазина (`02 §22`).
20. Public links use opaque `public_id`; sequential DB IDs are never exposed.
21. Приватные чтения (заказы и PII покупателя) и критические мутации выполняются на серверных
    границах (edge/RPC); клиентские ID не являются доказательством доступа.
22. Изменение поведения отражается в `docs/` на том же этапе (docs-sync — часть Definition of
    Done); незакрытые расхождения живут в `08`/`16`/`11`, а не в комментариях кода.

## 5. Roles

There is no mutually-exclusive global buyer/seller role. One User may own shops and buy from other
shops.

Контекст запуска (`seller` / `buyer`) выбирает не пользователь и не клиентский флаг, а среда
запуска + серверная сессия: `startapp` (`seller`, `shop_…`, `prod_…`) либо подписанный источник
входа `bot` (`buyer`/`seller`) из `telegram-auth` (`04 §2`, `02 §20`).

## 6. Architecture

One frontend / one backend / three bots (два entry points + один операционный).

- Один Mini App обслуживает оба контекста; контекст определяется до рендера (`useAppInit`).
- Источник входа (`bot`) определяется сервером по токену, чья HMAC-подпись совпала с `initData`,
  а не по клиентским данным. Это нужно для открытий без deep-link: «Open App» бота продавца
  открывает панель, «главный Mini App» бота покупателя — последнюю витрину.
- Presentation context may differ, but authorization always comes from the authenticated
  server-side identity and resource ownership.
- Слои: `presentation → application → domain`; инфраструктура вызывается только из `application`
  (`04 §9`, `04 §9.0`).

## 7. Future-proofing

DB supports multiple shops per User although MVP UI exposes one. Future delivery pricing, customer
profiles, refusal analytics, store/product ratings, payments, multi-dimensional variants and
additional languages must not complicate MVP without evidence.

Готовность к будущему заложена точечно: opaque `public_id` (slug позже), per-axis цены/скидки
вариантов (будущие акции), серверные read-проекции (будущий RLS), `buyer_store_visits` (будущий
список магазинов без deep-link), i18n-ресурсы (добавление языка без переписывания UI).

## 8. Definition of Done

Implemented + typed; backend validation; authorization/RLS; loading/empty/error states; negative
cases; concurrency tests for critical operations; reproducible migrations; no data leak; no
critical TODO; manual happy/failure path; no unnecessary architecture. Дополнено фактическим
гейтом проекта:

- `typecheck`, `lint` (0 errors), `test`, `build` — зелёные; commerce-изменения дополнительно
  `build:edge` + `commerce:harness`; миграции — `migrations:check` (номерные, трекаются в
  `schema_migrations`, см. D22);
- каждая критичная мутация — атомарный SQL-RPC с серверной авторизацией по actor из сессии;
- экран не считается готовым без loading / empty / recoverable error / mutation states;
- ручная проверка в двух средах: `LOCAL VERIFIED` и `TELEGRAM VERIFIED` (реальный Mini App);
- docs-sync (§4.22).

## 9. Release gate

MVP cannot ship if stock can go negative, foreign data is accessible, Telegram identity can be
forged, snapshots mutate, money uses float, checkout can duplicate, notifications can roll back
orders, cancellation works after NEW, inventory movement is inconsistent, paused shops accept
orders, archived products can be purchased, защищённые order-RPC вызываются напрямую с anon,
delivery outcome перезаписывается после фиксации, а PII покупателя попадает в публичные
read-проекции.

## 10. Реестр зафиксированных решений

Каждое решение — сознательный выбор с обоснованием. Если код начинает противоречить реестру —
это повод либо исправить код, либо обновить решение здесь, а не молча разойтись.

### D1. Контекст входа — не роль пользователя

**Выбрано:** один User может владеть магазином и покупать в других; `buyer`/`seller` — контекст
запуска Mini App.
**Почему:** одна Telegram identity, один frontend; сценарий «продавец покупает у другого» ломается
любой жёсткой ролью.
**Отвергнуто:** глобальные взаимоисключающие роли buyer/seller.

### D2. Один магазин на продавца в UI MVP; БД поддерживает много

**Выбрано:** UI оперирует одним магазином; схема — many shops per user.
**Почему:** упрощает навигацию и состояние; миграция к мультимагазину не потребует переписывания БД.
**Отвергнуто:** переключатель магазинов в MVP.

### D3. Один frontend / один backend; боты — только entry points

**Выбрано:** боты открывают Mini App и шлют уведомления; весь UI — в Mini App.
**Почему:** единый код, дизайн и авторизация; не дублируем сценарии в двух интерфейсах.
**Отвергнуто:** отдельные web-приложения под каждого бота, чат-команды для мутаций каталога.

### D4. Источник входа определяется сервером по подписи initData

**Выбрано:** `telegram-auth` возвращает `bot: 'buyer' | 'seller' | null` — токен, чья HMAC-подпись
совпала. Используется только для открытий без `startapp`.
**Почему:** «Open App» и главный Mini App не передают `startapp`; доверять можно только подписи.
Клиентские `initDataUnsafe`/URL-флаги подделываются.
**Отвергнуто:** определять вход по username/эвристикам или по localStorage.

### D5. Product = конкретная карточка; related — явные связи

**Выбрано:** «Nike T-shirt — White/Black» — разные Product; связь карточек — явная (`product_links`),
не вывод из атрибутов. `ProductGroup` в схеме зарезервирован, в UI не используется (`16 FD-5`,
статус DECIDE).
**Почему:** у каждой карточки свои фото/варианты/остатки/цены; продавец мыслит карточками, а
покупателю нужны явные «Похожие», а не автоматическая группировка.
**Отвергнуто:** группировка по linking-атрибуту, автослияние остатков.

### D6. Одна variant dimension на Product

**Выбрано:** Size / Volume / Capacity — одна ось, свободно именуемая продавцом; каждая позиция —
Variant со своим stock и опциональной ценой.
**Почему:** покрывает реальный кейс малого продавца; матрица Color × Size взорвала бы UI и модель.
**Отвергнуто:** мультиразмерные матрицы в MVP (future extension point).

### D7. Две таблицы атрибутов (ordinary / linking)

**Выбрано:** `product_attributes` (информационные) и `product_link_attributes` (различия карточек).
**Почему:** разные смыслы: характеристики товара vs «чем эта карточка отличается»; навигацию даёт
связь, а не атрибут.
**Отвергнуто:** единая таблица с флагом (размывает семантику и ломает проекции).

### D8. Деньги — integer minor units

**Выбрано:** все суммы — целые в минорных единицах; формула `current = round(original * (100 −
discount) / 100)` централизована и протестирована; сервер пересчитывает цену на checkout.
**Почему:** float в деньгах — гарантированные расхождения и «−0.01 ₽»; minor units совпадают со
снимком заказа.
**Отвергнуто:** decimal-строки/float в клиентских расчётах.

### D9. Цены вариантов — независимые оси

**Выбрано:** variant хранит `custom_original_amount_minor` и `custom_discount_percent` независимо;
`effectivePrice` варианта не наследует скидку товара.
**Почему:** regressions `0037`/`0040`: смешение осей (скидка товара × custom-цена) давала неверные
цены в 7 SQL-функциях; независимость осей — контракт Product Detail / Cart / чекаут / `order_items`.
**Отвергнуто:** «один общий множитель» и вычисление скидки на клиенте.

### D10. Inventory: available/held, cart не резервирует, reserve-before-order

**Выбрано:** заказ атомарно переводит `available → held` с обязательным idempotency key
(`IDEMPOTENCY_KEY_REQUIRED`); повторный запрос возвращает исходный результат.
**Почему:** oversell на последнем стоке и дубли заказов при ретраях — P0-риски (harness Test 1–9).
**Отвергнуто:** резервирование в корзине; «сначала заказ, потом проверка стока».

### D11. Пять статусов; DELIVERED — операционная стадия с терминальным исходом

**Выбрано:** `NEW → IN_TRANSIT → DELIVERED`, плюс `REFUSED`/`CANCELLED`; у DELIVERED продавец
фиксирует исход `RECEIVED` (статус остаётся DELIVERED) или `REFUSED` (статус меняется). Исход
терминален — перезапись запрещена (`0049`).
**Почему:** продавцу нужны отдельно «передал в доставку» и «забрали/отказались»; иначе история
искажается (DELIVERED ≠ бизнес-результат).
**Отвергнуто:** отдельный статус RECEIVED (размножает терминальные состояния).

### D12. REFUSED не возвращает остаток автоматически

**Выбрано:** после REFUSED/IN_TRANSIT-cancel количество остаётся в `held` до ручной
реконсиляции (`inventory_reconcile`, order-aware, с аудитом).
**Почему:** товар мог не вернуться физически; автоматический возврат сделал бы остатки фикцией.
**Отвергнуто:** мгновенный `held → available` по отказу.

### D13. Получатель — адрес доставки, не email

**Выбрано:** checkout-форма: ФИО / телефон / адрес (`buyer_address_snapshot`); email не
запрашивается и не хранится.
**Почему:** Telegram-first B2C; у малого продавца нет email-процессов. Правка внешнего spec
зафиксирована в `18`/`00`.
**Отвергнуто:** email как получатель (внешний шаблон ТЗ).

### D14. Cart/Favorites в MVP — локально, per-store

**Выбрано:** `cartByStore` / `favoritesByStore` в zustand persist; сервер даёт read-model
(`storefront_cart_items_read`) для реконсиляции; checkout не доверяет локальным ценам.
**Почему:** мгновенный UI без серверного CRUD корзины; серверная истина остаётся за inventory и
ценами (D10). Перенос в БД — optional future (`16`).
**Отвергнуто:** серверные carts/cart_items в MVP.

### D15. Storefront-чтение — security definer RPC-проекции

**Выбрано:** покупатель читает витрину через `storefront_*_read` (home context/products, catalog,
cart items, product detail, reviews/questions, favorite products), а не прямыми select к таблицам.
**Почему:** одна контролируемая граница публичной проекции (без внутренних полей), меньше риск
утечки, прямой путь к RLS.
**Отвергнуто:** прямые `select('*')` с anon-ключом (`15` — public store boundary).

### D16. Заказы (чтение и действия) — authenticated edge + RPC

**Выбрано:** `order-queries`/`order-actions` проверяют сессию, работают через admin-клиент; SQL-RPC
заказов `REVOKE`-нуты у `anon` (`0048`).
**Почему:** PII покупателя и снимки заказов не должны читаться публичным ключом; прямая лата
дыры `anon → order_list_read` была закрыта в `24` (ORD-HARDEN).
**Отвергнуто:** публичные order-RPC (даже «по opaque id»).

### D17. Уведомления — best-effort, opt-in, серверный гейт

**Выбрано:** opt-in на экране успеха после заказа (повторяемый до согласия); факт хранится в
`telegram_identities.notifications_enabled`; уведомления покупателю отправляются только при
`true`; продавцу — всегда; сбой уведомления никогда не откатывает заказ.
**Почему:** Telegram-разрешение требует действия человека и не должно гонять checkout (старый
1200 мс deadline проигрывался и оставлял согласие невозможным).
**Отвергнуто:** запрос разрешения до создания заказа; блокирующая отправка.

### D18. i18n: ровно ru/en

**Выбрано:** язык интерфейса (`AppLanguage`) — пользовательская настройка; язык магазина
(`store.language`) — дефолт витрины; разрешение: выбор пользователя → язык магазина → язык
Telegram → `ru`.
**Почему:** два реальных рынка; i18n-ресурсы позволяют добавить язык позже без переписывания UI
(§7); «полная localization platform» — out of scope.
**Отвергнуто:** автоперевод контента продавца; per-store UI-темы.

### D19. Deep links: opaque public IDs

**Выбрано:** витрина — `t.me/<bot>/<app>?startapp=shop_<public_id>`; товар —
`prod_<public_id>_<product_id>`; `store_<id>` (внутренний id) — legacy-чтение.
**Почему:** публичная ссылка не должна раскрывать последовательные ID; товарный deep link даёт
прямой вход из шаринга.
**Отвергнуто:** sequential ID в ссылках, slug в MVP.

### D20. Seller contact — вручную задаваемый `support_handle`

**Выбрано:** продавец сам задаёт @handle/контакт; автоподстановки его личного username нет.
**Почему:** контакт может быть менеджером/ботом, а личный username не должен «утекать» без выбора
продавца; есть явная кнопка подстановки своего.
**Отвергнуто:** автоматический контакт = Telegram продавца.

### D21. Список магазинов покупателя — на сервере

**Выбрано:** `public.buyer_store_visits` (store, buyer, first/last visit, count); пишется edge
`store-visit` при каждом открытии витрины; читается app (`buyer-stores`) и Buyer Bot
(`buyer_store_list_read`).
**Почему:** «Open App» без deep-link должен куда-то вести, а WebView-localStorage не делится
между точками входа; заодно продавец получает счётчик посетителей.
**Отвергнуто:** только localStorage; расширение orders-таблицы под «посещённые».

### D22. Миграции — номерные + собственный трекинг

**Выбрано:** `migrations/NNNN_name.sql`, применённые фиксируются в `public.schema_migrations`,
проверки `npm run migrations:check` / `migrations:record`.
**Почему:** InsForge CLI `db migrations` требует timestamp-имён и не умеет backfill — ретрофит
существующих миграций невозможен без массового переименования; свой трекер даёт детерминизм и
ловит дубли/пропуски (`0033` был дублем `0030`).
**Отвергнуто:** timestamp-миграции InsForge CLI.

### D23. RLS через платформенный access-JWT (ADR-C, JWT-мост)

**Выбрано:** edge `telegram-auth` дополнительно выпускает платформенный RS256 access-JWT
(`sub = users.id`, `role = authenticated`), клиент кладёт его в SDK (`setAccessToken`); RLS
опирается на `auth.uid()`. Мутации — только через edge (роль `project_admin` обходит RLS),
публичное покупательское чтение — `storefront_*` (`security definer`). Полная модель, матрица
политик и миграции — `27_SHOPPIS_RLS_PLAN.md`.
**Почему:** кастомная HMAC-сессия не видна PostgREST; JWT-мост даёт настоящие per-user политики,
закрывает realtime-каналы и Storage владельческим скоупом, не требуя переноса seller-чтений за edge.
**Отвергнуто:** вариант A (RLS = deny-all + всё за edge — нет granularity, realtime/storage открыты);
вариант B (полный маппинг Telegram → InsForge Auth — крупный auth-рефакторинг).
**Реализовано:** `0062`–`0068` (2026-10-15); гейт перед продом закрыт. Прежняя формулировка
(«RLS отложен до гейта») устарела.

### D24. Realtime заказов — через InsForge realtime + инвалидация React Query

**Выбрано:** `orders_realtime` (`0047`); события меняют только server state React Query
(`useOrdersRealtime`), не Zustand.
**Почему:** список заказов обязан сам обновляться при новом заказе/смене статуса, но источник
истины — сервер; realtime-канал ускоряет, а не заменяет RPC-чтение (принятые риски — `24`).
**Отвергнуто:** polling по таймеру; хранение заказов в Zustand.
