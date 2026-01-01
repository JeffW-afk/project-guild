import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

const app = express();
app.use(express.json());

// Session cookie (dev-friendly)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // set true only when using HTTPS in production
    },
  })
);

let db;

async function initDb() {
  db = await open({
    filename: "./guild.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT 'General',
      author TEXT NOT NULL DEFAULT 'You',
      created_at TEXT NOT NULL
    );
  `);

  // Seed admin if missing
  const existingAdmin = await db.get(
    `SELECT id FROM users WHERE username = ? LIMIT 1`,
    "admin"
  );

  if (!existingAdmin) {
    const adminPass = process.env.ADMIN_PASSWORD || "admin123";
    const hash = await bcrypt.hash(adminPass, 12);

    await db.run(
      `INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
      "admin",
      hash,
      "admin"
    );

    console.log("Seeded admin user: username=admin");
    console.log(
      process.env.ADMIN_PASSWORD
        ? "Admin password set from ADMIN_PASSWORD env var."
        : "Admin password is default 'admin123' (change this!)."
    );
  }
}

// --- Auth helpers ---
function requireAdmin(req, res, next) {
  if (req.session?.user?.role !== "admin") {
    return res.status(401).json({ error: "Not authorized" });
  }
  next();
}

function requireLogin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
}

// --- Auth routes ---
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }

  const user = await db.get(
    `SELECT id, username, password_hash, role FROM users WHERE username = ?`,
    String(username)
  );

  if (!user) return res.status(401).json({ error: "Invalid login" });

  const ok = await bcrypt.compare(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid login" });

  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.json({ id: user.id, username: user.username, role: user.role });
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.session.user ?? null });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// Update own profile: username and/or password
app.patch("/api/auth/profile", requireLogin, async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body ?? {};

    // Require current password for any sensitive change
    if (!currentPassword) {
      return res.status(400).json({ error: "currentPassword is required" });
    }

    const userId = req.session.user.id;

    const user = await db.get(
      "SELECT id, username, password_hash, role FROM users WHERE id = ?",
      userId
    );

    if (!user) return res.status(401).json({ error: "Not logged in" });

    const ok = await bcrypt.compare(String(currentPassword), user.password_hash);
    if (!ok) return res.status(401).json({ error: "Wrong password" });

    // Change username (optional)
    if (typeof username === "string") {
      const newName = username.trim();

      if (newName.length < 3) {
        return res.status(400).json({ error: "Username must be at least 3 characters" });
      }

      if (newName !== user.username) {
        const taken = await db.get(
          "SELECT id FROM users WHERE username = ?",
          newName
        );
        if (taken) return res.status(409).json({ error: "Username already taken" });

        await db.run("UPDATE users SET username = ? WHERE id = ?", newName, userId);
        req.session.user.username = newName; // update session instantly
      }
    }

    // Change password (optional)
    if (typeof newPassword === "string" && newPassword.length > 0) {
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      const hash = await bcrypt.hash(String(newPassword), 12);
      await db.run("UPDATE users SET password_hash = ? WHERE id = ?", hash, userId);
    }

    res.json({
      id: req.session.user.id,
      username: req.session.user.username,
      role: req.session.user.role,
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// --- Announcements routes ---
app.get("/api/announcements", async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT id, title, body, tag, author, created_at
       FROM announcements
       ORDER BY id DESC`
    );

    res.json(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        tag: r.tag,
        author: r.author,
        date: r.created_at,
      }))
    );
  } catch {
    res.status(500).json({ error: "Failed to load announcements" });
  }
});

// Only admin can post announcements now:
app.post("/api/announcements", requireAdmin, async (req, res) => {
  try {
    const { title, body, tag } = req.body ?? {};
    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }

    const author = req.session.user.username;
    const createdAt = new Date().toLocaleDateString();

    const result = await db.run(
      `INSERT INTO announcements (title, body, tag, author, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      String(title),
      String(body),
      tag ? String(tag) : "General",
      author,
      createdAt
    );

    const created = await db.get(
      `SELECT id, title, body, tag, author, created_at
       FROM announcements
       WHERE id = ?`,
      result.lastID
    );

    res.status(201).json({
      id: created.id,
      title: created.title,
      body: created.body,
      tag: created.tag,
      author: created.author,
      date: created.created_at,
    });
  } catch {
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

// Delete announcement (admin only)
app.delete("/api/announcements/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const result = await db.run("DELETE FROM announcements WHERE id = ?", id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

const PORT = process.env.PORT || 3001;

(async () => {
  await initDb();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
})();
