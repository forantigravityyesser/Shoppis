# SHOPPIS — HARDENING BACKLOG

**Назначение:** отложенные пункты архитектурного hardening, которые не входили в текущий заход.
**Дата:** 2026-09-29
**Связанные документы:** `08_SHOPPIS_DOCS_CODE_DIVERGENCE_v0.3.md`, `04_SHOPPIS_TECHNICAL_SPEC_v0.3.md`

Severity: **S1** критично · **S2** высоко · **S3** средне · **S4** косметика.

---

## Сделано (закрыто)

- Этап 1 — гигиена: удалены 21 пустой файл-заглушка, пустые barrel, мёртвый `application/i18n.ts`; добавлены npm-скрипты.
- Этап 2 — tooling: ESLint (flat) + Prettier + Vitest; `@types/react(-dom)` → 18; `noUnusedLocals/noUnusedParameters` включены; TS понижен `7.0.2 → 6.0.3`.
- Этап 3 — domain: `inventory-view.ts` перенесён в `application/read-models/`; `ProductStatusErrorCode/Result` перенесены в `application/contracts/product-status.ts`, из domain убраны `FORBIDDEN`/`NETWORK`.
- Этап 4 — edge DRY: `edge-functions/_shared/{env,http,auth,telegram,errors}.js`; `telegram-auth`, `shop-create`, `process-checkout`, `order-actions`, `telegram-notify` переведены на общий код; сборка `npm run build:edge` (esbuild → `edge-functions/.dist/`), 4 функции передеплоены, рантайм и логи проверены.
- Этап 5 — порты/DIP: `application/ports/*` + `application/contracts/*`; `application/composition/container.ts` (ручной DI); `src/composition-root.ts` собирает реализации и вызывается первым в `main.tsx`. `application` больше не импортирует `infrastructure` (проверено grep + tsc).
- Этап 7 — тесты: Vitest; 55 тестов на domain (`product/inventory/order/cart/category-rules`), application (`inventory-mappers`) и infrastructure (`telegram-share`). `npm test` зелёный.
- Этап 8 — **атомарный каталог**: миграция `0011_catalog_atomic.sql` (7 `security definer` функций: `product_create_atomic`, `product_update_atomic` с неразрушающим diff вариантов, `variant_create_atomic`, `product_set_status_atomic`, `product_delete_atomic`, `category_delete_atomic`, `catalog_assert_store_owner`); edge-диспетчер `catalog-actions` (session → RPC, `actor_user_id` только из сессии); фронт-мутации каталога переведены на него через `src/infrastructure/functions/catalog-api.ts` (порты/репозитории/слайсы прокидывают `sessionToken`, dev-fallback на прямой SDK сохранён). Тесты `catalog-api` (+7, всего 62).
- Notifications/checkout (переделано 2026-10-05): `requestMessagesAccess` — best-effort с длинным safety-дедлайном 60 000 ms (никогда не бросает и не виснет; прежние 1200 ms не давали человеку нажать «Разрешить»). Разрешение запрашивается **на экране успеха по тапу** (`CheckoutSuccess` → `useCheckout.enableNotifications(orderId)`), после создания заказа: отказ/таймаут не влияют на заказ и не блокируют повторный запрос. Согласие фиксируется на сервере (`notifications-actions` → `telegram_identities.notifications_enabled`) с **досылом** «Заказ принят» по `orderId`; гейт в `process-checkout` и `order-actions`. Контракт порта `TelegramPort.requestMessagesAccess` — совещательный. Тесты: `telegram-share.test.ts`, `notification-api.test.ts`, `useCheckout.test.tsx`, `CheckoutSuccess.test.tsx`.

---

## Приоритизация (что и когда)

Ничего из оставшегося **не блокирует текущую разработку** — можно продолжать фичи.

1. **Обязательно до запуска / реальных пользователей → RLS + закрытие anon-доступа (этап 6).**
   Сейчас риск низкий: данные тестовые, заказов 0, PII нет. Но anon-ключ публичен (в бандле), поэтому без RLS БД открыта на чтение и частично на запись. Это гейт перед продом, не срочно сегодня.
