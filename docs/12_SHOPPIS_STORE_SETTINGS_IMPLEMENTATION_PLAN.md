# SHOPPIS — STORE SETTINGS IMPLEMENTATION PLAN

**Version:** 0.1
**Дата:** 2026-09-30
**Роль:** порядок реализации блока «Настройки магазина» (вертикальные срезы S-00 … S-10):
контракты, backend-границы, application-порты, UI, тесты и критерии закрытия каждого этапа.
**Статус:** рабочий engineering-документ; ведётся по фактическому состоянию `main`.

**Связанные документы:**
- `10_SHOPPIS_STORE_SETTINGS_PLAN.md` — ЧТО и UX (product/UX specification).
- `01 … CONSTITUTION` — принципы и non-negotiable rules.
- `02 … PRODUCT_SPEC` — поведение продукта (`§13` состояния, `§14` контакт, `§17` навигация).
- `03 … DOMAIN_DATABASE` — модель и инварианты (`§3` Shop, `§23` authorization, `§26` public IDs).
- `04 … TECHNICAL_SPEC` — backend boundaries (`§3`), state (`§10`), security (`§12`).
- `05 … IMPLEMENTATION_PLAN` — правило «одна ограниченная задача».
- `11 … HARDENING_BACKLOG` — RLS отложен как отдельный gate.

> Разделение ответственности документации: **`10` — ЧТО должно быть; `12` — КАК мы это реализуем.**
> При конфликте `10` и кода источник истины для схемы/поведения — `02/03/04`, для реализации — этот документ.

---

## 1. Назначение

Зафиксировать единый процесс разработки настроек магазина, чтобы:
- каждый срез шёл полным вертикальным циклом, а не «сначала весь UI»;
- backend authorization существовал до включения RLS;
- у каждого этапа были явные файлы, тесты и критерии закрытия;
- можно было ссылаться на этот документ при постановке задач opencode.

Главное правило блока:

> **Каждая функция проходит полный вертикальный цикл: контракт → backend → application → UI → tests → manual LOCAL → TELEGRAM → только потом следующая функция.**

```
SPEC → Domain/Contract → Backend authorization + mutation → Application port/service
     → UI block → Tests → LOCAL VERIFIED → TELEGRAM VERIFIED → commit → следующий блок
```

---

## 2. Исходное состояние (проверено на `main`)

| Элемент | Фактически сейчас |
|---|---|
| `SellerSettingsView` | read-only заглушка; читает `currentStore`, показывает баннер/название/валюту/язык/контакт |
| Роут `/seller/settings` | зарегистрирован, гард `storeId` (`src/router.tsx:90`) |
| `Store` | `id, ownerUserId, ownerTelegramId, name, description, logoUrl, bannerUrl, supportHandle, currencyCode, currencySymbol, language, status, publicId, createdAt` (`src/domain/models/store.ts`) |
| `StoreStatus` | уже `'ACTIVE' \| 'PAUSED'` |
| `StoreCurrency` | `'USD' \| 'RUB' \| 'BYN'` (EUR нет) |
| `StoreLanguage` | `'ru' \| 'en'` |
| `StoreProfilePatch` | есть, но включает `description/logoUrl/currencySymbol` (`src/application/contracts/store.ts`) |
| `StoreRepository.updateStoreProfile()` | прямой SDK-update `stores`; мёртвый код — **удалён в S-01** |
| Мутации каталога | `catalog-actions` (edge) → PL/pgSQL `*.atomic` (`migrations/0011`), `actor_user_id` из сессии |
| Checkout PAUSED | серверный guard `STORE_PAUSED` уже есть в `create_order_atomic` (`migrations/0004:76`) |
| Storage | `uploadStoreBanner` → `compressImage` (1024, q0.78) → публичный бакет |
| Сессия | `sessionToken` (HMAC) в `auth-slice`; `serverUser.username` доступен и в prod, и в dev |
| Тесты | Vitest, `environment: node`, `include: src/**/*.{test,spec}.{ts,tsx}`; jsdom / @testing-library отсутствуют |
| БД `stores` (0 строк) | есть `support_handle` **и** legacy `seller_contact`; `status`, `public_id` (unique), `updated_at`; `rlsEnabled: false` |

