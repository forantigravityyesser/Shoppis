import { createClient } from '@insforge/sdk';
import { INSFORGE_ANON_KEY, INSFORGE_URL } from './config';

/**
 * Единственный экземпляр клиента. Напрямую createClient больше нигде не вызывать.
 * Вызовы Edge Functions идут через functions-gateway, а не через client.functions.
 */
export const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
});
