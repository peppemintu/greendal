/**
 * Applies migrations, then creates (or promotes) the one admin account from
 * ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME. Safe to re-run: re-running with
 * a changed ADMIN_PASSWORD resets that password.
 *
 *   docker compose exec app node scripts/create-admin.mjs
 *
 * The password hash format ("scrypt$N$r$p$salt$hash") is duplicated from
 * hashPassword() in src/lib/auth.ts rather than imported from it — this
 * script runs via plain `node`, not through Next's TypeScript pipeline. That
 * duplication is safe here in a way the old seed.mjs table-creation SQL
 * wasn't: the format is self-describing (N/r/p travel inside the string), so
 * verifyPassword() reads whatever parameters a hash actually carries rather
 * than assuming fixed ones. If you change the cost parameters in auth.ts,
 * this script producing the old ones for new hashes is harmless — just
 * update both if you want new admin passwords to use the new cost too.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? '';
const displayName = (process.env.ADMIN_NAME ?? 'admin').trim() || 'admin';

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('ADMIN_EMAIL is missing or not a valid email address.');
  process.exit(1);
}
if (password.length < 10) {
  console.error('ADMIN_PASSWORD is missing or shorter than 10 characters.');
  process.exit(1);
}

function hashPassword(pw) {
  const N = 16384, r = 8, p = 1, keyLength = 64;
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, keyLength, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'greendal.db');
fs.mkdirSync(path.dirname(file), { recursive: true });
const sqlite = new Database(file);
sqlite.pragma('journal_mode = WAL');

migrate(drizzle(sqlite), { migrationsFolder: path.join(import.meta.dirname, '..', 'drizzle') });

const now = Math.floor(Date.now() / 1000);
const passwordHash = hashPassword(password);
const existing = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email);

if (existing) {
  sqlite
    .prepare(
      `UPDATE users SET password_hash = ?, display_name = ?, role = 'admin',
       email_verified_at = COALESCE(email_verified_at, ?), blocked_at = NULL, archived_at = NULL,
       updated_at = ? WHERE id = ?`,
    )
    .run(passwordHash, displayName, now, now, existing.id);
  console.log(`Updated admin: ${email} (id ${existing.id}).`);
} else {
  const result = sqlite
    .prepare(
      `INSERT INTO users (email, display_name, password_hash, role, email_verified_at,
       notify_on_reply, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', ?, 1, ?, ?)`,
    )
    .run(email, displayName, passwordHash, now, now, now);
  console.log(`Created admin: ${email} (id ${result.lastInsertRowid}).`);
}
