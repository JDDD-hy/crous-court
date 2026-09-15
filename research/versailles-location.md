# Crous de Versailles：地点搜索与定位研究

日期：2026-09-15。状态：供审阅的技术方案，不是生产已实现能力；本轮不部署、不导入生产餐厅、不改评分规则。

## 结论

采用官方餐厅目录作为唯一候选集合，使用本地文本搜索；用户主动定位后，用 Haversine 直线距离排列附近候选，最后由用户确认具体餐饮点。首版不需要地图 SDK、Google Places、向量检索或空间索引。66 个点的计算规模很小，数据质量和 RU/Cafétéria 消歧比算法复杂度更重要。

独立 `/venues` 本地页面已实现搜索、定位和选择。研究原型与真实投稿地点关联分开：目录尚未完成导入审阅，演示选择不改变首页、投票或上传范围。只在浏览器保存 `crous-venue-preview` 地点 ID，不保存设备坐标。

## 1. 已核对的事实与数据边界

- 本地 `research-20260914/crous-ile-de-france.json` 有 66 条 `crous=Versailles` 记录，原快照字段仅含官网名、链接、来源、日期和空 emoji。这是目录记录数，不是正在营业、独立建筑或所有学生可进入的餐厅数。实时目录入口：[Crous de Versailles — Où manger](https://www.crous-versailles.fr/se-restaurer/ou-manger/)。父任务另行逐页补查地址和坐标；本报告没有替代这项全量审核。
- [RU Escoffier](https://www.crous-versailles.fr/restaurant/ru-escoffier-2/) 与 [Cafétéria Escoffier](https://www.crous-versailles.fr/restaurant/cafeteria-escoffier-2/) 确实有不同官方页面。必须保留各自身份，不能按名字主体或相同坐标自动合并。
- RU Escoffier 官方页面当前地址写作 `22, cours Pierre Vasseur - 31120 Palaiseau`。这个邮编与地名组合需要核对；官网来源也可能有录入错误。保存原文、疑点与核验状态，不能悄悄改成猜测值。该页的导航链接是坐标来源线索，不证明坐标精确到入口或取餐柜台。
- 已读当前 REQ/BIZ/DEV/UI 与 PROG：项目已有 `venues`、`meals.venue_id`、`servings.venue_id`；Dish 跨餐厅共享票池。现有 Escoffier/L’Expérimental 历史 ID 不应在导入时自动推断为某个 RU 或 Cafétéria；其历史归属必须单独审阅，已有案号序号也要保留。

## 2. 算法选择

| 方法 | 用途 | 本次决定 |
|---|---|---|
| 浏览器 Geolocation API | 获取设备经纬度与精度 | 用户点击后调用一次；不是识别店名的算法 |
| Haversine | 计算球面两点直线距离 | 对所有有效坐标计算并排序；适合当前规模 |
| Bounding box | 先用经纬度矩形排除远处点 | 66 点不必加；未来大范围数据库查询时可作粗筛，再计算真实距离 |
| Geohash | 将区域编码成分层网格 | 暂不需要；网格边界需查询相邻格，不能把同格当成最近或同店 |
| KD-tree / Ball-tree | 加速大量最近邻查询 | 暂不需要；普通经纬度上的欧氏 KD-tree 不能直接当球面距离使用 |
| R-tree | 按空间包围框检索点或区域 | 大型数据库/地图视口检索才评估；SQLite 支持不等于当前 D1 环境已验证支持 |
| 道路路径搜索 | 计算真实步行路径与时间 | 导航交给外部地图；直线距离不显示成步行时间 |

Haversine 先把纬度、经度转成弧度，计算 `a = sin²(Δlat/2) + cos(lat1)cos(lat2)sin²(Δlon/2)`，再算 `d = 2R asin(sqrt(clamp(a,0,1)))`，可使用 `R=6371000` 米。输入须有限值、纬度在 ±90°、经度在 ±180°；缺坐标记为未知，绝不能默认 `(0,0)`。计算 O(n)，排序 O(n log n)。这是球面近似，首版距离显示“约”，不承诺测绘精度。[Haversine 定义及单位](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.pairwise.haversine_distances.html)

索引算法参考：[最近邻算法比较](https://scikit-learn.org/stable/modules/neighbors.html)、[Geohash 编码说明](https://redis.io/docs/latest/commands/geohash/)、[SQLite R-tree](https://www.sqlite.org/rtree.html)。是否需要索引以真实数据量和耗时测量决定，不预设扩建。

## 3. 定位误差与同址消歧

浏览器 API 需要安全上下文与用户许可，返回 `accuracy`（米，规范的 95% 置信水平）、时间戳和坐标；设备位置可能来自 GPS 或网络信息，不保证真实位置，高精度请求也不保证更准。需处理拒绝、超时、不可用。[W3C Geolocation](https://www.w3.org/TR/geolocation/)

建议初始参数 `enableHighAccuracy:false, timeout:8000, maximumAge:60000`，均为待实测的产品取值。定位慢时搜索仍可用，权限弹窗未答复也不能锁页面；需要改善精度时让用户手动重试，不循环追踪。`timeout` 不应被当成整个权限交互的总时限。

如果定位误差半径为 r，测得餐厅距离为 d，可把 `[max(0,d-r), d+r]` 作为忽略餐厅坐标误差时的距离不确定区间。两个候选区间重叠，就不能声称第一个一定更近；即使不重叠，也不证明用户正在其中一家吃饭。这是几何提示，不是餐厅匹配概率，不能标“95% 确认这家”。

同址候选始终分开显示官方名与类型，例如“RU — 大学食堂”和“Cafétéria — 简餐店”。短距离显示约值；精度较差时显示“定位范围较大，请确认餐厅”。缺坐标的店仍可文字搜索，只不参与附近距离排序。坐标只在当前浏览器内参与计算，不写账号、不上传设备轨迹；用户明确选择的餐厅 ID 可单独记住。

## 4. 快速搜索与匹配

首版使用确定性的分层匹配，避免一个不透明的加权分把近处但名字错误的餐厅排到前面。

1. 搜索副本做 Unicode NFD 分解、去组合重音符、转小写、统一撇号/连字符/空白；官方显示名称保持原文。`cafeteria` 匹配 `Cafétéria`，`experimental` 匹配 `Expérimental`。字符分解依据 [Unicode 规范](https://www.unicode.org/reports/tr15/)，去重音与词元处理是本产品额外规则。
2. 搜索字段为官方名、已核对城市/邮编/地址，以及人工确认的别名。`RU` 与 `restaurant universitaire` 可归为同一类型别名；不要把 RU、brasserie、cafétéria 全部当同义词。中文“学校食堂”只对已知校园关系添加，不能给整个 Versailles 默认套用 Télécom 别名。
3. 优先完整名称精确匹配，其次全部查询词元匹配（含词元前缀），再考虑子串。多词查询应共同约束结果：`cafeteria escoffier` 必须优先 Cafétéria，不能因 RU 更近而反转。
4. 没有正常结果时再做轻量拼写容错：建议对长度至少 5 的名字词允许一次插入/删除/替换；显示“相近名称”。短词 `RU`、数字邮编不要模糊纠错。只接受一次替换的实现不等同于支持相邻字母交换，测试和说明必须一致。
5. 同等文本相关性内才用距离打破平局，再按稳定名称/ID 排序。没有搜索词、用户已定位时按距离列出最近几家；未定位时显示上次选择和搜索提示，可展开全部。

类型标签用于解释候选，不要求用户先理解餐饮分类。不做语言模型猜店、不把自由输入直接创建为公共地点。找不到时明确无结果，允许检查官网或提交待核对地点；“Crous de Versailles”是管理范围，不是只搜索 Versailles 市。

## 5. 坐标、地址与 Google 的边界

优先顺序：官方详情明确坐标/官方导航链接 → 经人工核对的地理编码候选 → 缺失保持 null。记录 `official_url`、原始地址、坐标来源、抓取日期、核验状态；地址修订保留来源。坐标中很长的小数位不能当成厘米精度证据。

官方缺少坐标时，可以批量将地址提交 IGN Géoplateforme 地理编码服务，审核返回地址、城市与点位后落入本地目录；不必每次用户输入就在线地理编码。该服务基于 BAN、BD TOPO 与地籍数据，支持正向、反向与批量编码。地址坐标只能帮助定位建筑，不能解决楼内 RU/Cafétéria 身份。[IGN 官方文档](https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/)

Google Maps URL 可直接打开搜索/导航，无需 API key；采用 `api=1` 并正确编码参数。优先复用官网导航链接；验证过的坐标适合引导到地点，只有验证过的 Place ID 才用于精确 Google 条目跳转。不声称 Google 已分别收录每个官方服务点。[Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)

Google Places Text Search 是另一套在线地点检索 API，需要请求配置与字段选择；地点结果不能替代官方目录身份审核。只有确实需要更广泛的商户发现、并审阅现行计费和条款后再考虑。当前有限目录没有必要增加这个依赖。[Google Places Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search)

## 6. 最小用户流程与以后接入

`搜索名称/城市 → 少量候选（官方名 + 类型 + 地址）→ 用户选择 → 记住选择`；旁边提供“查找附近”。浏览不登录，定位不强制，邮箱登录后不弹必填设置。拒绝定位后仍完整支持搜索。无候选不能自动创建、选择最近陌生地点或扩大成另一管理区域。

研究页先验证“找得到、选得对”。审阅通过后，再将同一选择器接入上传默认值与全站浏览范围。服务端过滤 Meal/Serving/Photo 的地点，Dish 票池仍保持现有规则；不能仅隐藏卡片而继续下载全量内容。今日开庭仍同时遵守今天/昨天的日期限制。新地点无投稿时显示空状态，不回填其他餐厅照片。

## 7. 必须验证的场景

| 输入/状态 | 预期 |
|---|---|
| `Escoffier` | RU、Cafétéria 均出现，各自 ID 与官方名称保留 |
| `cafeteria escoffier` | Cafétéria 排在 RU 前，定位不反转文本意图 |
| `experimental`、弯/直撇号、大小写 | 命中对应正式名称 |
| `escofier` | 若启用一次删除容错，可提示 Escoffier；不自动选择 |
| 城市、已核验邮编 | 只匹配目录真实字段；官网异常地址有可追溯记录 |
| 名称很像但没有匹配 | 明确无结果，不强行匹配 |
| RU 与 Cafétéria 同坐标 | 两条保留，距离相同也要用户确认 |
| 精度数千米、海外位置 | 标注粗略/远处；不把最近的 Versailles 点称为“你所在餐厅” |
| 拒绝/超时/不可用/权限未答 | 搜索可用，不重复申请、不阻塞页面 |
| null、NaN、越界坐标 | 拒绝用于距离计算，搜索仍可用 |
| 同点、已知距离、经度跨 ±180° | Haversine 非负有限且数值正确，单位为米 |
| 刷新、返回、清除本地存储 | 选择恢复规则确定；存储不可用时仍可选 |
| 键盘、读屏、200% 缩放、手机长法语名称 | 候选可操作、焦点可见、状态可感知、不横向溢出 |

此清单是研究验收建议；已执行的验证见后文。真实设备定位、现场入口与全量营业状态仍需独立验证。

## 本地实现与验证

- `data/versailles-venues.json`：2026-09-15 从官方目录逐条读取 66 个详情页，均取得地址与导航坐标；按官方 URL 保持独立身份。3 个 brasserie、37 个 cafeteria、25 个 RU、1 个其他类型。名称使用详情页 h1，另保留目录名称。
- `scripts/refresh-versailles-venues.mjs`：最多 4 个并发请求、25 秒超时；解析失败不覆盖数据。无地理编码服务、账号登录或 D1 写入。RU Escoffier 的 `31120 Palaiseau` 保持官网原文并标记 `postal-code-outside-idf`，不把猜测邮编加入搜索。
- `lib/venue-search.ts`：Unicode 规范化、多词共同匹配、词元前缀、仅无正常结果时一次编辑/相邻交换容错；邮编不容错。文本相关性优先，距离只用于同相关性的排序。Haversine 只对合法坐标计算。
- `/venues`：中英两种文案，首屏最多 8 个候选；定位由点击触发，可取消等待并忽略迟到回调；不自动选中任何店，不把直线距离称为步行距离。类型、地址、官方详情和地图搜索链接辅助辨认。
- 3 项 Node 测试覆盖同址身份、重音/缩写/城市/邮编/拼写错误、缺失及非法坐标、已知球面距离和完整目录的身份/来源检查。
- `scripts/verify-venue-preview.mjs` 已在独立无头 Edge 验证两个 Escoffier 候选、拼写建议、无结果、选中后刷新、英文化、390px 和 200% 字体无横向溢出，以及定位成功/拒绝/不可用/超时。定位使用模拟设备坐标，不代表实地 GPS 验收；同时确认搜索和定位没有对外发出 HTTP 请求。

本地环境使用项目 `node_modules` 和 `.sites-runtime` portable（crous-court）。复测命令：`node --experimental-strip-types --test tests/venue-search.test.ts`；浏览器复测：`node scripts/verify-venue-preview.mjs http://127.0.0.1:8794 <Playwright index.mjs 绝对路径>`。Playwright 使用 Codex 已有工具运行时，不加入站点依赖。浏览器验证也覆盖取消后迟到的定位回调，以及本地存储不可用时仍能选中餐厅。

同分支提供默认中文/可切换英语的真实站点界面。`0014_english_dish_names.sql` 新增可空的正式英语菜名；中文名、历史法语名与投稿原文保留，译名不影响菜品身份及评分。后续按用户要求接入 DeepL Free 新投稿英语菜名到中文的机译，见 `review-20260915.md`。审阅 Worker 运行在 `http://127.0.0.1:8794`，使用独立本地数据库和合成 QA 投稿，绝不代表生产数据。

## 8. 置信度与开放项

算法适配当前规模：0.96；文本与同址消歧方案：0.94；正式上线数据可用性：需全量核对后判断。综合方案置信度 0.94，代表工程判断，不是统计预测。

开放项：历史两家 ID 对应 RU 的确认；官网地址冲突处理；新增案号序号分配；现场是否有可帮助区分服务点的楼层/入口说明；原型审阅后的实际站点接入范围。当前不新增价格、营业状态或入口信息的推测。
