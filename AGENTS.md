# AGENTS.md — CROUS 夯拉榜项目契约

## 1. 产品目标

构建一个面向 Télécom Paris / Palaiseau 学生的 CROUS 菜品社区评级网站。用户上传真实餐盘照片，提交主观初始等级，其他用户赞同或选择自己认为正确的等级；菜品根据社区投票逐渐在“从夯到拉”的等级之间移动。

首发餐厅：

- L’Expérimental（面向用户显示“宿舍 CROUS / All Suites 附近”）
- Escoffier（面向用户显示“学校 CROUS / Télécom 附近”）

## 2. 执行原则

1. 开始任务前依次阅读 `DOCUMENT_MAP.md`、相关 REQ/BIZ/DEV/UI 文档和当天 PROG。
2. 文档优先级：用户当前明确指令 > AGENTS.md > 已确认 BIZ/REQ > DEV/UI > README > 代码现状。
3. 不擅自扩展 v1 范围，不顺手重构，不替换已确认技术栈。
4. 未确认的产品决策写入对应 REQ/BIZ 的 Open Decisions，不自行补成事实。
5. 每个 Phase 必须满足 DoD 后才能进入下一 Phase。
6. 数据库、身份认证、上传与部署属于 Sites capability path；遵循 Sites 当前能力与配置，不以纯静态站替代。
7. 任何 OpenAI/Resend API key、认证 HMAC secret、支付配置和管理凭证只保存在服务器端 secret，禁止进入客户端、仓库或日志。
8. AI 识菜不是 v1 阻塞项；无 API key 时必须完整支持“未知菜品 + 社区补名”。

## 3. 技术栈

- OpenAI Sites 标准 Vinext/React starter
- TypeScript
- Tailwind CSS 与 starter 已安装的 shadcn/ui primitives
- Sites D1：结构化数据
- Sites R2：用户图片及缩略图
- D1 邮箱验证码与服务端会话；Resend 仅负责验证码邮件投递
- GSAP：MotionPathPlugin、Flip；尊重 `prefers-reduced-motion`
- Canvas 2D：轻量像素碎裂/坠落彩蛋
- 可选后续：Three.js + Rapier，仅用于延迟加载的 Pixel Voxel 特效
- 可选后续：OpenAI Responses API 图像输入，仅在服务器端按需调用

除非 REQ 明确新增，不引入其他状态管理库、动画库、数据库或外部后端。

## 4. 编码规范

- TypeScript 开启严格类型；禁止无理由使用 `any`。
- 组件使用 PascalCase，hooks 使用 `useXxx`，数据库字段使用 snake_case。
- 业务计算（等级中位数、门槛、去重）放在独立 domain/service 层，不写进 UI 组件。
- 所有写操作在服务端校验用户、字段、权限和速率限制。
- 图片上传必须校验 MIME、文件大小、像素尺寸，移除 EXIF，并生成缩略图。
- UI 文案以简体中文为主，保留正式法语菜名和餐厅名。
- 主体文字至少 16px，常用标签至少 14px；键盘、触屏和 200% 文本缩放可用。
- 动画不得阻塞投票结果；失败时直接完成状态更新。

## 5. 禁止事项

- 不把一张照片直接等同于一道菜。
- 不根据当前赞同/反对比例递归移动菜品；每票必须保存用户目标等级。
- 不让 AI 识别结果冒充确定事实或过敏原信息。
- 不自动合并疑似重复菜品；只建议，由用户或管理员确认。
- 不在 v1 添加关注、私信、好友、勋章、长评、复杂推荐或完整 Three.js 场景。
- 不在首页放阻挡核心操作的大型营销 Hero。
- 不复制 Codrops 的图片或整体设计资产；只借鉴交互思想，并核查所用代码许可。

## 6. 完成定义（DoD）

一个功能只有同时满足以下条件才算完成：

- 对应 REQ 验收标准通过；
- 正常、空、加载、错误和无权限状态可用；
- Phase 0–8 先完成桌面端；移动端完整适配在全部既定阶段之后单独实施；
- 关键业务逻辑有针对性测试；
- 构建成功，无阻塞运行时错误；
- 相关 REQ/BIZ/DEV/UI 与 PROG 已同步；
- 未完成项和已知问题被明确记录，不能隐藏在代码注释中。

## 7. Git 交付

- 每个 Phase 使用独立、语义明确的提交。
- 不修改或删除用户现有改动。
- 未经明确要求不执行破坏性 Git 操作。
- 提交前给出变更摘要、验证结果、已知限制和下一 Phase 入口条件。
