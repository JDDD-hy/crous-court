# CROUS法庭

Télécom Paris / Palaiseau 学生的 CROUS 菜品社区审判网站。

用户上传一张真实餐盘照片，标记来自 L’Expérimental 或 Escoffier，给菜品一个主观初判。其他用户可以“判得对”，或提出异议并选择目标等级。系统保存每个人真正认可的等级，用有序中位数生成社区判决，并通过夸张但克制的动画让菜品在等级之间移动。

## 当前状态

Phase 6 已完成：公共浏览、邮箱登录、餐盘上传、一次性投票、动态排名、补名治理和多模态候选识别均已接通；桌面端补齐判决盖章、榜单重排、重大降级像素碎裂、系统 reduced-motion 降级与多次出餐照片布局。网页不会向访客展示内部 Phase 名称。

本地 D1 首次运行顺序：`npm run build` → `npm run db:migrate:local` → `npm run db:fixtures:local` → `npm start`。fixture 只用于本地开发，不含真实用户或生产种子内容。

本地邮箱登录默认在页面显示一次性验收验证码；该模式只允许回环地址。要在本地真实收信，复制 `.dev.vars.example` 为被 Git 忽略的 `.dev.vars`，替换全部占位值后重新运行 `npm start`。未验证域名时，Resend 只允许投递到该账号自己的邮箱。所有密钥不得提交到 Git 或发到聊天中。

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
