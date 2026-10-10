# 用 Codex 开发一款人机对弈国际象棋程序：需求与开发计划

我建议把这个项目定位为：一款界面精致、规则完整、支持多个 AI 难度、可以直接在浏览器中运行的国际象棋游戏。

采用 Codex 作为主要开发工具，先实现一个真正可玩的 MVP，然后逐步加入棋局分析、棋谱管理、AI 棋力调节等能力。

这里有一个重要的技术决策：开发国际象棋游戏和开发国际象棋 AI 引擎是两件不同的事情。

前者涉及棋盘 UI、走棋规则、游戏状态、交互体验；后者涉及局面评估、博弈树搜索、Alpha-Beta 剪枝、置换表等算法。

我的建议是先把这两部分解耦。第一版集成成熟的 Stockfish 引擎，以较低成本得到一个完整产品。如果以后想研究博弈搜索算法，再用 C++ 或 Rust 编写自己的引擎。

## 一、产品定位与需求范围

V1 · MVP

完整的人机对弈

玩家可以选择执白或执黑，和电脑完成一局标准国际象棋。支持合法走棋、特殊规则、胜负判定、难度选择、悔棋、重新开始。

V2 · 体验增强

更像一款成熟的国际象棋游戏

增加棋谱保存、PGN 导入导出、局面分析、提示、计时器、历史对局、更多难度设置。

V3 · 深度扩展

棋力研究与训练

支持自研 AI 引擎、引擎对战、残局练习、开局训练、搜索过程可视化等。

### 1.1 第一版必须实现的功能

| 模块    | 需求                    | 优先级 |
| ----- | --------------------- | --- |
| 棋盘    | 标准 8×8 棋盘、棋子、坐标、翻转棋盘  | P0  |
| 走棋交互  | 拖拽走棋、点击走棋、合法落点提示      | P0  |
| 规则    | 合法走棋、将军、王车易位、吃过路兵、兵升变 | P0  |
| 人机对弈  | 玩家执白/执黑，AI 自动响应       | P0  |
| AI 难度 | 初级、中级、高级，至少三个档位       | P0  |
| 对局状态  | 将死、逼和、和棋、认输、游戏结束提示    | P0  |
| 对局操作  | 开始新局、悔棋、重新开始          | P0  |
| 棋谱    | 显示 SAN 标准记谱的完整走棋记录    | P0  |
| 界面    | 桌面浏览器、移动端自适应          | P0  |
| 状态恢复  | 刷新后恢复当前对局             | P1  |
| 棋谱导出  | 支持 PGN 导出             | P1  |
| 辅助功能  | 上一步高亮、音效、吃子展示         | P1  |

其中规则层必须考虑国际象棋中特别容易遗漏的情况：王车易位不能穿过被攻击的格子；兵升变应当允许选择后、车、象、马；吃过路兵要正确处理；重复局面及五十步规则需要考虑历史状态。

第一版可以采用简化的和棋裁定方式，后续再严格区分正式比赛规则中的可申请和棋与自动和棋。

### 1.2 第一版明确不做什么

不做用户账户、云端存档、联网匹配、排行榜、多人对战、服务器端数据库，也不从零实现国际象棋规则或者 AI 搜索引擎。

这样可以把项目控制在一个非常清晰的范围内：单机、浏览器、完全客户端运行、无需服务器。

## 二、界面设计

我建议采用类似 Chess.com、Lichess 的经典左右布局，突出棋盘，减少无关元素。

Chess Lab

人机对弈 · 单机版

对局设置

玩家

白方

对手

AI 中级

走棋记录

1\. e4 e5

2\. Nf3 Nc6

3\. d4 exd4

AI 思考中…

悔棋

新游戏

布局概念示意，非实际游戏画面。正式版本会使用棋子图片、动画、合法落点标记和响应式布局。

桌面端采用棋盘左侧、对局面板右侧的布局；手机端将对局面板放到棋盘下方。

完整交互的重点不是把棋盘画出来，而是保证每一次操作都能得到清晰反馈，例如：非法走棋不改变局面，AI 思考时显示状态，兵升变时弹出选择窗口，对局结束时清晰展示结果。

## 三、技术选型

我推荐采用 TypeScript + React + Stockfish WebAssembly 的纯前端架构。

