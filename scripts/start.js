// 启动 DeepSeek Harness（Web UI）。
// 启动前按 config.autoUpdate 处理更新检查：
//   off  → 直接启动（纯离线）
//   ask  → 联网且有新版本时询问用户（默认）
//   auto → 联网且有新版本时自动更新

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
} from "./common.js";

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

  // dsh web 默认也会打开浏览器；这里由便携包按选中的端口统一打开，避免弹两个窗口。
  const child = spawn(node, [dshBin, "web", "--port", String(port), "--no-open"], {
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

  launch(config, port);
}

main();
