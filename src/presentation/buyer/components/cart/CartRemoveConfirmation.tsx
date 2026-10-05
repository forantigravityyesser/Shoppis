interface Props {
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Inline-подтверждение удаления позиции (docs/18 §19). «Нет» закрывает,
 * «Да» удаляет ровно эту позицию. Одновременно подтверждение открыто
 * только у одного товара — состояние держит `CartView` (`pendingRemoveItemKey`).
 */
export default function CartRemoveConfirmation({ onCancel, onConfirm }: Props) {
  return (
    <div className="cart-remove-confirm" role="group" aria-label="Удаление товара">
      <p className="cart-remove-confirm__text">Удалить товар из корзины?</p>
      <div className="cart-remove-confirm__actions">
        <button type="button" className="cart-remove-confirm__cancel" onClick={onCancel}>
          Нет
        </button>
        <button type="button" className="cart-remove-confirm__confirm" onClick={onConfirm}>
          Да
        </button>
      </div>
    </div>
  );
}
