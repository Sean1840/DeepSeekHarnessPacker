// 手动更新：便携包程序文件（GitHub 或本地 zip）+ 询问后升级 dsh 内核。
// 不覆盖 home/（会话、凭证、已装插件），不覆盖用户改过的 config.json 项。
// 给老包打补丁时必须同时替换：update.cmd、本文件、scripts/common.js。

import { banner, readConfig, runUpdates } from "./common.js";

async function main() {
  banner();
  const config = readConfig();
  const localZip = process.argv.slice(2).join(" ").trim() || null;
  console.log("开始更新。程序文件可替换；已安装的插件不会动；dsh 内核需你同意才升级。");
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
