import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { fixedWindowRateLimit } from "./fixed-window-rate-limit";
import express from "express";
import { createServer, request, type Server } from "node:http";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import path from "node:path";

test("fixed window limiter rejects requests after its independent limit", () => {
  const middleware = fixedWindowRateLimit({
    limit: 2,
    windowMs: 60_000,
    code: "IMAGE_SEARCH_RATE_LIMITED",
  });
  let nextCalls = 0;
  let status = 0;
  let payload: unknown;
  const headers = new Map<string, string>();
  const request = {
    ip: "127.0.0.44",
    socket: { remoteAddress: "127.0.0.44" },
  } as Request;
  const response = {
    setHeader: (name: string, value: string) => { headers.set(name, value); },
    status: (value: number) => {
      status = value;
      return response;
    },
    json: (value: unknown) => { payload = value; },
  } as unknown as Response;
  const next = (() => { nextCalls += 1; }) as NextFunction;
  middleware(request, response, next);
  middleware(request, response, next);
  middleware(request, response, next);
  assert.equal(nextCalls, 2);
  assert.equal(status, 429);
  assert.ok(Number(headers.get("Retry-After")) >= 1);
  assert.equal(
    (payload as { error: { code: string } }).error.code,
    "IMAGE_SEARCH_RATE_LIMITED",
  );
});

test("Caddy -> Nginx -> API keeps independent client quotas and replaces spoofed XFF", async t => {
  const root = path.resolve(__dirname, "../../..");
  assert.match(readFileSync(path.join(root, "Caddyfile"), "utf8"), /header_up X-Forwarded-For \{remote_host\}/);
  const nginx = readFileSync(path.join(root, "deploy/nginx.conf"), "utf8");
  assert.doesNotMatch(nginx, /\$proxy_add_x_forwarded_for/);
  assert.equal((nginx.match(/proxy_set_header X-Forwarded-For \$http_x_forwarded_for;/g) ?? []).length, 3);
  assert.match(nginx, /proxy_buffering off;/);
  assert.match(readFileSync(path.join(root, "server/src/app.ts"), "utf8"), /app.set\("trust proxy", 1\)/);
  const compose = readFileSync(path.join(root, "docker-compose.deploy.yml"), "utf8");
  for (const name of ["api", "web"]) {
    const block = compose.split(`  ${name}:`)[1].split(/\n  [a-z][\w-]*:/)[0];
    assert.doesNotMatch(block, /\n    ports:/, `${name} must remain behind the ingress`);
  }
  const listen = async (server: Server) => {
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    return (server.address() as {port: number}).port;
  };
  const app = express(); app.set("trust proxy", 1);
  app.post("/", fixedWindowRateLimit({limit: 5,windowMs: 3600000,code: "PDF_RATE_LIMITED"}),
    (req,res) => res.json({ip:req.ip}));
  const api = createServer(app), apiPort = await listen(api);
  const proxy = (port: number, ingress: boolean) => createServer((req,res) => {
    const upstream = request({host:"127.0.0.1",port,method:req.method,path:req.url,headers:{
      ...req.headers, "x-forwarded-for": ingress ? req.socket.remoteAddress! : req.headers["x-forwarded-for"]!,
    }}, response => {res.writeHead(response.statusCode!,response.headers);response.pipe(res);});
    upstream.on("error", () => {res.writeHead(502);res.end();}); req.pipe(upstream);
  });
  const nginxServer = proxy(apiPort,false), nginxPort = await listen(nginxServer);
  const caddy = proxy(nginxPort,true), port = await listen(caddy);
  t.after(async () => {for(const server of [caddy,nginxServer,api]) await new Promise<void>(resolve=>server.close(()=>resolve()));});
  const call = (localAddress: string, spoof: string) => new Promise<{status:number;body:string}>(resolve => {
    const req = request({host:"127.0.0.1",port,method:"POST",localAddress,headers:{"X-Forwarded-For":spoof,"Connection":"close"}},res=>{
      let body="";res.on("data",chunk=>{body+=chunk;});res.on("end",()=>resolve({status:res.statusCode!,body}));
    });req.end();
  });
  for(let i=0;i<5;i++) {
    const response=await call("127.0.0.2",`198.51.100.${i}, 203.0.113.1`);
    assert.equal(response.status,200);assert.equal(JSON.parse(response.body).ip,"127.0.0.2");
  }
  assert.equal((await call("127.0.0.2","192.0.2.99")).status,429);
  const other=await call("127.0.0.3","127.0.0.2");
  assert.equal(other.status,200);assert.equal(JSON.parse(other.body).ip,"127.0.0.3");
});
