# DEV-20260910-02：分阶段实施计划

## Phase 0：项目与决策冻结（完成）

工作：初始化 Sites 项目、AGENTS/DOCUMENT_MAP/docs、确认 REQ Open Decisions、建立真实 `.openai/hosting.json`。

DoD：

- 文档结构与项目代码同仓；
- Open Decisions 已确认或明确延期；
- v1 范围标记 Frozen；
- starter 可启动；
- PROG 更新。

完成日期：2026-09-10。

## Phase 1：视觉骨架与第一预览

工作：首页“今日被告”静态代表数据、主题 token、投票控件、主食/小菜榜静态布局、移动端基础布局。

DoD：

- 首屏可识别产品与视觉方向；
- 核心赞同/异议控件可操作（可暂用本地假数据）；
- 非默认 shadcn 外观；
- 首次有意义预览可展示；
- reduced-motion 基础存在。

## Phase 2：D1 数据与排名核心

工作：schema/migration、种子餐厅、Meal/Dish/Serving/Vote、RankingService、读取列表和详情。

DoD：

- 数据库可初始化；
- 两家餐厅种子正确；
- 修改投票与中位数规则测试通过；
- 主食/小菜隔离；
- 刷新后数据存在。

## Phase 3：认证、上传与 R2

工作：登录、图片处理、整盘上传、未知菜名、1 主食 + 最多 2 小菜、EXIF 清理。

DoD：

- 未登录不能写入；
- 手机完成端到端上传；
- 图片在 R2，记录在 D1；
- 未知菜名可发布；
- 非法文件被拒绝且说明原因。

## Phase 4：社区链路与去重

工作：赞同/异议真实 API、补名、SHA-256/pHash、疑似重复选择、举报。

DoD：

- 投稿→投票→社区等级→榜单闭环；
- 补名与证据可提交；
- 重复提示不自动误合并；
- 错误响应统一；
- 必要速率限制生效。

## Phase 5：动画与视觉完成

工作：MotionPath、Flip、盖章微交互、Canvas 2D pixel shatter、详情拍立得布局。

DoD：

- 动画失败不影响业务状态；
- 手机性能可接受；
- reduced-motion 完整；
- 重大动画不重复骚扰；
- 键盘/触屏完整可用。

## Phase 6：管理、赞助与上线

工作：管理员队列、Buy Me a Coffee 外链、空/错/加载状态、元数据、构建、Sites 私有部署与发布确认。

DoD：

- 举报和重复候选可处理；
- 赞助跳转安全；
- 关键页面验收通过；
- 构建与部署成功；
- PROG、README 和已知限制更新。

## Phase 7（post-v1，可选）

- 按需 OpenAI 图像识别；
- 用户上传现场菜单并 OCR；
- AI/搜索/历史/社区交叉验证；
- Three.js + Rapier Pixel Voxel Drop 桌面彩蛋；
- 扩展餐厅和更细小菜分类。

进入条件：v1 有真实使用数据、预算和性能证据。不得提前实现。
