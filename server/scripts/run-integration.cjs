const { spawnSync } = require("node:child_process");
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const serverRoot = path.resolve(__dirname, "..");
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

function run(command, args, options = {}, label = `${command} ${args.join(" ")}`) {
  const result = spawnSync(command, args, {
    cwd: serverRoot,
    env,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with ${result.status}`);
  }
}

function runNpm(args, options = {}) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  if (process.platform === "win32") {
    run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", npmCommand, ...args], options, `npm ${args.join(" ")}`);
    return;
  }
  run(npmCommand, args, options, `npm ${args.join(" ")}`);
}

function runNpx(args, options = {}) {
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  if (process.platform === "win32") {
    run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", npxCommand, ...args], options, `npx ${args.join(" ")}`);
    return;
  }
  run(npxCommand, args, options, `npx ${args.join(" ")}`);
}

try {
  run(process.execPath, ["scripts/prepare-test-db.cjs"]);
  runNpm(["run", "db:migrate"]);
  runNpx(["tsx", "--test", "--test-concurrency=1", "src/**/*.integration.test.ts"]);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
