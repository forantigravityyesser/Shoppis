/**
 * Обучение продавца (tutorial), чек-лист подготовки и цели развития. docs/26 (TUT-01).
 *
 * Три сущности сознательно разделены (§3.1): tutorial state — прогресс самого сценария
 * обучения (§3.3); readiness — готовность магазина, вычисляется из доменных данных
 * (§3.4); growth — цели по фактическим заказам, не зависит от tutorial state (§3.5).
 */

/** Первое предложение пройти обучение. §3.3 */
export type TutorialWelcomeDecision = 'unknown' | 'accepted' | 'declined';

/** Состояние прохождения обучения. §3.3 */
export type TutorialStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

/** Стабильные ключи шагов обучения (порядок — как в маршруте §1.2). */
export type TutorialStepKey =
  'orientation' | 'product-create' | 'product-buyer-view' | 'storefront' | 'finish';

/**
 * Серверно-персистимое состояние обучения магазина (§3.3). Субъект — магазин.
 * `step` вне `in_progress` всегда null. `updatedAt` — диагностика/восстановление.
 */
export interface SellerTutorialState {
  welcomeDecision: TutorialWelcomeDecision;
  status: TutorialStatus;
  step: TutorialStepKey | null;
  updatedAt: string | null;
}

/**
 * Нормализованный вход чек-листа из уже загруженного состояния (§3.4): `currentStore`
 * (name/banner/description/support) + серверные counts сводки главной. Отдельных
 * запросов на чек-лист нет — поэтому это чистые данные, а не репозиторий.
 */
export interface StoreReadinessInput {
  storeName: string;
  bannerUrl: string;
  description: string;
  supportHandle: string;
  /** Серверный счётчик: товары `ACTIVE` с `ACTIVE`-вариантом и остатком > 0. */
  buyerAvailableProducts: number;
  /** Серверный счётчик активных категорий магазина. */
  activeCategories: number;
}

/** Вычисленная готовность магазина (§3.4). Derived — не хранится. */
export interface ShopReadiness {
  /** Всегда `completed` (название гарантировано при создании). */
  storeName: 'completed';
  /** Оформление (баннер и/или описание). */
  storeAppearance: 'incomplete' | 'completed';
  availableProduct: 'incomplete' | 'completed';
  category: 'incomplete' | 'completed';
  supportLinks: 'incomplete' | 'completed';
  /** Все шаги чек-листа выполнены («Магазин подготовлен»). docs/26 §8.2 (переопределено). */
  preparationReady: boolean;
  /** Прогресс по всем видимым шагам чек-листа (5). */
  progress: { completed: number; total: number };
}

/** Серверные факты развития из заказов (§3.5). Считает `seller_dashboard_read`. */
export interface GrowthFacts {
  firstOrderAt: string | null;
  firstShippedAt: string | null;
  firstCompletedAt: string | null;
}

/** Ключи последовательных целей развития (§1.7). */
export type GrowthGoalKey = 'first-order' | 'first-shipped' | 'first-completed';

/** Цель развития. Показывается одна ближайшая незакрытая (§1.7). */
export interface GrowthGoal {
  key: GrowthGoalKey;
  achieved: boolean;
}
