# 静态发布

目标仓库：https://github.com/JinheLin/chess
目标页面：https://jinhelin.github.io/chess/

## 本地发布验证

```sh
npm ci
npx playwright install chromium
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:dist
npm run test:release
```

已有 Chrome 时在 test:release 前设置 PLAYWRIGHT_CHANNEL=chrome。默认两并发，减少测试浏览器启动争用；测试不自动重试。测试服务器只提供 dist 的静态文件，挂载 /chess/，正确提供 JS/WASM MIME，缺失文件返回 404，不依赖 Vite 开发时转换或回退。测试覆盖桌面和 Pixel 7 模拟；实际 Safari、Firefox 和手机硬件未验证。

build 脚本在调用准备资源、类型检查及 Vite 前剔除代理环境变量。verify:dist 检查引擎原始文件 SHA-256 一致、WASM 可验证、许可文本与相对路径、没有混入大型 full 引擎。

## GitHub Pages

1. 将仓库 Pages 的 Build and deployment Source 设置为 GitHub Actions。
2. 在 Actions 手动运行 Publish GitHub Pages，选择要发布的分支。
3. build 作业安装锁定依赖，运行 lint、类型检查、单元测试、构建、资源验证和整套生产浏览器回归。
4. 将发布提交的应用源码及固定版本 Stockfish 源码归档放入 dist/source，上传静态产物。
5. 仅通过 build 后才执行 deploy。默认推送只触发 Release checks，不自动发布。

应用资源采用相对路径，可在根目录或 /chess/ 子目录托管。保持 engine 下 JS/WASM 文件同名相邻，MIME 为 text/javascript、application/wasm。无需服务器 API、数据库或跨源隔离头。

同时发布 `sw.js`、`manifest.webmanifest` 和 `icons/`；清单 MIME 使用 `application/manifest+json`。离线缓存要求 HTTPS 或本机 localhost，GitHub Pages 满足要求。`sw.js` 必须可重新校验，不能配置长期 immutable 缓存；应用注册时使用 `updateViaCache: none`。

构建为页面、静态资源及完整引擎生成内容版本。旧版本在后台准备新版全部资源，等待用户点击更新或关闭全部旧页面后启用，不自动刷新正在进行的棋局。更新失败保留旧版本，原有 localStorage 不迁移、不清空。离线准备会在首次引擎就绪后开始，避免与开局争用下载；开发模式不注册 Service Worker。

发布测试增加真实引擎断网刷新与走棋、等待更新和棋局恢复、安装入口，以及 800×1280 / 1280×800 触摸平板布局。它们使用桌面 Chrome 模拟触屏及断网，实际安卓硬件和安装确认界面仍需在设备上验收。

## 上线验收

打开 HTTPS 页面，验证 JS/WASM 为 200 和正确 MIME；完成一组真实 AI 走棋；刷新保持棋谱、导出 PGN；核对 source/chess-lab.tar.gz、source/stockfish-19.tar.gz、引擎许可下载。

可直接对线上运行相同的浏览器验收（每个用例使用独立浏览器存档）：

```sh
PLAYWRIGHT_BASE_URL=https://jinhelin.github.io/chess/ npm run test:release
```

源码下载对应发布版本；应用和引擎的授权说明见 package.json、THIRD_PARTY_NOTICES.txt 和 engine/COPYING.txt。运行时不读取 CDN。

## 回滚

优先 revert 有问题的提交并推送，然后对该分支再次手动运行 Publish GitHub Pages。也可在目标历史提交创建发布分支后手动运行该分支工作流；工作流会重新验证并部署完整产物。不要只替换 WASM 或 JS 中的单个文件。

localStorage 存档按站点 origin 隔离：localhost 与 Pages 不共享。保存当前棋局及最近 100 局记录，存档 version 1；旧版没有 records、id 或 endedAt 的存档仍可恢复。升级必须保持兼容或提示降级，不应依赖上线时清空用户数据。

防沉迷限制已关闭；旧版 chess-lab.play-usage.v1 计数不再读取或更新。验收时保留旧计数与存档，确认仍可走棋、悔棋、开始新局和切换对局设置，刷新后可恢复棋局与记录。
