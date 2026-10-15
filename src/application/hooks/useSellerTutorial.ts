import { useStore } from '../store';
import type { Store } from '../../domain/models/store';
import type { SellerTutorialState, TutorialStepKey } from '../../domain/models/tutorial';
import {
  INITIAL_TUTORIAL_STATE,
  acceptTutorial,
  completeTutorial,
  declineTutorial,
  dismissTutorial,
  isTutorialInterrupted,
  nextTutorialStep,
  setTutorialStep,
  shouldOfferTutorial,
  tutorialStepProgress,
} from '../../domain/rules/tutorial-rules';

/**
 * Память контроллера: id товара, сохранённого в шаге `product-create` (§1.3, §8.6).
 * Живёт в памяти сессии (не персистится) и переиспользуется шагом buyer view (TUT-06);
 * при отсутствии — fallback на первый доступный покупателю товар.
 */
let tutorialProductId: string | null = null;

export function getTutorialProductId(): string | null {
  return tutorialProductId;
}

/**
 * Память о том, что пользователь открыл покупательский предпросмотр на шаге
 * `product-buyer-view` (docs/26 §4.4, TUT-06). Во время предпросмотра seller-shell
 * (и оверлей) размонтируется, поэтому факт «открывал предпросмотр» переживает это
 * в модульной памяти и позволяет закрыть шаг по возврату.
 */
let previewOpenedDuringTutorial = false;

export function markTutorialPreviewOpened(): void {
  previewOpenedDuringTutorial = true;
}

export function consumeTutorialPreviewOpened(): boolean {
  const value = previewOpenedDuringTutorial;
  previewOpenedDuringTutorial = false;
  return value;
}

/**
 * Контроллер обучения продавца (docs/26 §3.2, TUT-02/TUT-05). Единственная точка, через
 * которую presentation читает состояние обучения и управляет переходами.
 *
 * Правила переходов — чистые (`domain/rules/tutorial-rules.ts`); этот хук их только
 * применяет и персистит результат через `auth-slice.updateTutorialState`. Запись идёт
 * ТОЛЬКО при фактическом изменении состояния (правила возвращают тот же объект при
 * no-op), то есть не более ~7 записей за прохождение (§3.8).
 */
export interface SellerTutorialController {
  /** Текущее состояние обучения (из `currentStore`; сервер — источник истины). */
  state: SellerTutorialState;
  /** Показывать ли предложение пройти обучение (§4.1). */
  shouldOffer: boolean;
  /** Обучение прервано (закрыто в процессе) → предложить продолжить (§1.1). */
  interrupted: boolean;
  /** Активный шаг или null. */
  step: TutorialStepKey | null;
  /** Позиция «Шаг N из M» или null. */
  progress: { index: number; total: number } | null;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  setStep: (step: TutorialStepKey) => Promise<void>;
  /**
   * Сигнал подтверждённого сохранения товара (docs/26 §1.3/§3.10, TUT-05): шаг
   * `product-create` закрывается ТОЛЬКО после успешного сохранения. Вне этого шага —
   * no-op. Tutorial никогда не создаёт товар сам; дубликаты невозможны.
   */
  notifyProductSaved: (productId: string) => Promise<void>;
  complete: () => Promise<void>;
  dismiss: () => Promise<void>;
}

function toState(store: Store | null): SellerTutorialState {
  if (!store) return INITIAL_TUTORIAL_STATE;
  return {
    welcomeDecision: store.tutorialWelcomeDecision,
    status: store.tutorialStatus,
    step: store.tutorialStep,
    updatedAt: store.tutorialUpdatedAt,
  };
}

export function useSellerTutorial(): SellerTutorialController {
  const currentStore = useStore((s) => s.currentStore);
  const state = toState(currentStore);

  const now = () => new Date().toISOString();

  const persist = async (next: SellerTutorialState): Promise<void> => {
    // No-op переходы не пишем на сервер (PUT-семантика, §3.8).
    if (next === state) return;
    await useStore.getState().updateTutorialState({
      welcomeDecision: next.welcomeDecision,
      status: next.status,
      step: next.step,
    });
  };

  return {
    state,
    shouldOffer: shouldOfferTutorial(state),
    interrupted: isTutorialInterrupted(state),
    step: state.status === 'in_progress' ? state.step : null,
    progress: tutorialStepProgress(state),
    accept: () => persist(acceptTutorial(state, now())),
    decline: () => persist(declineTutorial(state, now())),
    setStep: (step) => persist(setTutorialStep(state, step, now())),
    notifyProductSaved: async (productId) => {
      // Шаг закрывается только на `product-create` и только при активном обучении.
      if (state.status !== 'in_progress' || state.step !== 'product-create') return;
      tutorialProductId = productId;
      const next = nextTutorialStep('product-create');
      if (next) await persist(setTutorialStep(state, next, now()));
    },
    complete: () => persist(completeTutorial(state, now())),
    dismiss: () => persist(dismissTutorial(state, now())),
  };
}
