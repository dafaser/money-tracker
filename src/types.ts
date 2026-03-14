export interface Account {
  id: string;
  userId: string;
  name: string;
  balance: number;
  updatedAt: string;
}

export interface Investment {
  id: string;
  userId: string;
  name: string;
  category: string;
  value: number;
  updatedAt: string;
}

export interface Liability {
  id: string;
  userId: string;
  name: string;
  amount: number;
  updatedAt: string;
}

export type TransactionType = 'income' | 'expense' | 'debt_payment' | 'investment_deposit' | 'investment_withdrawal' | 'debt_expense';

export interface Transaction {
  id: string;
  userId: string;
  date: string;
  category: string;
  accountId: string;
  accountType: 'cash' | 'investment' | 'liability';
  amount: number;
  type: TransactionType;
  notes: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: string;
}

export interface Information {
  id: string;
  userId: string;
  type: 'bank' | 'ewallet';
  provider: string;
  accountNumber: string;
  accountName: string;
  updatedAt: string;
}
