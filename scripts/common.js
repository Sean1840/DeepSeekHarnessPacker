// DeepSeek Harness 便携版 —— 公共工具
// 运行于便携包根目录下的 scripts/ 中，__dirname 即 scripts 目录，ROOT 为其父目录。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import readline from "node:readline";
import net from "node:net";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 便携包根目录（scripts/ 的父目录）。 */
export const ROOT = path.resolve(__dirname, "..");

/** 默认配置，用户 config.json 会与其合并。 */
export const DEFAULT_CONFIG = {
  registry: "https://registry.npmjs.org",
  homeDir: "home",
  port: 20000,
  portRange: [20000, 21000], // 端口限定范围 [min, max]，首选被占用时在此范围内自动换
  autoUpdate: "ask", // ask | auto | off
  openBrowser: true,
  dshPackage: "@deepseek-ai/dsh",
  // npm dist-tag。当前上游正式 latest 仍是 0.1.2-rc.1，GitHub/npm 最新线在 alpha（0.1.5-alpha.x）。
  dshTag: "alpha",
  // 便携包自身从该 GitHub 仓库的 latest release 原地升级（不覆盖 home/ 与用户 config）。
  updateRepo: "Sean1840/DeepSeekHarnessPacker",
};

/** 打印横幅。 */
export function banner() {
  const packer = packerVersion();
  const v = installedVersion();
  console.log("==============================================");
  console.log("  DeepSeek Harness 便携版" + (packer ? ` v${packer}` : ""));
  if (v) console.log(`  dsh 版本: ${v}`);
  console.log("==============================================");
  console.log("");
}

/** 解析便携版自带的 node.exe（优先），回退系统 node。 */
export function resolveNode() {
  const bundled = path.join(ROOT, "node", "node.exe");
  if (fs.existsSync(bundled)) return bundled;
  return "node";
}

/** dsh 的入口脚本路径。 */
export function resolveDshBin() {
  return path.join(ROOT, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
}

/** 便携 node 自带的 npm-cli.js（不依赖 PATH 与 .cmd shim）。 */
export function resolveNpmCli() {
  return path.join(ROOT, "node", "node_modules", "npm", "bin", "npm-cli.js");
}

/** 读取并合并 config.json。 */
export function readConfig() {
  const cfgPath = path.join(ROOT, "config.json");
  let user = {};
  try {
    user = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } catch {
    // 配置缺失或损坏时回退默认，不阻断启动。
  }
  return { ...DEFAULT_CONFIG, ...user };
}

/** dsh 是否已安装（入口文件与版本号均存在）。 */
export function isDshInstalled() {
  return fs.existsSync(resolveDshBin()) && Boolean(installedVersion());
}

/** 读取已安装 dsh 的版本号。 */
export function installedVersion() {
  const pkgPath = path.join(ROOT, "node_modules", "@deepseek-ai", "dsh", "package.json");
  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf8")).version ?? null;
  } catch {
    return null;
  }
}

/** 拼接 registry 上某包的 dist-tag 端点（默认走配置的 dshTag）。 */
function latestUrl(registry, pkg, tag = DEFAULT_CONFIG.dshTag) {
  const distTag = String(tag || "latest").replace(/^v/, "");
  return `${normalizeRegistry(registry)}/${encodePkgSpec(pkg)}/${encodeURIComponent(distTag)}`;
}

/** npm 安装规格，如 `@deepseek-ai/dsh@alpha`。 */
export function dshInstallSpec(config = {}) {
  const pkg = config.dshPackage || DEFAULT_CONFIG.dshPackage;
  const tag = config.dshTag || DEFAULT_CONFIG.dshTag;
  return `${pkg}@${tag}`;
}

