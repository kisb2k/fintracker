
import type { Account, Transaction, Budget } from './types';
import { formatISO, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek, endOfWeek, addDays } from 'date-fns';

export const mockAccounts: Account[] = [
  {
    id: 'acc_1',
    name: 'Chase Checking',
    bankName: 'Chase',
    balance: 5210.75,
    type: 'checking',
    lastFour: '1234',
  },
  {
    id: 'acc_2',
    name: 'Discover Savings',
    bankName: 'Discover',
    balance: 12500.0,
    type: 'savings',
    lastFour: '5678',
  },
  {
    id: 'acc_3',
    name: 'Chase Sapphire Preferred',
    bankName: 'Chase',
    balance: -750.20, // Negative for credit card debt
    type: 'credit card',
    lastFour: '9012',
  },
  {
    id: 'acc_4',
    name: 'Cash Wallet',
    bankName: 'Manual',
    balance: 300.0,
    type: 'cash',
  },
  {
    id: 'acc_5',
    name: 'Crypto Portfolio',
    bankName: 'Manual',
    balance: 8750.0, // Example value for crypto
    type: 'crypto',
  },
];

const today = new Date('2024-07-15T12:00:00.000Z'); // Use a fixed date for mock data consistency

const getDateString = (daysAgo: number): string => {
  const date = new Date(today);
  date.setDate(today.getDate() - daysAgo);
  return date.toISOString();
};

export const mockTransactions: Transaction[] = [
  {
    id: 'txn_1',
    accountId: 'acc_1',
    date: getDateString(1),
    description: 'Starbucks Coffee',
    amount: -5.75,
    category: 'Food & Drink',
    status: 'posted',
  },
  {
    id: 'txn_2',
    accountId: 'acc_1',
    date: getDateString(2),
    description: 'Monthly Salary Deposit',
    amount: 3500.0,
    category: 'Income',
    status: 'posted',
  },
  {
    id: 'txn_3',
    accountId: 'acc_3',
    date: getDateString(3),
    description: 'Amazon Purchase - Electronics',
    amount: -129.99,
    category: 'Shopping',
    status: 'posted',
  },
  {
    id: 'txn_4',
    accountId: 'acc_2',
    date: getDateString(5),
    description: 'Interest Earned',
    amount: 10.50,
    category: 'Income',
    status: 'posted',
  },
  {
    id: 'txn_5',
    accountId: 'acc_1',
    date: getDateString(5),
    description: 'Netflix Subscription',
    amount: -15.99,
    category: 'Entertainment',
    status: 'posted',
  },
  {
    id: 'txn_6',
    accountId: 'acc_3',
    date: getDateString(7),
    description: 'Whole Foods Groceries',
    amount: -85.43,
    category: 'Groceries',
    status: 'pending',
  },
  {
    id: 'txn_7',
    accountId: 'acc_4', // Cash
    date: getDateString(1),
    description: 'Lunch with friend',
    amount: -20.00,
    category: 'Food & Drink',
    status: 'posted',
  },
   {
    id: 'txn_8',
    accountId: 'acc_1',
    date: getDateString(10),
    description: 'Shell Gas Station',
    amount: -55.00,
    category: 'Transportation',
    status: 'posted',
  },
  {
    id: 'txn_9',
    accountId: 'acc_3',
    date: getDateString(12),
    description: 'Restaurant - Dinner',
    amount: -78.50,
    category: 'Food & Drink',
    status: 'posted',
  },
  {
    id: 'txn_10',
    accountId: 'acc_1',
    date: getDateString(15),
    description: 'Rent Payment',
    amount: -1800.00,
    category: 'Housing',
    status: 'posted',
  },
  {
    id: 'txn_11',
    accountId: 'acc_1',
    date: getDateString(4),
    description: 'Utility Bill - Electricity',
    amount: -75.00,
    category: 'Utilities',
    status: 'posted',
  }
];

const currentMonthStart = startOfMonth(today);
const currentMonthEnd = endOfMonth(today);
const prevMonthStart = startOfMonth(subMonths(today,1));
const prevMonthEnd = endOfMonth(subMonths(today,1));


export const mockBudgets: Budget[] = [
  {
    id: 'bud_1',
    name: 'Monthly Household Expenses',
    categories: ['Groceries', 'Utilities'], // Multiple categories
    limit: 600, // Overall limit for Groceries + Utilities
    spent: 0, 
    startDate: formatISO(currentMonthStart),
    endDate: formatISO(currentMonthEnd),
    isRecurring: true,
    recurrenceFrequency: 'monthly',
    originalStartDate: formatISO(startOfMonth(new Date(2024,0,1))), 
  },
  {
    id: 'bud_2',
    name: 'Discretionary Spending',
    categories: ['Food & Drink', 'Entertainment', 'Shopping'], // Multiple categories
    limit: 400,
    spent: 0,
    startDate: formatISO(currentMonthStart),
    endDate: formatISO(currentMonthEnd),
    isRecurring: true,
    recurrenceFrequency: 'monthly',
    originalStartDate: formatISO(startOfMonth(new Date(2024,0,1))),
  },
  {
    id: 'bud_3',
    name: 'One-time Tech Purchase',
    categories: ['Shopping'], // Can still be a single category
    limit: 300,
    spent: 0,
    startDate: formatISO(prevMonthStart), 
    endDate: formatISO(prevMonthEnd),
    isRecurring: false,
  },
  {
    id: 'bud_4',
    name: 'Weekly Transport',
    categories: ['Transportation'],
    limit: 75,
    spent: 0,
    startDate: formatISO(startOfWeek(today, { weekStartsOn: 1 })), // Example for current week
    endDate: formatISO(endOfWeek(today, { weekStartsOn: 1 })),   
    isRecurring: true,
    recurrenceFrequency: 'weekly',
    originalStartDate: formatISO(new Date('2024-01-01T00:00:00.000Z')),
  }
];

export const transactionCategories: string[] = [
  "Groceries",
  "Food & Drink",
  "Shopping",
  "Transportation",
  "Housing",
  "Utilities",
  "Healthcare",
  "Entertainment",
  "Personal Care",
  "Education",
  "Travel",
  "Gifts & Donations",
  "Income",
  "Investments",
  "Business Expense",
  "Other",
  "Uncategorized" 
];
