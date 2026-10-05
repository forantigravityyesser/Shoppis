# SHOPPIS — PRODUCT DETAIL HARDENING PASS

**Статус:** `TODO` — рабочий документ (временный, удалить после закрытия pass).
**Дата:** 2026-10-05
**Источник:** внешний аудит блока Product Detail на `main` (`96e6946`, 2026-10-04).
**Правило захода:** не переписываем то, что уже работает и сделано хорошо. Правим только
точечные погрешности из аудита. Никаких Redux/CSS Modules/SSR/CQRS, менять routing/Onion/
read-model/галерею/React Query — запрещено. Оценка блока — ~8.1/10; после MUST FIX → ~8.8–9.0.

Severity: **P0** — обязательно перед закрытием этапа · **P1** — дёшево и стоит сделать сейчас ·
**P2** — можно после, отдельным заходом.

---

## 0. Сводка

| ID | Приоритет | Область | Суть | Статус |
|---|---|---|---|---|
| PD-H-01 | P0 | Security | `p_viewer_user_id` — клиентский identity для выдачи ARCHIVED social | DONE (код; миграция 0028 + edge ждут применения) |
| PD-H-02 | P0 | Backend logic | write-RPC не проверяют `product.status = ACTIVE` | DONE (объединено в миграцию 0029; ждёт применения + ручной SQL-прогон) |
| PD-H-03 | P0 | Backend logic | продавец может оставить отзыв/вопрос на свой товар | DONE (объединено в миграцию 0029; ждёт применения + ручной SQL-прогон) |
| PD-H-04 | P0 | CSS/визуал | `pd-gallery__main img` — `cover`, а док/комментарий обещают `contain` | DONE (нужна визуальная проверка desktop/mobile) |
| PD-H-05 | P1 | Presentation | seller импортирует buyer-компоненты и `buyer/product-detail.css` | DONE (shared/product-social + SafeImage; seller→buyer нет) |
| PD-H-06 | P1 | Boundaries | seller читает buyer storefront-read (нет `SellerProductSocialRepository`) | DONE (сделан вместе с PD-H-01) |
| PD-H-07 | P1 | Scaling | `relatedProducts` без верхней границы + рассинхрон чек-листа §12.6 | DONE (миграция 0030, limit 8; доки §7/§12.3 синхронизированы) |
| PD-H-08 | P1 | Tests | нет тестов `ProductImageViewer`; gesture-логика не вынесена | DONE (hook + pure helpers + 20 тестов) |
| PD-H-09 | P2 | Robustness | mapper слишком permissive (`invalid → ACTIVE` / `→ 0`) | DONE (строгий `storefront-product-mappers`; тесты обновлены) |
| PD-H-10 | P2 | DB integrity | `product_links` без DB-level tenant-инварианта | DONE (миграция 0031: composite FK; код без изменений) |
| PD-H-11 | P2 | DB hardening | `search_path` без `pg_temp`; не единый convention `EXECUTE` | TODO |
| PD-H-12 | P2 | CI | нет GitHub Actions (`typecheck/lint/test/build`) | TODO |
| PD-H-13 | P2 | Docs | рассинхрон номеров миграций `0024/0025` и формулировки «QA закрыт» | TODO |
| PD-H-14 | P2 | CSS | `product-detail.css` = 1389 строк (дробить при следующем feature) | DEFERRED |
| PD-H-15 | P2 | Presentation | `DetailsView` берёт на себя слишком много (или `useProductSelection`) | DEFERRED |

**Явно НЕ делаем** (см. §3): переписывание `DetailsView`, смена React Query/routing/галереи,
пагинация social, включение RLS прямо сейчас, CSS Modules, SSR, отдельный backend.

---

## 1. MUST FIX (P0)

### PD-H-01. Клиентский `viewerUserId` как identity для ARCHIVED social read — security

**Проблема.** Публичные read-RPC принимают `p_viewer_user_id` из клиента и используют его
как авторитетную identity:
- `migrations/0018_review_seller_read.sql:47-50` — при `status <> 'ACTIVE'` товар отдаётся,
  если `p_viewer_user_id = v_store.owner_user_id`;
