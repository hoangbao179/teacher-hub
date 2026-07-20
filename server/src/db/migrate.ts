import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "./pool";

async function migrate(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const migrationDir = path.join(__dirname, "migrations");
    const files = (await fs.readdir(migrationDir))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const [existing] = await connection.query(
        "SELECT version FROM schema_migrations WHERE version = ?",
        [file],
      );
      if (Array.isArray(existing) && existing.length > 0) continue;

      const sql = await fs.readFile(path.join(migrationDir, file), "utf8");
      const statements = sql
        .split(/;\s*(?:\r?\n|$)/)
        .map((statement) => statement.trim())
        .filter(Boolean);

      await connection.beginTransaction();
      try {
        for (const statement of statements) await connection.query(statement);
        await connection.query(
          "INSERT INTO schema_migrations(version) VALUES (?)",
          [file],
        );
        await connection.commit();
        console.log(`Applied ${file}`);
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
  } finally {
    connection.release();
    await pool.end();
  }
}

void migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
