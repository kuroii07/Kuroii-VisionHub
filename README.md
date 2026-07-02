# VisionHub Studio

VisionHub Studio 是一个桌面优先的多平台 AI 图片创作工作台，当前以 Tauri + React + TypeScript + Vite 实现。项目优先服务中转站 / 聚合 API 工作流，同时保留官方 API 和本地模型路线，目标是把 OpenAI-compatible 中转、OpenAI 官方、后续 Nano Banana / Grok / Seedream / 即梦 / 豆包 / 可灵等在线生图能力统一到一个本地软件里。

> 说明：本仓库只保存源码、配置、脚本和文档；不会提交 API Key、生成图片、个人 AppData 数据、`node_modules`、`dist` 或 `src-tauri/target` 构建产物。
> 临时迁移说明：生成图片仍不进入 main 源码分支；如需一次性同步参考图，使用独立 `reference-packs/*` 分支或 GitHub Release Asset，不包含 API Key、raw 响应或 AppData 配置。

## 当前功能

- AI 创作工作台
  - 文生图
  - 图生图
  - 最多 4 张参考图
  - 参考图顺序调整
  - 参考图角色标记：自动、构图、风格、角色、色彩
  - 本地选择参考图
  - 拖拽添加参考图
  - 剪贴板粘贴参考图
  - 一键清空参考图
  - 生成后的“最近画面”可一键作为参考
- 平台接入 / 模型配置
  - 平台类型：中转站 / 聚合 API、官方 API、本地模型
  - 服务模板按平台类型动态切换
  - 中转站 / 聚合 API 作为默认主入口
  - OpenAI-compatible 聚合站配置
  - AI 创作台平台下拉已同步新的分组语义
  - 配置实例列表
  - 新增、选择、保存、保存并启用、测试延迟、启用 / 关闭和删除配置实例
  - Base URL、模型、协议、额外 Headers
  - 图生图映射可显式选择：自动、OpenAI Images edits、Responses input_image、Chat image_url、JSON image/images
  - 支持 `/v1/images/generations`、`/v1/images/edits` 和 `/v1/responses` 等协议形态
  - 接口路径可按中转站文档手动修改，支持不带 `/v1` 的 OpenAI-compatible 路径
  - Responses 协议支持 `background/store` 尝试和轮询查询，用于降低长任务同步超时误判
  - HTTP 524 / 后台可能继续生成的任务会标记为“待核查”
  - API Key 通过桌面端系统凭据保存，不写入仓库
  - 旧中转站配置会保留 profile id 迁移，避免丢失系统凭据绑定
- 提示词辅助
  - 模板灵感
  - 提示词库 V2：分类、收藏、最近使用、自定义模板、变量填充、导入和导出
  - 提示词润色
  - 复用记录
  - 本地规则润色和模型润色分离
  - 提示词润色使用独立 API Key，不复用生图平台 Key
  - 润色模型支持 DeepSeek、聚合站通用和 OpenAI 官方等 OpenAI-compatible 文本模型配置
  - 快捷润色可直接替换当前提示词，详细弹窗可切换已保存润色配置
- 本地作品画廊
  - 默认隐藏失败图片，选择失败状态后再展示
  - 文生图 / 图生图 / 有参考图筛选
  - 成功 / 失败筛选
  - 平台、类型、格式、评分、颜色等筛选入口
  - 图片评分和收藏
  - Canvas 主色取样，详情页展示颜色圆点
  - 文件夹和收藏集管理
  - 隐藏式分类侧栏，默认优先展示图片
  - 对 524、后台轮询等可疑失败显示“待核查”
  - 时间筛选：今天、近 7 天、近 30 天
  - 图生图记录显示参考图数量和参考来源
  - 详情页展示模型、尺寸、文件大小和格式等信息
  - 图片预览、复制 Prompt、复制路径、打开文件夹
  - 删除图册记录，但不删除磁盘图片文件
  - 作品画廊 V2 计划沉淀在 `docs/library-v2-plan.md`
- 参考图迁移包
  - 公司机器上的成功生成图已打包为 `visionhub-company-generated-images-2026-06-12.zip`，包含 30 张图片和非敏感 manifest。
  - 图片包不放入 main 源码分支；同步到 GitHub 时使用独立参考包分支，回家后解压并通过“导入本地图片 / 批量导入文件夹”加入图片收藏或作品画廊。
- 免费平台
  - 免费平台助手 V2：定位为网页平台助手，不模拟登录、网页操作或自动抓图
  - 内置 31 个免费 / Freemium 图片平台，其中 11 个国内平台，元宝等无可用网页生图入口的平台暂不纳入
  - 支持卡片 / 列表视图、国内 / 海外筛选、搜索、状态筛选、收藏、备注和详情查看
  - 卡片模式详情从右侧抽屉弹出，列表模式保持行内展开详情
  - 支持复制平台适配 Prompt 后打开网页；用户在网页生成并下载后，可导入成品到灵感中心图片收藏
  - 平台图标优先使用站点 favicon，并缓存已加载成功的图标；失败时再回退为文字标识
- 灵感中心
  - 管理国内外提示词模板站、图片灵感站、模型社区和风格参考站
  - 导入本地 AI 图片收藏，支持选择、拖拽和剪贴板粘贴
  - 图片收藏 Gallery V2 支持搜索、批量导入、视图切换、右键菜单、颜色 / 形状 / 格式 / 评分筛选和一键清空筛选
  - 灵感图片评分会持久化保存，可用于后续整理和筛选
  - 记录来源 URL、平台、作者、Prompt、标签、备注和授权状态
  - 灵感图片可一键作为图生图参考
  - 已收藏 Prompt 可一键套用到 AI 创作或转入提示词库
- 图片预览
  - AI 创作、作品画廊和灵感中心各自独立预览状态
  - 作品画廊和灵感中心图片收藏的大图预览支持左右切换、方向键切换和序号提示
  - 详情页与参考图局部预览保持单图预览，不显示全局切换箭头
  - 滚轮缩放
  - 拖拽移动
  - 点击空白关闭
- 桌面体验
  - 浅色 / 深色 / 跟随系统主题
  - 可折叠侧边栏
  - 无文字图标按钮提供悬停说明和可访问标签
  - 设置面板支持开发者模式显示技术栈信息
  - 作品画廊目录和图片收藏目录可分别自定义
  - Windows release exe / MSI / NSIS 安装包构建

## 技术栈

- Tauri v2
- React 19
- TypeScript
- Vite 6
- Zustand
- Rust / Cargo
- reqwest multipart，用于 GPT Image 图生图 `/v1/images/edits`

## 目录结构

```text
visionhub-studio/
├─ src/                    # React 前端源码
│  ├─ domain/              # Provider / 生成记录类型
│  ├─ providers/           # Provider registry / adapter
│  ├─ services/            # 桌面 API、配置、模板、设置
│  ├─ store/               # Zustand store
│  └─ ui/                  # 页面和样式
├─ src-tauri/              # Tauri 后端与打包配置
│  ├─ src/main.rs          # 桌面命令、生成请求、历史记录
│  ├─ Cargo.toml
│  └─ tauri.conf.json
├─ scripts/                # Windows 开发、检查、构建、启动脚本
├─ docs/                   # 文档
├─ planning/               # 产品规划和参考资产
├─ AGENTS.md               # 项目级 Codex 协作规则
├─ package.json
└─ vite.config.ts
```

## 当前开发检查点

Current checkpoint: `0.4.5` Global Experience and Performance QA / UI QA baseline, accessibility names, long-text guards, empty/error states, and large-list performance guards.

