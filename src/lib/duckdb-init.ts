import path from 'path';
import fs from 'fs';

let db: any = null;

const DB_FILE_PATH = path.join(process.cwd(), 'db', 'fintrack.duckdb');
const DB_DIR_PATH = path.join(process.cwd(), 'db');

export async function initializeDuckDB() {
  if (!db) {
    if (!fs.existsSync(DB_DIR_PATH)) {
      fs.mkdirSync(DB_DIR_PATH, { recursive: true });
    }

    try {
      const { Database } = await import('duckdb');
      db = new Database(DB_FILE_PATH);
      console.log('DuckDB connection established.');
      return db;
    } catch (error) {
      console.error('Failed to initialize DuckDB:', error);
      throw error;
    }
  }
  return db;
}

export function getDuckDB() {
  if (!db) {
    throw new Error('DuckDB not initialized. Call initializeDuckDB() first.');
  }
  return db;
} 