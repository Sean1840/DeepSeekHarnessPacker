# 更新

便携包更新分三块，互不影响：

| 内容 | 更新时怎么做 |
| --- | --- |
| 启动脚本、便携 Node 等程序文件 | 可以原地替换 |
| **你自己装的插件**（`home` 里的 extras） | **一律不改** |
| **本包基础插件**（Web UI / 插件市场） | 默认不改；**内核升级且版本落后时会再问**，同意才刷新 |
| **dsh 内核** | **先问，同意才换** |

压缩包只提供**第一次安装**的基础插件。用过之后，自己装的插件仍由你在网页「设置 → 插件」里升级。基础插件若和内核不匹配，更新器或 `start.cmd` 会提供修复，而不是默默覆盖。

对话记录、API Key、个人设置在 `home/`，更新不会覆盖。你改过的 `config.json` 项也会保留（新字段会补上）。

---

## 在线更新（能打开 GitHub）

双击 `update.cmd`。脚本会先探测 [GitHub Release 下载页](https://github.com/Sean1840/DeepSeekHarnessPacker/releases/latest) 能不能打开（用网页请求，不是 ICMP ping，避免公司网禁 ping 却能上网的误判）。

能打开则自动下载最新 `DeepSeekHarness-v*.zip`，校验后替换程序文件，再询问是否升级 dsh 内核。若内核升级了、而本包基础插件还是旧的（包括已更名的旧 UI 包），会再问要不要刷新这些基础插件。你自己装的插件不会删。

`start.cmd` 启动前也会检查。`config.json` 里 `autoUpdate`：

- `ask`（默认）：询问
- `auto`：程序文件可自动换，**dsh 内核和基础插件刷新仍会问**
- `off`：不检查

---

## 离线更新（打不开下载页）

在能上网的电脑下载 Release 里的 `DeepSeekHarness-v*.zip`，拷到这台机器后任选一种：

1. 把 zip **拖到 `update.cmd` 上**
2. 把 zip 放到 `start.cmd` **同一目录**，再双击 `update.cmd`
3. 双击 `update.cmd`，按提示粘贴 zip 的完整路径

不要用金融版 zip。校验失败不会改你现有安装。

---

## 压缩包校验（安全性）

替换前会检查 zip 确实是本项目的标准便携包：

- 必须是 `.zip`；文件名带 `Finance` 的直接拒绝
- 拒绝带 `..` 或绝对路径的条目（防 zip-slip）
- `package.json` 的 `name` 必须是 `deepseek-harness-portable`
- 必须包含管理器脚本、`node.exe`、`@deepseek-ai/dsh`
- 脚本里要有「DeepSeek Harness 便携版」标记

不是本包或校验失败：提示错误，**不改当前目录**。

---

## 给老包打补丁（v1.3 及更早）

v1.3 及更早**没有**「读本地 zip / 不覆盖插件 / 询问 dsh」这套逻辑。不必把新文件夹整份盖到旧目录上（会弄乱 `home`）。

GitHub Release 上有一个很小的 **`DeepSeekHarness-updater-v*.zip`**（只有更新器，几 KB），不用解 200 MB 的完整包。

1. 下载 `DeepSeekHarness-updater-v*.zip`，解压到老便携包根目录（能看到 `start.cmd` 的那一层），覆盖下面这些文件
2. 再下载完整的 `DeepSeekHarness-v*.zip`，拖到已经换好的 `update.cmd` 上

| 必须同时替换 | 说明 |
| --- | --- |
| `update.cmd` | 入口；支持把 zip 拖到脚本上 |
| `scripts\update.js` | 更新流程 |
| `scripts\common.js` | 校验、覆盖、询问 dsh、询问基础插件、保存 `.baseline-web` 备份 |
| `scripts\start.js` | 启动；用 dsh 打印的带 token 地址打开浏览器 |

**不要把 updater 小包拖到 `update.cmd` 上**，那不是完整便携包。

**不要只换其中一个：**

- 只换 `update.cmd`：仍会跑旧的 `update.js`，只会尝试 `npm install dsh`，离线会失败
- 只换 `update.js`：会去引用新的 `runUpdates`，旧 `common.js` 没有这个导出，窗口直接报错

拷这 3 个文件后，老包自带的 Node 24 就够跑新更新器。覆盖时仍不碰 `home/`（对话、Key、已装插件）。dsh 内核会问一句；若基础插件落后，会再问要不要刷新。升完后，老包里的 `start.cmd` 等程序文件会被新 zip 替换，之后按新包逻辑走。

---

## 内核升了、插件没跟上

旧版 Web UI（例如 `@linxin666/dsh-web-ui-all`）不能在新 dsh 内核上加载，启动窗口会报 `plugin tree failed to load` 然后退出。

处理顺序：

1. **更新当时**：同意升级内核之后，若基础插件落后或已更名，会问「是否刷新基础插件？」。回车即刷新。只换本包基础插件，modlens 等自己装的保留，`cordis.patch.yml` 不改。
2. **当时选了否，后来启动失败**：再双击 `start.cmd`。窗口会说明原因，问要不要用本包基础插件修复并重新启动。本目录若已有上次更新留下的 `.baseline-web` 备份，不用再找 zip；没有备份则把 `DeepSeekHarness-v*.zip` 放到旁边或粘贴路径。
3. `.baseline-web` 是出厂基础插件备份，不是会话数据，可删；下次用 zip 更新时会再生成。

---

## 开发者：发布后用户怎么升

1. `build.cmd` 打出 `dist/DeepSeekHarness-v<ver>.zip` 和 `dist/DeepSeekHarness-updater-v<ver>.zip`
2. 两个 zip 都发到 GitHub Release
3. 已装 **v1.4+** 的用户双击 `update.cmd` 即可
4. 更老的包：先下 updater 小包打补丁，再喂完整 zip
