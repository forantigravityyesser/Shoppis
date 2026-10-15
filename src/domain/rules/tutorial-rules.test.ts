import { describe, expect, it } from 'vitest';
import {
  FIRST_TUTORIAL_STEP,
  INITIAL_TUTORIAL_STATE,
  TUTORIAL_STEP_TOTAL,
  acceptTutorial,
  completeTutorial,
  declineTutorial,
  dismissTutorial,
  isTutorialInterrupted,
  isTutorialStatusFinished,
  nextTutorialStep,
  setTutorialStep,
  shouldOfferTutorial,
  tutorialStepProgress,
} from './tutorial-rules';

const AT = '2026-10-15T00:00:00.000Z';

describe('shouldOfferTutorial', () => {
  it('offers only before the first decision and before start', () => {
    expect(shouldOfferTutorial(INITIAL_TUTORIAL_STATE)).toBe(true);
    expect(shouldOfferTutorial(declineTutorial(INITIAL_TUTORIAL_STATE, AT))).toBe(false);
    expect(shouldOfferTutorial(acceptTutorial(INITIAL_TUTORIAL_STATE, AT))).toBe(false);
  });
});

describe('acceptTutorial', () => {
  it('starts from the first step and records the decision', () => {
    const state = acceptTutorial(INITIAL_TUTORIAL_STATE, AT);
    expect(state.welcomeDecision).toBe('accepted');
    expect(state.status).toBe('in_progress');
    expect(state.step).toBe(FIRST_TUTORIAL_STEP);
    expect(state.updatedAt).toBe(AT);
  });

  it('resumes the current step when already in progress (interruption)', () => {
    const interrupted = setTutorialStep(
      acceptTutorial(INITIAL_TUTORIAL_STATE, AT),
      'product-create',
      AT,
    );
    const resumed = acceptTutorial(interrupted, 'later');
    expect(resumed.step).toBe('product-create');
    expect(resumed.status).toBe('in_progress');
  });

  it('restarts from the first step after an explicit decline', () => {
    const declined = declineTutorial(INITIAL_TUTORIAL_STATE, AT);
    expect(acceptTutorial(declined, 'later').step).toBe(FIRST_TUTORIAL_STEP);
  });

  it('restarts from the first step after completion', () => {
    const completed = completeTutorial(
      setTutorialStep(acceptTutorial(INITIAL_TUTORIAL_STATE, AT), 'finish', AT),
      AT,
    );
    expect(acceptTutorial(completed, 'later').step).toBe(FIRST_TUTORIAL_STEP);
    expect(acceptTutorial(completed, 'later').status).toBe('in_progress');
  });

  it('is idempotent', () => {
    const once = acceptTutorial(INITIAL_TUTORIAL_STATE, AT);
    expect(acceptTutorial(once, 'later')).toBe(once);
  });
});

describe('declineTutorial', () => {
  it('records the decline without starting', () => {
    const state = declineTutorial(INITIAL_TUTORIAL_STATE, AT);
    expect(state.welcomeDecision).toBe('declined');
    expect(state.status).toBe('not_started');
    expect(state.step).toBeNull();
  });

  it('is idempotent', () => {
    const once = declineTutorial(INITIAL_TUTORIAL_STATE, AT);
    expect(declineTutorial(once, 'later')).toBe(once);
  });

  it('cannot override an accepted / in-progress run', () => {
    const started = setTutorialStep(acceptTutorial(INITIAL_TUTORIAL_STATE, AT), 'storefront', AT);
    expect(declineTutorial(started, 'later')).toBe(started);
  });
});

describe('setTutorialStep', () => {
  it('changes the step only while in progress', () => {
    const started = acceptTutorial(INITIAL_TUTORIAL_STATE, AT);
    expect(setTutorialStep(started, 'storefront', AT).step).toBe('storefront');
    expect(setTutorialStep(INITIAL_TUTORIAL_STATE, 'storefront', AT)).toBe(INITIAL_TUTORIAL_STATE);
  });

  it('is idempotent for the same step', () => {
    const started = acceptTutorial(INITIAL_TUTORIAL_STATE, AT);
    expect(setTutorialStep(started, FIRST_TUTORIAL_STEP, AT)).toBe(started);
  });
});

describe('completeTutorial / dismissTutorial', () => {
  it('completes from in_progress, clearing the step', () => {
    const started = setTutorialStep(acceptTutorial(INITIAL_TUTORIAL_STATE, AT), 'finish', AT);
    const done = completeTutorial(started, AT);
    expect(done.status).toBe('completed');
    expect(done.step).toBeNull();
  });

  it('dismisses early exit, distinct from completion', () => {
    const started = setTutorialStep(
      acceptTutorial(INITIAL_TUTORIAL_STATE, AT),
      'product-create',
      AT,
    );
    const dismissed = dismissTutorial(started, AT);
    expect(dismissed.status).toBe('dismissed');
    expect(dismissed.step).toBeNull();
  });

  it('treats completed and dismissed as terminal, not interruption', () => {
    const started = acceptTutorial(INITIAL_TUTORIAL_STATE, AT);
    expect(isTutorialStatusFinished(completeTutorial(started, AT).status)).toBe(true);
    expect(isTutorialStatusFinished(dismissTutorial(started, AT).status)).toBe(true);
    expect(isTutorialInterrupted(completeTutorial(started, AT))).toBe(false);
    expect(isTutorialInterrupted(dismissTutorial(started, AT))).toBe(false);
    expect(isTutorialInterrupted(started)).toBe(true);
  });

  it('does not auto-offer after completion', () => {
    const done = completeTutorial(acceptTutorial(INITIAL_TUTORIAL_STATE, AT), AT);
    expect(shouldOfferTutorial(done)).toBe(false);
  });

  it('is idempotent and no-ops outside in_progress', () => {
    const started = acceptTutorial(INITIAL_TUTORIAL_STATE, AT);
    const done = completeTutorial(started, AT);
    expect(completeTutorial(done, 'later')).toBe(done);
    expect(completeTutorial(INITIAL_TUTORIAL_STATE, AT)).toBe(INITIAL_TUTORIAL_STATE);
    expect(dismissTutorial(INITIAL_TUTORIAL_STATE, AT)).toBe(INITIAL_TUTORIAL_STATE);
  });
});

describe('nextTutorialStep', () => {
  it('walks the fixed route and ends after finish', () => {
    expect(nextTutorialStep('orientation')).toBe('product-create');
    expect(nextTutorialStep('product-create')).toBe('product-buyer-view');
    expect(nextTutorialStep('product-buyer-view')).toBe('storefront');
    expect(nextTutorialStep('storefront')).toBe('finish');
    expect(nextTutorialStep('finish')).toBeNull();
  });
});

describe('tutorialStepProgress', () => {
  it('is 1-based and only while in progress', () => {
    const started = acceptTutorial(INITIAL_TUTORIAL_STATE, AT);
    expect(tutorialStepProgress(started)).toEqual({ index: 1, total: TUTORIAL_STEP_TOTAL });
    const second = setTutorialStep(started, 'product-create', AT);
    expect(tutorialStepProgress(second)).toEqual({ index: 2, total: TUTORIAL_STEP_TOTAL });
    expect(tutorialStepProgress(INITIAL_TUTORIAL_STATE)).toBeNull();
  });
});
