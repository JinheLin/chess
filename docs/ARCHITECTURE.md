# 架构

UI → GameController → ChessRules → chess.js。UI 读取不可变快照；唯一 Chess 实例保持完整历史。React useSyncExternalStore 订阅控制器。

M1 状态：PLAYER_TURN、PROMOTION_PENDING、GAME_OVER。升变选择前不提交走法，取消不改变棋局。非法走法不改变局面或历史。终局冻结走棋，但允许悔棋或重新开始。本地双人悔棋回退一个半回合。

三次重复、五十步、子力不足自动判和（产品简化规则），将死优先。王车易位、吃过路兵、自将约束交给 chess.js。

M2 通过 ChessEngine 接口加入 Worker UCI adapter；请求序号、取消与旧 bestmove 排空必须一起设计，不能仅依靠 stop。M3 保存可重放走法或 PGN，不能只保存 FEN。

官方 API 参考：
- https://github.com/Clariity/react-chessboard （v5 options API）
- https://jhlywa.github.io/chess.js/ （v1.4 规则 API）

依赖版本以 package-lock.json 为准。应用无远程字体、图片或服务依赖，构建产物可部署到静态主机；file:// 直接打开不受支持。
