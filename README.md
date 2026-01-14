# nav-du

nav导航页（我的收藏夹）

A lightweight, responsive personal navigation page (bookmarks dashboard).

- Demo / Reference site: https://nav.du.dev

## Features

- Category sidebar + card grid
- Search (name/url/desc) with pinyin + initials + fuzzy match
- Light/Dark/System theme toggle
- Scroll-to-top with progress ring
- Admin page (`/admin`) for managing links (Cloudflare Pages Functions)
- Favicon proxy Worker with caching

## Local development

```bash
npm install
npm run dev
```

Open: `http://127.0.0.1:5173`

## Local verification

### UI (manual)

- Desktop: verify fixed sidebar + scroll behavior
- Mobile/Pad: use responsive device mode (drawer menu, tap targets)

### API (`/api/*`)

Vite dev server does not run Cloudflare Pages Functions.

- Terminal A: `npm run dev`
- Terminal B: `npx wrangler pages dev --proxy 5173`

Use the Wrangler URL output to access `/admin`.

### E2E (Playwright)

Install browsers once:

```bash
npx playwright install
```

Run tests:

```bash
npm run test:e2e
npm run test:e2e:chromium
```

## Configuration

- Default config: `src/data/nav.yaml`
- Sidebar title / banner title / timezone can be set in config or overridden by env:
  - `VITE_SIDEBAR_TITLE`
  - `VITE_BANNER_TITLE`
  - `VITE_TIME_ZONE`
  - `VITE_SIDEBAR_AVATAR_SRC`

## Docs

- 中文说明：`README.zh-CN.md`
- Design notes: `DESIGN.md`
