/* global process, fetch, setTimeout, WebSocket, console */
import { spawn, spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
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
  BOOTSTRAP_ADMIN_USERNAME: "smoke-e2e", BOOTSTRAP_ADMIN_PASSWORD: "smoke-password-123",
  BOOTSTRAP_ADMIN_DISPLAY_NAME: "Smoke Teacher", PORT: "4100", CORS_ORIGIN: "http://127.0.0.1:5174",
};
const children = [];
let chromeProfile;
const artifactDir = path.join(os.tmpdir(), "teacher-hub-m6c-ui-audit");
fs.mkdirSync(artifactDir, { recursive: true });

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
    await this.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
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
  async clickLabel(label) {
    const ok = await this.eval(`(() => { const el=document.querySelector('[aria-label=${JSON.stringify(label)}]'); if(!el || el.disabled) return false; el.click(); return true; })()`);
    if (!ok) throw new Error(`Accessible control not found: ${label}`);
  }
  async screenshot(name) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(artifactDir, `${name}.png`), Buffer.from(data, "base64"));
  }
  async select(label, option) {
    const opened = await this.eval(`(() => { const label=[...document.querySelectorAll('label')].find(x=>x.textContent.includes(${JSON.stringify(label)})); if(!label) return false; const direct=document.getElementById(label.htmlFor); const el=(direct && direct.matches('[role=combobox]') ? direct : null) || [...document.querySelectorAll('[role=combobox]')].find(x=>label.parentElement?.contains(x) || (x.getAttribute('aria-labelledby')||'').split(' ').includes(label.id)); if(!el) return false; el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})); return true; })()`);
    if (!opened) throw new Error(`Select not found: ${label}`);
    await this.wait(`!![...document.querySelectorAll('[role=option]')].find(x=>x.textContent.includes(${JSON.stringify(option)}))`, `option ${option}`);
    await this.eval(`[...document.querySelectorAll('[role=option]')].find(x=>x.textContent.includes(${JSON.stringify(option)})).click()`);
  }
  async selectDialog(label, option) {
    const opened = await this.eval(`(() => { const dialog=document.querySelector('[role=dialog]'); const label=dialog && [...dialog.querySelectorAll('label')].find(x=>x.textContent.includes(${JSON.stringify(label)})); const direct=label && document.getElementById(label.htmlFor); const combos=dialog ? [...dialog.querySelectorAll('[role=combobox]')] : []; const el=(direct && direct.matches('[role=combobox]') ? direct : null) || (label && combos.find(x=>label.parentElement?.contains(x))) || (${JSON.stringify(label)}==='Sắp xếp' ? combos[1] : combos[0]); if(!el) return false; el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})); return true; })()`);
    if (!opened) throw new Error(`Dialog select not found: ${label}`);
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
  await cdp.wait("document.body && document.body.innerText.includes('Đăng nhập')", "login page");
  await cdp.screenshot("admin-login-390");
  await cdp.setInput("Tên đăng nhập", "smoke-e2e"); await cdp.setInput("Mật khẩu", "smoke-password-123"); await cdp.clickText("Đăng nhập");
  await cdp.wait("location.pathname==='/admin' && !!document.querySelector('[data-testid=dashboard-page]')", "dashboard");
  const typographyAudit = await cdp.eval(`(async () => {
    await document.fonts.ready;
    const bodyStyle = getComputedStyle(document.body);
    const heading = document.querySelector('h1');
    const headingStyle = heading && getComputedStyle(heading);
    const button = document.querySelector('.MuiButton-root');
    const buttonStyle = button && getComputedStyle(button);
    return {
      fontLoaded: document.fonts.check('400 16px "Be Vietnam Pro"'),
      bodyFamily: bodyStyle.fontFamily,
      headingSize: headingStyle?.fontSize,
      headingWeight: headingStyle?.fontWeight,
      buttonSize: buttonStyle?.fontSize,
      buttonWeight: buttonStyle?.fontWeight,
      rawEnums: (document.body.innerText.match(/\\b(ACTIVE|PAUSED|CLOSED|PRESENT|ABSENT|FREE|ACCUMULATING|PAYMENT_DUE|PAID|INCOMPLETE)\\b/g) || []),
      unnamedEnabledActions: [...document.querySelectorAll('button:not(:disabled),a[href]')].filter((el) => !(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent.trim())).length,
    };
  })()`);
  if (!typographyAudit.fontLoaded || !typographyAudit.bodyFamily.includes("Be Vietnam Pro")) throw new Error(`Application font is not loaded: ${JSON.stringify(typographyAudit)}`);
  if (typographyAudit.headingSize !== "21px" || typographyAudit.headingWeight !== "700") throw new Error(`Unexpected page-title typography: ${JSON.stringify(typographyAudit)}`);
  if (typographyAudit.buttonSize !== "14px" || Number(typographyAudit.buttonWeight) > 600) throw new Error(`Unexpected button typography: ${JSON.stringify(typographyAudit)}`);
  if (typographyAudit.rawEnums.length) throw new Error(`Raw enum labels are visible: ${typographyAudit.rawEnums.join(", ")}`);
  if (typographyAudit.unnamedEnabledActions) throw new Error(`${typographyAudit.unnamedEnabledActions} enabled actions lack an accessible name`);
  await cdp.screenshot("dashboard-390");
  const mobileShell = await cdp.eval(`(() => ({
    mobileNav: getComputedStyle(document.querySelector('[data-testid="mobile-navigation"]')).display,
    desktopNav: getComputedStyle(document.querySelector('[data-testid="desktop-navigation"]')).display,
    overflow: document.documentElement.scrollWidth-document.documentElement.clientWidth,
  }))()`);
  if (mobileShell.mobileNav === "none" || mobileShell.desktopNav !== "none" || mobileShell.overflow > 1) throw new Error(`Invalid mobile shell: ${JSON.stringify(mobileShell)}`);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.reload"); await new Promise((resolve) => setTimeout(resolve, 350)); await cdp.wait("location.pathname==='/admin' && !!document.querySelector('[data-testid=dashboard-page]')", "desktop dashboard");
  const desktopShell = await cdp.eval(`(() => {
    const contentElement = document.querySelector('[data-testid="admin-content"]');
    const mobileElement = document.querySelector('[data-testid="mobile-navigation"]');
    const desktopElement = document.querySelector('[data-testid="desktop-navigation"]');
    const eventsElement = document.querySelector('[data-testid="dashboard-events"]');
    const content = contentElement?.getBoundingClientRect();
    return {
      mobileNav: mobileElement ? getComputedStyle(mobileElement).display : 'missing',
      desktopNav: desktopElement ? getComputedStyle(desktopElement).display : 'missing',
      contentWidth: content?.width || 0,
      eventColumns: eventsElement ? getComputedStyle(eventsElement).gridTemplateColumns.split(' ').length : 0,
      overflow: document.documentElement.scrollWidth-document.documentElement.clientWidth,
    };
  })()`);
  if (desktopShell.mobileNav !== "none" || desktopShell.desktopNav === "none" || desktopShell.contentWidth < 900 || desktopShell.eventColumns < 2 || desktopShell.overflow > 1) throw new Error(`Invalid desktop shell: ${JSON.stringify(desktopShell)}`);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Page.reload"); await new Promise((resolve) => setTimeout(resolve, 350)); await cdp.wait("location.pathname==='/admin' && !!document.querySelector('[data-testid=dashboard-page]')", "360px dashboard");
  if (await cdp.eval("document.documentElement.scrollWidth-document.documentElement.clientWidth") > 1) throw new Error("Dashboard overflows at 360px");
  for (const viewport of [{ width: 400, height: 930 }, { width: 430, height: 932 }]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { ...viewport, deviceScaleFactor: 1, mobile: true });
    await cdp.send("Page.reload"); await new Promise((resolve) => setTimeout(resolve, 250));
    await cdp.wait("location.pathname==='/admin' && !!document.querySelector('[data-testid=dashboard-page]')", `${viewport.width}px dashboard`);
    if (await cdp.eval("document.documentElement.scrollWidth-document.documentElement.clientWidth") > 1) throw new Error(`Dashboard overflows at ${viewport.width}px`);
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Page.reload"); await new Promise((resolve) => setTimeout(resolve, 350)); await cdp.wait("location.pathname==='/admin' && !!document.querySelector('[data-testid=dashboard-page]')", "restored mobile dashboard");

  await cdp.clickText("Lớp học"); await cdp.wait("location.pathname==='/admin/classes' && document.body.innerText.includes('Thêm lớp')", "classes"); await cdp.screenshot("class-list-390"); await cdp.clickText("Thêm lớp");
  await cdp.wait("location.pathname==='/admin/classes/new' && document.body.innerText.includes('Tên lớp')", "class form");
  const classDefaults = await cdp.eval(`(() => {
    const valueFor = (needle) => { const label=[...document.querySelectorAll('label')].find((item)=>item.textContent.includes(needle)); return label ? document.getElementById(label.htmlFor)?.value : undefined; };
    return { price: valueFor('Giá gói'), subject: valueFor('Môn học'), sections: [...document.querySelectorAll('h2')].map((item)=>item.textContent) };
  })()`);
  if (classDefaults.price !== "" || classDefaults.subject !== "Tiếng Anh" || !["Thông tin lớp", "Học phí", "Lịch học hằng tuần", "Ghi chú"].every((item) => classDefaults.sections.includes(item)))
    throw new Error(`Unexpected new-class defaults/sections: ${JSON.stringify(classDefaults)}`);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const formWidth = await cdp.eval("document.querySelector('[data-testid=bounded-form]').getBoundingClientRect().width");
  if (formWidth > 681 || formWidth < 580) throw new Error(`Desktop form width is not bounded appropriately: ${formWidth}px`);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp.screenshot("class-form-390");
  await cdp.setInput("Tên lớp", `Browser Smoke ${Date.now()}`); await cdp.setInput("Giá gói", "2400000"); await cdp.clickText("Lưu lớp");
  await cdp.wait("/\\/admin\\/classes\\/\\d+$/.test(location.pathname)", "class detail"); const classPath = await cdp.eval("location.pathname");
  await cdp.screenshot("class-detail-390");

  await cdp.clickText("Học sinh"); await cdp.wait("location.pathname==='/admin/students' && document.body.innerText.includes('Thêm')", "students"); await cdp.screenshot("student-list-390"); await cdp.clickText("Thêm");
  await cdp.wait("location.pathname==='/admin/students/new' && document.body.innerText.includes('Họ và tên')", "student form");
  await cdp.screenshot("student-form-390");
  const studentName = `Browser Student ${Date.now()}`; await cdp.setInput("Họ và tên", studentName); await cdp.clickText("Lưu học sinh");
  await cdp.wait("/\\/admin\\/students\\/\\d+$/.test(location.pathname)", "student detail"); const studentPath = await cdp.eval("location.pathname");
  await cdp.screenshot("student-detail-390");

  await cdp.eval(`location.assign(${JSON.stringify(`http://127.0.0.1:5174${classPath}`)})`); await cdp.wait("document.body.innerText.includes('Ghi danh')", "class reload");
  await cdp.clickText("Ghi danh"); await cdp.wait("document.querySelector('[role=dialog]') && document.body.innerText.includes('Ngày vào học')", "enrollment dialog"); await cdp.select("Học sinh", studentName); await cdp.clickDialogText("Ghi danh"); await cdp.wait("document.body.innerText.includes('Đã ghi danh học sinh')", "enrollment success"); await cdp.wait(`document.body.innerText.includes(${JSON.stringify(studentName)})`, "enrolled student");

  await cdp.eval(`location.assign(${JSON.stringify(`http://127.0.0.1:5174${studentPath}`)})`); await cdp.wait("document.body.innerText.includes('Đổi chế độ học phí')", "student reload");
  await cdp.clickText("Đổi chế độ học phí"); await cdp.wait("document.querySelector('[role=dialog]') && document.body.innerText.includes('Áp dụng từ')", "tuition dialog");
  await new Promise((resolve) => setTimeout(resolve, 350));
  const dialogFits = await cdp.eval("(() => { const r=document.querySelector('[role=dialog]').getBoundingClientRect(); return r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth; })()");
  if (!dialogFits) throw new Error("Tuition dialog does not fit the 390x844 viewport");
  await cdp.screenshot("tuition-mode-dialog-390"); await cdp.select("Chế độ", "Giá riêng"); await cdp.wait("document.body.innerText.includes('Giá riêng / 8 buổi')", "custom price input"); await cdp.setInput("Giá riêng", "1900000"); await cdp.clickDialogText("Lưu");
  await cdp.wait("document.body.innerText.includes('Đã cập nhật chế độ học phí')", "tuition success"); await cdp.send("Page.reload");
  await cdp.wait("document.body.innerText.includes('1.900.000')", "persisted custom tuition");

  await cdp.eval("location.assign('http://127.0.0.1:5174/admin/students')");
  await cdp.wait("!!document.querySelector('[data-testid=student-list-page]')", "student list filters");
  await cdp.setInput("Tìm tên", classPath.includes("classes") ? "Browser Smoke" : studentName);
  await cdp.wait(`document.body.innerText.includes(${JSON.stringify(studentName)})`, "student search by class");
  await cdp.clickText("Lọc"); await cdp.wait("!!document.querySelector('[role=dialog]')", "student filter dialog");
  await cdp.selectDialog("Sắp xếp", "Tên Z–A"); await cdp.clickDialogText("Áp dụng");

  await cdp.eval(`location.assign(${JSON.stringify(`http://127.0.0.1:5174${classPath}`)})`); await cdp.wait("document.body.innerText.includes('Tạm dừng')", "class action");
  await cdp.clickText("Tạm dừng"); await cdp.wait("document.querySelector('[role=dialog]') && document.body.innerText.includes('Ngày hiệu lực')", "class pause dialog");
  await cdp.clickDialogText("Xác nhận"); await cdp.wait("document.body.innerText.includes('Đã tạm dừng lớp')", "class pause success");
  await cdp.clickLabel("Đăng xuất"); await cdp.wait("location.pathname==='/admin/login' && !localStorage.getItem('teacher-token')", "logout");
  await cdp.wait("document.body.innerText.includes('Đăng nhập') && !!document.querySelector('input[type=password]')", "login form after logout");
  await cdp.setInput("Tên đăng nhập", "smoke-e2e"); await cdp.setInput("Mật khẩu", "smoke-password-123"); await cdp.clickText("Đăng nhập");
  await cdp.wait("location.pathname.startsWith('/admin') && location.pathname!=='/admin/login' && !!localStorage.getItem('teacher-token')", "login after logout");
  await cdp.eval(`location.assign(${JSON.stringify("http://127.0.0.1:5174/admin/khong-ton-tai")})`);
  await cdp.wait("location.pathname==='/admin/khong-ton-tai' && document.body.innerText.includes('Không tìm thấy trang') && document.body.innerText.includes('Học phí')", "protected not found");
  await cdp.screenshot("admin-not-found-390");
  await cdp.eval(`location.assign(${JSON.stringify(`http://127.0.0.1:5174${classPath}`)})`);
  await cdp.wait("document.body.innerText.includes('Tạm dừng') && document.body.innerText.includes('Mở lại')", "persisted class pause after relogin");
  const overflow = await cdp.eval("document.documentElement.scrollWidth-document.documentElement.clientWidth");
  if (overflow > 1) throw new Error(`Horizontal page overflow: ${overflow}px`);
  console.log(`Browser smoke passed: core CRUD, persistence, protected 404 and logout/login; screenshots: ${artifactDir}`);
  cdp.socket.close();
} finally {
  for (const child of children.reverse()) { try { child.kill(); } catch { /* already stopped */ } }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (chromeProfile && fs.existsSync(chromeProfile)) {
    try { fs.rmSync(chromeProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }); }
    catch (error) { console.warn(`Could not remove temporary Chrome profile: ${error.message}`); }
  }
}
