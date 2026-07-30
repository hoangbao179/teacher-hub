const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");

const serverRoot = path.resolve(__dirname, "..");
const migrationDir = path.join(serverRoot, "src", "db", "migrations");
const database = process.env.DB_NAME ?? "";

if (process.env.RUN_MYSQL_INTEGRATION !== "1" || !database.endsWith("_test")) {
  throw new Error("Migration recovery scenario may only run against the integration test database.");
}

const connectionOptions = {
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database,
  multipleStatements: false,
};

async function resetTestDatabase() {
  const connection = await mysql.createConnection({
    ...connectionOptions,
    database: undefined,
  });
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await connection.query(
      `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
}

function runMigrationCli() {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : npmCommand;
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", npmCommand, "run", "db:migrate"]
    : ["run", "db:migrate"];
  const result = spawnSync(command, args, {
    cwd: serverRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, "migration CLI should recover and exit successfully");
}

async function applyThroughV20e(connection) {
  const files = (await fs.readdir(migrationDir))
    .filter((name) => name.endsWith(".sql") && name <= "0020_v20e_vocabulary_results.sql")
    .sort();

  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationDir, file), "utf8");
    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) await connection.query(statement);
    await connection.query(
      "INSERT IGNORE INTO schema_migrations(version) VALUES (?)",
      [file],
    );
    console.log(`Prepared ${file}`);
  }
}

async function assertRecoveredSchema(connection) {
  const [migrations] = await connection.query(
    `SELECT version FROM schema_migrations
     WHERE version IN (
       '0021_v20f_vocabulary_stabilization.sql',
       '0022_v20f_question_item_fallback.sql',
       '0023_vocabulary_attempt_assessment.sql',
       '0024_vocabulary_media_lifecycle.sql'
     ) ORDER BY version`,
  );
  assert.deepEqual(migrations.map((row) => row.version), [
    "0021_v20f_vocabulary_stabilization.sql",
    "0022_v20f_question_item_fallback.sql",
    "0023_vocabulary_attempt_assessment.sql",
    "0024_vocabulary_media_lifecycle.sql",
  ]);

  const [columns] = await connection.query(
    `SELECT table_name,column_name FROM information_schema.columns
     WHERE table_schema=DATABASE() AND (
       (table_name='vocabulary_items' AND column_name='image_search_terms_json')
       OR (table_name='learning_assignment_items' AND column_name='image_search_terms_json')
       OR (table_name='google_sheet_sync_outbox' AND column_name IN ('entity_type','entity_id'))
     )`,
  );
  assert.equal(columns.length, 4);

  const [triggers] = await connection.query(
    `SELECT ACTION_STATEMENT action_statement FROM information_schema.triggers
     WHERE trigger_schema=DATABASE()
       AND trigger_name='trg_learning_question_item_fallback'`,
  );
  assert.equal(triggers.length, 1);
  assert.match(triggers[0].action_statement, /NEW\.first_attempt_correct/);
}

async function main() {
  await resetTestDatabase();
  let connection = await mysql.createConnection(connectionOptions);
  await applyThroughV20e(connection);
  console.log("Applying the interrupted 0021 footprint");
  await connection.query(`ALTER TABLE vocabulary_items
    ADD COLUMN image_search_terms_json JSON NULL AFTER supports_image_game`);
  await connection.end();

  console.log("Running migration recovery for interrupted 0021");
  runMigrationCli();

  connection = await mysql.createConnection(connectionOptions);
  await assertRecoveredSchema(connection);

  await connection.query(
    "DELETE FROM schema_migrations WHERE version='0022_v20f_question_item_fallback.sql'",
  );
  await connection.query("DROP TRIGGER trg_learning_question_item_fallback");
  await connection.end();

  console.log("Running migration recovery for interrupted 0022");
  runMigrationCli();

  connection = await mysql.createConnection(connectionOptions);
  await assertRecoveredSchema(connection);
  await connection.end();
  await resetTestDatabase();
  console.log("Interrupted V20F migration recovery scenario passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
