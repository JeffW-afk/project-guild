import express from "express";
import { getDb } from "../db.js";
import { requireLogin, requireRank } from "../middleware/auth.js";

const router = express.Router();

function normalizePartyName(name) {
  return String(name ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

async function isPartyCaptain(db, userId, partyId) {
  const row = await db.get(
    `SELECT 1
     FROM party_members pm
     JOIN party_roles pr ON pr.id = pm.role_id
     WHERE pm.party_id = ?
       AND pm.user_id = ?
       AND pr.name = 'captain'
     LIMIT 1`,
    partyId,
    userId
  );

  return !!row;
}


// --- Member endpoints ---

// Current user's party (if any)
router.get("/me", requireLogin, async (req, res) => {
  const db = getDb();
  const userId = req.session.user.id;

  const row = await db.get(
    `SELECT
      pm.user_id,
      p.id AS party_id,
      p.name AS party_name,
      p.description AS party_description,
      pr.name AS role_name
     FROM party_members pm
     JOIN parties p ON p.id = pm.party_id
     JOIN party_roles pr ON pr.id = pm.role_id
     WHERE pm.user_id = ?`,
    userId
  );

  if (!row) return res.json({ party: null });

  return res.json({
    party: {
      id: row.party_id,
      name: row.party_name,
      description: row.party_description,
      role: row.role_name,
    },
  });
});

// List parties + member counts
router.get("/", requireLogin, async (req, res) => {
  const db = getDb();
  const rows = await db.all(
    `SELECT
      p.id,
      p.name,
      p.description,
      p.created_at,
      COUNT(pm.id) AS member_count
     FROM parties p
     LEFT JOIN party_members pm ON pm.party_id = p.id
     WHERE p.is_active = 1
     GROUP BY p.id
     ORDER BY p.id DESC`
  );

  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      created_at: r.created_at,
      member_count: Number(r.member_count ?? 0),
    }))
  );
});

// Request a new party (needs admin approval)
router.post("/requests", requireLogin, async (req, res) => {
  const db = getDb();
  const userId = req.session.user.id;

  const partyName = normalizePartyName(req.body?.party_name ?? req.body?.partyName);
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : null;

  if (partyName.length < 3) {
    return res.status(400).json({ error: "party_name must be at least 3 characters" });
  }

  const alreadyInParty = await db.get(
    "SELECT 1 FROM party_members WHERE user_id = ?",
    userId
  );
  if (alreadyInParty) {
    return res.status(409).json({ error: "You are already in a party" });
  }

  const pending = await db.get(
    "SELECT id FROM party_requests WHERE user_id = ? AND status = 'pending'",
    userId
  );
  if (pending) {
    return res.status(409).json({ error: "You already have a pending party request" });
  }

  // Avoid two parties with same name
  const nameTaken = await db.get("SELECT id FROM parties WHERE name = ?", partyName);
  if (nameTaken) {
    return res.status(409).json({ error: "That party name already exists" });
  }

  const result = await db.run(
    `INSERT INTO party_requests (user_id, party_name, message)
     VALUES (?, ?, ?)` ,
    userId,
    partyName,
    message
  );

  const created = await db.get(
    "SELECT id, party_name, message, status, created_at FROM party_requests WHERE id = ?",
    result.lastID
  );

  return res.status(201).json({
    id: created.id,
    party_name: created.party_name,
    message: created.message,
    status: created.status,
    created_at: created.created_at,
  });
});

