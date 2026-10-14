/**
 * Глубина навигационной истории приложения.
 *
 * Роутер — `MemoryRouter`: он держит собственную историю и не пишет в
 * `window.history`, поэтому браузерный `history.state.idx` для определения
 * «можно ли вернуться назад» непригоден. Глубину считает `NavigationHistoryTracker`
 * (PUSH +1, POP −1, REPLACE без изменений), а здесь хранится её значение.
 */
let navigationDepth = 0;

/**
 * Есть ли в истории роутера предыдущий переход, куда можно вернуться
 * (используется умным «назад» и слоями с self-managed exit).
 */
export function canGoBack(): boolean {
  return navigationDepth > 0;
}

/** Текущая глубина истории (диагностика/тесты). */
export function getNavigationDepth(): number {
  return navigationDepth;
}

/** Обновляет глубину истории; вызывает трекер навигации. */
export function setNavigationDepth(depth: number): void {
  navigationDepth = Math.max(0, depth);
}

/** Сброс внутреннего состояния (только для тестов). */
export function resetNavigationDepth(): void {
  navigationDepth = 0;
}
