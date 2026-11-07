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
# （数据目录不可写时不让脚本 set -e 中断，退化为本次临时密钥，下方会给出明确提示）
load_secret() {
  f="$DATA_DIR/$1.secret"
  [ -s "$f" ] || gen > "$f" 2>/dev/null || true
  if [ -s "$f" ]; then cat "$f"; else gen; fi
}
if [ -z "$AUTH_SECRET" ]; then
  AUTH_SECRET="$(load_secret auth)"
  export AUTH_SECRET
fi
if [ -z "$CRON_SECRET" ]; then
  CRON_SECRET="$(load_secret cron)"
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

# 实测 app 用户能否写数据目录。部分 NAS（如飞牛 / 群晖的 ACL 共享目录、NFS/SMB 挂载、
# rootless Docker）里 chown 会静默失败，降权后就会 SQLITE_CANTOPEN。
# 这种情况下自动退回以 root 运行，保证开箱即用。
probe="$DATA_DIR/.gancook-write-test"
if gosu app sh -c "touch '$probe' && rm -f '$probe'" 2>/dev/null; then
  # 降权到 app 运行服务；instrumentation 启动时自动迁移数据库并拉起调度
  exec gosu app node server.js
fi

if touch "$probe" 2>/dev/null && rm -f "$probe"; then
  echo "[entrypoint] 数据目录 $DATA_DIR 对 app 用户不可写（chown 未生效，常见于 NAS 的 ACL 共享目录），已自动改为以 root 运行。" >&2
  exec node server.js
fi

echo "[entrypoint] ❌ 数据目录 $DATA_DIR 不可写（连 root 都写不了）。" >&2
echo "[entrypoint]    请检查挂载：宿主机目录是否存在、是否只读挂载（:ro）、NAS 共享目录是否给 Docker 读写权限。" >&2
exec node server.js
