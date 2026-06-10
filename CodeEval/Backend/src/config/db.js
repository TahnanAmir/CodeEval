const { Pool } = require("pg");

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || process.env.PGHOST || "localhost",
        port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
        user: process.env.DB_USER || process.env.PGUSER || "postgres",
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD || "",
        database: process.env.DB_NAME || process.env.PGDATABASE || "evalbright",
      },
);

module.exports = { pool };
