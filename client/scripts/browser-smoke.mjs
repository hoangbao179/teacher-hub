/* global process, fetch, setTimeout, WebSocket, console */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";

const root = path.resolve(import.meta.dirname, "../..");
dotenv.config({ path: path.join(root, "server/.env") });
const nativeTestDatabase = `${process.env.DB_NAME ?? "teacher_hub"}_test`;
const testEnv = {
  ...process.env, NODE_ENV: "test", DB_HOST: process.env.DB_HOST ?? "127.0.0.1", DB_PORT: process.env.DB_PORT ?? "3306",
  DB_USER: process.env.DB_USER ?? "root", DB_PASSWORD: process.env.DB_PASSWORD ?? "", DB_NAME: nativeTestDatabase,
  JWT_SECRET: "browser-smoke-secret-with-at-least-32-characters",
  BOOTSTRAP_ADMIN_EMAIL: "smoke@example.test", BOOTSTRAP_ADMIN_PASSWORD: "smoke-password-123",
  BOOTSTRAP_ADMIN_DISPLAY_NAME: "Smoke Teacher", PORT: "4100", CORS_ORIGIN: "http://127.0.0.1:5174",
};
const children = [];
let chromeProfile;

function run(command, args, cwd = root, env = testEnv) {
  const npmCli = path.join(path.dirname(process.execPath), "node_modules/npm/bin", command === "npx" ? "npx-cli.js" : "npm-cli.js");
  const executable = ["npm", "npx"].includes(command) ? process.execPath : command;
  const commandArgs = ["npm", "npx"].includes(command) ? [npmCli, ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.error?.message ?? result.status}`);
}
function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  children.push(child); return child;
}
async function waitUrl(url, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const response = await fetch(url); if (response.ok) return; } catch { /* retry until ready */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url); this.nextId = 1; this.pending = new Map();
  }
  async open() {
    await new Promise((resolve, reject) => { this.socket.onopen = resolve; this.socket.onerror = reject; });
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id); this.pending.delete(message.id);
        message.error ? reject(new Error(message.error.message)) : resolve(message.result);
      }
    };
    await this.send("Page.enable"); await this.send("Runtime.enable");
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params })); });
  }
  async eval(expression) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async wait(expression, label, timeout = 15000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await this.eval(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`Timed out waiting for ${label}`);
  }
  async setInput(label, value) {
    const ok = await this.eval(`(() => { const label=[...document.querySelectorAll('label')].find(x=>x.textContent.includes(${JSON.stringify(label)})); const el=label && document.getElementById(label.htmlFor); if(!el) return false; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
    if (!ok) throw new Error(`Input not found: ${label}`);
  }
  async clickText(text) {
    const ok = await this.eval(`(() => { const el=[...document.querySelectorAll('button,a,[role=button]')].find(x=>x.textContent.trim().includes(${JSON.stringify(text)}) && !x.disabled); if(!el) return false; el.click(); return true; })()`);
    if (!ok) throw new Error(`Clickable text not found: ${text}`);
  }
  async clickDialogText(text) {
    const ok = await this.eval(`(() => { const dialog=document.querySelector('[role=dialog]'); const el=dialog && [...dialog.querySelectorAll('button')].find(x=>x.textContent.trim().includes(${JSON.stringify(text)}) && !x.disabled); if(!el) return false; el.click(); return true; })()`);
    if (!ok) throw new Error(`Dialog button not found: ${text}`);
  }
  async select(label, option) {
    const opened = await this.eval(`(() => { const label=[...document.querySelectorAll('label')].find(x=>x.textContent.includes(${JSON.stringify(label)})); if(!label) return false; const direct=document.getElementById(label.htmlFor); const el=(direct && direct.matches('[role=combobox]') ? direct : null) || [...document.querySelectorAll('[role=combobox]')].find(x=>label.parentElement?.contains(x) || (x.getAttribute('aria-labelledby')||'').split(' ').includes(label.id)); if(!el) return false; el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})); return true; })()`);
    if (!opened) throw new Error(`Select not found: ${label}`);
    await this.wait(`!![...document.querySelectorAll('[role=option]')].find(x=>x.textContent.includes(${JSON.stringify(option)}))`, `option ${option}`);
    await this.eval(`[...document.querySelectorAll('[role=option]')].find(x=>x.textContent.includes(${JSON.stringify(option)})).click()`);
  }
}

try {
  run("node", ["scripts/prepare-test-db.cjs"], path.join(root, "server"));
  run("npm", ["run", "db:migrate"], path.join(root, "server"));
  run("npm", ["run", "db:bootstrap-admin"], path.join(root, "server"));
  const node = process.execPath;
  start(node, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], path.join(root, "server"), testEnv);
  start(node, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5174"], path.join(root, "client"), { ...testEnv, VITE_API_BASE_URL: "http://127.0.0.1:4100" });
  await waitUrl("http://127.0.0.1:4100/health"); await waitUrl("http://127.0.0.1:5174");

  const chrome = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (!fs.existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}`);
  chromeProfile = fs.mkdtempSync(path.join(os.tmpdir(), "teacher-hub-smoke-"));
  start(chrome, ["--headless=new", "--no-first-run", "--disable-gpu", "--remote-debugging-port=9223", `--user-data-dir=${chromeProfile}`, "about:blank"], root, testEnv);
  await waitUrl("http://127.0.0.1:9223/json/version");
  const target = await fetch("http://127.0.0.1:9223/json/new?http://127.0.0.1:5174/admin/login", { method: "PUT" }).then((response) => response.json());
  const cdp = new Cdp(target.webSocketDebuggerUrl); await cdp.open();
  await cdp.wait("document.body && document.body.innerText.includes('Đăng nhập cô giáo')", "login page");
  await cdp.setInput("Email", "smoke@example.test"); await cdp.setInput("Mật khẩu", "smoke-password-123"); await cdp.clickText("Đăng nhập");
  await cdp.wait("location.pathname==='/admin'", "dashboard");

  await cdp.clickText("Lớp học"); await cdp.wait("location.pathname==='/admin/classes' && document.body.innerText.includes('Thêm lớp')", "classes"); await cdp.clickText("Thêm lớp");
  await cdp.wait("location.pathname==='/admin/classes/new' && document.body.innerText.includes('Tên lớp')", "class form");
  await cdp.setInput("Tên lớp", `Browser Smoke ${Date.now()}`); await cdp.setInput("Giá gói", "2400000"); await cdp.clickText("Lưu lớp");
  await cdp.wait("/\\/admin\\/classes\\/\\d+$/.test(location.pathname)", "class detail"); const classPath = await cdp.eval("location.pathname");

  await cdp.clickText("Học sinh"); await cdp.wait("location.pathname==='/admin/students' && document.body.innerText.includes('Thêm')", "students"); await cdp.clickText("Thêm");
  await cdp.wait("location.pathname==='/admin/students/new' && document.body.innerText.includes('Họ và tên')", "student form");
  const studentName = `Browser Student ${Date.now()}`; await cdp.setInput("Họ và tên", studentName); await cdp.clickText("Lưu học sinh");
  await cdp.wait("/\\/admin\\/students\\/\\d+$/.test(location.pathname)", "student detail"); const studentPath = await cdp.eval("location.pathname");

  await cdp.eval(`location.assign(${JSON.stringify(`http://127.0.0.1:5174${classPath}`)})`); await cdp.wait("document.body.innerText.includes('Ghi danh')", "class reload");
  await cdp.clickText("Ghi danh"); await cdp.wait("document.querySelector('[role=dialog]') && document.body.innerText.includes('Ngày vào học')", "enrollment dialog"); await cdp.select("Học sinh", studentName); await cdp.clickDialogText("Ghi danh"); await cdp.wait("document.body.innerText.includes('Đã ghi danh học sinh')", "enrollment success"); await cdp.wait(`document.body.innerText.includes(${JSON.stringify(studentName)})`, "enrolled student");

  await cdp.eval(`location.assign(${JSON.stringify(`http://127.0.0.1:5174${studentPath}`)})`); await cdp.wait("document.body.innerText.includes('Đổi chế độ học phí')", "student reload");
  await cdp.clickText("Đổi chế độ học phí"); await cdp.wait("document.querySelector('[role=dialog]') && document.body.innerText.includes('Áp dụng từ')", "tuition dialog"); await cdp.select("Chế độ", "Giá riêng"); await cdp.wait("document.body.innerText.includes('Giá riêng / 8 buổi')", "custom price input"); await cdp.setInput("Giá riêng", "1900000"); await cdp.clickDialogText("Lưu");
  await cdp.wait("document.body.innerText.includes('Đã cập nhật chế độ học phí')", "tuition success"); await cdp.send("Page.reload");
  await cdp.wait("document.body.innerText.includes('1.900.000')", "persisted custom tuition");

  await cdp.eval(`location.assign(${JSON.stringify(`http://127.0.0.1:5174${classPath}`)})`); await cdp.wait("document.body.innerText.includes('Tạm dừng')", "class action");
  await cdp.eval("window.confirm=()=>true"); await cdp.clickText("Tạm dừng"); await cdp.wait("document.body.innerText.includes('Đã tạm dừng lớp')", "class pause success");
  console.log("Browser smoke passed: login, class, student, enrollment, tuition persistence, class pause.");
  cdp.socket.close();
} finally {
  for (const child of children.reverse()) { try { child.kill(); } catch { /* already stopped */ } }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (chromeProfile && fs.existsSync(chromeProfile)) {
    try { fs.rmSync(chromeProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }); }
    catch (error) { console.warn(`Could not remove temporary Chrome profile: ${error.message}`); }
  }
}
