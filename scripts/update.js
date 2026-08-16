// 手动更新 DeepSeek Harness 到最新版（联网）。

import {
  banner,
  readConfig,
  installedVersion,
  networkReachable,
  latestVersion,
  compareVersions,
  runNpm,
} from "./common.js";

async function main() {
  banner();
  const config = readConfig();
  const current = installedVersion();

  if (!current) {
    console.error("[错误] 未检测到已安装的 DeepSeek Harness，请先运行 install.cmd。");
    process.exitCode = 1;
    return;
  }

  console.log(`当前版本: v${current}`);
  console.log("正在检测网络与最新版本…");
  console.log("");

  if (!(await networkReachable(config.registry, config.dshPackage))) {
    console.error("[提示] 当前处于离线状态，无法联网更新。");
    console.error("       请检查网络后重试，或修改 config.json 的 registry。");
    process.exitCode = 1;
    return;
  }

  const latest = await latestVersion(config.registry, config.dshPackage);
  if (!latest) {
    console.error("[错误] 无法获取最新版本信息（registry 响应异常）。");
    process.exitCode = 1;
    return;
  }

  if (compareVersions(latest, current) <= 0) {
    console.log(`已是最新版本 v${current}，无需更新。`);
    console.log("");
    return;
  }

  console.log(`发现新版本 v${latest}（当前 v${current}），开始更新…`);
  console.log("");

  const code = runNpm(["install", `${config.dshPackage}@latest`], { registry: config.registry });
  const after = installedVersion();

  if (code === 0 && after) {
    console.log("");
    console.log(`更新完成！当前版本 v${after}。`);
  } else {
    console.error("");
    console.error("[错误] 更新失败，请检查网络后重试。");
    process.exitCode = 1;
  }
}

main();