- `migrations/0019_question_social.sql:57-60` — то же для вопросов;
- клиент вызывает RPC напрямую и сам подставляет id: `storefront-product-repository.ts:38-44,53-59`,
  `useStorefrontProduct.ts:81-88,127-134`, значение берётся из стора
  (`ProductReviewsView.tsx:22-23`, `ProductQuestionsView.tsx:19-20`, seller-версии ~`:22`/`:20`).

Итого: любой клиент может передать чужой (owner) UUID и прочитать отзывы/вопросы
**архивного** товара. Это authorization-баг: identity не должна приходить из параметра запроса.

**Дополнительно.** `isOwn` / `viewerReview` / `canReview` / `viewerQuestion` / `canAsk` тоже
выводятся из этого параметра — это UI-подсказки (запись всё равно проверяется в write-RPC),
но именно `canReview/canAsk` управляют видимостью композера. Сам по себе подлог подсказок
не даёт права на запись, поэтому реальная утечка — только ARCHIVED-чтение.

**Что сделать.**
1. Публичные RPC (`storefront_product_reviews_read`, `..._questions_read`) **не должны**
   использовать `p_viewer_user_id` для авторизации. Минимальный шаг: убрать owner-exception
   из публичного RPC (архивный товар → `null` для всех).
2. Seller-модерация архивных товаров (это реальная фича из `0018`) переезжает на отдельный
   путь, где actor берётся из серверной сессии:
   - новый edge-диспетчер (напр. `social-read` или read-actions в `review-actions`/
     `question-actions`), `verifySession()` → `session.uid` (см. `edge-functions/_shared/auth.js:46`,
     образец диспетчера — `review-actions.js:35-58`);
   - отдельная RPC `seller_product_reviews_read` / `seller_product_questions_read`
     (actor приходит из edge, а не из body).
3. Клиентский вызов публичного social-read оставить без viewer-параметра; viewer-контекст
   (isOwn/canReview) для авторизованного пользователя получать тем же session-путём, либо
   считать его неавторитетной UI-подсказкой и не использовать для доступа к архивным данным.

> **Ограничение:** пока кастомная Telegram-сессия не мапится на PostgREST/`auth.uid()` и
> `RLS` выключен, прямой вызов RPC с подделанным actor технически возможен (та же общая
> проблема `11 §S1`). Поэтому P0-эффект даёт именно **удаление owner-exception из публичного
> RPC**; полноценное закрытие — вместе с RLS/вариантом A (edge) в `11 §S1`. Это нужно явно
> записать в doc, а не молча оставить.

**Файлы:** `migrations/0018`, `migrations/0019` (новая миграция `0028`), `edge-functions/*`,
`src/infrastructure/repositories/storefront-product-repository.ts`,
`src/application/ports/storefront-product-repository.ts`, `src/application/hooks/useStorefrontProduct.ts`.

**Тесты (regression):**
- archived product + `viewerUserId = owner` → `null` через публичный путь;
- archived product + `viewerUserId = чужой` → `null`;
- seller через session-путь → видит; аноним → нет.

---

### PD-H-02. Write-RPC разрешают запись в ARCHIVED-товар — backend logic mismatch

**Проблема.** UI скрывает композер для архивных, но сервер это не проверяет:
- `review_create_atomic` проверяет store exists / `store.status = ACTIVE` / отсутствие
  дубликата, но **не** `product.status`: `migrations/0017_review_write.sql:41-52`;
- `question_create_atomic` — то же: `migrations/0020_question_write.sql:40-51`.

Прямой вызов RPC (edge) позволяет оставить отзыв/вопрос по архивному товару при активном
магазине. UI не является authorization boundary.

**Что сделать.** В обе функции после загрузки товара добавить проверку:
```sql
if v_product.status <> 'ACTIVE' then
  raise exception 'PRODUCT_NOT_FOUND';   -- наружу не раскрываем «archived»
end if;
```
(либо отдельный код `PRODUCT_ARCHIVED`, если решим раскрывать; публично достаточно
`PRODUCT_NOT_FOUND` — как предлагает аудит).

