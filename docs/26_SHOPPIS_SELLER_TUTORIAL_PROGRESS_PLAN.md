# SHOPPIS — ОБУЧЕНИЕ ПРОДАВЦА, ЧЕК-ЛИСТ ПОДГОТОВКИ И ЦЕЛИ РАЗВИТИЯ — ТЕХНИЧЕСКИЙ ПЛАН

**Version:** 1.0
**Дата:** 2026-10-15
**Репозиторий:** `forantigravityyesser/Shoppis`
**Базовый срез кода:** `main` после сквозной ревизии набора `00`–`25` (коммит `4591beb`); текущая
миграция — `0056`.
**Источник:** внешний документ «Shoppis — технический аудит и поэтапная дорожная карта внедрения
онбординга и системы прогресса» (2026-10-15). Перенесён в формат проекта: план, этапы и контрольные
ворота сохранены; все места, где внешний документ не мог назвать конкретные файлы/таблицы/статусы,
адаптированы под фактический код — аудит выполнен в рамках этого переноса (Приложение A).
**Объект:** интерактивное обучение продавца (tutorial) после создания магазина; чек-лист подготовки
магазина и последовательные цели развития на «Главной» продавца (`/seller/dashboard`).
**Вне области:** изменения контура заказов (статусы, переходы, actions), изменения Seller Inventory
(`19`/`20`), маркетинговая аналитика/геймификация (achievements, кампании, награды), 5-я вкладка
нижней навигации, RLS как прод-гейт (`11 §S1`), push/in-app уведомления, изменения storefront-читателя
покупателя, новые языки сверх ru/en, изменения публичной витрины.

**Связанные документы:** `00` (индекс), `01` (Constitution, §10 — реестр решений D1–D24; новые
решения захода — §9), `02` (§17 — Seller App, онбординг создания магазина), `03` (§2–4 — identity/stores/
categories, §13–17 — orders), `04` (§4 edge/RPC, §9 storage, §11 security, §12 testing), `06`/`19`/`20`
(Inventory — статусы товаров, наличие, `held`), `11` (Hardening Backlog), `16` (Remaining Work),
`22`/`24` (Orders — read-контур, реальные статусы и исходы), `25` (Seller Dashboard — блоки главной,
§3.4 кэш/realtime, §4.4 `AttentionBlock` переопределяется).

**Статус документа:** authoritative план захода. Реализация **не начата**; этапы `TUT-00…TUT-10` —
§5. Аудит точек интеграции выполнен (Приложение A); решения, которые нельзя принимать кодом по
умолчанию, явно вынесены в §8 и закрываются до соответствующих этапов.

**Терминология (важно).** В проекте «онбординг продавца» уже занят: так называется экран создания
магазина (`SellerOnboardingView`, `router.tsx:67-72`, `02 §17`). В этом документе новое явление
называется **«обучение» (tutorial)**; заход — `TUT-*`. Три предметных понятия не смешиваются:
**tutorial state** (прогресс самого обучения), **readiness** (готовность магазина, чек-лист),
**growth** (цели по фактическим заказам).

---

## 0. Метод и легенда

1. **Один этап за раз** (`TUT-00…TUT-10`): реализация → гейты → следующий этап.
2. **Гейты** (конвенция `25 §0`):

```text
npm run typecheck
npm run lint          (0 errors)
npm run test
npm run build
npm run build:edge              (при edge-этапах)
npm run migrations:check        (при новой миграции; текущая в проекте — 0056)
npm run commerce:harness        (при backend-этапах; сейчас Test 1–34, 175/175)
```

3. **Двойная среда проверки** (`00` README): `LOCAL VERIFIED` (браузер) + `TELEGRAM VERIFIED`
   (реальный Mini App на dev). Этап не закрывается без обоих.
4. **Слоистость:** `View → Hook → Application → Repository → Edge/RPC`. Запрещено `UI → InsForge/SQL`,
   `UI → бизнес-логика`. Presentation не импортирует infrastructure напрямую (Telegram — только через
   порты, `src/application/ports/telegram.ts:13-55`, `useHaptic.ts:9-11`, `useOpenTelegramLink`).
5. **Переиспользование.** Не создаём второй диалог, вторую карточку, второй формат ссылки. Повторно
   используем: `BottomSheet` (единственный generic-оверлей), `openTelegramLink`/`useStorefrontLink`
   (витрина), `useProductPreview` (buyer view), `useSellerDashboard` + realtime + `seller_dashboard_read`,
   паттерны `0012`/`0048` (RPC + гранты), `SettingsRow` (точка входа), `data-*`-атрибуты (якоря).
6. **Фундамент вперёд визуала.** `TUT-01…TUT-03` — контракты и данные без тяжёлого UI.
7. **Server авторитетен.** Tutorial state персистится на сервере; чек-лист и цели считаются только
   из доменных данных; клиентские guard'ы — UX.
8. **Порядок качества:** `correct → beautiful → polished`.

**Ограничения захода** (полный список «что не делать» — §3.9): без новых сервисов, очередей, Redis,
event bus; без polling и без загрузки полного каталога/истории заказов ради прогресса; без универсального
tutorial-engine и без новых библиотек (`framer-motion` уже есть — используется `BottomSheet.tsx:26-43`;
`@telegram-apps/sdk` уже есть — `telegram-app.ts`).

Легенда статуса:

| Метка | Значение |
|---|---|
| ✅ | Реализовано/проверено в коде (указан файл/строка) |
| 🟡 | Частично |
| ❌ | Не реализовано |
| 🔒 | Решение зафиксировано этим документом |
| 🧊 | Deferred: осознанно отложено, с триггером включения |

Severity: **H1** обязательно · **H2** высоко · **H3** средне · **H4** косметика.

---

## 1. Продуктовая модель (зафиксировано)

### 1.1 Первое предложение обучения

- **Триггер.** После создания магазина пользователь попадает на `/seller/dashboard` (создание →
  `auth-slice.ts:170-173` выставляет `storeId`/`currentStore` → роутер меняет экран, `router.tsx:67-72`).
  На главной при `tutorialWelcomeDecision='unknown'` показывается предложение пройти короткое обучение.
- **Действия.** «Начать» → `tutorialStatus='in_progress'`; «Не сейчас» → `welcomeDecision='declined'`.
- **После явного отказа** автоматических повторных предложений не будет; ручной запуск остаётся —
  из настроек и кнопкой «Пройти обучение» в блоке чек-листа в текущем окне.
- **Случайное прерывание** (`in_progress`, приложение закрыто) → при следующем входе предложение
  продолжить, не начинать заново.
- **Явное завершение или отказ** не должны интерпретироваться как прерывание (раздельные оси
  состояния — §3.3).

### 1.2 Маршрут обучения

| # | Ключ шага (стабильный) | Экран/точка проекта | Критерий завершения шага |
|---|---|---|---|
| 1 | `orientation` | `/seller/dashboard` | явное «Далее» |
| 2 | `product-create` | `/seller/inventory/product/new` (`router.tsx:93-96`) | подтверждённое успешное сохранение существующего create-пути; либо товар уже создан пользователем самостоятельно |
| 3 | `product-buyer-view` | `/product/:id` — in-app предпросмотр через `useProductPreview` (`useProductPreview.ts:14-28`) | возврат из предпросмотра (`exitStorePreview`, `DetailsView.tsx:55-65`) |
| 4 | `storefront` | реальная публичная витрина — внешний диплинк `shop_<public_id>` через `openTelegramLink` (`telegram-app.ts:441-455`) | возврат в seller-контекст и подтверждение (авто по `visibilitychange` + кнопка «Я вернулся») |
| 5 | `finish` | `/seller/dashboard` | экран завершения → чек-лист |

Точное количество визуальных подшагов может уточняться при UI-проектировании (TUT-07), маршрут
остаётся коротким и ориентированным на практическую ценность. Отдельный роут обучения **не нужен**:
обучение — оверлей поверх существующих экранов; единственное новое UI-место — welcome-шит и карточки
шагов.

### 1.3 Товар из обучения

- Это **обычный товар магазина** (существующий create-путь), не tutorial fixture; не удаляется
  автоматически; повторный запуск не создаёт дубликат (см. ниже).
- Фото необязательно — как и в обычном создании: `validateProduct` требует только `title` и цену
  (`product-rules.ts:58-74`), лимит изображений `MAX_IMAGES = 4` (`limits.ts:4`); серверный гейт —
  только `TITLE_REQUIRED` (`0011_catalog_atomic.sql:61-64`).
- Действуют существующие проверки и бизнес-правила (`product_create_atomic`, `0011:32-162`).
- Шаг считается завершённым только после **подтверждённого успешного сохранения**: сигнал берётся из
  существующего create-контура (`useProductDraftSave.ts:53-54`, `onSaved(productId)`), а не из нажатия
  кнопки.
- **Инвариант дубликатов:** `product_create_atomic` не идемпотентен, а create-цепочка может отклонить
  Promise уже после вставки (`product-slice.ts:152-159`); поэтому tutorial **никогда не вызывает
  создание сам** и не ретраит его — создание выполняется только явным действием пользователя в форме.
  Повторный запуск обучения не создаёт товар автоматически.

### 1.4 Уход с шага

Если шаг активен и пользователь ушёл на другой экран, показывается ненавязчивая подсказка, например:

> **Вернёмся к созданию товара?**
> Вы можете посмотреть другие разделы, но для продолжения знакомства осталось создать первую карточку товара.
>
> **Вернуться к шагу** / **Завершить обучение**

- Навигация не блокируется; подсказка не показывается на каждый тап (один раз на конкретный уход).
- При самостоятельном выполнении действия реальный результат распознаётся — повторять не заставляем.
- «Завершить обучение» немедленно заканчивает сценарий без второго подтверждения и сохраняет уже
  сделанные изменения.

### 1.5 Завершение

После «Завершить обучение» продавец остаётся/оказывается на `/seller/dashboard`: видит бар чек-листа;
нажатие открывает список задач и пояснение о подготовке/развитии магазина. Повторный запуск — из
настроек (§4.1). `tutorialStatus='completed'`, `tutorialStep=null`.

### 1.6 Чек-лист подготовки — определения под фактические данные Shoppis

