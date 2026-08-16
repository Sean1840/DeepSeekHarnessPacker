// 启动 DeepSeek Harness（Web UI）。
// 启动前按 config.autoUpdate 处理更新检查：
//   off  → 直接启动（纯离线）
//   ask  → 联网且有新版本时询问用户（默认）
//   auto → 联网且有新版本时自动更新

import path from "node:path";
import { spawn } from "node:child_process";
import readline from "node:readline";
import {
  ROOT,
  banner,
  resolveNode,
  resolveDshBin,
  readConfig,
  ensureInstalled,
  installedVersion,
  networkReachable,
  latestVersion,
  compareVersions,
  runNpm,
  openBrowser,
  findFreePort,
} from "./common.js";

/** 询问用户是否更新，返回 true/false。 */
function askYesNo(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      resolve(a === "" || a === "y" || a === "yes" || a === "是");
    });
  });
}

/** 按配置执行更新检查；返回是否已执行更新（更新失败不阻断启动）。 */
async function maybeUpdate(config) {
  const current = installedVersion();
  if (!current) return;

  if (!(await networkReachable(config.registry, config.dshPackage))) {
    console.log("[提示] 离线模式：无法联网，跳过更新检查，直接启动本地预装版本。");
    console.log("");
    return;
  }

  const latest = await latestVersion(config.registry, config.dshPackage);
  if (!latest || compareVersions(latest, current) <= 0) {
    return; // 已是最新，静默启动
  }

  console.log(`检测到新版本 v${latest}（当前 v${current}）。`);

  if (config.autoUpdate === "auto") {
    console.log("按配置自动更新…");
    console.log("");
    runNpm(["install", `${config.dshPackage}@latest`], { registry: config.registry });
    return;
  }

  // 默认 ask 模式
  const yes = await askYesNo("是否立即更新到最新版？[Y/n] ");
  if (yes) {
    console.log("");
    runNpm(["install", `${config.dshPackage}@latest`], { registry: config.registry });
  } else {
    console.log("已跳过更新，使用本地版本启动。");
    console.log("");
  }
}

/** 启动 dsh web（前台长驻，继承终端）。 */
function launch(config, port) {
  const node = resolveNode();
  const dshBin = resolveDshBin();
  const dshHome = path.join(ROOT, config.homeDir);
  const url = `http://127.0.0.1:${port}`;

  console.log(`数据目录: ${dshHome}`);
  console.log(`服务地址: ${url}`);
  console.log("启动中…（按 Ctrl+C 停止）");
  console.log("首次使用请在网页「设置 → 模型」中填入 DeepSeek API Key。");
  console.log("");

  const child = spawn(node, [dshBin, "web", "--port", String(port)], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, DSH_HOME: dshHome },
  });

  if (config.openBrowser) {
    setTimeout(() => openBrowser(url), 4000);
  }

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
  child.on("error", (err) => {
    console.error(`[错误] 启动失败: ${err.message}`);
    process.exit(1);
  });
}

async function main() {
  banner();
  const config = readConfig();

  if (!ensureInstalled()) {
    process.exitCode = 1;
    return;
  }

  if (config.autoUpdate !== "off") {
    await maybeUpdate(config);
  }

  const port = await findFreePort(config.port, config.portRange);
  if (port === null) {
    console.error("");
    console.error(`[错误] 端口范围 ${config.portRange[0]}–${config.portRange[1]} 内的端口均已被占用，无法启动。`);
    console.error("       请修改 config.json 中的 portRange 扩大范围后重试。");
    console.error("");
    process.exitCode = 1;
    return;
  }
  if (port !== Number(config.port)) {
    console.log(`[提示] 首选端口 ${config.port} 不可用，已自动改用 ${port}。`);
    console.log("");
  }

  launch(config, port);
}

main();
