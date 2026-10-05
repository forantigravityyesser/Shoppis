# SHOPPIS — SELLER INVENTORY HARDENING AUDIT

**Version:** 1.0
**Дата:** 2026-10-05
**Репозиторий:** `forantigravityyesser/Shoppis`
**Базовый срез кода:** `main @ ee79300` («Обновления инвентаря») + рабочее дерево (Cart/checkout-правки — отдельный незакоммиченный трек, в этот hardening не входит).
**Объект:** Seller Inventory **после реконструкции `19`** — `InventoryView → Products/Categories → CategoryView → ProductView/ProductForm → hooks → read-models/mappers → Zustand slices → repositories → domain rules → SQL/edge → tests → docs`.
**Вне области:** Cart/checkout (параллельный трек), buyer Home/Catalog (уже hardened — `15`/`17`), Product Detail write-flow, RLS/безопасность (`11` S1), review/question write-flow.

**Связанные документы:** `06` (Seller Inventory Spec), `07` (Inventory UX Spec), `08` (Divergence), `09` (Inventory Implementation Plan), `11` (Hardening Backlog), `14` (Product Detail Plan), `16` (Remaining Work), `17` (Catalog Plan), `18` (Cart Plan), `19` (Inventory Reconstruction).

**Статус документа:** authoritative для hardening-захода Seller Inventory. Переносит внешний повторный аудит (пост-`19`) в формат проекта, сверяет его с фактическим кодом и фиксирует целевые решения и порядок исправлений. Пункты, помеченные как *устаревшие*, отменяются; решения §3 обязательны к исполнению.

> **Разбор кода — обязателен к прочтению:** `Приложение A` содержит сверку утверждений с фактическим кодом (`файл:строка`) и список **живых SQL-функций**, которые затрагивает P0.

---

## 0. Метод и легенда

Документ построен в два движения:

1. **Разбор** — сверка каждого тезиса внешнего аудита с фактическим кодом на срезе `ee79300`. Аудит писался по памяти/по более раннему состоянию, поэтому часть пунктов уже сделана, часть сформулирована неточно, часть подтверждается и остаётся работой, а часть **шире**, чем в аудите. Разбор — §2; детальная таблица — `Приложение A.2`.
2. **Идея** — зафиксированная целевая модель, решения и порядок hardening — §3–§16.

Легенда статуса:

| Метка | Значение |
|---|---|
| ✅ | Реализовано в коде и проверено (указан файл/строка) |
| 🟡 | Частично: часть уже есть, часть остаётся |
| ❌ | Не реализовано / отсутствует |
| 🔄 | Решение меняется относительно внешнего аудита (переопределение) |
| ⏭️ | Устарело: аудит описывает состояние, которого уже нет |
| 🧊 | Deferred: осознанно отложено, с триггером включения |

Severity hardening: **H1** обязательно · **H2** высоко · **H3** средне · **H4** косметика.

---

## 1. Финальный вердикт

Оценка внешнего аудита сохранена как позиция аудитора; в скобках — уточнение после сверки с кодом.

| Область | Оценка |
|---|---|
| Onion Architecture | **9/10** (подтверждено) |
| Разделение Presentation/Application/Domain/Infrastructure | **9/10** (подтверждено) |
| Inventory decomposition | **8.5/10** (подтверждено) |
| Products section | **9/10** (подтверждено) |
| Categories section | **8/10** (подтверждено) |
| Product Form | **8.5/10** (подтверждено) |
| Variant business logic (форма) | **9/10** (подтверждено) |
| Variant business logic (сквозная цена) | **не оценивалось в аудите — 🔴 P0-дефект** (§4) |
| Category mutations | **8.5/10** (подтверждено) |
| State management | **8.5/10** (подтверждено) |
| DRY | **8/10** (подтверждено) |
| God components/files | **8/10** (подтверждено) |
| Tests | **8.5/10** (подтверждено; аудит недооценил — часть уже есть) |
| Documentation | **8/10** (подтверждено) |
| Масштабируемость | **8.5/10** (подтверждено) |

**Общая оценка: ~8.6/10** (против ~7.5/10 до реконструкции) — принята.

**Главное:**

- Переписывать архитектуру **не надо**. Onion-границы соблюдены: `Presentation → Application → Domain`, `Infrastructure` реализует контракты; `Presentation`/`Domain` не ходят в InsForge/Zustand напрямую.
- Экран Inventory больше не God component; `ProductForm` — не God (бизнес-правила вынесены в `application/rules/variant-form.ts`); новые God-файлы не появились.
- Реальная работа — **точечный hardening**, а не реконструкция:
  1. 🔴 **P0** — независимые оси custom-цены и custom-скидки варианта. В аудите описан seller-маппинг; по коду дефект **шире**: JS-маппинг (2 пути), `effectivePrice` и **8 живых SQL-функций** (buyer read + checkout). §4.
  2. 🟠 **P1** — привести mutation API к одному стилю (`throw`). §5.
  3. 🟠 **P1** — тесты: маппинг/round-trip 4 комбинаций, mutation-lifecycle категорий (save/delete). §6.
  4. 🟡 **P2** — переименование `CategoryGrid/CategoryCard` + CSS-классов; вынос derived data из `InventoryView`; lint-гигиена. §7–§11.
  5. 🧊 Deferred с триггером — производительность 100+ товаров (N+1 social summary), split `inventory.css`, ручная визуальная проверка. §9.

