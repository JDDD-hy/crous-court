# 历史投稿迁移到已确认 Cafétéria

用户于 2026-09-15 明确确认，将旧 Escoffier 与 L’Expérimental 投稿分别迁入 Cafétéria Escoffier、Cafétéria L’Expérimental，并要求部署、合并与推送 GitHub。这替代此前历史 RU/Cafétéria 归属未定的约束。

迁移前生产只读核对：6 个有效 Meal、19 个 Serving；长期可见 17 道菜（5 主食、12 小菜），巴黎 2026-09-15 的今日/昨天窗口有15道。数据没有丢失；新细分地点 ID 排除了旧地点数据。

0017 仅修改 meals/servings 的 venue_id，保留菜品、照片、原始文字、日期、初评、社区票和案号。目标餐厅当天已存在记录时，为迁入餐次避开内部 display_order 冲突，并更新目标 daily_case_counters，保证下一次上传可继续。旧地点记录与旧计数器保留供审计，不给 RU 混入这些历史投稿。

测试：迁移前载入旧记录和已有 Cafétéria 记录；确认身份/照片/投票/案号不变、Meal 与 Serving 地点一致、重复运行无害、下一次同日上传编号无冲突、外键有效。56 项测试通过；TypeScript、定向 ESLint 通过。真实本地 D1 迁移与 Cafétéria 榜单读取通过。仅 SQL/测试/说明变化，沿用上一轮已验证应用构建。

生产迁移由 Sites 部署执行；发布后对比迁移前公开榜单快照并复查 Meal/Serving，终态与结果记入本地 PROG。
