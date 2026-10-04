import type { StateCreator } from 'zustand';
import type { RootStore } from '../index';

export interface FlyingDot {
  id: string;
  imageUrl: string;
  target: 'cart' | 'favorites';
  x: number;
  y: number;
}

export interface ToastMessage {
  /** Уникальный id — ключ для перезапуска анимации и (re)таймера. */
  id: string;
  text: string;
  /** Миниатюра товара (например, при добавлении в корзину). */
  imageUrl?: string | null;
}

export interface UiSlice {
  animations: FlyingDot[];
  pushAnimation: (dot: Omit<FlyingDot, 'id'>) => void;
  dropAnimation: (id: string) => void;
  activeModal: string | null;
  openModal: (name: string) => void;
  closeModal: () => void;
  toast: ToastMessage | null;
  /** Строка (обычный тост) либо объект с миниатюрой (напр. добавление в корзину). */
  showToast: (input: string | { text: string; imageUrl?: string | null }) => void;
  clearToast: () => void;
}

function uid(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export const createUiSlice: StateCreator<RootStore, [], [], UiSlice> = (set) => ({
  animations: [],
  pushAnimation: (dot) => set((s) => ({ animations: [...s.animations, { ...dot, id: uid() }] })),
  dropAnimation: (id) => set((s) => ({ animations: s.animations.filter((a) => a.id !== id) })),
  activeModal: null,
  openModal: (name) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),
  toast: null,
  showToast: (input) =>
    set({
      toast:
        typeof input === 'string'
          ? { id: uid(), text: input }
          : { id: uid(), text: input.text, imageUrl: input.imageUrl ?? null },
    }),
  clearToast: () => set({ toast: null }),
});
