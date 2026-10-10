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
