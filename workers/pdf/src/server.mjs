import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

// Authentication is enforced by Cloud Run IAM before requests reach this process.
// Local execution is for development only; no PDF/job endpoint exists yet.
export function createWorkerServer() {
  return createServer({ requestTimeout: 5000, headersTimeout: 5000 }, (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    if (req.url === "/health" && (req.method === "GET" || req.method === "HEAD")) {
      res.writeHead(200);
      res.end(req.method === "HEAD" ? undefined : JSON.stringify({ status: "ok" }));
      return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: "not_found" }));
  });
}

export function startWorker(port = process.env.PORT ?? "8080") {
  if (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  const server = createWorkerServer();
  server.listen(Number(port), "0.0.0.0");
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startWorker();
}
