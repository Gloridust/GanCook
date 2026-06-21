/**
 * Next.js 启动钩子：
 * 1. 先应用数据库迁移（容器/本地启动即自动建表升级）
 * 2. 再拉起进程内定时调度器
 * 仅在 Node runtime 执行（不在 edge）。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { runMigrations } = await import('@/lib/db/run-migrations')
  try {
    runMigrations()
  } catch (e) {
    console.error('[migrate] 失败', e)
  }

  const { startScheduler } = await import('@/lib/scheduler')
  await startScheduler()
}
