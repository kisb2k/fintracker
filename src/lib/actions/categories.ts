'use server';

import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

export async function getCategories() {
  const db = await getDb();
  const categories = await db.all('SELECT * FROM categories ORDER BY name');
  return categories;
}

export async function addCategory(name: string, color: string) {
  const db = await getDb();
  const id = uuidv4();
  await db.run(
    'INSERT INTO categories (id, name, color) VALUES (?, ?, ?)',
    [id, name, color]
  );
  return { id, name, color, isDefault: false };
}

export async function updateCategory(id: string, name: string, color: string) {
  const db = await getDb();
  await db.run(
    'UPDATE categories SET name = ?, color = ? WHERE id = ? AND isDefault = FALSE',
    [name, color, id]
  );
  return { id, name, color, isDefault: false };
}

export async function deleteCategory(id: string) {
  const db = await getDb();
  await db.run('DELETE FROM categories WHERE id = ? AND isDefault = FALSE', [id]);
  return { id };
} 