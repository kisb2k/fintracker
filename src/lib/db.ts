
'use server';
import { open, type Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database | null = null;

const DB_FILE_PATH = path.join(process.cwd(), 'db', 'fintrack.db');
const DB_DIR_PATH = path.join(process.cwd(), 'db');

async function addColumnIfNotExists(dbInstance: Database, tableName: string, columnName: string, columnDefinition: string): Promise<void> {
  const tableInfo = await dbInstance.all(`PRAGMA table_info(${tableName})`);
  if (!tableInfo.some(col => col.name === columnName)) {
    try {
      await dbInstance.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
      console.log(`Added column ${columnName} to ${tableName} table.`);
    } catch (error) {
      console.error(`Failed to add column ${columnName} to ${tableName}:`, error);
      // Depending on strictness, you might want to re-throw or handle more gracefully
    }
  }
}

async function initializeDatabaseSchema(dbInstance: Database): Promise<void> {
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bankName TEXT,
      balance REAL DEFAULT 0,
      type TEXT CHECK(type IN ('checking', 'savings', 'credit card', 'cash', 'crypto', 'other', 'investment', 'loan')) DEFAULT 'checking',
      lastFour TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      date TEXT NOT NULL, -- ISO 8601 string
      description TEXT NOT NULL,
      amount REAL NOT NULL, -- positive for income, negative for expense
      category TEXT,
      status TEXT CHECK(status IN ('pending', 'posted')) DEFAULT 'posted'
      -- loadTimestamp and sourceFileName will be added by addColumnIfNotExists if missing
    );
  `);

  // Add columns that might be missing from an older schema
  await addColumnIfNotExists(dbInstance, 'transactions', 'loadTimestamp', 'TEXT');
  await addColumnIfNotExists(dbInstance, 'transactions', 'sourceFileName', 'TEXT');

  console.log('Database schema initialized/updated.');
}

export async function getDb(): Promise<Database> {
  if (!db) {
    // Ensure the db directory exists
    if (!fs.existsSync(DB_DIR_PATH)) {
      fs.mkdirSync(DB_DIR_PATH, { recursive: true });
    }

    const newDbInstance = await open({
      filename: DB_FILE_PATH,
      driver: sqlite3.Database,
    });
    await initializeDatabaseSchema(newDbInstance);
    db = newDbInstance;
    console.log('Database connection established and schema checked/updated.');
  }
  return db;
}
