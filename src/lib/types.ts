
export type Account = {
  id: string;
  name: string;
  bankName: string;
  balance: number;
  type: 'checking' | 'savings' | 'credit card' | 'cash' | 'crypto' | 'other' | 'investment' | 'loan';
  lastFour?: string | null; // Allow null for optional lastFour
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

export type BudgetRecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';

export type Budget = {
  id: string;
  name: string;
  categories: string[]; // Changed from category: string to categories: string[]
  limit: number; // This limit applies to the sum of spending across all categories in this budget
  spent: number; // This will be 'spent' for the currently selected/viewed period (sum across categories)
  
  // For non-recurring, these define the single period
  // For recurring, these will be dynamically set for the selected period instance
  startDate: string; 
  endDate: string; 

  // Fields for recurrence
  isRecurring?: boolean;
  recurrenceFrequency?: BudgetRecurrenceFrequency | null;
  originalStartDate?: string | null; // The very first start date of a recurring series
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

// For Account Forms
export type AccountFormData = {
  name: string;
  bankName: string;
  type: Account['type'];
  lastFour?: string | null;
};

