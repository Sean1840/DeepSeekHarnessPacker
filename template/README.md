# DeepSeek Harness 便携版（Windows）

开箱即用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`@deepseek-ai/dsh`）绿色便携包。**无需安装 Node.js、无需命令行、无需联网也能用**，所有数据只保存在本文件夹内，**删除整个文件夹即彻底卸载**，不会在系统其它位置留下任何残留。

## 快速开始

1. 解压压缩包到任意目录（建议路径不含中文和空格）。
2. 双击 **`start.cmd`**。
3. 首次使用会在浏览器打开 `http://127.0.0.1:3080`，在页面「设置 → 模型」中填入你的 **DeepSeek API Key** 即可开始使用。

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
- `start.cmd` 启动前会先检测网络：
  - 离线 → 直接启动本地版本；
  - 联网且发现新版本 → 按 `config.json` 中的策略处理（默认询问你是否更新）。
- 也可随时双击 `update.cmd` 手动更新。

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
  "dshPackage": "@deepseek-ai/dsh"
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

## 常见问题

**Q：启动后浏览器没反应？**
确认启动窗口里有类似 `http://127.0.0.1:3080` 的地址，手动用浏览器访问该地址即可。

**Q：端口被占用？**
无需手动处理——启动时会自动检测 `portRange` 范围内的端口，跳过被占用的端口（以及 80/443/8080/3000/3306 等业界常用端口），自动切换到第一个可用端口。只有当整个范围内所有端口都被占用时才会报错，此时可修改 `config.json` 里的 `portRange` 扩大范围后重试。

**Q：离线机器如何更新？**
在能联网的机器上更新好（或重新下载新版压缩包），把整个文件夹拷贝过去即可。

**Q：数据（凭证/会话）存在哪？**
在 `home` 文件夹内。删除 `home` 文件夹 = 恢复出厂设置。

**Q：`.npm-cache` 文件夹是什么？**
执行 `install.cmd` / `update.cmd` 联网操作时 npm 的下载缓存。它也在本文件夹内、可安全删除（下次联网时会重新缓存），不会在系统其它位置留下残留。

**Q：公司网络无法访问 npm？**
确认 `config.json` 的 `registry` 为可访问的镜像（默认 `https://registry.npmmirror.com`）；如镜像也受限，可尝试官方源 `https://registry.npmjs.org` 后重试 `install.cmd` / `update.cmd`。
