/** Локальные сущности — в БД их нет */

export interface Review {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  text: string;
  answer: string | null;
  createdAt: string;
}

export interface Question {
  id: string;
  productId: string;
  authorName: string;
  text: string;
  answer: string | null;
  createdAt: string;
}
