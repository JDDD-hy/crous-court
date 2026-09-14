# CROUS 法庭

**今天的 CROUS，值得封神还是应该上庭？**

CROUS 法庭是一个面向 Palaiseau 学生的食堂菜品社区评级网站。拍下你的餐盘，给菜品一个初判，再让吃过它的人一起投票——从「夯」到「拉爆了」，让食堂体验变成大家都能参考的榜单。

[访问网站](https://crouscourt.fun) · [反馈问题](https://github.com/JDDD-hy/crous-court/issues)

## 为什么做这个网站

这个想法来自朋友的一句话：给 CROUS 食堂的菜品做一个「从夯到拉」排行榜。

但它不该只停留在两个人之间。附近还有许多中国留学生，每天都在面对同一个问题：今天吃什么？于是，我就把这个想法做成了网站，让大家分享真实餐盘、推荐好菜，也给踩过的雷留下一点证据。

这是学生发起的社区项目，并非 CROUS 官方网站。「法庭」和「判决」是网站的趣味表达，排名反映参与者的主观口味。

## 在这里可以做什么

- **看榜单**：按餐厅、主食与小菜查看社区评级，进入菜品详情查看餐盘记录和票数分布。
- **晒餐盘**：上传真实照片，填写餐厅、用餐日期和菜品信息，为菜品给出初始等级。
- **参与判决**：认可当前等级就选「判得对」；不同意则提出异议，选择你认为合适的等级。
- **一起认菜**：不知道菜名也能投稿，之后由社区提出名称、参与补名；疑似重复菜品需要确认，不会自动合并。
- **请 AI 帮忙**：识别餐盘中的主食与小菜，提供候选名称和图片区域，最终由你确认。未配置 AI 时仍可手动填写或保留未知菜名。
- **维护社区内容**：用户可以举报问题内容，管理员可以处理举报、补名和重复菜品。

目前覆盖两处餐厅：

| 餐厅 | 网站中的位置提示 |
| --- | --- |
| L’Expérimental | 宿舍 CROUS / All Suites 附近 |
| Escoffier | 学校 CROUS / Télécom 附近 |

## 如何参与

1. 浏览榜单，找到你吃过的菜。
2. 使用邮箱验证码登录，参与投票或投稿。
3. 投稿时上传餐盘照片，确认要评价的菜品及其等级。一张餐盘照片可以包含多道菜，主食与小菜分别评价。
4. 遇到未知菜名或错误信息，通过补名、举报功能参与修正。

图片支持 **JPG、PNG、HEIC、HEIF**，原图上限为 **12 MB**。浏览器会转换、压缩图片并生成缩略图；HEIC / HEIF 转换失败时，可先导出为 JPEG 再上传。

请使用自己拍摄的照片，避免包含人脸、学生证或其他个人信息。AI 识别仅供辅助，不能作为配方、过敏原或食品安全判断依据。

### 等级如何计算

等级从高到低为：**夯 → 顶级 → 人上人 → NPC → 拉爆了**。

系统保存每位用户实际选择的目标等级，用这些等级的**有序中位数**计算社区结果。修改投票会替换原有选择，不会重复累加；偶数票时取排序后靠较低评价一侧的中位等级。

| 有效票数 | 判决状态 |
| --- | --- |
| 少于 5 票 | 待审 |
| 5–14 票 | 暂定 |
| 15 票及以上 | 正式 |

「正式」只代表达到站内票数门槛，不代表官方认证。动画用于呈现等级变化，不参与排名计算。

## 技术栈

| 层级 | 实现 |
| --- | --- |
| 页面与接口 | React 19、TypeScript、Vinext / Vite，采用 Next.js App Router 风格 |
| 样式与组件 | Tailwind CSS 4、shadcn/ui 相关组件 |
| 运行与托管 | OpenAI Sites / Cloudflare Workers |
| 结构化数据 | D1、Drizzle ORM 与 SQL migrations |
| 图片存储 | R2 |
| 登录 | 邮箱验证码、服务端会话；Resend 负责邮件投递 |
| AI 识菜 | 服务端调用兼容 Chat Completions 的多模态接口，使用 JSON Schema 约束结果 |
| 动效 | GSAP、Canvas 2D，以及按需加载的 Three.js / Rapier 特效 |

## 本地开发

### 环境要求

- Node.js **22.13.0 或更新版本**及 npm。
- Git，以及该仓库的读取权限。
- 首次安装依赖需要网络连接。

### 启动完整应用

```bash
git clone https://github.com/JDDD-hy/crous-court.git
cd crous-court
npm run install:ci
npm run build
npm run db:migrate:local
npm run db:fixtures:local
npm start
```

打开终端输出的本地地址。

先构建再执行数据库命令：迁移脚本需要构建生成的 `dist/server/wrangler.json`。本地状态保存在 `.wrangler/crous-court`；fixture 仅用于开发演示，不应导入生产数据库。

`npm start` 使用 Wrangler 启动已构建的本地 Worker，并读取项目根目录下的 `.dev.vars`。没有该文件时，会自动启用仅限回环地址的本地登录模式：验证码直接在页面显示，不发送邮件。该模式的认证密钥在启动时随机生成，重启后需要重新登录。

日常页面开发可使用 `npm run dev` 启动热更新服务。验证数据库、登录和上传等完整链路时，使用上面的构建及 Worker 启动流程；修改源码后需重新构建并重启 `npm start` 才能检查最新版本。

### 环境配置

需要真实邮件或 AI 功能时，在项目根目录**新建** `.dev.vars`。该文件已被 Git 忽略；当前仓库不包含 `.dev.vars.example`。

| 变量 | 用途 |
| --- | --- |
| `AUTH_MODE` | `local`：本地显示验证码；`local-resend`：本地真实发信；`resend`：生产发信配置 |
| `AUTH_HMAC_SECRET` | 至少 32 个字符的随机密钥，用于认证相关摘要；生产环境需要固定保存 |
| `RESEND_API_KEY` | 启用真实邮件时必填 |
| `OTP_FROM_EMAIL` | 验证码邮件发件地址，需满足 Resend 发信配置 |
| `ADMIN_EMAILS` | 可选，管理员邮箱列表，以逗号分隔 |
| `AI_BASE_URL` | 可选，AI 接口基础地址；代码会在后面追加 `/chat/completions` |
| `AI_API_KEY` | 启用 AI 识菜时必填 |
| `AI_MODEL` | 启用 AI 识菜时必填；模型需支持图片输入及当前 JSON Schema 输出格式 |

本地真实发信的最小配置示例，使用前替换所有占位值：

```dotenv
AUTH_MODE=local-resend
AUTH_HMAC_SECRET=REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
RESEND_API_KEY=REPLACE_WITH_YOUR_RESEND_KEY
OTP_FROM_EMAIL="CROUS 法庭 <login@your-verified-domain.example>"
```

可用以下命令生成随机认证密钥，并将结果仅保存到本地配置或部署平台的 secret 中：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

创建 `.dev.vars` 后，启动脚本不再自动注入默认认证配置，因此需要自行设置 `AUTH_MODE` 和 `AUTH_HMAC_SECRET`。更改配置后重新运行 `npm start`。

AI 的三个变量需一起配置。不启用 AI 不影响手动投稿与社区补名。密钥仅供服务端使用，不要添加到前端公开变量、提交到仓库或写入日志。

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务 |
| `npm run build` | 构建应用 |
| `npm start` | 启动构建后的本地 Worker |
| `npm run lint` | ESLint 检查 |
| `npx tsc --noEmit` | TypeScript 类型检查 |
| `npm test` | 运行单元测试 |
| `npm run db:generate` | 根据 schema 生成迁移文件 |
| `npm run db:migrate:local` | 应用本地 D1 迁移 |
| `npm run db:fixtures:local` | 导入本地演示数据 |
| `npm run test:db` | 数据库验证 |
| `npm run test:auth` | 登录与上传链路验证 |
| `npm run test:voting` | 投票链路验证 |
| `npm run test:governance` | 构建并验证内容治理链路 |

集成验证脚本会使用本地数据库或 Worker，请先阅读对应脚本的初始化逻辑，在开发环境中运行。

### 代码导航

| 路径 | 内容 |
| --- | --- |
| `app/` | 榜单、菜品详情、投稿、故事页、管理页及 API 路由 |
| `components/crous/` | 产品界面与交互组件 |
| `lib/ranking.ts` | 等级中位数与判决状态计算 |
| `lib/auth/` | 邮箱验证码、会话与权限 |
| `lib/upload/` | 客户端图片处理及服务端上传校验 |
| `lib/ai/` | AI 识菜请求与结果校验 |
| `lib/governance/` | 补名、审核、去重候选与限流 |
| `db/`、`drizzle/` | 数据模型、开发数据与迁移文件 |
| `tests/`、`scripts/` | 单元测试、集成验证及开发脚本 |
| `public/` | 静态资源 |
| `.openai/hosting.json`、`vite.config.ts` | Sites 托管声明与构建配置 |

## 部署与当前限制

项目按 **OpenAI Sites** 的服务端应用方式组织，需要 D1（`DB`）和 R2（`BUCKET`）绑定，不是仅上传静态文件即可运行的网站。`vite.config.ts` 中的数据库 ID 是占位值，不能作为生产资源配置使用。

部署时需要准备数据库与图片存储、应用迁移，并在服务端配置生产认证和邮件 secret；AI 配置可选。不要把本地 fixture、开发验证码模式或本地认证密钥用于生产。

当前源码快照仍有以下限制：

- **上传入口的生产保护尚待确认。** 已有应用层大小校验，但 multipart 仍通过 `request.formData()` 解析，解析后检查不能替代解析前的请求体硬限制。现有项目记录将 `BUG-20260913-01` 列为上线阻塞；发布前需验证边缘请求体限制及所有可访问入口的覆盖情况。
- **生产验收尚未完整关闭。** 本地功能实现或测试通过不等同于线上邮件、上传、权限和异常链路全部通过验收。
- **移动端完整适配、真实 GPU 环境下的 3D 动效视觉验收仍需完成。** 当前开发以桌面端为主。
- **内部文档未随源码提交。** `DOCUMENT_MAP.md` 引用的 `docs/` 目录当前被 Git 忽略，相关需求、进度和缺陷正文不在此快照中。开发接手时需要向维护者取得对应资料。


## 许可

当前仓库未提供项目级开源许可证。第三方代码与资源遵循各自许可；本项目代码的使用、修改和再分发授权需与维护者确认。
