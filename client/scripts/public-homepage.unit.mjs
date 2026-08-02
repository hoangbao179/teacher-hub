import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const clientRoot = path.resolve(import.meta.dirname, "..");
const root = path.resolve(clientRoot, "..");
const contentSource = fs.readFileSync(path.join(clientRoot, "src/content/publicHome.ts"), "utf8");
const homepageSource = fs.readFileSync(path.join(clientRoot, "src/pages/HomePage.tsx"), "utf8");
const indexHtml = fs.readFileSync(path.join(clientRoot, "index.html"), "utf8");
const envExample = fs.readFileSync(path.join(clientRoot, ".env.example"), "utf8");
const webDockerfile = fs.readFileSync(path.join(root, "Dockerfile.web"), "utf8");
const deployWorkflow = fs.readFileSync(path.join(root, ".github/workflows/deploy.yml"), "utf8");
const nginxConfig = fs.readFileSync(path.join(root, "deploy/nginx.conf"), "utf8");
const placeUrl = "https://www.google.com/maps/place/L%E1%BB%9Bp+ti%E1%BA%BFng+Anh+c%C3%B4+Vy/@16.4485604,107.5651109,693m/data=!3m1!1e3!4m14!1m7!3m6!1s0x3141a6afd96e3cb5:0xe354465f8ab597f0!2zMTAxIEtp4buHdCAyNDUgQsO5aSBUaOG7iyBYdcOibiwgVGjhu6d5IFh1w6JuLCBIdeG6vywgVmnhu4d0IE5hbQ!3b1!8m2!3d16.4484853!4d107.5649369!3m5!1s0x236f2c65f8d9d355:0x4759212f0d82a749!8m2!3d16.4484035!4d107.5651237!16s%2Fg%2F11zh28qgsd?entry=ttu&g_ep=EgoyMDI2MDcyMi4wIKXMDSoASAFQAw%3D%3D";
const directionsUrl = "https://www.google.com/maps/dir/?api=1&destination=16.4484035%2C107.5651237";

function bootstrapStructuredData() {
  const match = indexHtml.match(/<script id="public-home-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, "Bootstrap Homepage JSON-LD is missing");
  return JSON.parse(match[1]);
}

test("Homepage Maps constants are canonical and use HTTPS", () => {
  assert.ok(placeUrl.length > 0);
  assert.ok(directionsUrl.startsWith("https://"));
  assert.ok(contentSource.includes(`placeUrl: "${placeUrl}"`));
  assert.ok(contentSource.includes(`directionsUrl: "${directionsUrl}"`));
});

test("bootstrap JSON-LD stays synchronized with Homepage location content", () => {
  const graph = bootstrapStructuredData()["@graph"];
  const business = graph.find((item) => item["@type"] === "LocalBusiness");
  assert.equal(business.hasMap, placeUrl);
  assert.deepEqual(business.address, {
    "@type": "PostalAddress",
    streetAddress: "101 Kiệt 245 Bùi Thị Xuân",
    addressLocality: "Phường Thủy Xuân, TP. Huế",
    addressCountry: "VN",
  });
  assert.ok(business.sameAs.includes(placeUrl));
  assert.equal(business.aggregateRating, undefined);
  assert.equal(business.review, undefined);
  assert.equal(business.telephone, undefined);
});

test("Homepage has one bootstrap JSON-LD script and conditional key-mode rendering", () => {
  assert.equal((indexHtml.match(/id="public-home-structured-data"/g) ?? []).length, 1);
  assert.match(homepageSource, /const mapsEmbedApiKey = import\.meta\.env\.VITE_GOOGLE_MAPS_EMBED_API_KEY\?\.trim\(\);/);
  assert.match(homepageSource, /const showMap = Boolean\(mapsEmbedApiKey\) && !mapFailed;/);
  assert.match(homepageSource, /showMap && mapsEmbedApiKey \? <LocationMapPanel/);
  assert.doesNotMatch(homepageSource, /google-maps-fallback-link|Mở Google Maps/);
});

test("optional Maps key is passed only through the frontend build pipeline", () => {
  assert.match(envExample, /# Optional frontend\/build-time value\. Restrict by HTTP referrer and allow only Maps Embed API\.\r?\nVITE_GOOGLE_MAPS_EMBED_API_KEY=/);
  assert.match(webDockerfile, /ARG VITE_GOOGLE_MAPS_EMBED_API_KEY=\r?\nENV VITE_GOOGLE_MAPS_EMBED_API_KEY=\$VITE_GOOGLE_MAPS_EMBED_API_KEY/);
  assert.match(deployWorkflow, /VITE_GOOGLE_MAPS_EMBED_API_KEY=\$\{\{ secrets\.VITE_GOOGLE_MAPS_EMBED_API_KEY \}\}/);
});

test("production CSP permits the Google Maps embed iframe", () => {
  assert.match(nginxConfig, /frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/www\.google\.com https:\/\/taphuan\.nxbgd\.vn https:\/\/online\.flipbuilder\.com;/);
});
