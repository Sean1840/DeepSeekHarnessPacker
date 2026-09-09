# 发布

1. 双击 `build.cmd`（或 `npm run build`）生成 `dist/DeepSeekHarness-v<ver>.zip`。
2. 把 zip 发到 GitHub Release（仓库 `Sean1840/DeepSeekHarnessPacker`）。
3. **v1.4+** 用户：双击包内 `update.cmd` 即可原地升级（在线下载或本地 zip）。
4. **v1.3 及更早**：先按 [给老包打补丁](update.md#给老包打补丁v13-及更早) 拷 3 个文件，再喂新 zip。不要整包覆盖对方的 `home/`。

覆盖规则见 [更新](update.md)：不替换用户插件；dsh 内核需确认。
