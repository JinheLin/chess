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

# M2 验收记录（当前版本）

2026-10-11。上面的 M0/M1 记录保留为历史；M2 已完成 Stockfish 人机对弈。

- `npm run lint`、`npm run typecheck`、`git diff --check`：通过。
- `npm test`：40 项通过。新增 UCI 握手、搜索串行、难度快照、初始局面和完整历史传递、取消/超时/销毁、旧 Worker 消息与错误隔离；控制器执黑先手、悔棋、新局、配置切换、非法 AI 走法、重试、卸载和终局。
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`：19 项通过、1 项按设计跳过。含真实 Stockfish WASM 的桌面与 Pixel 7 模拟测试，原本地双人流程全部回归。
- `npm run build`：通过；JS/WASM/GPL 资源完整进入 dist/engine，未打包大型 full 引擎。
- `PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PRODUCTION=1 npm run test:e2e -- tests/e2e/ai.spec.ts --project=desktop`：4 项通过。在静态生产预览中验证真实 AI 应答、双方悔棋、重开、三档强度、执黑开局、搜索期间切换及 WASM 请求失败后的恢复。
- Codex 内置浏览器视觉检查：默认人机模式、Stockfish 中级标签、对局设置入口、移动布局正常。

范围限制：尚无刷新恢复、PGN 导出、音效或公开部署。真实移动触摸拖拽以及 Safari/Firefox 未验证；三档棋力未做 Elo 标定。引擎资源加载超时为 20 秒，失败后可重试或改用本地双人。

实现取舍：取消即销毁旧 Worker，换取确定的响应隔离；代价是取消后的首次搜索需要重新初始化轻量 WASM。正常连续回合复用 Worker。

# M3 验收记录（当前版本）

2026-10-11。M3 完成完整历史恢复、设置恢复、PGN 导出、合成音效、吃子展示和悔棋确认。

- `npm run lint`、`npm run typecheck`、`git diff --check`：通过。
- `npm test`：60 项通过，新增存档结构及非法数据校验、历史重放、三次重复、易位权、过路兵、四种升变、认输、PGN 解析回环、音效分类与资源释放、AI 历史续局及恢复后取消升变。
- `npm run build`：通过，编译进程清除代理环境变量；未执行 make format。
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`：初跑 28 项通过、1 项跳过、1 项浏览器 context 启动超时；后者单独执行 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- tests/e2e/ai.spec.ts --project=desktop --grep 'failed WASM' --workers=1` 通过。合计 29 项用例通过，移动鼠标拖拽用例按设计跳过。
- `PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PRODUCTION=1 npm run test:e2e -- tests/e2e/session.spec.ts --project=desktop --workers=2`：5 项通过，针对实际 dist 验证持久化、真实 AI 刷新续局、PGN 下载、待升变、重复终局、认输和存储失败降级。
- 内置浏览器视觉检查：吃子、音效开关、保存提示和 PGN 导出控件无重叠；移动浏览器用例验证无水平溢出。

范围限制：仅保存当前对局；同源多标签页最后保存覆盖；无 PGN 导入或历史对局列表。真实移动触摸拖拽、Safari/Firefox 和实际扬声器听感未验证（音效创建、分类、静音偏好及恢复已测试）。M4 公开部署未开始。

# M4 发布验收

2026-10-11。增加严格静态服务器下的完整回归、引擎生命周期测试、发布资源校验，以及 GitHub Actions / Pages 工作流。

- `npm run lint`、`npm run typecheck`、`npm test`：通过，63 项单元测试通过。
- `npm run build`、`npm run verify:dist`：通过；构建清除代理变量，校验轻量引擎 JS/WASM 原始哈希、许可及相对资源路径。
- 发布回归覆盖桌面和 Pixel 7 模拟、三局连续真实引擎对弈、切换执棋、搜索期间认输、真实引擎将死、刷新恢复、PGN 导出和错误重试。
- `PLAYWRIGHT_CHANNEL=chrome npm run test:release`：35 项通过，1 项按设计跳过（移动端鼠标拖拽）；完整生产回归通过。
- GitHub Pages 发布前自动执行全套检查，发布包同时包含应用及固定版本 Stockfish 源码。
- 已发布版本 `9478676`：https://jinhelin.github.io/chess/ 。[发布工作流](https://github.com/JinheLin/chess/actions/runs/38096844956) 与 Release checks 均成功。
- `PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_BASE_URL=https://jinhelin.github.io/chess/ npm run test:release`：线上完整回归 35 项通过、1 项按设计跳过、0 项失败；包含桌面和移动布局的三局连续真实 AI 对弈。
- 线上应用源码、固定版本 Stockfish 源码及 GPL 许可下载均返回 HTTP 200。JS/WASM MIME、缺失资源 404、刷新恢复、PGN 下载已由线上测试验证。

线上产物对应 `9478676`；随后验收记录及线上测试入口的提交不修改应用产物。

浏览器覆盖范围仍为 Chromium；真实手机触摸拖拽、Safari/Firefox 未验证。

# M3.5 棋手人格验收

2026-10-11，在 M4 之后追加实现。

- `npm run lint`、`npm run typecheck`、`npm test`：通过，84 项单元测试。
- `npm run build`、`npm run verify:dist`：通过；构建按既有脚本清除代理变量，没有执行 make format。
- `PLAYWRIGHT_CHANNEL=chrome npm run test:release`：完整生产包回归，39 项通过、1 项按设计跳过（移动端鼠标拖拽）。含三种性格切换、频率/静音保存、真实裁判分析、对话不泄露后续走法、终局话语与新局/悔棋清空故事。
- 单元覆盖：UCI cp/mate 分离、评分视角、深度稳定性、bound/multipv 排除、普通好棋不误报妙手、吃后不推断胜负、AI 自责、情绪边界、实际嘲讽记忆的逆转呼应、冷却/语义/文本去重，以及忽略取消的旧结果在悔棋、新局、换人、静音、下一次落子、卸载后仍被隔离。
- 内置浏览器检查：人物矢量头像、人物/频率选择和气泡显示正常；移动布局由 Pixel 7 模拟回归覆盖。

范围：离线事件台词；没有外部语言模型、语音、开局命名或玩家聊天。短时间裁判属于保守启发式，不是客观棋理证明；不足以稳定判断时不评价走法质量。故事在当前会话内保留，刷新/悔棋/换人会清空；人物偏好单独持久化。Safari/Firefox 与真实移动硬件尚未验证。

M3.5 已发布提交 `688e1b6`：[发布记录](https://github.com/JinheLin/chess/actions/runs/38117090936)。线上运行 `PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PRODUCTION=1 PLAYWRIGHT_BASE_URL=https://jinhelin.github.io/chess/ npm run test:e2e -- tests/e2e/personality.spec.ts`，桌面及移动共 4 项全部通过。
