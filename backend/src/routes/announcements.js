import express from "express";
import { getDb } from "../db.js";
import { requireRank } from "../middleware/auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const db = getDb();
  try {
    const rows = await db.all(
      `SELECT id, title, body, tag, author, created_at
       FROM announcements
       ORDER BY id DESC`
    );

    res.json(rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      tag: r.tag,
      author: r.author,
      date: r.created_at,
    })));
  } catch {
    res.status(500).json({ error: "Failed to load announcements" });
  }
});

router.post("/", requireRank("admin", "guild_master", "founder"), async (req, res) => {
  const db = getDb();
  try {
    const { title, body, tag } = req.body ?? {};
    if (!title || !body) return res.status(400).json({ error: "title and body are required" });

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

router.delete("/:id", requireRank("admin", "guild_master", "founder"), async (req, res) => {
  const db = getDb();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

    const result = await db.run("DELETE FROM announcements WHERE id = ?", id);
    if (result.changes === 0) return res.status(404).json({ error: "Announcement not found" });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

export default router;
