import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, X } from 'lucide-react';
import {
  consumeTutorialPreviewOpened,
  useSellerTutorial,
} from '../../../application/hooks/useSellerTutorial';
import { useStore } from '../../../application/store';
import { dashboardKeys } from '../../../application/dashboard/dashboard-cache';
import type { SellerDashboardSummary } from '../../../application/read-models/seller-dashboard';
import { tutorialStepIndex } from '../../../domain/rules/tutorial-rules';
import {
  PRODUCT_CREATE_ROUTE,
  isInventoryRoute,
  isProductCreateRoute,
  resolveTutorialStepView,
} from './tutorial-steps';
import './tutorial.css';

/** Прямоугольник цели в координатах вьюпорта; пересчитывается на скролл/resize/keyboard. */
function useTargetRect(selector: string | null, activeKey: string): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    let raf = 0;
    const startedAt = Date.now();
    const measure = () => {
      if (!selector) {
        setRect(null);
        return;
      }
      const el = document.querySelector(selector);
      if (el) setRect(el.getBoundingClientRect());
      // Цель ещё не смонтирована (lazy-роут/загрузка данных): сохраняем прежнее
      // положение, чтобы spotlight «перелетел» к цели, когда она появится.
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    schedule();
    // Поллинг: пока цель не появилась (до 5с) и ещё ~1.2с после — чтобы поймать
    // смещение layout (шрифты/картинки) без ожидания скролла.
    const interval = window.setInterval(() => {
      schedule();
      const elapsed = Date.now() - startedAt;
      const present = selector ? !!document.querySelector(selector) : true;
      if (present && elapsed > 1200) window.clearInterval(interval);
      if (!present && elapsed > 5000) window.clearInterval(interval);
    }, 120);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
    };
  }, [selector, activeKey]);

  return rect;
}

/**
 * Простая проверка заполненности поля шага перед «Далее» (docs/26 TUT-05):
 * для количества/цены — число > 0, для остальных — непустой текст. Читаем значение
 * прямо из input внутри подсвеченного блока, чтобы не тянуть состояние формы в оверлей.
 */
function isFieldFilled(target: string | null): boolean {
  if (!target) return true;
  // Необязательные подшаги (фото, описание) — не блокируют «Далее».
  if (target === '[data-tour="product-photo"]' || target === '[data-tour="product-description"]') {
    return true;
  }
  const root = document.querySelector(target);
  const input = root?.querySelector('input, textarea') as
    HTMLInputElement | HTMLTextAreaElement | null;
  const value = input?.value ?? '';
  if (target === '[data-tour="product-quantity"]' || target === '[data-tour="product-price"]') {
    return Number(value.replace(',', '.')) > 0;
  }
  return value.trim().length > 0;
}

/**
 * Оверлей-слой обучения (docs/26 §4.2, TUT-05/TUT-07): затемнение + spotlight по
 * конкретному блоку (`data-tour`), карточка шага с прогрессом и действиями, а также
 * краткий фидбек «шаг выполнен» при переходе. Маска не перехватывает клики
 * (`pointer-events: none`) — пользователь свободно взаимодействует с подсвеченным
 * элементом и навигацией; карточка кликабельна.
 *
 * Монтируется глобально в seller-shell, поэтому ведёт через смену экранов.
 */