---

## 2. Разбор аудита против кода

### 2.0 Что в аудите устарело / неточно

| Тезис аудита | Реальность в коде | Вывод |
|---|---|---|
| §15–16 «submit protection сделан правильно» — ок | `submittingRef` + `submitting` (`ProductForm.tsx:100-103,192-211`), кнопки disabled, ошибка с retry | ✅ подтверждено, работы нет |
| §33 «проверить submit tests (double click → one request, failure → retry)» | Уже покрыто: `ProductForm.test.tsx:22-44` (double click/прогресс), `:46-63` (reject → alert → повтор) | ⏭️ устарело, работы нет |
| §25–28 «документация расходится по Reviews/Questions; надо окончательно зафиксировать» | Решение заказчика уже зафиксировано: `19 §24–25`, `00`, `06` (шапка + ADR-06.7), `08 §2.1`; `ProductView.tsx:14-19` рендерит `Карточка/Отзывы/Вопросы/Витрина`, `ProductOverview` без ссылок | ⏭️ устарело, работы нет (кроме контрольной сверки `07`, §12) |
| A.4.3 «`AddVariantSheet` — fire-and-forget, `addVariant` без `await`» | Уже `await` + `saving` + `saveError` + close только при успехе (`AddVariantSheet.tsx:44-63`) | ⏭️ устарело; **но** heuristic внутри `addVariant` — часть P0 (§4.2) |
| §33 «нужны тесты категорий: save rejects → sheet open, save resolves → close» | `EditCategorySheet.test.tsx` покрывает только реордер; save/delete — **нет** | ❌ остаётся работой (§6) |
| §33 «long category name / archived count / position + long name» | `CategoryCard.test.tsx` — только rank-бейдж; `CategoryGrid.test.tsx` — layout/row | ❌ остаётся работой (§6, §10) |
| §31 N+1 social summary | Подтверждено (`InventoryProductRow.tsx:16-27`, `useSellerProductSocial.ts:103-133`) | ✅ подтверждено; 🧊 deferred с триггером (§9) |
| §25 CSS 38 KB | Фактически `inventory.css` — **1978 строк** | 🧊 deferred (§9) |

### 2.1 Ревизия ключевых тезисов аудита