| # | Пункт | Выполнен, когда | Источник данных | Учёт в прогрессе |
|---|---|---|---|---|
| 1 | Название магазина | Непустое `stores.name`. Гарантировано при создании (`shop-create.js:61-62`, `auth-slice.ts:146`, `name NOT NULL`) | `currentStore.name` | **Не входит** в числитель/знаменатель (иначе искусственный процент) |
| 2 | Оформить магазин: баннер и/или описание | Непустое `stores.banner_url` **или** непустое `stores.description` (≤300, `0056`) | `currentStore.bannerUrl`, `currentStore.description` | Рекомендуемый пункт; отдельный статус `recommended` / `completed`; **не блокирует** магазин (см. §8.1/§8.2) |
| 3 | Доступный покупателю товар | `≥1` товар `status='ACTIVE'` с хотя бы одним вариантом `variants.status='ACTIVE'` и `inventory.available_quantity > 0` — та же семантика, что `available` на витрине (`0023:159-165`, `0037:321-328`), но без гейта `stores.status` (см. §8.3) | новый серверный счётчик `inventory.buyerAvailableProducts` в `seller_dashboard_read` (TUT-03) | Да |
| 4 | Категория | `≥1` строка `categories.status='ACTIVE'` магазина; архивная — не считается; виртуальная «Без категории» (`UNCATEGORIZED_ID`, `categories.ts:2-3`) — не строка БД и не считается | существующий счётчик `inventory.activeCategories` (`0055:88-91`) | Да |
| 5 | Support-контакт | `currentStore.supportHandle` непустой **и** проходит клиентскую нормализацию/валидацию (`store-contact-rules.ts:9,20-33`). SQL хранит сырое значение (`0012:93`) — невалидное значение не засчитываем | `currentStore.supportHandle` | Да |

- «Черновика» в модели товара нет: `ProductStatus = 'ACTIVE' | 'ARCHIVED'` (`product.ts:1-3`); «В архив» —
  вне зачёта, как и товар без остатка.
- Прогресс: `completed / total`, где `total` — учитываемые пункты (3, 4, 5 и, по решению §8.1, 2);
  точка 1 исключена. «Магазин подготовлен» — когда обязательные пункты выполнены; оформление
  отображается как рекомендация «Рекомендуем оформить» (окончание — §8.2).
- Свёртка: строка «Магазин подготовлен» с возможностью раскрытия; ниже — блок развития.

### 1.7 Последовательные цели развития — определения под фактические статусы Shoppis

Показывается **одна ближайшая цель**. Факты для целей — только из доменных данных заказов
(`01 §Locked decisions`: `NEW → IN_TRANSIT → DELIVERED`, `REFUSED`, `CANCELLED`):

| Цель | Что считается достижением (серверный факт) | Что не считается |
|---|---|---|
| 1. Получить первый заказ | `exists orders(store_id)` — строка заказа существует. Заказы не удаляются; последующая отмена факт не стирает. Опционально — исключение самостоятельной покупки владельца, если решим (§8.4): `buyer_user_id <> stores.owner_user_id` вычислимо (`buyer_user_id NOT NULL`, `0003:9`) | незавершённый checkout (заказ не создаётся), тестовые записи, если их удастся достоверно отличить |
| 2. Отправить первый заказ | `exists order_status_history(to_status='IN_TRANSIT')` по заказам магазина — **исторический** факт: последующая отмена не стирает его (IN_TRANSIT→CANCELLED сохраняет held и историю, `0007:72-84`). См. §8.5 | заказ, отменённый до `IN_TRANSIT`; только открытый (`NEW`) заказ |
| 3. Успешно завершить первый заказ | `exists orders(status='DELIVERED' and delivery_outcome='RECEIVED' and completed_at is not null)` — `completed_at` ставится только на RECEIVED (`0051:102-107`), исход терминален (`0049:47-59`: повтор → `OUTCOME_ALREADY_RECORDED`) | `REFUSED`, `CANCELLED`, возврат, неуспешная доставка |

- Цель N+1 не показывается, пока N не достигнута. Достигнутая цель 1 не сбрасывается последующей
  отменой; цели 2/3 ждут подходящего события (в т.ч. более позднего заказа).
- Пользователь не может вручную пометить цель выполненной — только фактическое событие.
- Продавец может достичь целей без прохождения обучения: growth не зависит от tutorial state.

---

## 2. Аудит текущего фундамента (сверено по коду)

### 2.1 Что готово и переиспользуется

| Что | Где | Готовность |
|---|---|---|
| Создание магазина (онбординг) | `SellerOnboardingView.tsx:76-96` → `auth-slice.ts:144-189` → edge `shop-create.js:61-88` | ✅ |
| `Store` модель и поля | `src/domain/models/store.ts:10-27`; колонки `stores` — `03 §3` | ✅ |
| Обновление магазина (name/banner/description/support) | `store-settings-api.ts:30-47` → edge `store-actions.js:30-47` → `store_update_profile_atomic` (`0012`, пересоздана `0056`) | ✅ |
| Публичная ссылка витрины `shop_<public_id>` | `storefront-link.ts:52-95`, `useStorefrontLink.ts:8-15` | ✅ |
| Открытие внешней витрины из seller | `SellerSettingsView.tsx:207-211` → `openTelegramLink` (`telegram-app.ts:441-455`) | ✅ |
| In-app «buyer view» карточки товара | `useProductPreview.ts:14-28` (`enterStorePreview`), возврат — `DetailsView.tsx:55-65` (`exitStorePreview`) | ✅ |
| Create-путь товара с возвратом `productId` | `CreateProductView.tsx:13-31` → `ProductDraftEditor.tsx:92-103` → `useProductDraftSave.ts:39-64` → `useInventoryActions.ts:83-88` → `product-slice.ts:101-160` → `product-repository.ts:280-337` → `catalog-api.ts:62-81` → edge `catalog-actions.js:43-52` → `product_create_atomic` (`0011:32-162`, возвращает `productId` `:160`) | ✅ |
| Статусы товара, публикация/архив/удаление | `ProductOverview.tsx:43-74`; `product_set_status_atomic` (`0011:443-482`), `product_delete_atomic` (`0011:486-524`) | ✅ |
| Семантика доступности покупателю | `0023:159-165`, `0037:321-328` (`available`), `0043:174-184` (checkout), `product-rules.ts:76-78`, `inventory-rules.ts:32-52` | ✅ (нет seller-facing существования — §2.2) |
| Категории и счётчик активных | `categories` (`0002:6-18`, `0009:7-9`); `0055:88-91` (`activeCategories`); виртуальная UNC — `categories.ts:2-3` | ✅ |
| Статусы/исходы/история заказов | `order-statuses.ts:8-84`; переходы `0007:31-152`; outcome-гейт `0049:19-100`; `0051:32-126`; `order_status_history` — `0003:56-67` | ✅ |
| Orders read-контур + realtime | `0046` (list/detail, keyset, authz), `0047` (каналы `orders:seller:<storeId>`), `useOrdersRealtime.ts:47-69` | ✅ |
| Сводка главной | `seller_dashboard_read` (`0055:15-95`: buckets/sales/counts), `useSellerDashboard.ts:51-71`, `dashboard-cache.ts:18-27` (`staleTime: 0`, realtime-инвалидация) | ✅ |
| UI-каркас главной + точка вставки | `SellerDashboard.tsx:45-64` (блоки), `AttentionBlock.tsx:8-15` (плейсхолдер) | ✅ |
| Точка ручного запуска (настройки) | `SellerSettingsView.tsx:169-231`, `SettingsRow.tsx:19-95` | ✅ |
| Оверлей-примитив | `BottomSheet.tsx:5-43` (portal, framer-motion), CSS `components.css:822-866` | ✅ |
| Telegram viewport/fullscreen/safe-area | `telegram-app.ts:107-176,190-201,264-284`; `useViewportSnapshot.ts:9-23`; CSS `globals.css:76-91,129-141` | ✅ |
| Прецедент persisted «seen»-состояния | `useSellerSocialSeen.ts:14-68` (localStorage) | ✅ (но для tutorial нужен сервер — §3.3) |
| Паттерн грантов защищённых RPC | `0048:21-45` (`revoke` от `public/anon/authenticated`, доверенный путь — edge/admin) | ✅ |
| Гейты и harness | `package.json:6-21`; `scripts/commerce-harness.mjs` (Test 1–34) | ✅ |

### 2.2 Что отсутствует / границы захода

| Область | Состояние |
|---|---|
| Tutorial state (welcome/status/step) | ❌ нет полей, таблиц, RPC, edge (поиск `tutorial/tour/checklist/welcome` — 0 совпадений) |
| Welcome-предложение и consent UI | ❌ нет |
| Шаг-карточки, оверлей/подсветка/stepper | ❌ нет; generic-модалок нет — только `BottomSheet` |
| Серверный счётчик «доступный покупателю товар» | ❌ нет (`inventory` в `0055` — только статусные counts) |
| Факты growth («первый заказ/отправка/получение») | ❌ нет; `order_status_history` — write-only (ни один RPC её не читает) |
| Сигнал «товар сохранён» для внешнего наблюдателя | ❌ нет: `CreateProductView` не отдаёт callback наружу (навигацией управляет `ProductDraftEditor.tsx:205-210`) |
| Ручной запуск обучения | ❌ нет строки/экрана |
| Пересчёт позиции оверлея на viewport/keyboard | ❌ нет (снимок viewport есть, потребитель — только `SafeAreaDebug`) |
| Роуты | Изменений не требуется: обучение — оверлей поверх существующих экранов 🔒 |

### 2.3 Ключевые факты данных, влияющие на решения

- `stores` (docs `03 §3`, миграции `0001`/`0056`): `id`, `owner_user_id`, `owner_telegram_id` (legacy),
  `name`, `description` (≤300, публичное), `logo_url`, `banner_url`, `support_handle`,
  `seller_contact` (legacy), `currency` (USD/RUB/BYN), `currency_symbol`, `language` (ru/en), `status`
  (ACTIVE/PAUSED), `public_id` (unique, opaque), `created_at`, `updated_at`.
- `store_update_profile_atomic`/`store_set_status_atomic` возвращают **полную проекцию** store
  (`0012:98-113`; `0056:96-111`) — при добавлении колонок tutorial state нельзя «потерять» их в
  `currentStore` при profile-обновлении (см. TUT-02).
- `telegram_identities` (`0001:16-26`, `0013`, `0014`): identity пользователя, включая
  `photo_url`/`notifications_enabled`; ролей нет (`01 §5`) — tutorial привязан к **магазину**, не к identity.
- Realtime заказов: канал `orders:seller:<storeId>`, payload `{orderId,status}` (`0047:45`);
  outcome в payload не передаётся — сводка главной перезапрашивается целиком (этого достаточно, §3.5).
- `completed_at` — единственный точный маркер «получен»; `shipped_at`/`delivered_at` отсутствуют;
  `updated_at` не годится (перезаписывается любым write, `0007:138-140`, `0051`).
- Создание категории — прямой клиентский insert (`category-repository.ts:49-76`), без RPC/edge и без
  owner-assert в SQL (RLS выключен); `sort_order` аллоцируется без блокировки. Чек-листу это не мешает
  (счётчик серверный), но фиксируем как известный факт (не в scope этого захода).
