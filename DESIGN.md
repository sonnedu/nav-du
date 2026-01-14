# nav.du.dev 导航页设计方案（草案）

> 目标：在 `nav.du.dev` 部署一个“我常用网站”的导航页，风格参考 `https://ddgksf2013.top`，支持便捷添加/管理链接、强检索（含拼音/拼音缩写）、深浅色主题与 favicon 防盗链方案；部署基于 Cloudflare Pages + Workers。

## 1. 技术选型（面向“简单可维护”）

### 前端
- 推荐：**Vite + React + TypeScript**（理由：生态成熟、组件化好维护、Cloudflare Pages 纯静态部署非常顺畅）
- 复杂度担忧：你“不太懂 React/Vite”没关系，这套可以做到“很薄的一层”，项目结构固定后，日常只需要维护 `data` 配置即可。

### 数据维护（优先简单）
- 选择：**仅本地编辑 + 导入导出**（无需账号/后端，最省心）
- 数据来源：
  1) 仓库内的 `data/nav.yaml`（默认数据，方便版本管理）
  2) 前端提供“添加/编辑/分类管理/导入导出”弹窗（参考 ddgksf2013），编辑结果存 `localStorage`，并支持导出为 JSON/YAML（方便你复制回仓库配置）

### 搜索（满足中文/拼音/缩写 + 模糊匹配）
- 推荐组合：**`pinyin-pro` + `Fuse.js`**
- 适用规模：链接总量 ≤ 200 —— **不需要预构建索引文件**。
  - 建议做法：页面首次加载时对数据做一次“预计算索引字段”，并缓存到内存即可（不在每次键入时重复算拼音）。

### favicon（主方案推荐）
你提的 favicon 痛点是：直接引用站点 favicon 容易遇到防盗链/跨域/偶发失败。

- 主方案推荐：**独立 Worker 服务 `favicon.du.dev`（proxy + 缓存）**
  - 前端统一用：`https://favicon.du.dev/ico?url=ENCODED_URL`
  - Worker 负责抓取 favicon 并缓存，前端不直接碰目标站点的图标。
- 备用方案（可选）：配置中允许写 `icon.base64` 覆盖某些站点（少量手工兜底）。

原因：
- 你已经计划用 Workers/Pages；Worker 方案稳定、可控、可刷新、可缓存，且对前端数据体积友好。

---

## 2. 信息架构与交互（对齐 ddgksf2013）

### 页面布局
- 左侧：Sidebar（分类列表、当前分类高亮、移动端可抽屉/遮罩）
- 右侧：主内容
  - 顶部 Banner：站点标题 + 搜索框 +（可选）公告/提示
  - 内容区：当前分类下的卡片网格（响应式）
- 右下角：FAB 按钮组（放一块，符合你要求）
  - 主题切换（深/浅/跟随系统）
  - 返回顶部（带滚动进度环）
  - （可选）移动端菜单按钮

### 卡片
- icon（36~40）+ name + desc（可选 tags）
- hover：轻微上浮 + 阴影增强（ddgksf2013 风格）

---

## 3. 数据模型（单层分类）

### YAML 示例（建议）
```yaml
site:
  title: "nav.du.dev"
  description: "常用网站导航"
  defaultTheme: "system" # light | dark | system

categories:
  - id: dev
    name: "开发"
    order: 1
    items:
      - id: github
        name: "GitHub"
        url: "https://github.com"
        desc: "代码托管与协作"
        tags: ["code", "git"]
        icon:
          type: "proxy" # proxy | base64 | url
          value: ""     # proxy 时可留空

  - id: tools
    name: "工具"
    order: 2
    items:
      - id: tool-lu
        name: "tool.lu"
        url: "https://tool.lu"
        desc: "在线工具箱"
```

### 运行时扩展字段（不要求写进 YAML）
前端加载后给每条 Link 补充 `search` 字段，用于检索加速：
- `urlHost`
- `pinyinFull`（name 拼音，无声调）
- `pinyinInitials`（name 拼音首字母缩写）
- `searchable`（综合字段）

---

## 4. 检索设计（中文 + 拼音 + 缩写 + 模糊）

### 字段覆盖
必须支持：按 `网站名称 / 链接 / 网站说明` 检索。
并且支持上述字段的：
- 拼音（全拼）
- 拼音缩写（首字母）