| № | Тезис аудита | Статус | Факт в коде |
|---|---|---|---|
| 1 | Mapping связывает price и discount одним `custom` | ❌ подтверждён | `useInventoryActions.ts:63-73`: `const custom = v.priceMode === 'CUSTOM' || v.discountMode === 'CUSTOM'`; `customOriginalAmountMinor: custom ? v.priceMinor : null` |
| 2 | Отдельно custom price / inherited discount ломается | ❌ подтверждён | Тот же участок: при `priceMode=INHERITED, discountMode=CUSTOM` цена тоже пишется как custom (текущее inherited-значение замораживается) |
| 3 | Form model имеет 2 оси, persistence — 1 режим | ✅ подтверждён | `variant-form.ts:11-21` (`priceMode`, `discountMode`); `domain/models/product.ts:3` (`VariantPriceMode`); несовпадение моделей реально |
| 4 | `effectivePrice` привязывает скидку к custom-цене | ❌ подтверждён | `product-rules.ts:40-47`: `useCustom = priceMode==='CUSTOM_PRICE' && customOriginalAmountMinor != null`; скидка берётся только внутри `useCustom` |
| 5 | Быстрый вариант (`AddVariantSheet`) — та же болезнь | ❌ подтверждён | `useInventoryActions.ts:194-195,204-206`: `useCustom = !isFirst && (price≠base || discount≠base)` — оба поля замораживаются |
| 6 | Buyer/checkout используют связанную логику | ❌ подтверждён, **шире аудита** | 7 живых read-функций + `create_order_atomic` гейтят по `custom_original_amount_minor is not null` для цены **и** скидки (Приложение A.3) |
| 7 | Mutation API — три разных стиля | ✅ подтверждён | throw: `createCategory/updateCategory/createProduct/updateProduct/assignProducts/deleteProduct/updateVariantStock/addVariant/moveHeldToAvailable`; boolean+`console.error`: `deleteCategory:116-124`, `reorderCategory:127-135`; typed result+`console.error`: `setProductStatus:163-175` |
| 8 | `CategoryGrid` больше не grid | ✅ подтверждён | `CategoryGrid.tsx:31-47` рендерит `.inv-grid` (flex column, `inventory.css:184-188`) + `.inv-grid__row` |
| 9 | `CategoryCard` — presentation, не God | ✅ подтверждён | `CategoryCard.tsx` (~96 строк): identity/rank/count/preview/actions, без данных/мутаций/роутинга |
| 10 | Derived data живёт в `InventoryView` | ✅ подтверждён | `InventoryView.tsx:37-73`: `reorderable`, `positionsByCategory`, `categoryNameById`, `userCategoryIds`, `existingProductIds` |
| 11 | `useInventoryHome` — watchlist, не God | ✅ подтверждён | `useInventory.ts:41-134`: sort/group/count/build/totals — всё Inventory read model |
| 12 | `inventory-mappers` — чистый read-model слой | ✅ подтверждён | `inventory-mappers.ts` (`buildCategoryItem`/`buildSystemCategoryItem`/`buildProductItem`/`buildProductDetail`) |
| 13 | Repository layer — Infrastructure | ✅ подтверждён | `category-repository.ts` (InsForge + edge), presentation его не видит |
| 14 | Domain rules используются правильно | ✅ подтверждён | `domain/rules/category-rules.ts`, `product-rules.ts`, `inventory-rules.ts` |
| 15 | Reorder — textbook separation | ✅ подтверждён | domain `reorderCategories` → slice rollback → infra `setCategoryOrder` → `ReorderCategorySheet` |
| 16 | Responsive устранён архитектурно | ✅ подтверждён | `.inv-grid` flex column; `.inv-cat__name` `min-width:0` + ellipsis (`inventory.css:234-243`); pair/compact удалены |
| 17 | `ProductMiniCard` переиспользуется (DRY) | ✅ подтверждён | `InventoryProductRow`, `CategoryView` |
| 18 | Attention logic вынесена | ✅ подтверждён | `InventoryProductRow.tsx:17-25` → `ProductMiniCard attention` |
| 19 | Entity «отзывы/вопросы остаются секциями» | ✅ подтверждён | `ProductView.tsx` + бейджи; `ProductOverview` без действий |
| 20 | Onion чек-лист | ✅ | Presentation→Infrastructure — отсутствует; Domain→React/InsForge/Zustand — отсутствуют |

**Вывод разбора:** архитектуру трогать не нужно; реальная работа — P0 (§4), mutation API (§5), тесты (§6), переименование/derived/lint (§7–§11). Пункты §27–28 и A.4.3 внешнего аудита закрыты ещё в `19`.

### 2.2 Точная граница P0 (важно: шире аудита)

Аудит предлагает исправить seller-маппинг и `effectivePrice` (вариант A — оставить доменную модель `VariantPriceMode`, где `CUSTOM_PRICE` означает «есть хотя бы одно custom-значение», а конкретное поле определяет переопределение). Это верно, **но недостаточно**: покупатель и checkout считают цену на SQL по связанному гейту.

Слой за слоем P0 затрагивает:

```text
Form (2 оси)                      variant-form.ts               ✅ уже независимо
      ↓
Application mapping (persistence) useInventoryActions.ts        ❌ P0 (2 пути)
      ↓
Domain effective price            product-rules.ts              ❌ P0
      ↓
Buyer/checkout SQL (8 функций)    migrations/**                 ❌ P0 (Приложение A.3)
      ↓
Read-back в форму                 ProductForm.detailToFormValues ✅ совместимо после фикса
```

Без SQL-фикса «правильный» JS-маппинг приведёт к расхождению: продавец видит свою скидку/цену, покупатель — старую (или наоборот). Поэтому `INV-HARDEN-01` и `INV-HARDEN-02` идут вместе и не считаются закрытыми по отдельности.

### 2.3 Дополнительные находки (вне внешнего аудита)

1. **`toCatalogFields` не экспортирован** и не тестируется — известный остаток `11 S2`. Закрывается при выносе в `application/rules/` (§4.2).
2. **5 lint-предупреждений `set-state-in-effect`** именно в Inventory: `CategoryAddSheet:48`, `EditCategorySheet:56`, `ProductPreviewRow:38`, `AddVariantSheet:33`, `StockControlSheet:58`; плюс `react-refresh` в `ProductForm:51`. Всего в проекте 8 warnings / 0 errors. §11.
3. **`ProductPreviewRow`/`ProductMiniCard`** не мемоизированы — при 100+ товарах это второй (после N+1) фактор; входит в deferred-триггер §9.
4. **No backfill:** в БД могут быть варианты, ошибочно замороженные текущим маппингом (например `price_mode=CUSTOM_PRICE` при custom только по скидке). Backfill не делаем (нельзя восстановить намерение); значение самоисправится при следующем сохранении товара. Явно фиксируется в §4.4.

---

## 3. Authoritative решения

### 3.1 Независимость custom-цены и custom-скидки 🔄

Принимается **вариант A** внешнего аудита, расширенный на SQL и checkout.

