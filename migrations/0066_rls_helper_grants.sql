-- 0066_rls_helper_grants.sql
-- Грант EXECUTE на RLS-хелперы роли `authenticated` (docs/11 §S1, Фаза 4).
--
-- RLS-выражение вычисляется от имени роли запроса, поэтому функция, вызванная из
-- политики, требует EXECUTE у этой роли. В 0065 гранты были отозваны — политики
-- падали с `permission denied for function app_is_store_owner`. Хелперы отдают
-- только булев ответ о собственном владении вызывающего (утечки нет), поэтому
-- исполнимы для `authenticated`. `anon` политик не имеет — грант не нужен.
--
-- Test 38 harness исключает `app_*`-хелперы из «RPC обязаны быть закрыты».

grant execute on function public.app_is_store_owner(uuid) to authenticated;
grant execute on function public.app_owns_product(uuid) to authenticated;
grant execute on function public.app_owns_variant(uuid) to authenticated;
grant execute on function public.app_order_readable(uuid) to authenticated;
grant execute on function public.app_review_readable(uuid) to authenticated;
grant execute on function public.app_question_readable(uuid) to authenticated;