- 平台接入已改为“平台类型 → 服务模板 → 配置实例”的信息架构。
- 中转站 / 聚合 API 是默认主入口，官方 API 和本地模型按规划状态展示。
- 平台接入页已加入能力矩阵 V2，并将完整矩阵改为按需展开，配置详情保持优先显示。
- 平台接入 V3 已完成本轮收口：配置实例支持模型列表刷新、当前模型探测、非消耗诊断、真实试生图区分，以及与 AI 创作页当前启用配置的状态同步。
- 本地模型路线 MVP 已完成 ComfyUI 优先接入：连接诊断、API workflow 导入、workflow 管理、AI 创作台文生图提交、任务轮询、结果下载和作品画廊保存均已跑通。
- 0.4.3 本地模型增强已接入 Stable Diffusion WebUI / Forge：本地端点诊断、`/sdapi/v1/txt2img`、Seed / 负面提示词 / 采样器 / 步数 / CFG 轻量参数，以及作品画廊保存。
- ComfyUI 图生图第一切片已支持包含 LoadImage 节点的 API workflow：上传第一张参考图、写入 LoadImage、轮询结果并入库；ControlNet、多输入节点策略和 SD WebUI img2img 后续再做。
- ComfyUI 诊断会在本地模板页自动刷新；本地服务关闭后会从旧的在线状态回落到离线 / 未连通提示，避免继续显示旧的测试通过结果。
- ComfyUI 在线状态来自本机 `127.0.0.1:8188` 的实时接口响应；如果关闭界面后仍显示在线，通常表示后台 `python.exe` / 启动脚本仍在监听端口。
- ComfyUI 目前要求导入 API Format workflow；普通 UI workflow 会保留解析预览，但不会误导为可直接生成。
- 图生图协议映射 V2 已接入配置和生成链路，可在平台配置中切换参考图字段结构，并在生成结果 raw 中记录实际映射摘要。
- 工作区首页 V2 已完成收口：启动页进入真实工作台首页，集中展示最近继续、异常任务、最近素材、画廊整理入口、批量队列入口、多模型对比入口和关键状态概览。
- 偏好设置 V2 已完成收口：创作默认值、默认参考图角色、Prompt 历史、作品保存偏好、界面密度、首页模块控制、数据目录和设置备份都集中管理；语言提供简体中文 / English 手动切换，不做跟随系统。
- 偏好设置完成最终视觉收尾：去掉顶部概览卡片，标题对用户显示为“偏好设置”，下拉菜单统一紧凑宽度和右对齐，版本号与“版本”同一行展示。
- 创作台复用记录删除改用软件统一确认弹窗，不再弹出浏览器原生确认框；删除仍只移除软件记录，不删除磁盘图片文件。
- AI 创作台收口补丁已完成：文生图 / 图生图画布结果互相隔离，生成中提示按当前模式显示，多张生成结果可在创作台内切换预览，清空画布会按模式持久化，不会在切换功能页后恢复旧图。
- 旧中转站配置迁移会保留 profile id，避免丢失 `profile:${profileId}` 系统凭据绑定。
- 作品画廊 V2 已完成一轮可用化：隐藏式分类、文件夹、收藏集、评分、颜色取样、详情信息和筛选栏都已接入。
- 作品画廊和灵感中心已改为首次进入后保留页面实例和已加载数据，避免在侧边栏切换时反复读取、计算和重建视图。
- 作品画廊失败记录已升级为诊断报告面板，支持分类、关键参数、后台待核查提示、建议操作、Raw 摘要、复制诊断和复制请求摘要。
- 0.3.0 收口后，失败 / 缺图 / 返回格式异常记录会在详情和诊断抽屉中显示恢复建议；保存了 `poll_url` 的后台任务会在启动或进入画廊后进行轻量自动重查，成功时自动恢复图片。
- 平台接入页的“配置自检报告”已覆盖 Provider profile、Base URL、模型、协议路径、图生图映射、提示词润色独立凭据和本地保存目录，并可复制不含 API Key 的排查报告。
- 图生图工作台已支持参考图拖拽、粘贴、排序、角色标记和最近生成图复用。
- 灵感中心 V2 已完成图片收藏 Gallery 和提示词网站目录：图片收藏支持批量导入、搜索筛选、颜色 / 形状 / 格式 / 评分过滤；提示词网站支持国内外预设、紧凑列表、分类筛选、打开记录和自定义添加，并已优化为提示词网站优先加载、图片收藏按需懒加载。
- 灵感中心图片收藏已接入真实图片反推 Prompt：改为「偏好设置」里的图片反推专用配置和独立凭据 `image-reverse:default`，支持 Responses / Chat Completions / Gemini generateContent 视觉输入协议；反推模型不会进入 AI 生图工作台模型列表，结果会写入反推 Prompt 字段，并可复制、套用到 AI 创作或保存为模板。
- Prompt 摘录 V1 已并入灵感中心：支持手动摘录和从剪贴板摘录，可按类型 / 语言 / 来源 / 常用筛选，并支持套用到 AI 创作、复制、转为提示词模板、编辑和删除；数据保存在本地灵感目录，不做网页自动抓取。
- AI 创作台已将当前 Prompt 沉淀收进低打扰入口：保存按钮只展开菜单，可存草稿、存 Prompt 摘录或另存为提示词模板，不挤占主界面。
- 提示词库 V2 已完成本轮收口：模板分类扩展、自定义模板、收藏 / 最近使用、变量填充、导入 / 导出，以及从作品画廊和灵感中心转入模板的复用链路都已落地。
- 图片收藏目录已从作品画廊目录中独立出来，可在偏好设置里单独选择和打开；免费平台导入成品后会刷新灵感中心图片收藏。
- 提示词润色已拆成本地规则和模型润色两条路径，模型润色使用独立凭据 `prompt-polish:default`。
- MiniMax 官方已作为 0.3.8 第一条新增官方图片 API 进入实接链路：`image-01` 文生图和单张人物主体参考图生图已用真实 MiniMax API Key 测试成功，走独立凭据、`/v1/image_generation`、固定模型 ID 选择和专用错误诊断；模型列表不再误导为 OpenAI-compatible `/v1/models`。
- Google Gemini / Nano Banana 官方已进入 0.3.8 实接代码链路：使用独立 Gemini API Key、`/v1beta/models/{model}:generateContent`、`gemini-2.5-flash-image` 固定模型和 `inlineData` 参考图 / 返回图解析；当前已完成代码与本地构建验证，仍需用户提供真实 Gemini API Key 后做文生图和图生图额度联调。
- 中转站 / 聚合 API 的多配置实例已支持在 AI 创作台直接切换；多个实例可以同时保持启用状态，切换配置实例会同步当前模型和密钥通道，避免生成时误落到列表最上方实例。聚合站里的 Gemini / Nano Banana 模型仍按聚合站文档选择 OpenAI Images / Responses / Chat Completions 等协议，不套用 Google 官方 Gemini endpoint，除非该聚合站明确要求原生 Gemini `generateContent`。
- 中转站新增 `Images API 精简兼容` 协议，仍走 `/v1/images/generations`，但只提交 `model + prompt`，用于 woyao.pro 这类会拒绝 `size / quality / n / output_format` 等扩展字段的图片中转。
- 中转站 Chat Completions 图片包装已改为兼容性更高的最小 `messages` 请求，不再默认附带 `modalities`、`size`、`n` 等容易被聚合站拒绝的扩展字段；同时增强了 Markdown / 文本响应中的图片 URL 提取。
- `/v1/responses` 图片结果解析已兼容常见 `result` / `image` 字段。
- Responses 长任务已加入 background + store 尝试和轮询查询；中转站不支持时会回退同步请求。
- 0.3.9 批量队列与多模型对比 V1 已进入可用性收尾：AI 创作台保留基础生图参数优先显示，批量变体和多模型对比统一收进队列下拉菜单和“批量 / 对比”弹窗；可把当前文生图 / 图生图参数加入当前选中的本地批量队列，也可在“批量变体”按多 Prompt × 多画面比例创建任务，或在“多模型对比”选择多个配置实例，一键按同一 Prompt 创建对比组任务。批量队列页已支持自定义队列、新建 / 重命名 / 删除队列、当前队列切换、单任务确认执行、取消、失败任务单个或批量重新入队、失败或已取消任务删除、连续队列执行、当前任务完成后暂停 / 继续、对比结果并排查看，以及本地批量模板保存 / 套用 / 删除；删除只移除本地队列任务或队列快照，不删除作品画廊记录或磁盘图片。
- 0.3.10 收口补丁已完成绿色版构建验证：Windows release exe 已同步到本地绿色版目录，启动不再出现调试控制台；工作区首页“继续上次创作”保持左右排版，左侧预览按原始图片比例完整显示，右侧标题和 Prompt 保持摘要展示，避免长文本撑破首页布局。
- 偏好设置里的“提示词与历史”后续会继续收束：提示词润色配置和图片反推配置先整理成独立工具区，避免配置项继续挤占普通设置页；如果后续继续增长，再拆成单独的提示词工具页。
- 项目级 Codex 规则已写入 [AGENTS.md](AGENTS.md)，换电脑后继续开发时先读该文件。

## 近期更新记录

### v0.4.5 Global Experience and Performance QA

- App version is now `0.4.5`, synchronized across package metadata, Tauri metadata, Cargo metadata, app version display, README, and roadmap docs.
- Added `scripts/ui_qa_check.py` as the first global UI QA baseline for mojibake scans, icon-button accessible names, long-text guards, empty/error states, and Inspiration Center large-list performance guards.
- `scripts/smoke_check.py` now runs the UI QA baseline so future smoke checks catch regressions before build/push.
- Provider/local diagnostic messages, Provider config headers, and gallery Prompt detail text now have safer overflow wrapping/ellipsis behavior for long model names, paths, errors, and Prompts.
- Preferences Prompt/history settings are earmarked for a follow-up split into a dedicated prompt-tools area, starting with Prompt polish and image reverse configuration consolidation.
- This pass intentionally avoids a broad visual redesign and keeps AI Create Desk layout stable.

### v0.4.4 Lightweight Migration Support V1

- App version is now `0.4.4`, synchronized across package metadata, Tauri metadata, Cargo metadata, app version display, README, and roadmap docs.
- Preferences now exposes practical data entries for AppData, gallery, inspiration images, and backup directory access.
- A new migration guide export creates a readable Markdown file that lists data directories, Provider profile ids, credential channels to re-enter, and recommended migration steps.
- This version intentionally does not add a standalone health-check center, automatic repair, duplicate cleanup, or destructive file operations.
- Migration guide export does not include API Keys, system credentials, generated image binaries, or raw response blobs.

