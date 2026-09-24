import type { StateCreator } from 'zustand';
import type { Question, Review } from '../../../domain/models/review';
import type { RootStore } from '../index';

function uid(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Отзывы и вопросы живут только локально (в БД их нет), не персистятся */
export interface ReviewSlice {
  reviews: Review[];
  questions: Question[];
  addReview: (input: Omit<Review, 'id' | 'answer' | 'createdAt'>) => void;
  addQuestion: (input: Omit<Question, 'id' | 'answer' | 'createdAt'>) => void;
  answerReview: (id: string, answer: string) => void;
  answerQuestion: (id: string, answer: string) => void;
  removeReview: (id: string) => void;
}

export const createReviewSlice: StateCreator<RootStore, [], [], ReviewSlice> = (set) => ({
  reviews: [],
  questions: [],

  addReview: (input) =>
    set((s) => ({
      reviews: [...s.reviews, { ...input, id: uid(), answer: null, createdAt: new Date().toISOString() }],
    })),

  addQuestion: (input) =>
    set((s) => ({
      questions: [...s.questions, { ...input, id: uid(), answer: null, createdAt: new Date().toISOString() }],
    })),

  answerReview: (id, answer) =>
    set((s) => ({ reviews: s.reviews.map((r) => (r.id === id ? { ...r, answer } : r)) })),

  answerQuestion: (id, answer) =>
    set((s) => ({ questions: s.questions.map((q) => (q.id === id ? { ...q, answer } : q)) })),

  removeReview: (id) => set((s) => ({ reviews: s.reviews.filter((r) => r.id !== id) })),
});
