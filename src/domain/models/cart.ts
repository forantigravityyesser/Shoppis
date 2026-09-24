export interface CartItem {
  productId: string;
  productVariantId: string | null;
  quantity: number;
  /** Снапшот продажной цены на момент добавления */
  price: number;
  /** Включён ли товар в оформление (чекбокс в корзине) */
  selected: boolean;
}

export interface CartState {
  items: CartItem[];
}
