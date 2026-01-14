# nav导航页（我的收藏夹）

项目英文名：nav-du

效果参考站点： https://nav.du.dev

## 功能特性

- 左侧分类菜单 + 右侧卡片网格
- 搜索：名称/链接/描述 + 拼音/拼音缩写 + 模糊匹配
- 主题：浅色/深色/跟随系统
- 回到顶部（带下滑进度环）
- 管理后台（`/admin`）：维护链接（Cloudflare Pages Functions）
- favicon 代理 Worker（带缓存）

## 本地开发

```bash
npm install
npm run dev
```

打开：`http://127.0.0.1:5173`

## 本地验证

### 1）页面与交互（手动）

- 电脑端：侧栏固定、右侧滚动、搜索、主题切换、回到顶部
- 手机/Pad：设备模式下抽屉菜单、点击区域、滚动体验

### 2）管理后台与 /api（需要 Wrangler）

仅 `npm run dev` 不会运行 Pages Functions。

- 终端 A：`npm run dev`
- 终端 B：`npx wrangler pages dev --proxy 5173`

用 Wrangler 输出的本地地址访问 `/admin`。

### 3）自动化测试（Playwright E2E）

首次安装浏览器（只需一次）：

```bash
npx playwright install
```

运行测试：

```bash
npm run test:e2e
npm run test:e2e:chromium
```

## 配置

默认配置：`src/data/nav.yaml`

可通过配置或环境变量覆盖：
- 左侧标题：`VITE_SIDEBAR_TITLE`
- 右侧标题：`VITE_BANNER_TITLE`
- 时区：`VITE_TIME_ZONE`（默认东八区：`Asia/Shanghai`）
- 头像：`VITE_SIDEBAR_AVATAR_SRC`（例如：`/avatar/avatar.jpg`）

## 文档

- 设计与实现：`DESIGN.md`
- 英文说明：`README.md`
