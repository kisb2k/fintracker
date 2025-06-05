
'use server';

import type { Account, Transaction, AccountFormData } from '@/lib/types';
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

export async function addAccount(accountData: AccountFormData): Promise<{ account: Account | null, error?: string }> {
  const db = await getDb();
  const id = crypto.randomUUID();
  try {
    await db.run(
      'INSERT INTO accounts (id, name, bankName, balance, type, lastFour) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      accountData.name,
      accountData.bankName,
      0, // Initial balance is 0
      accountData.type,
      accountData.lastFour || null
    );
    const newAccount = await db.get<Account>('SELECT * FROM accounts WHERE id = ?', id);
    return { account: newAccount || null };
  } catch (error: any) {
    console.error('Failed to add account:', error);
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || error.message?.includes('UNIQUE constraint failed: accounts.id')) {
        console.warn(`Account with id ${id} already exists. Fetching existing.`);
        const existingAccount = await db.get<Account>('SELECT * FROM accounts WHERE id = ?', id);
        return { account: existingAccount || null, error: `Account with ID ${id} already exists.` };
    }
    // Check for other unique constraints, e.g., if you add one for account name
    if (error.message?.includes('UNIQUE constraint failed: accounts.name')) {
         return { account: null, error: `An account with the name "${accountData.name}" already exists.` };
    }
    return { account: null, error: error.message || 'Failed to add account.' };
  }
}

export async function updateAccountDetails(accountId: string, data: AccountFormData): Promise<{ success: boolean; error?: string; account?: Account | null }> {
  const db = await getDb();
  try {
    // Check if an account with the new name already exists (if name is being changed and is not the current account's name)
    const currentAccount = await db.get<Account>('SELECT name FROM accounts WHERE id = ?', accountId);
    if (data.name !== currentAccount?.name) {
        const existingAccountWithName = await db.get<Account>('SELECT id FROM accounts WHERE name = ? AND id != ?', data.name, accountId);
        if (existingAccountWithName) {
            return { success: false, error: `An account with the name "${data.name}" already exists.` };
        }
    }

    await db.run(
      'UPDATE accounts SET name = ?, bankName = ?, type = ?, lastFour = ? WHERE id = ?',
      data.name,
      data.bankName,
      data.type,
      data.lastFour || null,
      accountId
    );
    const updatedAccount = await db.get<Account>('SELECT * FROM accounts WHERE id = ?', accountId);
    return { success: true, account: updatedAccount };
  } catch (error: any) {
    console.error(`Failed to update account ${accountId}:`, error);
     if (error.message?.includes('UNIQUE constraint failed: accounts.name')) {
         return { success: false, error: `An account with the name "${data.name}" already exists.` };
    }
    return { success: false, error: error.message || 'Failed to update account.' };
  }
}

export async function deleteAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  try {
    // Check if the account has any transactions
    const transactionCount = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions WHERE accountId = ?',
      accountId
    );

    if (transactionCount && transactionCount.count > 0) {
      return { 
        success: false, 
        error: `Cannot delete account. It has ${transactionCount.count} associated transaction(s). Please delete or reassign them first.` 
      };
    }

    const result = await db.run('DELETE FROM accounts WHERE id = ?', accountId);
    if (result.changes && result.changes > 0) {
      return { success: true };
    }
    return { success: false, error: 'Account not found or no changes made.' };
  } catch (error: any) {
    console.error(`Failed to delete account ${accountId}:`, error);
    return { success: false, error: error.message || 'Failed to delete account.' };
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
      transactionData.date, 
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

export async function updateMultipleTransactionFields(
  transactionIds: string[],
  updates: {
    category?: string;
    date?: string;
    description?: string;
    amount?: number;
  }
): Promise<{ success: boolean; count?: number; error?: string }> {
  if (transactionIds.length === 0) {
    return { success: true, count: 0, error: "No transaction IDs provided." };
  }
  if (Object.keys(updates).length === 0) {
    return { success: true, count: 0, error: "No update fields provided." };
  }

  const db = await getDb();
  let updatedCount = 0;

  try {
    await db.exec('BEGIN TRANSACTION');

    const affectedAccountIds = new Set<string>();

    for (const id of transactionIds) {
      const currentTransaction = await db.get<Transaction>('SELECT * FROM transactions WHERE id = ?', id);
      if (!currentTransaction) {
        console.warn(`Transaction with id ${id} not found for update.`);
        continue;
      }
      affectedAccountIds.add(currentTransaction.accountId); // Original account

      const newValues = { ...currentTransaction, ...updates };
      if (updates.amount !== undefined && currentTransaction.accountId !== newValues.accountId) {
        // If amount changes AND accountId changes, also track the new accountId for recalc
         if (newValues.accountId) affectedAccountIds.add(newValues.accountId);
      }


      const setClauses: string[] = [];
      const params: (string | number | null)[] = [];

      if (updates.category !== undefined) {
        setClauses.push('category = ?');
        params.push(updates.category);
      }
      if (updates.date !== undefined) {
        setClauses.push('date = ?');
        params.push(updates.date);
      }
      if (updates.description !== undefined) {
        setClauses.push('description = ?');
        params.push(updates.description);
      }
      if (updates.amount !== undefined) {
        setClauses.push('amount = ?');
        params.push(updates.amount);
      }

      if (setClauses.length > 0) {
        params.push(id);
        const sql = `UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ?`;
        const result = await db.run(sql, ...params);
        if (result.changes) {
          updatedCount += result.changes;
        }
      }
    }

    await db.exec('COMMIT');

    // Recalculate balances for all affected accounts
    for (const accountId of affectedAccountIds) {
      await recalculateAndUpdateAccountBalance(accountId);
    }

    return { success: true, count: updatedCount };
  } catch (error: any) {
    await db.exec('ROLLBACK');
    console.error('Failed to bulk update transaction fields:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}