| 技术层   | 推荐方案                                                             | 选择原因                   |
| ----- | ---------------------------------------------------------------- | ---------------------- |
| 开发语言  | TypeScript                                                       | 类型安全，Codex 易于生成和维护     |
| 应用框架  | React + Vite                                                     | 简洁、开发反馈快               |
| UI 样式 | Tailwind CSS                                                     | 快速实现响应式界面              |
| 棋盘组件  | [react-chessboard](https://github.com/Clariity/react-chessboard) | 提供棋盘、拖拽、动画等交互          |
| 规则引擎  | [chess.js](https://github.com/jhlywa/chess.js)                   | 提供合法走棋、将死、和棋判定等能力      |
| AI 引擎 | [Stockfish.js](https://github.com/nmrugg/stockfish.js)           | 基于 WebAssembly，浏览器本地运行 |
| 测试    | Vitest + Playwright                                              | 单元测试和完整 UI 测试          |
| 存储    | localStorage                                                     | 保存当前棋局和设置              |
| 部署    | 静态网站                                                             | 无需数据库及后端服务             |

`chess.js` 只负责规则，不包含 AI；`react-chessboard` 则负责棋盘界面。两者的职责可以非常清晰地分离。

[image](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+1



Stockfish.js 当前提供多种构建，其中 `lite single-threaded` 版本约 1.7 MB，不需要额外配置跨源隔离，适合作为第一版引擎。

[image](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub



需要注意，Stockfish.js 采用 GPLv3 许可证。公开分发包含该引擎的产品时，必须遵守对应的源码及许可条款，必要时应评估它与整个应用的许可关系。

[image](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub



## 四、核心架构设计

推荐把整个系统拆成四个独立模块。

UI Layer

React · Chessboard · Controls · Move History

Game Controller

游戏状态机 · 回合控制 · 悔棋 · 新游戏

Rules Engine

chess.js

合法走棋、FEN、PGN、胜负判定

AI Engine Adapter

UCI / Web Worker

Stockfish、难度、搜索与取消

Stockfish WASM

独立 Worker 线程

### 4.1 Game Controller：最重要的模块

它负责协调 UI、规则和 AI，不允许 UI 直接修改棋局。

建议将游戏定义为明确的状态机：

`READY → PLAYER_TURN → AI_THINKING → PLAYER_TURN → GAME_OVER`

需要额外处理 `PROMOTION_PENDING`、引擎初始化失败、重开游戏、悔棋等情况。

每次玩家走棋，都必须经过以下流程：

1. UI 提交候选走法。
2. Game Controller 调用规则引擎判断是否合法。
3. 合法后更新棋局，记录历史，检查对局是否结束。
4. 若未结束，提交当前 FEN 给 AI 引擎。
5. AI 返回最佳走法，由规则引擎再次验证后提交。
6. 更新游戏状态并交还玩家控制权。

规则引擎是棋局的唯一权威，棋盘组件只负责展示。

不要在 React 棋盘组件、Game Controller 和 Stockfish 之间分别保存可独立修改的棋局状态，否则非常容易出现同步问题。

### 4.2 Engine Adapter：为未来扩展预留空间

引擎适配层建议定义统一的 TypeScript 接口：

```
interface ChessEngine {
  initialize(): Promise<void>;

  setDifficulty(level: number): Promise<void>;

  getBestMove(
    fen: string,
    options: {
      movetimeMs: number;
      signal?: AbortSignal;
    }
  ): Promise<string>;

  dispose(): void;
}
```

实际还要处理引擎状态、搜索取消和错误传播。

Stockfish 使用 UCI 协议，例如：

```
uci
isready
position fen <FEN>
go movetime 1000

bestmove e7e5
```

Stockfish 的响应是 UCI 走法，而不是用户界面上展示的 SAN 记谱。需要通过规则层进行转换。

有一个特别值得提前设计的细节：异步搜索的生命周期管理。

例如玩家走棋后，AI 正在搜索，这时玩家点击了“新游戏”。旧搜索可能稍后返回一个 `bestmove`。如果直接执行，就会把上一局的走法错误地应用到新对局。

需要在 Engine Adapter 中实现搜索序列化、停止搜索和请求失效机制。新游戏、悔棋、卸载组件时，应废弃旧搜索结果。注意 UCI 的 `stop` 不会自动取消已经发送的所有响应，必须正确处理旧的 `bestmove`。

### 4.3 AI 难度如何实现

Stockfish 自带 `Skill Level`、`UCI_LimitStrength` 和 `UCI_Elo` 等选项，可以降低实际对弈强度，而不只是限制搜索深度。

[image](https://www.google.com/s2/favicons?domain=https://official-stockfish.github.io\&sz=32)

Stockfish Docs



第一版建议只暴露三个级别：

| 级别 | 面向用户       | 实现思路           |
| -- | ---------- | -------------- |
| 初级 | 刚学国际象棋的玩家  | 低 Skill Level  |
| 中级 | 已掌握基本规则的玩家 | 中等 Skill Level |
| 高级 | 有一定实战经验的玩家 | 较高 Skill Level |

这里不要直接标注具体 Elo，除非经过实测。Stockfish 即使设置较低的 Skill Level，也未必适合完全零基础的儿童。

如果后续希望实现真正友好的入门 AI，可以增加一个弱化引擎，在合法走法中结合简单局面评估和随机性选择。

## 五、开发计划：分为五个迭代

建议把每个迭代作为一个独立的 Codex 任务组。每完成一个迭代，都要求代码可运行、测试通过、能独立验收。

M0

工程初始化

初始化 Vite、React、TypeScript、Tailwind、Vitest、Playwright；建立目录、开发脚本、代码规范、Codex 项目指令。

验收：`npm run dev` 能启动页面；lint、类型检查和测试命令均可运行。

M1

完成棋盘与规则

实现棋盘、走棋操作、合法走法提示、规则引擎、兵升变、胜负判断与棋谱显示。先支持本地双人轮流走棋，验证完整的规则交互。

验收：不依赖 AI，就能从开局正确完成一局国际象棋。

M2

接入 AI 引擎

在 Web Worker 中加载 Stockfish，封装 UCI 协议，增加执黑执白选择、三个难度、AI 思考状态及引擎错误处理。

验收：能够独立与 AI 完成对局；中途悔棋、重开、切换执棋方不会导致异步状态错误。

M3

完善交互体验

优化响应式布局、棋子动画、最近一步高亮、局面提示、悔棋与重新开始确认、落子反馈。增加刷新恢复功能。

验收：桌面和手机浏览器操作自然，刷新后能恢复当前对局与完整历史。

M4

系统测试与发布

补全规则测试、引擎生命周期测试、Playwright 浏览器测试；检查 Worker 和 WASM 资源打包；完成静态网站部署。

验收：自动化测试通过，生产构建正常，实际部署后可以稳定完成多局人机对弈。

我建议将 M2 作为第一个重要里程碑，因为到这一步已经真正实现了人机对弈，后续都是体验和质量方面的改进。

## 六、测试需求

国际象棋项目的复杂度并不在 UI，而在规则边界和异步状态。

建议至少覆盖以下测试。

| 测试场景       | 预期结果              |
| ---------- | ----------------- |
| 标准开局       | 白方有 20 个合法走法      |
| 非法走棋       | 棋局和走棋历史保持不变       |
| 王车易位       | 经过被攻击格子的易位被拒绝     |
| 吃过路兵       | 只有满足规则的回合可执行      |
| 兵升变        | 可选择后、车、象、马        |
| 将死与逼和      | 正确识别不同结果          |
| 三次重复       | 按产品定义处理和棋         |
| 悔棋         | 正确回退双方走法          |
| 执黑开始       | AI 执白先走           |
| AI 正在思考时重开 | 旧搜索结果不会污染新局       |
| 页面刷新       | 当前局面、走棋历史、执棋方正确恢复 |
| AI 返回非法走法  | 拒绝走法并进入安全错误处理     |

另外，建议专门测试序列化与恢复：只保存 FEN 不足以恢复完整的重复局面判定历史。持久化时应保存棋谱或可重放的走棋记录，并在恢复时重建状态。

## 七、怎样让 Codex 高效完成这个项目

不要让 Codex 一次完成全部功能。更好的方式是将需求文档作为长期约束，再按里程碑交付。

### 7.1 推荐的目录结构

```
chess-lab/
├── AGENTS.md
├── docs/
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   └── PLAN.md
├── src/
│   ├── components/
│   │   ├── ChessBoard/
│   │   ├── GameControls/
│   │   └── MoveHistory/
│   ├── game/
│   │   ├── GameController.ts
│   │   ├── GameState.ts
│   │   └── ChessRules.ts
│   ├── engine/
│   │   ├── ChessEngine.ts
│   │   ├── StockfishEngine.ts
│   │   └── UciProtocol.ts
│   ├── storage/
│   ├── hooks/
│   └── App.tsx
├── tests/
│   ├── unit/
│   └── e2e/
└── package.json
```

`AGENTS.md` 用于向 Codex 说明编码规范、架构边界、测试要求等。Codex 支持自动读取这些仓库级指令。

[image](https://www.google.com/s2/favicons?domain=https://developers.openai.com\&sz=32)

OpenAI Developers



不要把它写得过于冗长，关键是让 Codex 知道哪些原则不能破坏。

### 7.2 第一次交给 Codex 的提示词

下面这段可以直接作为第一次开发任务使用。

你是一名资深 TypeScript / React 工程师。请帮我开发一个名为 Chess Lab 的单机国际象棋 Web 应用。

## 项目目标

开发一个可以在浏览器中与 AI 完整对弈的国际象棋程序。第一版无需后端、账户系统或联网对战。

## 技术栈

- React + TypeScript + Vite
- Tailwind CSS
- react-chessboard：棋盘 UI
- chess.js：规则引擎
- Stockfish.js：AI 引擎，采用 Web Worker 和 WebAssembly
- Vitest：单元测试
- Playwright：端到端测试

## 架构约束

1. 分离 UI、Game Controller、Chess Rules、AI Engine Adapter。
2. 规则引擎是棋局状态的唯一权威，UI 不得自行修改棋局。
3. 所有 AI 搜索必须通过统一的 ChessEngine 接口访问。
4. AI 运行在 Web Worker 中，不得阻塞 UI。
5. 必须考虑异步搜索的取消、过期结果、重新开始和组件卸载。
6. 不引入不必要的后端、数据库或状态管理框架。
7. 优先使用成熟库，不重新实现完整国际象棋规则。
8. 每个功能必须包含必要的测试。

## 开发流程

请先执行 M0 和 M1，不要直接实现后续里程碑。

第一步：检查依赖和官方 API，设计目录结构，创建 AGENTS.md、docs/REQUIREMENTS.md、docs/ARCHITECTURE.md 和 docs/PLAN.md。

第二步：初始化项目和测试环境。

第三步：实现一个可以本地双人轮流走棋的棋盘，支持完整规则、特殊走法、胜负判定和走棋记录。

第四步：补充单元测试和 Playwright 测试。

完成后运行 lint、类型检查、单元测试和生产构建。总结已完成的功能、测试结果、已知问题和下一步建议。

不要在 M1 阶段集成 Stockfish。

第一轮通过后，再让 Codex 执行 M2。这样可以保证引入 AI 时，棋盘和规则层已经稳定。

### 7.3 每次 Codex 任务都要求交付四件事

- 代码变更及简短设计说明。
- 对应的自动化测试。
- 实际运行过的测试命令与结果。
- 尚未解决的问题和风险。

每完成一个里程碑就创建 Git commit。不要让 Codex 在开发后面的功能时顺手大规模重写已验证的前面模块。

## 八、后续值得扩展的方向

第一版完成之后，我认为最有价值的是下面三个方向。

方向 A：棋局分析。 加入 Stockfish 局面评分、最佳走法、候选变化（Principal Variation）、失误识别和对局复盘。这会使程序从普通游戏升级为学习工具。

方向 B：训练模式。 支持残局练习、一步杀、两步杀、开局训练和分级训练。对希望系统学习国际象棋的人，比单纯提高 AI 棋力更有意义。

方向 C：自研棋力引擎。 可以考虑使用 Rust 实现自己的 `ChessEngine`，通过相同的 UCI 协议与现有 UI 对接，依次研究走法生成、Perft、局面评估、Negamax、Alpha-Beta、Iterative Deepening、Transposition Table 和搜索排序。

尤其是方向 C，既能充分利用 C++/Rust 系统开发经验，也能把项目演化为一个有技术研究价值的工程，而不必牺牲已有的产品功能。

## 九、最终建议

建议的第一阶段交付目标

MVP

一款无需服务器、打开网页即可与 AI 下完整国际象棋的应用。

MVP 验收清单

0/7

可选择执白或执黑

完整、准确的国际象棋走棋规则

三档 AI 棋力

悔棋、认输、重新开始

棋谱记录与本地恢复

桌面和移动端可用

具备自动化测试并可独立部署

我最建议坚持的一个原则：先把程序做成可靠、可玩的游戏，再考虑把它做成强大的国际象棋系统。 这样也最适合 Codex 以小任务、可验证、持续迭代的方式完成开发。