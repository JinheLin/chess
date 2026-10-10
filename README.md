# Chess Lab

浏览器中的国际象棋。M0、M1、M2 已完成：本地双人及 Stockfish 人机对弈，无后端。

需要 Node.js 22.12+。

```sh
npm ci
npm run dev
```

打开 http://localhost:5173 ，默认执白对弈中级 Stockfish。
点击「对局设置」选择执白/执黑、初级/中级/高级，或切回本地双人；应用设置会确认开始新局。

## 功能

- 点击与拖拽走棋、合法落点、上一步及将军高亮、棋盘坐标和翻转。
- 完整规则：王车易位、吃过路兵、后/车/象/马升变与取消；将死、逼和、子力不足、三次重复、五十步自动判和。
- SAN 棋谱、认输、新局确认、桌面及移动布局。
- Stockfish 19 lite single-threaded WebAssembly，在 Worker 中本机计算。
- 三档 Skill Level：0 / 8 / 16，单步思考时间 300 / 650 / 1200 ms；不宣称具体 Elo，初级仍有一定棋力。
- 加载/思考状态、错误提示和保留当前局面的重试。
- AI 思考时可悔棋、重开、切换设置和认输。取消会销毁旧 Worker，控制器另用请求编号拦截过期结果。

本地双人悔棋回退一个半回合。人机悔棋撤销玩家最近一步及已有的 AI 应答；AI 思考中只撤销玩家一步。执黑开局尚未走棋时不能撤销 AI 的白方首步。认输后悔棋先撤销认输。

## 验证

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

已安装 Chrome 时可运行 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`。
生产包引擎回归：先 build，再运行 `PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PRODUCTION=1 npm run test:e2e -- tests/e2e/ai.spec.ts --project=desktop`。

构建脚本清除所有名称包含 proxy 的环境变量后调用类型检查及 Vite，构建不走代理。不执行 make format。

## 静态资源与部署

`npm run dev` 和 `npm run build` 自动从锁定的 stockfish npm 包复制 lite-single JS、WASM 和 GPL 许可到 public/engine。仅约 1.7 MB 的轻量引擎被发布，全量引擎不进入产物。

将整个 dist 目录供静态服务器托管，保留 engine 路径及文件名。JS 应使用 JavaScript MIME，WASM 使用 application/wasm。无需跨源隔离头。应用运行时不依赖 CDN；从静态服务器打开，不能通过 file:// 运行。

引擎采用 GPLv3，文件保持原样。许可证和固定版本源码链接随产物提供，见 public/THIRD_PARTY_NOTICES.txt；对外分发时需按 GPL 提供对应源码。未进行公开部署。

当前刷新会开始新局；保存恢复、PGN 导出、音效留待 M3。手机测试使用设备模拟，真实触摸拖拽与 Safari/Firefox 尚未验证。
