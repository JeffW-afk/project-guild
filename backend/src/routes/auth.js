import express from "express";
import bcrypt from "bcryptjs";
import { getDb } from "../db.js";
import { requireLogin } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const db = getDb();
  const { username, password, requested_rank, message } = req.body ?? {};

  const name = String(username ?? "").trim();
  const pass = String(password ?? "");

  if (name.length < 3) return res.status(400).json({ error: "Username must be at least 3 characters" });
  if (pass.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  // Only allow requesting admin at signup (simple + safe).
  // (You can expand later if you want.)
  const wantsAdmin = requested_rank === "admin";

  try {
    const taken = await db.get("SELECT id FROM users WHERE username = ?", name);
    if (taken) return res.status(409).json({ error: "Username already taken" });

    const hash = await bcrypt.hash(pass, 12);

    // Create user as normal member
    const result = await db.run(
      `INSERT INTO users (username, password_hash, role, guild_rank)
       VALUES (?, ?, 'member', 'member')`,
      name,
      hash
    );

    const user = { id: result.lastID, username: name, guild_rank: "member" };

    // Optional admin request
    if (wantsAdmin) {
      await db.run(
        `INSERT INTO guild_rank_requests (user_id, requested_rank, message)
         VALUES (?, ?, ?)`,
        user.id,
        "admin",
        typeof message === "string" ? message.trim() : null
      );

      // Notify guild leaders via mailbox
      const leaders = await db.all(
        "SELECT id, username FROM users WHERE guild_rank IN ('admin','guild_master','founder')"
      );

      const note = typeof message === "string" && message.trim().length
        ? `\n\nMessage from ${name}:\n${message.trim()}`
        : "";

      const subject = `Admin request: ${name}`;
      const body = `${name} requested to become an admin.${note}\n\nReview it in the Rank Requests panel.`;

      for (const l of leaders) {
        await db.run(
          `INSERT INTO mail_messages (sender_id, recipient_id, subject, body)
           VALUES (NULL, ?, ?, ?)`,
          l.id,
          subject,
          body
        );
      }
    }

    // Log them in immediately
    req.session.user = user;

    return res.status(201).json({ user, requested_admin: wantsAdmin });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Failed to register" });
  }
});

router.post("/login", async (req, res) => {
  const db = getDb();
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }

  const user = await db.get(
    `SELECT id, username, password_hash, guild_rank
     FROM users WHERE username = ?`,
    String(username)
  );

  if (!user) return res.status(401).json({ error: "Invalid login" });

  const ok = await bcrypt.compare(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid login" });

  req.session.user = { id: user.id, username: user.username, guild_rank: user.guild_rank };

  res.json(req.session.user);
});

router.get("/me", (req, res) => {
  res.json({ user: req.session.user ?? null });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Forgot password (dev: prints code to console)
router.post("/forgot", async (req, res) => {
  const db = getDb();
  try {
    const { username } = req.body ?? {};
    if (!username || String(username).trim().length < 1) {
      return res.status(400).json({ error: "username is required" });
    }

    const user = await db.get(
      "SELECT id, username FROM users WHERE username = ?",
      String(username).trim()
    );

    // Don't reveal existence
    if (!user) return res.json({ ok: true });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await db.run(
      "INSERT INTO password_resets (user_id, code_hash, expires_at, used) VALUES (?, ?, ?, 0)",
      user.id,
      codeHash,
      expiresAt
    );

    console.log(`[Password reset] user=${user.username} code=${code} (expires in 10 min)`);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to request reset" });
  }
});

router.post("/reset", async (req, res) => {
  const db = getDb();
  try {
    const { username, code, newPassword } = req.body ?? {};

    if (!username || !code || !newPassword) {
      return res.status(400).json({ error: "username, code, newPassword are required" });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const user = await db.get(
      "SELECT id, username FROM users WHERE username = ?",
      String(username).trim()
    );
    if (!user) return res.status(401).json({ error: "Invalid reset" });

    const reset = await db.get(
      `SELECT * FROM password_resets
       WHERE user_id = ? AND used = 0
       ORDER BY id DESC
       LIMIT 1`,
      user.id
    );
    if (!reset) return res.status(401).json({ error: "Invalid reset" });

    if (new Date(reset.expires_at).getTime() < Date.now()) {
      return res.status(401).json({ error: "Reset code expired" });
    }

    const ok = await bcrypt.compare(String(code), reset.code_hash);
    if (!ok) return res.status(401).json({ error: "Invalid reset" });

    const hash = await bcrypt.hash(String(newPassword), 12);
    await db.run("UPDATE users SET password_hash = ? WHERE id = ?", hash, user.id);
    await db.run("UPDATE password_resets SET used = 1 WHERE id = ?", reset.id);

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

router.patch("/profile", requireLogin, async (req, res) => {
  const db = getDb();
  try {
    const { username, currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword) return res.status(400).json({ error: "currentPassword is required" });

    const userId = req.session.user.id;

    const user = await db.get(
      "SELECT id, username, password_hash, guild_rank FROM users WHERE id = ?",
      userId
    );
    if (!user) return res.status(401).json({ error: "Not logged in" });

    const ok = await bcrypt.compare(String(currentPassword), user.password_hash);
    if (!ok) return res.status(401).json({ error: "Wrong password" });

    if (typeof username === "string") {
      const newName = username.trim();
      if (newName.length < 3) return res.status(400).json({ error: "Username must be at least 3 characters" });

      if (newName !== user.username) {
        const taken = await db.get("SELECT id FROM users WHERE username = ?", newName);
        if (taken) return res.status(409).json({ error: "Username already taken" });

        await db.run("UPDATE users SET username = ? WHERE id = ?", newName, userId);
        req.session.user.username = newName;
      }
    }

    if (typeof newPassword === "string" && newPassword.length > 0) {
      if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

      const hash = await bcrypt.hash(String(newPassword), 12);
      await db.run("UPDATE users SET password_hash = ? WHERE id = ?", hash, userId);
    }

    res.json(req.session.user);
  } catch {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
