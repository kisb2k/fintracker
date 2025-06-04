
'use server';
import { open, type Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database | null = null;

const DB_FILE_PATH = path.join(process.cwd(), 'db', 'fintrack.db');
const DB_DIR_PATH = path.join(process.cwd(), 'db');

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
      status TEXT CHECK(status IN ('pending', 'posted')) DEFAULT 'posted',
      FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE
    );
  `);
  console.log('Database schema initialized or already exists.');
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
    console.log('Database connection established and schema checked.');
  }
  return db;
}
