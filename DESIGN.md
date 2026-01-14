# nav导航页（我的收藏夹）设计与实现说明

> 项目英文名：`nav-du`。用于部署一个个人常用网站导航页，支持强检索（含拼音/拼音缩写）、深浅色主题、favicon 防盗链/跨域兜底，并提供简单的管理后台用于维护链接。

## 1. 当前实现概览

### 1.1 技术栈

- 前端：Vite + React + TypeScript
- 部署：Cloudflare Pages（静态资源）
- 后端（管理接口）：Cloudflare Pages Functions（`functions/api/*`）
- favicon 代理：Cloudflare Worker（`workers/favicon`，Wrangler 部署）

### 1.2 目录结构（关键路径）

- UI：`src/`
  - 导航页：`src/pages/NavPage.tsx`
  - 管理后台：`src/pages/AdminPage.tsx`
  - 全局样式：`src/index.css`、`src/App.css`
  - 默认数据：`src/data/nav.yaml`
- Pages Functions API：`functions/api/`
  - 登录：`functions/api/login.ts`
  - 登出：`functions/api/logout.ts`
  - 获取当前用户：`functions/api/me.ts`
  - 读取/写入云端配置：`functions/api/config.ts`
- favicon Worker：`workers/favicon/src/index.ts`

## 2. 需求与交互

### 2.1 核心功能

- 单层分类 + 卡片网格展示
- 搜索：名称/链接/描述 + 拼音/拼音缩写 + 模糊匹配
- 主题：浅色/深色/跟随系统，可一键切换
- 右下角按钮组：主题切换 + 返回顶部（带滚动进度环）
- 管理后台（`/admin`）：登录后支持添加/编辑/导入/导出/重置

### 2.2 多端与跨浏览器（新增要求）

目标支持：
- 设备：电脑端 / Pad 端 / 手机端
- 浏览器：Edge / Chrome / Safari / Firefox（主流现代版本）

实现策略（CSS/布局层面）：
- 响应式断点：`max-width: 860px` 时启用移动端侧栏抽屉（drawer）
- 桌面端侧栏固定：左侧菜单固定在视口内，右侧内容区域滚动；左侧菜单自身可滚动
- iOS Safari 兼容：避免仅使用 `100vh` 造成地址栏变化带来的跳动，关键容器使用 `100svh` 并保留 `100vh` 作为降级
- 可访问性：为键盘操作提供清晰的 `:focus-visible` 样式；减少动画偏好时禁用过渡（`prefers-reduced-motion`）

## 3. 页面布局

### 3.1 桌面端（电脑）

- 左侧：分类菜单（固定定位）
  - 分类列表过长时，左侧内部滚动
- 右侧：主内容（随页面滚动）
  - 顶部 Banner：标题 + 搜索框
  - 内容区：分类分组 + 卡片网格

### 3.2 Pad/手机端

- 侧栏以抽屉形式出现
  - 点击菜单按钮打开
  - 点击遮罩关闭
- 主内容占满宽度
- 交互上优先保证可点击区域与滚动体验

## 4. 数据模型与配置

### 4.1 默认配置

默认配置文件：`src/data/nav.yaml`

结构要点：
- `site.title`：站点标题
- `site.description`：站点描述（可选）
- `site.defaultTheme`：`light | dark | system`
- `categories[]`：分类列表
  - `id`/`name`/`order`
  - `items[]`：链接列表（`id`/`name`/`url`/`desc?`/`tags?`）

### 4.2 管理后台与覆盖策略

- 页面启动会加载 `src/data/nav.yaml`
- 管理后台可通过 `/api/config` 将配置写入 KV（云端配置）
- 前端在运行时可能有本地覆盖（如 localStorage 机制）；当存在覆盖数据时可覆盖默认配置

> 说明：具体读取优先级以 `src/lib/useNavConfig.ts` / `src/lib/storage.ts` 的实现为准。

### 4.3 测试用样例数据（新增要求）

为了方便验证多端布局与滚动体验，`src/data/nav.yaml` 可以临时放入更多分类与链接（例如 10 个常用分类，每类 5~20 条）。
后续可通过管理后台自行调整链接内容。

## 5. 后端（Cloudflare Pages Functions）

### 5.1 路由

- `POST /api/login`：登录，成功后写入 HttpOnly Cookie
- `POST /api/logout`：登出，清理 Cookie
- `GET /api/me`：获取当前登录用户
- `GET /api/config`：从 KV 读取当前配置
- `PUT /api/config`：写入配置到 KV（需登录）

### 5.2 环境变量（Cloudflare Pages Secrets）

- `ADMIN_USERNAME`：管理员账号
- `ADMIN_PASSWORD_SHA256`：管理员密码的 SHA-256 hex（小写）
- `SESSION_SECRET`：会话签名密钥（随机长字符串）
- `SESSION_TTL_SECONDS`（可选）：会话有效期，默认 86400

KV：
- `NAV_CONFIG_KV`：存储云端配置

## 6. favicon Worker（Cloudflare Workers）

- 入口：`workers/favicon/src/index.ts`
- 目标：解决源站 favicon 防盗链/跨域/偶发失败
- 缓存：Cache API +（可选）KV 元信息缓存
- 安全：包含 hostname/protocol 校验（SSRF 防护）、超时与大小限制

## 7. 验收与校验清单（新增）

### 7.1 手动验证（推荐先做）

设备维度：
- 电脑：1920×1080 / 1440×900
- Pad：1024×1366（或类似）
- 手机：375×812、390×844

浏览器维度：
- Chrome / Edge / Firefox / Safari（尽量使用最新稳定版）

关键用例：
- 桌面端：滚动右侧内容时，左侧菜单保持固定；左侧菜单过长时自身可滚动
- 移动端：抽屉菜单可打开/关闭，遮罩点击关闭，滚动不穿透
- 搜索：输入/清空后内容切换正确；键盘回车不触发异常跳转
- 主题：系统模式与手动切换正常；刷新后主题保持预期
- 可访问性：Tab 键可聚焦到按钮/链接，焦点样式可见

### 7.2 自动化（可选）

当前仓库未配置测试框架/Playwright。
如果后续要做端到端自动化，建议引入 Playwright：
- 覆盖多个 viewport（desktop/tablet/mobile）
- 覆盖多个浏览器（Chromium/Firefox/WebKit）
- 输出截图用于回归

## 8. 迭代建议

- 将“兼容性/多端验证”写入发布前检查清单
- 若站点链接规模持续增长，可考虑：
  - 搜索结果分组/高亮
  - 分类侧栏支持折叠/置顶
  - 更明确的空状态与错误提示
