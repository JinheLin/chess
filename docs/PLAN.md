# 里程碑

- M0（已完成）：工程、文档、React/Vite/TypeScript/Tailwind、ESLint/Vitest/Playwright，独立提交。
- M1（已完成）：本地双人、完整规则、点击/拖拽、升变选择、SAN、翻转、悔棋、新局、认输、响应式，独立提交。
- M2（已完成）：Stockfish WebAssembly Worker、三档难度、执棋选择、请求取消与错误处理。
- M3（已完成）：恢复完整历史、音效、导出、体验打磨。
- M3.5（已完成）：棋手人格、独立裁判分析、事件台词、情绪及局内记忆；在 M4 之后追加实现。
- M4（已完成）：引擎生命周期与部署回归、公开静态部署：https://jinhelin.github.io/chess/。

本轮验收：npm run lint / typecheck / test / test:e2e / build 全部通过。浏览器测试覆盖 Chromium 桌面及移动触摸布局。没有上线目标时不自行发布。
