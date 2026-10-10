# Chess Lab

浏览器中的国际象棋。M0、M1、M2、M3 已完成：本地双人及 Stockfish 人机对弈，无后端。

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

刷新自动恢复当前棋局、完整历史、对弈设置、棋盘方向及音效开关；支持 PGN 导出、吃子展示和悔棋确认。手机测试使用设备模拟，真实触摸拖拽与 Safari/Firefox 尚未验证。


## M3：保存与交互

每次棋局或偏好变化同步保存到当前站点的 localStorage，仅保留当前对局。恢复时逐步校验并重放完整 UCI 历史，保留重复局面、易位权、吃过路兵、待升变和认输结果。刷新时若轮到 AI，会重新搜索并仅执行一次合法应答。

存档损坏时提示并开始新局；存储被禁用或容量不足时显示保存失败，不中断对弈，可导出 PGN 备份。不同浏览器或不同站点地址不共享存档；多个标签页写同一存档时最后一次保存生效，不做实时同步。

「导出 PGN」下载含双方名称、开局日期（UTC）、完整 SAN 与比赛结果的棋谱。新局会替换当前存档，需保留旧局时先导出。M3 不包含 PGN 导入和历史对局列表。

落子、吃子、将军及终局使用不同的本地合成短音。浏览器要求先在页面进行一次交互才能出声；可通过棋盘下方音效按钮静音，刷新保留设置。恢复和悔棋不重播落子音效。音效不可用不影响走棋。