### v0.4.3 Local Model Improvements V2 / SD WebUI + ComfyUI first slice

- App version is now `0.4.3`, synchronized across package metadata, Tauri metadata, Cargo metadata, app version display, README, and roadmap docs.
- Stable Diffusion WebUI / Forge is no longer shown as planning-only: Platform Access now exposes local endpoint configuration, connection diagnosis, and Creative Desk generation through `/sdapi/v1/txt2img`.
- SD WebUI / Forge txt2img saves generated images into the VisionHub gallery and supports Seed, negative prompt, sampler, steps, CFG Scale, output format, and output compression forwarding.
- ComfyUI now supports the first image-to-image slice for API workflows that contain a `LoadImage` node: VisionHub uploads the first reference image to `/upload/image`, writes the returned filename into LoadImage, polls history, downloads outputs, and saves them to the gallery.
- Local model paths remain separated from cloud provider profiles: no API Key, no online quota, no AiMaMi / Clash / system proxy changes.

### v0.4.2 Provider Stability V5 / Self-check Hardening

- App version is now `0.4.2`, synchronized across package metadata, Tauri metadata, Cargo metadata, app version display, README, and roadmap docs.
- Provider configs now normalize legacy and partial saved fields on load/save, so older profiles keep their original `profile:${profileId}` credential binding without crashing diagnostics.
- Provider profile to config conversion now always goes through the shared normalization layer, protecting Base URL, model ID, protocol, endpoint path, image-to-image adapter, headers, and model options.
- Provider self-check now previews the target endpoint, capability boundary, reference-image submission route, model-list boundary, and cost/retry risk without submitting an image-generation request.
- The right-side self-check action no longer passes the React click event as a profile object; the function also ignores non-profile inputs defensively, matching the left-side profile latency test behavior.
- This version intentionally does not add unverified new provider templates; Gemini / Grok / Seedream / DashScope specific adapters remain gated by official docs, real account access, or raw error evidence.

### v0.4.1 Prompt Workflow V3 / Image Reverse + Prompt Excerpts

- App version is now `0.4.1`, synchronized across package metadata, Tauri metadata, Cargo metadata, app version display, README, and roadmap docs.
- Image reverse Prompt now uses the dedicated Preferences configuration and `image-reverse:default` credential channel; it no longer reuses generation provider profiles or appears in the AI generation model list.
- Reverse Prompt supports Responses / Chat Completions / Gemini generateContent visual-input protocols; results are saved to `inferredPrompt` and `reversePrompt` metadata and can be copied, applied to AI Create, or saved as a Prompt template.
- OpenAI-compatible reverse Prompt requests no longer send default `temperature`, improving compatibility with GPT-5.x and stricter aggregator models.
- Inspiration detail drawer width/right offset was constrained to avoid right-edge clipping for long model names, errors, and action buttons.
- Prompt Excerpts V1 adds a third Inspiration Center tab for manual excerpts and clipboard excerpts, with local persistence, search/filter, apply/copy/template conversion, edit/delete, and light/dark editor polish.
- AI Create now keeps the main Prompt dock stable: the existing Save icon opens a low-noise Save menu for drafts, Prompt excerpts, and custom templates, while Prompt Composer V1 lives inside the Prompt assistant modal tab.
- Reuse records now support local favorite markers and a one-click success-only Prompt filter, closing the remaining `0.4.1` Prompt workflow scope.

### v0.3.10 收口补丁 / 绿色版验证

- 应用版本已同步为 `0.3.10`，覆盖 `package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`、应用内版本显示、README 和路线文档。
- Windows release 构建已通过，并同步到本地绿色版目录 `outputs/portable/VisionHub-Studio-0.3.10-portable`；绿色版用于本机验收，不提交到源码仓库。
- Release 模式已关闭 Windows 调试控制台弹窗，绿色版启动时不再额外出现黑色命令行窗口。
- 工作区首页“继续上次创作”恢复并保留左右排版；左侧最近作品预览按图片原始比例完整显示，适配横图、竖图和方图，不裁切主体内容。
- 右侧标题和 Prompt 恢复为摘要展示，避免长 Prompt 把首页卡片撑成长列；完整 Prompt 继续在作品详情中查看。
- 0.3.10 仍作为 0.3 系列收口补丁，不新增大功能；后续主线进入 `0.4.0` 作品画廊与资料整理收口 V3。

### v0.3.9 批量队列与多模型对比 V1

- AI 创作台顶部队列入口已合并为一个下拉菜单，包含“加入队列”“批量 / 对比…”和“查看批量队列”，并显示当前队列名称、任务数和待执行数；下拉菜单使用 portal 避免被画布遮挡。
- AI 创作台新增“多模型对比”配置实例选择器：同一平台下可勾选多个中转站 / 聚合 API 配置实例，不需要把多个实例都设为启用。
- “加入对比队列”会把当前 Prompt、模式、尺寸、质量、数量、输出格式、Seed、负面提示词和参考图策略分别快照到每个所选配置实例，保留各自的 Base URL、协议、接口路径、模型 ID、额外 Headers 和 `profile:${profileId}` 密钥通道。
- AI 创作台新增“批量 / 对比”弹窗：不再占用右侧基础参数栏，画面比例和输出尺寸保持常驻优先显示。
- “批量变体”支持逐行输入多个 Prompt，并勾选多个画面比例；每个比例使用一个代表尺寸，一键创建多 Prompt × 多画面比例组合任务；单次最多创建 40 个任务，仍需到批量队列页确认执行。
- 批量队列页新增自定义队列管理：可新建、切换、重命名和删除队列；创作台加入任务会进入当前选中的队列，不再固定落到第一个队列。
- 新建 / 重命名队列已统一为 VisionHub 应用内弹窗，不再使用浏览器原生 `window.prompt()`；删除队列继续使用统一危险操作确认弹窗。
- 批量队列页新增对比组统计、批量变体批次摘要和任务标识，可看到同组任务的序号、批量比例组合、成功 / 执行中 / 待执行 / 失败数量。
- 队列执行已支持“执行全部待处理”：一次确认后按串行方式自动执行当前队列，执行横幅会显示本轮进度、当前任务和暂停请求状态；暂停队列会在当前任务完成后停止启动下一个任务，不强行中断已发出的请求，之后可继续执行剩余待处理任务。
- 批量队列页新增本地批量模板：可把当前队列保存为模板，后续追加套用到当前队列；模板只保存任务快照和对比组关系，不保存执行结果、生成图片或系统凭据。
- 批量队列页新增同 Prompt 多配置实例的并排结果卡片：按对比组展示配置实例、模型、尺寸、耗时、状态、错误摘要和成功图预览入口，方便快速判断不同中转配置 / 模型的结果差异。
- 失败 / 已取消任务删除、失败单任务重新入队、失败任务批量重新入队和连续执行能力继续保留；作品画廊记录不会因删除队列任务或队列快照而被删除。
- 正在执行的队列不能重命名或删除；删除队列弹窗会列出待执行、成功、失败、已取消和对比组数量，避免误删。
- 本轮继续只收口源码、路线文档和 README，不生成安装包；正式发布准备仍后移到 `v1.0` 前。

### v0.3.8 平台接入 V4

- MiniMax 官方 API 已完成真实文生图和单张人物主体参考图生图测试，配置实例、独立密钥、固定模型 ID 诊断、错误分类和结果落盘已接入。
- 小米 MiMo 完成公开文档核验：当前未发现公开文生图 / 图生图 endpoint，继续作为官方候选说明，不开放保存启用或真实生图。
- Google Gemini / Nano Banana 官方 API 已加入 `gemini-image` Provider，走 `generateContent`、`inlineData` 参考图和 inline image/base64 结果解析；代码链路、构建和 `cargo check` 已通过，待真实 Gemini API Key 联调。
- AI 创作台已支持中转站 / 聚合 API 多配置实例直接切换；多个实例可同时保持启用，生成时由创作台“配置实例”下拉决定当前使用的 Base URL、模型、协议和密钥通道。
- 为避免生成历史和诊断面板卡顿，保存 / 读取生成历史时会把 raw 里的大体积图片二进制、base64 和 `data:image/...` 替换为轻量摘要，图片本体仍按本地图库路径保存。
- 聚合站兼容性补充：新增 `Images API 精简兼容` 协议，只向 `/v1/images/generations` 提交 `model + prompt`；`Chat Completions 图片包装` 改为更保守的聊天包装，并增强 Markdown / 文本响应中的图片 URL 提取。
- 已确认 `woyao.pro / api.iiiitoken.com` 的 `gemini-3.1-flash-image`、`gpt-image-2` 在当前配置尝试下仍未稳定生图；暂不继续硬猜专用协议，后续如需接入应以该站 raw 错误或官方 API 文档为准。

### v0.3.7 偏好设置 V2

