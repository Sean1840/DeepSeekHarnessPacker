# 构建

本仓库打出可分发的 Windows 绿色包：`dist/DeepSeekHarness-v<ver>.zip`，以及老包三文件补丁 `dist/DeepSeekHarness-updater-v<ver>.zip`。

## 怎么构建

最简单：双击仓库根目录 **`build.cmd`**。

命令行：

```bash
npm run build        # 等价于 node scripts/build.js
node scripts/build.js --updater-only   # 只打三文件补丁小包，不重打完整便携包
```

流程：下载便携 Node.js（x64，Node 24 LTS）→ 复制管理器、模板和 `doc/` → 用便携 Node 预装 dsh → 自检 → 预装默认插件（**构建机需 pnpm 在 PATH**，见 [插件](plugins.md)）→ 打包 zip。

预装的 dsh 走 npm **`alpha` dist-tag**（当前为 `0.1.5-alpha.x`）。npm 的 `latest` 仍指向更早的 `0.1.2-rc.1`，便携包不跟 `latest`。可用环境变量覆盖。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `NODE_DIST_BASE` | （空） | 覆盖 Node 下载源；默认按 `npmmirror → nodejs.org` 顺序尝试 |
| `NPM_REGISTRY` | `https://registry.npmjs.org` | 预装 dsh 的 npm 源；国内可改 `https://registry.npmmirror.com`（0.1.5-alpha 依赖树目前可能不完整） |
| `DSH_TAG` | `alpha` | 预装 dsh 使用的 npm dist-tag |
| `DSH_VERSION` | （空） | 若设置则钉死具体版本，忽略 `DSH_TAG` |

## 仓库目录

```
scripts/                管理器核心（Node.js，UTF-8）
  common.js             公共工具（版本比较、更新、zip 校验）
  install.js            安装 / 修复
  update.js             更新入口
  start.js              启动
  build.js              打包（不进 zip）
doc/                    模块文档（进 zip，README 只做索引）
template/               打进 zip 的静态文件
  config.json / *.cmd / README.md
vendor/                 （空；曾放 dsh-file-mount，已从默认包撤下）
dist/                   构建产物（gitignore）
```
