# 🧭 Nav-Du

Nav-Du 是一个基于 Vite + React + Cloudflare 生态构建的轻量、高效个人导航页系统。它不仅拥有丝滑的交互体验，还具备强大的可视化管理后台和私有化图标代理服务。

**🚀 在线演示：[https://demo.nav.du.dev](https://demo.nav.du.dev)**

## ✨ 功能特性

- 🚀 **极速体验**：基于 React 19 和 Vite，首屏加载极快，交互流畅。
- 🌓 **智能主题**：内置浅色、深色模式，并支持随系统自动切换。
- 🔍 **智能搜索**：支持拼音、首字母缩写及模糊匹配，助您在秒级定位收藏。
- 🛠️ **管理后台**：内置可视化管理界面，支持链接增删改查及分类拖拽排序。
- 🖼️ **私有图标代理**：内置专有的 Favicon Worker 代理，解决国内图标访问慢的问题，支持 SVG 自动生成。
- 📱 **全平台适配**：采用响应式设计，在手机、平板和桌面端均有完美表现。
- ☁️ **云端同步**：深度集成 Cloudflare KV 存储，配置实时同步，数据持久化。

## 🛠️ 本地开发与测试

### 环境要求
- Node.js (建议 v18+)
- npm

### 快速启动
1. **安装依赖**：
   ```bash
   npm install
   ```

2. **全栈开发模式** (推荐)：
   同时启动前端 Dev Server、Pages Functions API 和 Favicon Worker 代理。
   ```bash
   npm run dev:all
   ```
   默认访问地址：`http://localhost:5173`

   **默认管理后台账号：**
   - 用户名：`admin`
   - 密码：`admin2026`

3. **仅前端开发**：
   ```bash
   npm run dev
   ```

## ☁️ Cloudflare 部署 (推荐方案)

本项目为 Cloudflare 生态原生设计，建议采用以下架构部署：

### 1. 部署主程序 (Pages)
- 在 Cloudflare 控制台关联 GitHub 仓库。
- **构建指令**：`npm run build`
- **输出目录**：`dist`
- **环境变量**：添加 `VITE_FAVICON_PROXY_BASE`，值设为 `/ico`。

#### Demo 项目 vs 个人项目（重要）

本仓库同时维护 Demo 与个人站两套 Pages 项目配置：

- Demo：`wrangler-demo.toml`（对应 `demo-nav-du`）
- 个人：`wrangler-personal.toml`（对应 `nav-du`）

注意：`wrangler.toml` 会被提交到 GitHub，默认保持为 Demo 配置。部署前通过 `cp` 切换配置：

```bash
# 部署 Demo
cp wrangler-demo.toml wrangler.toml
npx wrangler pages deploy dist --project-name demo-nav-du --branch main

# 部署个人站
cp wrangler-personal.toml wrangler.toml
npx wrangler pages deploy dist --project-name nav-du --branch main
```

也可以直接使用脚本：`npm run deploy:demo` / `npm run deploy:personal`。

### 2. 部署图标代理 (Worker)
- 进入 `workers/favicon` 目录。
- 执行部署：`npx wrangler deploy`
- 在控制台为该 Worker 添加 **Custom Domain**，并设置路由（如 `yourdomain.com/ico*`）。

### 3. 配置 KV 存储
- 在 Pages 项目设置中绑定名为 `NAV_CONFIG_KV` 的 KV 命名空间，用于持久化您的导航配置。

## 🐳 Docker 部署

如果您倾向于私有化部署，可以使用 Docker 镜像。

### 使用 Docker Compose
创建 `docker-compose.yml`：
```yaml
services:
  nav-du:
    image: ghcr.io/sonnedu/nav-du:latest
    container_name: nav-du
    restart: unless-stopped
    ports:
      - "8799:8799"
    environment:
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD_SHA256=your_sha256_password # 默认为 admin 的 sha256
      - SESSION_SECRET=your_random_secret
    volumes:
      - ./data:/data/state
```
启动：
```bash
docker-compose up -d
```

## 📄 开源协议
MIT License
