import { impactLight, impactMedium, notifySuccess, selectTick } from '../../infrastructure/telegram/telegram-haptic';

/**
 * Тактильная отдача для UI. Единственная точка входа для presentation:
 * компоненты не знают, что под капотом Telegram Haptics, и не зависят от infrastructure напрямую.
 * Вне Telegram вызовы безопасно деградируют в no-op (см. telegram-haptic).
 */
export function useHaptic() {
  return { impactLight, impactMedium, notifySuccess, selectTick };
}