/** 对 registry 发短超时请求，判定网络是否可达（即"是否支持更新"）。 */
export async function networkReachable(
  registry,
  pkg = DEFAULT_CONFIG.dshPackage,
  tag = DEFAULT_CONFIG.dshTag,
) {
  try {
    const res = await fetch(latestUrl(registry, pkg, tag), {
      method: "GET",
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 查询 npm registry 上某包在指定 dist-tag 的版本号；失败返回 null。 */
export async function latestVersion(
  registry,
  pkg = DEFAULT_CONFIG.dshPackage,
  tag = DEFAULT_CONFIG.dshTag,
) {
  try {
    const res = await fetch(latestUrl(registry, pkg, tag), {
      method: "GET",
      signal: AbortSignal.timeout(10000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

/**
 * SemVer 比较：返回 -1（a<b）、0（相等）、1（a>b）。
 * 预发布必须小于同号正式版（0.1.1-rc.2 < 0.1.1），标识符按 SemVer 2.0 比较。
 */
export function compareVersions(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (const key of ["major", "minor", "patch"]) {
    if (pa[key] < pb[key]) return -1;
    if (pa[key] > pb[key]) return 1;
  }
  return comparePrerelease(pa.pre, pb.pre);
}

function parseSemver(v) {
  const s = String(v).trim().replace(/^v/i, "");
  const m = s.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (m) {
    return {
      major: Number(m[1]),
      minor: Number(m[2]),
      patch: Number(m[3]),
      pre: m[4] ? m[4].split(".") : null,
    };
  }
  // 非标准串：尽量拆出数字段，避免把 "rc" 当成 NaN 参与比较。
  const nums = s.split(/[.+-]/).map((x) => Number(x)).filter((n) => Number.isFinite(n));
  return { major: nums[0] ?? 0, minor: nums[1] ?? 0, patch: nums[2] ?? 0, pre: null };
}

function comparePrerelease(a, b) {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // 正式版 > 预发布
  if (b === null) return -1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (i >= a.length) return -1;
    if (i >= b.length) return 1;
    const da = /^\d+$/.test(a[i]);
    const db = /^\d+$/.test(b[i]);
    if (da && db) {
      const na = Number(a[i]);
      const nb = Number(b[i]);
      if (na < nb) return -1;
      if (na > nb) return 1;
      continue;
    }
    if (da !== db) return da ? -1 : 1; // 数字标识符 < 字母
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

/** 递归统计目录大小（字节）；目录不存在或读取失败返回 0。 */
function dirSizeBytes(dir) {
  let total = 0;
  try {
    const stack = [dir];
    while (stack.length) {
      const cur = stack.pop();
      for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
        const full = path.join(cur, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (entry.isFile()) total += fs.statSync(full).size;
      }
    }
  } catch {
    // 目录尚未创建或瞬时占用时按 0 处理
  }
  return total;
}

const PROGRESS_SPIN = ["◐", "◓", "◑", "◒"];
const PROGRESS_LINE_WIDTH = 76;

/**
 * 用便携 node 运行 npm（异步 Promise，resolve 退出码），带实时进度提示。
 * npm 11 起自带进度条默认关闭（progress=false），下载阶段几乎无输出，
 * 用户容易误以为卡死。这里自行渲染状态行：耗时 + 下载量/速率（统计
 * .npm-cache 目录增长，缓存与日志都在包目录内）+ 请求数；npm 的
 * warn/error 即时透传，结束后输出 npm 摘要（如 added N packages）。
 */
export function runNpm(args, { registry } = {}) {
  return new Promise((resolve) => {
    const node = resolveNode();
    const npmCli = resolveNpmCli();
    // 缓存与日志都写到包目录内：删除目录即可彻底清理，不在 %LOCALAPPDATA%\npm-cache 留残留。
    const cacheDir = path.join(ROOT, ".npm-cache");
    // --loglevel http：让 npm 输出 fetch 行，用于统计请求进度
    const fullArgs = [...args, "--no-audit", "--no-fund", "--cache", cacheDir, "--logs-max", "5", "--loglevel", "http"];
    if (registry) fullArgs.push("--registry", registry);

    const started = Date.now();
    let fetches = 0;
    let spin = 0;
    let cacheStart = dirSizeBytes(cacheDir);
    let cachePrev = cacheStart;
    let rate = 0; // 最近 2 秒下载字节速率

    const render = () => {
      const sec = Math.floor((Date.now() - started) / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      const cacheNow = dirSizeBytes(cacheDir);
      rate = (cacheNow - cachePrev) / 2;
      cachePrev = cacheNow;
      const dlMb = ((cacheNow - cacheStart) / 1048576).toFixed(1);
      const rateKb = Math.round(rate / 1024);
      const msg = `[更新中] 耗时 ${mm}:${ss} ${PROGRESS_SPIN[spin++ % PROGRESS_SPIN.length]} 下载 ${dlMb} MB（${rateKb} KB/s） 请求 ${fetches}`;
      process.stdout.write("\r" + msg + " ".repeat(Math.max(0, PROGRESS_LINE_WIDTH - msg.length)));
    };

    console.log("");
    console.log("正在联网安装/更新依赖，视网速可能需要数分钟，请勿关闭窗口。");
    const timer = setInterval(render, 2000);

    const child = spawn(node, [npmCli, ...fullArgs], {
      cwd: ROOT,
      env: {
        ...process.env,
        NO_COLOR: "1",
        FORCE_COLOR: "0",
        npm_config_cache: cacheDir,
        npm_config_progress: "false",
      },
    });

    // stdout：npm 的摘要/树状输出，收尾时打印最后几行
    let stdoutTail = [];
    child.stdout.on("data", (buf) => {
      stdoutTail = [...stdoutTail.slice(-16), ...buf.toString().split("\n")];
    });

    // stderr：http 行（fetch 计入请求数、cache 行忽略防刷屏）；warn/notice/error 即时透传
    child.stderr.on("data", (buf) => {
      for (const line of buf.toString().split("\n")) {
        const t = line.trim();
        if (/^npm http /.test(t)) {
          if (t.startsWith("npm http fetch GET")) fetches++;
        } else if (t) {
          process.stdout.write("\r" + " ".repeat(PROGRESS_LINE_WIDTH) + "\r" + line + "\n");
        }
      }
    });

    const finish = (code) => {
      clearInterval(timer);
      process.stdout.write("\r" + " ".repeat(PROGRESS_LINE_WIDTH) + "\r");
      for (const line of stdoutTail) if (line.trim()) console.log(line);
      resolve(code ?? 1);
    };
    child.on("close", finish);
    child.on("error", (err) => {
      console.error(`[错误] 无法启动 npm: ${err.message}`);
      finish(1);
    });
  });
}

/** 启动前检查：dsh 是否可用；不可用则打印提示并返回 false。 */
export function ensureInstalled() {
  if (isDshInstalled()) return true;
  console.error("");
  console.error("[错误] 未检测到 DeepSeek Harness（node_modules 缺失或损坏）。");
  console.error("       请先双击 install.cmd 联网安装/修复，然后再启动。");
  console.error("");
  return false;
}

/** 用系统默认浏览器打开指定 URL。 */
export function openBrowser(url) {
  try {
    spawnSync("cmd", ["/c", "start", "", url], { stdio: "ignore", windowsHide: true });
  } catch {
    // 打开浏览器失败不影响主流程。
  }
}

/** 应尽量避免的「业界常用」端口；自动选端口时会跳过这些。 */
export const COMMON_PORTS = new Set([
  // 网络基础服务
  21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 465, 587, 631, 993, 995,
  // 数据库 / 缓存 / 中间件
  1433, 1521, 3306, 5432, 5984, 6379, 9200, 9300, 11211, 15672, 27017, 27018,
  // 开发 / Web 常用
  1080, 3000, 3001, 4000, 4200, 5000, 5001, 7000, 7077, 8000, 8001, 8080, 8081,
  8088, 8180, 8443, 8888, 9000, 9090, 9418,
  // 容器 / 远程桌面 / 其他
  2375, 2376, 3389, 5900, 11434, 50070,
  // dsh 旧默认端口，避免与用户已有实例冲突
  3080,
]);

/** 判断某个端口当前是否空闲（尝试监听后立即关闭）。 */
export function isPortFree(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => {
      srv.close();
      resolve(true);
    });
    srv.listen(port, host);
  });
}

/**
 * 在限定范围内挑选一个可用端口：优先 preferred（若在范围内且非常用端口），
 * 随后按 min→max 顺序扫描并跳过「常用端口」黑名单；全部被占用则返回 null。
 */
export async function findFreePort(preferred, range = DEFAULT_CONFIG.portRange, host = "127.0.0.1") {
  const lo = Math.min(Number(range[0]), Number(range[1]));
  const hi = Math.max(Number(range[0]), Number(range[1]));
  const candidates = [];
  const seen = new Set();
  const push = (p) => {
    if (p >= lo && p <= hi && !COMMON_PORTS.has(p) && !seen.has(p)) {
      seen.add(p);
      candidates.push(p);
    }
  };
  push(Number(preferred));
  for (let p = lo; p <= hi; p++) push(p);

  for (const p of candidates) {
    if (await isPortFree(p, host)) return p;
  }
  return null;
}

function normalizeRegistry(registry) {
  return String(registry).replace(/\/+$/, "");
}

/** 将作用域包名 @scope/name 转成 registry 路径可用的 @scope%2Fname。 */
function encodePkgSpec(pkg) {
  return pkg.replace("/", "%2F");
}

/** 便携包自身版本（根目录 package.json，与 GitHub release tag 对齐）。 */
export function packerVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version ?? null;
  } catch {
    return null;
  }
}

/** 控制台是/否。defaultYes=true 时回车为是。 */
export function askYesNo(question, defaultYes = true) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === "") return resolve(defaultYes);
      resolve(a === "y" || a === "yes" || a === "是");
    });
  });
}

