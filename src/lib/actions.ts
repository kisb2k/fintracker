
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

export async function addAccount(accountData: Omit<Account, 'id' | 'balance'> & { id?: string, balance?: number }): Promise<Account | null> {
  const db = await getDb();
  const id = accountData.id || crypto.randomUUID();
  const balance = accountData.balance ?? 0; // Default balance to 0 if not provided
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
    if ((error as any).code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || (error as any).message?.includes('UNIQUE constraint failed: accounts.id')) {
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
    // Ensure date ordering is correct (ISO strings sort lexicographically)
    const transactions = await db.all<Transaction[]>('SELECT * FROM transactions ORDER BY date DESC, id DESC');
    return transactions || [];
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return [];
  }
}

export async function addTransaction(transactionData: Omit<Transaction, 'id' | 'loadTimestamp' | 'sourceFileName'>): Promise<Transaction | null> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const loadTimestamp = new Date().toISOString();
  const sourceFileName = "Manual Entry";
  try {
    await db.run(
      'INSERT INTO transactions (id, accountId, date, description, amount, category, status, loadTimestamp, sourceFileName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      transactionData.accountId,
      transactionData.date, // Should be ISO string
      transactionData.description,
      transactionData.amount,
      transactionData.category,
      transactionData.status || 'posted',
      loadTimestamp,
      sourceFileName
    );
    const newTransaction = await db.get<Transaction>('SELECT * FROM transactions WHERE id = ?', id);
    if (newTransaction) {
      await recalculateAndUpdateAccountBalance(newTransaction.accountId);
    }
    return newTransaction || null;
  } catch (error) {
    console.error('Failed to add transaction:', error);
    return null;
  }
}

export async function addTransactionsBatch(
  transactionsData: Omit<Transaction, 'id' | 'loadTimestamp' | 'sourceFileName'>[], 
  sourceFileName: string
): Promise<{ successCount: number; errors: any[] }> {
  const db = await getDb();
  let successCount = 0;
  const errors: any[] = [];
  const affectedAccountIds = new Set<string>();
  const loadTimestamp = new Date().toISOString();

  try {
    await db.exec('BEGIN TRANSACTION');
    const stmt = await db.prepare(
      'INSERT INTO transactions (id, accountId, date, description, amount, category, status, loadTimestamp, sourceFileName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    for (const txData of transactionsData) {
      const id = crypto.randomUUID();
      try {
        await stmt.run(
          id,
          txData.accountId,
          txData.date,
          txData.description,
          txData.amount,
          txData.category,
          txData.status || 'posted',
          loadTimestamp,
          sourceFileName
        );
        affectedAccountIds.add(txData.accountId);
        successCount++;
      } catch (error) {
        console.error('Failed to add transaction in batch item:', error, 'Data:', txData);
        errors.push({ error, transactionData: txData });
      }
    }
    await stmt.finalize();
    await db.exec('COMMIT');
  } catch (batchError) {
    console.error('Batch transaction insert failed, rolling back:', batchError);
    await db.exec('ROLLBACK');
    errors.push({ error: `Batch operation failed: ${(batchError as Error).message}` });
    successCount = 0; 
  }
  
  for (const accountId of affectedAccountIds) {
    await recalculateAndUpdateAccountBalance(accountId);
  }
  
  return { successCount, errors };
}

