-- 0032_security_definer_search_path.sql
-- PD-H-11: hardening `SECURITY DEFINER` для функций блока Product Detail.
--
-- Проблема: функции задавали `set search_path = public`. При явном списке без
-- `pg_temp` PostgreSQL всё равно ищет временные отношения первыми для relations,
-- то есть temp-объект мог затенять объект из public. Фиксируем безопасный порядок:
-- `public` ищется первым, `pg_temp` — последним.
--
-- Меняем только конфигурацию функции (`ALTER FUNCTION ... SET`), тело не
-- пересоздаём. Границы блока: social read/write, seller social read, related
-- links и internal-проекции (0015–0031).
--
-- Convention по EXECUTE: публичные RPC — `to public` оправдано; `seller_*_read`
-- тоже `to public`, т.к. edge ходит под anon-ключом (остаточный риск — общий S1/
-- RLS); internal `_storefront_*_projection` — `revoke from public` (уже сделано в
-- 0028), их вызывает только definer-владелец.
--
-- Остальные SECURITY DEFINER функции проекта (catalog/store/orders) — тот же
-- convention при касании их блоков.
--
-- Source: docs/18 PD-H-11.

-- ── public storefront read ─────────────────────────────────────────────────────
alter function public.storefront_product_detail_read(text, uuid)
  set search_path = public, pg_temp;
alter function public.storefront_product_reviews_read(text, uuid, uuid)
  set search_path = public, pg_temp;
alter function public.storefront_product_questions_read(text, uuid, uuid)
  set search_path = public, pg_temp;

-- ── seller social read ─────────────────────────────────────────────────────────
alter function public.seller_product_reviews_read(uuid, uuid)
  set search_path = public, pg_temp;
alter function public.seller_product_questions_read(uuid, uuid)
  set search_path = public, pg_temp;

-- ── internal projections (execute отозван у public в 0028) ─────────────────────
alter function public._storefront_reviews_projection(uuid, uuid)
  set search_path = public, pg_temp;
alter function public._storefront_questions_projection(uuid, uuid)
  set search_path = public, pg_temp;

-- ── review writes ──────────────────────────────────────────────────────────────
alter function public.review_create_atomic(uuid, uuid, smallint, text)
  set search_path = public, pg_temp;
alter function public.review_hide_atomic(uuid, uuid)
  set search_path = public, pg_temp;
alter function public.review_reply_create_atomic(uuid, uuid, text)
  set search_path = public, pg_temp;

-- ── question writes ────────────────────────────────────────────────────────────
alter function public.question_create_atomic(uuid, uuid, text)
  set search_path = public, pg_temp;
alter function public.question_hide_atomic(uuid, uuid)
  set search_path = public, pg_temp;
alter function public.question_answer_create_atomic(uuid, uuid, text)
  set search_path = public, pg_temp;

-- ── related links ──────────────────────────────────────────────────────────────
alter function public.product_link_add_atomic(uuid, uuid, uuid)
  set search_path = public, pg_temp;
alter function public.product_link_remove_atomic(uuid, uuid, uuid)
  set search_path = public, pg_temp;
