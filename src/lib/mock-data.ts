import type { Account, Transaction, Budget } from './types';

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

const today = new Date();
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
  }
];

export const mockBudgets: Budget[] = [
  {
    id: 'bud_1',
    name: 'Monthly Groceries',
    category: 'Groceries',
    limit: 400,
    spent: mockTransactions.filter(t => t.category === 'Groceries' && t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
    startDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(),
    endDate: new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString(),
  },
  {
    id: 'bud_2',
    name: 'Eating Out',
    category: 'Food & Drink',
    limit: 250,
    spent: mockTransactions.filter(t => t.category === 'Food & Drink' && t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
    startDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(),
    endDate: new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString(),
  },
  {
    id: 'bud_3',
    name: 'Shopping',
    category: 'Shopping',
    limit: 300,
    spent: mockTransactions.filter(t => t.category === 'Shopping' && t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
    startDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(),
    endDate: new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString(),
  },
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
];
