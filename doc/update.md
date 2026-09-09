# 更新

便携包更新分三块，互不影响：

| 内容 | 更新时怎么做 |
| --- | --- |
| 启动脚本、便携 Node 等程序文件 | 可以原地替换 |
| **你已经在用的插件**（`home` 里） | **一律不改**，只可能提示「比本包基础版旧」 |
| **dsh 内核** | **先问，同意才换** |

压缩包只提供**第一次安装**的基础插件。用过之后，插件由你在网页「设置 → 插件」里自行升级。

对话记录、API Key、个人设置在 `home/`，更新不会覆盖。你改过的 `config.json` 项也会保留（新字段会补上）。

---

## 在线更新（能打开 GitHub）

双击 `update.cmd`。脚本会先探测 [GitHub Release 下载页](https://github.com/Sean1840/DeepSeekHarnessPacker/releases/latest) 能不能打开（用网页请求，不是 ICMP ping，避免公司网禁 ping 却能上网的误判）。

能打开则自动下载最新 `DeepSeekHarness-v*.zip`，校验后替换程序文件，再询问是否升级 dsh 内核。

`start.cmd` 启动前也会检查。`config.json` 里 `autoUpdate`：

- `ask`（默认）：询问
- `auto`：程序文件可自动换，**dsh 内核仍会问**
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

做法：从**新版 zip**（或本仓库对应文件）把下面 **3 个文件一起**拷进老包根目录（覆盖）：

| 必须同时替换 | 说明 |
| --- | --- |
| `update.cmd` | 入口；支持把 zip 拖到脚本上 |
| `scripts\update.js` | 更新流程 |
| `scripts\common.js` | 校验、覆盖、询问 dsh、提示旧插件 |

然后把新的 `DeepSeekHarness-v*.zip` 拖到这个 `update.cmd` 上。

**不要只换其中一个：**

- 只换 `update.cmd`：仍会跑旧的 `update.js`，只会尝试 `npm install dsh`，离线会失败
- 只换 `update.js`：会去引用新的 `runUpdates`，旧 `common.js` 没有这个导出，窗口直接报错

拷这 3 个文件后，老包自带的 Node 24 就够跑新更新器。覆盖时仍不碰 `home/`（对话、Key、已装插件）。dsh 内核会问一句。升完后，老包里的 `start.cmd` 等程序文件会被新 zip 替换，之后按新包逻辑走。

---

## 开发者：发布后用户怎么升

1. `build.cmd` 打出 `dist/DeepSeekHarness-v<ver>.zip`
2. 发到 GitHub Release
3. 已装 **v1.4+** 的用户双击 `update.cmd` 即可
4. 更老的包：先按上一节打 3 文件补丁，再喂新 zip
