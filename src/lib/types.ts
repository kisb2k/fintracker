
export type Account = {
  id: string;
  name: string;
  bankName: string; // Changed from specific enum to string for Plaid institution names
  balance: number;
  type: 'checking' | 'savings' | 'credit card' | 'cash' | 'crypto' | 'other' | 'investment' | 'loan'; // Added 'other', 'investment', 'loan'
  lastFour?: string; // Optional: last four digits of account number
};

export type Transaction = {
  id:string;
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

// This was more for Plaid V1, Plaid Link V2 with usePlaidLink handles token exchange response differently (via server action)
// export type PlaidTokenExchangeResponse = {
//   access_token: string;
//   item_id: string;
//   request_id: string;
// };

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

// Metadata from Plaid Link onSuccess callback
export interface PlaidLinkOnSuccessMetadata {
  institution: {
    name: string;
    institution_id: string;
  } | null;
  accounts: Array<{
    id: string;
    name: string;
    mask: string | null;
    type: string;
    subtype: string;
    verification_status: string | null;
  }>;
  link_session_id: string;
  public_token?: string; // This is the old name for public_token, included for compatibility if old docs are referenced
}
