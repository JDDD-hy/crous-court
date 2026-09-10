# DEV-20260910-01：OpenAI Sites 技术架构

状态：Confirmed for v1（2026-09-10）。

## 1. 部署模式

本项目包含持久化、上传、认证和多页面，必须走 OpenAI Sites capability path，不使用纯静态 one-shot。

目标运行形态：Cloudflare Worker 兼容 ESM；使用 Sites 管理 D1、R2、身份认证和部署绑定。

## 2. 前端

- Vinext/React + TypeScript；
- Tailwind CSS；
- starter 内置 shadcn/ui：Dialog、Sheet、Tabs、Select/Combobox、Progress、Skeleton、Sonner、AlertDialog；
- GSAP Flip：筛选、投票后榜单重排；
- GSAP MotionPath：菜品卡片跨等级移动；
- Canvas 2D：重大降级时的轻量 pixel shatter；
- 所有动画提供 reduced-motion 降级。

## 3. 后端与存储

- D1：用户映射、餐厅、Meal、Dish、Serving、Vote、名称候选、举报、重复候选；
- R2：原图、清理 EXIF 后的规范图、缩略图；
- 服务端 route/actions：上传签名、记录写入、投票、排行榜、补名、举报、管理操作；
- API 返回统一 `{ data, error, requestId }` 结构和明确 HTTP 状态。

## 4. 数据表

Phase 2 已落地 `users`、`venues`、`meals`、`dishes`、`servings`、`meal_items`、`votes`。图片表留到 Phase 3，补名、去重和举报表留到 Phase 5；只建立当前阶段实际使用的约束。

```text
venues
  id, canonical_name, nickname, address, latitude, longitude, active

users
  id, created_at

meals
  id, venue_id, creator_id, eaten_on, overall_note, created_at, status

dishes
  id, canonical_name_fr, canonical_name_zh, original_description,
  category, naming_status, created_at

servings
  id, dish_id, venue_id, served_on, creator_id,
  initial_tier, status, created_at

meal_items
  meal_id, serving_id, slot(main/side_1/side_2)

votes
  id, dish_id, user_id, target_tier, created_at, updated_at
  UNIQUE(dish_id, user_id)
```

分类值 v1 固定为 `main` 和 `side`；更细的 starter/dairy/dessert/fruit 作为元数据预留，不建立独立排行榜。

`Dish.category` 是排名池的唯一分类来源；`community_tier` 和 `vote_count` 从当前有效票实时推导，不在 Dish 缓存。榜内暂用技术稳定序 `tier ASC → vote_count DESC → dish_id ASC`，这不是新增业务优先级，后续如需其他同档排序必须先更新 BIZ/REQ。

`meal_items` 的 INSERT/UPDATE trigger 保证主食只能进入 `main` slot、小菜只能进入 side slot，并要求 Meal 与 Serving 的餐厅和日期一致；普通 CHECK 无法表达这些跨表约束。

## 5. 关键服务

- `RankingService`：Dish 五档中位数、票数状态、主食/小菜隔离及只读榜单/详情；
- `UploadService`：校验、EXIF 清理、缩略图、R2；
- `DuplicateService`：SHA-256、pHash 和元数据候选；
- `NamingService`：别名标准化、候选与确认；
- `ModerationService`：举报和可见性；
- `VenueService`：正式名、昵称和搜索别名。

## 6. AI 延后方案

v1 不配置 OpenAI API key。后续启用时：

- 仅用户点击“帮我猜”时调用；
- 服务端调用 OpenAI Responses API 图像输入；
- 只上传压缩副本；
- 每用户每日限额、全站月度预算上限、结果缓存；
- 返回 1–3 个候选、理由和置信度；
- API key 只在 Sites secret 中；
- AI 失败时退回“神秘菜品 + 社区补名”，不得阻塞投稿。

## 7. 性能与安全预算

- 首屏不加载 Three.js/Rapier；
- 图片使用固定宽高和响应式缩略图；
- 动画模块按需加载；
- 限制文件类型、体积和像素数；
- 清除 EXIF/GPS；
- 投票与投稿限流；
- 所有用户输入转义；
- 管理端权限在服务端验证；
- Buy Me a Coffee 使用 `target=_blank` 与 `rel=noopener noreferrer`。

## 8. 测试重点

- 排名中位数、偶数票边界与修改投票；
- 同一用户重复投票唯一约束；
- 偶数票取两个中间等级中较差一档；
- 主食/小菜隔离；
- 未知菜名投稿；
- 图片校验和重复检测；
- 未登录/非管理员写操作；
- reduced motion；
- 桌面端上传与榜单重排；移动端适配在全部既定阶段之后。
