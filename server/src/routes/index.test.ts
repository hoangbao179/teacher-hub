import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../app";
import { config } from "../config/config";

test("authenticated runtime does not expose Legacy Import routes", async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const token = jwt.sign({ id: 1, username: "covy", displayName: "Cô Vy" }, config.jwt.secret);
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

    for (const path of [
      "/api/students/1/legacy-imports/preview",
      "/api/students/1/legacy-imports/apply",
    ]) {
      const response = await fetch(`${base}${path}`, { method: "POST", headers, body: "{}" });
      assert.equal(response.status, 404, `${path} must not be registered`);
    }

    const validStudentRoute = await fetch(`${base}/api/students`, {
      method: "POST", headers, body: "{}",
    });
    assert.equal(validStudentRoute.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
