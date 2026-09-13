# DEV-20260910-01：OpenAI Sites 技术架构

状态：Confirmed for v1（2026-09-10）。

## 1. 部署模式

本项目包含持久化、上传、认证和多页面，必须走 OpenAI Sites capability path，不使用纯静态 one-shot。

目标运行形态：Cloudflare Worker 兼容 ESM；使用 Sites 管理 D1、R2 和部署绑定，应用在 D1 中管理邮箱验证码与会话。

## 2. 前端

- Vinext/React + TypeScript；
- Tailwind CSS；
- starter 内置 shadcn/ui：Dialog、Sheet、Tabs、Select/Combobox、Progress、Skeleton、Sonner、AlertDialog；
- GSAP Flip：筛选、投票后榜单重排；
- GSAP MotionPath：菜品卡片跨等级移动；
- Canvas 2D：重大降级时的轻量 pixel shatter；
- 所有动画默认开启，并在操作系统声明 `prefers-reduced-motion` 时降级；动画仅消费服务端确认后的状态，失败不会改变业务结果。
- 重大像素效果以会话存储去重，Canvas 限制设备像素比并在约 1200ms 内销毁；不引入 Three.js/Rapier。

## 3. 后端与存储

- D1：用户映射、餐厅、Meal、Dish、Serving、Vote、名称候选/支持、别名、举报、AI 观察与管理审计；
- R2：原图、清理 EXIF 后的规范图、缩略图；
- 服务端 route/actions：上传签名、记录写入、投票、排行榜、补名、举报、管理操作；
- API 返回统一 `{ data, error, requestId }` 结构和明确 HTTP 状态。

## 4. 数据表

Phase 2 已落地 `users`、`venues`、`meals`、`dishes`、`servings`、`meal_items`、`votes`。Phase 3 新增 `photos`、`daily_case_counters`、食堂序号及 Meal 案号；Phase 4 新增 `vote_rate_limits`；Phase 5 新增名称候选/支持、别名、举报、管理审计和 AI 观察，并允许同一道菜同食堂同日拥有多个用户行踪。

```text
venues
  id, canonical_name, nickname, display_number, address, latitude, longitude, active

users
  id, created_at

meals
  id, venue_id, creator_id, eaten_on, case_number, display_order, overall_note, created_at, status

photos
  id, meal_id, creator_id, canonical_key, thumbnail_key,
  media_type, width, height, byte_size, content_sha256, created_at

daily_case_counters
  eaten_on, venue_id, next_sequence

dishes
  id, canonical_name_fr, canonical_name_zh, original_description,
  category, naming_status, merged_into_dish_id, created_at

servings
  id, dish_id, venue_id, served_on, creator_id,
  original_description, initial_tier, status, created_at

meal_items
  meal_id, serving_id, slot(main/side_1/side_2)

votes
  id, dish_id, user_id, target_tier, created_at, updated_at
  UNIQUE(dish_id, user_id)

vote_rate_limits
  user_id, window_started_at, attempts

dish_aliases / name_suggestions / name_endorsements
reports / moderation_actions / ai_identifications
```

分类值 v1 固定为 `main` 和 `side`；更细的 starter/dairy/dessert/fruit 作为元数据预留，不建立独立排行榜。

`Dish.category` 是排名池的唯一分类来源；`community_tier` 和 `vote_count` 从当前有效票实时推导，不在 Dish 缓存。榜内暂用技术稳定序 `tier ASC → vote_count DESC → dish_id ASC`，这不是新增业务优先级，后续如需其他同档排序必须先更新 BIZ/REQ。

`meal_items` 的 INSERT/UPDATE trigger 保证主食只能进入 `main` slot、小菜只能进入 side slot，并要求 Meal 与 Serving 的餐厅和日期一致；普通 CHECK 无法表达这些跨表约束。

## 5. 关键服务

- `RankingService`：Dish 五档中位数、票数状态、主食/小菜隔离及只读榜单/详情；
- `UploadService`：校验、EXIF 清理、缩略图、R2，并以 SHA-256 只拦同账号相同规范图片；视觉相似度不参与 Phase 5 自动判断；
- `NamingService`：别名标准化、候选与确认；
- `ModerationService`：举报和可见性；
- `VenueService`：正式名、昵称和搜索别名。

Phase 3 上传链路：浏览器先将 HEIF/HEIC 本地解码为 JPEG，再用 Canvas 把 JPG、PNG 或转换结果重编码为无 EXIF/GPS 的规范 JPEG 与缩略图；原始文件不离开浏览器。服务端再次按文件签名、结构、大小、像素数和元数据段校验，经 R2 写入成功后用 D1 `batch` 原子分配案号并写入 Meal、Photo、Dish、Serving、MealItem 和投稿者第一票；D1 失败时删除已写 R2 对象。用餐日期按 `Europe/Paris` 当天在前端设置上限，并由服务端再次拒绝未来日期。

