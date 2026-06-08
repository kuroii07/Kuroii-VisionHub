# VisionHub Studio AGENTS.md

## 项目定位

- 项目路径：`D:\AIGC\codex\Projects\软件开发\visionhub-studio`
- 技术栈：Tauri v2 + React + TypeScript + Vite
- 默认语言：简体中文
- 当前核心方向：本地优先的 AI 图像创作工作台，重点服务中转站 / 聚合 API 工作流。

## 硬性边界

- 不修改 AiMaMi 本地代理配置、Clash/VPN、系统代理、DNS 或其他系统网络设置。
- 不重置用户本地数据，不清空历史记录、画廊、配置、缓存或凭据。
- Provider profile 的 API Key 绑定在系统凭据里，secret id 形如 `profile:${profileId}`。
- 迁移 provider/profile 配置时必须保留 `profile.id`，不能因为文案或分组调整而改变 profile id。
- 提示词润色使用独立凭据通道，当前 secret id 为 `prompt-polish:default`，不要和生图平台 Key 混用。

## 平台接入方向

- 中转站 / 聚合 API 是默认主入口。
- 官方 API 保留入口；除 OpenAI 官方外，未真实接入前只展示规划或模板状态。
- 本地模型保留入口；未真实接入前只展示规划，不允许误导用户以为能直接生成。
- 待接入模板可以展示说明，但不能提供保存启用、试生图等会让用户误判为已可用的操作。
- 用户主要使用中转站 / 聚合 API，不以官方 OpenAI API 作为默认假设。

## 已知 provider 规则

- `openai-gpt-image` 表示官方 OpenAI GPT Image。
- `custom-http-provider` 表示聚合站 / OpenAI 兼容中转，是当前默认工作流。
- 如果旧 profile 的 `providerId` 是 `openai-gpt-image`，但 `baseUrl` 不是 `https://api.openai.com`，应迁移为 `custom-http-provider`，同时保留原 profile id。
- 默认 generation provider 和 prompt polish provider 都应优先面向中转站 / 聚合 API。

## 开发习惯

- 修改前先读相关代码，优先使用 `rg` 搜索。
- 使用 `npm.cmd`，避免 PowerShell 执行策略拦截 `npm.ps1`。
- 手动文件修改优先使用 `apply_patch`。
- 保持改动聚焦，不重构无关模块。
- UI 改动要兼顾亮色 / 暗色模式，图标按钮需要 `title`、`aria-label` 或 `data-tooltip`。
- 桌面能力应通过 Tauri command 暴露最小必要接口，前端不直接访问任意本地文件。

## 常用验证命令

在项目根目录运行：

```powershell
npm.cmd run build
python .\scripts\smoke_check.py
cargo check
git -c safe.directory="D:/AIGC/codex/Projects/软件开发/visionhub-studio" diff --check
```

如果只改前端 UI，可先跑：

```powershell
npm.cmd run build
python .\scripts\smoke_check.py
```

如果改到 `src-tauri`，必须补跑：

```powershell
cargo check
```

## 当前重点模块

- 平台接入：`src/providers/`, `src/services/providerConfig.ts`, `src/services/providerProfiles.ts`
- 应用设置：`src/services/appSettings.ts`
- 创作台：`src/ui/GeneratePage.tsx`
- 提示词辅助：`src/services/promptAssist.ts`, `src/ui/PromptAssistModal.tsx`
- 作品画廊：`src/ui/LibraryPage.tsx` 及相关样式
- Tauri 后端：`src-tauri/src/main.rs`
- Smoke 检查：`scripts/smoke_check.py`

## 交付要求

- 完成后说明改了哪些核心文件。
- 明确列出已运行的验证命令和结果。
- 没跑的检查要说明原因。
- 不要声称视觉问题已修复，除非已通过实际运行或截图检查确认。
