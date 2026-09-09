// 启动 DeepSeek Harness（Web UI）。
// 启动前按 config.autoUpdate 处理更新检查：
//   off  → 直接启动（纯离线）
//   ask  → 联网且有新版本时询问用户（默认）
//   auto → 联网且有新版本时自动更新
// 若 dsh 因基础插件与内核不匹配而立刻退出，询问后刷新基础插件并重试一次。

import path from "node:path";
import { spawn } from "node:child_process";
import {
  ROOT,
  banner,
  resolveNode,
  resolveDshBin,
  readConfig,
  ensureInstalled,
  openBrowser,
  findFreePort,
  runUpdates,
  recoverPluginsAfterBootFailure,
} from "./common.js";

function runDshWeb(config, port) {
  const node = resolveNode();
  const dshBin = resolveDshBin();
  const dshHome = path.join(ROOT, config.homeDir);
  const url = `http://127.0.0.1:${port}`;

  return new Promise((resolve) => {
    let log = "";
    const child = spawn(node, [dshBin, "web", "--port", String(port), "--no-open"], {
      cwd: ROOT,
      stdio: ["inherit", "pipe", "pipe"],
      env: { ...process.env, DSH_HOME: dshHome },
    });

    const feed = (buf) => {
      const s = buf.toString();
      log += s;
      if (log.length > 200000) log = log.slice(-120000);
      process.stdout.write(s);
    };
    child.stdout?.on("data", feed);
    child.stderr?.on("data", feed);

    let browserTimer = null;
    if (config.openBrowser) {
      browserTimer = setTimeout(() => openBrowser(url), 4000);
    }

    const finish = (payload) => {
      if (browserTimer) clearTimeout(browserTimer);
      resolve(payload);
    };

    child.on("error", (err) => {
      console.error(`[错误] 启动失败: ${err.message}`);
      finish({ code: 1, log, error: err, cameUp: /dsh web:\s*http:\/\//i.test(log) });
    });
    child.on("exit", (code, signal) => {
      finish({
        code: code ?? 0,
        signal,
        log,
        cameUp: /dsh web:\s*http:\/\//i.test(log),
      });
    });
  });
}

/** 启动 dsh web；插件树加载失败时允许修复一次后再拉起。 */
async function launch(config, port) {
  const dshHome = path.join(ROOT, config.homeDir);
  const url = `http://127.0.0.1:${port}`;

  console.log(`数据目录: ${dshHome}`);
  console.log(`服务地址: ${url}`);
  console.log("启动中…（按 Ctrl+C 停止）");
  console.log("首次使用请在网页「设置 → 模型」中填入 DeepSeek API Key。");
  console.log("");

  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await runDshWeb(config, port);
    if (result.cameUp || result.signal === "SIGINT" || result.signal === "SIGTERM") {
      process.exit(result.code ?? 0);
    }
    if (attempt === 0) {
      const recovered = await recoverPluginsAfterBootFailure(result.log || result.error?.message || "");
      if (recovered) {
        console.log("");
        console.log("正在重新启动…");
        console.log("");
        continue;
      }
    }
    process.exit(result.code ?? 1);
  }
}

async function main() {
  banner();
  const config = readConfig();

  if (!ensureInstalled()) {
    process.exitCode = 1;
    return;
  }

  if (config.autoUpdate !== "off") {
    await runUpdates(config, {
      interactive: config.autoUpdate !== "auto",
      allowLocalPrompt: config.autoUpdate !== "auto",
    });
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

  await launch(config, port);
}

main();
