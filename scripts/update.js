// 整体升级本项目便携包：GitHub / 本地 zip 替换程序文件，zip 内 dsh 需同意才换。
// 不从 npm 另装内核（那是 start.cmd 的可选检查）。
// 不覆盖 home/（会话、凭证、已装插件），不覆盖用户改过的 config.json 项。
// 内核升级且基础插件落后时，再问是否刷新本包基础插件（用户 extras 保留）。
// 给老包打补丁：解压 GitHub Release 的 DeepSeekHarness-updater-v*.zip 到老包根目录，
// 再把完整 DeepSeekHarness-v*.zip 拖到 update.cmd 上。不要把 updater 小包拖到脚本上。

import { banner, readConfig, runUpdates } from "./common.js";

async function main() {
  banner();
  const config = readConfig();
  const localZip = process.argv.slice(2).join(" ").trim() || null;
  console.log("开始整体升级便携包。程序文件来自本项目 zip；已安装的插件默认不动；zip 内 dsh 和基础插件需你同意才换。");
  if (localZip) console.log(`指定本地压缩包：${localZip}`);
  console.log("");
  const result = await runUpdates(config, {
    interactive: false,
    allowLocalPrompt: true,
    localZip,
    packer: true,
    dshNpm: false,
  });
  if (result.packer) console.log(`便携包：v${result.packer}`);
  if (result.dsh) console.log(`dsh：v${result.dsh}`);
  if (!result.packer && !result.dsh) {
    console.log("已是最新，无需更新。");
  }
  console.log("");
}

main();
