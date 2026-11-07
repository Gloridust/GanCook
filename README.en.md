<div align="center">

<img src="public/logo.webp" width="96" height="96" alt="GanCook" />

# 🍳 GanCook

**A self-hostable family meal-ordering app for your NAS — take turns cooking, order dishes, rate each meal.**

[![Docker](https://img.shields.io/badge/Docker-one--command-2496ED?logo=docker&logoColor=white)](#-quick-start)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Telegram](https://img.shields.io/badge/Telegram-Chat-26A5E4?logo=telegram&logoColor=white)](https://t.me/GanCookProj)

[中文](README.md) · English

💬 Questions / feedback / ideas → Telegram group [@GanCookProj](https://t.me/GanCookProj)

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
- 👆 **Tap-to-login** — on a shared device, pick your avatar and enter a 6-digit code; no typing.
- ⏰ **Auto meals (like alarms)** — add as many rules as you like: meal, time, how early to open, how early to close, and which weekdays. Auto-opens, auto-advances, auto-completes.
- 🔎 **Easy ordering with a big menu** — search, filter by tag (meat / veggie / soup…), list or grid view, and quantities ("5 buns").
- 🎲 **Surprise me** — pick a mix like "1 meat, 1 veggie, 1 soup" and get a random menu; recently eaten dishes come up less.
- 📦 **Menu import / export** — share your whole menu (with photos) as a zip, or import a zip of photos (file name = dish name) or a plain text list.
- 🔗 **Recipe link import** — paste a recipe link to pre-fill name, steps and cover (optional LLM clean-up).
- 🌱 **Contribution wall** — GitHub-style heatmaps for cooking & ordering.
- 🖼️ **Fast images** — dish photos are compressed to WebP and stored on disk (no base64-in-DB).
- 🥛 **"Milk Fabric" UI** — soft neumorphism, mobile-first, installable as a PWA.
- 🌍 **Bilingual** — switch between English and 中文 on the login page or in Me · Settings.
- 🔄 **Painless upgrades** — pull the new image; the DB migrates itself and sessions persist.

## 🚀 Quick start

Image: `gloridust/gancook:latest` (Docker Hub) or `ghcr.io/gloridust/gancook:latest` (GHCR).

`:latest` always points to the newest **stable release** (pin with `:0.2.1` / `:0.2` if you like); `:main` tracks the main branch for early testers.

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

### Reverse proxy

Plain IP:port and NAS remote access (including NAS phone apps) work out of the box. Behind your own nginx, forward the usual headers:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 64m;   # menu zip imports
}
```

Login has built-in brute-force protection; if you expose it to the internet, also set a join code or close registration in Family settings.

## 🔄 Upgrade

```bash
docker compose pull && docker compose up -d
```

Data and secrets live in the `data` volume; the database migrates automatically and you stay logged in.

## 🧱 Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · SQLite + Drizzle ORM · sharp · node-cron · TailwindCSS v4.

## 📄 License

[MIT](LICENSE)
