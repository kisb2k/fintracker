
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
  amountLimit: number;
}

export type Budget = {
  id: string;
  name: string;
  categories: BudgetCategoryLimit[]; 
  
  startDate: string; 
  endDate: string;   

  isRecurring?: boolean;
  recurrenceFrequency?: BudgetRecurrenceFrequency | null;
  originalStartDate?: string | null; 
  isDefault?: boolean; // New field for default budget
};

// Data structure for creating/updating budgets via forms/actions
export interface BudgetUpsertData {
  name: string;
  categoriesAndLimits: BudgetCategoryLimit[];
  isRecurring: boolean;
  recurrenceFrequency: BudgetRecurrenceFrequency | null;
  formStartDate: string; 
  formEndDate: string; 
}


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

// For Account Forms
export type AccountFormData = {
  name: string;
  bankName: string;
  type: Account['type'];
  lastFour?: string | null;
};

// For Dashboard Spending Chart
export type SpendingChartDataPoint = {
  name: string; // Category name
  Spending: number;
  limit?: number; // Optional: for displaying limit in tooltip or for comparison
};

// For Dashboard Drilldown Dialog
export interface CategoryTransactionDetails {
  categoryName: string;
  transactions: Transaction[];
  totalSpent: number;
  limit?: number;
}