- Полный текст внешнего ограничения («нельзя менять файлы по выдуманным путям») снят: все точки
  интеграции подтверждены кодом (Приложение A); до кодирования остаются только продуктовые решения §8.

---

## 3. Целевая архитектура (Onion)

### 3.1 Границы захода и главный принцип

Заход состоит из пяти границ (внешний §1), адаптированных под слои проекта:

1. **Tutorial flow controller** — `useSellerTutorial` (application) + правила `domain/rules/tutorial-rules.ts`:
   показывает ли предложение, текущий шаг, продолжение, отказ/завершение, ручной запуск. Не сохраняет
   товары, не валидирует товар, не считает readiness, не дублирует storefront-логику.
2. **Shop readiness** — чистая функция `computeShopReadiness` (domain) поверх нормализованного входа
   (currentStore + серверные counts). Не пишет `task_completed=true` в БД.
3. **Growth journey** — чистая функция `resolveGrowthGoal` (domain) поверх серверных фактов из заказов.
   Не зависит от tutorial state.
4. **Presentation layer** — welcome-шит, карточка шага/оверлей, подсказка ухода, экран завершения,
   блок чек-листа, блок текущей цели, ручной вход в настройках.
5. **Existing domain use cases** — продолжают владеть товаром, магазином, категориями, ссылкой и
   заказами. Новый функционал вызывает их, но не дублирует.

**Главный принцип:** единственный источник истины для фактов о магазине — существующие бизнес-данные
Shoppis. Состояние обучения хранится отдельно (это пользовательский сценарий), но не становится
истиной для «товар создан», «категория есть», «контакт настроен», «заказ получен».

**Рекомендуемый общий подход (внешний §1):** сначала read-only чек-лист и ручной запуск, потом
усложнение; не создавать таблиц для задач (статусы вычисляются); хранить минимум состояния обучения;
цели заказов — из централизованной доменной модели, не из клиентских флагов; без event bus/очереди/
Redis/отдельного сервиса; без polling и загрузки полного каталога/истории заказов ради прогресса.

### 3.2 Слои и поток

```text
SellerDashboard / TutorialOverlay / SellerSettingsView (presentation)
      │
      ▼
useSellerTutorial (application, новый)                    useSellerDashboard (существующий)
      │  ├── состояние: currentStore.tutorial* (Zustand, auth-slice)
      │  └── запись: updateTutorialState ─▶ store-settings-api ─▶ edge `store-actions`
      │                                                          └─ store_set_tutorial_state_atomic (0057)
      │
      └── чистая логика: domain/rules/tutorial-rules.ts, readiness-rules.ts, growth-rules.ts

useSellerDashboard ─▶ dashboard-api ─▶ edge `seller-dashboard`
                                    └─ seller_dashboard_read()   ← 0058: +inventory.buyerAvailableProducts
                                                                 ← 0059: +growth{firstOrderAt, firstShippedAt, firstCompletedAt}
```

- Создание товара/категории/заказа — существующие цепочки (§2.1); tutorial получает только сигналы
  (`notifyProductSaved(productId)` и т.п.), никаких auto-create.
- Доменные правила: `src/domain/rules/*` (конвенция `product-rules.ts`, `order-rules.ts`). Типы:
  `src/domain/models/tutorial.ts`; расширение read-model `src/application/read-models/seller-dashboard.ts:7-27`.

### 3.3 Модель состояния обучения и хранение (внешний §4)

Три оси **не** кодируются одним булевым флагом:

1. **Первое предложение:** `unknown | accepted | declined`.
2. **Tutorial run:** `not_started | in_progress | completed | dismissed`.
3. **Состояние магазина:** фактические данные (вычисляется, не хранится).

**Решение 🔒 — хранение на `stores` (без новой таблицы):**

```text
stores:
  tutorial_welcome_decision text not null default 'unknown'   -- unknown|accepted|declined
  tutorial_status          text not null default 'not_started' -- not_started|in_progress|completed|dismissed
  tutorial_step            text                                -- стабильный ключ шага; null вне in_progress
  tutorial_updated_at      timestamptz                         -- диагностика/восстановление
```

- Субъект — магазин (совместимо с будущей многомагазинностью; сейчас MVP — один магазин на продавца).
- **Backfill (0057):** существующие магазины → `tutorial_welcome_decision='declined'` (не показываем
  предложение задним числом; «старые пользователи не ломаются» — Gate 2). Новые — `unknown` через default.
- Альтернативы отклонены: отдельная таблица `seller_tutorial_state` (лишняя сущность для 4 полей);
  localStorage (прецедент `useSellerSocialSeen.ts:14-68` есть, но теряется при переустановке/смене
  устройства — tutorial state обязан переживать перезагрузку Mini App на Android, §4.4).
- **Не сохранять** в tutorial state `productTaskCompleted`, `categoryTaskCompleted`, `firstOrderCompleted`
  и подобное — они дублируют доменные данные и разойдутся с ними.
- Перезапуск: не сбрасывает данные магазина/чек-лист; не создаёт товар; использует актуальное
  состояние; если шаг «создание товара» уже фактически выполнен — не требовать повторного создания
  (UX — §8.6).

### 3.4 Чек-лист: вычисление без дублирования данных (внешний §5)

- Read-model `ShopReadiness` собирается из двух уже доступных источников: `currentStore` (Zustand;
  `name`, `description`, `bannerUrl`, `supportHandle`) и сводки главной (`useSellerDashboard`:
  `inventory.buyerAvailableProducts`, `inventory.activeCategories`). Отдельных запросов на чек-лист нет.
- Чистая функция `computeShopReadiness(input)` возвращает:

```text
{
  storeName:        'completed',                       // всегда; вне progress
  storeAppearance:  'recommended' | 'completed',       // решение §8.1/§8.2
  availableProduct: 'incomplete' | 'completed',        // по buyerAvailableProducts >= 1
  category:         'incomplete' | 'completed',        // по activeCategories >= 1
  supportLinks:     'incomplete' | 'completed',        // по валидному supportHandle
  preparationReady: boolean,                           // обязательные пункты (см. §8.2)
  progress: { completed: number, total: number }       // без пункта «название»
}
```

- UI не содержит собственных проверок «по всем таблицам» — только рендер этой модели.
- **Обновление после мутаций.** Существующие механизмы: `useSellerDashboard` (`staleTime: 0`,
  `useSellerDashboard.ts:58`) + `refetchOnMount` при возврате на главную; realtime заказов инвалидирует
  сводку (`useSellerDashboard.ts:66-71`). После успешных мутаций товара/категории/профиля — вызывать
  `invalidateSellerDashboard` (точечно, `dashboard-cache.ts:25-27`); точный список точек — TUT-03.
  Без постоянного polling.

### 3.5 Цели развития: вычисление из заказов (внешний §6)

- Цель **не хранится** как переключаемый флаг. Серверные факты (новые поля `growth` в
  `seller_dashboard_read`, TUT-08):
  - `firstOrderAt = min(orders.created_at)` по магазину (опционально с фильтром §8.4);
  - `firstShippedAt = min(order_status_history.created_at)` где `to_status='IN_TRANSIT'` (join orders);
  - `firstCompletedAt = min(orders.completed_at)` где `delivery_outcome='RECEIVED'`.
- Текущая цель — чистая функция `resolveGrowthGoal({firstOrderAt, firstShippedAt, firstCompletedAt})`:
  первая незакрытая цель; будущие не показываются; достигнутая цель 1 не сбрасывается последующей
  отменой (историчность — §1.7).
- **Производительность:** три скалярных min/`exists` по индексам `orders_store_id_idx` (`0003:28`) и
  `order_status_history_order_id_idx` (`0003:67`); встраиваются в тот же `seller_dashboard_read` —
  один RPC на экран. Никаких таблиц достижений, фоновых обработчиков и event-sourcing в MVP.
- **Обновление цели:** realtime-канал заказов уже инвалидирует сводку; payload без outcome — сводка
  перезапрашивается целиком; при возвращении на главную — mount-refetch (`staleTime: 0`). Этого достаточно.

### 3.6 Контракты: миграции, RPC, edge, read-модели

**`0057_seller_tutorial_state.sql` (TUT-02):**

- 4 колонки на `stores` (§3.3) + CHECK-констрейнты на допустимые значения;
- backfill `declined` для существующих магазинов;
- `public.store_set_tutorial_state_atomic(p_store_id uuid, p_actor_user_id uuid, p_patch jsonb) returns jsonb`
  (SECURITY DEFINER, `search_path = public, pg_temp`, по образцу `store_set_status_atomic`, `0012:118-159`;
  ownership — `stores_assert_owner`, `0012:9-28`; ошибки `STORE_NOT_FOUND`/`FORBIDDEN`/
  `INVALID_TUTORIAL_STATE`; отвечает обновлёнными полями);
- **гранты:** не выдавать `public/anon/authenticated`; доверенный путь — edge с `adminClient`
  (паттерн `0048:21-45`).
- Edge: `store-actions.js` — новый dispatch `action: 'tutorial-state'` (рядом с `update-profile`/
  `update-status`, `store-actions.js:30-47`), контракт ошибок по существующей карте `:19-28`.
- TS: `Store` (`store.ts:10-27`) + `StoreRow`/`mapStore` (`store-repository.ts:11-45`);
  `store-settings-api.ts` (+`updateTutorialState`) и dev-fallback (`store-settings-api.dev.ts`);
  `auth-slice` action `updateTutorialState` (рядом с `updateStoreProfile`, `auth-slice.ts:292-297`).
- **Ловушка интеграции:** `updateStoreProfile`/`updateStoreStatus` заменяют `currentStore` ответом RPC
  (`auth-slice.ts:296,302`), а проекция `0012`/`0056` не содержит tutorial-полей — при профильной правке
  они «потеряются» в Zustand. Решение на TUT-02 (одно из): merge в `currentStore: {...get().currentStore, ...store}`
  **или** дополнить проекцию RPC. Зафиксировать тестом.

**`0058_seller_dashboard_readiness.sql` (TUT-03):**

- `create or replace public.seller_dashboard_read(...)` — добавить
  `inventory.buyerAvailableProducts` = `count(*)` товаров `ACTIVE` с `exists` (ACTIVE-вариант +
  `available_quantity > 0`); остальной контракт `0055:15-95` не менять.

**`0059_seller_growth_read.sql` (TUT-08):**

- `create or replace public.seller_dashboard_read(...)` — добавить `growth` (§3.5).

Итоговый JSON сводки (аддитивное расширение, старые поля не меняются):