---

## 3. Расхождения `10` ↔ код (закрываются S-00)

| В `10` | Факт кода/БД | Решение |
|---|---|---|
| `is_active` (boolean) | `status = ACTIVE/PAUSED` | канон — `status`; `10` правится |
| `telegram_contact` | `support_handle` (+ legacy `seller_contact`) | канон — `support_handle`; `10`/`03` правятся |
| `currency` c EUR | `StoreCurrency = USD/RUB/BYN` | канон — домен; `10` правится |
| `/store/[store_id]` | opaque `public_id` (`03 §26`) | ссылка по `public_id`; `10` правится |
| `banner_url`, `stores.name`, `language` | есть | без изменений |
| локальные partial saves | нет | реализуем (S-02+) |
| status mutation | нет | реализуем (S-05) |
| buyer storefront | placeholder | отдельный срез (S-08) |
| QR | нет | отложено (S-10) |
| settings tests | практически нет | L1–L3 (см. §8) |
| `10 §4` «шаги реализации» | — | удалить; техническое — в этом документе |

---

## 4. Зафиксированная модель Settings (Contract freeze)

### 4.1 Domain

Без изменений — `src/domain/models/store.ts`:

```ts
type StoreStatus   = 'ACTIVE' | 'PAUSED';
type StoreCurrency = 'USD' | 'RUB' | 'BYN';
type StoreLanguage = 'ru' | 'en';

interface Store {
  id; ownerUserId; ownerTelegramId;
  name; description; logoUrl; bannerUrl;
  supportHandle;               // общий контакт (продавец / менеджер / бот), не обязательно личный
  currencyCode; currencySymbol;
  language; status;
  publicId;                   // opaque публичный идентификатор
  createdAt;
}
```

### 4.2 Контракты (per-block)

Профиль (persisted state) обновляется **частично**, только полями своего блока. Статус — отдельная
операционная операция, не смешивается с profile patch.

```ts
// src/application/contracts/store.ts
interface StoreIdentityPatch     { name?: string; bannerUrl?: string; }
interface StoreLocalizationPatch { currency?: StoreCurrency; language?: StoreLanguage; }
interface StoreContactPatch      { supportHandle?: string; }

type StoreProfilePatch = StoreIdentityPatch & StoreLocalizationPatch & StoreContactPatch;
```

Правила:
- пустой patch (`{}`) — отклоняется backend (`EMPTY_PATCH`);
- `currencySymbol` **не** приходит от клиента — выводится из `currency` (domain/backend);
- `description`, `logoUrl` в MVP не редактируются (колонки в БД остаются, контрактом не выставляются);
- `status` меняется только action `update-status`.

### 4.3 Contact handle (семантика)

`supportHandle` — общий контакт для связи: личная ссылка продавца, контакт менеджера или ссылка
на диалог с ботом. Хранится как чистый username (`john`), который UI превращает в `https://t.me/john`.
В `CommunicationBlock` — опциональная кнопка «Подставить мой @username» (берёт `serverUser.username`,
не автоматически). Пустой `serverUser.username` → кнопка неактивна.

Normalization — pure-функция `normalizeTelegramUsername()` (`src/domain/rules/store-contact-rules.ts`):
принимает `@john`, `john`, `t.me/john`, `https://t.me/john` → `john`; мусор (`https://google.com`,
`@john name`, `t.me/`) → invalid.

---

## 5. Backend boundary

### 5.1 Принцип

Мутации настроек идут **только** через серверную границу. Клиент не передаёт `ownerUserId` — владелец
определяется сессией. Это критично, пока RLS выключен (`11 §S1`). RLS не включаем — отдельный gate.

```
READ:      storeRepository → stores (InsForge SDK)
MUTATION:  store-settings-api → store-actions (edge) → verifySession()
           → stores_assert_owner(store_id, session.uid)
           → store_update_profile_atomic / store_set_status_atomic (PL/pgSQL)
           → stores update → mapStore
```

### 5.2 Actions

| Action | Payload | Результат |
|---|---|---|
| `update-profile` | `{ storeId, patch: StoreProfilePatch }` | `{ success, store }` |
| `update-status` | `{ storeId, status: StoreStatus }` | `{ success, store }` |