/** 控制台读一行（可空）。 */
export function askText(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function normalizeUserPath(p) {
  let s = String(p || "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return path.resolve(s);
}

const GITHUB_HEADERS = {
  accept: "application/vnd.github+json",
  "user-agent": "DeepSeekHarness-portable",
};

/**
 * 查询 GitHub latest release。返回 { version, name, url, size } 或 null。
 * 资源名匹配 DeepSeekHarness-v*.zip，排除 Finance。
 */
export async function latestPackerRelease(config = {}) {
  const repo = config.updateRepo || DEFAULT_CONFIG.updateRepo;
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  const res = await fetch(url, { headers: GITHUB_HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
  const data = await res.json();
  const version = String(data.tag_name || "").replace(/^v/i, "");
  if (!version) throw new Error("GitHub release 无 tag");
  const asset = (data.assets || []).find(
    (a) => /^DeepSeekHarness-v.+\.zip$/i.test(a.name) && !/finance/i.test(a.name),
  );
  if (!asset?.browser_download_url) throw new Error("release 中没有便携包 zip");
  return { version, name: asset.name, url: asset.browser_download_url, size: Number(asset.size) || 0 };
}

/** 带进度下载到 dest。 */
export async function downloadFile(url, dest) {
  const res = await fetch(url, {
    headers: { "user-agent": "DeepSeekHarness-portable", accept: "application/octet-stream" },
    redirect: "follow",
    signal: AbortSignal.timeout(900000),
  });
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const fh = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  let got = 0;
  const t0 = Date.now();
  let lastRender = 0;
  const paint = () => {
    const sec = Math.max(0.5, (Date.now() - t0) / 1000);
    const mb = (got / 1048576).toFixed(1);
    const tot = total ? (total / 1048576).toFixed(1) : "?";
    const pct = total ? `${Math.min(100, Math.floor((got / total) * 100))}%`.padStart(4) : "    ";
    const rate = (got / sec / 1048576).toFixed(1);
    const msg = `[下载] ${pct}  ${mb}/${tot} MB  ${rate} MB/s`;
    process.stdout.write("\r" + msg + " ".repeat(Math.max(0, 72 - msg.length)));
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fh.write(Buffer.from(value));
      got += value.byteLength;
      if (Date.now() - lastRender > 400) {
        lastRender = Date.now();
        paint();
      }
    }
  } finally {
    await new Promise((resolve, reject) => {
      fh.end(() => resolve());
      fh.on("error", reject);
    });
    process.stdout.write("\r" + " ".repeat(72) + "\r");
  }
}

function psQuote(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

/** 解压 zip 到 destDir（优先 tar，失败再试 PowerShell Expand-Archive）。 */
export function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const tar = spawnSync("tar", ["-xf", zipPath, "-C", destDir], { stdio: "ignore", windowsHide: true });
  if (tar.status === 0) return;
  const ps = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `Expand-Archive -LiteralPath ${psQuote(zipPath)} -DestinationPath ${psQuote(destDir)} -Force`],
    { stdio: "inherit", windowsHide: true },
  );
  if (ps.status !== 0) throw new Error("解压失败（tar / PowerShell 均不可用）");
}

function findPayloadRoot(extractDir) {
  if (fs.existsSync(path.join(extractDir, "scripts", "start.js"))) return extractDir;
  for (const name of fs.readdirSync(extractDir)) {
    const p = path.join(extractDir, name);
    if (fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, "scripts", "start.js"))) return p;
  }
  throw new Error("压缩包里找不到便携包内容（缺少 scripts/start.js）");
}