2. **Дёшево — сделано в этом заходе:** проверка `DEV_AUTH_MODE` для прод-сборки; разбор `npm audit`. Результаты ниже.
3. **Перед первыми реальными заказами:** критические SQL-тесты (идемпотентность checkout, гонка за последним стоком stock=1, RPC-переходы, инварианты инвентаря). _(Перенесено и детализировано в `21` (commerce hardening): Test 1–9, этапы `CART-HARDEN-01…12`.)_
4. **Потом / оппортунистически:** 5× `set-state-in-effect` (seller-inventory ×4 + `CatalogFilterSheet`), 3× `react-refresh`, DRY в ботах, `window.Telegram` в `useAppInit`, CSS-чистка, `toCatalogFields`. _(Inventory-часть запланирована в `20`: `INV-HARDEN-01` — `toCatalogFields`, `INV-HARDEN-08` — lint; bulk social summary и split CSS — deferred с триггером.)_
5. **Продуктовый пробел (не аудит):** экраны покупателя (`return null`) — это roadmap, а не hardening.

### Статус дешёвого захода (2026-09-29)

- `VITE_DEV_AUTH_MODE` не задан ни в `.env`, ни в `.env.example`, ни в `vercel.json`. В прод-сборке `import.meta.env.DEV === false` → `DEV_AUTH_MODE=false`. **Прод безопасен по умолчанию.** Единственное действие: убедиться, что в Vercel **не** выставлен `VITE_DEV_AUTH_MODE=true`.
- `npm audit fix` (safe) не устранил 5 high — см. раздел npm audit ниже.

---

## PD-R — Product Detail residual hardening (post-audit)

Точечный остаток по Product Detail после PD-H pass. Приоритеты: **P1** · **P2** · **P3**.
Связано: `14` (Product Detail), `16` (remaining work).

