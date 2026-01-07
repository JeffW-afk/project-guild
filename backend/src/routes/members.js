import express from "express";
import { getDb } from "../db.js";
import { requireLogin, requireRank } from "../middleware/auth.js";

const router = express.Router();

// List all members + their party (or null)
router.get("/", requireLogin, async (req, res) => {
  const db = getDb();

  const rows = await db.all(`
    SELECT
      u.id,
      u.username,
      u.guild_rank,
      p.id AS party_id,
      p.name AS party_name
    FROM users u
    LEFT JOIN party_members pm ON pm.user_id = u.id
    LEFT JOIN parties p ON p.id = pm.party_id AND p.is_active = 1
    ORDER BY u.id DESC
  `);

  res.json(
    rows.map(r => ({
      id: r.id,
      username: r.username,
      guild_rank: r.guild_rank,
      party: r.party_id ? { id: r.party_id, name: r.party_name } : null
    }))
  );
});

// Current user's latest rank request
router.get("/rank-requests/me", requireLogin, async (req, res) => {
  const db = getDb();
  const userId = req.session.user.id;

  const rr = await db.get(
    `SELECT id, requested_rank, status, created_at, reviewed_at
     FROM guild_rank_requests
     WHERE user_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    userId
  );

  res.json({ request: rr ?? null });
});

// Admin list requests
router.get(
  "/rank-requests",
  requireRank("admin", "guild_master", "founder"),
  async (req, res) => {
    const db = getDb();
    const status = String(req.query.status ?? "pending");

    const rows = await db.all(
      `SELECT
        gr.id,
        gr.user_id,
        u.username,
        gr.requested_rank,
        gr.message,
        gr.status,
        gr.created_at
       FROM guild_rank_requests gr
       JOIN users u ON u.id = gr.user_id
       WHERE gr.status = ?
       ORDER BY gr.id DESC`,
      status
    );

    res.json(rows);
  }
);

// Approve rank request (set user.guild_rank)
router.post(
  "/rank-requests/:id/approve",
  requireRank("admin", "guild_master", "founder"),
  async (req, res) => {
    const db = getDb();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

    const rr = await db.get(`SELECT * FROM guild_rank_requests WHERE id = ?`, id);
    if (!rr) return res.status(404).json({ error: "Request not found" });
    if (rr.status !== "pending") return res.status(409).json({ error: "Request is not pending" });

    await db.exec("BEGIN");
    try {
      // Apply the rank change
      await db.run("UPDATE users SET guild_rank = ? WHERE id = ?", rr.requested_rank, rr.user_id);

      // Mark request approved
      await db.run(
        `UPDATE guild_rank_requests
         SET status = 'approved', reviewed_by = ?, reviewed_at = (datetime('now'))
         WHERE id = ?`,
        req.session.user.id,
        id
      );

      // If the user is currently logged in, their session won't auto-update.
      // They'll see the new rank next login (or you can add a /auth/refresh endpoint later).

      await db.exec("COMMIT");
      res.json({ ok: true });
    } catch (e) {
      await db.exec("ROLLBACK");
      res.status(500).json({ error: e?.message || "Approve failed" });
    }
  }
);

// Reject rank request
router.post(
  "/rank-requests/:id/reject",
  requireRank("admin", "guild_master", "founder"),
  async (req, res) => {
    const db = getDb();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

    const rr = await db.get(`SELECT * FROM guild_rank_requests WHERE id = ?`, id);
    if (!rr) return res.status(404).json({ error: "Request not found" });
    if (rr.status !== "pending") return res.status(409).json({ error: "Request is not pending" });

    await db.run(
      `UPDATE guild_rank_requests
       SET status = 'rejected', reviewed_by = ?, reviewed_at = (datetime('now'))
       WHERE id = ?`,
      req.session.user.id,
      id
    );

    res.json({ ok: true });
  }
);

export default router;