**Файлы:** новая миграция `0028` (пересоздать `0017`/`0020` функции), edge не меняется
(код ошибки уже маппится: `PRODUCT_NOT_FOUND → 404`, `review-actions.js:24`, `question-actions.js:25`).

**Тесты (regression):** create на archived product → reject (review и question).

---

### PD-H-03. Продавец может оставить отзыв/вопрос на собственный товар

**Проблема.** `review_create_atomic` (`0017:41-63`) и `question_create_atomic`
(`0020:40-62`) не проверяют `p_actor_user_id <> v_store.owner_user_id`. UI seller не
показывает композер, но сервер разрешает.

**Что сделать.** Запретить владельцу магазина писать отзыв/вопрос по своему товару:
```sql
if p_actor_user_id = v_store.owner_user_id then
  raise exception 'FORBIDDEN';
end if;
```
**Решение (DECIDE):** подтвердить, что self-review/self-question — не намеренная фича
(в `14` §8/§9 фичи нет; считаем запретом). `FORBIDDEN` маппится в 403.

**Файлы:** та же миграция `0028`.

**Тесты (regression):** owner create review/question на свой товар → reject.

---

### PD-H-04. Галерея: `cover` вместо заявленного `contain`

**Проблема.** Док и комментарии обещают `object-fit: contain` (`14` §4.2:237-238, §12.6;
комментарий `ProductGallery.tsx`), а реальный CSS — `cover`:
`src/presentation/buyer/product-detail.css:89-95` (`object-fit: cover; object-position: center`).
На широком экране это обрезает фото, тогда как full — уже 4:5.

**Что сделать.** Привести код к документу (аудит: правим CSS, а не док):
```css
.pd-gallery__main img {
  object-fit: contain;
  ...
}
```
Проверить визуально на desktop/широком viewport. `object-position` можно убрать (для
`contain` не нужен) либо оставить нейтральным.

**Файлы:** `src/presentation/buyer/product-detail.css:87-95`.

**Тесты:** визуальная проверка (`contain` — фото целиком); при наличии CSS-проверок — обновить.

---

## 2. SHOULD FIX (P1)

### PD-H-05. Seller зависит от buyer presentation

**Проблема.** Seller-вьюхи импортируют buyer-компоненты и CSS:
- `seller/views/ProductReviewsView.tsx:7-10` → `ReviewsHistogram`, `ReviewCard`, `buyer/product-detail.css`;
- `seller/views/ProductQuestionsView.tsx:7-9` → `QuestionCard`, `buyer/product-detail.css`.

Это не нарушение Onion (оба — presentation), но плохая feature-boundary: seller не должен
зависеть от buyer.

**Что сделать.** Вынести общие social-компоненты в нейтральную папку:
`src/presentation/shared/product-social/` (или `presentation/product/`) —
`ReviewCard`, `ReviewsHistogram`, `QuestionCard`, `RatingStars`, `SocialLayer` (если общий)
и общий CSS. Buyer и seller импортируют оттуда; `seller → buyer` исчезает.

**Файлы:** перемещение компонентов + обновление импортов buyer/seller + общий CSS.

**Тесты:** существующие тесты components перепривязать к новым путям; проверить, что
grep не находит `seller/** → buyer/**`.

---

### PD-H-06. Seller читает buyer storefront-read model

**Проблема.** Seller `ProductReviewsView`/`ProductQuestionsView` используют
`useStorefrontProductReviews`/`...Questions` → `storefront_product_reviews_read`/
`..._questions_read` (`storefront-product-repository.ts:32-60`), т.е. buyer-ориентированную
проекцию. У buyer и seller разные authorization-политики (см. PD-H-01).

**Что сделать.** Разделить репозитории:
```
StorefrontProductRepository      → buyer public read
SellerProductSocialRepository    → seller (archived-модерация, actor из сессии)
```
Seller-хук/порт читает через `SellerProductSocialRepository` (edge session-путь из PD-H-01),
buyer — через публичный. Так бизнес-политика отражается в архитектуре, а не в переиспользовании.

