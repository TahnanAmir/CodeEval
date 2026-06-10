require("dotenv").config();

const app = require("./app");
const { initSchema } = require("./config/initSchema");
const { pool } = require("./config/db");

const port = Number(process.env.PORT || 3001);

async function bootstrap() {
  await initSchema();
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Express API running on http://localhost:${port}`);
  });
}

bootstrap().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error);
  await pool.end();
  process.exit(1);
});
