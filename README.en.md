# 🧭 Nav-Du

Nav-Du is a lightweight, high-performance personal navigation dashboard built on the Vite + React + Cloudflare ecosystem. It offers a smooth user experience, a powerful management backend, and a private favicon proxy service.

## ✨ Features

- 🚀 **Blazing Fast**: Built with React 19 and Vite for instant loading and fluid interactions.
- 🌓 **Smart Theme**: Built-in Light and Dark modes with automatic system preference switching.
- 🔍 **Intelligent Search**: Supports Pinyin, initials, and fuzzy matching for lightning-fast bookmark retrieval.
- 🛠️ **Management Backend**: Visual admin interface to manage links and categories with drag-and-drop sorting.
- 🖼️ **Private Favicon Proxy**: Built-in Favicon Worker proxy to bypass slow icon loading and generate SVG fallbacks.
- 📱 **Fully Responsive**: Optimized for mobile, tablet, and desktop devices.
- ☁️ **Cloud Sync**: Deeply integrated with Cloudflare KV for real-time config synchronization and persistence.

## 🛠️ Local Development

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Quick Start
1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Full-Stack Dev Mode** (Recommended):
   Starts Frontend Dev Server, Pages Functions API, and Favicon Worker proxy simultaneously.
   ```bash
   npm run dev:all
   ```
   Default URL: `http://localhost:5173`

3. **Frontend Only**:
   ```bash
   npm run dev
   ```

## ☁️ Cloudflare Deployment (Recommended)

Nav-Du is designed natively for the Cloudflare ecosystem.

### 1. Deploy Main App (Pages)
- Connect your GitHub repository to Cloudflare Pages.
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**: Add `VITE_FAVICON_PROXY_BASE` with value `/ico`.

### 2. Deploy Favicon Proxy (Worker)
- Navigate to `workers/favicon`.
- Deploy via Wrangler: `npx wrangler deploy`
- Add a **Custom Domain** to the Worker in the dashboard and set a route (e.g., `yourdomain.com/ico*`).

### 3. Configure KV Storage
- Bind a KV Namespace named `NAV_CONFIG_KV` in your Pages project settings to persist your dashboard configuration.

## 🐳 Docker Deployment

For self-hosting on private servers.

### Using Docker Compose
Create `docker-compose.yml`:
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
      - ADMIN_PASSWORD_SHA256=your_sha256_password # Default is SHA256 of 'admin'
      - SESSION_SECRET=your_random_secret
    volumes:
      - ./data:/data/state
```
Run:
```bash
docker-compose up -d
```

## 📄 License
MIT License