`storeId` — внутренний идентификатор; владение всё равно проверяется на сервере. `actor_user_id`
берётся только из `session.uid`.

### 5.3 Error codes → HTTP

| Код | HTTP |
|---|---|
| `FORBIDDEN` | 403 |
| `STORE_NOT_FOUND` | 404 |
| `NAME_REQUIRED` | 400 |
| `INVALID_CURRENCY` | 400 |
| `INVALID_LANGUAGE` | 400 |
| `INVALID_STATUS` | 400 |
| `EMPTY_PATCH` | 400 |
| `UNKNOWN_ACTION` | 400 |

Маппинг — через `_shared/errors.js` (`errorToResponse`), как в `catalog-actions`.

### 5.4 DEV-путь (для LOCAL VERIFIED)

В браузере вне Telegram `sessionToken === null`. По аналогии с каталогом (`11`, dev-fallback) и
`store-repository.dev.ts`: при отсутствии токена и `DEV_AUTH_MODE === true` используется
`store-settings-api.dev.ts` (прямой SDK-update). В production `DEV_AUTH_MODE === false` → путь всегда
`store-actions`. DEV-путь — явный технический долг, не production-контур.

---

## 6. Контракты, порты и файловая карта

```
domain/
  models/store.ts                         (без изменений)
  rules/store-settings-rules.ts           validateStoreName / isValidCurrency / isValidLanguage / isValidStatus / isProfilePatchEmpty
  rules/store-settings-rules.test.ts
  rules/store-contact-rules.ts            normalizeTelegramUsername
  rules/store-contact-rules.test.ts

application/
  contracts/store.ts                      StoreIdentity/Localization/Contact patches, StoreStatusAction
  ports/apis.ts                           + StoreSettingsApi
    interface StoreSettingsApi {
      updateProfile(token, storeId, patch): Promise<Store>;
      updateStatus(token, storeId, status): Promise<Store>;
    }
  composition/container.ts                + storeSettingsApi

infrastructure/
  functions/store-settings-api.ts         invokeFunction('store-actions') + mapStore
  functions/store-settings-api.dev.ts     DEV_AUTH_MODE fallback (прямой SDK)
  functions/store-settings-api.test.ts    L2 contract tests
  repositories/store-repository.ts        updateStoreProfile удалён (S-01)

edge-functions/
  store-actions.js                        edge-диспетчер (session → rpc)
  (build)                                 scripts/build-edge.mjs

migrations/
  0012_store_settings_atomic.sql          stores_assert_owner + store_update_profile_atomic (+ store_set_status_atomic в S-05)

presentation/seller/settings/
  StoreIdentityBlock.tsx (+ .test.tsx при L3)
  LocalizationBlock.tsx (+ .test.tsx)
  StoreStatusBlock.tsx   (+ .test.tsx)
  CommunicationBlock.tsx (+ .test.tsx)
  SharePreviewBlock.tsx  (+ .test.tsx)
  components/BlockSaveButton.tsx         выделяется в S-03, когда паттерн уже проявлен
  components/BannerUploader.tsx
  components/SegmentedControl.tsx
```

> Примечание: API-порты вызовов edge-функций по конвенции живут в `application/ports/apis.ts`
> (как `AuthApi/ShopApi/OrderApi`). Store settings — не исключение.

`application` не импортирует `infrastructure`; presentation не импортирует `infrastructure`.
Мутации, обновляющие `currentStore`, — методы `auth-slice` (`updateStoreProfile`, `updateStoreStatus`),
т.к. `currentStore` принадлежит этому слайсу (как `createStore`). Zustand — источник *persisted*
store, но **не** источника draft-состояния блока.

---

## 7. Состояние UI-блока

Каждый редактируемый блок проходит state machine:

```
clean ──edit──▶ dirty ──save──▶ saving ──ok──▶ clean(saved)
                                │
                                └──error──▶ dirty(error)   // draft сохраняется
```

