<div align="center">

<img src="public/logo.jpg" width="96" height="96" style="border-radius:22px" alt="GanCook" />

# 🍳 GanCook

**A self-hostable family meal-ordering app for your NAS — take turns cooking, order dishes, rate each meal.**

[![Docker](https://img.shields.io/badge/Docker-one--command-2496ED?logo=docker&logoColor=white)](#-quick-start)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

[中文](README.md) · English

</div>

---

"Who's cooking today?" "What's for lunch?" — GanCook turns those daily questions into something cozy.
It auto-opens tomorrow's meal the night before, lets everyone order, lets whoever cooks claim the meal,
and shows a **GitHub-style contribution wall** of who's been cooking. Built for families, **no cloud required** —
all data lives on your own NAS.

## ✨ Features

- 🚀 **Truly zero-config** — one `docker run`, no env vars to set; secrets are auto-generated & persisted on first boot.
- 🗄️ **Single container + SQLite** — no external DB, no cloud. Backup = copy one `data` folder.
- 👨‍👩‍👧 **One account, many roles** — no role at signup; anyone can cook or order. The cook is claimed **per meal**.
- ⏰ **Auto meals (like alarms)** — add as many rules as you like: meal, time, how early to open, how early to close, and which weekdays. Auto-opens, auto-advances, auto-completes.
- 🌱 **Contribution wall** — GitHub-style heatmaps for cooking & ordering.
- 🖼️ **Fast images** — dish photos are compressed to WebP and stored on disk (no base64-in-DB).
- 🥛 **"Milk Fabric" UI** — soft neumorphism, mobile-first, installable as a PWA.
- 🌍 **Bilingual** — switch between English and 中文 on the login page or in Me · Settings.
- 🔄 **Painless upgrades** — pull the new image; the DB migrates itself and sessions persist.

## 🚀 Quick start

Image: `gloridust/gancook:latest` (Docker Hub) or `ghcr.io/gloridust/gancook:latest` (GHCR).

```bash
docker run -d --name gancook \
  -p 3000:3000 \
  -v ./data:/data \
  --restart unless-stopped \
  gloridust/gancook:latest
```

Open `http://<your-nas>:3000` — the first person to register becomes the admin. That's it.

Or with compose:

```bash
curl -O https://raw.githubusercontent.com/Gloridust/GanCook/main/docker-compose.yml
docker compose up -d
```

## 🔄 Upgrade

```bash
docker compose pull && docker compose up -d
```

Data and secrets live in the `data` volume; the database migrates automatically and you stay logged in.

## 🧱 Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · SQLite + Drizzle ORM · sharp · node-cron · TailwindCSS v4.

## 📄 License

[MIT](LICENSE)