// See your current request (if any)
router.get("/requests/me", requireLogin, async (req, res) => {
  const db = getDb();
  const userId = req.session.user.id;

  const row = await db.get(
    `SELECT id, party_name, message, status, created_at, reviewed_by, reviewed_at
     FROM party_requests
     WHERE user_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    userId
  );

  if (!row) return res.json({ request: null });
  return res.json({ request: row });
});

// --- Admin endpoints ---

// See your latest join request (if any)
router.get("/join-requests/me", requireLogin, async (req, res) => {
  const db = getDb();
  const userId = req.session.user.id;

  const row = await db.get(
    `SELECT
        r.id,
        r.party_id,
        p.name AS party_name,
        r.message,
        r.status,
        r.created_at,
        r.reviewed_by,
        r.reviewed_at
     FROM party_join_requests r
     JOIN parties p ON p.id = r.party_id
     WHERE r.user_id = ?
     ORDER BY r.id DESC
     LIMIT 1`,
    userId
  );

  return res.json({ request: row ?? null });
});

// Request to join a party (must be unaffiliated)
router.post("/:id/join-requests", requireLogin, async (req, res) => {
  const db = getDb();
  const userId = req.session.user.id;
  const partyId = Number(req.params.id);

  if (!Number.isInteger(partyId)) {
    return res.status(400).json({ error: "Invalid party id" });
  }

  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : null;

  // must be unaffiliated
  const alreadyInParty = await db.get(
    "SELECT 1 FROM party_members WHERE user_id = ?",
    userId
  );
  if (alreadyInParty) {
    return res.status(409).json({ error: "You are already in a party" });
  }

  // only one pending request at a time
  const pending = await db.get(
    "SELECT id FROM party_join_requests WHERE user_id = ? AND status = 'pending'",
    userId
  );
  if (pending) {
    return res.status(409).json({ error: "You already have a pending join request" });
  }

  // party must exist + be active
  const party = await db.get(
    "SELECT id FROM parties WHERE id = ? AND is_active = 1",
    partyId
  );
  if (!party) {
    return res.status(404).json({ error: "Party not found" });
  }

  const result = await db.run(
    `INSERT INTO party_join_requests (user_id, party_id, message)
     VALUES (?, ?, ?)`,
    userId,
    partyId,
    message
  );

  const created = await db.get(
    `SELECT id, party_id, message, status, created_at
     FROM party_join_requests
     WHERE id = ?`,
    result.lastID
  );
  
  // Notify party captain
  const partyRow = await db.get("SELECT name FROM parties WHERE id = ?", partyId);
  const officers = await db.all(
    `SELECT u.id, u.username
     FROM party_members pm
     JOIN party_roles pr ON pr.id = pm.role_id
     JOIN users u ON u.id = pm.user_id
     WHERE pm.party_id = ?
       AND pr.name = 'captain'`,
    partyId
  );

  const requesterName = req.session.user.username;
  const subject = `Join request: ${requesterName} → ${partyRow?.name ?? "Party"}`;
  const body =
    (message && message.length)
      ? `Request ID: ${created.id}\n\n${requesterName} requested to join your party.\n\nMessage:\n${message}`
      : `Request ID: ${created.id}\n\n${requesterName} requested to join your party.`;

  for (const o of officers) {
    await db.run(
      `INSERT INTO mail_messages (sender_id, recipient_id, subject, body)
       VALUES (NULL, ?, ?, ?)`,
      o.id,
      subject,
      body
    );
  }
  return res.status(201).json(created);
});

// List requests (default: pending)
router.get(
  "/requests",
  requireRank("admin", "guild_master", "founder"),
  async (req, res) => {
    const db = getDb();
    const status = typeof req.query.status === "string" ? req.query.status : "pending";

    const rows = await db.all(
      `SELECT
        pr.id,
        pr.party_name,
        pr.message,
        pr.status,
        pr.created_at,
        u.id AS user_id,
        u.username
       FROM party_requests pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.status = ?
       ORDER BY pr.id DESC`,
      status
    );

    res.json(
      rows.map((r) => ({
        id: r.id,
        party_name: r.party_name,
        message: r.message,
        status: r.status,
        created_at: r.created_at,
        user: { id: r.user_id, username: r.username },
      }))
    );
  }
);

async function createDefaultRoles(db, partyId) {
  const roles = [
    { name: "captain", permissions: { manage_members: true, invite: true } },
    { name: "second", permissions: { manage_members: true, invite: true } },
    { name: "member", permissions: { manage_members: false, invite: false } },
  ];

  for (const r of roles) {
    await db.run(
      "INSERT INTO party_roles (party_id, name, permissions) VALUES (?, ?, ?)",
      partyId,
      r.name,
      JSON.stringify(r.permissions)
    );
  }
}

router.post(
  "/requests/:id/approve",
  requireRank("admin", "guild_master", "founder"),
  async (req, res) => {
    const db = getDb();
    const reviewerId = req.session.user.id;
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId)) return res.status(400).json({ error: "Invalid request id" });

    await db.exec("BEGIN");
    try {
      const reqRow = await db.get(
        "SELECT * FROM party_requests WHERE id = ?",
        requestId
      );

      if (!reqRow) {
        await db.exec("ROLLBACK");
        return res.status(404).json({ error: "Request not found" });
      }
      if (reqRow.status !== "pending") {
        await db.exec("ROLLBACK");
        return res.status(409).json({ error: `Request is already ${reqRow.status}` });
      }

      const alreadyInParty = await db.get(
        "SELECT 1 FROM party_members WHERE user_id = ?",
        reqRow.user_id
      );
      if (alreadyInParty) {
        await db.exec("ROLLBACK");
        return res.status(409).json({ error: "User is already in a party" });
      }

      const nameTaken = await db.get(
        "SELECT id FROM parties WHERE name = ?",
        reqRow.party_name
      );
      if (nameTaken) {
        await db.exec("ROLLBACK");
        return res.status(409).json({ error: "That party name already exists" });
      }

      const partyRes = await db.run(
        "INSERT INTO parties (name, description, created_by) VALUES (?, ?, ?)",
        reqRow.party_name,
        reqRow.message ?? null,
        reqRow.user_id
      );

      const partyId = partyRes.lastID;

      await createDefaultRoles(db, partyId);

      const captainRole = await db.get(
        "SELECT id, name FROM party_roles WHERE party_id = ? AND name = 'captain'",
        partyId
      );
      if (!captainRole) throw new Error("Failed to create captain role");

      await db.run(
        "INSERT INTO party_members (party_id, user_id, role_id) VALUES (?, ?, ?)",
        partyId,
        reqRow.user_id,
        captainRole.id
      );

      await db.run(
        "UPDATE party_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ?",
        reviewerId,
        nowIso(),
        requestId
      );

      await db.exec("COMMIT");

      const party = await db.get("SELECT id, name, description, created_at FROM parties WHERE id = ?", partyId);
      return res.json({
        ok: true,
        party,
        captain_user_id: reqRow.user_id,
      });
    } catch (e) {
      await db.exec("ROLLBACK");
      return res.status(500).json({ error: e?.message || "Failed to approve request" });
    }
  }
);

router.post(
  "/requests/:id/reject",
  requireRank("admin", "guild_master", "founder"),
  async (req, res) => {
    const db = getDb();
    const reviewerId = req.session.user.id;
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId)) return res.status(400).json({ error: "Invalid request id" });

    const reqRow = await db.get("SELECT * FROM party_requests WHERE id = ?", requestId);
    if (!reqRow) return res.status(404).json({ error: "Request not found" });
    if (reqRow.status !== "pending") {
      return res.status(409).json({ error: `Request is already ${reqRow.status}` });
    }

    await db.run(
      "UPDATE party_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ? WHERE id = ?",
      reviewerId,
      nowIso(),
      requestId
    );

    res.json({ ok: true });
  }
);

// Remove (disband) a party: guild leadership only
router.delete(
  "/:id",
  requireRank("admin", "guild_master", "founder"),
  async (req, res) => {
    const db = getDb();
    const partyId = Number(req.params.id);

    if (!Number.isInteger(partyId)) {
      return res.status(400).json({ error: "Invalid party id" });
    }

    await db.exec("BEGIN");
    try {
      const party = await db.get(
        "SELECT id, name, is_active FROM parties WHERE id = ?",
        partyId
      );

      if (!party) {
        await db.exec("ROLLBACK");
        return res.status(404).json({ error: "Party not found" });
      }

      if (Number(party.is_active) === 0) {
        await db.exec("ROLLBACK");
        return res.status(409).json({ error: "Party is already removed" });
      }

      // Disband: unaffiliate everyone
      await db.run("DELETE FROM party_members WHERE party_id = ?", partyId);

      // Archive party so it no longer shows
      await db.run("UPDATE parties SET is_active = 0 WHERE id = ?", partyId);
      await db.run("DELETE FROM party_join_requests WHERE party_id = ? AND status = 'pending'", partyId);
      await db.exec("COMMIT");
      return res.json({ ok: true });
    } catch (e) {
      await db.exec("ROLLBACK");
      return res.status(500).json({ error: e?.message || "Failed to remove party" });
    }
  }
);

// List join requests (captain only; for their own party)
router.get("/join-requests", requireLogin, async (req, res) => {
  const db = getDb();
  const userId = req.session.user.id;

  const status = typeof req.query.status === "string" ? req.query.status : "pending";
  const requestedPartyId = req.query.party_id ? Number(req.query.party_id) : null;

  const my = await db.get(
    `SELECT pm.party_id, pr.name AS role_name
     FROM party_members pm
     JOIN party_roles pr ON pr.id = pm.role_id
     WHERE pm.user_id = ?
     LIMIT 1`,
    userId
  );

  if (!my || my.role_name !== "captain") {
    return res.status(401).json({ error: "Only the party captain can manage join requests" });
  }

  if (Number.isInteger(requestedPartyId) && requestedPartyId !== my.party_id) {
    return res.status(401).json({ error: "Not authorized" });
  }

  const rows = await db.all(
    `SELECT
      r.id,
      r.user_id,
      u.username,
      r.party_id,
      p.name AS party_name,
      r.message,
      r.status,
      r.created_at
     FROM party_join_requests r
     JOIN users u ON u.id = r.user_id
     JOIN parties p ON p.id = r.party_id
     WHERE r.status = ?
       AND r.party_id = ?
     ORDER BY r.id DESC`,
    status,
    my.party_id
  );

  return res.json(rows);
});


// Approve join request
router.post(
  "/join-requests/:id/approve",
  requireLogin,
  async (req, res) => {
    const db = getDb();
    const reviewerId = req.session.user.id;
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId)) return res.status(400).json({ error: "Invalid request id" });

    await db.exec("BEGIN");
    try {
      const rr = await db.get("SELECT * FROM party_join_requests WHERE id = ?", requestId);
      if (!rr) { await db.exec("ROLLBACK"); return res.status(404).json({ error: "Request not found" }); }
      if (rr.status !== "pending") { await db.exec("ROLLBACK"); return res.status(409).json({ error: `Request is already ${rr.status}` }); }

      const allowed = await isPartyCaptain(db, reviewerId, rr.party_id);
      if (!allowed) {
        await db.exec("ROLLBACK");
        return res.status(401).json({ error: "Only the party captain can approve join requests" });
      }

      // still unaffiliated?
      const alreadyInParty = await db.get("SELECT 1 FROM party_members WHERE user_id = ?", rr.user_id);
      if (alreadyInParty) { await db.exec("ROLLBACK"); return res.status(409).json({ error: "User is already in a party" }); }

      // party still active?
      const party = await db.get("SELECT id FROM parties WHERE id = ? AND is_active = 1", rr.party_id);
      if (!party) { await db.exec("ROLLBACK"); return res.status(404).json({ error: "Party not found" }); }

      // get member role id
      let role = await db.get(
        "SELECT id FROM party_roles WHERE party_id = ? AND name = 'member'",
        rr.party_id
      );
      if (!role) {
        // fallback if old party missing roles
        const ins = await db.run(
          "INSERT INTO party_roles (party_id, name, permissions) VALUES (?, 'member', '{}')",
          rr.party_id
        );
        role = { id: ins.lastID };
      }

      await db.run(
        "INSERT INTO party_members (party_id, user_id, role_id) VALUES (?, ?, ?)",
        rr.party_id,
        rr.user_id,
        role.id
      );

      await db.run(
        "UPDATE party_join_requests SET status='approved', reviewed_by=?, reviewed_at=? WHERE id=?",
        reviewerId,
        nowIso(),
        requestId
      );

      const partyNameRow = await db.get("SELECT name FROM parties WHERE id = ?", rr.party_id);
      const subject = `Join approved: ${partyNameRow?.name ?? "Party"}`;
      const body = `Your request to join ${partyNameRow?.name ?? "the party"} was approved.`;

      await db.run(
        `INSERT INTO mail_messages (sender_id, recipient_id, subject, body)
         VALUES (NULL, ?, ?, ?)`,
        rr.user_id,
        subject,
        body
      );
      await db.exec("COMMIT");
      res.json({ ok: true });
    } catch (e) {
      await db.exec("ROLLBACK");
      res.status(500).json({ error: e?.message || "Approve failed" });
    }
  }
);

// Reject join request
router.post(
  "/join-requests/:id/reject",
  requireLogin,
  async (req, res) => {
    const db = getDb();
    const reviewerId = req.session.user.id;
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId)) return res.status(400).json({ error: "Invalid request id" });

    const rr = await db.get("SELECT * FROM party_join_requests WHERE id = ?", requestId);
    if (!rr) return res.status(404).json({ error: "Request not found" });
    if (rr.status !== "pending") return res.status(409).json({ error: `Request is already ${rr.status}` });

    const allowed = await isPartyCaptain(db, reviewerId, rr.party_id);
    if (!allowed) {
      return res.status(401).json({ error: "Only the party captain can reject join requests" });
    }

    await db.run(
      "UPDATE party_join_requests SET status='rejected', reviewed_by=?, reviewed_at=? WHERE id=?",
      reviewerId,
      nowIso(),
      requestId
    );

    const partyNameRow = await db.get("SELECT name FROM parties WHERE id = ?", rr.party_id);
    const subject = `Join rejected: ${partyNameRow?.name ?? "Party"}`;
    const body = `Your request to join ${partyNameRow?.name ?? "the party"} was rejected.`;

    await db.run(
      `INSERT INTO mail_messages (sender_id, recipient_id, subject, body)
       VALUES (NULL, ?, ?, ?)`,
      rr.user_id,
      subject,
      body
    );

    res.json({ ok: true });
  }
);

export default router;