```json
{
  "orders":    { "new": 0, "inTransit": 0, "delivered": 0, "history": 0 },
  "sales":     { "receivedMinor": 0, "frozenMinor": 0 },
  "inventory": { "activeProducts": 0, "archivedProducts": 0, "activeCategories": 0,
                 "buyerAvailableProducts": 0 },
  "growth":    { "firstOrderAt": null, "firstShippedAt": null, "firstCompletedAt": null }
}
```

- TS read-model `seller-dashboard.ts:7-27` и `dashboard-mappers.ts:30-51` — расширяются safe-getters
  (неизвестные/отсутствующие поля → безопасные дефолты; конвенция `order-mappers.ts:73-86`).

### 3.7 Безопасность и гранты

- Identity — только из проверенной сессии edge (`verifySession`, конвенция `order-queries.js:53-105`);
  `storeRef` — requested context, не permission; авторизация в SQL по `stores.owner_user_id`
  (`stores_assert_owner`, `0012:9-28`), чужой магазин → безопасная пустота/`null` без оракула.
- Новые функции не получают `grant execute to public`; `revoke` от `public/anon/authenticated`
  (паттерн `0048:21-45`); доверенный путь — edge `adminClient` (`_shared/clients.js`).
- RLS — вне scope захода (общий прод-гейт `11 §S1`).

### 3.8 Кэш, инвалидация, realtime

- **Tutorial state:** хранится в `currentStore` (Zustand) и обновляется точечно (`updateTutorialState`);
  записи — только на значимых переходах: `accept / decline / step-change / complete / dismiss`
  (≤ ~7 записей за прохождение). Чтение — из уже загруженного магазина, без нового RPC.
- **Readiness:** сводка главной — существующие `dashboardKeys`/`invalidateSellerDashboard`
  (`dashboard-cache.ts:18-27`); кейс `staleTime: 0` — возврат на главную уже даёт свежие counts.
- **Growth:** та же сводка + существующая realtime-инвалидация заказов (`useSellerDashboard.ts:66-71`).
- **Не вводить** отдельный realtime-канал/подписку ради чек-листа.

### 3.9 Производительность: что не делать / что делать (внешний §8)

**Не делать:**
- не загружать полный каталог/историю заказов ради прогресса (counts считает сервер);
- не опрашивать backend постоянно (никакого polling);
- не делать подсказку отдельной сетевой операцией;
- не вводить realtime-подписку на каждое состояние/задачу;
- не сохранять в БД hover/открытие подсказки/скролл;
- не создавать сервис/очередь/worker/Redis/event bus ради MVP;
- не строить универсальный tutorial engine (нужен один короткий сценарий);
- не добавлять библиотеку — проверить уже имеющиеся зависимости (`package.json:22-37`):
  `framer-motion` (анимации оверлея — уже используется `BottomSheet.tsx`), `@telegram-apps/sdk`
  (viewport/links), `lucide-react` (иконки).

**Что делать:**
- только необходимые поля и счётчики (`seller_dashboard_read` — один RPC);
- существующие запросы/кэш/инвалидация;
- readiness — чистая функция из уже загруженного состояния;
- tutorial state — редкие компактные мутации;
- ленивый UI (существующие `lazy`-роуты `router.tsx`);
- не передавать PII заказов в чек-лист.

**Когда оптимизировать:** после профилирования; при масштабе первых десятков магазинов очередь/аналитика
для трёх целей — преждевременная сложность.

### 3.10 Паттерны (внешний §9)

- **State machine для обучения — маленькая:** явные статусы/переходы/стабильные ключи шагов в
  `tutorial-rules.ts`; без тяжёлого framework (типы TS + чистые функции + юнит-тесты).
- **Derived state для чек-листа — да:** статус задачи вычисляется из доменных данных; UI получает
  компактный объект готовности.
- **Single source of truth — обязателен:** товар — существующий product use case; категория — модель
  `categories`; контакт — настройки магазина; заказы — существующая order-логика; onboarding-состояние —
  только прогресс обучения.
- **Ports/adapters — только где уже есть границы:** tutorial — application-хук + существующие
  repository-границы; не создавать искусственную Onion-архитектуру внутри фичи.
- **Идемпотентность:** повторное нажатие «продолжить», возврат из витрины, восстановление приложения
  не создают товар/категорию/заказ; tutorial никогда не вызывает create; повторная запись того же
  tutorial-состояния безопасна (PUT-семантика).
- **Без event-sourcing/analytics в MVP:** трёх целей достаточно на текущих доменных данных.

---

## 4. UX-спецификации

### 4.1 Welcome prompt и ручной запуск (TUT-04)

- **Триггер:** mount `/seller/dashboard` при `welcome='unknown' && status='not_started'`
  (после создания магазина и до первого решения о предложении).
- **Компонент:** существующий `BottomSheet` (`BottomSheet.tsx:5-43`): заголовок, короткий текст,
  «Начать» (primary `btn-primary`, `components.css:871-914`) / «Не сейчас» (ghost). Закрытие
  backdrop/Escape = «Не сейчас» (сохраняем `declined`; решение зафиксировать на TUT-04).
- **Ручной запуск:** (1) новая `SettingsRow` «Пройти обучение» в `SellerSettingsView`
  (`SellerSettingsView.tsx:169-231`, `SettingsRow.tsx:19-33`; нажатие → `navigate('/seller/dashboard')`
  + запуск с шага 1 или продолжения); (2) кнопка «Пройти обучение» в блоке чек-листа в текущем окне
  после отказа; (3) при `in_progress` — «Продолжить обучение».
- После отказа автоматических повторов нет (Gate 4). Старые магазины (backfill `declined`) ничего
  не видят автоматически.

### 4.2 Шаги, якоря, оверлей (TUT-05…TUT-07)

- **Стабильные якоря** (никакой привязки к хрупким CSS-классам): добавить `data-tour="<key>"`
  целевым элементам — `nav-dashboard/nav-inventory/nav-orders/nav-settings`
  (`SellerNavBar.tsx:20-25`), `dashboard-checklist`, `inventory-add` (кнопка «+» инвентаря,
  `InventoryView.tsx:97`), `product-form-title` (`ProductForm.tsx`), `product-preview`
  (`ProductView.tsx:135-141` — кнопка «посмотреть как покупатель»), `settings-share`.
- **Оверлей:** `TutorialOverlay` — portal в `document.body` (как `BottomSheet.tsx:15`), маска
  `pointer-events: none`, spotlight-cutout вокруг target; карточка шага — `pointer-events: auto`.
- **Z-index band (важно для Telegram):** навигация — 30, листы — 40/41 (nested 50/51), toast — 60,
  checkout success — 100, order transition — 900, image viewer — 1000 (фактический стек проекта).
  Tutorial-слой ставим **между навигацией и листами**: маска `z-index: 35`, карточка `36`; при открытии
  любого `BottomSheet` (в т.ч. системного выбора фото `ImageCropSheet`, nested 50/51) карточка шага
  скрывается/приостанавливается — не перекрываем системный выбор фотографии и действия формы.
- **Пересчёт позиции:** на входе шага и при событиях — route change, скролл контейнера
  `scrollable-content`, resize, `viewportChanged`/`fullscreenChanged` (через `useViewportSnapshot.ts:9-23`),
  открытие/закрытие клавиатуры (`visualViewport`), ориентация. Target отсутствует/не видим → карточка
  в безопасной позиции над навигацией + корректная приостановка шага (не «произвольное место»).
- **Прогресс:** «Шаг N из M» + индикатор-точки. Доступность: текст объясняет действие (цвет/анимация —
  не единственный способ), `focus-visible`, `prefers-reduced-motion` (прецедент —
  `OrderStatusTransitionOverlay`, `orders.css:571-573`).
- **Кнопки:** «Далее» (где применимо), «Пропустить шаг» (только где не ломает сценарий, напр.
  `orientation`), «Завершить обучение» — на всех шагах.

### 4.3 Telegram: fullscreen, системные зоны, клавиатура (внешний §7.1–7.3)

- Не перекрывать Telegram system controls и safe areas: `--tg-safe-area-top/bottom`
  (`globals.css:76-91`), `FULLSCREEN_MIN_TOP = 88` (`telegram-app.ts:61`); не менять глобальную высоту
  шапки/отступы ради tutorial.
- Fullscreen и non-fullscreen: `html.tg-fullscreen`, `--tg-viewport-stable-height`
  (`telegram-app.ts:264-284`); `requestFullscreen` уже реализован (`telegram-app.ts:140-176`) — обучение
  обязано работать в обоих режимах без «ломания» layout.
- На шаге создания товара пользователь реально вводит данные: overlay не перехватывает клики и не
  лишает форму фокуса; при открытии клавиатуры доступная область учитывается, при закрытии — подсказка
  не остаётся в старой координате.
- Не делать цвет/анимацию единственным способом объяснить действие (внешний §7.1).

### 4.4 Шаг 3 (buyer view) и шаг 4 (витрина) — фактические механизмы

- **Шаг `product-buyer-view`** — in-app предпросмотр: `openProductPreview(productId, returnPath)`
  (`useProductPreview.ts:14-28`) переводит `context: 'buyer'`, `viewedStore = currentStore` и открывает
  `/product/:id`; «назад» возвращает через `previewReturnPath`→`exitStorePreview`
  (`DetailsView.tsx:34-65`). Tutorial слушает переход `previewReturnPath: non-null → null` (Zustand) и
  завершает шаг. Просмотр товара не подменяет публичную витрину — это разные шаги.
- **Шаг `storefront`** — реальная публичная витрина: диплинк `https://t.me/<buyerBot>/<app>?startapp=shop_<public_id>`
  (`storefront-link.ts:68-79`, сборка — `useStorefrontLink.ts:8-15`) открывается существующим
  `openTelegramLink` (`telegram-app.ts:441-455`; та же точка, что `SellerSettingsView.tsx:207-211`).
- **Возврат из витрины:** витрина открывается во внешнем Telegram-контексте; исходный JS-контекст не
  гарантирован (Telegram Android может перезагрузить Mini App). Поэтому источник истины — серверный
  tutorial state (§3.3): после возврата/перезагрузки `in_progress` + `storefront` → экран «Продолжить».
  Детект возврата: `document.visibilitychange` (visible после hidden) + явная кнопка «Я вернулся»;
  шаг не считается выполненным до одного из этих сигналов и фактического подтверждения.

### 4.5 Чек-лист UI (TUT-03)

- **Расположение:** первым блоком контента главной, сразу под шапкой магазина (`DashboardStoreHeader`);
  вставка в `SellerDashboard.tsx:45-64` (перед `DashboardSalesBlock`).
