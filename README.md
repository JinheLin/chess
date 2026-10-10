# Chess Lab

浏览器中的国际象棋。目前范围：M0 工程初始化、M1 本地双人；AI 留待 M2。

需要 Node.js 22.12+。

```sh
npm ci
npm run dev
```

开发地址：http://localhost:5173 。两位玩家在同一设备轮流操作。

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

构建脚本会移除所有名称包含 proxy 的环境变量，构建不走代理。不执行 make format。产物位于 dist，可供静态服务器托管。

需求、架构、迭代计划见 docs。当前没有 AI、刷新恢复、云服务或公开部署。

## 已实现

- 点击与拖拽走棋、合法落点、上一步与将军高亮、棋盘坐标和翻转。
- 王车易位、吃过路兵、后/车/象/马升变与取消。
- 将死、逼和、子力不足、三次重复、五十步自动判和。
- SAN 全部走棋记录、单步悔棋、认输、新局确认，桌面及手机布局。

本地双人悔棋每次回退一方的一步；认输后悔棋先撤销认输。刷新会开始新局，持久化按计划留待 M3。

若已安装 Chrome，可用 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`，无需下载测试浏览器。手机测试使用设备模拟，真实手机触摸拖拽与 Safari/Firefox 尚未验证。