export default function TutorialOverlay() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tutorial = useSellerTutorial();
  const [partIndex, setPartIndex] = useState(0);
  const [fieldError, setFieldError] = useState(false);
  // Стабильные ссылки на команды для слушателей DOM/keyboard (не пересоздаём эффект каждый рендер).
  const setStepRef = useRef(tutorial.setStep);
  const dismissRef = useRef(tutorial.dismiss);
  useEffect(() => {
    setStepRef.current = tutorial.setStep;
    dismissRef.current = tutorial.dismiss;
  });

  // Сводка главной (из кэша, без нового запроса): нужна для §8.6 (уже есть товар).
  const userId = useStore((s) => s.serverUser?.id ?? null);
  const storeId = useStore((s) => s.storeId);
  const { data: summary } = useQuery<SellerDashboardSummary | null>({
    queryKey: dashboardKeys.summary(userId, storeId),
    queryFn: () => Promise.resolve(null),
    enabled: false,
    staleTime: Infinity,
  });
  const hasExistingProduct = (summary?.inventory.buyerAvailableProducts ?? 0) >= 1;

  const step = tutorial.step;
  const view = useMemo(
    () => (tutorial.interrupted ? resolveTutorialStepView(step, pathname) : null),
    [tutorial.interrupted, step, pathname],
  );

  // Сброс подшага при смене шага/маршрута — корректировка состояния в рендере
  // (react.dev «adjusting state when props change»), без setState в эффекте.
  const stepKey = `${step}:${pathname}`;
  const [prevStepKey, setPrevStepKey] = useState(stepKey);
  if (prevStepKey !== stepKey) {
    setPrevStepKey(stepKey);
    setPartIndex(0);
    setFieldError(false);
  }

  const parts = view?.parts ?? [];
  const part = parts[Math.min(partIndex, Math.max(parts.length - 1, 0))] ?? null;
  const activeKey = `${step}:${partIndex}:${pathname}`;
  const targetSelector = part?.target ?? null;
  const rect = useTargetRect(targetSelector, activeKey);

  // Escape = «Завершить обучение» (доступность, §4.2): клавиатурный выход из оверлея.
  const overlayActive = !!view && !!part;
  useEffect(() => {
    if (!overlayActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void dismissRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [overlayActive]);

  // Шаг 1 закрывается сам, когда пользователь открыл «Инвентарь» (тап по вкладке).
  const orientationAdvancedRef = useRef(false);
  useEffect(() => {
    if (step === 'orientation' && isInventoryRoute(pathname) && !orientationAdvancedRef.current) {
      orientationAdvancedRef.current = true;
      void tutorial.setStep('product-create');
    }
  }, [step, pathname, tutorial]);

  // Мягко подводим экран к подсвечиваемому полю и центрируем его во вьюпорте.
  // Скроллим именно контейнер `.scrollable-content` (не window) — так поле реально
  // оказывается по центру; повторяем попытку, пока цель не появится.
  useEffect(() => {
    if (!targetSelector) return;
    let timer = 0;
    const center = () => {
      const el = document.querySelector(targetSelector);
      if (!el) return false;
      const scroller = el.closest('.scrollable-content') as HTMLElement | null;
      if (scroller) {
        const elRect = el.getBoundingClientRect();
        const scRect = scroller.getBoundingClientRect();
        const target =
          scroller.scrollTop +
          (elRect.top - scRect.top) -
          (scroller.clientHeight - elRect.height) / 2;
        if (typeof scroller.scrollTo === 'function') {
          scroller.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
        }
      } else if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return true;
    };
    const attempt = () => {
      if (!center()) timer = window.setTimeout(attempt, 150);
    };
    timer = window.setTimeout(attempt, 120);
    return () => window.clearTimeout(timer);
  }, [targetSelector, activeKey]);

  // Пока подсвечен конкретный блок — запрещаем РУЧНОЙ скролл контейнера, чтобы
  // spotlight не «улетал» при прокрутке. Программное центрирование (scrollTo) не
  // блокируется, поэтому фокус всегда остаётся на нужном поле.
  useEffect(() => {
    if (!targetSelector) return;
    const scroller = document.querySelector('.scrollable-content');
    if (!scroller) return;
    const block = (e: Event) => {
      if (e.cancelable) e.preventDefault();
    };
    scroller.addEventListener('touchmove', block, { passive: false });
    scroller.addEventListener('wheel', block, { passive: false });
    return () => {
      scroller.removeEventListener('touchmove', block);
      scroller.removeEventListener('wheel', block);
    };
  }, [targetSelector, activeKey]);

  // Шаг `product-buyer-view` закрывается при возврате из предпросмотра (docs/26 §4.4):
  // предпросмотр размонтировал seller-shell, поэтому факт «открывал предпросмотр» пришёл
  // из памяти контроллера — по возврату переводим на storefront.
  useEffect(() => {
    if (step === 'product-buyer-view' && consumeTutorialPreviewOpened()) {
      void tutorial.setStep('storefront');
    }
  }, [step, pathname, tutorial]);

  // Клик по самой цели (кнопка «Копировать» ссылку на витрину): уводим на главную и
  // открываем финальную карточку-поздравление (docs/26 §4.4, TUT-06).
  useEffect(() => {
    if (part?.onClickAction !== 'to-finish' || !targetSelector) return;
    let attached: HTMLElement | null = null;
    let done = false;
    const onClick = () => {
      if (done) return;
      done = true;
      navigate('/seller/dashboard');
      void setStepRef.current('finish');
    };
    const tryAttach = () => {
      if (attached) return true;
      const el = document.querySelector(targetSelector) as HTMLElement | null;
      if (!el) return false;
      el.addEventListener('click', onClick);
      attached = el;
      return true;
    };
    tryAttach();
    const interval = window.setInterval(() => {
      if (tryAttach()) window.clearInterval(interval);
    }, 150);
    const stop = window.setTimeout(() => window.clearInterval(interval), 5000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
      attached?.removeEventListener('click', onClick);
    };
  }, [part?.onClickAction, targetSelector, activeKey, navigate]);

  // Фидбек «шаг выполнен»: переход вперёд по шагам ИЛИ вход в форму создания (тап «+»).
  const [flash, setFlash] = useState(false);
  const prevRef = useRef({ step, pathname });
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { step, pathname };
    const advanced = prev.step && step && tutorialStepIndex(step) > tutorialStepIndex(prev.step);
    const enteredForm =
      step === 'product-create' &&
      isProductCreateRoute(pathname) &&
      !isProductCreateRoute(prev.pathname);
    if (advanced || enteredForm) {
      setFlash(true);
      const timer = window.setTimeout(() => setFlash(false), 1600);
      return () => window.clearTimeout(timer);
    }
  }, [step, pathname]);

  // Позиция карточки рядом с целью (сверху/снизу), иначе — снизу по центру.
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [part, partIndex, pathname]);

  const cardStyle = useMemo(() => {
    if (!rect) return { left: '50%', bottom: 16, transform: 'translateX(-50%)' };
    const gap = 12;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow > cardHeight + gap + 16
        ? rect.bottom + gap
        : Math.max(12, rect.top - gap - cardHeight);
    return { left: '50%', top, transform: 'translateX(-50%)' };
  }, [rect, cardHeight]);

  const spotlightStyle = rect
    ? {
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
      }
    : null;

  const titleId = 'tutorial-step-title';
  const textId = 'tutorial-step-text';

  const progressLabel =
    tutorial.progress != null
      ? t('seller.tutorial.stepLabel', {
          index: tutorial.progress.index,
          total: tutorial.progress.total,
        })
      : '';

  const dots = tutorial.progress
    ? Array.from({ length: tutorial.progress.total }, (_, i) => i < tutorial.progress!.index)
    : [];

  const advancePart = () => {
    setFieldError(false);
    setPartIndex((i) => Math.min(i + 1, parts.length - 1));
  };

  const onPrimary = () => {
    if (step === 'orientation') {
      void tutorial.setStep('product-create');
      return;
    }
    if (step === 'product-create') {
      if (!isProductCreateRoute(pathname)) {
        navigate(PRODUCT_CREATE_ROUTE);
        return;
      }
      if (partIndex < parts.length - 1) {
        // Нельзя проскочить поле: публикация без данных не сработает.
        if (!isFieldFilled(part?.target ?? null)) {
          setFieldError(true);
          return;
        }
        advancePart();
      }
      return;
    }
    if (step === 'finish') {
      void tutorial.complete();
    }
  };

  const showSecondary = step === 'product-create' && !isProductCreateRoute(pathname);

  // «Пропустить шаг»: у orientation — переход к созданию; у необязательных подшагов формы
  // (фото/описание) — просто дальше. Обязательные поля пропустить нельзя.
  const canSkip = view?.skippable || !!part?.skippable;
  const onSkip = () => {
    if (step === 'orientation') {
      void tutorial.setStep('product-create');
      return;
    }
    advancePart();
  };

  return createPortal(
    <>
      {flash ? (
        <div className="tutorial-flash" role="status">
          <CheckCircle2 size={18} aria-hidden />
          <span>{t('seller.tutorial.stepDone')}</span>
        </div>
      ) : null}

      {view && part ? (
        <div className="tutorial-overlay" data-testid="tutorial-overlay">
          {spotlightStyle ? (
            <div className="tutorial-overlay__spotlight" style={spotlightStyle} />
          ) : (
            <div className="tutorial-overlay__scrim" />
          )}

          <div
            className="tutorial-overlay__card"
            style={cardStyle}
            ref={cardRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            aria-describedby={textId}
          >
            <div className="tutorial-overlay__head">
              <span className="tutorial-overlay__progress">
                <span className="tutorial-overlay__dots" aria-hidden>
                  {dots.map((done, i) => (
                    <span
                      key={i}
                      className={`tutorial-overlay__dot${done ? ' tutorial-overlay__dot--done' : ''}`}
                    />
                  ))}
                </span>
                <span className="tutorial-overlay__progress-text">{progressLabel}</span>
              </span>
              <span className="tutorial-overlay__controls">
                {canSkip ? (
                  <button type="button" className="tutorial-overlay__link" onClick={onSkip}>
                    {t('seller.tutorial.skip')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="tutorial-overlay__close"
                  aria-label={t('seller.tutorial.finish')}
                  onClick={() => void tutorial.dismiss()}
                >
                  <X size={16} />
                </button>
              </span>
            </div>

            <h2 id={titleId} className="tutorial-overlay__title">
              {t(part.titleKey)}
            </h2>
            <p id={textId} className="tutorial-overlay__text">
              {t(part.textKey)}
            </p>
            {fieldError ? (
              <p className="tutorial-overlay__error" role="alert">
                {t('seller.tutorial.fieldRequired')}
              </p>
            ) : null}

            <div className="tutorial-overlay__actions">
              {showSecondary && hasExistingProduct ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void tutorial.setStep('product-buyer-view')}
                >
                  {t('seller.tutorial.steps.productCreate.viewExisting')}
                </button>
              ) : null}
              {part.primaryKey ? (
                <button type="button" className="btn-primary" onClick={onPrimary}>
                  {t(part.primaryKey)}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
