export interface Customer {
  id: string;
  storeId: string;
  telegramId: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  totalSpent: number;
  createdAt: string;
}

export interface RecipientInfo {
  name: string;
  phone: string;
  address: string;
}
