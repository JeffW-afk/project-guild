import app from "./app.js";
import { initDb } from "./db.js";

const PORT = process.env.PORT || 3001;

(async () => {
  await initDb();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
})();
