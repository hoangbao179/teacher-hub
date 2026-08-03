import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createArtifactPolicy, finalizePlaywrightArtifacts, installPlaywrightArtifactPolicy } from "./artifacts.mjs";

const root = path.resolve(import.meta.dirname, "../..");

function fakeBrowser() {
  const page = {
    async screenshot(options) {
      fs.mkdirSync(path.dirname(options.path), { recursive: true });
      fs.writeFileSync(options.path, "synthetic screenshot");
      return Buffer.from("synthetic screenshot");
    },
    isClosed() { return false; },
  };
  const context = { pages: () => [page], on() {} };
  return { browser: { contexts: () => [context] }, page };
}

test("passing failure-mode run leaves no screenshot artifact", async () => {
  const policy = createArtifactPolicy(root, "artifact-policy-pass-test", { mode: "failure", runId: "run" });
  const { browser, page } = fakeBrowser();
  installPlaywrightArtifactPolicy(browser, policy);
  await page.screenshot({ path: "legacy-pass.png" });
  await finalizePlaywrightArtifacts(browser, policy, true);
  assert.equal(fs.existsSync(policy.taskRoot), false);
});

test("failed run writes screenshot below ignored artifact root", async () => {
  const policy = createArtifactPolicy(root, "artifact-policy-failure-test", { mode: "failure", runId: "run" });
  const { browser, page } = fakeBrowser();
  installPlaywrightArtifactPolicy(browser, policy);
  await page.screenshot({ path: "legacy-pass.png" });
  assert.equal(fs.existsSync(policy.runDir), false);
  await finalizePlaywrightArtifacts(browser, policy, false);
  assert.equal(fs.existsSync(path.join(policy.runDir, "failure-1.png")), true);
  assert.equal(path.relative(root, policy.runDir).replaceAll("\\", "/"), ".artifacts/artifact-policy-failure-test/run");
  fs.rmSync(policy.taskRoot, { recursive: true, force: true });
});
