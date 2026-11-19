# 干饭厨子 开放 API（v1）

让 AI 助手、iOS 快捷指令、Home Assistant / n8n 或你自己的脚本读写干饭厨子：加菜谱、开饭局、点菜、记库存、要推荐。

## 鉴权

1. 登录后进入 **我的 → 开放 API**，填个用途点「生成令牌」。令牌形如 `gck_xxxxxxxx…`，**只显示一次**，请立即保存。
2. 每个请求带上请求头（二选一）：

   ```
   Authorization: Bearer gck_xxxxxxxx
   X-API-Key: gck_xxxxxxxx
   ```

令牌拥有与创建者**相同的权限**（例如只有菜品创建者或管理员能修改菜品内容），以创建者的身份点菜。不用了随时在同一页面吊销。

## 约定

- 基础地址：`http(s)://<你的地址>/api/v1`
- 请求和响应都是 JSON（`Content-Type: application/json`）。查询参数里有中文时请做 URL 编码（`curl -G --data-urlencode 'q=红烧'`）。
- 成功：`{ "data": ... }`；失败：`{ "error": { "code": "...", "message": "..." } }`，并带相应 HTTP 状态码（400 / 401 / 403 / 404 / 409 / 422 / 500）。
- 时间戳为 Unix 秒；`date` 为家庭时区下的 `YYYY-MM-DD`，`diningTime` / `deadline` 入参为 `HH:MM`。
- 图片地址（`imageUrl`）是相对路径，如 `/api/uploads/dishes/xxx.webp`。

## 接口一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/me` | 令牌对应的成员与家庭信息 |
| GET | `/dishes` | 菜品列表，`?q=` 搜索、`?tag=` 分类、`?status=active\|archived\|all` |
| POST | `/dishes` | 新建菜品 |
| GET | `/dishes/:id` | 菜品详情 |
| PATCH | `/dishes/:id` | 修改菜品（部分字段） |
| DELETE | `/dishes/:id` | 删除菜品（点过的菜只下架，保留历史） |
| GET | `/meals` | 进行中的饭局；`?status=history&limit=20` 看历史 |
| POST | `/meals` | 开一顿饭局 |
| GET | `/meals/:id` | 饭局详情：按菜聚合的「谁点了几份」、评价 |
| POST | `/meals/:id/orders` | 点菜 / 改份数 / 取消 |
| POST | `/meals/:id/recommend` | 智能配一桌（只推荐，不下单） |
| GET | `/pantry` | 家里库存（快过期的在前） |
| POST | `/pantry` | 新增库存 |
| PATCH | `/pantry/:id` | 修改库存（部分字段） |
| DELETE | `/pantry/:id` | 删除库存 |

## 示例

```bash
TOKEN=gck_xxxxxxxx
BASE=http://nas.local:3000/api/v1
```

### 加一道菜（AI 帮你整理好菜谱后直接写入）

```bash
curl -X POST $BASE/dishes \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "name": "红烧肉",
    "description": "肥而不腻，下饭神器",
    "instructions": ["五花肉切块冷水下锅焯水", "小火炒糖色", "加料酒生抽老抽和热水，小火炖 1 小时", "大火收汁"],
    "tags": ["荤菜", "家常"],
    "imageUrl": "https://example.com/hongshaorou.jpg"
  }'
```

字段：`name` 必填（≤30 字）；`description` ≤200 字；`instructions` 可以是字符串，也可以是步骤数组（会自动编号）；`tags` 数组或逗号分隔字符串，最多 6 个；`imageUrl` 可选，服务端会下载并压缩成 WebP（仅公网 http/https 图片，≤5MB）。

`PATCH /dishes/:id` 接受同样的字段（只传要改的），另外可传 `"status": "active" | "archived"` 上下架。

### 开饭局 & 点菜

```bash
# 开一顿晚饭
curl -X POST $BASE/meals -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"mealType":"dinner","date":"2026-11-21","diningTime":"18:30","deadline":"16:30","title":"周六晚饭"}'

# 点 2 份某道菜（quantity 为 0 即取消）
curl -X POST $BASE/meals/<mealId>/orders -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"dishId":"<dishId>","quantity":2}'

# 一次点上多道（各 1 份，已点的保持不变）
curl -X POST $BASE/meals/<mealId>/orders -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"dishIds":["<dishId1>","<dishId2>"]}'
```

点菜截止后再点会返回 `409 orderClosed`。

### 今天吃点啥（智能推荐）

```bash
curl -X POST $BASE/meals/<mealId>/recommend -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"plan":{"荤菜":1,"素菜":1,"汤":1},"locale":"zh"}'
```

`plan` 的键是菜品标签，值是道数；`"__any__"` 表示不限分类。返回：

```json
{
  "data": {
    "picks": [{ "id": "…", "reason": "西红柿快过期了，先用掉" }],
    "summary": "立冬进补，一荤一素一汤",
    "source": "llm",
    "seasonLabel": "立冬 · 冬季",
    "llmFailed": false
  }
}
```

配置并启用了 LLM（家庭管理 → LLM）时由模型挑选，否则（或模型失败时）按节气、应季食材、库存与最近吃过的菜打分推荐。拿到 `picks` 后可再调用 `/orders` 下单。

### 库存

```bash
curl -X POST $BASE/pantry -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"鸡蛋","quantity":10,"unit":"个","location":"fridge","expiresOn":"2026-12-01"}'
```

字段：`name` 必填（≤30 字）；`quantity` 可空（0–99999，0 表示用完但保留条目）；`unit` ≤10 字；`location` 为 `fridge`（冷藏）/ `freezer`（冷冻）/ `pantry`（常温）；`expiresOn` 为 `YYYY-MM-DD`；`note` ≤100 字。

## 消息推送的 Webhook 格式

「家庭管理 → 消息推送」里选择「通用 Webhook」时，干饭厨子会向你的地址 `POST` 如下 JSON：

```json
{
  "event": "cooking",
  "title": "👩‍🍳 点菜结束：周六晚饭（11/21 晚餐）",
  "text": "掌勺：奶奶，18:30 开饭。要做这些：\n· 红烧肉 ×3（爸爸、妈妈×2）",
  "link": "https://cook.example.com/meals/…",
  "family": "我家",
  "meal": { "id": "…", "title": "周六晚饭", "mealType": "dinner", "date": "2026-11-21", "diningTime": "18:30", "deadline": "16:30", "minutesLeft": 0 },
  "cook": "奶奶",
  "dishes": [{ "name": "红烧肉", "total": 3, "people": ["爸爸", "妈妈×2"] }]
}
```

`event` 取值：`meal_created`（开局）、`deadline_soon`（截止前 N 分钟，N 可在设置里改）、`cooking`（点菜结束，没人点菜时不推送）、`test`（测试按钮）。
