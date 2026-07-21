/* global process, console */
import path from "node:path";
import { URL } from "node:url";
import { loadEnv } from "vite";

const clientRoot = path.resolve(import.meta.dirname, "..");
const placeholder = /example(?:\.|$)|\.invalid(?:\/|$)|localhost|replace|change-me|placeholder|sample|minh họa/i;

export function validatePublicConfig(env) {
  const errors = [];
  const zaloUrl = String(env.VITE_PUBLIC_ZALO_URL ?? "").trim();

  if (!zaloUrl) {
    errors.push("VITE_PUBLIC_ZALO_URL is required");
  } else if (placeholder.test(zaloUrl)) {
    errors.push("VITE_PUBLIC_ZALO_URL still contains demo/placeholder content");
  } else {
    try {
      const url = new URL(zaloUrl);
      const approvedHost = url.hostname === "zalo.me" || url.hostname.endsWith(".zalo.me");
      const hasContactPath = url.pathname.replaceAll("/", "").length > 0;
      if (url.protocol !== "https:" || !approvedHost || !hasContactPath)
        errors.push("VITE_PUBLIC_ZALO_URL must use an approved HTTPS Zalo contact URL");
    } catch {
      errors.push("VITE_PUBLIC_ZALO_URL must be a valid URL");
    }
  }

  return [...new Set(errors)];
}

const validFixture = { VITE_PUBLIC_ZALO_URL: "https://zalo.me/lien-he-co-vy" };

if (process.argv.includes("--self-test")) {
  if (validatePublicConfig(validFixture).length) throw new Error("Valid Zalo configuration was rejected");
  if (!validatePublicConfig({}).length) throw new Error("Missing Zalo configuration was accepted");
  if (!validatePublicConfig({ VITE_PUBLIC_ZALO_URL: "http://zalo.me/lien-he" }).length) throw new Error("Insecure Zalo URL was accepted");
  if (!validatePublicConfig({ VITE_PUBLIC_ZALO_URL: "https://example.com/lien-he" }).length) throw new Error("Unapproved Zalo host was accepted");
  if (!validatePublicConfig({ VITE_PUBLIC_ZALO_URL: "https://zalo.me/" }).length) throw new Error("Zalo URL without a contact path was accepted");
  const confidentialProbe = "confidential-value-must-not-be-printed";
  if (validatePublicConfig({ VITE_PUBLIC_ZALO_URL: confidentialProbe }).join("\n").includes(confidentialProbe)) throw new Error("Validator exposed a confidential input value");
  console.log("Public Zalo validation self-test passed");
} else {
  const env = { ...loadEnv("production", clientRoot, ""), ...process.env };
  const errors = validatePublicConfig(env);
  if (errors.length) {
    console.error(errors.map((item) => `- ${item}`).join("\n"));
    process.exit(1);
  }
  console.log("Production public Zalo configuration is valid");
}
