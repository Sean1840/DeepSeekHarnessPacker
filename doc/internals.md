# 技术要点

- **便携性**：`DSH_HOME` 把 dsh 的用户数据重定向到便携目录下的 `home/`，删目录即清理。
- **离线可用**：dsh 及依赖预装进 `node_modules/`，解压即用。
- **免 Node**：随包附带 `node/node.exe` + npm。
- **原生依赖**：`node-pty`、`sharp`、`koffi` 等为 N-API / 预编译包，无源码编译，Node 24 与其它版本 ABI 兼容。
- **lockfile 增量安装**：`template/package-lock.json` 随包内置。npm 11 对无 lockfile 的整树解析可能卡死；构建与用户侧 `install.cmd` / 内核更新都走增量解析。dsh 版本变化时构建会把 lockfile 回写 `template/`。
- **更新进度**：npm 11 默认关闭进度条；`common.js` 的 `runNpm` 自己画耗时 / 下载量 / 速率 / 请求数。
- **默认插件**：`dsh-file-mount` 用 `vendor/` 离线 tarball；`dsh-market`、`dsh-web-all` 构建时 `dsh plugin add`（需 pnpm）后打进 zip。**更新已有安装时默认不覆盖用户 `home` 里的插件。** 内核升级且基础插件落后（含 `dsh-web-ui-all` → `dsh-web-all` 更名）时询问后才刷新基础插件；用户 extras 与 `cordis.patch.yml` 保留。zip 解压后的出厂 web profile 会挪到 `.baseline-web`，供 `start.cmd` 在插件树加载失败时修复。
- **端口**：`config.json` 的 `portRange`（默认 20000–21000）内自动选可用端口，跳过占用和常见端口。
- **zip 校验**：本地/下载的更新包会检查身份与 zip-slip，见 [更新](update.md#压缩包校验安全性)。
