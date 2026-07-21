import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import express from "express";
import type { AddressInfo } from "node:net";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import { createLoginRateLimit, LoginAttemptLimiter } from "../middleware/login-rate-limit";
import { UserRepository } from "../repositories/user.repository";
import { AdminPasswordService } from "./admin-password.service";
import { AuthService } from "./auth.service";

const integration = process.env.RUN_MYSQL_INTEGRATION === "1" ? test : test.skip;
test.after(async () => {
  if (process.env.RUN_MYSQL_INTEGRATION === "1") await pool.end();
});

interface AuditPasswordRow extends RowDataPacket {
  action: string;
  entity_type: string;
  before_json: string;
  after_json: string;
}

integration("admin reset, audit and HTTP limiter work together", async () => {
  const suffix = Date.now().toString(36);
  const username = `v12c-${suffix}`;
  const oldPassword = "old-password-123";
  const newPassword = "v12c42";
  const oldHash = await bcrypt.hash(oldPassword, 4);
  const [insert] = await pool.execute(
    `INSERT INTO users(username,email,password_hash,display_name,role,status)
     VALUES (?,NULL,?,?,'TEACHER','ACTIVE')`,
    [username, oldHash, "V12C Integration"],
  );
  const userId = Number((insert as { insertId: number }).insertId);
  const cleared: string[] = [];
  const reset = await new AdminPasswordService(
    pool,
    undefined,
    undefined,
    (value) => { cleared.push(value); return 2; },
  ).resetPassword(username, newPassword, newPassword);
  assert.equal(reset.clearedLoginEntries, 2);
  assert.deepEqual(cleared, [username]);

  const [auditRows] = await pool.query<AuditPasswordRow[]>(
    "SELECT action,entity_type,before_json,after_json FROM audit_logs WHERE entity_id=? AND action='ADMIN_PASSWORD_RESET'",
    [userId],
  );
  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0]?.entity_type, "USER");
  assert.equal(JSON.stringify(auditRows).includes(newPassword), false);
  assert.equal(JSON.stringify(auditRows).includes(oldPassword), false);

  const auth = new AuthService(new UserRepository());
  await assert.rejects(() => auth.login(username, oldPassword), (error: unknown) => {
    assert.equal((error as AppError).code, "INVALID_CREDENTIALS");
    return true;
  });
  assert.equal((await auth.login(username, newPassword)).user.username, username);

  const limiter = new LoginAttemptLimiter({ windowSeconds: 1, maxFailures: 2 });
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.post("/login", createLoginRateLimit(limiter), async (req, res) => {
    try {
      res.json({ data: await auth.login(req.body.username ?? "", req.body.password ?? "") });
    } catch (error) {
      const appError = error as AppError;
      res.status(appError.statusCode || 500).json({ error: { code: appError.code || "ERROR", message: appError.message } });
    }
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  const request = (password: string) => fetch(`http://127.0.0.1:${port}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  try {
    assert.equal((await request("wrong-one")).status, 401);
    assert.equal((await request("wrong-two")).status, 401);
    const blocked = await request("wrong-three");
    assert.equal(blocked.status, 429);
    assert.match(blocked.headers.get("retry-after") ?? "", /^\d+$/);
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    assert.equal((await request(newPassword)).status, 200);

    assert.equal((await request("wrong-after-success")).status, 401);
    assert.equal((await request(newPassword)).status, 200);
    assert.equal((await request("wrong-after-clear-one")).status, 401);
    assert.equal((await request("wrong-after-clear-two")).status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
