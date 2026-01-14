# nav.du.dev

个人常用网站导航页，风格参考 `ddgksf2013.top`，支持：
- 单层分类 + 卡片网格
- 模糊搜索（名称/链接/说明）
- 拼音/拼音缩写搜索（基于 `pinyin-pro`）
- 深色/浅色主题（默认跟随系统，可一键切换）
- 右下角按钮组：主题切换 + 返回顶部（带滚动进度环）
- 本地“后台”：添加链接、导入/导出配置（保存在 `localStorage`）

设计说明见：`DESIGN.md`。

## 本地开发

```bash
npm install
npm run dev
```

## 配置数据

默认配置文件：`src/data/nav.yaml`

运行时行为：
- 页面启动会加载 `src/data/nav.yaml`
- 如果 `localStorage` 存在导入/编辑后的配置，会覆盖默认配置
- 右上角“重置”会清除本地覆盖配置并回到 `src/data/nav.yaml`

## 部署（Cloudflare Pages）

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- 绑定域名：`nav.du.dev`

## favicon 代理（Cloudflare Workers）

前端会从环境变量读取 favicon 代理地址：
- `VITE_FAVICON_PROXY_BASE`（例：`https://favicon.du.dev/ico`）
- 不设置则默认使用：`https://favicon.du.dev/ico`

Worker 代码在：`workers/favicon`。

### 本地调试（推荐）

终端 1：启动 Worker
```bash
npm run worker:favicon:typecheck
npm run worker:favicon:dev
```

终端 2：启动前端并指向本地 Worker（wrangler 默认端口 8787）
```bash
VITE_FAVICON_PROXY_BASE="http://127.0.0.1:8787/ico" npm run dev
```

### 部署

```bash
npm run worker:favicon:deploy
```

### KV 绑定（可选但推荐）

`workers/favicon/src/index.ts` 支持绑定 KV（用于缓存解析出来的 favicon URL 元信息）。
在 Cloudflare Dashboard 创建 KV 后，将绑定添加到 `workers/favicon/wrangler.toml`。

## GitHub

仓库：`github.com/sonnedu/nav-du-dev`
