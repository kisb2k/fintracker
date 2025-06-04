
'use server';

import type { Account, Transaction } from '@/lib/types';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

// --- Account Actions ---

export async function getAccounts(): Promise<Account[]> {
  const db = await getDb();
  try {
    const accounts = await db.all<Account[]>('SELECT * FROM accounts ORDER BY name ASC');
    return accounts || [];
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    return [];
  }
}

export async function addAccount(accountData: Omit<Account, 'id' | 'balance'> & { balance?: number }): Promise<Account | null> {
  const db = await getDb();
  const id = accountData.id || crypto.randomUUID();
  const balance = accountData.balance ?? 0;
  try {
    await db.run(
      'INSERT INTO accounts (id, name, bankName, balance, type, lastFour) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      accountData.name,
      accountData.bankName,
      balance,
      accountData.type,
      accountData.lastFour
    );
    const newAccount = await db.get<Account>('SELECT * FROM accounts WHERE id = ?', id);
    return newAccount || null;
  } catch (error) {
    console.error('Failed to add account:', error);
    if ((error as any).code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        // If it's a primary key constraint, try to fetch the existing account
        console.warn(`Account with id ${id} already exists. Fetching existing.`);
        const existingAccount = await db.get<Account>('SELECT * FROM accounts WHERE id = ?', id);
        return existingAccount || null;
    }
    return null;
  }
}

export async function getAccountById(accountId: string): Promise<Account | null> {
  const db = await getDb();
  try {
    const account = await db.get<Account>('SELECT * FROM accounts WHERE id = ?', accountId);
    return account || null;
  } catch (error) {
    console.error(`Failed to fetch account ${accountId}:`, error);
    return null;
  }
}

// --- Transaction Actions ---

export async function getTransactions(): Promise<Transaction[]> {
  const db = await getDb();
  try {
    const transactions = await db.all<Transaction[]>('SELECT * FROM transactions ORDER BY date DESC');
    return transactions || [];
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return [];
  }
}

export async function addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<Transaction | null> {
  const db = await getDb();
  const id = crypto.randomUUID();
  try {
    await db.run(
      'INSERT INTO transactions (id, accountId, date, description, amount, category, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      transactionData.accountId,
      transactionData.date,
      transactionData.description,
      transactionData.amount,
      transactionData.category,
      transactionData.status || 'posted'
    );
    const newTransaction = await db.get<Transaction>('SELECT * FROM transactions WHERE id = ?', id);
    return newTransaction || null;
  } catch (error) {
    console.error('Failed to add transaction:', error);
    return null;
  }
}

export async function addTransactionsBatch(transactionsData: Omit<Transaction, 'id'>[]): Promise<{ successCount: number; errors: any[] }> {
  const db = await getDb();
  let successCount = 0;
  const errors: any[] = [];

  for (const txData of transactionsData) {
    const id = crypto.randomUUID();
    try {
      await db.run(
        'INSERT INTO transactions (id, accountId, date, description, amount, category, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id,
        txData.accountId,
        txData.date,
        txData.description,
        txData.amount,
        txData.category,
        txData.status || 'posted'
      );
      successCount++;
    } catch (error) {
      console.error('Failed to add transaction in batch:', error, 'Data:', txData);
      errors.push({ error, transactionData: txData });
    }
  }
  return { successCount, errors };
}

export async function getTransactionsByAccountId(accountId: string): Promise<Transaction[]> {
  const db = await getDb();
  try {
    const transactions = await db.all<Transaction[]>(
      'SELECT * FROM transactions WHERE accountId = ? ORDER BY date DESC',
      accountId
    );
    return transactions || [];
  } catch (error) {
    console.error(`Failed to fetch transactions for account ${accountId}:`, error);
    return [];
  }
}

export async function updateAccountBalance(accountId: string, newBalance: number): Promise<void> {
  const db = await getDb();
  try {
    await db.run('UPDATE accounts SET balance = ? WHERE id = ?', newBalance, accountId);
  } catch (error) {
    console.error(`Failed to update balance for account ${accountId}:`, error);
  }
}

// Recalculate and update balance for a specific account
export async function recalculateAndUpdateAccountBalance(accountId: string): Promise<void> {
  const db = await getDb();
  try {
    const result = await db.get<{ total: number }>(
      'SELECT SUM(amount) as total FROM transactions WHERE accountId = ?',
      accountId
    );
    const newBalance = result?.total || 0;
    await updateAccountBalance(accountId, newBalance);
    console.log(`Balance for account ${accountId} updated to ${newBalance}`);
  } catch (error) {
    console.error(`Error recalculating balance for account ${accountId}:`, error);
  }
}

// Recalculate balances for all accounts
export async function recalculateAllAccountBalances(): Promise<void> {
  const db = await getDb();
  try {
    const accounts = await db.all<{ id: string }[]>('SELECT id FROM accounts');
    if (accounts) {
      for (const acc of accounts) {
        await recalculateAndUpdateAccountBalance(acc.id);
      }
      console.log('All account balances recalculated and updated.');
    }
  } catch (error) {
    console.error('Error recalculating all account balances:', error);
  }
}
