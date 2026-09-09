// 打包脚本（仅开发者在本机运行）：产出可分发的便携版 zip。
// 步骤：下载便携 Node.js → 复制管理器与模板 → 预装 dsh（离线可用）→ 校验 → 打包。
// 用法：node scripts/build.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { deflateRawSync } from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const DIST = path.join(REPO, "dist");
const STAGE = path.join(DIST, "DeepSeekHarness");
const TMP = path.join(DIST, ".tmp");

// 可配置项
const NODE_MAJOR = 24; // 打包的 Node.js 主版本（LTS）
// Node 下载源，按顺序尝试（默认优先国内镜像，失败回退官方）。
const NODE_DIST_BASES = [
  process.env.NODE_DIST_BASE || "https://npmmirror.com/mirrors/node",
  "https://nodejs.org/dist",
].filter(Boolean);
// 0.1.5-alpha 依赖树在 npmmirror 上不完整（缺 dsh-base 等同版本），构建默认走官方源。
const NPM_REGISTRY = process.env.NPM_REGISTRY || "https://registry.npmjs.org";
const DSH_PACKAGE = "@deepseek-ai/dsh";
// 与便携包 config.json 的 dshTag 对齐。npm `latest` 仍是 0.1.2-rc.1，GitHub 当前线在 alpha（0.1.5-alpha.x）。
const DSH_TAG = process.env.DSH_TAG || "alpha";

const MANAGER_FILES = ["common.js", "install.js", "update.js", "start.js"];
const TEMPLATE_DIR = path.join(REPO, "template");

// ---- 默认预装插件（详见 doc/plugins.md）----
// dsh-market / dsh-web-all：构建时经 `dsh plugin --profile web add`（pnpm）从 npm 安装，
// 打 zip 后用户侧完全离线。构建机需要 pnpm 在 PATH 上。
// dsh-file-mount 已从默认包撤下：0.5.1 写入的会话 source.path 等字段会被
// dsh 0.1.5-alpha 的 v0-to-v1 拒绝，导致历史加载失败。
// 最终 bundles 加载顺序（固定，不随安装顺序漂移）。
const PROFILE_BUNDLES = [
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
  "@dsh-market/plugin",
  "@linxin666/dsh-web-all",
];
const NPM_DEFAULT_PLUGINS = PROFILE_BUNDLES.filter((p) => !p.startsWith("@deepseek-ai/"));

function log(msg) {
  console.log(`[build] ${msg}`);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "inherit", ...opts });
}

/** 同步睡眠（Node 无内置，用 Atomics.wait 阻塞当前线程）。 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** 删除目录并容忍杀毒/索引器的瞬时占用（EPERM 重试数次）。 */
function rmDirRetry(dir) {
  for (let i = 0; ; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      if (err.code !== "EPERM" || i >= 20) throw err;
      log(`目录被占用（${err.code}），${(i + 1) * 3} 秒后重试…`);
      sleepSync(3000);
    }
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function download(url, dest) {
  log(`下载 ${url}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  log(`已保存 ${path.basename(dest)}（${(buf.length / 1024 / 1024).toFixed(1)} MB）`);
}

/** 从指定源的 index.json 解析最新 LTS 版本号，如 v24.19.0。 */
async function resolveNodeVersion(base) {
  const index = await fetchJson(`${base}/index.json`);
  const entry = index.find((e) => e.version.startsWith(`v${NODE_MAJOR}.`) && e.lts !== false);
  if (!entry) throw new Error(`未找到 Node ${NODE_MAJOR} LTS 版本`);
  return entry.version;
}

/** 查询 dsh 版本号（DSH_VERSION 钉死，否则走 DSH_TAG dist-tag），用于在 package.json 中钉死依赖。 */
async function resolveDshVersion() {
  if (process.env.DSH_VERSION) return process.env.DSH_VERSION;
  const url = `${NPM_REGISTRY.replace(/\/+$/, "")}/${DSH_PACKAGE.replace("/", "%2F")}/${encodeURIComponent(DSH_TAG)}`;
  const data = await fetchJson(url);
  if (typeof data?.version !== "string") throw new Error(`无法解析 dsh 版本（tag=${DSH_TAG}）`);
  return data.version;
}

function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const tar = run("tar", ["--force-local", "-xf", zipPath, "-C", destDir]);
  if (tar.status === 0) return;
  log("tar 解压失败，改用 PowerShell Expand-Archive…");
  const ps = run("powershell", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`,
  ]);
  if (ps.status !== 0) throw new Error("Node.js 压缩包解压失败");
}

