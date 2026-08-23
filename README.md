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
PLUGINS.md              内置插件统一文档（版本/功能/默认配置/覆盖方式/升级）
finance/                金融特化版内容（仅 FLAVOR=finance 打包时使用）
  manifest.json         CLI/Skill 版本钉死
  skills/hithink-finance/   vendor 的同花顺 Agent Skill（含 references/）
template/               被打包进 zip 的静态文件
  config.json           用户可改配置
  package-lock.json     内置依赖清单（构建与用户 install/update 均走增量解析，见「技术要点」）
  start.cmd / update.cmd / install.cmd     入口（双击）
  README.md             最终用户中文说明（通用版）
  README.finance.md     金融特化版用户说明（FLAVOR=finance 时覆盖 README.md）
vendor/                 预装离线插件 tarball（构建时解压进便携包）
  dsh-file-mount-<ver>.tgz   dsh-file-mount 插件（增量文件挂载 + 读去重）
dist/                   构建产物（gitignore）
  DeepSeekHarness-v<ver>.zip           通用版
  DeepSeekHarness-Finance-v<ver>.zip   金融特化版
```

## 构建

最简单：**双击仓库根目录的 `build.cmd`**（自动检查 Node → 跑打包脚本 → 完成后停留显示结果）。

也可以在命令行运行：

```bash
npm run build        # 等价于 node scripts/build.js
```

脚本会：下载便携 Node.js（x64，Node 24 LTS）→ 复制管理器与模板 → 用便携 Node 预装 dsh（离线可用）→ 自检 → 预装默认插件（**构建机需 pnpm 在 PATH**，见 [PLUGINS.md](PLUGINS.md)）→ 打包成 `dist/DeepSeekHarness-v<ver>.zip`。

## 金融特化版

在通用版基础上，`FLAVOR=finance` 构建**金融特化版**：额外内置同花顺金融数据 MCP（4 端点 55 工具）+ `hithink-finance` Skill + CLI。默认版本不含这些内容。

```bash
set FLAVOR=finance && npm run build    # Windows cmd，产出 DeepSeekHarness-Finance-v<ver>.zip
```

金融内容的版本/来源/升级策略详见 [PLUGINS.md「金融特化版」](PLUGINS.md#金融特化版finance)；关键实现（MCP 用 `insert:` + `!!js` 环境变量插值、`failOnStartupError: false`）已在本地实测。

## 内置插件

便携包默认预装 3 个插件，**解压即用、完全离线**（插件及其依赖已打进 zip）：

| 插件 | 版本 | 说明 |
| --- | --- | --- |
| [dsh-file-mount](https://github.com/acefun29/dsh-file-mount) | 0.5.1 | 增量文件挂载 + 读去重，Mounted Files 面板（离线 tarball，vendor/ 内置） |
| [@dsh-market/plugin](https://github.com/2BingLing/dsh-market) | 0.3.1 | 插件市场：1500+ DSH 插件，一键安装 |
| [@linxin666/dsh-web-ui-all](https://github.com/zhu1090093659/dsh-web-ui) | 0.2.9 | Web UI 全家桶：任务看板 / Git 图谱 / 右侧面板 / 宠物 / 移动端远程 / 实时统计 / 皮肤中心 |

各插件的**功能说明、默认配置声明、配置覆盖方式与升级方法**统一管理在 **[PLUGINS.md](PLUGINS.md)**，本 README 不再展开。加载顺序固定为 `dsh-base → dsh-web-app → dsh-file-mount → @dsh-market/plugin → @linxin666/dsh-web-ui-all`。

可用环境变量：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `NODE_DIST_BASE` | （空） | 指定后覆盖 Node 下载源；默认按 `npmmirror → nodejs.org` 顺序尝试 |
| `NPM_REGISTRY` | `https://registry.npmmirror.com` | 预装 dsh 时的 npm 源，可改 `https://registry.npmjs.org` |

## 技术要点

- **便携性**：通过 `DSH_HOME` 环境变量把 dsh 的用户数据（配置/凭证/会话）重定向到便携目录下的 `home/`，实现"删目录即清理"。
- **离线可用**：dsh 及全部 **500+ 个依赖**预装进 `node_modules/`，解压即用。
- **免 Node**：随包附带便携版 Node.js（`node/node.exe` + npm），用户无需安装任何东西。
- **原生依赖**：dsh 的原生部分（`node-pty`、`sharp`、`koffi` 等）均为 N-API / 平台预编译包，无源码编译，Node 24 与其它版本 ABI 兼容。
- **基于 lockfile 的增量安装**：`template/package-lock.json` 随包内置。npm 11 对**无 lockfile 的整树全新解析**存在卡死（CPU 空转，rc.2 依赖树实测必现）；构建与用户侧的 `install.cmd`/`update.cmd` 都携带该 lockfile 走增量解析，几秒~一分钟完成且稳定。dsh 更新时构建会自动把更新后的 lockfile 回写回 `template/`。
- **更新进度提示**：npm 11 默认关闭自带进度条（`progress=false`），下载阶段几乎无输出，用户易误以为卡死；`common.js` 的 `runNpm` 已改为实时渲染状态行（耗时 + 下载量/速率 + 请求数），并透传 npm 的 warn/error、收尾输出摘要。
- **默认插件**：dsh-file-mount 以 vendor/ 离线 tarball 形式内置；dsh-market、dsh-web-ui-all 构建时经 `dsh plugin add`（pnpm）联网安装后打进 zip，用户侧离线可用。构建机需 pnpm 在 PATH（详见 [PLUGINS.md](PLUGINS.md)）。
- **端口自适应**：启动时在 `config.json` 的 `portRange`（默认 20000–21000）范围内自动检测并挑选可用端口，跳过被占用端口及业界常用端口（80/443/8080/3000/3306 等），整个范围全被占用才报错。

## 发布新版本

1. 双击 `build.cmd`（或 `npm run build`）生成新的 zip。
2. 把 `dist/DeepSeekHarness-v<ver>.zip` 发给用户即可。
3. 老用户双击 `update.cmd` 即可原地升级，无需重新下载整个压缩包。
