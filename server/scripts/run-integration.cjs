const { spawnSync } = require("node:child_process");
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const root = path.resolve(__dirname, "../..");
const env = {
  ...process.env,
  NODE_ENV: "test",
  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: `${process.env.DB_NAME ?? "teacher_hub"}_test`,
  JWT_SECRET: "integration-test-secret-with-at-least-32-characters",
  RUN_MYSQL_INTEGRATION: "1",
};

function run(command, args, cwd = root) {
  const npmCli = path.join(path.dirname(process.execPath), "node_modules/npm/bin", command === "npx" ? "npx-cli.js" : "npm-cli.js");
  const executable = ["npm", "npx"].includes(command) ? process.execPath : command;
  const commandArgs = ["npm", "npx"].includes(command) ? [npmCli, ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
}

try {
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npx", ["tsx", "--test", "--test-concurrency=1", "src/**/*.integration.test.ts"], path.join(root, "server"));
} catch (error) { console.error(error); process.exit(1); }
