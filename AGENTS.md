# Chess Lab

- 编译程序时不要走代理。使用 `npm run build`，脚本会清除代理环境变量。
- 不要执行 `make format`。
- React + TypeScript；UI 仅提交操作，GameController 是唯一修改棋局的入口。
- chess.js 是规则与历史的唯一权威；不要另写规则或复制可变棋局。
- M0/M1 只做本地双人；M2 才接入 Stockfish Worker，通过 ChessEngine 接口使用。
- 特殊规则及状态转换需单元测试；关键用户流程需 Playwright 测试。
- 每个里程碑运行 lint、typecheck、test、test:e2e、build，并单独提交 Git commit。
