import type { StateCreator } from 'zustand';
import type { RootStore } from '../index';

export interface FlyingDot {
  id: string;
  imageUrl: string;
  target: 'cart' | 'favorites';
  x: number;
  y: number;
}

export interface UiSlice {
  animations: FlyingDot[];
  pushAnimation: (dot: Omit<FlyingDot, 'id'>) => void;
  dropAnimation: (id: string) => void;
  activeModal: string | null;
  openModal: (name: string) => void;
  closeModal: () => void;
  toast: string | null;
  showToast: (text: string) => void;
  clearToast: () => void;
}

function uid(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export const createUiSlice: StateCreator<RootStore, [], [], UiSlice> = (set) => ({
  animations: [],
  pushAnimation: (dot) =>
    set((s) => ({ animations: [...s.animations, { ...dot, id: uid() }] })),
  dropAnimation: (id) => set((s) => ({ animations: s.animations.filter((a) => a.id !== id) })),
  activeModal: null,
  openModal: (name) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),
  toast: null,
  showToast: (text) => set({ toast: text }),
  clearToast: () => set({ toast: null }),
});