Четыре допустимых состояния и ожидаемое поведение:

| Цена | Скидка | `price_mode` (persistence) | `custom_original` | `custom_discount` | Эффективно |
|---|---|---|---|---|---|
| inherited | inherited | `USE_PRODUCT_PRICE` | `null` | `null` | цена и скидка товара |
| custom | inherited | `CUSTOM_PRICE` | значение | `null` | своя цена, скидка товара |
| inherited | custom | `CUSTOM_PRICE` | `null` | значение | цена товара, своя скидка |
| custom | custom | `CUSTOM_PRICE` | значение | значение | своя цена и скидка |

`CUSTOM_PRICE` означает ровно «есть хотя бы одно custom-значение»; конкретное поле решает, что переопределено. `null` в поле = «наследуй соответствующую ось от товара».

### 3.2 Единый стиль mutation API 🔄

Все пользовательские seller-мутации: **успех → resolve, ошибка → throw**. Для смены статуса товара бросается `ProductStatusError` (сохраняет машинный код `NO_ACTIVE_VARIANT | NOT_FOUND | UNKNOWN`). Presentation обрабатывает через `try/catch`. `console.error`-глотание в application-хуках убирается (логирование — задача presentation после обработки). Согласуется с `19 §13`.

### 3.3 Переименование категорий 🔄

Семантика UI — вертикальный список полноширинных строк, не grid. Принимается полное переименование, включая CSS-классы:

```text
CategoryGrid.tsx        → InventoryCategoryList.tsx
CategoryCard.tsx        → InventoryCategoryRow.tsx
CategoryGrid.test.tsx   → InventoryCategoryList.test.tsx
CategoryCard.test.tsx   → InventoryCategoryRow.test.tsx
.inv-grid               → .inv-cat-list
.inv-grid__row          → .inv-cat-row
```

`.inv-cat*` (карточка) сохраняет имя. `InventorySkeleton` и тесты обновляются.

### 3.4 Reviews/Questions — окончательно

Секции `Отзывы`/`Вопросы` **остаются** per-product в навигации seller-карточки с индикаторами; из `ProductOverview` удалены только действия. Это уже реализовано (`19` Phase B) и синхронизировано (`00`, `06`, `08`). Контрольная сверка `07` — в `INV-HARDEN-09`. Расхождение «документация vs первоначальный draft» закрыто: draft переопределён правкой заказчика, зафиксированной в `19 §24–25`.

### 3.5 Responsive и производительность

- **Responsive** считается закрытым архитектурно (full-width + ellipsis). Новых layout-изменений не планируется; добавляются только regression-тесты структуры и остаётся ручная визуальная проверка.
- **Производительность 100+** — осознанно **отложена с триггером** (решение заказчика), раздел §9.

---

## 4. P0 — независимые оси цены/скидки

### 4.1 Целевая модель (JS)

```ts
// domain/rules/product-rules.ts
const isCustom = variant.priceMode === 'CUSTOM_PRICE';
const originalAmountMinor = isCustom
  ? (variant.customOriginalAmountMinor ?? product.originalAmountMinor)
  : product.originalAmountMinor;
const discountPercent = isCustom
  ? (variant.customDiscountPercent ?? product.discountPercent)
  : product.discountPercent;
```

Важно: `coalesce` именно per-axis, а не по `customOriginalAmountMinor != null`; `customDiscountPercent = 0` — валидное custom-значение (не `null`).

### 4.2 JS-фиксы

1. **Вынести `toCatalogFields` (и `resolveCategoryId`) в `application/rules/product-mapping.ts`** — чистая функция, тестируемая, закрывает `11 S2`. Маппинг осей:

```ts
const priceCustom = v.priceMode === 'CUSTOM';
const discountCustom = v.discountMode === 'CUSTOM';
const hasCustom = priceCustom || discountCustom;
return {
  priceMode: hasCustom ? 'CUSTOM_PRICE' : 'USE_PRODUCT_PRICE',
  customOriginalAmountMinor: priceCustom ? v.priceMinor : null,
  customDiscountPercent: discountCustom ? v.discountPercent : null,
};
```

2. **`useInventoryActions.addVariant`** (быстрый вариант) — независимое сравнение с базой по каждой оси:

```ts
const priceCustom = !isFirst && input.priceMinor !== basePrice;
const discountCustom = !isFirst && input.discountPercent !== baseDiscount;
const hasCustom = priceCustom || discountCustom;
// priceMode: hasCustom ? CUSTOM_PRICE : USE_PRODUCT_PRICE
// customOriginalAmountMinor: priceCustom ? input.priceMinor : null
// customDiscountPercent: discountCustom ? input.discountPercent : null
```

3. **`domain/rules/product-rules.ts:effectivePrice`** — по §4.1.

4. **`ProductForm.detailToFormValues`** (`:59-66`) — round-trip уже совместим (режим каждой оси выводится из `null`-ности соответствующего поля); добавляется тест, кода не меняем.