### 实现策略（≤200 条，够快且简单）
1) 页面加载后，遍历所有链接，预生成：
   - `pinyinFull = pinyin(name, { toneType: 'none', separator: ' ' })`
   - `pinyinInitials = pinyin(name, { toneType: 'none', pattern: 'first', separator: '' })`
   - `urlHost = new URL(url).host`（对非法 url 要 try/catch）
   - `searchable = (name + desc + url + urlHost + pinyinFull + pinyinInitials).toLowerCase()`
2) 用 Fuse.js 建索引（权重建议）：
   - `name` 权重最高
   - `desc` 次之
   - `url/urlHost` 再次
   - `pinyinFull/pinyinInitials` 也纳入（权重略低）
3) 输入框实时检索（建议 debounce 150~300ms），返回 Top N（比如 50）。

### 额外增强（可选）
- 对英文输入：优先匹配拼音字段（体验更“像导航站”）
- 支持空格拆词：例如 `git doc` 同时命中多个词

---

## 5. favicon Worker 设计（favicon.du.dev）

### 目标
- 解决源站防盗链/跨域导致 favicon 不显示的问题
- 支持缓存、刷新、定期更新

### API 设计（最小可用）
- `GET /ico?url=...`：返回该站点 favicon（二进制）
- `POST /refresh?domain=...`：清理该域名缓存，便于手动刷新
- `GET /health`：健康检查

### 获取策略（fallback chain）
1) 尝试常见路径：`/favicon.ico`、`/favicon.png`
2) 抓首页 HTML，解析：
   - `<link rel~="icon">`
   - `<link rel~="apple-touch-icon">`
   - manifest（可选后续）
3) 都失败则返回 404

### 缓存策略（推荐）
- Cache API：`caches.default` 缓存最终响应（边缘缓存，快）
- KV：存“域名 -> 解析出来的 faviconUrl 元信息”，TTL 24h
-（可选）R2：存最终图标二进制，适合长期/大量站点

### 安全与稳定性（必须）
- SSRF 防护：拒绝 localhost、内网 IP、metadata 域名；只允许 http(s)
- 限制大小：例如 >500KB 拒绝
- 校验 content-type：只允许图片类（ico/png/svg/webp）
- refresh 接口加简单鉴权（API key）

---

## 6. 主题（深色/浅色/跟随系统）

### 功能要求
1) 提供深色、浅色主题
2) 有按钮可以切换
3) 可根据系统深浅色自动识别
4) 参考 ddgksf2013：主题切换按钮与返回顶部按钮放在同一组

### 实现建议
- CSS Variables + `data-theme="light|dark"`（或 class）
- 默认 `system`：读取 `prefers-color-scheme`
- 用户切换后写入 `localStorage` 覆盖系统

---

## 7. Cloudflare 部署（Pages + Workers）

### Pages（nav.du.dev）
- 静态构建输出 `dist/`
- Cloudflare Pages 直接连接 GitHub repo 自动部署
- 绑定自定义域名：`nav.du.dev`

### Workers（favicon.du.dev）
- 单独 Worker 服务
- 绑定 KV（必须）和可选 R2
- 绑定自定义域名：`favicon.du.dev`

---

## 8. 迭代路线（从简单到强）

### V1（先上线能用）
- YAML 配置加载 + 分类展示
- 搜索（Fuse + pinyin-pro）
- 主题切换 + 回到顶部（同组 FAB）
- favicon 先用 Worker proxy（不做 R2，仅 Cache API + KV）

### V2（体验增强）
- 添加/编辑/导入导出弹窗（本地存储）
- favicon 刷新接口 + cron 定期刷新

### V3（如果需要“真后台”）
- Pages Functions/Worker + KV：存云端配置（多设备同步）
- 简单鉴权（Cloudflare Access / token）

---

## 9. 当前决策（根据你的回答）
- 前端：React/Vite（我来把结构搭好，你后续主要改配置）
- 规模：≤200，无需预构建索引文件；加载后预计算一次即可
- 管理：仅本地编辑 + 导入导出（最简单）
- 分类：单层分类，交互参考 ddgksf2013
- favicon：推荐 Worker proxy + 缓存（主方案）
- UI：贴近 ddgksf2013