// ---- 用 Node 内置 zlib 直接生成真正的 .zip ----
// Windows 自带 tar（bsdtar）只能产出 tar 容器，`-a`/`--format=zip` 均不支持，
// 之前产出的 “.zip” 实际是 tar，会导致资源管理器无法解压。故改由 Node 自行打包。

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

function walkFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) out.push(full);
    }
  }
  return out.sort();
}

function zipDirectory(srcDir, zipPath, prefix = "") {
  const files = walkFiles(srcDir);
  const fd = fs.openSync(zipPath, "w");
  const central = [];
  let offset = 0;

  for (const full of files) {
    const rel = (prefix ? `${prefix}/` : "") + path.relative(srcDir, full).replace(/\\/g, "/");
    const name = Buffer.from(rel, "utf8");
    const data = fs.readFileSync(full);
    const crc = crc32(data);
    const deflated = deflateRawSync(data);
    const compressed = deflated.length < data.length ? deflated : data;
    const method = compressed === deflated ? 8 : 0; // 8=deflate, 0=store
    const { time, date } = dosDateTime(fs.statSync(full).mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    fs.writeSync(fd, local);
    fs.writeSync(fd, name);
    fs.writeSync(fd, compressed);

    const cent = Buffer.alloc(46);
    cent.writeUInt32LE(0x02014b50, 0);
    cent.writeUInt16LE(20, 4); // version made by
    cent.writeUInt16LE(20, 6); // version needed
    cent.writeUInt16LE(0, 8); // flags
    cent.writeUInt16LE(method, 10);
    cent.writeUInt16LE(time, 12);
    cent.writeUInt16LE(date, 14);
    cent.writeUInt32LE(crc, 16);
    cent.writeUInt32LE(compressed.length, 20);
    cent.writeUInt32LE(data.length, 24);
    cent.writeUInt16LE(name.length, 28);
    cent.writeUInt16LE(0, 30); // extra length
    cent.writeUInt16LE(0, 32); // comment length
    cent.writeUInt16LE(0, 34); // disk number
    cent.writeUInt16LE(0, 36); // internal attrs
    cent.writeUInt32LE(0, 38); // external attrs
    cent.writeUInt32LE(offset, 42); // local header offset
    central.push(cent, name);

    offset += 30 + name.length + compressed.length;
  }

  const centralBuf = Buffer.concat(central);
  fs.writeSync(fd, centralBuf);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // CD start disk
  eocd.writeUInt16LE(files.length, 8); // entries on disk
  eocd.writeUInt16LE(files.length, 10); // entries total
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16); // CD offset
  eocd.writeUInt16LE(0, 20); // comment length
  fs.writeSync(fd, eocd);
  fs.closeSync(fd);
}

function makeZip() {
  const pkgVer = JSON.parse(fs.readFileSync(path.join(REPO, "package.json"), "utf8")).version;
  const zipName = `DeepSeekHarness-v${pkgVer}.zip`;
  const zipPath = path.join(DIST, zipName);
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
  log(`打包 ${zipName}…`);
  zipDirectory(STAGE, zipPath, path.basename(STAGE));
  const sizeMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
  log(`完成: ${zipPath}（${sizeMb} MB）`);
}

const UPDATER_README =
  "老便携包三文件补丁\r\n" +
  "\r\n" +
  "这个小包只有更新器，不是完整程序。不要把它拖到 update.cmd 上。\r\n" +
  "\r\n" +
  "用法：\r\n" +
  "1. 解压到老便携包根目录（能看到 start.cmd 的那一层），覆盖这些文件：\r\n" +
  "     update.cmd\r\n" +
  "     scripts\\update.js\r\n" +
  "     scripts\\common.js\r\n" +
  "     scripts\\start.js\r\n" +
  "2. 再从同一个 GitHub Release 下载完整的 DeepSeekHarness-v*.zip（大约 200 MB）\r\n" +
  "3. 把那个完整 zip 拖到已经换好的 update.cmd 上\r\n" +
  "\r\n" +
  "三个文件必须一起换。只换其中一个无法升级。\r\n" +
  "对话、设置和已装插件不会被覆盖。\r\n";

