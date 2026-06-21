# 贡献指南

感谢你愿意让「干饭厨子」更好吃 🍳

## 开发环境

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

要求 Node.js 20+（推荐 22）。

## 项目结构

```
app/                 页面与路由（含 api/uploads、api/cron）
components/          UI 组件（ui/ 为牛奶布艺原子组件）
lib/db/             Drizzle schema、客户端、迁移
lib/auth/           会话与密码
lib/actions/        Server Actions（鉴权写操作）
lib/scheduler.ts    自动饭局调度
drizzle/            数据库迁移文件（改 schema 后用 npm run db:generate 生成）
```

## 改数据库结构

1. 修改 `lib/db/schema.ts`
2. `npm run db:generate` 生成迁移 SQL（提交到 `drizzle/`）
3. `npm run db:migrate` 在本地应用

迁移会在应用启动时自动执行，**不要手动改已发布的迁移文件**。

## 设计规范

UI 遵循「牛奶布艺 Milk Fabric」：柔和拟物、连续大圆角、青菜绿强调色、克制装饰。
新组件请复用 `components/ui/` 里的原子（`.mf-raised` / `mf-pressable` 等），不要引入额外色相。

## 提交 PR

- 一个 PR 聚焦一件事，附上动机与截图（涉及 UI 时）。
- 提交前确保 `npm run build` 通过。
- 提交信息建议用约定式（`feat:` / `fix:` / `docs:` …）。

## 报 Bug / 提需求

请走 Issue 模板，附复现步骤或使用场景。家庭使用的真实痛点最受欢迎 🙌
