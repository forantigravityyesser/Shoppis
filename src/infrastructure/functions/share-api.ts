import { invokeFunction } from '../insforge/functions-gateway';

interface SharePrepareResponse {
  success?: boolean;
  /** `PreparedInlineMessage.id` для `Telegram.WebApp.shareMessage`. */
  id?: string;
  error?: string;
}

/**
 * share-actions: подготовка карточки товара (фото + текст + кнопка) для нативного
 * шаринга Telegram. `photoUrl` — публичный JPEG-URL из нашего бакета. Возвращает
 * id подготовленного сообщения; клиент передаёт его в `shareMessage`.
 */
export async function prepareShare(
  token: string,
  publicId: string,
  productId: string,
  photoUrl: string,
): Promise<string> {
  const { data, error } = await invokeFunction<SharePrepareResponse>('share-actions', {
    body: { publicId, productId, photoUrl },
    token,
  });
  if (error) throw new Error(error.message);
  if (!data?.success || !data.id) throw new Error(data?.error ?? 'Share prepare failed');
  return data.id;
}
