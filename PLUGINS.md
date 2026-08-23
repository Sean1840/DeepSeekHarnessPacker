# 内置插件文档（DeepSeek Harness 便携版）

本包默认预装以下插件，**解压即用、全部离线可用**（插件及其依赖已打进 zip）。
插件统一注册在 `home\profiles\web` 的 `dsh.profile.bundles` 中，加载顺序固定为：

`@deepseek-ai/dsh-base` → `@deepseek-ai/dsh-web-app` → `dsh-file-mount` → `@dsh-market/plugin` → `@linxin666/dsh-web-ui-all`

---

## 总览

| 插件 | 版本 | 来源 | 许可 | 说明 |
| --- | --- | --- | --- | --- |
| [dsh-file-mount](https://github.com/acefun29/dsh-file-mount) | 0.5.1 | GitHub（vendor 离线 tarball） | MIT | 增量文件挂载 + 读去重，Mounted Files 面板 |
| [@dsh-market/plugin](https://github.com/2BingLing/dsh-market) | 0.3.1 | npm（构建时安装） | MIT | 插件市场：1500+ DSH 插件，中文搜索 + 五维评分 + 一键安装 |
| [@linxin666/dsh-web-ui-all](https://github.com/zhu1090093659/dsh-web-ui) | 0.2.9 | npm（构建时安装） | Apache-2.0 | Web UI 全家桶：任务看板 / Git 图谱 / 右侧面板 / 鲸鱼娘宠物 / 移动端远程 / 实时 token 统计 / 皮肤中心 / SSH / 图片理解 |

> 版本号以 `vendor/` 与构建时锁定为准：`dsh-file-mount` 是仓库内置的离线 tarball；
> `@dsh-market/plugin`、`@linxin666/dsh-web-ui-all` 在构建时从 npm 拉取后打进 zip，用户侧无需联网。

## 安装机制（构建侧）

- **dsh-file-mount**：`vendor/dsh-file-mount-<ver>.tgz` 离线解压进 profile 的 `node_modules`（零运行时依赖，完全离线、可复现）。
- **dsh-market / dsh-web-ui-all**：构建时经 `dsh plugin --profile web add <pkg>`（内部转发 pnpm）从 npm 安装进 profile，随 zip 分发后用户离线可用。**构建机需要 pnpm 在 PATH 上**。
- 构建完成后统一规整 profile 清单：依赖写为干净的精确版本，bundles 顺序固定（见上）。

---

## dsh-file-mount — 增量文件挂载 + 读去重

在 `tools/post-execute` 层拦截 `read` / `write` / `edit`：

- 已读入上下文的文件不重复发送，重复读只补缺失行、文件改动只重发变更行（行级 diff），显著节省 token；
- Web UI 提供 **Mounted Files** 面板：挂载区间、新鲜度条、覆盖率地图、节省统计；
- 提供 `file_mount_forget` 工具，模型可强制重读某个文件。

### 默认配置声明（随包内置）

以下为便携包内置的插件默认配置，**解压即按此生效**，用户未覆盖时全部适用：

**① profile bundle 行**（构建时写入 `home/profiles/web/`，即插件的启用开关）：

```yaml
- id: file-mount
  name: dsh-file-mount
  config:
    enabled: true        # 总开关；关闭后所有读取走原生路径
```

**② 插件内置默认值**（来自插件源码 zod schema 默认，未覆盖时生效）：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `capacity` | `32` | 文件身份缓存容量（已挂载文件不受驱逐） |
| `ttlMs` | `300000` | 缓存安全阀：超过该时长强制重读 |
| `maxPinnedFiles` | `256` | 每会话最多钉住的挂载文件数 |
| `minSavedTokens` | `16` | 净节省低于该值时不写账本、直接走原生读取 |
| `maxFingerprintBytes` | `1000000` | 超过该字节数的文件不留行草稿（整窗重挂载） |
| `maxManagedBytes` | `16777216` | 超过 16 MB 的文件完全不托管 |
| `excludeGlobs` | `[]` | 命中的路径始终走原生读取（如需排除 `node_modules` 等自行添加） |
| `freshnessEnabled` | `true` | 新鲜度机制开关 |
| `freshnessThreshold` | `0.6` | 新鲜度分数低于该值视为过期 |
| `safeRatio` | `0.95` | 上下文窗口的安全比例（压力为 0 的阈值） |
| `pinAfter` | `1` | 过期 1 次后钉住该段（每段最多重发一次） |
| `contextWindow` | `128000` | 会话未上报窗口时的默认上下文窗口 W |
| `valveReads` | `2` | 连续全量拦截安全阀：第 N 次走原生直通（0 = 关闭） |
| `statsFile` | （未设置） | 可选跨会话统计文件，配置后可用 `fileMount.stats()` 读取 |

---

## @dsh-market/plugin — 插件市场

DSH 侧边栏的「插件市场」面板：

- 持续收录 1500+ DSH 插件，中文搜索 + 实用五维评分；
- 一键安装：面板内直接安装社区插件（联网时可用）；
- 与便携包内置插件互不冲突，安装后插件在设置页统一管理。

## @linxin666/dsh-web-ui-all — Web UI 全家桶

一键聚合以下功能插件（均为本包子依赖，随包内置）：

| 功能 | 说明 |
| --- | --- |
| 任务看板 | 侧边栏入口；待规划/待办/进行中/已完成/已失败五列，卡片由真实智能体会话执行，支持 cron 定时执行 |
| Git 图谱 | 输入框上方分支选择器 + 分支泳道提交历史可视化 |
| 右侧面板 | 文件树 / 多标签预览（markdown、HTML、代码、diff、CSV、PDF、Office、图片）/ 真实 git 变更（stage/unstage/discard），宽度可拖拽 |
| 鲸鱼娘宠物 | 常驻宠物，随智能体状态切换动画，可互动、投喂、自定义名称 |
| 移动端远程 | 扫码配对手机远程控制当前工作区（会话/消息/模型/权限），配对令牌一次性限时，支持 cloudflared 公网隧道 |
| 实时令牌统计 | 输入框下方实时显示 TPS、LLM 耗时、上下文占用、缓存命中率、输入/输出 token |
| 皮肤中心 | 多款官方标准皮肤一键换肤（含右侧面板适配） |
| SSH / 图片理解 | 工作区 SSH 连接、图片内容理解工具等 |

### 注意事项

- **原生构建脚本被 pnpm 拦截**：安装时 `cloudflared`、`cpu-features`、`node-pty@1.1.0`、`ssh2` 的构建脚本未运行。前端功能（看板/图谱/面板/宠物/统计/皮肤）不受影响；**SSH 与 cloudflared 公网隧道可能降级**（ssh2 回退纯 JS 实现、cloudflared 无本地二进制）。如需完整支持，可在本机对 profile 执行 `pnpm approve-builds` 后重装插件。
- 移动端实时消息依赖 SSE；普通 HTTP 隧道（trycloudflare quick tunnel、Tailscale Serve）不透传 SSE 时插件自动降级为轮询（消息可能延迟数秒）。

---

## 配置覆盖（所有插件通用）

用户可在 `home\profiles\web\cordis.patch.yml` 中按 dsh loader 补丁语法覆盖任意插件配置，例如：

```yaml
- id: file-mount
  config:
    enabled: true
    excludeGlobs: ['**/node_modules/**']
```

修改后重启 Harness 生效。内置插件的启用/停用也可在 Web UI「设置 → 插件」中管理。

## 升级内置插件

- `dsh-file-mount`：把新版 `dsh-file-mount-<ver>.tgz` 放进仓库 `vendor/` 重新构建即可（自动选用最新文件）。
- `dsh-market` / `dsh-web-ui-all`：构建时自动解析 npm 最新版本；如需固定版本，修改 `scripts/build.js` 的 `NPM_DEFAULT_PLUGINS` 为 `pkg@version` 形式。
- 升级 dsh 主版本后，建议重新构建并实际验证各插件（插件作者均要求对 DSH 升级重跑验证）。

---

## 金融特化版（`FLAVOR=finance`）

金融特化版在**标准版 3 个插件之上**追加金融数据能力，产物为独立的 `dist/DeepSeekHarness-Finance-v<ver>.zip`（与通用版并存）。默认 `FLAVOR=standard` 构建通用版，**不包含**以下金融内容。

| 内容 | 版本/来源 | 说明 | 打包方式 |
| --- | --- | --- | --- |
| 同花顺 MCP（×4 实例，55 工具） | 随 dsh 的 `dsh-mcp-client` | A股 21 / 指数 4 / 元数据 2 / 基金 28 | 写入 `home/profiles/web/cordis.patch.yml`（非 bundle，4 实例靠 patch 条目承载） |
| `hithink-finance` Skill | vendor 源码（`finance/skills/`） | Agent 主路由，自动选 MCP/CLI/API/Python | 复制到 `home/skills/` |
| `hithink-finance` CLI | `@hithink-tech/hithink-finance-cli@0.1.5`（`finance/manifest.json` 钉死） | 行情/财务/估值/特色数据/本地 DuckDB | 便携 node 全局安装 + 根级 `hithink-finance.cmd` |

### 构建

```bash
set FLAVOR=finance && npm run build    # Windows cmd
# 或 PowerShell: $env:FLAVOR="finance"; npm run build
```

### 关键实现约定（已在本地实测）

1. **MCP 实例必须用 `insert:` 列表**（裸写条目会被当成"按 id 覆盖"而报 `entry not found`）；
2. **Key 用 `!!js` 环境变量插值**：`X-api-key: !!js "process.env.HITHINK_FINANCE_API_KEY ?? ''"`，Key 不落盘；
3. **`failOnStartupError: false`**：未配置 Key 时启动降级、不阻断；
4. 4 个实例的 `name` 均为 `@deepseek-ai/dsh-mcp-client`（随 dsh 分发，无需额外安装），`serverName` 唯一且合规。

### 升级金融内容

见 [README.md「金融特化版升级」](README.md#金融特化版升级) 与下文「金融 Skill 版本升级」。

### 金融 Skill 版本升级

金融 Skill 与实时数据相关，升级策略（可用 `node scripts/sync-finance.mjs` 一键检查漂移）：

- **数据实时性由 MCP/CLI 服务端保证**（查询时实时返回），Skill 内 `references/` 是**契约快照**（接口/工具/参数说明），不会随行情变化而失效；
- **Skill 升级 = 重新 vendor**：从 `finance/manifest.json` 的 `skillSourceRepo`/`skillSourcePath` 同步最新 `skills/hithink-finance/`，更新 `skillVendoredAt` 后重新构建金融版；
- **CLI 升级**：改 `finance/manifest.json` 的 `cliVersion` 后重新构建（CLI 不随用户 `update.cmd` 自动升级）；
- **dsh 升级**：金融 MCP 依赖 `dsh-mcp-client`（随 dsh 版本演进），升级 dsh 后需重跑金融版冒烟（工具数 55、`code=0`）。
