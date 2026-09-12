import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from './schema';

const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'greendal.db');
fs.mkdirSync(path.dirname(file), { recursive: true });

const globalForDb = globalThis as unknown as { __greendalDb?: Database.Database };
const sqlite = globalForDb.__greendalDb ?? new Database(file);
if (process.env.NODE_ENV !== 'production') globalForDb.__greendalDb = sqlite;

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite };
