import { getDb } from '@/lib/db';
import * as duckdb from 'duckdb';

describe('Database Operations', () => {
  let db: duckdb.Database;

  beforeEach(async () => {
    db = await getDb();
  });

  afterEach(async () => {
    await db.close();
  });

  test('should create accounts table', async () => {
    const result = await db.all("SELECT * FROM accounts");
    expect(Array.isArray(result)).toBe(true);
  });

  test('should create transactions table', async () => {
    const result = await db.all("SELECT * FROM transactions");
    expect(Array.isArray(result)).toBe(true);
  });

  test('should create budgets table', async () => {
    const result = await db.all("SELECT * FROM budgets");
    expect(Array.isArray(result)).toBe(true);
  });

  test('should create budget_category_limits table', async () => {
    const result = await db.all("SELECT * FROM budget_category_limits");
    expect(Array.isArray(result)).toBe(true);
  });

  test('should add a new account', async () => {
    const accountId = 'test-account-1';
    const accountName = 'Test Account';
    
    await db.run(
      'INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)',
      accountId,
      accountName,
      'checking'
    );

    const result = await db.all('SELECT * FROM accounts WHERE id = ?', accountId);
    expect(result[0]).toMatchObject({
      id: accountId,
      name: accountName,
      type: 'checking'
    });
  });

  test('should add a new transaction', async () => {
    const accountId = 'test-account-2';
    const transactionId = 'test-transaction-1';
    
    // First create an account
    await db.run(
      'INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)',
      accountId,
      'Test Account 2',
      'checking'
    );

    // Then add a transaction
    await db.run(
      'INSERT INTO transactions (id, accountId, date, description, amount) VALUES (?, ?, ?, ?, ?)',
      transactionId,
      accountId,
      '2024-03-20',
      'Test Transaction',
      100.00
    );

    const result = await db.all('SELECT * FROM transactions WHERE id = ?', transactionId);
    expect(result[0]).toMatchObject({
      id: transactionId,
      accountId: accountId,
      amount: 100.00
    });
  });

  test('should add a new budget', async () => {
    const budgetId = 'test-budget-1';
    const budgetName = 'Test Budget';
    
    await db.run(
      'INSERT INTO budgets (id, name, isRecurring) VALUES (?, ?, ?)',
      budgetId,
      budgetName,
      false
    );

    const result = await db.all('SELECT * FROM budgets WHERE id = ?', budgetId);
    expect(result[0]).toMatchObject({
      id: budgetId,
      name: budgetName,
      isRecurring: false
    });
  });
}); 