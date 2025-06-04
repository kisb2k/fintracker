export type Account = {
  id: string;
  name: string;
  bankName: 'Chase' | 'Discover' | 'Other' | 'Manual';
  balance: number;
  type: 'checking' | 'savings' | 'credit card' | 'cash' | 'crypto';
  lastFour?: string; // Optional: last four digits of account number
};

export type Transaction = {
  id: string;
  accountId: string;
  date: string; // ISO string e.g. "2023-10-26T10:00:00Z"
  description: string;
  amount: number; // positive for income, negative for expense
  category: string;
  status?: 'pending' | 'posted'; // Optional
};

export type Budget = {
  id: string;
  name: string;
  category: string;
  limit: number;
  spent: number; // This would typically be calculated
  startDate: string; // ISO string
  endDate: string; // ISO string
};

export type PlaidTokenExchangeResponse = {
  access_token: string;
  item_id: string;
  request_id: string;
};

// For AI Insights
export type CategorizedTransaction = {
  originalDescription: string;
  suggestedCategory: string;
  confidence: number;
};

export type TaxDeductionInfo = {
  transactionId: string;
  description: string;
  reason: string;
};

export type UnusualSpendingInfo = {
  detected: boolean;
  explanation: string;
  suggestions: string;
};