- **Состояния:** компактный бар (прогресс + подпись + Chevron) → раскрытие списка задач (локальный
  accordion-паттерн, прецедент — `StockControlSheet.tsx:56-72` / `ProductForm.tsx:353-364`);
  пункт «Название магазина» — completed-стиль, вне прогресс-числа; пункт оформления — со статусом
  «Рекомендуем»; выполненные обязательные → свёрнутая строка «Магазин подготовлен» (раскрываемая),
  ниже — блок развития.
- **Скрытие при готовности (правка 2026-10-15):** когда все 5 пунктов выполнены
  (`preparationReady === true`), блок чек-листа **убирается с главной** — «Развитие магазина»
  остаётся единственным блоком такого формата и продолжает меняться по фактам заказов. Пункт
  «свёрнутая строка “Магазин подготовлен”» выше считать переопределённым.
- **Данные:** только `computeShopReadiness` (§3.4); loading/error — существующие паттерны
  (`DashboardSkeleton`/`DashboardError`/`DashboardEmpty`).
- **`AttentionBlock`** (`AttentionBlock.tsx:8-15`, `25 §4.4`) — после TUT-03 заменяется чек-листом;
  пометить переопределение в `25`/`02` (docs-sync, §9).
- Обновление после внешних мутаций — §3.8/§3.4 (refetch по возвращении + точечная инвалидация).

### 4.6 Цели развития UI (TUT-08)

- Блок под чек-листом (или в той же секции): **одна** карточка текущей цели — иконка, заголовок,
  короткое пояснение. Последующие цели не рендерятся. CTA там, где уместно (например, цель 1 —
  «Поделиться витриной», используя существующий `SharePreviewBlock`/`openTelegramLink`).
- Realtime/refresh — §3.5. Пустые состояния не выдумываем: цель всегда есть, пока путь не завершён.

---

## 5. Этапы `TUT-00…TUT-10`

Порядок намеренно идёт от самого безопасного к наиболее чувствительному (внешний §10). Каждый этап —
отдельное небольшое изменение с гейтами и допуском перед следующим.

| Этап | Содержание | Severity | Статус |
|---|---|---|---|
| **TUT-00** | Аудит кода и фиксация точек интеграции | H1 | ✅ (этот документ, Приложение A; решения §8 — ⏳) |
| **TUT-01** | Контракты состояния и чистая логика без UI (`tutorial-rules`, `readiness-rules`, `growth-rules` + тесты) | H1 | ✅ |
| **TUT-02** | Минимальное хранение tutorial state (`0057` + edge + Store/API/slice) | H1 | ✅ |
| **TUT-03** | Чек-лист read-only (`0058` + блок на главной, замена `AttentionBlock`) | H1 | ✅ |
| **TUT-04** | Welcome prompt и ручной запуск | H2 | ✅ |
| **TUT-05** | Создание товара как guided action | H1 | ✅ |
| **TUT-06** | Buyer view и публичная витрина | H2 | ✅ |
| **TUT-07** | Overlay, прогресс обучения, свободная навигация | H2 | 🟡 (оверлей+spotlight+прогресс+фидбек сделаны; подсказка ухода — нет) |
| **TUT-08** | Growth journey на основе заказов (`0059` + блок целей) | H1 | ✅ |
| **TUT-09** | Полировка, доступность, регрессия | H1 | 🟡 (доступность оверлея + авто-гейты зелёные; TELEGRAM-сверка — за человеком) |
| **TUT-10** | Будущая аналитика/маркетинг — не часть MVP | — | 🧊 |

### TUT-00 — Аудит и фиксация точек интеграции

**Цель:** не писать новый код до понимания текущих потоков. **Результат:** карта «существующая
возможность → файл/use case → точка расширения» — Приложение A; неизвестные ранее «проверить»
закрыты фактическим кодом (§2); оставшиеся продуктовые решения — §8.

**Gate 0:** точные файлы/функции/схемы подтверждены ✅; критические продуктовые правила поставщика
записаны и явно помечены (§1.6–1.7, §8 — закрыть до этапов, где указано).

### TUT-01 — Контракты состояния и чистая логика без UI

**Цель:** зафиксировать правила, проверяемые unit-тестами до всякого UI и БД.

**Сделать:**
- `src/domain/models/tutorial.ts` — типы (`TutorialWelcomeDecision`, `TutorialStatus`, `TutorialStepKey`,
  `SellerTutorialState`, `StoreReadinessInput`/`ShopReadiness`, `GrowthFacts`/`GrowthGoal`).
- `src/domain/rules/tutorial-rules.ts` — допустимые переходы (accept/decline/step/complete/dismiss),
  стабильные ключи шагов (таблица §1.2), функция следующего шага; повторные вызовы — идемпотентны.
- `src/domain/rules/readiness-rules.ts` — `computeShopReadiness` (§3.4), пункт «название» вне
  числителя/знаменателя, поддержка статуса `recommended`.
- `src/domain/rules/growth-rules.ts` — `resolveGrowthGoal` (§3.5).
- Тесты: отказ, завершение, случайное прерывание, повторный запуск, самостоятельное выполнение
  действия; отмена/возврат/отказ заказа; границы прогресса чек-листа.
- **Не создавать** таблицы/поля до определения, что реально нужно персистить (Э2).

**Gate 1:** функции детерминированы; нет дублирования доменных правил (`order-statuses.ts`,
`product-rules.ts`); все решения по статусам заказа сверены с `0051`/`order-rules.ts:9-59`.

### TUT-02 — Минимальное хранение tutorial state

**Цель:** устойчиво различать первое предложение, незавершённый сценарий и явное завершение.

**Сделать:**
- Миграция `0057` (§3.6): колонки, checks, backfill `declined`, RPC `store_set_tutorial_state_atomic`;
  apply + `npm run migrations:record -- 0057` + `migrations:check` 0001..0057.
- Edge `store-actions.js`: action `tutorial-state`; `npm run build:edge` + деплой; smoke: без токена 401.
- TS: `Store` / `StoreRow` / `mapStore`; `store-settings-api` (+ dev-fallback); `auth-slice.updateTutorialState`;
  хук `useSellerTutorial` (состояние + команды; запись только на переходах).
- Решить ловушку проекции `0012`/`0056` (§3.6) и покрыть тестом: после `updateStoreProfile`
  tutorial-поля `currentStore` не теряются.
  **Решено (0057):** выбрана ветка «дополнить проекцию RPC» — общая функция
  `public._store_projection(stores)` включает tutorial-поля, и `store_update_profile_atomic`/
  `store_set_status_atomic` пересозданы через неё. Клиент (`auth-slice`) продолжает заменять
  `currentStore` ответом RPC без merge; тесты прикрывают и API-маппинг, и slice.
- Тесты: slice (mock), правила переходов.

**Gate 2:** повторная загрузка страницы/приложения не сбрасывает незавершённое обучение; отказ и
завершение не вызывают автоматического предложения; старые магазины (backfill) не получают ничего
автоматически; tutorial state не смешан с readiness/growth.

### TUT-03 — Чек-лист read-only

**Цель:** показать на главной прогресс из существующих данных — до любого overlay.

**Сделать:**
- Миграция `0058` (§3.6): `inventory.buyerAvailableProducts`; harness-инвариант: счётчик = семантика
  витрины (`0023:159-165`/`0037:321-328`): архивные, без остатка, без ACTIVE-варианта не считаются.
- TS: `seller-dashboard.ts` (read-model), `dashboard-mappers.ts`, тесты маппера.
- UI: `DashboardChecklistBlock` (+`dashboard.css`) первым блоком `SellerDashboard.tsx:45-64`;
  замена `AttentionBlock`; раскрытие/свёртка; «Магазин подготовлен».
- Обновление после мутаций (§3.8): назначить точки вызова `invalidateSellerDashboard` (товар,
  категории, профиль) — либо зафиксировать mount-refetch как достаточный.
  **Решено (TUT-03):** mount-refetch достаточен — сводка идёт с `staleTime: 0` и перечитывается
  при каждом входе на главную (после товара/категорий в Inventory пользователь возвращается на
  `/seller/dashboard`, где блок монтируется заново). Профиль/оформление/контакт берутся из
  `currentStore` (Zustand) и обновляются мгновенно. Дополнительная инвалидация не добавляется, чтобы
  не расширять поверхность; триггер пересмотра — если главная станет долгоживущим экраном.
- docs-sync: пометить `25 §4.4` переопределённым.

**Gate 3:** ручное изменение данных вне обучения правильно меняет чек-лист; удаление/архивация
единственного доступного товара возвращает пункт в incomplete; незаполненное необязательное
оформление не блокирует работу; прогресс нигде не хранится дублирующими флагами; название отображается
выполненным, но не входит в знаменатель.

### TUT-04 — Welcome prompt и ручной запуск

**Цель:** подключить точку входа без сложного overlay.

**Сделать:**
- Welcome-шит на главной по триггеру §4.1 (BottomSheet; «Начать»/«Не сейчас»; backdrop = отказ).
- `SettingsRow` «Пройти обучение» (+ i18n ru/en — `seller.settings.*`, `ru.json:557-628`/`en.json:553-624`).
- Кнопка «Пройти обучение»/«Продолжить обучение» в блоке чек-листа в текущем окне.
- Сохранение `accepted/declined` и `in_progress` через TUT-02-контур.

**Gate 4:** повторные входы, refresh, повторные события создания магазина и переходы между экранами
не показывают welcome снова без причины; ручной запуск работает; после явного завершения автоповтора нет.

### TUT-05 — Создание товара как guided action

**Цель:** встроить обучение в существующий процесс товара (не дублируя его).

**Сделать:**
- Шаг-карточка `product-create` с коротким объяснением и CTA → `navigate('/seller/inventory/product/new')`
  (`router.tsx:93-96`; не передавать `?categoryId`).
- **Сигнал успеха:** в `useProductDraftSave` после `complete(localId)`/`onSaved(productId)`
  (`useProductDraftSave.ts:53-54`) вызвать `notifyProductSaved(productId)` tutorial-контроллера —
  шаг закрывается только при подтверждённом сохранении; на ошибках (сейчас inline `role="alert"`,
  `ProductForm.tsx:513-517`) шаг не продвигается.
- **Распознавание самостоятельного выполнения:** при активации шага проверить, есть ли уже
  подходящий товар (`buyerAvailableProducts` из сводки / загруженный каталог после `ensureCatalog`) —
  если да, шаг не заставляет создавать второй (UX-вариант — §8.6).
- Повторный запуск: дубликаты не создаются никогда (tutorial не вызывает create, §1.3).

**Gate 5:** ни один сценарий не продвигает шаг при неуспешном сохранении; товар сохраняется стандартным
путём; повторный запуск не создаёт дубликат; чек-лист отражает реальное состояние после сохранения.