### 4.3 SQL-фиксы (миграция `0037`)

Новая миграция `0037_variant_effective_price_independent.sql` пересоздаёт **живые** функции, считающие эффективную цену, на per-axis `coalesce`. Список — `Приложение A.3`. Общий паттерн:

```sql
-- было: гейт по custom_original_amount_minor для обеих осей
-- стало:
case
  when vv.price_mode = 'CUSTOM_PRICE'
    then coalesce(vv.custom_original_amount_minor, v_product.original_amount_minor)
  else v_product.original_amount_minor
end as original_amount_minor,
case
  when vv.price_mode = 'CUSTOM_PRICE'
    then coalesce(vv.custom_discount_percent, v_product.discount_percent)
  else v_product.discount_percent
end as discount_percent
```

Для `create_order_atomic` (`0004`) — аналогичный per-axis выбор в `v_original` / `v_discount`; snapshot заказа дальше не меняется.

`product_create_atomic`, `product_update_atomic`, `variant_create_atomic` (`0011`) **не меняем** — они лишь персистят переданные поля; после JS-фикса получают корректные комбинации.

Порядок: применить файл целиком через admin SQL, затем `npm run migrations:record -- 0037`, `npm run migrations:check` — зелёный.

### 4.4 Совместимость и без backfill

- Legacy-строки с `price_mode='CUSTOM_PRICE'` и обоими custom = `null` продолжают вести себя как «цена и скидка товара» (было — то же; регрессии нет).
- Ошибочно замороженные legacy-строки (custom только по одной оси, но оба поля не `null`) **не бэкфиллим**: восстановить намерение продавца невозможно. При следующем сохранении товара форма покажет обе оси как custom (текущая null-ность), продавец сможет вернуть нужную ось в inherited — значение самоисправится.
- В документе фиксируется явно, чтобы это не выглядело «недочищенным».

### 4.5 Тесты P0

- `product-rules.test.ts` — 4 комбинации `effectivePrice` (в т.ч. `customDiscountPercent=0`).
- `product-mapping.test.ts` (новый) — 4 комбинации `toCatalogFields`; пустая категория → `null`; `ARCHIVED` без цены.
- `ProductForm.test.tsx` — независимые оси: правит цену варианта 2 → custom только по цене; правит скидку варианта 2 → custom только по скидке; round-trip `detailToFormValues → buildPayload` сохраняет режимы.
- SQL — проверка на данных: для товара с 4 комбинациями сверить `storefront_product_detail_read`, `storefront_home_products_read`, `storefront_catalog_products_read`, `storefront_cart_items_read` и результат `create_order_atomic` (на временном магазине/товарах).

---

## 5. P1 — единый mutation API

Приводим `useInventoryActions` к §3.2:

| Action | Было | Стало |
|---|---|---|
| `createProduct` / `updateProduct` / `createCategory` / `updateCategory` / `assignProductsToCategory` / `deleteProduct` / `updateVariantStock` / `addVariant` / `moveHeldToAvailable` | уже throw | без изменений |
| `deleteCategory` | `Promise<boolean>` + `console.error` | `Promise<void>`, throw при ошибке |
| `reorderCategory` | `Promise<boolean>` + `console.error` | `Promise<void>`, throw при ошибке |
| `setProductStatus` | `ProductStatusResult` + `console.error` | `Promise<void>`, throw `ProductStatusError` при `!result.ok` (код сохраняется) |

Callers обновляются:
- `EditCategorySheet.remove` (`:106-117`) — `try/catch`, `deleteError`, форма/подтверждение не теряются;
- `useCategoryReorder` (`:26-45`) — `try/catch` вместо `ok`-ветки, `error` для retry;
- `ProductOverview.changeStatus` (`:36-43`) — `try/catch`, `ProductStatusError.code/message` в `statusError`;
- тесты `useCategoryReorder.test.tsx`, `EditCategorySheet.test.tsx`, `ProductOverview.test.tsx` — под новый контракт.

Слайсы (`category-slice`, `product-slice`) сохраняют внутренний контракт (`archiveProduct/restoreProduct` → typed result — это доменная валидация); адаптация к `throw` — в application-хуке.

---

## 6. P1 — тесты (пробелы)

Обязательные к добавлению:

- **Категории (mutation lifecycle):**
  - `updateCategory` reject → sheet остаётся открыт, показана ошибка, поля сохранены, повтор работает;
  - `updateCategory` resolve → `onClose` вызван;
  - `deleteCategory` reject → ошибка, подтверждение не сбрасывается, повтор возможен;
  - `deleteCategory` resolve → `onDeleted` + `onClose`.
- **Категории (структура/responsive):** длинное имя (ellipsis), `archivedCount > 0` («+N в архиве»), позиция + длинное имя — без pair/compact-разметки.
- **Маппинг/варианты:** см. §4.5.
- Уже существующие `double click → one request` и `failure → retry` (`ProductForm.test.tsx:22-63`) — считаются закрытыми, дублировать не нужно.

