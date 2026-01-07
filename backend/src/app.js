import express from "express";
import session from "express-session";
import sessionConfig from "./config/session.js";

import authRoutes from "./routes/auth.js";
import announcementRoutes from "./routes/announcements.js";
import partyRoutes from "./routes/parties.js";
import membersRoutes from "./routes/members.js";
import mailRoutes from "./routes/mail.js";

const app = express();

app.use(express.json());
app.use(session(sessionConfig));

// routes
app.use("/api/auth", authRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api/members", membersRoutes);
app.use("/api/mail", mailRoutes);

// simple 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

export default app;
