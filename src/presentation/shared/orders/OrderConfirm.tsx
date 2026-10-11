interface Props {
  text: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Мутация в полёте — блокирует повторный submit. */
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Блок подтверждения действия заказа (docs/22 §5.8). Общий для buyer/seller:
 * текст и подписи задаёт тонкий view; компонент не знает про конкретную мутацию.
 */
export default function OrderConfirm({
  text,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  pending = false,
  error,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="order-confirm" role="group" aria-label="Подтверждение действия">
      <p className="order-confirm__text">{text}</p>
      {error ? (
        <p className="order-confirm__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="order-confirm__actions">
        <button
          type="button"
          className="order-confirm__cancel"
          onClick={onCancel}
          disabled={pending}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className="order-confirm__danger"
          onClick={onConfirm}
          disabled={pending}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