**Зависимость:** логично делать вместе с PD-H-01 (один и тот же session-путь).

---

### PD-H-07. `relatedProducts` без верхней границы + рассинхрон чек-листа

**Проблема.**
- `storefront_product_detail_read.relatedProducts` — `order by ... asc`, **без `limit`**
  (`migrations/0025_product_link.sql:288-351`; маппинг `storefront-product-mappers.ts:107-119,
  227`). N связей → N карточек + lateral по image/variant/stock на каждый.
- Чек-лист `14` §12.6 при этом утверждает «related … limit 8» — уже расходится с кодом
  (`14:633-634`) и с §7 («без limit», `14:371`).

**Что сделать.**
1. Ввести верхнюю границу в RPC (`limit 8` или `12` — рекомендация аудита 8) — как scaling
   contract, даже если связей обычно мало. UI «Показать ещё» — не сейчас.
2. Привести §12.6 в `14` к реальности (8, не «limit 8» вслепую; зафиксировать цифру).
Проверить, что граница не ломает порядок «сначала новые связи».

**Файлы:** новая миграция (пересоздать `storefront_product_detail_read`),
`docs/14 §7/§12.6`.

**Тесты:** >8 связей → API отдаёт ровно 8 в правильном порядке; `storefront-product-repository.test.ts`.

---

### PD-H-08. Нет тестов `ProductImageViewer`; gesture-логика не извлечена

**Проблема.** `ProductImageViewer.tsx` — 247 строк, самый сложный интерактив блока
(render + portal + keyboard + pinch + pan + double-tap + scale/position + pointer capture +
clamp + reset). Теста `ProductImageViewer.test.tsx` нет (есть только `ProductGallery.test.tsx`).

**Что сделать.**
1. Вынести gesture state-machine в hook/pure-функции: `useImageViewerGestures()` +
   чистые `clamp`/`clampPos`/double-tap детектор — чтобы тестировать без реального multi-touch.
2. Компонент оставить чистым presentation.
3. Тесты: Escape, backdrop, close button, double-tap (1 → 2.5 → 1), pinch, pan, clamp,
   смена фото → reset zoom, pointer cancel.
4. Заодно рассмотреть PD-H-15-подобный рефактор: вместо `setState` в render
   (`ProductImageViewer.tsx:64-68`) — `key={activeIndex}` remount или состояние в hook
   (P2-улучшение, приурочить к этому же заходу).

**Файлы:** `src/presentation/buyer/components/product/ProductImageViewer.tsx` (+ новый hook),
новый test-файл.

---

## 3. P2 / после

### PD-H-09. Строгий mapper (не permissive)
`storefront-product-mappers.ts`: `asNumber` даёт `0` для мусора (`:39-42`), статус
`raw.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE'` (`:58`) — «невалидный → ACTIVE»; тест это
закрепляет (`storefront-product-mappers.test.ts:178-190`). Для commerce небезопасно.
**Сделать:** неизвестный enum / невалидные деньги/количество → отклонять проекцию (`null`
для detail) либо явный invalid-флаг, а не молчаливый ACTIVE/0. Обновить тесты.
(Не путать с `mapStorefrontHome` — там своя семантика.)

### PD-H-10. `product_links` без DB-level tenant-integrity
Таблица хранит `store_id` + `product_id` + `related_product_id`
(`migrations/0025:11-19`); согласованность магазина проверяется только в RPC
(`0025:58-60,119-121`). **Решение (выбрано):** composite FK
`(store_id, product_id)` / `(store_id, related_product_id) → products(store_id, id)` —
миграция `0031`. Общий `store_id` + два composite FK гарантируют, что оба товара из
одного магазина (уровень БД, не только RPC). Код приложения не меняется.
(Альтернатива — убрать `store_id` — отклонена: она не добавляет DB-энфорсмента.)