---

## 7. P2 — переименование (см. §3.3)

Этап чисто семантический: файлы, экспорты, импорты, тесты, CSS-классы, `InventorySkeleton`. Поведение не меняется; все тесты остаются зелёными. Папка и остальные `inv-*` классы не трогаются.

---

## 8. P2 — derived data / read model

1. Вынести из `InventoryView` (`:37-73`) в application-слой:
   - `positionsByCategory`, `userCategoryIds`, `categoryNameById` — в `useInventoryHome()` (уже владеет категориями/товарами);
   - `existingProductIds` (товары категории) — в чистый builder/селектор (`buildCategoryAssignment`), тестируемый.
2. `useInventoryHome` остаётся корневым read-model хуком; при добавлении сущностей (фильтры, сток-группы, аналитика) — выделять отдельные `.build*View()` билдеры в `application/read-models/`. **Watchlist:** больше бизнес-вычислений в хук не складывать.
3. `InventoryView` после выноса — композиция: header + switcher + sections + sheets.

---

## 9. Производительность Inventory (100+ товаров) 🧊

**Решение:** deferred с явным триггером (согласовано). Раздел фиксируется, чтобы пункт не потерялся.

### 9.1 Что известно

- На каждый товар `InventoryProductRow` вызывает `useSellerProductSocialSummary` → один `useQuery` → **2 RPC** (`loadProductReviews` + `loadProductQuestions`, полные ленты) — `useSellerProductSocial.ts:103-133`. На 100 товарах ≈ 100 записей / 200 запросов; `useSeenReviewIds` — localStorage, без сети.
- Список рендерит все строки без виртуализации/windowing; `ProductMiniCard`/`ProductPreviewRow` не мемоизированы.
- `19 §2` прямо относит пагинацию/виртуализацию к не-целям для текущих объёмов.
- Buyer-сторона (Home/Catalog) уже серверная с cursor/infinite (`15`, `17`) — там 100+ товаров закрыты.

### 9.2 Триггер включения

Любой из:
- каталог продавца устойчиво ≥ **100** товаров; или
- замер: загрузка секции «Товары» / скролл заметно деградируют; или
- жалоба/метрика по времени до интерактива.

### 9.3 План действий при срабатывании

1. Один bulk-RPC `seller_products_social_summary_read(p_store_id)` → `{ productId: { reviewIds, unansweredQuestions } }`; `InventoryProductRow` читает из общей мапы вместо per-product query. Seen-фильтр остаётся клиентским.
2. При необходимости — memo/виртуализация списка и превью.
3. Метрика до/после на тестовом магазине 100/500.

### 9.4 Прочее deferred (косметика)

- Split `inventory.css` (1978 строк) на `inventory-home.css` / `category.css` / `product-form.css` / `product-view.css` — только после визуальной проверки, с осторожностью к каскаду.
- Ручная визуальная проверка responsive и маршрутов в браузере/Telegram — за человеком.

---

## 10. Responsive

Архитектурно закрыт (см. §2.1 п.16). В этом заходе:

- regression-тесты структуры строк категорий (длинное имя, архивный счётчик, позиция) — §6;
- никаких layout-переписываний;
- `LOCAL`/`TELEGRAM VERIFIED` — за человеком.

---

## 11. Lint-гигиена (Inventory)

Закрыть 5 `react-hooks/set-state-in-effect` (сброс состояния формы/индекса в `useEffect`) через `key`-remount или производное состояние:

- `CategoryAddSheet.tsx:48`
- `EditCategorySheet.tsx:56`
- `ProductPreviewRow.tsx:38`
- `AddVariantSheet.tsx:33`
- `StockControlSheet.tsx:58`

Плюс `react-refresh/only-export-components` в `ProductForm.tsx:51` — вынести типы/константы. Цель — `npm run lint` без warning по Inventory. `CatalogFilterSheet` (вне Inventory) — не трогаем.

---

## 12. INV-HARDEN — план этапов

Один этап за раз: реализация → `typecheck`/`lint`/`test` → сверка → следующий.

### Phase A — P0 корректность

- **`INV-HARDEN-01`** 🔴 `H1` — независимые оси в seller-слое.
  - Вынести `toCatalogFields`/`resolveCategoryId` в `application/rules/product-mapping.ts`; починить оси (`:63-73`).
  - Починить `addVariant` (`:194-208`).
  - Починить `effectivePrice` (`product-rules.ts:40-47`).
  - Тесты: `product-mapping`, 4 комбинации `effectivePrice`, независимые оси + round-trip в `ProductForm`.
- **`INV-HARDEN-02`** 🔴 `H1` — SQL: миграция `0037_variant_effective_price_independent.sql` (8 функций, Приложение A.3), `migrations:record/check`, проверка на данных 4 комбинаций (detail/home/catalog/cart/checkout).
- **`INV-HARDEN-03`** 🟠 `H1` — гейт: `typecheck` / `lint` / `test` / `build` зелёные.

