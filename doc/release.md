# 发布

1. 双击 `build.cmd`（或 `npm run build`）生成：
   - `dist/DeepSeekHarness-v<ver>.zip`（完整便携包）
   - `dist/DeepSeekHarness-updater-v<ver>.zip`（老包三文件补丁，几 KB）
2. **两个 zip 都**发到 GitHub Release（仓库 `Sean1840/DeepSeekHarnessPacker`）。
3. **v1.4+** 用户：双击包内 `update.cmd` 即可原地升级（在线下载或本地 zip）。
4. **v1.3 及更早**：先下 updater 小包，解压到老包根目录，再把完整 zip 拖到 `update.cmd` 上。不要整包覆盖对方的 `home/`。只打 `--updater-only` 可单独重打小包。

覆盖规则见 [更新](update.md)：不自动替换用户插件；dsh 内核需确认；基础插件落后时再问一次。