- **persisted state** — `currentStore` (Zustand, единственный источник для «эталона»);
- **draft state** — локально в компоненте (`useState`), не пишется в БД до Save;
- `isDirty` — targeted-сравнение полей блока (не глубокое сравнение всего Store);
- успех → backend возвращает `Store` → обновляем `currentStore` → **draft сбрасывается**;
- ошибка → draft **остаётся**, показываем inline-ошибку и повтор-действие;
- повторный клик при `saving` — заблокирован (mutation не дублируется);
- read-only блок (`SharePreviewBlock`) не имеет dirty/save.

---

## 8. Test matrix

Правило размещения: тесты **colocated** рядом с исходником (`foo.ts` / `foo.test.ts`),
без общей папки `/tests`.

| Уровень | Среда | Что покрывает |
|---|---|---|
| **L1 Pure** | Vitest `node` | `validateStoreName`, `isValidCurrency`, `isValidLanguage`, `isValidStatus`, `isProfilePatchEmpty`, `normalizeTelegramUsername` |
| **L2 API contract** | Vitest `node`, mock `functions-gateway` | `store-settings-api.test.ts`: camel↔snake, partial payload, action, error-codes, transport (эталон — `catalog-api.test.ts`) |
| **L3 Component** | Vitest `jsdom` + @testing-library/react | state machine блока: clean→dirty→saving→saved/error, partial payload, double-click, роли/недоступность |
| **L4 Manual/integration** | LOCAL + TELEGRAM | happy/failure, partial update, `ACTIVE↔PAUSED` и `STORE_PAUSED` в checkout |

Организационно:
- L1, L2 — покрываем с первых срезов;
- L3 — **активно** (S-03): `jsdom` + `@testing-library/react` (+ `jest-dom`, `user-event`), `src/test/setup.ts`, jsdom для `*.test.tsx` через `// @vitest-environment jsdom`;
- L4 — обязателен для каждого среза: `LOCAL VERIFIED` и `TELEGRAM VERIFIED` (принцип `00`).

**Не тестируем:** CSS/Tailwind классы, border-radius, длительности анимаций, glassmorphism, пиксельные смещения. Тестируем **поведение**.

---

## 9. Roadmap

Легенда статуса: `[ ]` не начато · `[~]` в работе · `[x]` готово.

### S-00 — Implementation Contract & Divergence Cleanup `[x]`
- **Тип:** документация. Код не менялся.
- **Файлы:** этот документ; `10` (переоформлен в UX-спеку, §4 убран); `02 §17`; `03 §3`; `00` (список документов).
- **Acceptance:** `12` создан; расхождения из §3 закрыты в `10/02/03`; единые имена (`status`, `support_handle`, `public_id`); `npm test`/`typecheck` зелёные. ✔

### S-01 — Contract freeze + Domain rules `[x]`
- **Цель:** финализировать контракты и чистые правила без backend/UI; убрать мёртвый код, мешавший контракту.
- **Файлы:** `application/contracts/store.ts` (per-block patches + `StoreStatusPatch`), `domain/rules/store-settings-rules.ts(+test)`, `domain/rules/store-contact-rules.ts(+test)`, удалён мёртвый `updateStoreProfile` (порт/репозиторий/composition).
- **Тесты (L1):** name (trim/empty-whitespace), currency, language, status, empty-patch; normalize contact (`@john`, `john`, `t.me/john`, `https://t.me/john`; мусор → invalid). 76 тестов зелёные (+14).
- **Acceptance:** редактируемые patch не содержат `description/logoUrl/currencySymbol`; `updateStoreProfile` удалён; typecheck/build/lint зелёные. ✔
- **Verification:** `npm test`, `npm run typecheck`, `npm run build`, `npm run lint`.

