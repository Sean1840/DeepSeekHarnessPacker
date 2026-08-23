# DeepSeek Harness 金融特化版

预装**同花顺金融数据服务**：4 个托管 MCP 端点（共 55 个工具）+ `hithink-finance` Agent Skill + `hithink-finance` CLI，开箱即用、离线可用（数据请求仍需联网）。

## 三步开始

1. **注册 API Key**：打开 <https://fuyao.aicubes.cn/admin> 登录后创建统一 Key。
2. **配置 Key（推荐环境变量）**：打开一个命令行窗口执行（把 `你的Key` 换成真实值）：

   ```bat
   setx HITHINK_FINANCE_API_KEY "你的Key"
   ```

   > Key 写入当前 Windows 用户的持久环境变量，不写进本包任何文件。也可交给 Agent 代配（写入统一凭据 `%APPDATA%\hithink-finance\credentials.env`）。

3. **重启**：关闭并重新双击 `start.cmd`（环境变量只在启动时读取），浏览器打开 DSH 界面。

> 未配置 Key 时本包也能正常启动，只是金融工具不注册（`failOnStartupError` 降级，不影响其他功能）。

## 试试问

- 「查询贵州茅台的最新行情」
- 「获取沪深300当前成分股」
- 「今天有哪些涨停股」
- 「查询 300033.SZ 最近一年的走势，分析最大回撤和均线」

## CLI（可选）

内置 `hithink-finance` CLI，命令行执行（首次需登录）：

```bat
hithink-finance auth login          :: 粘贴 Key（存入系统凭据库）
hithink-finance market snapshot --thscodes 600519.SH --format json
hithink-finance skills sync         :: 同步 CLI 配套 Skill 到 agent skills 目录
```

## 内置能力

| 接入方式 | 说明 |
| --- | --- |
| **MCP（4 端点，55 工具）** | A股 21 / 指数 4 / 元数据 2 / 基金 28，Chat 场景直接自然语言调用 |
| **hithink-finance Skill** | Agent 主路由，自动在 MCP/CLI/API/Python 间选择接入方式 |
| **hithink-finance CLI** | 终端取数、本地 DuckDB、大结果落盘，入口 `hithink-finance.cmd` |

## 安全须知

- Key 只写在本机用户环境变量 / 凭据库；本包"删目录即清理"。
- 不要把这个目录分享、打包或提交到任何仓库/网盘。
- 所有行情与榜单数据仅供研究，不构成投资建议。
