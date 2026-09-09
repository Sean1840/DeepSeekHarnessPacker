# 配置（`config.json`）

用记事本打开便携包根目录的 `config.json`：

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
| `registry` | npm 源。用户侧默认国内镜像 `https://registry.npmmirror.com`；构建机预装 dsh 默认走官方源（alpha 依赖树在镜像上可能不完整） |
| `homeDir` | 数据目录名（配置、凭证、会话、插件都在这里） |
| `port` | 首选端口。启动前检测占用，被占用则自动换 |
| `portRange` | 允许的端口范围 `[min, max]` |
| `autoUpdate` | `ask` 询问（默认）/ `auto` 自动装 dsh（内核仍会问）/ `off` 启动不检查。**只影响 `start.cmd` 的 dsh 检查**；便携包版本由 `update.cmd` 处理 |
| `openBrowser` | 启动后是否自动打开浏览器 |
| `dshPackage` | dsh 的 npm 包名，默认 `@deepseek-ai/dsh` |
| `dshTag` | npm dist-tag，默认 `alpha`（当前上游最新为 0.1.5-alpha 线；`latest` 仍指向更早的 rc） |
| `updateRepo` | 便携包自更新所用的 GitHub 仓库，默认 `Sean1840/DeepSeekHarnessPacker` |

更新时：**不会覆盖你已经改过的项**，只补你文件里还没有的新字段。