### S-02 — Backend profile mutation `[x]`
- **Цель:** серверная граница для `update-profile` + клиентский API.
- **Файлы:** `migrations/0012_store_settings_atomic.sql` (`stores_assert_owner`, `store_update_profile_atomic`), `edge-functions/store-actions.js`, `infrastructure/functions/store-settings-api.ts(+dev,+test)`, `application/ports/apis.ts`, `composition-root.ts`, `application/composition/container.ts`, `auth-slice` (`updateStoreProfile`).
- **Business rules:** partial update (трогаем только переданные поля); `name` trim + non-empty; currency/language из домена; `currency_symbol` выводится из `currency`; empty patch → `EMPTY_PATCH`.
- **Тесты (L2):** только переданные поля уходят в payload; action/endpoint; error-codes; transport. 83 теста зелёные (+7).
- **Acceptance:** owner → success; unauthenticated → 401; foreign store → FORBIDDEN; empty name → `NAME_REQUIRED`; invalid currency → `INVALID_CURRENCY`; partial patch не меняет прочие поля; empty patch → `EMPTY_PATCH`. ✔
- **Verification:** миграция применена; `store-actions` задеплоена (401 без сессии); DB-пробы прошли (owner/foreign/partial/все коды, данные восстановлены); `npm test`, `typecheck`, `build`, `lint`. ✔
- **Осталось (L4):** ручная проверка через UI — после S-03 (сессия берётся из реального Telegram Mini App).

### S-03 — Identity block (name + banner) `[x]`
- **Цель:** первый реальный блок + выделение `BlockSaveButton`.
- **Test infra (enabling):** добавлены `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`; `src/test/setup.ts` + `setupFiles`; jsdom включается docblock'ом `// @vitest-environment jsdom`.
- **Файлы:** `presentation/seller/settings/StoreIdentityBlock.tsx`, `components/BannerUploader.tsx`, `components/BlockSaveButton.tsx`, интеграция в `SellerSettingsView`; блок prop-driven (`store`/`onSave`/`onUploadBanner`) — без знания про InsForge.
- **Тесты (L3):** initial values; edit name/banner → dirty; нет изменений → нет Save; save → API с `{name}`/`{bannerUrl}` (только изменённые поля); revert → Save исчезает; success → чистый; error → draft сохранён; double-click → один вызов; пустое имя → ошибка. 91 тест зелёный (+8).
- **Acceptance:** на сервер уходят только изменённые поля блока; ошибки не теряют draft; повторный клик блокируется. ✔
- **Verification:** `npm test`, `typecheck`, `build`, `lint`. ✔
- **LOCAL VERIFIED / TELEGRAM VERIFIED:** подтверждено владельцем — сохранение названия/баннера доходит до БД.
- **Побочный фикс (в рамках среза):** `useScrollToTop` (`presentation/shared/hooks`) — при смене вкладки/маршрута контейнер `.scrollable-content` открывается сверху; подключён в `SellerLayout` и `BuyerLayout`.

### S-04 — Localization block `[x]`
- **Цель:** валюта + язык через `SegmentedControl`.
- **Файлы:** `LocalizationBlock.tsx`, `components/SegmentedControl.tsx` (доступность: `role="radiogroup"`/`role="radio"`), интеграция в `SellerSettingsView`.
- **Тесты (L3):** initial; смена currency/language → dirty; payload только изменённых полей (`{currency}` / `{language}` / оба); revert → Save исчезает; failure preserves + alert; double save blocked. 98 тестов зелёный (+7).
- **Acceptance:** опции валют/языков берутся из домена (без EUR); на сервер уходят только изменённые поля. ✔
- **Verification:** `npm test`, `typecheck`, `build`, `lint`. ✔
- **LOCAL VERIFIED / TELEGRAM VERIFIED:** подтверждено владельцем — переключение валюты/языка доходит до БД и отражается в карточке товара.

### S-05 — Status block (backend + UI) `[x]`
- **Цель:** операционный статус `ACTIVE ↔ PAUSED`.
- **Файлы:** `store-actions.js` (+`update-status`), `migrations/0012` (`store_set_status_atomic`), `store-settings-api.ts` + `.dev.ts` (+`updateStatus`/`updateStoreStatusDev`), `application/ports/apis.ts` (+`updateStatus`), `auth-slice` (`updateStoreStatus`), `StoreStatusBlock.tsx`, интеграция в `SellerSettingsView`.
- **Business rules:** `INVALID_STATUS` вне домена; переход `PAUSED` — только после явного подтверждения; `ACTIVE` — без подтверждения.
- **Тесты:** L2 (`update-status` payload/error, +2); L3 (переключатель, confirm-панель, отмена, ошибка, чистое состояние после успеха, +7). 107 тестов зелёный.
- **Acceptance:** статус меняется в БД; полный доступ продавца в `PAUSED`; соблюдается серверный guard `STORE_PAUSED` в checkout. ✔
- **Verification:** миграция применена; `store-actions` передеплоена; DB-пробы (owner→PAUSED, foreign→`FORBIDDEN`, `DISABLED`→`INVALID_STATUS`, восстановлено в ACTIVE); `npm test`, `typecheck`, `build`, `lint`. ✔
- **Осталось (L4):** ручная проверка LOCAL + TELEGRAM (пауза/активация, отражение в БД и на витрине) — за владельцем.

