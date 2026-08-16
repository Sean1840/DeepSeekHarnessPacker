// 安装 / 修复 DeepSeek Harness（联网）。
// 预装版已自带 node_modules，此脚本主要用于 node_modules 被删除或损坏时联网重装。

import fs from "node:fs";
import path from "node:path";
import { ROOT, banner, readConfig, isDshInstalled, installedVersion, runNpm } from "./common.js";

function ensurePackageJson() {
  const pkgPath = path.join(ROOT, "package.json");
  if (fs.existsSync(pkgPath)) return;
  fs.writeFileSync(
    pkgPath,
    JSON.stringify(
      {
        name: "deepseek-harness-portable",
        version: "1.0.0",
        private: true,
        type: "module",
        dependencies: { "@deepseek-ai/dsh": "latest" },
      },
      null,
      2,
    ),
  );
}

function main() {
  banner();
  const config = readConfig();

  if (isDshInstalled()) {
    console.log(`DeepSeek Harness 已安装，当前版本 v${installedVersion()}。`);
    console.log("如需升级到最新版，请双击 update.cmd。");
    console.log("");
    return;
  }

  console.log("未检测到 DeepSeek Harness，开始联网安装…");
  console.log(`registry: ${config.registry}`);
  console.log("首次安装约需数分钟，请耐心等待。");
  console.log("");

  ensurePackageJson();
  const code = runNpm(["install"], { registry: config.registry });

  if (code === 0 && isDshInstalled()) {
    console.log("");
    console.log(`安装成功！当前版本 v${installedVersion()}。`);
    console.log("现在可以双击 start.cmd 启动。");
  } else {
    console.error("");
    console.error("[错误] 安装失败（可能是网络问题）。");
    console.error("       可尝试：1) 检查网络；2) 修改 config.json 的 registry 为国内镜像");
    console.error('       如 https://registry.npmmirror.com 后重试。');
    process.exitCode = 1;
  }
}

main();
