const mysql = require("mysql2/promise");

async function prepare() {
  const database = process.env.DB_NAME;
  if (!database || !/^[A-Za-z0-9_]+_test$/.test(database)) {
    throw new Error("Refusing to prepare a database whose name does not end in _test.");
  }
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
  });
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Native MySQL test database ready: ${database}`);
  } finally { await connection.end(); }
}

void prepare().catch((error) => { console.error(error.message); process.exit(1); });