### S-06 — Communication block `[x]`
- **Цель:** контакт для связи (generic) + нормализация + prefill.
- **Файлы:** `CommunicationBlock.tsx` (иконка Telegram, предпросмотр `t.me/{username}`), `components/BlockSaveButton` (reuse); `store-contact-rules.ts` (S-01). Backend (`support_handle`) уже поддержан в S-02 — изменений нет.
- **Поведение:** принимает `@username`/`t.me/…`/`username`; на blur/save → чистый username; пустое поле = удаление контакта; кнопка «Подставить мой @{username}» (из `serverUser.username`, не автоматически); невалидный ввод → inline-ошибка, Save не показывается; **крестик в поле** очищает контакт; **кнопка «Копировать»** кладёт `https://t.me/{username}` в буфер (с индикацией «Скопировано»).
- **Тесты:** L1 (кейсы нормализации, S-01), L3 (нормализация на blur, предпросмотр, prefill, очистка, копирование, ошибка, +12). 119 тестов зелёный.
- **Acceptance:** мусор отклоняется; пустой `serverUser.username` → кнопка недоступна; на сервер уходит только `supportHandle`. ✔
- **Verification:** `npm test`, `typecheck`, `build`, `lint`. ✔
- **LOCAL VERIFIED / TELEGRAM VERIFIED:** подтверждено владельцем — контакт сохраняется, ссылка `t.me/{username}` кликабельна и открывает чат; крестик очистки и копирование работают.

### S-07 — Share / Public link (read-only) `[x]`
- **Цель:** ссылка на витрину по `public_id` + копирование.
- **Файлы:** `domain/rules/storefront-link.ts(+test)` (единый билдер + парсер, префикс `shop_`), `application/hooks/useStorefrontLink.ts`, порт `TelegramPort` (+`getBuyerBotUsername`/`getBuyerAppShortname`), `SharePreviewBlock.tsx`, интеграция в `SellerSettingsView`; `telegram-share.buildBuyerLink` приведён к domain-правилу (было `store_<id>`, стало `shop_<public_id>`).
- **Поведение:** read-only ссылка — прямой deep link в Mini App `https://t.me/<bot>/<app>?startapp=shop_<public_id>` (первый шаг покупателя — приложение, не чат бота; `/<app>` обязателен), кликабельна, копирование с индикацией «Скопировано»; Preview-кнопка неактивна до S-08; **нет** dirty/save.
- **Тесты:** L1 (билдер/парсер, +5), L3 (ссылка, копирование, disabled/enabled preview, отсутствие Save, +5). 129 тестов зелёный.
- **Acceptance:** ссылка строится из `currentStore.publicId`; внутренний UUID/`store_` наружу не отдаётся. ✔
- **Verification:** `npm test`, `typecheck`, `build`, `lint`. ✔
- **L4:** работоспособность ссылки проверяется вместе с S-08 (витрина + резолв `public_id`).
- **S-08 выполнил:** `useAppInit` переключён с `store_` на `shop_<public_id>` + резолв `public_id → store`.

