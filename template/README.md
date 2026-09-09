# DeepSeek Harness 便携版（Windows）

开箱即用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`@deepseek-ai/dsh`）绿色便携包。**无需安装 Node.js、无需命令行、无需联网也能用**，所有数据只保存在本文件夹内，**删除整个文件夹即彻底卸载**，不会在系统其它位置留下任何残留。

## 快速开始

1. 解压压缩包到任意目录（建议路径不含中文和空格）。
2. 双击 **`start.cmd`**。
3. 首次使用会在浏览器打开 `http://127.0.0.1:20000`（首选端口；被占用会在 20000–21000 内自动换一个），在页面「设置 → 模型」中填入你的 **DeepSeek API Key** 即可开始使用。

> 启动窗口保持打开即表示服务运行中；按 `Ctrl+C` 或直接关闭窗口即可停止。

## 三个入口文件

| 文件 | 作用 |
| --- | --- |
| `start.cmd` | 启动 Web UI（启动前会自动检查更新，离线则直接启动本地版本） |
| `update.cmd` | 手动更新到最新版（需联网） |
| `install.cmd` | 安装 / 修复（`node_modules` 被误删或损坏时联网重装） |

## 卸载

**直接删除整个文件夹即可。** 本便携包不写注册表、不写系统目录、不写用户家目录，所有程序、配置、凭证、会话历史都在本文件夹内，删除后无任何残留。

## 更新说明

- 本包已**预装** DeepSeek Harness，解压即可离线使用。
- **不用手动替换文件夹。** 双击 `update.cmd` 会：
  1. 先检测 GitHub 下载页能否打开：能打开就自动下载最新便携包；
  2. 打不开（没网）会提示你输入本机 zip 路径，或把 `DeepSeekHarness-v*.zip` 放在本目录、或拖到 `update.cmd` 上；
  3. 压缩包会先校验（必须是本项目标准便携包，防止解压错包或恶意 zip）；
  4. 再检查 dsh 引擎是否还有更新；
  5. **`home` 目录不覆盖**（对话、API Key、个人设置都在），你改过的 `config.json` 项也会保留。
- `start.cmd` 启动前同样会检查（默认询问，可在 `config.json` 把 `autoUpdate` 改成 `auto` / `off`）。

## 内置插件（3 个，全部开箱即用）

本包预装并默认启用以下插件，**完全离线可用**：

| 插件 | 功能 |
| --- | --- |
| **dsh-file-mount** | 文件增量挂载 + 读去重：重复读只补缺失部分、文件改动只重发变更行，显著节省 token；聊天界面提供 **Mounted Files** 面板（挂载区间/新鲜度/节省统计），模型可用 `file_mount_forget` 强制重读 |
| **dsh-market** | 侧边栏「插件市场」：浏览/搜索 1500+ DSH 插件，一键安装（联网时可用） |
| **dsh-web-all** | Web UI 全家桶：任务看板、Git 图谱、右侧预览/文件面板、鲸鱼娘宠物、移动端远程、实时 token 统计、皮肤中心、SSH、图片理解 |

无需任何配置。若想关闭或调整某个插件（如 file-mount 的 `enabled`/`excludeGlobs`），可编辑 `home\profiles\web\cordis.patch.yml` 按 dsh loader 补丁语法覆盖。

## 配置（`config.json`）

用记事本打开 `config.json` 修改：

```json
{
  "registry": "https://registry.npmmirror.com",
  "homeDir": "home",
  "port": 20000,
  "portRange": [20000, 21000],
  "autoUpdate": "ask",
  "openBrowser": true,
  "dshPackage": "@deepseek-ai/dsh",
  "dshTag": "alpha",
  "updateRepo": "Sean1840/DeepSeekHarnessPacker"
}
```

| 配置项 | 说明 |
| --- | --- |
| `registry` | npm 源，默认国内镜像 `https://registry.npmmirror.com`；追求绝对最新版可改回 `https://registry.npmjs.org` |
| `homeDir` | 数据目录名（配置、凭证、会话都保存在此文件夹） |
| `port` | 首选端口。启动前会自动检测是否被占用，被占用则自动换 |
| `portRange` | 允许的端口范围 `[min, max]`；首选端口被占用时在此范围内自动选一个可用端口 |
| `autoUpdate` | 更新策略：`ask` 询问（默认）/ `auto` 自动 / `off` 关闭检查 |
| `openBrowser` | 启动后是否自动打开浏览器 |
| `dshTag` | npm dist-tag，默认 `alpha`（当前上游最新为 0.1.5-alpha 线；`latest` 仍指向更早的 rc） |
| `updateRepo` | 便携包自更新所用的 GitHub 仓库，默认 `Sean1840/DeepSeekHarnessPacker` |

## 常见问题

**Q：启动后浏览器没反应？**
确认启动窗口里有类似 `http://127.0.0.1:20000` 的地址，手动用浏览器访问该地址即可。

**Q：端口被占用？**
无需手动处理——启动时会自动检测 `portRange` 范围内的端口，跳过被占用的端口（以及 80/443/8080/3000/3306 等业界常用端口），自动切换到第一个可用端口。只有当整个范围内所有端口都被占用时才会报错，此时可修改 `config.json` 里的 `portRange` 扩大范围后重试。

**Q：离线机器如何更新？**
在能上网的电脑下载 GitHub Release 里的 `DeepSeekHarness-v*.zip`，拷到这台机器后任选一种：
- 把 zip 拖到 `update.cmd` 上；
- 把 zip 放到 `start.cmd` 同一目录，再双击 `update.cmd`；
- 双击 `update.cmd`，按提示粘贴 zip 的完整路径。
不要用金融版 zip。校验不通过不会改你现有安装。

**Q：更新会不会把对话和 API Key 弄丢？**
不会。`home` 目录和你改过的 `config.json` 项都会保留。只有程序文件（脚本、dsh、内置插件）会被替换。

**Q：更新/安装时屏幕上的 `[更新中] 耗时… 下载…` 是什么？**
这是本包自带的**实时进度提示**（npm 11 默认不显示进度条，容易让人误以为卡住）。每 2 秒刷新一次：已耗时、已下载大小、下载速率、请求数；npm 的警告/错误实时显示，最后输出 `added N packages` 表示完成。如果速率长期为 0 且耗时持续增长，说明网络异常，可 `Ctrl+C` 中断后检查网络再重试。

**Q：数据（凭证/会话）存在哪？**
在 `home` 文件夹内。删除 `home` 文件夹 = 恢复出厂设置。

**Q：`.npm-cache` 文件夹是什么？**
执行 `install.cmd` / `update.cmd` 联网操作时 npm 的下载缓存。它也在本文件夹内、可安全删除（下次联网时会重新缓存），不会在系统其它位置留下残留。

**Q：公司网络无法访问 npm？**
确认 `config.json` 的 `registry` 为可访问的镜像（默认 `https://registry.npmmirror.com`）；如镜像也受限，可尝试官方源 `https://registry.npmjs.org` 后重试 `install.cmd` / `update.cmd`。
