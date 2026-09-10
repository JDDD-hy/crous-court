# DOCUMENT_MAP

| 职责 | 文件 |
|---|---|
| 项目契约与 Agent 规则 | `AGENTS.md` |
| 项目介绍与启动顺序 | `README.md` |
| v1 产品需求与范围冻结 | `docs/requirements/REQ-20260910-01-crous-tier-v1.md` |
| 已确认业务规则 | `docs/business/BIZ-20260910-01-ranking-and-content.md` |
| 技术架构与数据设计 | `docs/technical/DEV-20260910-01-sites-architecture.md` |
| 页面、视觉和动效规范 | `docs/ui/UI-20260910-01-visual-and-motion.md` |
| 分阶段实施计划 | `docs/technical/DEV-20260910-02-phase-plan.md` |
| 当前进度 | `docs/progress/PROG-20260910.md` |

## 更新矩阵

| 发生变化 | 必须更新 |
|---|---|
| 产品范围或验收标准 | REQ + PROG |
| 排名、投稿、去重等业务规则 | BIZ + REQ + 相关测试 |
| 数据表、存储、认证或 API | DEV + migration + PROG |
| 页面结构、文案或动画规则 | UI + REQ（若影响验收） |
| 发现缺陷 | 新建 `docs/bugs/BUG-YYYYMMDD-XX-*.md` + PROG |
| 完成阶段 | Phase DEV + PROG + README 状态 |
