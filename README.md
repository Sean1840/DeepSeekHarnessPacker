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
vendor/                 预装第三方插件 tarball（构建时解压进便携包，离线可用）
  dsh-file-mount-<ver>.tgz   dsh-file-mount 插件（增量文件挂载 + 读去重）
dist/                   构建产物（gitignore）
  DeepSeekHarness-v<ver>.zip
```

## 构建

最简单：**双击仓库根目录的 `build.cmd`**（自动检查 Node → 跑打包脚本 → 完成后停留显示结果）。

也可以在命令行运行：

```bash
npm run build        # 等价于 node scripts/build.js
```

脚本会：下载便携 Node.js（x64，Node 24 LTS）→ 复制管理器与模板 → 用便携 Node 预装 dsh（离线可用）→ 自检 → 预装默认插件 → 打包成 `dist/DeepSeekHarness-v<ver>.zip`。

## 默认插件：dsh-file-mount

便携包默认预装 [dsh-file-mount](https://github.com/acefun29/dsh-file-mount)（MIT，v0.5.1）：在 `tools/post-execute` 层拦截 `read`/`write`/`edit`，对已读入上下文的文件做**增量挂载与读去重**——重复读只补缺失行、文件改动只重发变更行，并在 Web UI 提供 **Mounted Files** 面板（含覆盖率地图与节省 token 统计）。插件同时提供 `file_mount_forget` 工具，模型可强制重读某个文件。

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

用户可在 `home/profiles/web/cordis.patch.yml` 中按 loader 补丁语法覆盖以上任意配置项（含 `enabled`）。

- 构建时把 `vendor/dsh-file-mount-<ver>.tgz` 解压进便携包的 `home/profiles/web/node_modules/`，并在 profile 清单的 `dsh.profile.bundles` 中注册（加载顺序：`dsh-base` → `dsh-web-app` → `dsh-file-mount`），**用户解压即用、完全离线**，无需联网安装。
- 插件无运行时依赖；其 peer 依赖（`@deepseek-ai/dsh-*`）在用户首次启动时由 dsh 的 `healProfilesModuleFallback` 自动以 junction 回退到本包 `node_modules` 解析。
- 想换版本：把新的 `dsh-file-mount-<ver>.tgz` 放进 `vendor/` 即可（构建时自动选用，无需改代码）；没有该文件时构建会告警并跳过预装。
- 用户可在 `home/profiles/web/cordis.patch.yml` 中按 loader 补丁语法覆盖插件配置（`enabled`、`capacity`、`excludeGlobs` 等），见插件 [README](https://github.com/acefun29/dsh-file-mount)。
- 注意：升级 dsh 主版本后建议重新构建并实际验证插件（其 README 明确要求对每次 DSH 升级重跑测试）。

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
