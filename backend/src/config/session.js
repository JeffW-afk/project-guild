export default {
  secret: process.env.SESSION_SECRET || "dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // true only with HTTPS
    // maxAge: 1000 * 60 * 60 * 24, // optional: 1 day
  },
};