### S-08 — Buyer storefront resolution + pause screen `[x]`
- **Цель:** открыть витрину по deep link `shop_<public_id>` и показать статус-гейт (cross-feature, часть `05` slice 8).
- **Объём (bounded):** резолв витрины + шапка магазина + экран `PAUSED` + связь. Полноценный каталог/поиск/корзина — отдельный слой buyer storefront, вне этого среза.
- **Файлы:** `StoreRepository.fetchStoreByPublicId` (порт+репо), `auth-slice` (`viewedStore`, `loadBuyerStore`), `useAppInit` (`shop_<public_id>` → резолв), `presentation/buyer/components/StorefrontView.tsx`, `HomeView.tsx`.
- **Поведение:** deep link `t.me/<bot>/<app>?startapp=shop_<public_id>` → `public_id → store`; `ACTIVE` — витрина (баннер/название/описание/связь); `PAUSED` — «Магазин временно закрыт»; магазин не найден — отдельное состояние; заказы блокируются серверным `STORE_PAUSED`.
- **Тесты:** L1 (`storefront-link`), L3 (`StorefrontView`: loading/notfound/active/paused/contact, +6). 134 теста зелёный.
- **Acceptance:** ссылка из S-07 открывает приложение и показывает магазин; `PAUSED` показывает экран паузы; seller продолжает работать в `PAUSED`. ✔
- **Verification:** `npm test`, `typecheck`, `build`, `lint`. ✔
- **Осталось (L4):** ручная проверка ссылки LOCAL + TELEGRAM — за владельцем.
- **Далее (вне S-08):** каталог витрины (категории/товары/поиск/корзина) — расширение buyer storefront.

### S-09 — Preview enable `[ ]`
- **Цель:** включить кнопку «Предпросмотр» из S-07 после появления S-08.
- **Acceptance:** preview ведёт на реальную витрину (`public_id`).
- **Verification:** LOCAL + TELEGRAM.

### S-10 — QR + Settings regression `[ ]`
- **Цель:** QR-код ссылки (отложен) и сквозная регрессия настроек.
- **Примечание:** QR не блокирует остальные срезы; у qr-библиотеки нет в стеке — решение отдельным ADR (внешний генератор или лёгкая зависимость).
- **Acceptance:** регрессия всех блоков (partial saves не мешают друг другу); docs синхронизированы.
- **Verification:** LOCAL + TELEGRAM.

---

## 10. Definition of Done (для каждого среза)

```
[ ] TypeScript проходит (npm run typecheck)
[ ] npm test зелёный
[ ] npm run build проходит
[ ] добавлены релевантные тесты (L1/L2/L3 по срезу)
[ ] backend validation есть
[ ] authorization есть
[ ] loading state
[ ] error state
[ ] success state
[ ] повторный клик обработан
[ ] partial update проверен
[ ] нет изменений в посторонних файлах
[ ] LOCAL VERIFIED
[ ] TELEGRAM VERIFIED
[ ] документация обновлена
[ ] commit создан
```

Для критических операций (S-02, S-05) дополнительно:
```
[ ] foreign-store test
[ ] unauthorized test
[ ] (где применимо) повторный/идемпотентный вызов
```

---

## 11. Явно НЕ делаем в MVP

- RLS и закрытие anon-доступа — отдельный hardening gate (`11 §S1`), не этот блок.
- Редактирование `description` и `logoUrl` в настройках (колонки в БД остаются).
- Human-readable slug магазина (только opaque `public_id`, `03 §26`).
- Multi-shop UI (БД уже поддерживает несколько).
- Серверная валидация/derivatives изображений (`04 §6` — future work).
- Новые E2E-фреймворки (Playwright/Cypress) — только Vitest + ручные LOCAL/TELEGRAM.
- QR до S-10.
- Рефакторинг несвязанного кода, преждевременные абстракции.

---

## 12. Шаблон задачи (opencode)

```
TASK
S-0X Store Settings — <название>

OBJECTIVE
<одно предложение>

READ FIRST
- docs/01, docs/03, docs/04, docs/10, docs/12

FILES TO CHANGE
- <точные пути>

FILES NOT TO CHANGE
- <точные пути>

IMPLEMENTATION
1. …
2. …
3. …

BUSINESS RULES
- …

TESTS
1. …
2. …
3. …

ACCEPTANCE CRITERIA
[ ] …
[ ] …

VERIFICATION
npm test
npm run typecheck
npm run build

MANUAL
LOCAL VERIFIED
TELEGRAM VERIFIED

DO NOT
- refactor unrelated code
- modify RLS
- change catalog behavior
- create premature abstractions
```
