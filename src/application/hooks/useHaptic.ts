import { deps } from '../composition/container';
import type { HapticsPort } from '../ports/telegram';

/**
 * Тактильная отдача для UI. Единственная точка входа для presentation:
 * компоненты не знают, что под капотом Telegram Haptics, и не зависят от
 * infrastructure напрямую. Вне Telegram вызовы безопасно деградируют в no-op.
 */
export function useHaptic(): HapticsPort {
  return deps().haptics;
}
