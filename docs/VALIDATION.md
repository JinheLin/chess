# M0 / M1 验收记录

2026-10-11

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：18 项通过；非法走法、回合控制、易位、自将、吃过路兵及失效、四种升变、取消/重开、将死、逼和、子力不足、五十步、历史重复、悔棋与认输。
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`：11 项通过、1 项按设计跳过（移动项目的鼠标拖拽）。桌面 Chrome + Pixel 7 模拟布局。
- `npm run build`：通过；构建脚本清除代理变量后调用类型检查和 Vite。
- 手动视觉检查：Codex 浏览器中棋盘、提示、移动单列布局正常。

浏览器回归中修复：自定义 squareRenderer 必须显式应用 squareStyles；棋谱滚动仅限容器；模态框关闭恢复焦点；状态区域使用独立可访问名称。

限制：未接入 AI；没有刷新恢复、PGN 导出、计时和音效；无公开部署。未验证 Safari/Firefox 和真实触摸拖拽。以上为后续里程碑范围，不宣称人机 MVP 已完成。

下一步 M2：Stockfish lite 单线程 Worker、UCI 握手与队列、搜索取消/过期结果隔离、三档强度、执白/执黑及引擎异常恢复。先补生命周期测试，再接入界面。
