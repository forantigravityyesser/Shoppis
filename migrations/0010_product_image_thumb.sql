-- 0010_product_image_thumb.sql
-- Lightweight thumbnail key alongside the full-size product image.
-- Lists/mini-cards load the thumb; hero/gallery load the full image.
-- Existing rows keep thumb_storage_key = null → UI falls back to storage_key.
-- Idempotent.

alter table public.product_images
  add column if not exists thumb_storage_key text;
