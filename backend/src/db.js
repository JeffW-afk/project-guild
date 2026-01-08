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

    -- Parties ("squad" system)
    CREATE TABLE IF NOT EXISTS parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS party_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT '{}',
      UNIQUE(party_id, name),
      FOREIGN KEY(party_id) REFERENCES parties(id)
    );

    CREATE TABLE IF NOT EXISTS party_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(party_id) REFERENCES parties(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(role_id) REFERENCES party_roles(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_party_members_user ON party_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_party_members_party ON party_members(party_id);

    -- Member requests to create a party (admin approves)
    CREATE TABLE IF NOT EXISTS party_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      party_name TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_by INTEGER,
      reviewed_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(reviewed_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_party_requests_status ON party_requests(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_party_requests_pending_user
      ON party_requests(user_id) WHERE status = 'pending';

    
      -- Requests to become a higher guild rank (admin approval)
    CREATE TABLE IF NOT EXISTS guild_rank_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      requested_rank TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_by INTEGER,
      reviewed_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(reviewed_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_guild_rank_requests_status ON guild_rank_requests(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_guild_rank_requests_pending_user
      ON guild_rank_requests(user_id) WHERE status = 'pending';

    -- Simple mailbox (system + user messages)
    CREATE TABLE IF NOT EXISTS mail_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      recipient_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(sender_id) REFERENCES users(id),
      FOREIGN KEY(recipient_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_mail_recipient ON mail_messages(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_mail_sender ON mail_messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_mail_recipient_unread ON mail_messages(recipient_id, is_read);
        
    -- Member requests to join a party (leader approves)
    CREATE TABLE IF NOT EXISTS party_join_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      party_id INTEGER NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_by INTEGER,
      reviewed_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(party_id) REFERENCES parties(id),
      FOREIGN KEY(reviewed_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_party_join_requests_status ON party_join_requests(status);
    CREATE INDEX IF NOT EXISTS idx_party_join_requests_party ON party_join_requests(party_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_party_join_requests_pending_user
      ON party_join_requests(user_id) WHERE status = 'pending';
  `);

  // for older DBs that existed before guild_rank
  await ensureColumn(
    "users",
    "guild_rank",
    "ALTER TABLE users ADD COLUMN guild_rank TEXT NOT NULL DEFAULT 'member'"
  );
  // Parties: allow "removal" without deleting rows (archive)
  await ensureColumn(
    "parties",
    "is_active",
    "ALTER TABLE parties ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"
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
