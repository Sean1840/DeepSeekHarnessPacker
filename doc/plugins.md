# 插件

本包**第一次解压**时预装以下基础插件，离线可用。插件注册在 `home\profiles\web` 的 `dsh.profile.bundles` 中，加载顺序：

`@deepseek-ai/dsh-base` → `@deepseek-ai/dsh-web-app` → `@dsh-market/plugin` → `@linxin666/dsh-web-all`

`dsh-file-mount` **不再预装**：它写入会话的 `source.path` 等字段会被 dsh 0.1.5-alpha 拒绝，打开旧对话时报「历史加载失败」。需要文件挂载时请等上游修复后再自行安装。

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
| [@dsh-market/plugin](https://github.com/2BingLing/dsh-market) | 0.4.5 | npm（构建时安装） | MIT | 插件市场：1500+ DSH 插件，中文搜索 + 五维评分 + 一键安装 |
| [@linxin666/dsh-web-all](https://github.com/zhu1090093659/dsh-web-ui) | 0.3.19 | npm（构建时安装） | Apache-2.0 | Web UI 全家桶（`dsh-web-ui-all` 后继包）：任务看板 / Git 图谱 / 右侧面板 / 鲸鱼娘宠物 / 移动端远程 / 实时 token 统计 / 皮肤中心 / SSH / 图片理解 |

> 版本号以构建时锁定为准。用户侧默认不写回；只有你在「刷新基础插件」提示里同意，才会把上表基础插件换成这一版。

## 安装机制（构建侧）

- **dsh-market / dsh-web-all**：构建时经 `dsh plugin --profile web add <pkg>`（内部转发 pnpm）。**构建机需要 pnpm 在 PATH 上**。
- 构建完成后规整 profile 清单：依赖为精确版本，bundles 顺序固定。

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
- id: some-plugin-id
  config:
    enabled: true
```

改完重启。也可在网页「设置 → 插件」里开关。

## 构建侧：升级基础插件版本

这是打**新 zip** 时用的，不会在用户已有安装上强行覆盖插件。

- `dsh-market` / `dsh-web-all`：构建时拉 npm 最新；钉版本则改 `scripts/build.js` 的 `NPM_DEFAULT_PLUGINS`
- 升级 dsh 主版本后应重跑构建并验证插件
