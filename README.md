# VisionHub Studio

VisionHub Studio 是一个桌面优先的多平台 AI 图片创作工作台，当前以 Tauri + React + TypeScript + Vite 实现。项目优先服务中转站 / 聚合 API 工作流，同时保留官方 API 和本地模型路线，目标是把 OpenAI-compatible 中转、OpenAI 官方、后续 Nano Banana / Grok / Seedream / 即梦 / 豆包 / 可灵等在线生图能力统一到一个本地软件里。

> 说明：本仓库只保存源码、配置、脚本和文档；不会提交 API Key、生成图片、个人 AppData 数据、`node_modules`、`dist` 或 `src-tauri/target` 构建产物。

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
  - Responses 协议支持 `background/store` 尝试和轮询查询，用于降低长任务同步超时误判
  - HTTP 524 / 后台可能继续生成的任务会标记为“待核查”
  - API Key 通过桌面端系统凭据保存，不写入仓库
  - 旧中转站配置会保留 profile id 迁移，避免丢失系统凭据绑定
- 提示词辅助
  - 模板灵感
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
- 免费平台
  - 管理常用免费 AI 图片平台入口
  - 平台卡片使用对应站点 Logo / favicon
- 灵感中心
  - 管理国内外提示词模板站、图片灵感站、模型社区和风格参考站
  - 导入本地 AI 图片收藏，支持选择、拖拽和剪贴板粘贴
  - 记录来源 URL、平台、作者、Prompt、标签、备注和授权状态
  - 灵感图片可一键作为图生图参考
  - 已收藏 Prompt 可一键套用到 AI 创作或转入提示词库
- 图片预览
  - AI 创作、作品画廊和灵感中心各自独立预览状态
  - 滚轮缩放
  - 拖拽移动
  - 点击空白关闭
- 桌面体验
  - 浅色 / 深色 / 跟随系统主题
  - 可折叠侧边栏
  - 无文字图标按钮提供悬停说明和可访问标签
  - 设置面板支持开发者模式显示技术栈信息
  - 本地图册路径可自定义
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

本仓库当前处在“平台接入 + 作品画廊 V2 + 图生图工作台 + 提示词润色”阶段：

- 平台接入已改为“平台类型 → 服务模板 → 配置实例”的信息架构。
- 中转站 / 聚合 API 是默认主入口，官方 API 和本地模型按规划状态展示。
- 平台接入页已加入能力矩阵 V2，并将完整矩阵改为按需展开，配置详情保持优先显示。
- 图生图协议映射 V2 已接入配置和生成链路，可在平台配置中切换参考图字段结构，并在生成结果 raw 中记录实际映射摘要。
- 旧中转站配置迁移会保留 profile id，避免丢失 `profile:${profileId}` 系统凭据绑定。
- 作品画廊 V2 已完成一轮可用化：隐藏式分类、文件夹、收藏集、评分、颜色取样、详情信息和筛选栏都已接入。
- 图生图工作台已支持参考图拖拽、粘贴、排序、角色标记和最近生成图复用。
- 提示词润色已拆成本地规则和模型润色两条路径，模型润色使用独立凭据 `prompt-polish:default`。
- `/v1/responses` 图片结果解析已兼容常见 `result` / `image` 字段。
- Responses 长任务已加入 background + store 尝试和轮询查询；中转站不支持时会回退同步请求。
- 项目级 Codex 规则已写入 [AGENTS.md](AGENTS.md)，换电脑后继续开发时先读该文件。

## 近期更新记录

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

- 版本：0.2.6
- 平台：Windows 优先
- 发布形态：本地自用 release exe / MSI / NSIS 安装包
- 签名状态：未签名；对外发布前需要代码签名，否则 Windows SmartScreen 可能提示未知发布者。

## 后续路线

详细执行计划、版本号节奏和验收规则见 [VisionHub Studio 后续开发总控计划](docs/visionhub-development-plan.md)。后续计划性开发先读 `AGENTS.md` 和该文档，再进入对应专项文档。

### 路线维护规则

- 后续每完成一个路线项，只用删除线标记并补充“已完成 / 已落地 / 已合入版本”等简短状态，不直接删除原路线。
- 未完成路线继续保留原顺序，后续优化按规定路线推进，避免因为中间穿插小修复而忘记原计划。
- 小优化、小修复默认归入最近相关路线项或当前版本备注，不单独更新版本号；如果累计成稳定体验改进，再合并到下一个细版本整理。
- 大优化、大修改仍按总控计划更新更细版本号，并同步 README、验证记录、构建结果和 GitHub 推送。

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
- `0.2.7` 图生图工作台体验 V2
  - 优化参考图管理，包括拖拽、粘贴、最近生成图复用、格式反馈和多参考排序。
  - 继续检查长 Prompt、空状态、失败记录、底部悬浮区域和右侧参数栏是否有压迫感或重叠。
  - 强化图生图生成前的可用性提示和失败后的恢复路径。
- `0.2.8` 灵感中心 V2
  - 增加网站预设、批量导入、反推提示词和相似风格聚类。
  - 打通灵感图片、提示词库、图生图参考图和作品画廊之间的复用链路。
  - 增强来源详情、授权备注和素材分类管理。
- `0.2.9` 错误诊断与恢复
  - 继续增强 401、403、404、429、524、余额限制、模型不存在、协议不匹配等错误解释。
  - 对后台可能成功的长任务提供更明确的重查、恢复和画廊落盘路径。
  - 增加配置自检报告，方便换电脑或换中转站时快速定位问题。
- `0.3.0` 发布与迁移准备
  - 整理稳定版验证清单和 release notes。
  - 保持 API Key、用户图库、Provider profile id 和提示词润色凭据的迁移边界清晰。
  - 准备未签名 Windows 安装包的使用说明；正式对外发布前再规划代码签名。
- `0.3.1` 本地模型路线 MVP
  - 先规划 ComfyUI、Stable Diffusion WebUI / Forge、InvokeAI 等本地服务入口。
  - 优先保证本地模型规划不影响当前中转站 / 聚合 API 主流程。
  - Ollama 先用于本地文本润色或提示词辅助，不作为生图主入口。
