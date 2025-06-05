
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

export interface BudgetCategoryLimit {
  category: string;
  limit: number;
}

export type Budget = {
  id: string;
  name: string;
  categories: BudgetCategoryLimit[]; // Array of objects with category and its limit
  
  // These represent the definition of the budget's timing
  startDate: string; // For non-recurring, this is THE start date. For recurring, this might be the original start or a calculated current period start for display.
  endDate: string;   // For non-recurring, this is THE end date. For recurring, this is the original end of the first period or calculated current period end.

  isRecurring?: boolean;
  recurrenceFrequency?: BudgetRecurrenceFrequency | null;
  originalStartDate?: string | null; // The very first start date of a recurring series

  // 'spent' will be calculated on the frontend for the viewed period
  // 'overallLimit' will be calculated on the frontend as sum of category limits
};

// Data structure for creating/updating budgets via forms/actions
export interface BudgetUpsertData {
  name: string;
  categoriesAndLimits: BudgetCategoryLimit[];
  isRecurring: boolean;
  recurrenceFrequency: BudgetRecurrenceFrequency | null;
  originalStartDate: string | null; // ISO string
  // For non-recurring, startDate and endDate from the form will map to originalStartDate and a calculated end.
  // For recurring, startDate from form is originalStartDate, endDate from form helps define first period length.
  formStartDate: string; // Date string from form input for start
  formEndDate: string; // Date string from form input for end (used to determine first period length for recurring)
}


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

