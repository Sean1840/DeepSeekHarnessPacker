# DeepSeek Harness 便携版（Windows）— 构建仓库

本仓库用于**构建**一个可分发的、开箱即用的 DeepSeek Harness 绿色便携包。

## 目录说明

```
scripts/                管理器核心（Node.js，UTF-8）
  common.js             公共工具（node/npm/dsh 解析、版本比较、网络检测）
  install.js            安装 / 修复
  update.js             更新到最新版
  start.js              启动（含首次更新检查）
  build.js              打包脚本（仅开发者使用，不进 zip）
template/               被打包进 zip 的静态文件
  config.json           用户可改配置
  start.cmd / update.cmd / install.cmd     入口（双击）
  README.md             最终用户中文说明
dist/                   构建产物（gitignore）
  DeepSeekHarness-v<ver>.zip
```

## 构建

最简单：**双击仓库根目录的 `build.cmd`**（自动检查 Node → 跑打包脚本 → 完成后停留显示结果）。

也可以在命令行运行：

```bash
npm run build        # 等价于 node scripts/build.js
```

脚本会：下载便携 Node.js（x64，Node 24 LTS）→ 复制管理器与模板 → 用便携 Node 预装 dsh（离线可用）→ 自检 → 打包成 `dist/DeepSeekHarness-v<ver>.zip`。

可用环境变量：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `NODE_DIST_BASE` | （空） | 指定后覆盖 Node 下载源；默认按 `npmmirror → nodejs.org` 顺序尝试 |
| `NPM_REGISTRY` | `https://registry.npmmirror.com` | 预装 dsh 时的 npm 源，可改 `https://registry.npmjs.org` |

## 技术要点

- **便携性**：通过 `DSH_HOME` 环境变量把 dsh 的用户数据（配置/凭证/会话）重定向到便携目录下的 `home/`，实现"删目录即清理"。
- **离线可用**：dsh 及全部 530 个依赖预装进 `node_modules/`，解压即用。
- **免 Node**：随包附带便携版 Node.js（`node/node.exe` + npm），用户无需安装任何东西。
- **原生依赖**：dsh 的原生部分（`node-pty`、`sharp`、`koffi` 等）均为 N-API / 平台预编译包，无源码编译，Node 24 与其它版本 ABI 兼容。
- **端口自适应**：启动时在 `config.json` 的 `portRange`（默认 20000–21000）范围内自动检测并挑选可用端口，跳过被占用端口及业界常用端口（80/443/8080/3000/3306 等），整个范围全被占用才报错。

## 发布新版本

1. 双击 `build.cmd`（或 `npm run build`）生成新的 zip。
2. 把 `dist/DeepSeekHarness-v<ver>.zip` 发给用户即可。
3. 老用户双击 `update.cmd` 即可原地升级，无需重新下载整个压缩包。
