import express from "express";
import { getDb } from "../db.js";
import { requireLogin } from "../middleware/auth.js";

const router = express.Router();

function normalizeLimit(value, def = 50, max = 200) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

// Unread count
router.get("/unread-count", requireLogin, async (req, res) => {
  const db = getDb();
  const userId = req.session.user.id;

  const row = await db.get(
    "SELECT COUNT(*) AS c FROM mail_messages WHERE recipient_id = ? AND is_read = 0",
    userId
  );

  res.json({ unread: row?.c ?? 0 });
});

// Inbox
router.get("/inbox", requireLogin, async (req, res) => {
  const db = getDb();
  const userId = req.session.user.id;

  const limit = normalizeLimit(req.query.limit, 50);
  const onlyUnread = String(req.query.unread ?? "0") === "1";

  const rows = await db.all(
    `SELECT
      m.id,
      m.subject,
      m.body,
      m.is_read,
      m.created_at,
      s.id AS sender_id,
      s.username AS sender_username
     FROM mail_messages m
     LEFT JOIN users s ON s.id = m.sender_id
     WHERE m.recipient_id = ?
       ${onlyUnread ? "AND m.is_read = 0" : ""}
     ORDER BY m.id DESC
     LIMIT ?`,
    userId,
    limit
  );

  res.json(
    rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      body: r.body,
      is_read: !!r.is_read,
      created_at: r.created_at,
      from: r.sender_id ? { id: r.sender_id, username: r.sender_username } : null,
    }))
  );
});

// Sent
router.get("/sent", requireLogin, async (req, res) => {
  const db = getDb();
  const userId = req.session.user.id;

  const limit = normalizeLimit(req.query.limit, 50);

  const rows = await db.all(
    `SELECT
      m.id,
      m.subject,
      m.body,
      m.created_at,
      r.id AS recipient_id,
      r.username AS recipient_username
     FROM mail_messages m
     LEFT JOIN users r ON r.id = m.recipient_id
     WHERE m.sender_id = ?
     ORDER BY m.id DESC
     LIMIT ?`,
    userId,
    limit
  );

  res.json(
    rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      body: r.body,
      created_at: r.created_at,
      to: r.recipient_id ? { id: r.recipient_id, username: r.recipient_username } : null,
    }))
  );
});

// Mark message as read (recipient only)
router.post("/:id/read", requireLogin, async (req, res) => {
  const db = getDb();
  const userId = req.session.user.id;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

  const msg = await db.get(
    "SELECT id, recipient_id, is_read FROM mail_messages WHERE id = ?",
    id
  );
  if (!msg) return res.status(404).json({ error: "Message not found" });
  if (msg.recipient_id !== userId) return res.status(401).json({ error: "Not authorized" });

  if (!msg.is_read) {
    await db.run("UPDATE mail_messages SET is_read = 1 WHERE id = ?", id);
  }
  res.json({ ok: true });
});

// Send a message
// Rules:
// - admins/guild_master/founder can message anyone
// - normal members can only message leaders (admin/guild_master/founder)
router.post("/send", requireLogin, async (req, res) => {
  const db = getDb();
  const senderId = req.session.user.id;
  const senderRank = req.session.user.guild_rank;

  const { toUsername, subject, body } = req.body ?? {};

  const toName = String(toUsername ?? "").trim();
  const sub = String(subject ?? "").trim();
  const msgBody = String(body ?? "").trim();

  if (toName.length < 1) return res.status(400).json({ error: "toUsername is required" });
  if (sub.length < 1) return res.status(400).json({ error: "subject is required" });
  if (msgBody.length < 1) return res.status(400).json({ error: "body is required" });
  if (sub.length > 120) return res.status(400).json({ error: "subject too long" });
  if (msgBody.length > 5000) return res.status(400).json({ error: "body too long" });

  const recipient = await db.get(
    "SELECT id, username, guild_rank FROM users WHERE username = ?",
    toName
  );
  if (!recipient) return res.status(404).json({ error: "Recipient not found" });
  if (recipient.id === senderId) return res.status(400).json({ error: "Can't message yourself" });

  const senderIsLeader = ["admin", "guild_master", "founder"].includes(senderRank);
  const recipientIsLeader = ["admin", "guild_master", "founder"].includes(recipient.guild_rank);

  if (!senderIsLeader && !recipientIsLeader) {
    return res.status(401).json({ error: "Members can only message leaders" });
  }

  const result = await db.run(
    `INSERT INTO mail_messages (sender_id, recipient_id, subject, body)
     VALUES (?, ?, ?, ?)`,
    senderId,
    recipient.id,
    sub,
    msgBody
  );

  res.status(201).json({ ok: true, id: result.lastID });
});

export default router;
