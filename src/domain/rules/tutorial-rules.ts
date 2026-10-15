import type {
  SellerTutorialState,
  TutorialStatus,
  TutorialStepKey,
  TutorialWelcomeDecision,
} from '../models/tutorial';

/**
 * Чистая логика обучения (docs/26 §3.10 «State machine для обучения — маленькая»).
 * Типы TS + чистые функции + unit-тесты; без тяжёлого framework. Правила детерминированы
 * и идемпотентны: повторная запись того же перехода не меняет состояние (PUT-семантика).
 */

/** Порядок шагов обучения; длина — знаменатель «Шаг N из M» (§1.2, §4.2). */
export const TUTORIAL_STEP_ORDER: readonly TutorialStepKey[] = [
  'orientation',
  'product-create',
  'product-buyer-view',
  'storefront',
  'finish',
];

export const FIRST_TUTORIAL_STEP: TutorialStepKey = 'orientation';
export const TUTORIAL_STEP_TOTAL = TUTORIAL_STEP_ORDER.length;

/** Начальное состояние: предложение ещё не показано, обучение не начато. §3.3 */
export const INITIAL_TUTORIAL_STATE: SellerTutorialState = Object.freeze({
  welcomeDecision: 'unknown',
  status: 'not_started',
  step: null,
  updatedAt: null,
});

const WELCOME_DECISIONS: readonly TutorialWelcomeDecision[] = ['unknown', 'accepted', 'declined'];
const TUTORIAL_STATUSES: readonly TutorialStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'dismissed',
];

export function isTutorialWelcomeDecision(value: unknown): value is TutorialWelcomeDecision {
  return (WELCOME_DECISIONS as readonly unknown[]).includes(value);
}

export function isTutorialStatus(value: unknown): value is TutorialStatus {
  return (TUTORIAL_STATUSES as readonly unknown[]).includes(value);
}

export function isTutorialStepKey(value: unknown): value is TutorialStepKey {
  return (TUTORIAL_STEP_ORDER as readonly unknown[]).includes(value);
}

/** `completed`/`dismissed` — терминальные исходы, не прерывание (§6.1). */
export function isTutorialStatusFinished(status: TutorialStatus): boolean {
  return status === 'completed' || status === 'dismissed';
}

/** Индекс шага в маршруте; -1 для неизвестного ключа. */
export function tutorialStepIndex(step: TutorialStepKey | null): number {
  if (step === null) return -1;
  return TUTORIAL_STEP_ORDER.indexOf(step);
}

/** Следующий шаг маршрута; null после `finish`. */
export function nextTutorialStep(step: TutorialStepKey): TutorialStepKey | null {
  const index = tutorialStepIndex(step);
  if (index < 0 || index >= TUTORIAL_STEP_TOTAL - 1) return null;
  return TUTORIAL_STEP_ORDER[index + 1] ?? null;
}

/** Позиция для индикатора «Шаг N из M» (1-based); null вне `in_progress`. */
export function tutorialStepProgress(
  state: SellerTutorialState,
): { index: number; total: number } | null {
  if (state.status !== 'in_progress') return null;
  const index = tutorialStepIndex(state.step);
  if (index < 0) return null;
  return { index: index + 1, total: TUTORIAL_STEP_TOTAL };
}

/**
 * Показывать ли предложение пройти обучение (§4.1): только до первого решения,
 * пока обучение не начато. После accept/decline/завершения — не показывается.
 */
export function shouldOfferTutorial(state: SellerTutorialState): boolean {
  return state.welcomeDecision === 'unknown' && state.status === 'not_started';
}

/** Незавершённое обучение (приложение закрыто в процессе) → предложить продолжить (§1.1). */
export function isTutorialInterrupted(state: SellerTutorialState): boolean {
  return state.status === 'in_progress';
}

function withUpdatedAt(state: SellerTutorialState, at: string): SellerTutorialState {
  return {
    welcomeDecision: state.welcomeDecision,
    status: state.status,
    step: state.step,
    updatedAt: at,
  };
}

function isSameTransition(a: SellerTutorialState, b: SellerTutorialState): boolean {
  return a.welcomeDecision === b.welcomeDecision && a.status === b.status && a.step === b.step;
}

function transition(
  state: SellerTutorialState,
  next: Omit<SellerTutorialState, 'updatedAt'>,
  at: string,
): SellerTutorialState {
  const candidate: SellerTutorialState = { ...next, updatedAt: state.updatedAt };
  if (isSameTransition(state, candidate)) return state; // идемпотентно
  return withUpdatedAt(candidate, at);
}

/**
 * «Начать»/«Продолжить»: `welcome='accepted'`, `status='in_progress'` (§1.1).
 * Из `in_progress` сохраняет текущий шаг (продолжение после прерывания); во всех
 * остальных случаях — с первого шага (в т.ч. повторный запуск после завершения/отказа).
 */
export function acceptTutorial(state: SellerTutorialState, at: string): SellerTutorialState {
  const step =
    state.status === 'in_progress' && state.step !== null ? state.step : FIRST_TUTORIAL_STEP;
  return transition(state, { welcomeDecision: 'accepted', status: 'in_progress', step }, at);
}

/**
 * «Не сейчас»: `welcome='declined'` (§1.1). Действует только до старта; после accept /
 * in_progress / завершения — no-op (нельзя откатить принятое обучение отказом).
 */
export function declineTutorial(state: SellerTutorialState, at: string): SellerTutorialState {
  if (state.status !== 'not_started' || state.welcomeDecision !== 'unknown') return state;
  return transition(state, { welcomeDecision: 'declined', status: 'not_started', step: null }, at);
}

/** Смена шага; учитывается только внутри `in_progress` (§3.3). */
export function setTutorialStep(
  state: SellerTutorialState,
  step: TutorialStepKey,
  at: string,
): SellerTutorialState {
  if (state.status !== 'in_progress') return state;
  return transition(
    state,
    { welcomeDecision: state.welcomeDecision, status: 'in_progress', step },
    at,
  );
}

/**
 * Явное завершение сценария (§1.5): `status='completed'`, `step=null`.
 * Из уже терминального состояния — no-op.
 */
export function completeTutorial(state: SellerTutorialState, at: string): SellerTutorialState {
  if (state.status !== 'in_progress') return state;
  return transition(
    state,
    { welcomeDecision: state.welcomeDecision, status: 'completed', step: null },
    at,
  );
}

/**
 * Досрочный выход («Завершить обучение» на шаге, §1.4): `status='dismissed'`, `step=null`.
 * Терминально, как и `completed`, но отличает досрочный выход от прохождения до конца
 * (§3.8 пишет отдельный `dismiss`; §6.1: «completed/dismissed ≠ interruption»).
 */
export function dismissTutorial(state: SellerTutorialState, at: string): SellerTutorialState {
  if (state.status !== 'in_progress') return state;
  return transition(
    state,
    { welcomeDecision: state.welcomeDecision, status: 'dismissed', step: null },
    at,
  );
}