写接口 `POST /api/uploads` 只信任服务端邮箱会话；匿名请求返回 401，跨站请求返回 403，同一用户十分钟最多发布五次。`GET /api/photos/:id` 只返回 active Meal 的规范图并设置 `nosniff`。

写接口 `POST /api/dishes/:id/vote` 接受 `{ targetTier: 1..5 }`，只允许登录用户对存在 active Meal/Serving 的 Dish 投票。数据库以 `UNIQUE(dish_id,user_id)` 和 `INSERT ... ON CONFLICT DO NOTHING` 原子保证只能投一次，重复提交返回 409；每用户固定窗口一分钟最多 30 次请求。成功返回权威 Dish 与 `myVote`，匿名、跨站、非法等级、不可见 Dish 和超限分别返回 401/403/400/404/409/429。

首页通过 `getUserVotes(dishIds, currentUserId)` 获取当前账号 Vote 映射：缺少记录的卡片显示 `NEW`，服务端确认投票后客户端仅把该 Dish 写入当前页面的 Vote 映射。状态不持久化到公共 Dish，也不新增可被其他账号读取的审阅字段。

长期榜单继续直接使用公共 `listRankings()` 结果；首页首位被告仅在展示层依据当前账号 Vote 映射选择第一个未审阅 Dish，不改变公共排序和 Dish 数据。

### 5.1 邮箱验证码认证

- `email_otp_challenges` 只保存邮箱、客户端地址和六位码的 HMAC 摘要；验证码 10 分钟过期、最多尝试 5 次，同邮箱至少间隔 60 秒且每小时最多 3 封、同地址 15 分钟最多 10 封；
- `auth_sessions` 只保存 256-bit 随机会话令牌的 SHA-256 摘要；浏览器 Cookie 使用 HttpOnly、SameSite=Lax，生产使用 Secure 与 `__Host-` 前缀，30 天过期；
- 登录成功原子消费验证码并复用同一邮箱对应的随机 User ID；验证码不可重放；退出时服务端撤销会话；
- 邮箱在 HMAC 前执行 NFC、首尾去空格和域名小写规范化，本地部分保留大小写；`users.email_digest` 唯一约束保证相同完整邮箱重复登录复用 User ID，业务记录不依赖短期 Session；
- 生产发信使用 Resend HTTP API，`AUTH_HMAC_SECRET`、`RESEND_API_KEY`、`OTP_FROM_EMAIL` 只放 Sites 服务端配置；HMAC secret 必须长期保存，轮换会使既有邮箱映射无法复用；
- 本地模式只在显式 `AUTH_MODE=local` 且请求来自 `localhost/127.0.0.1` 时回显随机验证码；私有 `.dev.vars` 设置 `AUTH_MODE=local-resend` 时，本地请求改走 Resend 且不回显验证码；生产仅使用 `AUTH_MODE=resend` 与 `__Host-` Cookie，非回环地址失败关闭；
- 所有认证和上传写请求校验同源，响应和日志不得包含邮箱、验证码、API key 或会话令牌。

## 6. Phase 5 多模态候选识别

- 仅用户点击“饿晕了？让 AI 指认”时调用自有 OpenAI-compatible `/chat/completions` 多模态接口；
- 服务端私密配置固定为 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`，不得进入客户端或日志；
- 只上传浏览器已重编码、清除元数据后的缩略副本；
- 严格 JSON Schema 允许 `staple: null`，要求状态、食品图片标记、小菜数组、其他可见物、warnings 与场景描述齐全；
- 主食和每份小菜必须返回可空的 `region`；非空时为相对整图的 `x/y/width/height`，服务端校验各值和右/下边界均在 `0–1` 内，上传页只将其作为可修改候选的视觉标示；
- Schema/字段错误最多自动重试一次；超时、限流、余额不足或未配置时退回手填/未知菜品；
- 每用户每日最多 3 个新识别结果；按用户、图片 SHA-256、模型与提示词版本缓存；
- AI 观察与用户最终选择分开保存，只生成候选，不自动改名、关联、合并，不判断过敏原；
- 视觉 embedding、pHash 阈值与 clustering 延后到有真实标注数据后。

Phase 5 管理员由 `ADMIN_EMAILS` 服务端白名单判定：当前会话 User ID 反查邮箱摘要，再与同一长期 HMAC secret 计算的白名单摘要恒定时间比较。空白名单失败关闭。

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

- 排名中位数、偶数票边界与一次性投票；
- 同一用户重复投票唯一约束；
- 偶数票取两个中间等级中较差一档；
- 主食/小菜隔离；
- 未知菜名投稿；
- 图片校验和重复检测；
- 未登录/非管理员写操作；
- reduced motion；
- 桌面端上传与榜单重排；移动端适配在全部既定阶段之后。