/** 老包打补丁用的小 zip：不解完整便携包也能拿到 update.cmd + 两个 js。 */
function makeUpdaterZip(pkgVer) {
  const stage = path.join(DIST, ".updater-stage");
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(path.join(stage, "scripts"), { recursive: true });
  fs.copyFileSync(path.join(TEMPLATE_DIR, "update.cmd"), path.join(stage, "update.cmd"));
  fs.copyFileSync(path.join(REPO, "scripts", "update.js"), path.join(stage, "scripts", "update.js"));
  fs.copyFileSync(path.join(REPO, "scripts", "common.js"), path.join(stage, "scripts", "common.js"));
  fs.copyFileSync(path.join(REPO, "scripts", "start.js"), path.join(stage, "scripts", "start.js"));
  fs.writeFileSync(path.join(stage, "使用说明.txt"), UPDATER_README, "utf8");
  const zipName = `DeepSeekHarness-updater-v${pkgVer}.zip`;
  const zipPath = path.join(DIST, zipName);
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
  log(`打包 ${zipName}…`);
  zipDirectory(stage, zipPath, "");
  fs.rmSync(stage, { recursive: true, force: true });
  const sizeKb = (fs.statSync(zipPath).size / 1024).toFixed(1);
  log(`完成: ${zipPath}（${sizeKb} KB）`);
}

/**
 * 预装全部默认插件到便携包的 web profile（默认启用、打包进 zip 后用户离线可用）。
 * 流程：
 *  1) 写入 profile 清单（bundles 初始：内置 bundle）、cordis.patch.yml、pnpm-workspace.yaml；
 *  2) 用 stage 自带 dsh 的 `plugin --profile web add`（转发 pnpm）联网安装
 *     NPM_DEFAULT_PLUGINS（dsh-market / dsh-web-all），构建机需 pnpm 在 PATH；
 *  3) 规整 profile 清单：依赖改写为干净的精确版本（不落机器路径），bundles 固定顺序。
 * 插件的 peer 依赖（@deepseek-ai/dsh-*）在用户首次启动时由 dsh 的
 * healProfilesModuleFallback 通过 junction 回退解析到本包 node_modules，无需打进 zip。
 */
