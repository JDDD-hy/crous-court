# BUG-20260913-01：multipart 预解析资源耗尽

状态：Mitigated in app / **上线阻塞（Medium）**。应用层修复及并发回归已通过；Cloudflare 边缘请求体规则验证前禁止正式部署。

## 已确认问题

`POST /api/uploads` 与 `POST /api/ai/identify` 在执行 `request.formData()`、完整缓冲并解析 multipart 正文后，才检查单文件 8 MB 限制和消耗业务限流额度。已登录攻击者可重复提交超大、畸形或多分段正文，使失败请求绕过现有上传/AI 计数并消耗 Worker 内存和 CPU。

## 必须整改

- [x] 错误 Content-Type 在有界丢弃正文后返回 415；存在 `Content-Length` 时，上传超过 17 MB、AI 超过 9 MB 均在解析前返回 413；
- [x] 原生 multipart 解析后复核总字段内容大小及最多 32 个分段，保留单文件格式、8 MB、像素及元数据校验；
- [x] 保留投稿十分钟五次、AI 每日三次的原子业务额度；六路并发投稿回归为五次成功、一次业务拒绝，无 503；
- [ ] 部署时使用 Cloudflare `http.request.body.size` 规则分别限制两个接口，覆盖 Worker 未暴露 `Content-Length` 的请求，并实测 413。

## 关闭条件

- [x] 两个接口共享受限 multipart 边界；声明超限快速拒绝，解析后复核真实字段总量和分段数；
- [x] 自动测试覆盖超大声明、伪造较小长度、错误 Content-Type、过多分段与正常 multipart；
- [x] 本地 Worker 六路并发、生产构建和治理/AI 契约回归通过；
- [ ] 部署环境的解析前总请求体限制有可验证证据。

## 实施说明

Cloudflare Workers 对普通 FormData 请求不保证应用始终可见 `Content-Length`，因此不能强制 411；直接包装或重建请求流在当前本地 workerd 六路并发下稳定产生一路 503，也不能作为生产修复。当前代码采用并发稳定的原生解析路径，并把缺失长度时的解析前硬限制交给 Cloudflare 边缘规则。Cloudflare 官方文档显示 Free/Pro 默认请求体上限为 100 MB、Worker 内存上限为 128 MB，因此默认平台上限不足以关闭本问题。

标准安全报告位于本机临时目录：`codex-security-scans/crous-tier-spec/0d523763-1bab-447a-aeb5-e950f07129e0/report.md`。
