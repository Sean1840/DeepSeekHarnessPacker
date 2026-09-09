# 插件

本包**第一次解压**时预装以下基础插件，离线可用。插件注册在 `home\profiles\web` 的 `dsh.profile.bundles` 中，加载顺序：

`@deepseek-ai/dsh-base` → `@deepseek-ai/dsh-web-app` → `dsh-file-mount` → `@dsh-market/plugin` → `@linxin666/dsh-web-all`

## 更新与用户插件

压缩包只做基础插件的**首次提供**。你用过之后：

- `update.cmd` **不会自动替换** `home` 里已经装好的插件（包括你自己装的、以及改过版本的基础插件）
- 若本包基础版比你当前的新，更新时会**打印提示**
- **刚升级了 dsh 内核**、且基础插件落后或已更名（例如旧的 `dsh-web-ui-all`）：会再问要不要用本包基础插件刷新。同意才换；你自己装的插件和 `cordis.patch.yml` 保留
- 若当时没刷新、启动失败：`start.cmd` 会提示用 `.baseline-web` 备份（或本地 zip）修复后重试
- 需要关插件或改参数：编辑 `home\profiles\web\cordis.patch.yml`，或用网页设置页

详见 [更新](update.md)。

---

## 总览

| 插件 | 版本 | 来源 | 许可 | 说明 |
| --- | --- | --- | --- | --- |
| [dsh-file-mount](https://github.com/acefun29/dsh-file-mount) | 0.5.1 | GitHub（vendor 离线 tarball） | MIT | 增量文件挂载 + 读去重，Mounted Files 面板 |
| [@dsh-market/plugin](https://github.com/2BingLing/dsh-market) | 0.4.5 | npm（构建时安装） | MIT | 插件市场：1500+ DSH 插件，中文搜索 + 五维评分 + 一键安装 |
| [@linxin666/dsh-web-all](https://github.com/zhu1090093659/dsh-web-ui) | 0.3.19 | npm（构建时安装） | Apache-2.0 | Web UI 全家桶（`dsh-web-ui-all` 后继包）：任务看板 / Git 图谱 / 右侧面板 / 鲸鱼娘宠物 / 移动端远程 / 实时 token 统计 / 皮肤中心 / SSH / 图片理解 |

> 版本号以构建时锁定为准。用户侧默认不写回；只有你在「刷新基础插件」提示里同意，才会把上表三个基础插件换成这一版。

## 安装机制（构建侧）

- **dsh-file-mount**：`vendor/dsh-file-mount-<ver>.tgz` 离线解压进 profile 的 `node_modules`。本仓库内的 0.5.1 tarball 已打补丁：注入消息的 `source` 只保留 dsh 0.1.5 会话格式允许的字段（`kind` / `plugin` / `form` / `summary`）。上游原版会多写 `path` 等字段，新内核加载历史时会报 `unexpected member "path"`。
- **dsh-market / dsh-web-all**：构建时经 `dsh plugin --profile web add <pkg>`（内部转发 pnpm）。**构建机需要 pnpm 在 PATH 上**。
- 构建完成后规整 profile 清单：依赖为精确版本，bundles 顺序固定。

---

## dsh-file-mount — 增量文件挂载 + 读去重

在 `tools/post-execute` 层拦截 `read` / `write` / `edit`：

- 已读入上下文的文件不重复发送，重复读只补缺失行、文件改动只重发变更行（行级 diff），显著节省 token；
- Web UI 提供 **Mounted Files** 面板：挂载区间、新鲜度条、覆盖率地图、节省统计；
- 提供 `file_mount_forget` 工具，模型可强制重读某个文件。

### 默认配置声明（随包内置）

**① profile bundle 行**（构建时写入 `home/profiles/web/`）：

```yaml
- id: file-mount
  name: dsh-file-mount
  config:
    enabled: true        # 总开关；关闭后所有读取走原生路径
```

**② 插件内置默认值**（zod schema 默认，未覆盖时生效）：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `capacity` | `32` | 文件身份缓存容量（已挂载文件不受驱逐） |
| `ttlMs` | `300000` | 缓存安全阀：超过该时长强制重读 |
| `maxPinnedFiles` | `256` | 每会话最多钉住的挂载文件数 |
| `minSavedTokens` | `16` | 净节省低于该值时不写账本、直接走原生读取 |
| `maxFingerprintBytes` | `1000000` | 超过该字节数的文件不留行草稿（整窗重挂载） |
| `maxManagedBytes` | `16777216` | 超过 16 MB 的文件完全不托管 |
| `excludeGlobs` | `[]` | 命中的路径始终走原生读取 |
| `freshnessEnabled` | `true` | 新鲜度机制开关 |
| `freshnessThreshold` | `0.6` | 新鲜度分数低于该值视为过期 |
| `safeRatio` | `0.95` | 上下文窗口的安全比例 |
| `pinAfter` | `1` | 过期 1 次后钉住该段 |
| `contextWindow` | `128000` | 会话未上报窗口时的默认上下文窗口 W |
| `valveReads` | `2` | 连续全量拦截安全阀：第 N 次走原生直通（0 = 关闭） |
| `statsFile` | （未设置） | 可选跨会话统计文件 |

---

## @dsh-market/plugin — 插件市场

- 收录 1500+ DSH 插件，中文搜索 + 五维评分
- 面板内一键安装（需联网）
- 与基础插件互不冲突，安装后在设置页统一管理

## @linxin666/dsh-web-all — Web UI 全家桶

| 功能 | 说明 |
| --- | --- |
| 任务看板 | 待规划/待办/进行中/已完成/已失败；支持 cron |
| Git 图谱 | 分支选择器 + 泳道提交历史 |
| 右侧面板 | 文件树 / 多标签预览 / git 变更，宽度可拖拽 |
| 鲸鱼娘宠物 | 随智能体状态切换动画 |
| 移动端远程 | 扫码配对；cloudflared 隧道可能因构建脚本未跑而降级 |
| 实时令牌统计 | TPS、耗时、上下文、缓存命中 |
| 皮肤中心 | 一键换肤 |
| SSH / 图片理解 | SSH 可能降级为纯 JS；完整支持需 `pnpm approve-builds` |

---

## 配置覆盖

`home\profiles\web\cordis.patch.yml`：

```yaml
- id: file-mount
  config:
    enabled: true
    excludeGlobs: ['**/node_modules/**']
```

改完重启。也可在网页「设置 → 插件」里开关。

## 构建侧：升级基础插件版本

这是打**新 zip** 时用的，不会在用户已有安装上强行覆盖插件。

- `dsh-file-mount`：把新 tarball 放进 `vendor/` 后重新构建
- `dsh-market` / `dsh-web-all`：构建时拉 npm 最新；钉版本则改 `scripts/build.js` 的 `NPM_DEFAULT_PLUGINS`
- 升级 dsh 主版本后应重跑构建并验证插件