### TUT-06 — Buyer view и публичная витрина

**Цель:** провести продавца через оба «момента ценности».

**Сделать:**
- Шаг `product-buyer-view`: CTA → `openProductPreview(productId, '/seller/inventory/product/{id}')`
  (`useProductPreview.ts:14-28`); выбор товара — сохранённый в шаге `productId` (память контроллера),
  fallback — первый buyer-available товар; завершение — возврат из предпросмотра (§4.4).
- Шаг `storefront`: объяснение ссылки + CTA → `openTelegramLink(storefrontUrl)` (как
  `SellerSettingsView.tsx:207-211`); возврат — `visibilitychange` + «Я вернулся» (§4.4); состояние
  персистится, перезагрузка Mini App не ломает сценарий.
- Устойчивость к повторному открытию/возврату, закрытию приложения и потере контекста (TUT-02-персист).

**Gate 6:** публичная витрина не создаёт товар; просмотр товара не подменяет витрину; возврат не
повторяет уже выполненные действия; отсутствующий необязательный баннер не считается ошибкой.

**Реализовано (buyer view, 2026-10-15):** на шаге `product-buyer-view` spotlight на реальной кнопке
предпросмотра (`data-tour="product-preview"`), без «Далее». При открытии предпросмотра
`useProductPreview` (только если обучение в процессе и шаг = buyer-view) отмечает факт в памяти
контроллера (`markTutorialPreviewOpened`); после возврата (seller-shell и оверлей монтируются
заново) оверлей `consumeTutorialPreviewOpened()` переводит шаг на `storefront`.

**Реализовано (storefront/шаринг, 2026-10-15):** шаг `storefront` ведёт по РЕАЛЬНЫМ элементам:
вкладка «Настройки» (`data-nav-id="/seller/settings"`) → строка «Поделиться магазином»
(`data-tour="settings-share"`) → кнопка «Копировать» (`data-tour="share-copy"`). Каждый переход — по
тапу пользователя (маршрутная смена переключает подшаг); клик по «Копировать» уводит на
`/seller/dashboard` и открывает шаг `finish` — финальную карточку-поздравление. Новая вкладка
обучения не заводится. **Отличие от исходного §4.4:** вместо внешнего диплинка витрины через
`openTelegramLink` + `visibilitychange` шаг завершается через реальный экран шаринга и «Копировать»
(даёт тот же результат и надёжнее в Telegram WebView).

### TUT-07 — Overlay, прогресс обучения и свободная навигация

**Цель:** добавить подсветку и поведение ухода с шага после того, как сам маршрут уже работает.

**Сделать:**
- `data-tour`-якоря (§4.2) + `TutorialOverlay` (portal, маска `pointer-events:none`, cutout) в
  z-band 35/36; скрытие карточки при открытых шитах.
- Пересчёт позиции: route/scroll/resize/viewport/keyboard (§4.2; снимок — `useViewportSnapshot.ts:9-23`).
- Индикатор прогресса «Шаг N из M»; «Пропустить шаг» (только безопасные); «Завершить обучение» везде.
- Подсказка ухода «Вернёмся к созданию товара?» (§1.4): appears при фактическом уходе с требуемого
  маршрута шага; один раз на уход; «Вернуться к шагу» / «Завершить обучение»; навигация не блокируется.
- Экран завершения → «Магазин подготовлен»-состояние чек-листа.

**Gate 7:** overlay не перехватывает поля/кнопки, не перекрывает системные зоны Telegram и корректно
ведёт себя при клавиатуре, выборе фото, скролле, смене вкладки и в fullscreen/non-fullscreen.

**Реализовано (ядро TUT-07, 2026-10-15):** `TutorialOverlay` смонтирован глобально в seller-shell
(`SellerLayout`): затемнение + spotlight-вырез по якорю (`data-tour`/`data-nav-id`), карточка рядом
с целью, «Шаг N из M» + точки, «Пропустить шаг» (только orientation), завершение, фидбек «Шаг
выполнен» при переходе, пересчёт позиции на scroll/resize/visualViewport. Якоря: `product-title`,
`product-price`, `product-publish`, `product-preview`, `nav-inventory`. Маршрут ведётся оверлеем
(orientation → product-create подшаги в форме → product-buyer-view → storefront → finish), навигация
не блокируется. **Остаётся:** подсказка ухода «Вернёмся к…» (§1.4), полная автоматика возврата из
предпросмотра/внешней витрины (сейчас ручное «Далее», TUT-06), ручная TELEGRAM-сверка клавиатуры/
фото-пикера/fullscreen.

### TUT-08 — Growth journey на основе заказов

**Цель:** подключить одну текущую цель развития.

**Сделать:**
- Миграция `0059` (§3.6): `growth{firstOrderAt, firstShippedAt, firstCompletedAt}`; harness Test 37+
  (новый заказ, отмена, отказ от получения, отправка, успешное получение, несколько заказов,
  историчность фактов).
- Применить решения §8.4/§8.5 (исключение собственного заказа владельца; семантика «отправлен» —
  исторический факт по `order_status_history`).
- UI: `DashboardGrowthBlock` — одна цель, будущие скрыты; обновление — существующая realtime-инвалидация
  и mount-refetch (§3.5).

**Gate 8:** тесты на все сценарии статусов; будущая цель не показывается до достижения текущей;
достигнутый первый заказ не стирается отменой; отказ/возврат не считаются успехом; ручная отметка
цели невозможна.

**Реализовано (2026-10-15):** `0059` добавляет `growth{firstOrderAt,firstShippedAt,firstCompletedAt}`
в `seller_dashboard_read` (`IN_TRANSIT` исторически, §8.5). TS: read-model + маппер (safe-getters).
UI: `DashboardGrowthBlock` под чек-листом — одна ближайшая цель из `resolveGrowthGoal` (ручной отметки
нет), CTA первой цели → шаринг, при завершении — положительное состояние. Harness Test 37.
**Уточнено (`0060`):** self-фильтр владельца снят — первый заказ закрывает цель 1 сразу (§8.4
пересмотрено); Тест 37 дополнен проверкой self-заказа.

### TUT-09 — Полировка, доступность, регрессия и измерение

**Проверить (внешний §10 Э9, адаптировано):**
- Telegram Android/iOS/Desktop, fullscreen/non-fullscreen (`telegram-app.ts:107-176`), safe areas
  (`globals.css:76-91`), `SafeAreaDebug` (?debug=safe) для инспекции;
- переходы seller app ↔ public storefront (§4.4) и in-app preview (`DetailsView.tsx:55-65`);
- keyboard/photo picker (`ImageCropSheet` — nested sheet)/scroll;
- пустой магазин и частично заполненный магазин (чек-лист во всех комбинациях);
- сценарии обучения: отказ, старт, завершение, прерывание, повторный запуск, ручной запуск;
- изменение данных вне обучения (товар/категория/контакт/баннер) — чек-лист корректен;
- статусы заказов и realtime (сводка + growth обновляются);
- производительность первой загрузки и количество сетевых запросов (не выросло: один dashboard-RPC);
- ошибки сети/сохранения и восстановление состояния (`useUnsavedChangesGuard`-прецедент).

**Gate 9:** `typecheck`/`lint`/`test`/`build`/`build:edge`/`migrations:check`/`commerce:harness`
зелёные; существующие тесты товара/настроек/заказов/корзины проходят; нет регрессии публичной
витрины, навигации и сохранения товара; `LOCAL VERIFIED` + `TELEGRAM VERIFIED` (за человеком).

**Реализовано (полировка/доступность, 2026-10-15):**
- Доступность `TutorialOverlay`: карточка — `role="dialog"` + `aria-modal="false"` +
  `aria-labelledby`/`aria-describedby` (имя = заголовок шага, описание = текст шага); `Escape`
  завершает обучение (клавиатурный выход); точки прогресса декоративны (`aria-hidden`), смысл
  несёт текст «Шаг N из M». Фокус у формы не отбирается (оверлей не модальный, §4.3).
- CSS `tutorial.css`: `focus-visible`-обводка на «Пропустить шаг» и «✕»; `prefers-reduced-motion`
  дополнительно отключает переход карточки и flash (spotlight уже был покрыт).
- Устойчивость центрирования: `scrollTo`/`scrollIntoView` вызываются только при наличии метода —
  нет необработанных исключений в нештатном окружении и чистый тестовый прогон.
- Тесты: `TutorialOverlay.test.tsx` +3 (имя/описание dialog, `Escape`→`dismiss`, декоративные точки).
- **Чек-лист при готовности 5/5 убирается с главной** (§4.5, правка по требованию владельца):
  `SellerDashboard` рендерит `DashboardChecklistBlock` только пока `!preparationReady`; «Развитие
  магазина» остаётся единственным блоком такого формата. Тест в `SellerDashboard.test.tsx`.
- **Первый заказ закрывает цель 1 сразу, включая self-заказ владельца** (`0060`, §8.4 пересмотрено):
  снят фильтр `buyer_user_id is distinct from owner_user_id` во всех growth-фактах; Тест 37 обновлён.

**Регрессия и измерение (Gate 9, 2026-10-15):** `typecheck` · `lint` · `test` (1413/1413,
0 unhandled errors) · `build` · `build:edge` · `migrations:check` (0001..0059) ·
`commerce:harness` (202/202) — зелёные; регрессии витрины/навигации/сохранения товара нет.
Новых сетевых запросов обучение не добавляет: сводка — существующий dashboard-RPC, состояние
обучения — из `currentStore`; `useQuery` в оверлее идёт с `enabled: false` (только чтение кэша).

**Остаётся (за человеком):** `TELEGRAM VERIFIED` — клавиатура/фото-пикер/fullscreen/safe-area на
реальном Mini App (`?debug=safe`). Подсказка ухода §1.4 остаётся в объёме TUT-07 (🟡) — постоянный
оверлей уже удерживает пользователя в контексте шага; отдельная реализация не добавлялась.

### TUT-10 — Будущая аналитика и маркетинг — не часть MVP 🧊

После накопления реального использования отдельно оценить: milestones, темп роста заказов,
стабильность выполнения, программы активных магазинов, подборки/награды/продвижение. Не внедрять до
конкретной продуктовой гипотезы и критериев успеха (внешний §10 Э10).

---

## 6. Тест-матрица

### 6.1 Unit (domain, TUT-01)

- **Tutorial:** `unknown→accepted/declined`; `declined` не предлагается автоматически; `in_progress`
  восстанавливается; `completed/dismissed` ≠ interruption; повторный вызов переходов идемпотентен;
  ручной запуск после отказа; следующий шаг из каждого ключа.
