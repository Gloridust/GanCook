/**
 * Next.js 启动钩子：
 * 1. 先应用数据库迁移（容器/本地启动即自动建表升级）
 * 2. 再拉起进程内定时调度器
 * 仅在 Node runtime 执行（不在 edge）。
 *
 * 这里的异常一律就地捕获：钩子抛错会让 Next 对「每一个请求」都返回 500，
 * 而日志里只剩一句难懂的 "error while loading instrumentation hook"。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { DATA_DIR } = await import('@/lib/env')
  try {
    const { runMigrations } = await import('@/lib/db/run-migrations')
    runMigrations()
  } catch (e) {
    const code = (e as { code?: string })?.code
    console.error('[migrate] 失败', e)
    if (code === 'SQLITE_CANTOPEN' || code === 'EACCES' || code === 'EROFS') {
      console.error(
        `[migrate] 无法打开/创建数据库：数据目录 ${DATA_DIR} 不可写。\n` +
          '          请检查 docker 卷挂载（宿主机目录是否存在、是否只读、NAS 共享目录是否授予 Docker 读写权限），\n' +
          '          修正后重启容器即可。',
      )
    }
    return
  }

  try {
    const { startScheduler } = await import('@/lib/scheduler')
    await startScheduler()
  } catch (e) {
    console.error('[scheduler] 启动失败（不影响点菜等功能，可在家庭管理里手动执行）', e)
  }
}
