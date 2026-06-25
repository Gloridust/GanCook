#!/bin/sh
set -e

# 以 root 启动：开箱即用（自动生成密钥）+ 让非 root 的 app 用户能访问 docker.sock，
# 最后用 gosu 降权到 app 运行服务（不以 root 跑应用）。

DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"

gen() {
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
}

# 会话 / 定时任务密钥：首次自动生成并持久化，无需任何配置
if [ -z "$AUTH_SECRET" ]; then
  [ -f "$DATA_DIR/auth.secret" ] || gen > "$DATA_DIR/auth.secret"
  AUTH_SECRET="$(cat "$DATA_DIR/auth.secret")"
  export AUTH_SECRET
fi
if [ -z "$CRON_SECRET" ]; then
  [ -f "$DATA_DIR/cron.secret" ] || gen > "$DATA_DIR/cron.secret"
  CRON_SECRET="$(cat "$DATA_DIR/cron.secret")"
  export CRON_SECRET
fi

# 让 app 用户能访问挂载进来的 docker.sock（用于「网页端一键更新」，默认开启）
# 把 app 加入与套接字相同 GID 的组；失败不阻断启动，前端会自动降级为手动更新提示
if [ -S /var/run/docker.sock ]; then
  SOCK_GID="$(stat -c '%g' /var/run/docker.sock 2>/dev/null || echo '')"
  if [ -n "$SOCK_GID" ]; then
    GRP="$(getent group "$SOCK_GID" 2>/dev/null | cut -d: -f1)"
    if [ -z "$GRP" ]; then
      GRP=dockerhost
      groupadd -g "$SOCK_GID" "$GRP" 2>/dev/null || true
    fi
    usermod -aG "$GRP" app 2>/dev/null || true
  fi
fi

# 数据目录归属 app（容器以 root 启动，服务以 app 运行）
chown -R app:app "$DATA_DIR" 2>/dev/null || true

# 降权到 app 运行服务；instrumentation 启动时自动迁移数据库并拉起调度
exec gosu app node server.js
