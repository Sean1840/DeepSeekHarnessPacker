// 手动更新：便携包程序文件（GitHub 或本地 zip）+ 询问后升级 dsh 内核。
// 不覆盖 home/（会话、凭证、已装插件），不覆盖用户改过的 config.json 项。
// 内核升级且基础插件落后时，再问是否刷新本包基础插件（用户 extras 保留）。
// 给老包打补丁：解压 GitHub Release 的 DeepSeekHarness-updater-v*.zip 到老包根目录，
// 再把完整 DeepSeekHarness-v*.zip 拖到 update.cmd 上。不要把 updater 小包拖到脚本上。

import { banner, readConfig, runUpdates } from "./common.js";

async function main() {
  banner();
  const config = readConfig();
  const localZip = process.argv.slice(2).join(" ").trim() || null;
  console.log("开始更新。程序文件可替换；已安装的插件默认不动；dsh 内核和基础插件都需你同意才换。");
  if (localZip) console.log(`指定本地压缩包：${localZip}`);
  console.log("");
  const result = await runUpdates(config, { interactive: false, allowLocalPrompt: true, localZip });
  if (result.packer) console.log(`便携包：v${result.packer}`);
  if (result.dsh) console.log(`dsh：v${result.dsh}`);
  if (!result.packer && !result.dsh) {
    console.log("已是最新，无需更新。");
  }
  console.log("");
}

main();