### Phase B — P1 консистентность

- **`INV-HARDEN-04`** 🟠 `H1` — mutation API → throw + `ProductStatusError`; callers на `try/catch`; убрать `console.error`-глотание (§5).
- **`INV-HARDEN-05`** 🟠 `H2` — тесты категорий (save reject/resolve, delete error/success) + responsive-структура (§6).

### Phase C — P2 чистота

- **`INV-HARDEN-06`** 🟡 `H3` — переименование `CategoryGrid/CategoryCard` + CSS-классы + тесты + `InventorySkeleton` (§7).
- **`INV-HARDEN-07`** 🟡 `H3` — вынос derived data из `InventoryView` в `useInventoryHome`/builder + тесты (§8).
- **`INV-HARDEN-08`** 🟡 `H3` — lint-гигиена Inventory (§11).
- **`INV-HARDEN-09`** 🟠 `H1` — docs-sync, финальный аудит, `00`/`11`/`19`-история; `LOCAL`/`TELEGRAM VERIFIED` — за человеком.

### Рекомендуемый порядок

```text
01 Independent price/discount (JS)
   ↓
02 SQL migration 0037 (buyer + checkout)
   ↓
03 typecheck/lint/test/build gate
   ↓
04 Unified mutation API (throw)
   ↓
05 Category mutation + responsive tests
   ↓
06 Rename CategoryGrid/CategoryCard (+ CSS)
   ↓
07 Derived data → application
   ↓
08 Lint hygiene (set-state-in-effect)
   ↓
09 Docs sync + final audit
   ↓
(deferred с триггером: bulk social summary, split CSS, ручная проверка)
```

После этого Inventory не трогать без новой реальной проблемы — «чистка ради чистки» вреднее перехода к следующему блоку.

---

## 13. Матрица тестов

**P0 / variants:** 4 комбинации effective price · 4 комбинации mapping · round-trip форма↔payload · `customDiscountPercent=0` · ARCHIVED без цены.

**Product Form:** double click → 1 запрос (✅ есть) · reject → ошибка + повтор (✅ есть) · независимые оси · сохранение формы при ошибке.

**Categories:** save reject/resolve · delete reject/resolve · reorder reject/resolve/rollback (✅ есть) · длинное имя · архивный счётчик · позиция + длинное имя · отсутствие pair.

**Inventory:** секция по умолчанию · переключение · навигация · поиск · пустые состояния (✅ есть).

**SQL:** 4 комбинации через detail/home/catalog/cart/checkout · keyset buyer (уже покрыт `17`).

---

## 14. Definition of Done

- [ ] `effectivePrice` и SQL читают оси независимо; 4 комбинации подтверждены на данных.
- [ ] Рекурсия «сохранил → перезагрузил форму» сохраняет режимы осей.
- [ ] Mutation API единый (`throw`), `console.error`-глотания нет.
- [ ] Тесты категорий и responsive-структуры добавлены.
- [ ] Нет новых архитектурных нарушений; God-файлы не появились.
- [ ] `typecheck` / `lint` / `test` / `build` / `migrations:check` — зелёные.
- [ ] `inventory.css`-классы соответствуют семантике (list/row, не grid).
- [ ] Derived data не живёт в `InventoryView`.
- [ ] Docs синхронизированы (`00`, `06`, `07`, `08`, `11`, `19`, `20`).
- [ ] Deferred-пункты зафиксированы с триггером.
- [ ] Нет unrelated refactor.

---

## 15. Что НЕ делаем

❌ переписывать Zustand/DI/Onion · ❌ вторую state-библиотеку · ❌ React Query туда, где не нужен · ❌ backend-абстракции без необходимости · ❌ drag&drop, массовые операции, SKU, аналитика · ❌ пагинацию/виртуализацию до триггера §9 · ❌ RLS (гейт `11` S1, отдельно) · ❌ backfill вариантов (§4.4) · ❌ split CSS сейчас · ❌ ручную визуальную проверку вместо человека.

---

## 16. Финальный Inventory hardening audit

_Заполняется после `INV-HARDEN-01…09`._

| Этап | Что сделано | Артефакты |
|---|---|---|
| 01 Independent price/discount (JS) | — | — |
| 02 SQL migration `0037` | — | — |
| 03 Gate | — | — |
| 04 Unified mutation API | — | — |
| 05 Category/responsive tests | — | — |
| 06 Rename | — | — |
| 07 Derived data | — | — |
| 08 Lint hygiene | — | — |
| 09 Docs sync | — | — |

---

# Приложение A. Разбор относительно кода (2026-10-05)

## A.1 Метод

Сверка утверждений внешнего аудита и целевых решений с фактическим кодом `main @ ee79300`. Источники: `src/**`, SQL-миграции, edge-функции, `pg_proc` (live-функции backend), существующие тесты, `npm run lint`. Формат ссылок: `файл:строка`.