### PD-H-11. `SECURITY DEFINER` hardening
Сейчас везде `set search_path = public` (напр. `0017:23`, `0019:27`). Для строгого
hardening — `set search_path = public, pg_temp` + единый convention по `EXECUTE`:
публичные RPC — `to public` оправдано; viewer/seller-privileged — только нужным ролям
(связать с PD-H-01/06). Отдельным проходом, не смешивать с P0.

### PD-H-12. GitHub Actions CI
`.github/` отсутствует (Actions нет). Добавить workflow: `push` → `typecheck` → `lint` →
`test` → `build`. Тогда доки смогут говорить `CI VERIFIED`, а не только `LOCAL VERIFIED`.

### PD-H-13. Documentation divergence
- В `14` «Похожее»/«Связи» приписываются миграции `0024`, но реально:
  `0024` — `home_products_keyset_index`, `0025` — `product_link`
  (см. `docs/14:13,568,894-902`, `migrations/0024_*.sql`, `migrations/0025_*.sql`).
  Привести номера в `14`/`16` в соответствие.
- Формулировка `PD-13 — code-level QA закрыт` (`14:4,903`) слишком оптимистична: точнее
  «functional/unit QA largely complete; security/business-rule hardening incomplete»
  до закрытия PD-H-01…PD-H-03/08.

### PD-H-14. Дробление `product-detail.css` — DEFERRED
1389 строк, один файл (`.pd-gallery`, variants, about, cta, viewer, skeleton, related,
reviews, questions, layer). Не дробить «любой ценой»; сделать при следующем крупном
касании: `product-detail.css` + `product-detail-gallery.css` + `product-detail-social.css`.

### PD-H-15. `DetailsView` orchestration — DEFERRED
248 строк: fetch + route detection + variant/price selection + favorite + cart + share + tabs +
error/notFound/paused. Пока терпимо; при росте вынести `useProductSelection()` /
`useProductActions()`. **Не рефакторить в этом pass.**

---

## 4. Что НЕ трогаем (anti-scope)

- Условный двойной `<Outlet>` (`DetailsView.tsx:227,231`) — **не баг**, функционально верен
  (сохранение «О товаре» под слоем). Максимум — readability-комментарий/`ProductAboutUnderlay`
  позже; сейчас не трогаем.
- React Query (query keys, lazy `enabled`, invalidation), routing, gallery-модель
  (`activeIndex`), read-model `StorefrontProductDetail`, Onion-слои — оставляем как есть.
- RLS, пагинация social, рекомендеры/чат/доставка/промокоды, Cart/Favorites/Orders,
  linking-attributes (FD-1), preview в «Витрине» (FD-2) — вне этого pass (`16`).
- Никаких Redux/CSS Modules/SSR/отдельного backend-сервиса.

---

## 5. Verification / Definition of Done

Порядок: P0 (PD-H-01…04) → прогон → P1 (PD-H-05…08) → P2 по решению.

```
npm run typecheck
npm run lint
npm run test
npm run build
```

- [ ] PD-H-01: публичный social-read не доверяет клиентскому viewer для ARCHIVED;
      seller — через session-путь; regression-тесты.
- [ ] PD-H-02: create на ARCHIVED → reject (review + question).
- [ ] PD-H-03: owner create на свой товар → reject (review + question).
- [ ] PD-H-04: gallery `contain`; визуальная проверка desktop/mobile.
- [ ] PD-H-05: `grep` не находит `seller/** → buyer/**`; общие компоненты в shared.
- [ ] PD-H-06: seller social read идёт через отдельный seller-контур.
- [ ] PD-H-07: related ≤ 8/12; §12.6 в `14` синхронизирован.
- [ ] PD-H-08: ImageViewer тесты + gesture-hook.
- [ ] P2 (по решению): mapper strict / product_links integrity / search_path / CI / docs.
- [ ] `typecheck`+`lint`+`test`(+`build`) зелёные; ручная проверка Telegram (iOS/Android/Desktop).

> После закрытия pass: перенести остаток и решения в `11`/`16`/`14`, этот файл удалить.
