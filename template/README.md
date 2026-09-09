# DeepSeek Harness 便携版（Windows）

开箱即用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 绿色包：**不用装 Node、不用命令行、可以离线用**。数据全在本文件夹，删掉文件夹即卸载。

## 现在就用

1. 解压到任意目录（路径尽量不要有中文和空格）
2. 双击 **`start.cmd`**
3. 浏览器打开 `http://127.0.0.1:20000`，在「设置 → 模型」填入 DeepSeek API Key

窗口开着就是在跑；关掉窗口或 `Ctrl+C` 即停止。

## 说明文档

| 文档 | 内容 |
| --- | --- |
| [快速开始](doc/quick-start.md) | 三个入口、卸载 |
| [更新](doc/update.md) | 在线 / 离线更新；老包如何打补丁；不会覆盖你的插件 |
| [配置](doc/config.md) | `config.json` |
| [插件](doc/plugins.md) | 本包自带的基础插件 |
| [常见问题](doc/faq.md) | 端口、离线、数据在哪 |

更新时：**不替换你已装的插件**；**dsh 内核要你同意才换**；`home`（对话、API Key）保留。老版本便携包请看 [给老包打补丁](doc/update.md#给老包打补丁v13-及更早)。
