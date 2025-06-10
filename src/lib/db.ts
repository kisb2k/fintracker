'use server';
import { initializeDuckDB, getDuckDB } from './duckdb-init';

interface TableColumn {
  column_name: string;
  column_type: string;
}

async function addColumnIfNotExists(dbInstance: any, tableName: string, columnName: string, columnDefinition: string): Promise<void> {
  try {
    const result = await dbInstance.all(`DESCRIBE ${tableName}`);
    const tableInfo = result as unknown as TableColumn[];
    if (!tableInfo.some((col) => col.column_name === columnName)) {
      await dbInstance.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
      console.log(`Added column ${columnName} to ${tableName} table.`);
    }
  } catch (error) {
    console.error(`Failed to add column ${columnName} to ${tableName}:`, error);
  }
}

async function initializeDatabaseSchema(dbInstance: any): Promise<void> {
  await dbInstance.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id VARCHAR PRIMARY KEY,
      name VARCHAR NOT NULL UNIQUE,
      bankName VARCHAR,
      balance DOUBLE DEFAULT 0,
      type VARCHAR CHECK(type IN ('checking', 'savings', 'credit card', 'cash', 'crypto', 'other', 'investment', 'loan')) DEFAULT 'checking',
      lastFour VARCHAR,
      isDefault BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR PRIMARY KEY,
      accountId VARCHAR NOT NULL,
      date VARCHAR NOT NULL,
      description VARCHAR NOT NULL,
      amount DOUBLE NOT NULL,
      category VARCHAR,
      status VARCHAR CHECK(status IN ('pending', 'posted')) DEFAULT 'posted',
      loadTimestamp VARCHAR,
      sourceFileName VARCHAR,
      FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id VARCHAR PRIMARY KEY,
      name VARCHAR NOT NULL UNIQUE,
      isRecurring BOOLEAN DEFAULT FALSE,
      recurrenceFrequency VARCHAR,
      originalStartDate VARCHAR,
      formDefinedEndDate VARCHAR,
      isDefault BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS budget_category_limits (
      id VARCHAR PRIMARY KEY,
      budget_id VARCHAR NOT NULL,
      category_name VARCHAR NOT NULL,
      limit_amount DOUBLE NOT NULL,
      FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
      UNIQUE (budget_id, category_name)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR PRIMARY KEY,
      name VARCHAR NOT NULL UNIQUE,
      color VARCHAR DEFAULT '#8884d8',
      isDefault BOOLEAN DEFAULT FALSE
    );
  `);

  await addColumnIfNotExists(dbInstance, 'transactions', 'loadTimestamp', 'VARCHAR');
  await addColumnIfNotExists(dbInstance, 'transactions', 'sourceFileName', 'VARCHAR');
  await addColumnIfNotExists(dbInstance, 'budgets', 'formDefinedEndDate', 'VARCHAR');
  await addColumnIfNotExists(dbInstance, 'budgets', 'isDefault', 'BOOLEAN DEFAULT FALSE');
  await addColumnIfNotExists(dbInstance, 'accounts', 'isDefault', 'BOOLEAN DEFAULT FALSE');

  console.log('Database schema initialized/updated.');
}

export async function getDb(): Promise<any> {
  if (typeof window !== 'undefined') {
    throw new Error('Database operations are only available on the server side');
  }

  try {
    const db = await initializeDuckDB();
    await initializeDatabaseSchema(db);
    return db;
  } catch (error) {
    console.error('Failed to get database:', error);
    throw error;
  }
}

