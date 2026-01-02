import bcrypt from "bcryptjs";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

let db;

export function getDb() {
  if (!db) throw new Error("DB not initialized");
  return db;
}

async function ensureColumn(table, column, ddl) {
  const cols = await db.all(`PRAGMA table_info(${table})`);
  const exists = cols.some((c) => c.name === column);
  if (!exists) await db.exec(ddl);
}

async function createTables() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      guild_rank TEXT NOT NULL DEFAULT 'member'
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT 'General',
      author TEXT NOT NULL DEFAULT 'You',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // for older DBs that existed before guild_rank
  await ensureColumn(
    "users",
    "guild_rank",
    "ALTER TABLE users ADD COLUMN guild_rank TEXT NOT NULL DEFAULT 'member'"
  );
}

async function seedAdmin() {
  const existing = await db.get(`SELECT id FROM users WHERE username = ?`, "admin");
  if (existing) return;

  const adminPass = process.env.ADMIN_PASSWORD || "admin123";
  const hash = await bcrypt.hash(adminPass, 12);

  await db.run(
    `INSERT INTO users (username, password_hash, role, guild_rank)
     VALUES (?, ?, ?, ?)`,
    "admin",
    hash,
    "admin",
    "admin"
  );

  console.log("Seeded admin user: username=admin");
  console.log(
    process.env.ADMIN_PASSWORD
      ? "Admin password set from ADMIN_PASSWORD env var."
      : "Admin password is default 'admin123' (change this!)."
  );
}

async function setFounder(username = "Nex") {
  // only updates if Nex exists — safe.
  await db.run(
    "UPDATE users SET guild_rank = ? WHERE username = ?",
    "founder",
    username
  );
}

export async function initDb() {
  db = await open({
    filename: "./guild.db",
    driver: sqlite3.Database,
  });

  await createTables();
  await seedAdmin();
  await setFounder(process.env.FOUNDER_USERNAME || "Nex");
}
