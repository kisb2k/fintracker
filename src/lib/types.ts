
export type Account = {
  id: string;
  name: string;
  bankName: string; 
  balance: number;
  type: 'checking' | 'savings' | 'credit card' | 'cash' | 'crypto' | 'other' | 'investment' | 'loan';
  lastFour?: string; 
};

export type Transaction = {
  id:string;
  accountId: string;
  date: string; // ISO string e.g. "2023-10-26T10:00:00Z"
  description: string;
  amount: number; // positive for income, negative for expense
  category: string;
  status?: 'pending' | 'posted';
  loadTimestamp?: string; // ISO string for when the transaction was loaded
  sourceFileName?: string | null; // Name of the file it came from, or e.g. "Manual Entry"
};

export type Budget = {
  id: string;
  name: string;
  category: string;
  limit: number;
  spent: number;
  startDate: string; // ISO string
  endDate: string; // ISO string
};

// For AI Insights
export type CategorizedTransaction = {
  originalDescription: string;
  suggestedCategory: string;
  confidence: number;
};

export type TaxDeductionInfo = {
  transactionId: string; // Should match Transaction['id']
  description: string; // Description of why it might be deductible
  reason: string; // More detailed reason or rule
};

export type UnusualSpendingInfo = {
  detected: boolean;
  explanation: string;
  suggestions: string;
};