export async function getTransactionsByAccountId(accountId: string): Promise<Transaction[]> {
  const db = await getDb();
  try {
    const transactions = await db.all<Transaction[]>(
      'SELECT * FROM transactions WHERE accountId = ? ORDER BY date DESC, id DESC',
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

export async function recalculateAndUpdateAccountBalance(accountId: string): Promise<void> {
  const db = await getDb();
  try {
    const result = await db.get<{ total: number }>(
      'SELECT SUM(amount) as total FROM transactions WHERE accountId = ?',
      accountId
    );
    const newBalance = result?.total || 0;
    await updateAccountBalance(accountId, newBalance);
    console.log(`Balance for account ${accountId} updated to ${newBalance.toFixed(2)}`);
  } catch (error) {
    console.error(`Error recalculating balance for account ${accountId}:`, error);
  }
}

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


export async function removeDuplicateTransactions(): Promise<{ success: boolean; duplicatesRemoved?: number; error?: string }> {
  const db = await getDb();
  try {
    const duplicateGroupIds = await db.all<{ id: string }>(`
      SELECT T1.id
      FROM transactions T1
      INNER JOIN (
          SELECT accountId, date(date) as transaction_date, amount, description, COUNT(*) as count, MIN(id) as min_id
          FROM transactions
          GROUP BY accountId, date(transaction_date), amount, description
          HAVING COUNT(*) > 1
      ) T2 ON T1.accountId = T2.accountId 
            AND date(T1.date) = T2.transaction_date 
            AND T1.amount = T2.amount 
            AND T1.description = T2.description;
    `);

    if (duplicateGroupIds.length === 0) {
      return { success: true, duplicatesRemoved: 0 };
    }

    const duplicateIdList = duplicateGroupIds.map(row => `'${row.id}'`).join(',');
    const queryForIdsToDelete = `
        SELECT id 
        FROM transactions
        WHERE id IN (${duplicateIdList})
        AND id NOT IN (
            SELECT MIN(id)
            FROM transactions
            GROUP BY accountId, date(date), amount, description
        )
    `;
    const rowsToDelete = await db.all<{ id: string }>(queryForIdsToDelete);

    if (rowsToDelete.length === 0) {
      return { success: true, duplicatesRemoved: 0 };
    }
    
    const idsToDeleteList = rowsToDelete.map(r => `'${r.id}'`).join(',');
    const deleteResult = await db.run(`DELETE FROM transactions WHERE id IN (${idsToDeleteList})`);
    
    const numRemoved = deleteResult.changes || 0;
    console.log(`Removed ${numRemoved} duplicate transactions.`);
    
    await recalculateAllAccountBalances();

    return { success: true, duplicatesRemoved: numRemoved };

  } catch (error: any) {
    console.error('Failed to remove duplicate transactions:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function deleteTransaction(transactionId: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  try {
    const transaction = await db.get<Transaction>('SELECT accountId FROM transactions WHERE id = ?', transactionId);
    if (!transaction) {
      return { success: false, error: 'Transaction not found' };
    }
    
    const result = await db.run('DELETE FROM transactions WHERE id = ?', transactionId);
    if (result.changes && result.changes > 0) {
      await recalculateAndUpdateAccountBalance(transaction.accountId);
      return { success: true };
    }
    return { success: false, error: 'Failed to delete transaction or transaction not found' };
  } catch (error: any) {
    console.error('Failed to delete transaction:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function deleteTransactionsBatch(transactionIds: string[]): Promise<{ success: boolean; count?: number; error?: string }> {
  if (transactionIds.length === 0) {
    return { success: true, count: 0 };
  }
  const db = await getDb();
  try {
    // Get affected account IDs before deleting
    const placeholders = transactionIds.map(() => '?').join(',');
    const transactions = await db.all<Transaction>(`SELECT DISTINCT accountId FROM transactions WHERE id IN (${placeholders})`, ...transactionIds);
    const affectedAccountIds = new Set(transactions.map(t => t.accountId));

    const result = await db.run(`DELETE FROM transactions WHERE id IN (${placeholders})`, ...transactionIds);
    
    for (const accountId of affectedAccountIds) {
      await recalculateAndUpdateAccountBalance(accountId);
    }
    
    return { success: true, count: result.changes || 0 };
  } catch (error: any) {
    console.error('Failed to delete transactions batch:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function updateTransactionCategoryBatch(transactionIds: string[], newCategory: string): Promise<{ success: boolean; count?: number; error?: string }> {
  if (transactionIds.length === 0) {
    return { success: true, count: 0 };
  }
  const db = await getDb();
  try {
    const placeholders = transactionIds.map(() => '?').join(',');
    const result = await db.run(`UPDATE transactions SET category = ? WHERE id IN (${placeholders})`, newCategory, ...transactionIds);
    return { success: true, count: result.changes || 0 };
  } catch (error: any) {
    console.error('Failed to update transaction categories batch:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}
