# 架构

UI → GameController → ChessRules → chess.js。UI 读取不可变快照；唯一 Chess 实例保持完整历史。React useSyncExternalStore 订阅控制器。

M1 状态：PLAYER_TURN、PROMOTION_PENDING、GAME_OVER。升变选择前不提交走法，取消不改变棋局。非法走法不改变局面或历史。终局冻结走棋，但允许悔棋或重新开始。本地双人悔棋回退一个半回合。

三次重复、五十步、子力不足自动判和（产品简化规则），将死优先。王车易位、吃过路兵、自将约束交给 chess.js。

M2 通过 ChessEngine 接口加入 Worker UCI adapter；请求序号、取消与旧 bestmove 排空必须一起设计，不能仅依靠 stop。M3 保存可重放走法或 PGN，不能只保存 FEN。

官方 API 参考：
- https://github.com/Clariity/react-chessboard （v5 options API）
- https://jhlywa.github.io/chess.js/ （v1.4 规则 API）

依赖版本以 package-lock.json 为准。应用无远程字体、图片或服务依赖，构建产物可部署到静态主机；file:// 直接打开不受支持。

## M2 实现

默认人机模式，控制器构造不产生副作用，React effect 连接引擎工厂并在卸载时断开，兼容 StrictMode 重挂载。

新增 ENGINE_LOADING、AI_THINKING、ENGINE_ERROR 状态。UI 无权提交 AI 走法；适配器返回 UCI 后控制器再次交给 chess.js 验证。引擎错误保留当前棋局，重试重新建立 Worker。

StockfishEngine：uci/uciok → Hash 配置 → isready/readyok；搜索队列串行执行，Skill Level 在每次搜索前设置。搜索传递初始 FEN 和完整 UCI 历史，保留重复局面信息。握手 20 秒、搜索 movetime + 20 秒超时。

取消策略：销毁 Worker 并拒绝等待中的 UCI 响应；下一次使用重建 Worker。没有在同一个 Worker 上发 stop 后立即开启新搜索，因此无需猜测一个 bestmove 属于哪个请求。Worker 身份检查隔离消息及错误回调；控制器 revision 在初始化、配置与搜索每次 await 后检查。新局、模式切换、认输、悔棋、卸载都使旧请求失效。

取舍：取消后需重新初始化 WASM，而普通连续走棋复用 Worker 和搜索缓存。单线程 lite 文件较小，避免了跨源隔离部署配置。

资源来自精确锁定的 stockfish@19.0.0。prepare-engine 脚本由 dev/build 调用，只复制 lite-single、WASM 和许可。Vite base 相对路径使资源可随静态站点部署。测试配置支持生产预览独立端口，验证真正的 dist。

## M3 实现

SavedGame v1 记录 initialFen、完整 UCI moves、GameSettings、resignedColor、待升变走法和 startedAt。GameController.restore 先校验结构，再在尚未连接 Worker 的新实例重放合法走法；终局后多余走法和无效升变/认输状态整体拒绝。棋局状态由规则重算，不保存 AI 请求、错误或 Worker。

useGameSession 订阅控制器，每次更新同步保存（不等卸载），独立保存翻转和音效偏好。加载失败降级为新局并提示；写入失败显示未保存。现阶段同源多标签页为最后保存者覆盖，不做同步。

exportPgn 在临时规则实例重放历史并写入标准头和 Result，避免修改对局中的头信息。吃子列表从合法走法 captured 派生，因此特殊吃子、升变后被吃和悔棋都与历史一致。

Web Audio 只在用户交互后创建/恢复，订阅器比较前后历史及 FEN，仅新提交一步触发提示音；重新恢复、悔棋、初始化状态变化不播放。卸载关闭 AudioContext。悔棋增加确认对话框，AI 在确认期间可完成走法；最终按当前棋局撤销玩家一步及其回应。
