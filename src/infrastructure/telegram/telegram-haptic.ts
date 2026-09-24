import { hapticFeedback } from '@telegram-apps/sdk';

export function impactLight(): void {
  try {
    hapticFeedback.impactOccurred('light');
  } catch {
    // Haptics недоступны вне Telegram
  }
}

export function impactMedium(): void {
  try {
    hapticFeedback.impactOccurred('medium');
  } catch {
    // Haptics недоступны вне Telegram
  }
}

export function notifySuccess(): void {
  try {
    hapticFeedback.notificationOccurred('success');
  } catch {
    // Haptics недоступны вне Telegram
  }
}

export function selectTick(): void {
  try {
    hapticFeedback.selectionChanged();
  } catch {
    // Haptics недоступны вне Telegram
  }
}
