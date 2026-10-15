import type { GrowthFacts, GrowthGoal, GrowthGoalKey } from '../models/tutorial';

/**
 * Последовательные цели развития из фактических заказов (docs/26 §3.5). Чистая функция
 * над серверными фактами: показывает одну ближайшую незакрытую цель; будущие не
 * показываются; достигнутая цель не сбрасывается (факты — исторические min-значения).
 * Ручная отметка цели невозможна (§1.7): достижение определяется только фактом.
 */

export const GROWTH_GOAL_ORDER: readonly GrowthGoalKey[] = [
  'first-order',
  'first-shipped',
  'first-completed',
];

function goalAchieved(key: GrowthGoalKey, facts: GrowthFacts): boolean {
  switch (key) {
    case 'first-order':
      return facts.firstOrderAt !== null;
    case 'first-shipped':
      return facts.firstShippedAt !== null;
    case 'first-completed':
      return facts.firstCompletedAt !== null;
  }
}

/** Все цели по порядку с флагом достижения (для тестов и возможного UI). */
export function listGrowthGoals(facts: GrowthFacts): GrowthGoal[] {
  return GROWTH_GOAL_ORDER.map((key) => ({ key, achieved: goalAchieved(key, facts) }));
}

/**
 * Текущая цель — первая незакрытая; null, если все достигнуты. Цель N+1 не показывается,
 * пока не достигнута N (§1.7).
 */
export function resolveGrowthGoal(facts: GrowthFacts): GrowthGoal | null {
  for (const key of GROWTH_GOAL_ORDER) {
    if (!goalAchieved(key, facts)) return { key, achieved: false };
  }
  return null;
}
