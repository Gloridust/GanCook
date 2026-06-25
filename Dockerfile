# 干饭厨子 GanCook — 多阶段构建，输出单容器 standalone 运行包
# bookworm-slim (glibc) 以保证 better-sqlite3 / sharp 原生模块兼容

# ---------- 依赖 ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# 编译 better-sqlite3 原生模块所需工具（若无预编译包则现编）
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- 构建 ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- 运行 ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data \
    TZ=Asia/Shanghai

# 版本号（由 CI 构建参数注入，用于「关于与更新」展示与比对）
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

# gosu 用于以 root 启动入口脚本后降权到 app（既非 root 运行，又能在挂载 docker.sock 时访问它）
RUN apt-get update && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r app && useradd -r -g app app

# standalone 运行包 + 静态资源 + public + 迁移文件
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

# 数据卷：SQLite 与上传图片
RUN chmod +x /app/docker-entrypoint.sh \
    && mkdir -p /data && chown -R app:app /data /app
VOLUME /data
# 注意：以 root 启动入口脚本（自动生成密钥 + 处理 docker.sock 权限），随后 gosu 降权到 app 运行服务

EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
