// DeepSeek Harness 便携版 —— 公共工具
// 运行于便携包根目录下的 scripts/ 中，__dirname 即 scripts 目录，ROOT 为其父目录。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
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
};

/** 打印横幅。 */
export function banner() {
  const v = installedVersion();
  console.log("==============================================");
  console.log("  DeepSeek Harness 便携版");
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

/** 拼接 registry 上某包的 `/latest` 端点。 */
function latestUrl(registry, pkg) {
  return `${normalizeRegistry(registry)}/${encodePkgSpec(pkg)}/latest`;
}

/** 对 registry 发短超时请求，判定网络是否可达（即"是否支持更新"）。 */
export async function networkReachable(registry, pkg = DEFAULT_CONFIG.dshPackage) {
  try {
    const res = await fetch(latestUrl(registry, pkg), {
      method: "GET",
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 查询 npm registry 上某包的最新版本号；失败返回 null。 */
export async function latestVersion(registry, pkg = DEFAULT_CONFIG.dshPackage) {
  try {
    const res = await fetch(latestUrl(registry, pkg), {
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
 * 简单语义化版本比较：返回 -1（a<b）、0（相等）、1（a>b）。
 * 支持形如 0.1.0-rc.6 的预发布版本（数字段相同视为相等）。
 */
export function compareVersions(a, b) {
  const pa = String(a).split(/[.+-]/).map((x) => (x ? Number(x) : 0));
  const pb = String(b).split(/[.+-]/).map((x) => (x ? Number(x) : 0));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

/** 用便携 node 运行 npm（同步、透传 stdio），返回退出码。 */
export function runNpm(args, { registry } = {}) {
  const node = resolveNode();
  const npmCli = resolveNpmCli();
  // 缓存与日志都写到包目录内：删除目录即可彻底清理，不在 %LOCALAPPDATA%\npm-cache 留残留。
  const cacheDir = path.join(ROOT, ".npm-cache");
  const fullArgs = [...args, "--no-audit", "--no-fund", "--cache", cacheDir, "--logs-max", "5"];
  if (registry) fullArgs.push("--registry", registry);
  const res = spawnSync(node, [npmCli, ...fullArgs], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, NO_COLOR: "1", npm_config_cache: cacheDir },
  });
  return res.status ?? 1;
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