- 偏好设置升级为工作流配置中心，保留创作默认值、语言、首页模块和数据安全等核心配置入口，顶部不再展示纯概览卡片。
- 创作默认值支持默认平台、模型、生图模式、数量、尺寸、质量、输出格式和默认参考图角色；修改后会同步当前创作台基础参数。
- 新增界面与首页偏好：启动页面、侧边栏默认状态、紧凑模式，以及首页模块显示控制。
- 新增作品保存偏好：文件命名规则、按日期分组和按项目分组；该偏好不会移动已有图库文件，后续批量导出会优先读取。
- 语言偏好提供简体中文 / English 两种手动切换，不做跟随系统；当前覆盖应用壳层和偏好设置基础入口，完整页面文案国际化后续单独推进。
- 本轮 UI 收尾后，偏好设置隐藏纯展示概览卡片，统一所有下拉菜单为 146px 紧凑宽度，提示词润色引擎、分组策略和路径操作按钮改为右侧对齐。
- 首页状态区移除面向开发的版本 / 页面收口标签，改为“本地优先 · Key 不导出”；ComfyUI 未探测状态显示为“本地服务待检查”。
- 创作台复用记录删除接入统一危险操作确认弹窗，浅色 / 暗色模式下与作品画廊、图片收藏删除弹窗保持一致。
- ComfyUI 在线判断以本机 8188 端口实际响应为准；关闭 ComfyUI 界面但后台 Python 仍存活时，软件会继续识别为在线。
- 设置验证脚本已补充偏好设置 V2 关键字段检查，`run_checks.ps1` 现在会正确捕获 smoke check 失败。
- 本轮继续只收口源码、路线文档和 README，不生成安装包；正式发布准备仍后移到 `v1.0` 前。

### v0.3.6 工作区首页 V2

- 工作区首页从占位卡片升级为真实总览页，默认启动页切换到工作台首页。
- 首页集中展示最近可继续作品、异常 / 待核查任务、最近素材、最近收藏、最近参考图和平台状态摘要。
- 画廊整理、批量队列、多模型对比以明确入口呈现；未完整落地的批量队列和多模型对比保持规划状态，不提供误导性的执行按钮。
- 首页交互动画、浅色 / 深色切换闪烁、最近素材 hover、按钮换行、画布渲染提示位置等视觉问题已完成收口。
- AI 创作台同步收口多图结果切换、按模式生成中提示、文生图 / 图生图画布隔离和清空画布持久化；清空画布不删除作品画廊记录。
- 本轮继续只收口源码、路线文档和 README，不生成安装包；正式发布准备仍后移到 `v1.0` 前。

### v0.3.5 本地模型路线 MVP

- 本地模型路线以 ComfyUI 为第一优先级完成 MVP 接入，保持中转站 / 聚合 API 主流程不受影响。
- 平台接入页新增 ComfyUI 连接诊断和自动刷新，读取 `/system_stats`、`/object_info`、`/queue`，本地服务关闭后会刷新为离线 / 未连通状态。
- 支持导入 ComfyUI API Format workflow，并提供 workflow 管理器查看已导入工作流、格式、节点数量和可生成状态。
- AI 创作台选择 ComfyUI 后可使用已导入 API workflow 执行文生图，自动填充 Prompt、负面提示词、尺寸、Seed 和数量等基础参数。
- ComfyUI 生成链路已接入 `/prompt` 提交、`/history` 轮询、`/view` 下载，结果会保存到作品画廊并记录本地 workflow 来源摘要。
- 普通 UI workflow 与 API workflow 已做明确区分：UI workflow 可解析预览，但真实生成前需要在 ComfyUI 里另存为 API Format。
- ComfyUI 图生图、参考图上传、手动节点映射、UI workflow 自动转换、Stable Diffusion WebUI / Forge 接入继续作为后续本地模型增强；其他小众本地 UI 暂不列入默认模板。
- 本轮继续只收口源码、路线文档和 README，不生成安装包；正式发布准备仍后移到 `v1.0` 前。

### v0.3.4 平台接入 V3

- 平台接入页完成“平台类型 → 服务模板 → 配置实例 → 配置详情”的 V3 收口，右侧配置详情保持主视图，能力矩阵和诊断详情改为按需展开。
- 配置实例列表支持按全部、已启用、已验证、注意、失败和未测试筛选，并显示模型数量、疑似图片模型数量、当前模型命中状态和 AI 创作页使用状态。
- 中转站 / 聚合 API 配置实例继续使用独立密钥绑定；保存、保存并启用、复制配置、粘贴配置四个操作收口为一行紧凑按钮。
- 模型列表刷新和当前模型探测会记录模型数量、图片模型估计、当前模型是否命中，并同步到配置实例卡片和 AI 创作页右侧状态。
- 新增非消耗诊断摘要和诊断详情，只检查本地配置、密钥状态、模型列表记录、图生图映射和 AI 创作页生效关系，不执行真实生成。
- “真实试生图”与非消耗诊断分层展示，明确会调用接口并可能消耗额度；当前 API Key 不可用时可先不执行。
- AI 创作页右侧平台信息改为读取当前启用配置实例，密钥状态独立检查，不再被平台接入页正在编辑的配置误导。
- 普通界面和复制报告不展示 API Key；报告只说明当前配置是否已保存密钥，不导出具体密钥值。
- 发布准备继续后移到 `v1.0` 前，本轮只收口源码、路线文档和 README，不生成安装包。

### v0.3.3 提示词库 V2

- 提示词库从模板列表升级为可管理的 Prompt 系统，扩展到商业海报、电商主图、角色设定、游戏资产、图标 UI、社媒封面、图生图改写、免费平台专用和风格探索等分类。
- 模板数据结构新增说明、变量、收藏、自定义、最近使用和使用次数等字段；默认模板库扩充为多场景可复用模板。
- 提示词库支持卡片 / 列表视图、分类筛选、收藏、最近使用、自定义模板、新增 / 编辑 / 删除、变量填充和回填 AI 创作台。
- 支持导入 / 导出自定义模板；导出只包含模板数据，不包含 API Key、图片文件或 AppData 私有路径。
- 作品画廊和灵感中心图片收藏的 Prompt 可一键转为模板，打通成功生成记录、灵感收藏和提示词库之间的复用链路。
- 免费平台“导入成品”导入到图片收藏后会刷新灵感中心数据，避免提示导入成功但图片收藏看不到新图。
- 偏好设置新增独立的图片收藏目录；作品画廊目录和图片收藏目录可分别选择、打开和恢复默认，本地图库路径只作为当前路径信息展示。
- 修复提示词网站卡片模式 Logo 显示：卡片左上角改为类似免费平台的方形 Logo 位，favicon 失败时稳定回退文字标识，并刷新旧空白图标缓存。
- 补齐作品画廊 / 图片收藏删除确认的浅色模式危险按钮可读性，以及作品详情页文件夹按钮打开所在目录的链路。
- 本轮继续只收口源码、路线文档和 README，不生成安装包；正式发布准备仍后移到 `v1.0` 前。

### v0.3.2 免费平台 V2

- 免费平台升级为“免费平台助手”，明确定位为网页平台辅助工作流：复制 Prompt、打开平台、网页生成下载、再导入成品，不伪装成已接入 API 自动生成。
- 内置平台扩展到 31 个，其中 11 个国内平台；元宝等缺少可用网页生图入口、打开后主要引导下载客户端的平台暂不纳入。
- 新增卡片 / 列表视图切换：卡片模式使用右侧详情抽屉，列表模式保持行内详情，避免满屏长卡片全是文字。
- 增加国内 / 海外、平台类型、使用状态、收藏和关键词筛选，并支持未使用、已注册、常用、暂不可用等个人状态。
- 平台备注、收藏和状态会本地持久化；每个平台可记录账号 / 额度 / 水印 / 分辨率 / 商用边界等备注。
- “复制并打开”会根据平台生成适配 Prompt 并打开官网；无 Prompt 时只打开平台，避免误导。
- “导入成品”改为导入用户从网页平台下载的图片到灵感中心图片收藏，并保留来源平台、来源链接、原 Prompt、标签、备注和授权状态。
- 平台图标改为浏览器书签式 favicon 优先加载，并缓存成功图标；站点图标加载失败时再回退文字标识，避免切换页面反复闪烁。
- 修复 Tauri 开发启动脚本对 Vite 端口的误判，避免端口残留时窗口打开到 `127.0.0.1:1420` 但页面连接失败。
- 本轮继续只收口源码、路线文档和 README，不生成安装包；正式发布准备仍后移到 `v1.0` 前。

### v0.3.1 AI 创作台 V4

