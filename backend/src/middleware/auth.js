export function requireLogin(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: "Not logged in" });
  next();
}

export function requireRank(...allowedRanks) {
  return (req, res, next) => {
    const rank = req.session?.user?.guild_rank;
    if (!rank || !allowedRanks.includes(rank)) {
      return res.status(401).json({ error: "Not authorized" });
    }
    next();
  };
}
