# DeepSeek Harness 便携版（Windows）— 构建仓库

本仓库用于**构建**可分发的 DeepSeek Harness 绿色便携包（`dist/DeepSeekHarness-v<ver>.zip`）。最终用户解压即用，不装 Node、不配命令行。

详细说明按模块拆在 `doc/`，本页只做索引。

## 文档

| 模块 | 对象 | 说明 |
| --- | --- | --- |
| [快速开始](doc/quick-start.md) | 用户 | 解压、启动、入口文件、卸载 |
| [更新](doc/update.md) | 用户 / 开发者 | 在线与离线更新、zip 校验、**updater 小包**、dsh 询问、基础插件询问与启动失败修复 |
| [配置](doc/config.md) | 用户 | `config.json` 各项 |
| [插件](doc/plugins.md) | 用户 / 开发者 | 基础插件说明；默认不覆盖已装插件，内核跳跃时可询问刷新 |
| [常见问题](doc/faq.md) | 用户 | 端口、离线、数据目录等 |
| [构建](doc/build.md) | 开发者 | `build.cmd`、环境变量、目录 |
| [发布](doc/release.md) | 开发者 | 打 zip、GitHub Release、老用户如何升 |
| [技术要点](doc/internals.md) | 开发者 | 便携路径、lockfile、端口、校验 |

用户拿到的 zip 里同样有 `README.md`（短索引）和 `doc/`。

## 最短路径

1. 双击 `build.cmd`（需本机 Node，构建插件还需 pnpm）
2. 得到 `dist/DeepSeekHarness-v<ver>.zip`（完整包）和 `dist/DeepSeekHarness-updater-v<ver>.zip`（老包三文件补丁），都发到 [GitHub Releases](https://github.com/Sean1840/DeepSeekHarnessPacker/releases)
3. 用户双击包内 `start.cmd`；以后用 `update.cmd` 原地升级（见 [更新](doc/update.md)）

老便携包（v1.3 及更早）没有新更新器：先下 Release 里的 **updater 小包**解压到旧目录，再把完整 zip 拖到 `update.cmd` 上。细节在 [给老包打补丁](doc/update.md#给老包打补丁v13-及更早)。