- AI 创作台提示词区完成 V4 收口：新增 Prompt 草稿保存 / 查看窗口、风格快捷选择，并与提示词润色风格联动。
- 创作台参数区去掉未接入真实功能的审核控件，保留并接通精度、格式、风格、压缩率、数量和高级参数。
- 修复 OpenAI-compatible Responses 协议下生成数量未传递的问题，`count` 会写入 Images / Responses 请求和 raw 摘要。
- 高级参数接入真实请求链路：Seed 和负面提示词会传递给支持自定义字段的中转站 / 聚合 API。
- 图生图参考图区域、画面比例卡片、输出尺寸、快捷按钮和草稿窗口完成多轮布局修正，减少按钮换行、弹窗偏移和卡片挤压。
- 创作画布空状态改为主题色星点虚线网格，星星使用真实 SVG pattern 渲染，支持浅色 / 暗色主题并跟随强调色。
- 生成失败提示按文生图 / 图生图模式独立显示，重新生成时旧错误立即隐藏，新一轮失败后再显示新错误。
- 错误提示卡片改为画布底部居中浮层，操作按钮竖排显示，长 HTTP / 模型 / 路径详情按左侧文本列宽换行。
- 发布准备继续后移到 `v1.0` 前，本次只收口源码、路线文档和 README，不生成安装包。

### v0.3.0 错误诊断与恢复

- 作品画廊失败记录详情升级为正式错误诊断报告面板，显示认证、权限、额度、限流、模型、协议、参数、内容安全、后台超时、返回格式、无图片、网络和服务商异常等分类结果。
- 诊断面板补齐状态、平台、模型、模式、参考图、HTTP、接口路径、图生图映射、trace_id 和 request_id 等关键参数标签，方便对照中转站后台排查。
- 对 HTTP 524、轮询失败和后台任务超时等记录提供“待核查”提示，避免把可能仍在后台生成的任务误判为彻底失败。
- 增加“查看诊断”入口、复制诊断、复制请求摘要和复制 Raw，方便把失败记录发给中转站或保留排查材料。
- 诊断抽屉支持对保存了 `poll_url` 的 Responses 后台任务执行重查；如果接口已返回图片，会自动下载 / 落盘并把失败记录恢复为成功记录。
- 启动后或进入作品画廊时，会对少量保存了 `poll_url` 且被判断为后台待核查的失败记录做轻量自动重查；自动重查不会重新提交生图请求，失败时仍保留手动诊断入口。
- 图片详情和错误诊断抽屉补充“恢复建议”，针对后台待核查、落盘缺失、只有远程 / raw 图片、无图片响应和返回格式异常给出不同处理路径。
- 平台接入页“平台诊断助手”升级为“配置自检报告”，覆盖配置实例、密钥通道、Base URL、Headers、模型、协议路径、图生图映射、提示词润色凭据、保存目录和模型列表连通性，并支持复制不含 API Key 的报告。
- 大图预览改为挂载到应用最外层的全屏 overlay，避免被作品画廊 / 灵感中心布局和侧边栏裁切；作品画廊与灵感中心图片收藏支持左右切换、方向键切换和序号提示。
- 图片详情里的参考图来源区域删除“作品 1 / 作品 2”摘要文字，改为标题下直接展示参考图卡片，并按参考图数量自适应底框高度。

### v0.2.9 提示词网站 V2

- 提示词网站从图片收藏工作流中独立出来，改为“预设网站库 + 我的自定义网站”的紧凑目录。
- 内置国内外多类型网站预设，覆盖提示词、模型社区、图片灵感、商业设计、摄影素材和国内 AI 平台。
- 展示方式由大卡片改为左侧分类导航 + 右侧紧凑列表，支持名称、域名、标签、场景和关键词搜索。
- 筛选栏补齐类型、地区、来源、登录和商用状态，并提供清空入口。
- 添加 / 编辑网站改为右侧轻量抽屉，默认快速添加，更多信息折叠展示，不再占用左侧主区域。
- 中转站配置优化：接口路径不再被协议默认值强制覆盖，可按服务商文档填写 `/images/generations`、`/v1/images/generations`、`/v1/responses` 等自定义路径。
- 性能优化：作品画廊和灵感中心首次进入后保留页面实例与已加载数据；灵感中心提示词网站 / 图片收藏改为同页缓存切换，不再把图片收藏内容挂到提示词网站下方。
- 画廊交互优化：作品卡片拆分为 memo 化独立组件，图片预览、右键菜单、收藏、三点菜单和详情开关不再触发整批卡片重建；缩略图颜色 / 尺寸识别改为空闲期批量写入，减少点击时抢占主线程。

### v0.2.8 灵感中心 V2 / 图片收藏 Gallery V2

- 图片收藏改造为 Gallery 视图，支持搜索、筛选默认展开、批量导入、视图切换和详情抽屉。
- 筛选栏参考作品画廊补齐颜色、形状、格式、评分和清空筛选。
- 新增灵感图片 `rating` 字段，前端类型、服务映射和 Tauri 后端 JSON 持久化已同步。
- 保留从灵感图片设为图生图参考、复制 / 套用 Prompt 和转为模板的复用入口。

### v0.2.7 图生图工作台体验 V2

- 参考图卡片显示序号和来源，角色选择器、排序、删除和导入反馈更清晰。
- 生图失败提示接入系统化诊断，覆盖鉴权、权限、额度、限流、协议映射、参数、内容安全、后台超时、服务商异常、返回格式、无图片和网络失败等类型。
- 真实接口测试覆盖文生图、单参考图生图和双参考图生图，修复 OpenAI Images edits 多参考上传字段重复问题。

### v0.2.6 作品画廊 V2 数据层 / 批量整理 V1

- 新增桌面端 `library-meta.json` 元数据文件，收藏、文件夹、收藏集、评分和显示偏好独立于生成历史保存。
- 作品画廊支持多选操作条，可批量收藏、取消收藏、复制 Prompt、复制路径和导出 Markdown 记录清单。
- 导出清单会弹出 Windows 保存位置选择窗口，只导出文本记录，不移动、不删除、不打包图片文件。
- 保留删除记录“不删除磁盘图片”的安全边界，并修复作品画廊菜单、图生图参考图弹层被裁切或层级遮挡的问题。

### v0.2.5 AI 创作功能区 V3

- 提示词润色窗口 V2：原提示词和润色结果都可编辑，支持恢复原文、交换左右、替换、追加和复制。
- 模板灵感 V2：扩充模板库，覆盖商业海报、角色设定、电商主图、产品摄影、游戏资产、社媒封面、图生图改写、中文平台和场景概念，并支持用途筛选。
- 复用记录 V2：支持关键词、平台、模型、类型、状态筛选和排序，显示筛选结果数量，可重置筛选。
- 复用记录支持删除软件记录；删除不会移除磁盘图片文件。

### v0.2.4 提示词润色增强

- 本地润色从“原句追加关键词”升级为结构化重写，按主体、场景、构图、光影、材质、色彩、质量和约束重新组织 Prompt。
- 本地规则库新增保守润色、细节扩写、商业海报、角色设定、电商主图、图生图改写、游戏资产、社媒封面和中文平台方向。
- 模型润色提示词增加硬性规则，要求重组原始提示词，避免只在末尾追加一句泛泛质量词。
- 润色弹窗的模式选择补充说明文字，原提示词和润色结果增加字符数显示，长 Prompt 对比更容易检查。
- 模型润色失败时继续保留本地结构化结果，避免用户丢失原始 Prompt 或被空结果打断。

### v0.2.3 图生图协议适配 V2

- 平台配置新增“图生图映射”，支持自动选择、OpenAI Images edits、Responses input_image、Chat image_url 和 JSON image/images。
- Tauri 后端会根据 Provider、协议类型和映射配置决定 multipart / JSON 请求形态，并把 `visionhub_protocol_mapping` 写入生成结果 raw。
- 图生图 400 / 404 / 422 等协议不匹配错误会补充当前映射、请求形态和参考图字段提示，便于快速切换配置。
- 能力矩阵 V2 改为折叠入口，当前能力摘要保持可见，配置详情不再被完整矩阵压到页面下方。

### v0.2.2 平台能力矩阵 V2

- 平台接入页新增能力矩阵 V2，按服务模板横向展示“已接入 / 可配置 / 部分 / 待接入 / 本地规划”等状态。
- 矩阵覆盖文生图、图生图、多参考图、Images、Responses、兼容中转、官方协议和本地服务，减少用户误把路线模板当成可直接生成入口。
- 待接入和本地模型模板继续保持只读规划，不开放保存、启用或试生图。
- 能力矩阵补齐浅色 / 深色模式样式，并对长服务名和长说明做截断与横向滚动保护。

### 平台接入与生成稳定性

- Provider 列表保留为下拉选择样式。
- 左侧新增配置实例列表，支持新增、选择、保存、保存并启用、测试延迟、删除、启用和关闭。
- 点击“新增”会打开空白配置详情，不再联动修改当前实例。
- 协议类型增加说明文字，平台和协议下拉按钮移除常驻投影。
- 诊断助手和相关按钮已做浅色 / 暗色适配。
- `/v1/responses` 成功返回但软件误判失败的问题已修复，后端现在会识别 `output[].result`、`result` 和 `image` 等常见图片字段。
- 旧失败记录如果 `raw` 里包含可恢复图片，会自动恢复为成功并写入本地图册目录。
- 对 HTTP 524、后台任务仍可能继续生成的情况，前端会显示“待核查”，避免直接误导为普通失败。
- Responses 协议会尝试使用 `background: true` 和 `store: true` 后轮询 `/v1/responses/{id}`；如果中转站不支持后台任务，会自动回退同步请求。

