# VisionHub Studio 生图错误诊断清单

本文用于统一文生图 / 图生图失败时的展示口径：先告诉用户“最可能原因”，再给“下一步怎么改”，最后保留 HTTP 状态、模型、接口路径、trace id 等排查细节。

## 诊断分类

| 分类 | 常见信号 | 用户看到的重点 | 建议动作 |
| --- | --- | --- | --- |
| 认证失败 | HTTP 401、invalid api key、unauthorized | API Key 没被当前服务商接受 | 重新保存当前 profile 的 Key，确认官方 Key 和中转站 Key 没混用 |
| 权限不足 | HTTP 403、forbidden、permission、organization verification | Key/账号没有模型或图片接口权限 | 换已开通的图片模型，检查中转站/官方账号权限 |
| 额度/频率限制 | HTTP 429、quota、billing hard limit、余额不足、限流 | 余额、账单、并发或频率受限 | 查余额/套餐，降低生成数量和尺寸，稍后重试 |
| 图生图协议不匹配 | HTTP 400/404/422，包含 image/images/image[]/input_image/image_url 字段问题 | 当前图生图映射、字段或路径不符合服务商要求 | 单图先测；多图确认是否支持；官方 GPT Image edits 用 `/v1/images/edits` 和 multipart `image[]` |
| 参数不被接受 | HTTP 400/422，size、quality、format、model 参数错误 | 尺寸、质量、格式、模型名或参考图字段不支持 | 回到默认尺寸、质量自动、数量 1，再逐项恢复 |
| 内容安全拦截 | moderation_blocked、safety、policy、审核/敏感 | Prompt 或输入图触发安全策略 | 修改 Prompt/参考图，不要原样重试 |
| 同步超时/后台继续 | HTTP 408/524、poll_error、poll_url、轮询 | 连接断开，不代表后台一定失败 | 重载历史或查中转后台；降低尺寸/数量 |
| 服务商异常 | HTTP 5xx | 上游或中转站异常 | 稍后重试、换模型、保留 trace id 给中转站 |
| 返回格式异常 | 响应不是 JSON、HTML、Cloudflare、parse_error | API 地址可能返回网页/网关页 | 检查 Base URL 和 endpoint，不要用控制台网页地址 |
| 接口成功但无图片 | no image、没有返回有效图片 | 返回结构里没有可提取图片 | 确认模型是生图模型；检查协议返回结构 |
| 网络连接失败 | failed to fetch、DNS、证书、connection refused/reset | 软件没连上 API 地址 | 检查 API 地址或本地服务端口，不修改系统代理 |

## 0.2.7-a 首轮落地范围

- 新增 `src/services/generationErrorDiagnostics.ts`，集中根据 HTTP 状态、错误文本、raw 响应、图生图协议映射、参考图数量进行分类。
- 创作页失败提示从“原始错误长文本”改为“诊断标题 + 原因 + 解决动作 + 关键细节”。
- 作品画廊失败记录详情同步显示诊断建议，保留复制错误和重新生成入口。
- 保留 raw 错误、trace id、request id，不吞掉服务商原始信息。

## 0.3.0 收口范围

- 作品画廊失败记录升级为正式诊断抽屉，支持复制诊断、复制请求摘要和复制 Raw。
- 保存了 `poll_url` 的后台任务支持手动重查；如果中转站返回图片，会自动下载 / 落盘并把失败记录恢复为成功记录。
- 启动或进入作品画廊后，会对少量“后台待核查 + 保存了 `poll_url`”的失败记录做轻量自动重查；该流程只查询后台任务，不会重新提交生图请求。
- 图片详情和诊断抽屉补充恢复建议，区分后台待核查、落盘缺失、仅远程 / raw 图片、无图片响应和返回格式异常。
- 平台接入页提供“配置自检报告”，覆盖 Provider profile、Base URL、Headers、模型、协议路径、图生图映射、提示词润色独立凭据、保存目录和模型列表连通性；复制报告不会包含 API Key。

## 后续可继续增强

- 为不同中转站记录已验证协议，例如单图 `json-image-array`、多图 `openai-images-edit`。
- 将特定中转站的 trace/request id 反查入口做成可配置模板；未真实接入前仍只展示说明，不提供误导性的自动后台网页抓取。
