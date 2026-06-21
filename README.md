<div align="center">

<img src="public/logo.jpg" width="96" height="96" style="border-radius:22px" alt="干饭厨子" />

# 🍳 干饭厨子 · GanCook

**可一键部署到 NAS 的家庭点菜系统 —— 让一家人轮流做饭、点菜、互相打分。**

[![Docker](https://img.shields.io/badge/Docker-一键部署-2496ED?logo=docker&logoColor=white)](#-快速开始)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-单文件-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

中文 · [English](README.en.md)

</div>

---

> 「今天谁做饭？」「吃啥？」——干饭厨子把这两个每天都要吵一遍的问题，变成一件温馨小事。
>
> 前一天晚上自动开好明天的饭局，家人各自点菜，谁掌勺谁认领，吃完打个分；
> 月底还能在**贡献墙**上看看这个月是谁在默默下厨。专为家庭设计，**不依赖任何云服务**，数据全在你自己的 NAS 上。

## ✨ 特性

- 🚀 **真·开箱即用** —— 一条 `docker run` 跑起来，**无需配置任何环境变量**，密钥首启自动生成并持久化。
- 🗄️ **单容器 + SQLite** —— 没有外部数据库、没有云依赖，备份只需复制一个 `data` 目录。
- 👨‍👩‍👧 **一账号多角色** —— 注册不分身份，人人都能做饭、点菜；做饭人按「每一餐」认领（「我来做这顿」）。
- ⏰ **自动饭局（像设闹钟）** —— 在后台**自由增删多条规则**：餐次、时间、提前多久开、提前多久截止、生效星期都可自定义。到点自动开局、截止自动进入做饭、用餐后自动完成。
- 🌱 **贡献墙** —— GitHub 风格热力图，谁做饭最勤、谁最会点菜，绿格子一目了然。
- 🖼️ **图片不拖后腿** —— 菜品照片自动压缩转 WebP 落盘存储（告别 base64 进库），列表加载飞快。
- 🥛 **牛奶布艺 UI** —— 柔和拟物 + 青菜绿，移动端优先，可作为 PWA 添加到主屏。
- 🌍 **中英双语** —— 登录页与「我的 · 设置」一键切换。
- 🔄 **升级无痛** —— 拉新镜像即可，数据库自动迁移，登录态不丢。

## 📸 预览

> 首启创建管理员 → 添加菜品 → 开饭局点菜 → 认领做饭 → 餐后评价 → 贡献墙

<!-- 截图占位：欢迎 PR 补充 docs/screenshots/ -->

## 🚀 快速开始

镜像地址（任选其一）：

- 🐳 **Docker Hub（国内飞牛等 NAS 有加速，推荐）**：`gloridust/gancook:latest`
- 📦 GHCR（海外）：`ghcr.io/gloridust/gancook:latest`

### 方式一：docker run（最简单）

```bash
docker run -d --name gancook \
  -p 3000:3000 \
  -v ./data:/data \
  --restart unless-stopped \
  gloridust/gancook:latest
```

打开 `http://<你的NAS地址>:3000`，第一个注册的人即成为管理员。完事。

### 方式二：docker compose（推荐，便于升级）

```bash
curl -O https://raw.githubusercontent.com/Gloridust/GanCook/main/docker-compose.yml
docker compose up -d
```

> 飞牛 / 群晖等 NAS 也可以直接在「Docker / Container Manager」里搜索镜像 `gloridust/gancook` 创建容器：
> 端口映射 `3000`，把容器内 `/data` 映射到一个你方便备份的目录即可。

无需设置任何环境变量。如需自定义，可选：

| 变量 | 默认 | 说明 |
|------|------|------|
| `TZ` | `Asia/Shanghai` | 时区，影响自动饭局时间 |
| `AUTH_SECRET` | 自动生成 | 会话签名密钥（留空自动生成并存到 `data/auth.secret`） |
| `CRON_SECRET` | 自动生成 | 定时触发端点密钥 |

## 📖 入门指南（5 分钟上手）

1. **部署并打开** —— 用上面任一方式启动，浏览器访问 `http://<NAS>:3000`。
2. **建立家庭** —— 首次进入是引导页：填家庭名 + 你的昵称 + 6 位密码，你成为**管理员**。
3. **家人加入** —— 家人各自打开同一地址 →「注册」，填昵称 + 6 位密码即可。
   （管理员可在「我的 → 家庭管理」里设置**注册口令**或关闭注册。）
4. **添加菜品** —— 进「菜品」把全家拿手菜加进来（可拍照，自动压缩）。
5. **开一顿饭局** —— 首页或「饭局」点「开饭局」，选餐次/时间/截止；家人进去勾选想吃的，谁做饭点「我来做这顿」。
6. **设置自动饭局** —— 「我的 → 家庭管理 → 自动饭局」像设闹钟一样添加规则：
   例如「每日午餐 12:00、前一天 20:00 自动开、提前 2 小时截止」。以后每天自动开局、自动流转。
7. **看贡献墙** —— 「贡献」页用绿格子记录每个人做饭/点菜的活跃度。
8. **切换语言** —— 登录页或「我的 → 语言」可在中文 / English 间切换。

> 想换语言或备份？语言在「我的」里随时切；备份只要复制 `data` 目录。

## 🔄 升级到新版本

```bash
docker compose pull && docker compose up -d
# docker run 方式：docker pull gloridust/gancook:latest 后重新创建容器
```

数据与密钥都在 `data` 卷里，升级时数据库会**自动迁移**，登录态保持不变。
想全自动更新可搭配 [Watchtower](https://containrrr.dev/watchtower/)。

## 💾 备份

整个应用的状态只在一个地方：你映射出来的 **`data` 目录**（包含 `app.db` 与 `uploads/`）。
定时复制这个目录即是完整备份；恢复时放回去再启动即可。

## 🛠️ 本地开发

```bash
git clone https://github.com/Gloridust/GanCook.git
cd GanCook
npm install
cp .env.example .env.local   # 本地可按需修改
npm run db:migrate           # 初始化 SQLite
npm run dev                  # http://localhost:3000
```

## 🧱 技术栈

- **Next.js 16**（App Router · Server Actions）+ React 19 + TypeScript
- **SQLite** + **Drizzle ORM**（`better-sqlite3`）
- **鉴权**：bcrypt + `jose` 签名 JWT + httpOnly Cookie
- **图片**：`sharp` 压缩转 WebP 落盘
- **调度**：进程内 `node-cron`（启动钩子 `instrumentation.ts` 拉起）
- **样式**：TailwindCSS v4 + 自建「牛奶布艺」设计系统 + Framer Motion

## 🗺️ 路线图

- [ ] 多人协作做饭 / 帮买菜清单
- [ ] 菜品标签筛选与搜索
- [ ] 消息提醒（开局 / 截止前推送）
- [ ] 数据导出与一键备份
- [ ] 国际化（English UI）

欢迎在 Issues 里许愿 🙌

## 🤝 贡献

欢迎 Issue / PR！开发约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 📄 License

[MIT](LICENSE) · Made with ❤️ for family dinners
