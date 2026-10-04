/**
 * Есть ли в истории роутера предыдущий переход, куда можно вернуться
 * (используется умным «назад» и слоями с self-managed exit).
 */
export function canGoBack(): boolean {
  if (typeof window === 'undefined' || !window.history.state) return false;
  const { idx } = window.history.state as { idx?: number };
  return typeof idx === 'number' && idx > 0;
}