- **PD-R-01 (#11) — P1 (blocker) — DONE.** Галерея: `.pd-gallery__main img` в
  `src/presentation/buyer/product-detail-gallery.css` переведён на `object-fit: contain`
  (фото целиком, без обрезки; full = 4:5). Проблема: PD-H-04 был откатан (`git checkout`
  при починке кодировки в PD-H-05), затем сплит CSS «заморозил» `cover`. Добавлен
  regression-guard `product-detail-gallery.test.ts` (читает CSS-инвариант). Осталось —
  визуальная проверка владельцем на desktop/mobile.
- **PD-R-02 (#12) — P2 — DONE.** `useImageViewerGestures.resetGesture()` сбрасывает
  `pointers`/`pinch`/`pan`/`multiTouch`, но не сбрасывал `lastTap.current`: при быстром
  «tap A → смена фото → tap B» первый тап на новом фото мог попасть в старое окно
  `DOUBLE_TAP_MS` и дать ложный зум. Фикс: `lastTap.current = 0` в `resetGesture()` +
  regression-тест хука (`useImageViewerGestures.test.tsx`).
- **PD-R-03 (#14) — P2 — DONE.** `DetailsView.showCta = pathname === '/product/${id}'` не
  учитывал trailing slash (`/product/123/`), тогда как `isLayer` учитывал (`\/?$`). Фикс:
  единая нормализация пути (`pathname.replace(/\/+$/, '') || '/'`) на оба флага + тесты
  роутинга на trailing slash (`DetailsView.test.tsx`).
- **PD-R-04 (#13) — P3 — DONE.** Пинч зумил относительно центра изображения, а не точки
  между пальцами. Добавлена чистая `zoomToPoint()` (`image-viewer-gestures.ts`): точка под
  стартовым центром пальцев остаётся под текущим (центр считается от `getBoundingClientRect`
  медиа-контейнера). Использована в `useImageViewerGestures`; при `scale = startScale`
  сводится к прежнему панорамированию. Тесты: `image-viewer-gestures.test.ts`.
- **PD-R-05 (#15) — P3 — DEFERRED (закрывается вместе с S1/RLS, не отдельным шагом).**
  `p_viewer_user_id` всё ещё приходит с
  клиента, но только для UI-подсказок (`isOwn` / `viewerReview` / `canReview` / `canAsk`),
  **не** для авторизации (архитектурная security-проблема закрыта в PD-H-01). Целевое —
  actor из серверной сессии; делать вместе с RLS.

---

## S1 — RLS и backend-границы (этап 6, отложен)

- **Док:** `08 §1.9`, `04 §3`, `04 §12`, release gate `01 §9`.
- **Сейчас:** `rlsEnabled: false`, политик нет на всех таблицах. Чтения каталога/заказов/магазинов идут напрямую через PostgREST с anon-ключом; часть записей заказов — через `process-checkout`/`order-actions`, а **записи каталога с этапа 8 — через `catalog-actions` (+ атомарные RPC), actor из сессии**. Прямой anon-доступ к таблицам всё ещё открыт, поэтому RLS — по-прежнему гейт перед продом.
- **Блокер:** кастомная Telegram-сессия не распознаётся PostgREST, поэтому RLS не может опираться на identity.
- **Прогресс (этап 8):** мутации каталога уже вынесены за edge + RPC (вариант A частично). Остаётся перевести чтения и включить RLS.
- **Варианты:**
  - **A.** Все чтения/записи каталога/заказов/магазина перевести за edge-функции, затем включить RLS.
  - **B.** Смапить Telegram-identity → InsForge auth-user, включить RLS по `auth.uid()`.
- **Выход:** выбрать вариант (ADR), спроектировать политики public / buyer-private / seller-private.

---

## S2 — Application → Infrastructure (этап 5) — ЗАКРЫТО

- **Было:** слайсы и hooks импортировали конкретные `infrastructure/repositories/*`, `functions/*`, `storage/*`, `telegram/*`, `i18n/*`.
- **Стало:** `application/ports/*` (Product/Category/Store/OrderRepository, Storage, ImageUpload, Auth/Shop/Checkout/OrderApi, Identity, Telegram, Haptics, I18n) + `application/contracts/*`; реализации собираются в `src/composition-root.ts` и кладутся в контейнер (`application/composition/container.ts`). Слайсы/hooks резолвят зависимости через `deps()`. `ProductStatusError` перенесён в контракты.
- **Правило:** `application` не импортирует `infrastructure`; `presentation` не импортирует `infrastructure`.
- **Остаток:** `useAppInit` по-прежнему обращается к `window.Telegram.WebApp` напрямую для safe-area (bootstrap-код presentation-уровня).

## S2 — Остаток DRY в ботах

- `env` и `escapeHtml` по-прежнему локальны в `telegram-bot-buyer.js` / `telegram-bot-seller.js` (на backend не зарегистрированы).
- **Задача:** вынести в `_shared` при следующем касании ботов (требует их бандлинга).

## S2 — Тесты (этап 7) — базовый слой закрыт

- **Сделано:** Vitest настроен (`vitest.config.ts`, node-env). Покрыты domain-правила (`product`, `inventory`, `order`, `cart`, `category`), application-mapper (`inventory-mappers`) и infrastructure (`telegram-share`: allowed/cancelled/таймаут/reject/sync-throw) — 55 тестов.
- **Остаток (критический флоу, требует SQL/интеграции):** идемпотентность checkout, гонка за последним стоком (stock=1, 2 запроса → ровно один успех), переходы заказов на уровне RPC, инварианты инвентаря. `04 §15`. _(Детализация и план — `21` `CART-HARDEN-05`, §9 Test 1–9. **Закрыто:** harness `npm run commerce:harness`, 24/24; идемпотентность `0038`, item-contract `0039`.)_
- **Остаток (UI/слайсы):** ✅ **Сделано (2026-10-05, `20` INV-HARDEN-01):** `toCatalogFields`/`resolveCategoryId` вынесены в `application/rules/product-mapping.ts` (чистые, экспортированы) + тесты 4 комбинаций осей.

---

## S3 — react-hooks/set-state-in-effect (Inventory ×5)

Сброс состояния формы/индекса в `useEffect` — потенциально каскадные рендеры. Правило включено как `warn`.
Файлы (срез `npm run lint`, 2026-10-05):
- `src/presentation/seller/inventory/components/CategoryAddSheet.tsx:48`
- `src/presentation/seller/inventory/components/EditCategorySheet.tsx:56`
- `src/presentation/seller/inventory/components/ProductPreviewRow.tsx:38`
- `src/presentation/seller/inventory/product/AddVariantSheet.tsx:33`
- `src/presentation/seller/inventory/product/StockControlSheet.tsx:58`

**Задача:** перейти на `key`-remount или производное состояние (`useMemo`/derived) вместо setState в effect.
✅ **Сделано (2026-10-05, `20` INV-HARDEN-08):** Inventory-файлы переведены на `key`-remount/derived state,
`ProductForm` типы/хелпер → `product-form-values.ts`. `npm run lint` — **8 → 0 warnings** (0 errors);
дополнительно закрыты не-Inventory `main.tsx` (react-refresh) и `CatalogFilterSheet` (set-state).

## S3 — Проверка безопасности dev-пути — проверено

- `src/infrastructure/repositories/store-repository.dev.ts` + `DEV_AUTH_MODE` (`insforge/config.ts`) — путь mock-identity по telegram id.
- **Проверено:** `VITE_DEV_AUTH_MODE` не задан локально/в `.env.example`/`vercel.json`; в прод-сборке `import.meta.env.DEV=false`, значит `DEV_AUTH_MODE=false`. Прод безопасен по умолчанию.
- **Действие:** убедиться, что в Vercel нет `VITE_DEV_AUTH_MODE=true`.

## S3 — npm audit — разобрано, отложено

- **5 high** — все в `valibot` (транзитивно через `@telegram-apps/*`): ReDoS в `EMOJI_REGEX` (GHSA-vqpr-j7v3-hqw9) и `record()`/`flatten` (GHSA-5qjj-4xww-7phc).
- **Профиль риска:** клиентская валидация данных Telegram SDK, не серверная угроза; эксплуатация требует специально сформированного ввода. Практический риск низкий.
- **Фикс безопасно не применить:** `@telegram-apps/transformers@2.2.6` жёстко прибит к `valibot@1.0.0-beta.14`; `npm audit fix` не двигает, `--force`/override на `1.5.0` рискует сломать Telegram SDK (beta→major).
- **Решение:** не форсить. Пересмотреть, когда `@telegram-apps/*` поднимет версию valibot.

## S3 — Placeholder-экраны покупателя

- `HomeView`, `CartView`, `FavoritesView`, `OrdersView`, `AccountView`, `DetailsView`, `FloatingNavBar` — дюмми `return null`.
- **Задача:** реализовать (см. `08 §2.11`).

## S4 — react-refresh/only-export-components (3 предупреждения)

- `src/main.tsx:35`, `src/presentation/seller/components/ProductForm.tsx:48,92`.
- **Задача (опционально):** вынести компоненты/константы в отдельные файлы.

## S4 — Версии TypeScript / React

- TS зафиксирован на `^6.0.3`, т.к. `typescript-eslint` не поддерживает TS 7.0.
- **Задача:** при выходе поддержки TS ≥7.1 — обновить TS и `typescript-eslint`.
- React 18 + `@types/react@18`. При будущем апгрейде на React 19 — синхронно обновить типы и перепроверить `react-hooks`.

---

## S4 — Косметика CSS

- `src/presentation/styles/components.css` содержит секции под удалённые компоненты (например `ProductImageCarousel`).
- **Задача:** вычистить неиспользуемые CSS-секции при реализации UI.
