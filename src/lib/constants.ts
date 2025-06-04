
// src/lib/constants.ts

// Define the fields your application requires for a transaction for CSV mapping
export const REQUIRED_TRANSACTION_FIELDS = [
  'Date',
  'Description',
  'Amount',
  'Type', // Expected values: "income" or "expense" or similar like "credit"/"debit"
  'Category',
  'Account Name',
] as const;