- **Readiness:** название всегда `completed` и вне progress; оформление `recommended/completed` по
  решению §8.1; товар — по `buyerAvailableProducts >= 1`; категория — по `activeCategories >= 1`;
  контакт — только валидный (`store-contact-rules.ts:9`); `preparationReady` по §8.2; total/completed
  корректны во всех комбинациях.
- **Growth:** нет заказов → цель 1; отменённый первый заказ → цель 1 достигнута, цель 2 ждёт; отправка
  (IN_TRANSIT) закрывает цель 2 и не закрывает 3; RECEIVED закрывает 3; REFUSED/возврат не считаются
  успехом; более поздний заказ закрывает цель; историчность сохраняется.

### 6.2 Unit (application/presentation)

- `useSellerTutorial`: переходы, запись только на значимых переходах, merge `currentStore` не теряет
  tutorial-поля (§3.6-ловушка), ручной запуск, отказ из шита.
- `DashboardChecklistBlock`: состояния (collapsed/expanded/ready), пункты, прогресс-числа, клики.
- `TutorialOverlay` (TUT-07): карточка на нужном шаге, пересчёт при mocked viewport-изменении,
  скрытие при открытом шите, «Завершить»/«Пропустить».
- `DashboardGrowthBlock`: одна цель, порядок, скрытие будущих, обновление при обновлении сводки.
- Welcome-шит: триггеры (unknown/in_progress), кнопки, отсутствие повторов.

### 6.3 Harness (SQL, backend-этапы)

- **Test 35 (TUT-02):** `store_set_tutorial_state_atomic` — authz чужого магазина → FORBIDDEN/пусто;
  валидация значений (`INVALID_TUTORIAL_STATE`); гранты (anon/authenticated недоступны, admin доступен);
  backfill существующих → `declined`; дефолты новых.
- **Test 36 (TUT-03):** `buyerAvailableProducts` = ручная SQL-сверка семантики витрины: архивные /
  без ACTIVE-варианта / с нулевым остатком не считаются; active+вариант+остаток → +1; инвариант не
  ломает существующие counts `0055`.
- **Test 37 (TUT-08):** growth-факты: новый заказ → `firstOrderAt`; cancel → факт сохраняется;
  IN_TRANSIT → `firstShippedAt` (в т.ч. после последующей отмены); RECEIVED → `firstCompletedAt`;
  REFUSED не пишет `firstCompletedAt`; несколько заказов — мин. значения; чужой магазин → null.

### 6.4 Ручные проверки (LOCAL + TELEGRAM, за человеком)

Из Gate 0–9 и внешнего §11.5: welcome один раз; прерывание/продолжение; завершение без автоповтора;
дубликат товара не создаётся; чек-лист меняется от ручных правок; цели не показывают будущее;
overlay не ломает форму/клавиатуру/фото-пикер; возврат из витрины возобновляет шаг; fullscreen.

Гейты (повтор, §0):

```text
npm run typecheck · npm run lint · npm run test · npm run build
npm run build:edge · npm run migrations:check · npm run commerce:harness
```

---

## 7. Definition of Done

- [ ] обучение не нарушает обычные операции Shoppis (товар/настройки/заказы/витрина);
- [ ] состояния отказа, завершения и случайного прерывания различаются (§3.3);
- [ ] реальный товар создаётся и сохраняется существующим способом; дубликаты невозможны (§1.3);
- [ ] чек-лист всегда соответствует текущим данным магазина (derived, без флагов);
- [ ] подготовка и развитие визуально/логически разделены; «Магазин подготовлен» раскрывается;
- [ ] будущие цели скрыты до достижения текущих; отказ/возврат/отмена не считаются успехом;
- [ ] UI работает в Telegram Mini App при fullscreen, клавиатуре, скролле, фото-пикере и открытии
      публичной витрины; safe areas не перекрываются;
- [ ] новые запросы не загружают лишние данные и не используют постоянный polling (один dashboard-RPC);
- [ ] старые магазины (backfill `declined`) не получают автоматических предложений;
- [ ] существующие тесты (инвентарь/настройки/витрина/корзина/заказы/dashboard) зелёные; typecheck,
      build и весь релевантный набор тестов проходят; harness расширен Test 35–37;
- [ ] `LOCAL VERIFIED` + `TELEGRAM VERIFIED` — ручная проверка (за человеком).

---

## 8. Открытые решения и риски

### 8.1 РЕШЕНО (до TUT-01): условие «оформить магазин»

Считать пункт выполненным при заполнении **любого** из двух полей (`banner_url` **или** `description`).
**Утверждено:** да — любое из двух; в подсказке пояснить, что оба элемента улучшают оформление.
Реализовано в `readiness-rules.ts` (`hasStoreAppearance`), покрыто тестами.

### 8.2 ПЕРЕОПРЕДЕЛЕНО (UI-ревью 2026-10-15): гейт «Магазин подготовлен»

**Было (первоначально утверждено):** обязательные — товар, категория, support-контакт;
оформление — рекомендация (`recommended`) вне прогресса; название — вне числителя/знаменателя;
знаменатель фиксирован — 3.

**Стало (реализовано в TUT-03 по замечанию владельца продукта):** прогресс и гейт считаются
по **всем видимым пунктам чек-листа** (5): название магазина, оформление, товар, категория,
контакт. «Магазин подготовлен» = выполнены все 5. Пункт `recommended` упразднён (оформление —
обычный шаг). Причина: счётчик «N из 3» не совпадал с числом видимых задач (5) и закрытых
пунктов — вводил в заблуждение. Реализовано в `readiness-rules.ts` (`READINESS_TOTAL = 5`),
карточка — заполняющийся по шагам бар. Строки §1.6/§3.4 о «названии вне прогресса» и
«оформление — recommended» считать переопределёнными этим решением.

### 8.3 РЕШИТЬ: статус магазина в пункте «доступный товар» (до TUT-03)

Учитывать ли `stores.status='PAUSED'`? **Рекомендация:** нет — пункт про товар; пауза — осознанное
операционное действие (витрина при PAUSED скрывает товары, но это не «незаполненность» чек-листа).
Формулировка в подсказке не обещает видимость при паузе.

### 8.4 ПЕРЕОПРЕДЕЛЕНО (после TUT-08): «реальный» первый заказ

**Было (первоначально, `0059`):** все growth-факты фильтровались
`buyer_user_id is distinct from stores.owner_user_id` — собственный заказ владельца не
засчитывался.

**Стало (миграция `0060`, по требованию владельца продукта 2026-10-15):** фильтр снят —
**любой** заказ магазина (включая оформленный самим владельцем, что типично при проверке
витрины) закрывает цель 1 сразу и переводит на следующую цель. Причина: цель «получить
первый заказ» должна закрываться фактом появления заказа в разделе «Новые», а не
оставаться открытой из-за self-фильтра. Историчность фактов сохранена (отмена/отказ не
стирают min-значения). Реализовано в `0060_seller_growth_all_orders.sql`; Тест 37 обновлён:
магазин только с self-заказом → `firstOrderAt` задан.

### 8.5 РЕШЕНО (TUT-08): семантика «отправить первый заказ»

**Реализовано (`0059`):** источник — `order_status_history(to_status='IN_TRANSIT')`
(исторический факт). Тест 37: `IN_TRANSIT` → `firstShippedAt` задан; последующая отмена
продавцом его не стирает.

### 8.6 РЕШЕНО (TUT-05): UX повторного запуска при уже созданном товаре

**Реализовано:** на шаге `product-create`, если `buyerAvailableProducts >= 1`, карточка шага
показывает primary «Создать ещё один» и secondary «Посмотреть существующий товар» (переводит на
шаг `product-buyer-view`). Автоматический переход к шагу 3 и авто-создание не выполняются — только
по явному действию. Tutorial никогда не вызывает create (дубликаты невозможны, §1.3).

### 8.7 РЕШЕНО (TUT-04): место ручного запуска

**Реализовано:** `SettingsRow` «Пройти обучение» в новой группе «Помощь» `SellerSettingsView`
(`seller.settings.groupHelp`/`rowTutorial`); нажатие → `accept()` (запуск с шага 1 или продолжение)
+ `navigate('/seller/dashboard')`. Плюс кнопка в блоке чек-листа в текущем окне
(`seller.tutorial.start`/`resume`). Отдельного экрана помощи нет.

### 8.8 РЕШЕНО (TUT-04): поведение backdrop-close welcome-шита

**Реализовано:** закрытие по фону/свайпу = «Не сейчас» (`declined`) — `TutorialWelcomeSheet`
передаёт `onDecline` в `BottomSheet.onClose`; explicit-кнопки всегда видимы.

### Риски и снижение (внешний §13, адаптировано)

| Риск | Почему возникает в Shoppis | Снижение |
|---|---|---|
| Расхождение чек-листа и данных | Хранение completion-флагов | Derived readiness из доменных данных (§3.4); флаги в tutorial state запрещены |
| Дублирование товара | `product_create_atomic` не идемпотентен; `product-slice.ts:152-159` может упасть после вставки; reload в середине шага | Tutorial не вызывает create и не ретраит; создание — только явное действие; распознавание существующего товара (§1.3, §8.6) |
| Ложное завершение шага | Прогресс по нажатию кнопки, а не по результату | Сигнал из `useProductDraftSave.ts:53-54` (onSaved); ошибки не продвигают шаг |
| Overlay ломает форму/Telegram UI | Позиционирование по статичным координатам; keyboard/fullscreen | `data-tour`-якоря, пересчёт по viewport/keyboard/scroll (§4.2–4.3), z-band 35/36, скрытие при шитах |
| Неверное достижение по заказу | Упрощённое чтение одного статуса | Факты из `orders`+`order_status_history`+`completed_at`; чистая функция + harness Test 37 |
| Избыточная нагрузка | Polling или загрузка истории заказов | Один dashboard-RPC c counts/min; realtime-инвалидация; никаких таймеров (§3.9) |
| Архитектурное усложнение | Универсальный движок/новая инфраструктура | Маленькая state machine, существующие use cases и primitives (§3.10) |
| Несовместимость старых магазинов | Новые поля без default/бэкфила | Backfill `declined`, defaults, тест старого профиля (Gate 2) |
| Ошибочное повторное предложение | Смешение declined/completed/interrupted | Раздельные оси состояния (§3.3) |
| Рост `currentStore`-контракта | Profile-RPC возвращает проекцию без tutorial-полей (`0012`/`0056`) | Merge/расширение проекции + тест (§3.6) |
| Преждевременная геймификация | Маркетинговые идеи в MVP | Achievements/analytics/campaigns — TUT-10 🧊 |

### Deferred (🧊)