const LOCKED = new Set(["EBUSY", "EPERM", "EACCES"]);

function copyTreeSkipLocked(src, dst, skipped, rel = "") {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) copyTreeSkipLocked(s, d, skipped, childRel);
    else {
      try {
        fs.copyFileSync(s, d);
      } catch (err) {
        if (LOCKED.has(err.code)) skipped.push(childRel);
        else throw err;
      }
    }
  }
}

function mergeConfigJson(incomingPath) {
  const cfgPath = path.join(ROOT, "config.json");
  let incoming = {};
  let user = {};
  try {
    incoming = JSON.parse(fs.readFileSync(incomingPath, "utf8"));
  } catch {
    return;
  }
  try {
    user = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } catch {
    user = {};
  }
  const out = { ...incoming, ...user };
  for (const [k, v] of Object.entries(incoming)) {
    if (!(k in user)) out[k] = v;
  }
  fs.writeFileSync(cfgPath, JSON.stringify(out, null, 2) + "\n");
}

function coercePluginVer(v) {
  const s = String(v || "").trim().replace(/^[\^~>=<\s]+/, "");
  return /^\d+\.\d+/.test(s) ? s : null;
}

function readJsonSilent(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function userPluginVersions() {
  const homeName = readConfig().homeDir || "home";
  const pkg = readJsonSilent(path.join(ROOT, homeName, "profiles", "web", "package.json"));
  return pkg?.dependencies && typeof pkg.dependencies === "object" ? pkg.dependencies : {};
}

function payloadPluginVersions(payload) {
  const pkg = readJsonSilent(path.join(payload, "home", "profiles", "web", "package.json"));
  return pkg?.dependencies && typeof pkg.dependencies === "object" ? pkg.dependencies : {};
}

function payloadDshVersion(payload) {
  const pkg = readJsonSilent(path.join(payload, "node_modules", "@deepseek-ai", "dsh", "package.json"));
  return pkg?.version ? String(pkg.version) : null;
}

/** 只提示，不改用户插件。压缩包仅作为「本包基础版本」对照。 */
function hintStalePlugins(payload) {
  const user = userPluginVersions();
  const bundled = payloadPluginVersions(payload);
  const stale = [];
  for (const [name, packVer] of Object.entries(bundled)) {
    const have = user[name];
    if (!have) continue;
    const pack = coercePluginVer(packVer);
    const cur = coercePluginVer(have);
    if (!pack || !cur) continue;
    if (compareVersions(pack, cur) > 0) stale.push({ name, have: cur, pack });
  }
  console.log("你已安装的插件不会随本次更新被替换，请自行在网页「设置 → 插件」里升级。");
  if (stale.length) {
    console.log("以下插件比本包提供的基础版本旧，可以考虑升级：");
    for (const s of stale.slice(0, 12)) {
      console.log(`  ${s.name}  当前 ${s.have}  → 本包 ${s.pack}`);
    }
    if (stale.length > 12) console.log(`  …另有 ${stale.length - 12} 个`);
  }
  const extra = Object.keys(user).filter((k) => !(k in bundled));
  if (extra.length) {
    const show = extra.slice(0, 8).join("、");
    console.log(`你自行安装的插件未改动：${show}${extra.length > 8 ? " 等" : ""}`);
  }
}

function overlayDshKernel(payload) {
  const src = path.join(payload, "node_modules");
  const dst = path.join(ROOT, "node_modules");
  if (!fs.existsSync(src)) throw new Error("压缩包内没有 dsh 内核（node_modules）");
  console.log("正在替换 dsh 内核…");
  fs.cpSync(src, dst, { recursive: true, force: true });
  const lock = path.join(payload, "package-lock.json");
  if (fs.existsSync(lock)) {
    try {
      fs.copyFileSync(lock, path.join(ROOT, "package-lock.json"));
    } catch {
      /* 锁文件拷贝失败不影响内核 */
    }
  }
}

/** 探测 GitHub 下载页是否可达（比 ICMP ping 更接近真实下载；很多网络禁 ping 但仍能打开网页）。 */
export async function isReleasePageReachable(config = {}) {
  const repo = config.updateRepo || DEFAULT_CONFIG.updateRepo;
  const page = `https://github.com/${repo}/releases/latest`;
  try {
    const res = await fetch(page, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "DeepSeekHarness-portable", accept: "text/html" },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function listZipEntries(zipPath) {
  const tar = spawnSync("tar", ["-tf", zipPath], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  if (tar.status === 0 && tar.stdout) {
    return tar.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  const ps = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z = [System.IO.Compression.ZipFile]::OpenRead(${psQuote(zipPath)}); try { $z.Entries | ForEach-Object { $_.FullName } } finally { $z.Dispose() }`,
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, windowsHide: true },
  );
  if (ps.status === 0 && ps.stdout) {
    return ps.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  throw new Error("无法读取压缩包目录（文件可能损坏或不是 zip）");
}

function assertSafeZipEntries(entries) {
  for (const e of entries) {
    const n = e.replace(/\\/g, "/");
    if (!n) continue;
    if (n.split("/").filter(Boolean).includes("..")) throw new Error(`压缩包含非法路径（..）：${e}`);
    if (/^[a-zA-Z]:/.test(n) || n.startsWith("/") || n.startsWith("\\\\")) {
      throw new Error(`压缩包含绝对路径：${e}`);
    }
  }
}

function isInsideDir(parent, child) {
  const p = path.resolve(parent);
  const c = path.resolve(child);
  return c === p || c.startsWith(p + path.sep);
}

function assertExtractInside(root) {
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (!isInsideDir(root, full)) throw new Error(`解压结果越出目录：${full}`);
      if (entry.isDirectory()) stack.push(full);
    }
  }
}

const REQUIRED_PAYLOAD_FILES = [
  "package.json",
  "config.json",
  "start.cmd",
  "update.cmd",
  "install.cmd",
  "scripts/start.js",
  "scripts/update.js",
  "scripts/common.js",
  "scripts/install.js",
  "node/node.exe",
  "node_modules/@deepseek-ai/dsh/package.json",
];

function assertOurPortablePayload(payload) {
  if (fs.existsSync(path.join(payload, "hithink-finance.cmd"))) {
    throw new Error("这是已下线的金融特化版压缩包，请使用标准版 DeepSeekHarness-v*.zip");
  }
  for (const rel of REQUIRED_PAYLOAD_FILES) {
    if (!fs.existsSync(path.join(payload, ...rel.split("/")))) {
      throw new Error(`不是本项目便携包（缺少 ${rel}）`);
    }
  }
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(payload, "package.json"), "utf8"));
  } catch {
    throw new Error("压缩包内 package.json 无法解析");
  }
  if (pkg.name !== "deepseek-harness-portable") {
    throw new Error(`不是本项目便携包（name=${pkg.name || "?"}，期望 deepseek-harness-portable）`);
  }
  if (!pkg.version || !/^\d+\.\d+\.\d+/.test(String(pkg.version))) {
    throw new Error("压缩包版本号无效");
  }
  let dshPkg;
  try {
    dshPkg = JSON.parse(
      fs.readFileSync(path.join(payload, "node_modules", "@deepseek-ai", "dsh", "package.json"), "utf8"),
    );
  } catch {
    throw new Error("压缩包内未找到 @deepseek-ai/dsh");
  }
  if (dshPkg.name !== "@deepseek-ai/dsh") {
    throw new Error("压缩包内 dsh 包名不匹配");
  }
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(path.join(payload, "config.json"), "utf8"));
  } catch {
    throw new Error("压缩包内 config.json 无法解析");
  }
  if (cfg.dshPackage && cfg.dshPackage !== "@deepseek-ai/dsh") {
    throw new Error("压缩包 config.json 的 dshPackage 不是 @deepseek-ai/dsh");
  }
  const common = fs.readFileSync(path.join(payload, "scripts", "common.js"), "utf8");
  if (!common.includes("DeepSeek Harness 便携版")) {
    throw new Error("压缩包脚本不是本项目便携版管理器");
  }
  const startCmd = fs.readFileSync(path.join(payload, "start.cmd"), "utf8");
  if (!/scripts\\start\.js/i.test(startCmd)) {
    throw new Error("start.cmd 入口不匹配");
  }
  const nodeExe = path.join(payload, "node", "node.exe");
  if (fs.statSync(nodeExe).size < 1024 * 1024) {
    throw new Error("压缩包内 node.exe 异常（文件过小）");
  }
  return { version: String(pkg.version), name: pkg.name };
}

/** 列出便携目录内现成的标准版 zip（方便离线用户把包放在 start.cmd 旁边）。 */
function findSidecarZips() {
  const out = [];
  try {
    for (const f of fs.readdirSync(ROOT)) {
      if (/^DeepSeekHarness-v\d+\.\d+\.\d+.*\.zip$/i.test(f) && !/finance/i.test(f)) {
        out.push(path.join(ROOT, f));
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

/**
 * 校验并解压便携包 zip。失败抛错，不碰当前安装目录。
 * 检查：扩展名、金融版排除、zip-slip、必要文件、package.json 身份、dsh 包名、管理器脚本标记。
 */
export function inspectAndExtractPortableZip(zipPath, extractDir) {
  const resolved = normalizeUserPath(zipPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`找不到文件：${resolved}`);
  }
  if (!resolved.toLowerCase().endsWith(".zip")) {
    throw new Error("只接受 .zip 压缩包");
  }
  if (/finance/i.test(path.basename(resolved))) {
    throw new Error("这是金融特化版文件名，请使用标准版 DeepSeekHarness-v*.zip");
  }
  const entries = listZipEntries(resolved);
  if (!entries.length) throw new Error("压缩包是空的");
  assertSafeZipEntries(entries);
  fs.mkdirSync(extractDir, { recursive: true });
  extractZip(resolved, extractDir);
  assertExtractInside(extractDir);
  const payload = findPayloadRoot(extractDir);
  if (!isInsideDir(extractDir, payload)) throw new Error("解压根目录异常");
  const meta = assertOurPortablePayload(payload);
  return { zipPath: resolved, payload, version: meta.version };
}

function overlayPayload(payload) {
  const skipped = [];
  // home：用户数据与插件，永不覆盖。
  // node_modules：dsh 内核，须用户同意后再 overlayDshKernel。
  const skipTop = new Set(["home", "config.json", ".update", ".npm-cache", "node_modules", "package-lock.json"]);
  for (const entry of fs.readdirSync(payload, { withFileTypes: true })) {
    if (skipTop.has(entry.name)) continue;
    const s = path.join(payload, entry.name);
    const d = path.join(ROOT, entry.name);
    if (entry.name === "node") {
      copyTreeSkipLocked(s, d, skipped, "node");
      continue;
    }
    if (entry.isDirectory()) {
      fs.cpSync(s, d, { recursive: true, force: true });
    } else {
      try {
        fs.copyFileSync(s, d);
      } catch (err) {
        if (LOCKED.has(err.code)) skipped.push(entry.name);
        else throw err;
      }
    }
  }
  const incomingCfg = path.join(payload, "config.json");
  if (fs.existsSync(incomingCfg)) mergeConfigJson(incomingCfg);
  if (skipped.length) {
    console.log("[提示] 以下文件正在使用，未能替换（不影响本次运行，下次更新会再试）：");
    for (const f of skipped.slice(0, 8)) console.log(`       ${f}`);
    if (skipped.length > 8) console.log(`       …另有 ${skipped.length - 8} 个`);
  }
  return skipped;
}

async function maybeUpgradeDshFromPayload(payload) {
  const zipDsh = payloadDshVersion(payload);
  const current = installedVersion();
  if (!zipDsh || !current) return null;
  if (compareVersions(zipDsh, current) <= 0) return null;
  console.log(`压缩包内 dsh 内核为 v${zipDsh}（当前 v${current}）。`);
  if (!(await askYesNo("是否升级 dsh 内核？同意后才替换。[Y/n] "))) {
    console.log("已跳过 dsh 内核升级。");
    return null;
  }
  overlayDshKernel(payload);
  const after = installedVersion();
  console.log(`dsh 内核已更新到 v${after}。`);
  return after;
}

/**
 * 把 release zip 原地覆盖到当前便携目录。
 * release.zipPath 有值则跳过下载，只用本地包（仍走同一套校验）。
 */
export async function installPackerRelease(release) {
  const work = path.join(ROOT, ".update");
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const extractDir = path.join(work, "extract");
  try {
    let zipPath = release.zipPath;
    if (!zipPath) {
      zipPath = path.join(work, release.name || "portable.zip");
      console.log(`正在下载 ${release.name}…`);
      await downloadFile(release.url, zipPath);
    } else {
      zipPath = normalizeUserPath(zipPath);
      console.log(`使用本地压缩包：${zipPath}`);
    }
    console.log("正在校验压缩包…");
    const meta = inspectAndExtractPortableZip(zipPath, extractDir);
    console.log("正在替换程序文件（不改你的插件；会话和 Key 会保留）…");
    overlayPayload(meta.payload);
    hintStalePlugins(meta.payload);
    const dsh = await maybeUpgradeDshFromPayload(meta.payload);
    console.log(`便携包已更新到 v${meta.version}。`);
    return { packer: meta.version, dsh };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

async function promptLocalZipPath() {
  const sidecar = findSidecarZips();
  if (sidecar.length === 1) {
    console.log(`在本目录发现：${path.basename(sidecar[0])}`);
    if (await askYesNo("是否用这个本地压缩包更新？[Y/n] ")) return sidecar[0];
  } else if (sidecar.length > 1) {
    console.log("本目录有多个压缩包，请指定其中一个完整路径：");
    for (const p of sidecar) console.log(`  ${p}`);
  }
  const typed = await askText("请输入本机 DeepSeekHarness-v*.zip 的完整路径（回车跳过）：\n> ");
  return typed || null;
}

async function applyLocalZip(zipPath, cur) {
  const work = path.join(ROOT, ".update");
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const extractDir = path.join(work, "extract");
  try {
    console.log("正在校验压缩包…");
    const meta = inspectAndExtractPortableZip(zipPath, extractDir);
    const cmp = compareVersions(meta.version, cur);
    if (cmp === 0) {
      console.log(`该压缩包版本 v${meta.version} 与当前相同，跳过程序文件替换。`);
      hintStalePlugins(meta.payload);
      const dsh = await maybeUpgradeDshFromPayload(meta.payload);
      return dsh ? { packer: null, dsh } : null;
    }
    if (cmp < 0) {
      console.log(`该压缩包是 v${meta.version}，比当前 v${cur} 更旧。`);
      if (!(await askYesNo("仍要用它覆盖当前版本？[y/N] ", false))) {
        console.log("已取消。");
        return null;
      }
    } else {
      console.log(`校验通过：标准便携包 v${meta.version}（当前 v${cur}）。`);
    }
    console.log("正在替换程序文件（不改你的插件；会话和 Key 会保留）…");
    overlayPayload(meta.payload);
    hintStalePlugins(meta.payload);
    const dsh = await maybeUpgradeDshFromPayload(meta.payload);
    console.log(`便携包已更新到 v${meta.version}。`);
    return { packer: meta.version, dsh };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/**
 * 便携包自更新 + dsh 引擎更新。
 * interactive=true 时询问是否更新；update.cmd 传 false 表示确认更新。
 * 不能访问 GitHub 下载页时，改为使用本地 zip（参数 / 旁路文件 / 手动输入路径）。
 */
export async function runUpdates(config, { interactive = false, allowLocalPrompt = false, localZip = null } = {}) {
  const result = { packer: null, dsh: null };
  const cur = packerVersion() || "0.0.0";

  try {
    if (localZip) {
      const applied = await applyLocalZip(localZip, cur);
      if (applied) {
        result.packer = applied.packer;
        if (applied.dsh) result.dsh = applied.dsh;
        config = readConfig();
      }
    } else {
      console.log("正在检测能否访问 GitHub 下载页…");
      const online = await isReleasePageReachable(config);
      if (online) {
        const latest = await latestPackerRelease(config);
        if (latest && compareVersions(latest.version, cur) > 0) {
          console.log(`检测到便携包新版本 v${latest.version}（当前 v${cur}）。`);
          console.log("会自动替换程序文件；对话记录和 API Key 仍在 home 目录，不用手动拷文件。");
          if (latest.size) {
            console.log(`需联网下载约 ${(latest.size / 1048576).toFixed(0)} MB，请保持窗口打开。`);
          }
          const go = interactive ? await askYesNo("是否立即更新便携包？[Y/n] ") : true;
          if (go) {
            try {
              const applied = await installPackerRelease(latest);
              result.packer = applied.packer;
              if (applied.dsh) result.dsh = applied.dsh;
              config = readConfig();
            } catch (err) {
              console.log(`在线下载失败：${err.message}`);
              if (allowLocalPrompt) {
                const p = await promptLocalZipPath();
                if (p) {
                  const applied = await applyLocalZip(p, cur);
                  if (applied) {
                    result.packer = applied.packer;
                    if (applied.dsh) result.dsh = applied.dsh;
                    config = readConfig();
                  }
                }
              }
            }
          } else {
            console.log("已跳过便携包更新。");
          }
        }
      } else {
        console.log("无法访问 GitHub 下载页，当前不能在线下载。");
        if (allowLocalPrompt) {
          const p = await promptLocalZipPath();
          if (p) {
            const applied = await applyLocalZip(p, cur);
            if (applied) {
              result.packer = applied.packer;
              if (applied.dsh) result.dsh = applied.dsh;
              config = readConfig();
            }
          } else {
            console.log("未提供本地压缩包，跳过便携包更新。");
            console.log("也可把 zip 放到本目录后重试，或执行：update.cmd 路径\\DeepSeekHarness-v*.zip");
          }
        } else {
          console.log("启动时自动更新已跳过。请双击 update.cmd，或把 zip 拖到 update.cmd 上。");
        }
      }
    }
  } catch (err) {
    console.log(`[提示] 便携包更新失败：${err.message}`);
    console.log("       不会改动当前安装。可换一个标准版 DeepSeekHarness-v*.zip 再试。");
  }
  console.log("");

  const current = installedVersion();
  if (!current) return result;
  if (!(await networkReachable(config.registry, config.dshPackage, config.dshTag))) {
    if (!result.packer) {
      console.log("[提示] 离线模式：无法联网更新 dsh，使用本地版本。");
      console.log("");
    }
    return result;
  }
  const latestDsh = await latestVersion(config.registry, config.dshPackage, config.dshTag);
  if (!latestDsh || compareVersions(latestDsh, current) <= 0) return result;

  console.log(`检测到 dsh 内核新版本 v${latestDsh}（当前 v${current}）。`);
  console.log("插件不会随内核一起改；只有你同意才会替换 dsh。");
  if (!(await askYesNo("是否升级 dsh 内核？同意后才替换。[Y/n] "))) {
    console.log("已跳过 dsh 内核升级。");
    console.log("");
    return result;
  }
  const code = await runNpm(["install", dshInstallSpec(config)], { registry: config.registry });
  result.dsh = installedVersion();
  if (code !== 0) {
    console.error("");
    console.error("[错误] dsh 更新失败，请检查网络后重试。");
  } else {
    console.log("");
    console.log(`dsh 内核已更新到 v${result.dsh}。`);
  }
  console.log("");
  return result;
}