function installDefaultPlugins(stage, nodeExe) {
  const profileDir = path.join(stage, "home", "profiles", "web");
  fs.mkdirSync(path.join(profileDir, "node_modules"), { recursive: true });

  // 1) profile 清单与基础文件
  fs.writeFileSync(
    path.join(profileDir, "package.json"),
    JSON.stringify(
      {
        name: "dsh-profile-web",
        private: true,
        dependencies: {},
        dsh: { profile: { bundles: PROFILE_BUNDLES.slice(0, 2) } },
      },
      null,
      2,
    ) + "\n",
  );
  fs.writeFileSync(
    path.join(profileDir, "cordis.patch.yml"),
    "# 此 profile 的用户补丁层。内置插件（dsh-market / dsh-web-all）已作为 bundle\n" +
      "# 预装并默认启用；如需调整插件配置，在此按 loader 补丁语法覆盖。\n" +
      "# 详见包内 doc/plugins.md。\n" +
      "[]\n",
  );
  fs.writeFileSync(
    path.join(profileDir, "pnpm-workspace.yaml"),
    "packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n",
  );

  // 2) 联网安装默认插件（复用 dsh plugin 官方流程，自动 reconcile bundles）
  const dshBin = path.join(stage, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
  const pluginEnv = { ...process.env, DSH_HOME: path.join(stage, "home") };
  for (const pkg of NPM_DEFAULT_PLUGINS) {
    log(`安装默认插件 ${pkg}（pnpm，需联网，约 1 分钟）…`);
    const res = run(nodeExe, [dshBin, "plugin", "--profile", "web", "add", pkg], { env: pluginEnv });
    if (res.status !== 0) throw new Error(`默认插件 ${pkg} 安装失败（构建机需要 pnpm 在 PATH 上）`);
  }

  // 3) 规整 profile 清单：依赖用已装精确版本（不写机器路径），bundles 固定顺序
  const manifestPath = path.join(profileDir, "package.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const readVer = (p) => JSON.parse(fs.readFileSync(path.join(profileDir, "node_modules", p, "package.json"), "utf8")).version;
  manifest.dependencies = Object.fromEntries(
    PROFILE_BUNDLES.slice(2).map((p) => [p, readVer(p)]),
  );
  manifest.dsh = { profile: { bundles: PROFILE_BUNDLES } };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  log(`默认插件就绪：${PROFILE_BUNDLES.slice(2).join("、")}`);
}

async function main() {
  process.chdir(REPO); // 无论从哪调用都回到仓库根，避免 cwd 恰好在 dist 内导致无法删除
  const pkgVer = JSON.parse(fs.readFileSync(path.join(REPO, "package.json"), "utf8")).version;
  if (process.argv.includes("--updater-only")) {
    fs.mkdirSync(DIST, { recursive: true });
    makeUpdaterZip(pkgVer);
    return;
  }
  log("清理旧构建…");
  rmDirRetry(DIST);
  fs.mkdirSync(STAGE, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });

  // 1. 下载并解压便携 Node.js（多源容错）
  let nodeVersion = null;
  const nodeZip = path.join(TMP, "node-win-x64.zip");
  for (const base of NODE_DIST_BASES) {
    try {
      nodeVersion = await resolveNodeVersion(base);
      log(`便携 Node.js 版本: ${nodeVersion}（源: ${base}）`);
      await download(`${base}/${nodeVersion}/node-${nodeVersion}-win-x64.zip`, nodeZip);
      break;
    } catch (err) {
      log(`从 ${base} 下载失败: ${err.message}，尝试下一源…`);
      nodeVersion = null;
    }
  }
  if (!nodeVersion) throw new Error("所有 Node 下载源均失败");

  const nodeTmp = path.join(TMP, "node-extract");
  extractZip(nodeZip, nodeTmp);
  const inner = fs.readdirSync(nodeTmp).find((d) => d.startsWith("node-v"));
  if (!inner) throw new Error("Node 解压后未找到 node-v* 目录");
  fs.cpSync(path.join(nodeTmp, inner), path.join(STAGE, "node"), { recursive: true });
  log("便携 Node.js 已就绪");

  // 2. 复制管理器脚本与模板
  fs.mkdirSync(path.join(STAGE, "scripts"), { recursive: true });
  for (const f of MANAGER_FILES) {
    fs.copyFileSync(path.join(REPO, "scripts", f), path.join(STAGE, "scripts", f));
  }
  for (const f of fs.readdirSync(TEMPLATE_DIR)) {
    if (f === "README.finance.md") continue;
    const src = path.join(TEMPLATE_DIR, f);
    if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(STAGE, f));
  }
  const docDir = path.join(REPO, "doc");
  if (fs.existsSync(docDir)) {
    fs.cpSync(docDir, path.join(STAGE, "doc"), { recursive: true });
  }
  log("管理器、模板与 doc/ 已复制");

  // 3. 预装 dsh（用刚解压的便携 node 的 npm，保证 ABI 一致）
  const dshVersion = await resolveDshVersion();
  log(`预装 dsh 版本: ${dshVersion}`);
  fs.writeFileSync(
    path.join(STAGE, "package.json"),
    JSON.stringify(
      {
        name: "deepseek-harness-portable",
        version: pkgVer,
        private: true,
        type: "module",
        dependencies: { [DSH_PACKAGE]: dshVersion },
      },
      null,
      2,
    ),
  );

  const nodeExe = path.join(STAGE, "node", "node.exe");
  const npmCli = path.join(STAGE, "node", "node_modules", "npm", "bin", "npm-cli.js");
  // template/package-lock.json 已在步骤 2 随模板复制进 STAGE：
  // npm 11 对无 lockfile 的整树全新解析存在卡死（CPU 空转，实测 rc.2 依赖树必现），
  // 携带 lockfile 后走增量解析，几秒~一分钟内完成，且用户侧 install/update 同样受益。
  log("执行 npm install（基于内置 lockfile 的增量安装，视网速约 1~3 分钟）…");
  const installRes = run(nodeExe, [npmCli, "install", "--no-audit", "--no-fund", "--registry", NPM_REGISTRY], {
    cwd: STAGE,
  });
  if (installRes.status !== 0) throw new Error("npm install 失败");

  // npm install 可能按最新 dsh 版本更新了 lockfile：回写 template/ 供下次构建复用
  const lockSrc = path.join(STAGE, "package-lock.json");
  const lockDst = path.join(TEMPLATE_DIR, "package-lock.json");
  if (fs.existsSync(lockSrc)) {
    fs.copyFileSync(lockSrc, lockDst);
    log("已回写 template/package-lock.json（内置依赖清单，随包分发）");
  }

  // 4. 校验
  const dshBin = path.join(STAGE, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
  const check = run(nodeExe, [dshBin, "--version"], { cwd: STAGE });
  if (check.status !== 0) throw new Error("dsh 自检失败");

  // 4.5 预装默认插件（dsh-market / dsh-web-all，离线可用）
  installDefaultPlugins(STAGE, nodeExe);

  // 5. 清理临时文件并打包（完整便携包 + 老包三文件补丁）
  fs.rmSync(TMP, { recursive: true, force: true });
  makeZip();
  makeUpdaterZip(pkgVer);

  log("全部完成。");
}

main().catch((err) => {
  console.error(`[build] 失败: ${err.message}`);
  process.exit(1);
});
