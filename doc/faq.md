# 常见问题

**Q：启动后浏览器没反应？**  
看启动窗口里的地址（类似 `http://127.0.0.1:20000`），用浏览器手动打开。

**Q：端口被占用？**  
不用手改。启动会在 `portRange` 里跳过被占用端口和常见端口（80/443/8080/3000/3306 等）。整段都被占再改 `config.json` 的 `portRange`。

**Q：离线机器如何更新？**  
见 [更新](update.md#离线更新打不开下载页)。把 GitHub Release 的 zip 拷过来，拖到 `update.cmd` 上即可。

**Q：老版本便携包没有自动更新怎么办？**  
见 [给老包打补丁](update.md#给老包打补丁v13-及更早)。把新包里的 `update.cmd`、`scripts\update.js`、`scripts\common.js` **三个一起**拷进老目录，再把新 zip 拖到 `update.cmd` 上。不要整目录覆盖 `home`。

**Q：更新会不会把对话、API Key 或插件弄丢？**  
不会。`home`（含已装插件）和你改过的 `config.json` 都保留。dsh 内核只有你在提示里同意才会替换。本包基础插件也只有你同意刷新时才换；你自己装的插件不会删。

**Q：更新完双击 start.cmd 立刻退出，窗口里有 plugin tree failed / settingsNamespace？**  
这是内核已经升上去、Web UI 基础插件还是旧包。再运行 `start.cmd`，按提示刷新基础插件即可。也可以把 `DeepSeekHarness-v*.zip` 拖到 `update.cmd` 上，升级内核后同意刷新基础插件。自己装的插件、对话和设置都会保留。

**Q：`.baseline-web` 是什么？**  
上次用 zip 更新时留下的出厂基础插件备份，给启动失败修复用。不是会话数据，可删；下次 zip 更新会再生成。

**Q：更新/安装时屏幕上的 `[更新中] 耗时… 下载…` 是什么？**  
npm 11 默认不显示进度条。本包自己画进度：耗时、下载量、速率、请求数。速率长期为 0 且耗时一直涨，说明网络异常，可 `Ctrl+C` 后检查网络再试。

**Q：数据存在哪？**  
`home` 文件夹。删除 `home` = 恢复出厂设置。

**Q：`.npm-cache` 是什么？**  
`install.cmd` / `update.cmd` 联网时的 npm 缓存，也在本文件夹内，可安全删除。

**Q：公司网络无法访问 npm？**  
改 `config.json` 的 `registry`。默认镜像是 `https://registry.npmmirror.com`；镜像也受限可改 `https://registry.npmjs.org`。便携包程序文件的更新走 GitHub，和 npm 源是两回事。