- Аналитика достижений, программы активных магазинов, награды (TUT-10).
- Realtime-канал каталога для чек-листа (триггер: если появится — обновление остаётся mount-refetch, §3.8).
- RPC создания категории (известный долг — `category-repository.ts:49-76`), вне scope захода.

---

## 9. Документация: синхронизация

Не размножать одну спецификацию. После этапов обновить:

1. **`00`** — индекс (новый документ `26`) + запись в changelog ревизий.
2. **`01`** — §10 реестр решений: новые D-номера (tutorial state на `stores`; readiness — серверные
   counts + derived; growth — исторические факты заказов; исключение собственного заказа — по §8.4).
3. **`02`** — §17 Seller App: обучение (маршрут, отказ/прерывание/повторный запуск), чек-лист,
   цели развития, ручной вход.
4. **`03`** — §3 `stores` (4 tutorial-колонки), §13–17 (семантика growth-фактов; отметить, что
   `order_status_history` впервые получает читателя).
5. **`04`** — таблица edge-функций (`store-actions` action `tutorial-state`; `seller-dashboard`
   расширение), testing (harness Test 35–37), при необходимости — упоминание z-band оверлея.
6. **`25`** — §4.4 `AttentionBlock`: пометить переопределённым чек-листом (`26`).
7. **`16`/`11`** — follow-up'ы захода (manual TELEGRAM-сверка, deferred-пункты §8).
8. Данные формулировки считать каноном для тест-матрицы: пункты-ссылки на §1.6/§1.7, без
   самостоятельных переопределений.

В документации явно указывать: оформление — рекомендация, не блокировка; название показывается
выполненным, но не входит в progress denominator; обучение не является источником истины для
готовности магазина.

---

## 10. Итоговая рекомендация и порядок

Реализовывать в таком порядке (внешний §16): **аудит точек интеграции ✅ → чистые функции и
контракты (`TUT-01`) → минимальное состояние обучения (`TUT-02`) → чек-лист на реальных данных
(`TUT-03`) → welcome/manual entry (`TUT-04`) → guided product creation (`TUT-05`) → buyer view /
public storefront (`TUT-06`) → overlay и свободная навигация (`TUT-07`) → цели заказов (`TUT-08`) →
регрессия и полировка (`TUT-09`)**.

Самое важное — не смешивать tutorial state, готовность магазина и прогресс заказов. При таком
разделении онбординг и лёгкая геймификация внедряются без отдельной инфраструктуры, без лишних
запросов и без риска, что интерфейс покажет достижения, не соответствующие реальным данным.

**Следующий обязательный шаг перед кодированием:** утвердить решения §8 (1–8.8) — после этого ТЗ
считается полным, и `TUT-01` можно начинать.

---

## Приложение A. Карта кода (сверка на 2026-10-15)

| Тезис плана | Артефакт(ы) | Вывод |
|---|---|---|
| Онбординг-создание магазина — отдельное явление | `SellerOnboardingView.tsx:76-96`, `router.tsx:67-72`, edge `shop-create.js:61-88` | ✅ терминология разведена; tutorial — новое |
| Создание магазина даёт точку старта welcome | `auth-slice.ts:170-173` → роутер меняет экран | ✅ триггер welcome = mount dashboard |
| `stores` — субъект tutorial state | `store.ts:10-27`, `03 §3`, `0001:33-41`, `0056` | ✅ 4 колонки; backfill declined |
| Profile-RPC-проекция | `0012:98-113`, `0056:96-111`; `auth-slice.ts:292-304` | ⚠️ merge/расширение — TUT-02 |
| Гранты/безопасность RPC | `0048:21-45`, `stores_assert_owner` (`0012:9-28`) | ✅ паттерн применён к новым функциям |
| Сводка главной — точка расширения counts | `0055:15-95`, `useSellerDashboard.ts:51-71`, `dashboard-cache.ts:18-27` | ✅ +`buyerAvailableProducts` (0058), +`growth` (0059) |
| Блоки главной и место чек-листа | `SellerDashboard.tsx:45-64`, `AttentionBlock.tsx:8-15` | ✅ вставка первым блоком; AttentionBlock переопределяется |
| Доступность товара — семантика витрины | `0023:159-165`, `0037:321-328`, `0043:174-184` | ✅ счётчик обязан повторить эту семантику |
| «Черновиков» нет, архив не засчитывается | `product.ts:1-3`, `product_set_status_atomic` (`0011:443-482`) | ✅ пункт по `ACTIVE` + вариант с остатком |
| Категории: серверный счётчик ACTIVE | `0055:88-91`, `categories.ts:2-3` (UNC — виртуальная) | ✅ используем как есть |
| Support-контакт: нормализация клиентская | `store-contact-rules.ts:9,20-33`, `0012:93` | ✅ валидируем значение при readiness |
| Orders: статусы/исходы терминальны | `0007:31-152`, `0049:47-59`, `0051:32-126` | ✅ growth-факты устойчивы |
| Историчность первого заказа/отправки | `orders` не удаляется; `order_status_history` (`0003:56-67`), `0007:72-84` | ⚠️ history write-only — добавить чтение (0059) |
| `completed_at` — маркер RECEIVED | `0051:102-107` | ✅ цель 3 |
| Self-order отличим | `buyer_user_id NOT NULL` (`0003:9`) | ✅ решение §8.4; реализация в 0059 |
| Product create — контур с productId | `ProductDraftEditor.tsx:92-103`, `useProductDraftSave.ts:39-64`, `createProductViaApi` → `0011:160` | ✅ сигнал успеха; никаких auto-create |
| Product create не идемпотентен | `product-slice.ts:152-159` | ⚠️ ограничение учтено (§1.3) |
| Buyer view — in-app preview | `useProductPreview.ts:14-28`, `DetailsView.tsx:34-65` | ✅ шаг 3 без внешних webview |
| Витрина — внешний диплинк | `storefront-link.ts:68-79`, `telegram-app.ts:441-455`, `SellerSettingsView.tsx:207-211` | ✅ шаг 4; возврат через persisted state + visibilitychange |
| Оверлей-примитив и z-stack | `BottomSheet.tsx:5-43`, `components.css:822-866`; z: nav 30 / sheet 40-51 / toast 60 | ✅ band 35/36; скрытие при шитах |
| Viewport/fullscreen/keyboard | `telegram-app.ts:107-176,264-284`, `useViewportSnapshot.ts:9-23`, `globals.css:76-91` | ✅ пересчёт позиций на существующих событиях |
| Точка ручного запуска | `SellerSettingsView.tsx:169-231`, `SettingsRow.tsx:19-95` | ✅ новая строка (§4.1) |
| Persistent-precedent (не серверный) | `useSellerSocialSeen.ts:14-68` | ⚠️ для tutorial недостаточно — сервер (§3.3) |
| Realtime заказов | `useOrdersRealtime.ts:47-69`, `0047:28-59`, payload `0047:45` | ✅ сводка перезапрашивается целиком |
| Harness/гейты | `scripts/commerce-harness.mjs` (Test 1–34), `package.json:6-21` | ✅ Test 35–37 добавляются этапами |

### Нумерация миграций

Заход использует **`0057`** (tutorial state), **`0058`** (readiness count), **`0059`** (growth),
**`0060`** (growth без self-фильтра — пересмотр §8.4). Текущая применённая в проекте — `0060`.
Следующие — по мере необходимости.

### Изменяемые/новые файлы (обзор)

```text
docs/26_SHOPPIS_SELLER_TUTORIAL_PROGRESS_PLAN.md          ← этот документ
migrations/0057_seller_tutorial_state.sql                 ← TUT-02 (new)
migrations/0058_seller_dashboard_readiness.sql            ← TUT-03 (new; re-create seller_dashboard_read)
migrations/0059_seller_growth_read.sql                    ← TUT-08 (new; re-create seller_dashboard_read)
migrations/0060_seller_growth_all_orders.sql              ← §8.4 пересмотрено (new; growth без self-фильтра)
edge-functions/store-actions.js                           ← TUT-02 (action tutorial-state)
edge-functions/seller-dashboard.js                        ← TUT-08 (без изменений контракта, только новые поля ответа)
src/domain/models/tutorial.ts                             ← TUT-01 (new)
src/domain/rules/tutorial-rules.ts                        ← TUT-01 (new)
src/domain/rules/readiness-rules.ts                       ← TUT-01 (new)
src/domain/rules/growth-rules.ts                          ← TUT-01 (new)
src/application/hooks/useSellerTutorial.ts                ← TUT-02 (new)
src/application/read-models/seller-dashboard.ts           ← TUT-03/08 (расширение)
src/application/mappers/dashboard-mappers.ts              ← TUT-03/08 (расширение)
src/application/store/slices/auth-slice.ts                ← TUT-02 (updateTutorialState, merge currentStore)
src/domain/models/store.ts                                ← TUT-02 (tutorial-поля)
src/infrastructure/repositories/store-repository.ts       ← TUT-02 (StoreRow/mapStore)
src/infrastructure/functions/store-settings-api.ts        ← TUT-02 (+ .dev.ts)
src/application/hooks/useProductDraftSave.ts              ← TUT-05 (notifyProductSaved)
src/presentation/seller/tutorial/**                       ← TUT-04…07 (new: welcome sheet, overlay, card, css)
src/presentation/seller/dashboard/components/DashboardChecklistBlock.tsx  ← TUT-03 (new)
src/presentation/seller/dashboard/components/DashboardGrowthBlock.tsx     ← TUT-08 (new)
src/presentation/seller/dashboard/dashboard.css           ← TUT-03/08 (расширение)
src/presentation/seller/views/SellerDashboard.tsx         ← TUT-03 (вставка блока, замена AttentionBlock)
src/presentation/seller/views/SellerSettingsView.tsx      ← TUT-04 (строка запуска обучения)
src/presentation/seller/components/SellerNavBar.tsx       ← TUT-07 (data-tour)
src/presentation/seller/views/InventoryView.tsx           ← TUT-07 (data-tour на «+»)
src/presentation/seller/components/ProductForm.tsx        ← TUT-07 (data-tour)
src/presentation/seller/views/ProductView.tsx             ← TUT-07 (data-tour на preview)
src/infrastructure/i18n/locales/ru.json                   ← TUT-04…08 (новые ключи)
src/infrastructure/i18n/locales/en.json                   ← TUT-04…08 (паритет с ru)
scripts/commerce-harness.mjs                              ← TUT-02/03/08 (Test 35–37)
docs/00, 01, 02, 03, 04, 16, 25                            ← docs-sync (§9)
```

**Роутер не меняется** (`src/router.tsx`): обучение — оверлей поверх существующих экранов; новых
маршрутов нет.
