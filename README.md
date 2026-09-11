# CROUS法庭

Télécom Paris / Palaiseau 学生的 CROUS 菜品社区审判网站。

用户上传一张真实餐盘照片，标记来自 L’Expérimental 或 Escoffier，给菜品一个主观初判。其他用户可以“判得对”，或提出异议并选择目标等级。系统保存每个人真正认可的等级，用有序中位数生成社区判决，并通过夸张但克制的动画让菜品在等级之间移动。

## 当前状态

Phase 3 已完成：ChatGPT 登录写入边界、浏览器端 EXIF/GPS 清理、服务端图片复验、R2 图片与 D1 投稿记录已接通；同日多次投稿按稳定案号排序。社区投票写入、补名治理和 AI 辅助审核仍按后续阶段延期。

本地 D1 首次运行顺序：`npm run build` → `npm run db:migrate:local` → `npm run db:fixtures:local` → `npm start`。fixture 只用于本地开发，不含真实用户或生产种子内容。

## 开发前必读

1. `AGENTS.md`
2. `DOCUMENT_MAP.md`
3. `docs/requirements/REQ-20260910-01-crous-tier-v1.md`
4. `docs/business/BIZ-20260910-01-ranking-and-content.md`
5. `docs/technical/DEV-20260910-01-sites-architecture.md`
6. `docs/ui/UI-20260910-01-visual-and-motion.md`
7. `docs/technical/DEV-20260910-02-phase-plan.md`

## 首轮 Codex 指令

> 阅读 AGENTS.md 和 DOCUMENT_MAP.md，并严格按 DEV-20260910-02 的 Phase 0 开始。先检查 Open Decisions；不要直接实现完整产品。完成当前 Phase 的 DoD、更新 PROG 后停止，汇报验证结果并等待下一阶段。