### 页面标题与设置面板

- 免费平台、作品画廊、灵感中心、提示词库、平台接入等页面标题已统一为“小英文 + 大中文标题 + 小字说明”结构。
- 非 AI 创作页面标题右侧提示信息已调整对齐方式，使其更贴合中间大标题。
- 偏好设置标题保留普通样式，上方小字为 `Preferences`。
- 设置面板的“跟随系统”主题已接入实际功能。
- “关于与软件升级”已改为“软件升级”。
- 版本里的技术栈信息默认隐藏，只在开发者模式下显示。

### UI 细节

- 侧边栏略微缩窄，底部“浅色模式 / 收起侧边栏”按钮同步缩窄。
- 全局按钮和下拉菜单按钮清理了常驻投影，仅保留轻微 hover 交互。
- 侧边栏收起时的图标、设置面板右上角图标按钮等无文字按钮已补充悬停说明和可访问标签。
- AI 创作面板“输出尺寸”列表隐藏滚动条。
- 浅色 / 暗色滚动条颜色已调整，同时保持输出尺寸列表不显示滚动条。
- 免费平台页面的平台卡片已改用对应网站 Logo / favicon。

### 作品画廊与图生图

- 作品画廊顶部的成功率、平均耗时等四个指标已压缩进更紧凑的工具区，减少对图片展示区域的占用。
- 作品画廊 V2 的隐藏分类侧栏、底部悬浮搜索、视图模式、收藏、过滤、排序和图片管理能力已进入主界面。
- 图片详情页支持评分、颜色取样、模型 / 尺寸 / 文件大小 / 格式信息展示。
- 失败图片默认不进入画廊主视图，需要主动选择失败状态后查看。
- 图生图模式下参考区左侧文字已按整体主题提高可读性。
- 参考图缩略图 hover 删除按钮里的图标已居中。
- 图生图参考图支持左右调整顺序。
- 图生图参考图支持标记参考角色：自动、构图、风格、角色和色彩。

### 平台接入与提示词润色

- 平台接入页已拆成平台类型、服务模板和配置实例三层。
- “GPT Image” 文案已区分为官方 OpenAI 和聚合站 / OpenAI 兼容中转。
- 聚合站模板强调填写服务商实际支持的模型 ID，例如 GPT Image、Nano Banana、Qwen、豆包、Grok、Midjourney、可灵等。
- 提示词润色专用配置独立于生图配置，支持保存多个文本模型配置实例。
- 本地规则润色保留离线可用；模型润色支持把短提示扩写成更完整的生图提示词。

## 换电脑开发：路径可以不一样

公司电脑当前路径可能是：

```powershell
D:\AIGC\codex\Projects\软件开发\visionhub-studio
```

家里电脑不需要保持同样路径。你可以放在任意目录，例如：

```powershell
D:\Projects\visionhub-studio
C:\Users\你的用户名\Documents\Codex\Projects\visionhub-studio
E:\AIGC\visionhub-studio
```

项目脚本大多基于脚本自身位置计算项目根目录，例如：

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\start_release.ps1"
```

所以只要在仓库根目录运行命令即可，不依赖公司电脑的绝对路径。

## 首次在新电脑上安装

### 1. 克隆仓库

```powershell
git clone https://github.com/BlueSummer2333/VisionHub-Studio.git
cd VisionHub-Studio
```

### 2. 安装依赖

如果新电脑已有 Node / npm / Rust / Cargo：

```powershell
npm.cmd install
```

如果新电脑缺少环境，优先使用项目内便携工具链脚本：

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\setup_portable_toolchain.ps1"
powershell -ExecutionPolicy Bypass -File ".\scripts\install_dependencies.ps1"
```

### 3. 验证项目

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\run_checks.ps1"
```

这个脚本会运行：

- smoke check
- TypeScript + Vite build
- Cargo check

## 日常开发命令

### Web 开发预览

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\dev_web.ps1"
```

