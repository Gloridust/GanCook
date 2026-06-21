#!/bin/sh
set -e

# 家庭场景开箱即用：无需手动配置任何环境变量。
# 首次启动自动生成密钥并持久化到数据卷，重启 / 升级复用同一密钥（登录态不失效）。

DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"

gen() {
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
}

# 会话签名密钥
if [ -z "$AUTH_SECRET" ]; then
  [ -f "$DATA_DIR/auth.secret" ] || gen > "$DATA_DIR/auth.secret"
  AUTH_SECRET="$(cat "$DATA_DIR/auth.secret")"
  export AUTH_SECRET
fi

# 定时任务触发密钥（默认也自动生成并锁定 /api/cron/tick）
if [ -z "$CRON_SECRET" ]; then
  [ -f "$DATA_DIR/cron.secret" ] || gen > "$DATA_DIR/cron.secret"
  CRON_SECRET="$(cat "$DATA_DIR/cron.secret")"
  export CRON_SECRET
fi

exec node server.js
