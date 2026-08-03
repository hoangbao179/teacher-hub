/* global process */
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";

const modes = new Set(["off", "failure", "review"]);
const originalScreenshots = new WeakMap();

const safeSegment = (value, label) => {
  const normalized = String(value).trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  if (!normalized || normalized === "." || normalized === "..")
    throw new Error(`${label} must contain a safe path segment`);
  return normalized;
};

export function createArtifactPolicy(root, taskId, options = {}) {
  const mode = String(options.mode ?? process.env.SCREENSHOT_MODE ?? options.defaultMode ?? "failure").toLowerCase();
  if (!modes.has(mode)) throw new Error("SCREENSHOT_MODE must be off, failure or review");

  const safeTaskId = safeSegment(taskId, "taskId");
  const configuredOutput = options.output ? path.resolve(root, options.output) : null;
  const taskRoot = configuredOutput ?? path.resolve(root, ".artifacts", safeTaskId);
  const managedRoot = path.resolve(root, ".artifacts");
  const managed = !configuredOutput;
  if (managed && path.relative(managedRoot, taskRoot).startsWith(".."))
    throw new Error("Artifact task path escaped .artifacts");

  if (managed) fs.rmSync(taskRoot, { recursive: true, force: true });
  const runId = safeSegment(options.runId ?? process.env.ARTIFACT_RUN_ID
    ?? `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`, "runId");
  const runDir = configuredOutput ?? path.join(taskRoot, runId);

  return {
    mode,
    taskId: safeTaskId,
    taskRoot,
    runDir,
    managed,
    ensure() { fs.mkdirSync(runDir, { recursive: true }); },
  };
}

function patchPage(page, policy) {
  if (!page || originalScreenshots.has(page) || typeof page.screenshot !== "function") return;
  const original = page.screenshot.bind(page);
  originalScreenshots.set(page, original);
  page.screenshot = async (options = {}) => {
    if (policy.mode !== "review") return Buffer.alloc(0);
    policy.ensure();
    const filename = path.basename(options.path ?? `review-${Date.now()}.png`);
    return original({ ...options, path: path.join(policy.runDir, filename) });
  };
}

function patchContext(context, policy) {
  for (const page of context.pages?.() ?? []) patchPage(page, policy);
  context.on?.("page", (page) => patchPage(page, policy));
}

export function installPlaywrightArtifactPolicy(browser, policy) {
  if (!browser) return;
  for (const context of browser.contexts?.() ?? []) patchContext(context, policy);
  if (typeof browser.newContext !== "function" || browser.__teacherHubArtifactPolicy) return;
  const originalNewContext = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    const context = await originalNewContext(...args);
    patchContext(context, policy);
    return context;
  };
  Object.defineProperty(browser, "__teacherHubArtifactPolicy", { value: true });
}

export async function finalizePlaywrightArtifacts(browser, policy, passed) {
  if (!passed && policy.mode !== "off" && browser) {
    const pages = (browser.contexts?.() ?? []).flatMap((context) => context.pages?.() ?? []);
    if (pages.length) policy.ensure();
    let index = 0;
    for (const page of pages) {
      const original = originalScreenshots.get(page) ?? page.screenshot?.bind(page);
      if (!original || page.isClosed?.()) continue;
      index += 1;
      try {
        await original({ path: path.join(policy.runDir, `failure-${index}.png`), fullPage: true });
      } catch {
        // The original test error remains authoritative when the browser is already gone.
      }
    }
  }

  finalizeArtifactDirectory(policy, passed);
}

export function finalizeArtifactDirectory(policy, passed) {
  if (policy.managed && (passed ? policy.mode !== "review" : policy.mode === "off"))
    fs.rmSync(policy.taskRoot, { recursive: true, force: true });
}
