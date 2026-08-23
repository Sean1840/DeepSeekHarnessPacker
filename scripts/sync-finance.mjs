// 金融特化内容升级检查（只读，不修改任何文件）。
// 用途：确认 hithink-finance Skill / CLI 是否涉及版本升级，以及如何解决。
// 用法：node scripts/sync-finance.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(REPO, "finance", "manifest.json"), "utf8"));

async function npmLatest(pkg) {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return (await res.json()).version;
  } catch {
    return null;
  }
}

const cliLatest = await npmLatest("@hithink-tech/hithink-finance-cli");
const cliDrift = cliLatest && cliLatest !== manifest.cliVersion;

console.log("=== 金融特化内容升级检查 ===");
console.log(`CLI    : 钉死 ${manifest.cliVersion} / npm 最新 ${cliLatest ?? "(查询失败)"}`);
console.log(`Skill  : vendor 于 ${manifest.skillVendoredAt}`);
console.log(`  源   : ${manifest.skillSourceRepo}  (${manifest.skillSourcePath})`);
console.log("");

if (cliDrift) {
  console.log(`[CLI 有新版] ${manifest.cliVersion} → ${cliLatest}`);
  console.log("  解决：编辑 finance/manifest.json 的 cliVersion，然后 set FLAVOR=finance && npm run build");
} else if (cliLatest) {
  console.log("[CLI] 版本无漂移");
}

console.log("[Skill] 升级解决：从源仓库同步最新 skills/hithink-finance/ 覆盖 finance/skills/hithink-finance/，");
console.log("        更新 manifest.json 的 skillVendoredAt，然后重建金融版。");
console.log("        （references/ 是接口/工具契约快照，行情数据实时性由 MCP/CLI 服务端在查询时保证，不随 skill 过期）");
console.log("[dsh]   升级 dsh 后：重跑金融版冒烟（55 工具 + 任一业务调用 code=0）");
console.log("[MCP]   端点 URL/工具契约由服务端维护；变更时同步更新 installFinanceFlavor() 内的 mcp 列表与 skill references/");