## A.2 Подтверждающие ссылки P0

| Место | Факт |
|---|---|
| `application/hooks/useInventoryActions.ts:57-91` | `toCatalogFields`: `custom` (`:64`), `priceMode`/`customOriginalAmountMinor`/`customDiscountPercent` (`:70-72`) |
| `application/hooks/useInventoryActions.ts:188-212` | `addVariant`: heuristic (`:194-195`), поля (`:204-206`) |
| `domain/rules/product-rules.ts:36-53` | `effectivePrice`, `useCustom` (`:40-41`), скидка внутри `useCustom` (`:45-47`) |
| `presentation/seller/components/ProductForm.tsx:171-190` | `buildPayload` строит 2 оси |
| `presentation/seller/components/ProductForm.tsx:51-77` | `detailToFormValues` выводит режимы из `null`-ности |
| `presentation/seller/components/ProductForm.tsx:100-103,192-211` | submit guard (уже P0 не задет) |
| `application/rules/variant-form.ts:49-142` | форма уже работает независимо по осям |
| `domain/rules/product-rules.test.ts:60-89` | покрыты только «оба custom» и fallback; независимых комбинаций нет |
| `migrations/0002_catalog.sql:80-97` | `variants`: `price_mode`, оба custom-поля nullable, constraints |

## A.3 Живые SQL-функции, затрагиваемые P0

Получено запросом к `pg_proc` (функции, чей `prosrc` содержит `custom_original_amount_minor`):

| Функция | Миграция-источник | Роль | Действие в `0037` |
|---|---|---|---|
| `create_order_atomic` | `0004_checkout.sql:130-136` | checkout: снапшот цены | per-axis `coalesce` |
| `storefront_product_detail_read` | `0015_storefront_product_detail_read.sql:131-141` | buyer detail: variants price | per-axis `coalesce` |
| `storefront_home_products_read` | `0023_storefront_home_split_read.sql:145-150` | buyer home stream | per-axis `coalesce` |
| `storefront_catalog_products_read` | `0026/0033` (`0026:118-123`, `0033:126-131`) | buyer catalog | per-axis `coalesce` |
| `storefront_catalog_price_bounds_read` | `0026/0033` | bounds фильтра цены | per-axis `coalesce` |
| `storefront_favorite_products_read` | `0035_storefront_favorite_products_read.sql:99-104` | favorites | per-axis `coalesce` |
| `storefront_cart_items_read` | `0036_storefront_cart_items_read.sql:104-108` | cart unit price | per-axis `coalesce` |
| `product_create_atomic` / `product_update_atomic` | `0011_catalog_atomic.sql:141-150,327-349` | персист полей | без изменений |
| `variant_create_atomic` | `0011_catalog_atomic.sql:410-419` | персист варианта | без изменений |

## A.4 Mutation API — карта

| Action | Строки `useInventoryActions.ts` | Текущий стиль | Целевой |
|---|---|---|---|
| `createCategory` | `:103-109` | throw | throw |
| `updateCategory` | `:111-113` | throw | throw |
| `deleteCategory` | `:116-124` | boolean + `console.error` | throw |
| `reorderCategory` | `:127-135` | boolean + `console.error` | throw |
| `createProduct` | `:137-146` | throw | throw |
| `updateProduct` | `:148-151` | throw | throw |
| `assignProductsToCategory` | `:154-161` | throw | throw |
| `setProductStatus` | `:163-175` | `ProductStatusResult` + `console.error` | throw `ProductStatusError` |
| `deleteProduct` | `:177-179` | throw | throw |
| `updateVariantStock` | `:181-186` | throw | throw |
| `addVariant` | `:188-212` | throw | throw (+ P0 оси) |
| `moveHeldToAvailable` | `:214-216` | throw | throw |

## A.5 Стейл-места документации

| Документ | Место | Статус |
|---|---|---|
| `19` | §24–25, §40 Phase B, §45.1 | ✅ Reviews/Questions зафиксированы |
| `00` | актуализация 2026-10-05 | ✅ указано |
| `06` | шапка, ADR-06.7, §17 | ✅ пересмотрено |
| `08` | §2.1 | ✅ закрыто |
| `07` | — | 🔎 контрольная сверка в `INV-HARDEN-09` |

## A.6 Нумерация миграции

Следующий свободный номер — **`0037`** (последняя применённая в репозитории — `0036_storefront_cart_items_read.sql`).

---

## История изменений

| Дата | Изменение |
|---|---|
| 2026-10-05 | Создан `20`: перенос внешнего повторного аудита Inventory в формат проекта, сверка с кодом (`ee79300`), решения (§3), P0 (§4, шире аудита — JS + 8 SQL-функций), план `INV-HARDEN-01…09`, deferred-раздел производительности 100+ с триггером. |