### Tauri 开发模式

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\dev.ps1"
```

### 构建前端

```powershell
npm.cmd run build
```

### 构建桌面 release

```powershell
powershell -ExecutionPolicy Bypass -Command ". '.\scripts\use_portable_toolchain.ps1'; npm.cmd run tauri:build"
```

构建成功后主要产物：

```text
src-tauri/target/release/visionhub-studio.exe
src-tauri/target/release/bundle/msi/*.msi
src-tauri/target/release/bundle/nsis/*setup.exe
```

这些构建产物不提交到 Git；需要时在本机重新构建。

### 启动 release

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\start_release.ps1"
```

如果 release exe 正在运行，脚本会先停止旧进程再启动。

## 公司和家里同步工作流

### 公司下班前

```powershell
git status
git pull --rebase
powershell -ExecutionPolicy Bypass -File ".\scripts\run_checks.ps1"
git add .
git status
git commit -m "feat: sync latest VisionHub Studio work"
git push
```

### 家里开始前

```powershell
git pull
powershell -ExecutionPolicy Bypass -File ".\scripts\run_checks.ps1"
```

### 家里修改后

建议小步提交：

```powershell
git status
git add .
git commit -m "feat: polish image workflow"
git push
```

### 下周回公司继续

```powershell
git pull
powershell -ExecutionPolicy Bypass -File ".\scripts\run_checks.ps1"
```

## 不要提交的内容

以下内容会被 `.gitignore` 排除：

- `node_modules/`
- `dist/`
- `output/`
- `.codex-browser-profile/`
- `src-tauri/target/`
- `src-tauri/gen/`
- `docs/run-reports/`
- `.env` / `.env.*`
- 日志文件
- 编辑器本地配置

特别注意：

- API Key 不进入仓库；换电脑后需要在软件里重新配置。
- 本地生成图片和图册数据建议用单独的图库目录同步，例如移动硬盘、NAS、OneDrive 或 Syncthing。
- 不建议把整个项目目录直接放进 OneDrive 自动同步，因为 `node_modules` 和构建产物文件数量多、体积大、容易冲突。

## Provider 配置说明

当前真实在线生成主要依赖 OpenAI-compatible Provider 配置：

- Base URL
- Model ID
- Protocol / Endpoint Path
- Extra Headers
- API Key

API Key 由 Tauri 后端写入系统安全凭据，不会写入 `localStorage` 或 Git 仓库。

## 常见问题

### 家里路径和公司不一样会不会坏？

不会。克隆到任意路径后，在仓库根目录运行 `scripts/` 下的脚本即可。

### `npm.ps1` 被 PowerShell 拦截怎么办？

使用：

```powershell
npm.cmd install
npm.cmd run build
```

不要为了一个项目修改全局执行策略。

### 没有 Rust / Cargo 怎么办？

运行：

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\setup_portable_toolchain.ps1"
```

然后重新打开 PowerShell 或执行项目脚本加载便携工具链。

### release exe 无法覆盖怎么办？

通常是旧程序还在运行。先执行：

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\stop_app.ps1"
```

再重新构建。

## 当前状态

- 版本：0.4.1
- 平台：Windows 优先
- 发布策略：正式发布准备后移到 `v1.0` 前；`0.3.x` 进入收口补丁，`0.4.x` 进入日常可用性和稳定性增强
- 签名状态：未签名；对外发布前需要代码签名，否则 Windows SmartScreen 可能提示未知发布者。

## 后续路线

详细执行计划、版本号节奏和验收规则见 [VisionHub Studio 后续开发总控计划](docs/visionhub-development-plan.md)。后续计划性开发先读 `AGENTS.md` 和该文档，再进入对应专项文档。

### 路线维护规则

- 后续每完成一个路线项，只用删除线标记并补充“已完成 / 已落地 / 已合入版本”等简短状态，不直接删除原路线。
- 未完成路线继续保留原顺序，后续优化按规定路线推进，避免因为中间穿插小修复而忘记原计划。
- 小优化、小修复默认归入最近相关路线项或当前版本备注，不单独更新版本号，也不急于推送。
- 完成一个路线项后先用删除线标记；如果后续还有小修改小优化，继续本地迭代。
- 用户确认某个细版本最终收口后，再统一更新版本号、README、验证记录，并提交推送 GitHub。
- `0.3.x` 只做收口补丁，`0.4.x` 进入作品画廊整理、Prompt 工作流、Provider 稳定、本地模型、数据治理和全局 QA；发布准备、release notes、安装包、迁移说明和 SHA256 记录整体后移到 `0.5.0` / `v1.0` 前。

### 版本路线清单

- ~~`0.2.2` 平台能力矩阵 V2~~
  - 状态：已完成并发布。
  - ~~清晰展示平台、协议、能力、状态和可用边界。~~
  - ~~区分中转站 / 聚合 API、官方 API、本地模型三条路线。~~
  - ~~待接入模板保持只读规划状态，避免误导。~~
- ~~`0.2.3` 图生图协议适配 V2~~
  - 状态：已完成第一轮落地并发布；后续小修复继续归入图生图工作台体验优化。
  - ~~把图生图映射从后端隐式逻辑提升为可配置项。~~
  - ~~在生成结果 raw 中记录协议映射摘要，辅助排查中转站协议不匹配。~~
  - ~~能力矩阵改为折叠查看，避免挤压平台配置详情。~~
- ~~`0.2.4` 提示词润色增强~~
  - 状态：已完成第一轮落地并发布；后续小修复继续归入提示词润色体验优化。
  - ~~扩展本地规则库，让离线润色覆盖更多常用场景。~~
  - ~~优化模型润色规则，让短提示能稳定扩写成完整生图 Prompt。~~
  - ~~增加更多面向电商、角色、海报、游戏资产、社媒封面的专用润色方向。~~
- ~~`0.2.5` AI 创作功能区 V3~~
  - 状态：已完成基础落地并发布；模板收藏、最近使用模板、用户自定义模板和导入 / 导出自定义模板转入后续增强计划。
  - ~~提示词润色窗口 V2：原提示词展示区和润色结果展示区改为可编辑，支持用户在弹窗内直接二次修改后回填。~~
  - ~~对齐润色弹窗顶部信息：让“原提示词 / 字符数量”和“润色结果 / 字符数量”在左右面板中横向对齐，长 Prompt 下也不跳位。~~
  - ~~复用记录窗口 V2：为历史 Prompt 增加“复用到当前提示词”“追加到当前提示词”“删除记录”“复制 Prompt”等操作。~~
  - ~~复用记录增加筛选和排序：按平台、模型、文生图 / 图生图、有参考图、最近使用时间和关键词快速定位。~~
  - ~~模板灵感窗口 V2：扩充模板数量，覆盖商业海报、角色设定、电商主图、产品摄影、游戏资产、社媒封面、图生图改写、中文平台等方向。~~
  - ~~模板灵感增加快捷操作：支持一键替换、追加、按用途筛选，并为每个模板提供适合场景说明。~~
  - ~~保持提示词润色、复用记录、模板灵感三类弹窗的按钮、字符统计、空状态和暗色 / 浅色模式一致。~~
- ~~`0.2.6` 作品画廊 V2 数据层~~
  - 状态：已完成数据层和批量整理 V1 并发布；后续文件夹拖拽、导入去重和更高级整理继续归入画廊增强计划。
  - ~~完善文件夹、收藏集、评分、颜色取样和筛选条件的持久化结构。~~
  - ~~增加多选、批量收藏、批量复制 Prompt / 路径、导出记录清单等管理能力。~~
  - ~~导出记录清单改为弹出系统保存位置选择窗口，不默认丢到下载目录。~~
- ~~`0.2.7` 图生图工作台体验 V2~~
  - 状态：已完成并发布；参考图管理、多参考修复和错误诊断已完成第一轮真实接口验证。
  - ~~优化参考图管理，包括拖拽、粘贴、最近生成图复用、格式反馈和多参考排序。~~
  - ~~继续检查长 Prompt、空状态、失败记录、底部悬浮区域和右侧参数栏是否有压迫感或重叠。~~
  - ~~强化图生图生成前的可用性提示和失败后的恢复路径。~~
- ~~`0.2.8` 灵感中心 V2~~
  - 状态：已完成图片收藏 Gallery V2 第一轮并发布；提示词网站 V2 已拆出为 `0.2.9` 单独规划，后续相似风格聚类和真实视觉模型反推 Prompt 继续归入灵感中心增强计划。
  - ~~图片收藏改造为 Gallery 视图，支持搜索、筛选默认展开、批量导入、视图切换和详情抽屉。~~
  - ~~筛选栏参考作品画廊补齐颜色、形状、格式、评分和清空筛选。~~
  - ~~新增灵感图片评分字段并通过 Tauri 后端持久化。~~
  - ~~打通灵感图片复用为图生图参考、复制 / 套用 Prompt 和转为模板的入口。~~
- ~~`0.2.9` 提示词网站 V2~~
  - 状态：已完成并发布；提示词网站已从图片收藏拆分为独立目录，后续 Prompt 摘录、网页采集和站点模板推荐继续归入灵感中心增强计划。
  - ~~将灵感中心里的“提示词网站”和“图片收藏”拆成两个清晰路线，避免一个版本塞入两套信息架构。~~
  - ~~增加常用提示词网站预设、分类、地区、登录要求、常用入口和来源详情管理。~~
  - ~~支持打开次数 / 最近打开、类型 / 地区 / 来源 / 登录 / 商用筛选、搜索和自定义添加。~~
  - ~~为后续提示词网页采集、Prompt 摘录和站点模板推荐预留结构，但不伪装成已接入的网页抓取能力。~~
- ~~`0.3.0` 错误诊断与恢复~~
  - 状态：已完成并收口；诊断面板、后台任务手动 / 自动重查、恢复落盘、画廊异常恢复说明和配置自检报告均已落地。
  - ~~继续增强 401、403、404、429、524、余额限制、模型不存在、协议不匹配等错误解释。~~
  - ~~对后台可能成功的长任务提供更明确的重查提示和复制排查材料。~~
  - ~~对可重查的后台任务提供恢复入口，成功后补回图片并更新作品画廊记录。~~
  - ~~配置自检报告、自动定时重查和更多落盘异常恢复说明。~~
- ~~`0.3.1` AI 创作台 V4~~
  - 状态：已完成本轮收口；Prompt 草稿、风格快捷选择、数量修复、高级参数、画布空状态、失败提示和图生图参考区布局均已落地。
  - ~~Prompt 草稿：保存当前 Prompt，独立草稿窗口查看和回填。~~
  - ~~生成参数收口：移除未接入审核控件，补齐数量、格式、压缩率、Seed 和负面提示词的真实链路。~~
  - ~~失败提示：按文生图 / 图生图模式独立显示，重新生成时旧错误隐藏，失败详情可读并提供重载历史 / 作品画廊入口。~~
  - ~~结果复用和图生图增强：最近生成图可作为参考，参考图区域和模式切换布局完成收口。~~
  - ~~创作台视觉：画布空状态改为主题色星点虚线网格，浅色 / 暗色模式下保持可读。~~
- ~~`0.3.2` 免费平台 V2~~
  - 状态：已完成本轮收口；免费平台已升级为网页平台助手，不模拟外部网站登录、网页操作或自动抓图。
  - ~~平台库扩展到 31 个免费 / Freemium 图片平台，其中 11 个国内平台。~~
  - ~~支持卡片 / 列表视图、国内 / 海外筛选、搜索、状态筛选、收藏、备注和详情查看。~~
  - ~~卡片模式使用右侧详情抽屉，列表模式保留行内详情。~~
  - ~~支持复制平台适配 Prompt 后打开网页，再把用户下载的成品导入灵感中心图片收藏。~~
  - ~~平台图标优先加载并缓存站点 favicon，失败后再回退文字标识。~~
- ~~`0.3.3` 提示词库 V2~~
  - 状态：已完成本轮收口；分类、收藏、最近使用、自定义模板、变量填充、导入 / 导出和跨模块转模板链路均已落地。
  - ~~模板分类：商业海报、电商主图、角色设定、游戏资产、图标 UI、社媒封面、图生图改写、免费平台专用。~~
  - ~~模板变量：`{主体}`、`{风格}`、`{场景}`、`{颜色}`、`{镜头}`、`{平台}`。~~
  - Prompt 组合器已在 `0.4.1` 以低打扰弹窗 Tab 方式落地，不再占用提示词库主页或 AI 创作台主布局。
  - ~~与作品画廊、灵感中心联动，把成功记录或收藏图片 Prompt 转为模板。~~
  - 后续 Prompt 组合器继续归入提示词库后续增强或工作区首页 V2。
- ~~`0.3.4` 平台接入 V3~~
  - 状态：已完成本轮收口；多配置档案、模型列表刷新、指定模型探测、非消耗诊断和真实试生图区分均已落地。
  - ~~平台状态分层：已接入、可配置、规划中、本地路线。~~
  - ~~聚合 API 增强：多个中转站配置档案、独立模型列表、独立图生图协议映射。~~
  - ~~模型可用性测试：模型列表刷新、指定模型探测、错误分类。~~
  - ~~非消耗诊断：本地配置、密钥状态、模型列表记录、图生图映射和 AI 创作页生效关系。~~
  - ~~真实试生图与非消耗诊断分层，避免误触消耗额度。~~
  - 真实图生图、多参考图和 Responses / Images 路径能力测试待可用 API Key 后继续补充。
- ~~`0.3.5` 本地模型路线 MVP~~
  - 状态：已完成 ComfyUI MVP 并收口；高级本地模型能力后续等可测环境再推进。
  - ~~ComfyUI 连接诊断和自动刷新，避免服务关闭后继续显示旧的在线状态。~~
  - ~~ComfyUI API workflow 导入、管理和可生成状态提示。~~
  - ~~AI 创作台通过 ComfyUI 执行文生图，并将结果保存到作品画廊。~~
  - Stable Diffusion WebUI / Forge、ComfyUI 图生图、参考图上传和节点映射继续后排；其他小众本地 UI 暂不列入默认模板。
- ~~`0.3.6` 工作区首页 V2~~
  - 状态：已完成并收口；首页已从占位区升级为真实总览页。
  - ~~画廊整理入口：管理项目参考图、Prompt、生成图和风格说明。~~
  - ~~批量队列入口：多 Prompt、多尺寸、失败任务重试。~~
  - ~~多模型对比入口：同一 Prompt 跑多个模型并记录适用场景。~~
  - ~~展示最近任务、最近失败、最近收藏和最近参考图。~~
  - 批量队列和多模型对比当前保持入口 / 规划状态，真实执行能力后续单独推进。
- ~~`0.3.7` 偏好设置 V2~~
  - 状态：已完成并收口；偏好设置已升级为工作流配置中心。
  - ~~创作默认值：默认平台配置档案、默认模型、默认生图模式、默认图片数量、默认尺寸、默认参考图角色。~~
  - ~~Prompt 偏好：默认润色模式、默认输出语言、Prompt 历史和失败 Prompt 保存策略。~~
  - ~~作品保存偏好：默认格式、文件命名规则、按日期 / 项目分文件夹。~~
  - ~~界面偏好：首页模块控制、紧凑模式、启动页、侧边栏状态，以及简体中文 / English 手动切换；不做跟随系统。~~
  - ~~数据管理：打开 AppData、打开图库目录、导出设置备份，后续支持导入设置备份。~~
  - 完整页面文案国际化后续单独推进。
- ~~`0.3.8` 平台接入 V4~~
  - 状态：已完成并收口；官方 API 实接、聚合站多实例、兼容协议和历史 raw 轻量化已落地。
  - ~~目标：把官方 API 从“规划模板”推进到多平台真实接入，同时保持中转站 / 聚合 API 仍是默认主入口。~~
  - ~~第一阶段先改平台模板结构：增加国内 / 国外标识、接入状态、排序权重、官方文档入口和能力字段；已接入 / 可配置模板靠上，待接入模板自动靠下。~~
  - ~~默认服务模板主流优先，不堆用户没听过、短期不用、也没有真实接入计划的小众平台。~~
  - ~~官方 API 多平台真实接入：MiniMax 作为第一条新增官方 API 已进入实接链路，`image-01` 文生图和单张人物主体参考图生图已实测通过，并已补齐固定模型 ID 诊断、非 OpenAI-compatible 模型列表提示和 MiniMax 专用错误分类；Google Gemini / Nano Banana 官方已完成 `generateContent` / `inlineData` 代码链路和本地构建验证，待真实 Gemini API Key 联调。~~ 后续继续推进 xAI、火山方舟 / Seedream、阿里百炼 / 通义万相、可灵企业 API、即梦企业 API。
  - ~~小米 MiMo 已完成第一轮公开文档核验：当前官方 API 主要覆盖文本、图像理解和全模态推理，未发现公开文生图 / 图生图 endpoint；软件中继续作为官方候选说明，不开放保存启用或真实生图。~~
  - ~~聚合站 / 中转站多实例切换、生成历史 raw 轻量化、Chat 包装兼容和 Images 精简兼容协议已完成。~~ `woyao.pro` 的 Gemini / GPT Image 生图专用规则暂缓，后续只在有站点文档、raw 错误或可用 curl 时继续适配。
  - 每个官方平台单独 adapter，不把官方 API 强塞进 OpenAI-compatible；共用任务轮询、图片下载、错误归一化和作品画廊保存链路。
  - 官方 API 第一批稳定后，再推进聚合网站 API、硅基流动等聚合站真实能力，以及 Stable Diffusion WebUI / Forge 本地模型路线。
  - 未确认真实 API、账号权限或企业文档的平台，不显示“保存并启用 / 真实试生图”等会误导用户的操作。
- `0.3.9` 批量队列与多模型对比 V1
  - 已完成：本地批量队列数据层、任务快照执行器骨架、AI 创作台“加入队列”按钮、“批量队列”页面，以及单任务执行前确认、执行状态回写、取消标记、失败任务重新入队、失败 / 取消任务删除和连续队列执行 V1。
  - 已完成：多 Prompt / 多画面比例批量变体 V1，可按逐行 Prompt 和多个画面比例创建队列任务，单次限制 40 个任务，避免误操作创建过大队列。
  - 已完成：同一 Prompt 多配置实例横向对比 V1，可在创作台勾选多个配置实例并创建对比组入队，队列页显示对比组统计、任务标识和并排结果卡片。
  - 已完成：连续执行进度横幅、当前任务完成后暂停 / 继续执行，以及本地批量模板保存、套用和删除。
  - 待继续：真实浅色模式视觉验收、模板保存 / 套用 / 删除流程自动化检查，以及批量队列页面小修和易用性打磨。
  - 生成前明确数量、模型和可能消耗，不默认自动连发。
- `0.3.10` 0.3 系列收口补丁
  - 提示词润色默认跟随原文主语言，日语输入输出日语，英语输入输出英语，中文输入输出中文；只有用户明确选择输出中文 / 英文 / 中英双语时才转换语言。
  - 批量队列继续做真实浅色模式、窄屏、长 Prompt、长模型名、失败卡片、对比卡片和模板卡片视觉 QA。
  - 批量模板流程继续检查保存、套用、删除，以及不保存生成结果、图片和系统凭据的边界。
  - 绿色版已完成本机 release 构建和启动验证；启动不再出现调试控制台，工作区首页“继续上次创作”保持左右排版，左侧图片按原始比例完整显示，右侧标题和 Prompt 保持摘要展示。
  - README 和计划文档同步进入 `0.4.x` 后续路线。
- `0.4.0` 作品画廊与资料整理收口 V3
  - 不再继续独立项目资产库页面，资料整理回到作品画廊、灵感中心和批量队列闭环。
  - 修正作品画廊状态筛选：默认成功记录，并可明确切换失败记录或全部记录。
  - 补齐最近查看、最近设为参考的元数据写入和排序入口，保持现有按钮大小、位置和排版不变。
- `0.4.1` Prompt 与灵感工作流 V3
  - 已先落地灵感图片真实反推 Prompt：使用偏好设置中的图片反推专用配置和 `image-reverse:default` 独立密钥通道，支持图片输入 + 文本输出模型，结果可复制、套用和转模板；该模型不进入 AI 生图工作台。
  - 已落地 Prompt 摘录 V1：支持手动摘录、从剪贴板摘录、本地持久化、搜索筛选、套用到创作台和转为提示词模板。
  - 已补齐低打扰 Prompt 辅助入口：当前 Prompt 可保存为摘录或模板；Prompt 组合器收在弹窗 Tab 内，不改创作台主布局。
  - 已完成复用记录常用标记和只看成功生成 Prompt，避免失败实验污染常用复用池。
- `0.4.2` Provider 稳定接入 V5
  - 按“有文档、有账号、有 raw 错误证据”继续接入 Gemini / Nano Banana 官方、xAI / Grok Image、火山方舟 / Seedream、阿里百炼 / 通义万相等平台。
  - 聚合站只为高频、有文档或有真实错误证据的站点建立专用模板；其他继续走自定义 OpenAI-compatible。
  - 配置自检继续增强 endpoint、图生图、参考图字段和消耗风险说明。
- `0.4.3` 本地模型增强 V2
  - Stable Diffusion WebUI / Forge 连接诊断、txt2img 和结果入库。
  - ComfyUI 图生图、参考图上传和 API workflow 节点映射提示。
  - 本地模型不拖慢在线中转站 / 聚合 API 主流程。
- ~~`0.4.4`~~ 轻量迁移支持 V1 - closed
  - 不做独立健康检查中心，避免低价值扫描和复杂自动修复。
  - 偏好设置集中提供 AppData、作品画廊、图片收藏和备份目录入口。
  - 导出不含 API Key 的迁移说明，列出 Provider profile id、需要复制的目录和需要重新输入的凭据。
- `0.4.5` 全局体验与性能 QA
  - 全页面浅色 / 暗色、长文本、多语言、空状态、错误状态和大历史数据压力验收。
  - 检查图标按钮 tooltip、`aria-label`、危险操作确认和大型列表性能。
- `0.5.0` 发布候选准备
  - 统一版本号、产品名、README 当前状态、验证脚本和 release notes 草稿。
  - 构建 release exe 做免安装绿色版验收。
  - 检查 GitHub 仓库不含 API Key、AppData、生成图片、构建产物和本地缓存。
- `v1.0 前` 发布与迁移准备
  - 稳定版验证清单、release notes、迁移说明、未签名安装说明、安装包和 SHA256 记录统一收口。
  - 正式对外发布前再规划代码签名和 GitHub Release Asset 边界。
