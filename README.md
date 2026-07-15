<p align="center">
  <img src="src-tauri/icons/icon-256.png" width="96" alt="Kuroii VisionHub Logo">
</p>

<h1 align="center">Kuroii VisionHub</h1>

<p align="center">
  <strong>简体中文</strong>
  ·
  <a href="README_EN.md">English</a>
</p>

<p align="center">
  面向 Windows 的本地优先 AI 图片创作工作台，集中管理中转站、官方 API、本地模型、提示词、参考图与作品画廊。
</p>

<p align="center">
  <a href="https://github.com/kuroii07/Kuroii-VisionHub/releases">下载预发布版</a>
  ·
  <a href="docs/visionhub-development-plan.md">开发计划</a>
  ·
  <a href="docs/provider-contract.md">Provider 协议</a>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-v0.5.25-00A6C8">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-333333">
  <img alt="Framework" src="https://img.shields.io/badge/framework-Tauri%20v2-B93272">
  <img alt="Status" src="https://img.shields.io/badge/status-pre--release-6B7280">
</p>

## 界面预览

工作台首页集中展示最近创作、配置状态、异常任务和常用入口。

![Kuroii VisionHub 工作台首页](docs/screenshots/kuroii-visionhub-workspace.png)

## 简介

Kuroii VisionHub 是一款桌面优先的 AI 图片工作流工具。它把文生图、图生图、Provider 配置、批量任务、提示词工具、作品画廊和灵感收藏放在同一个本地工作台中。

项目默认面向中转站 / 聚合 API 工作流，同时保留官方 API 与本地模型接入。应用数据、生成记录和图片目录优先保存在本机，API Key 通过桌面端系统凭据保存，不写入仓库。

## 下载

请从 [GitHub Releases](https://github.com/kuroii07/Kuroii-VisionHub/releases) 下载当前预发布版本。

推荐普通用户下载：

```text
Kuroii-VisionHub_0.5.25_x64-setup.exe
```

这是当前用户安装包，安装和卸载已经完成基础验证。

其他文件：

- `Kuroii-VisionHub.exe`：绿色便携版，可直接运行。
- `Kuroii-VisionHub_0.5.25_x64_en-US.msi`：适合需要 MSI 部署的场景；默认全用户安装需要管理员权限。
- `SHA256SUMS.txt`：发布文件的 SHA256 校验值。

## 安装

1. 下载推荐的 NSIS 安装包。
2. 双击运行安装程序。
3. Windows 如提示未知发布者，确认文件来自本仓库后选择继续运行。
4. 安装完成后，从开始菜单或桌面快捷方式启动 Kuroii VisionHub。

当前 Windows 安装包尚未做代码签名，因此可能触发 SmartScreen 提示。

同一台电脑重新安装时，软件会继续使用原有 AppData、画廊、历史记录和设置，这是为了保留升级兼容性。其他用户在新电脑首次安装时不会自动获得这些数据，除非主动复制旧数据或恢复设置备份。

## 核心功能

- 文生图与图生图工作台，支持最多 4 张参考图、顺序调整和参考角色标记。
- 中转站 / OpenAI-compatible 聚合 API 作为默认接入路线。
- Provider 配置实例、模型选择、协议路径、额外 Headers、连接诊断和图生图映射。
- 官方 API 与本地模型路线，包括 ComfyUI、Stable Diffusion WebUI / Forge 等本地工作流。
- 提示词润色、图片反推 Prompt、提示词模板、Prompt 摘录和复用记录。
- 本地作品画廊，支持筛选、收藏、评分、文件夹、诊断报告和参考图复用。
- 灵感中心，支持本地图片收藏、提示词网站目录、来源信息和授权备注。
- 批量队列与多模型对比，支持失败重试、暂停恢复和结果并排查看。
- 浅色 / 深色主题、可折叠侧边栏、中英文界面与 Windows 桌面打包。

## 接入说明

### 中转站 / 聚合 API

这是默认工作流。不同平台对接口路径、请求字段和图生图参考图结构的要求可能不同，请按平台文档选择协议与图生图映射。

常见协议包括：

- OpenAI Images generations / edits
- OpenAI Responses `input_image`
- Chat Completions `image_url`
- JSON `image` / `images`

### 官方 API

官方 API 按独立适配器接入，不默认假设所有平台都兼容 OpenAI 协议。未完成真实接入的平台只展示规划或模板状态，不提供会误导为可直接生成的操作。

### 本地模型

本地模型需要用户自行运行对应服务并导入正确的工作流或端点配置。当前主要支持 ComfyUI，以及 Stable Diffusion WebUI / Forge 的已接入能力。

## 数据与隐私

- Provider API Key 保存在系统凭据中，绑定标识为 `profile:${profileId}`。
- 提示词润色使用独立凭据 `prompt-polish:default`，不与生图平台 Key 混用。
- 生成记录、画廊、灵感收藏、设置和缓存默认保存在本机。
- 语言切换只翻译软件界面，不会自动翻译用户提示词、模型名、Provider 名、文件路径或原始 API 错误。
- 设置备份不导出 API Key，也不会删除当前系统凭据。
- 删除软件记录默认不会删除磁盘中的原始图片文件。
- 软件不会修改 AiMaMi、Clash / VPN、系统代理或 DNS 设置。
- 仓库不会提交 API Key、用户 AppData、生成图片、`node_modules`、`dist` 或 `src-tauri/target`。

## 开发

技术栈：Tauri v2、React 19、TypeScript、Vite 6、Zustand 与 Rust。

```powershell
git clone https://github.com/kuroii07/Kuroii-VisionHub.git
cd Kuroii-VisionHub
npm.cmd install
npm.cmd run tauri:dev
```

常用检查：

```powershell
npm.cmd run build
python .\scripts\smoke_check.py
cargo check
git diff --check
```

构建 Windows 发布文件：

```powershell
npm.cmd run tauri:build
```

## 项目结构

```text
src/                    React 前端、Provider、服务、状态与页面
src-tauri/              Tauri 后端、桌面命令和打包配置
scripts/                检查、构建、启动与发布脚本
docs/                   产品、Provider、画廊、灵感与发布文档
planning/               产品规划和参考资产
```

## 文档

- [开发总控计划](docs/visionhub-development-plan.md)
- [Provider 协议说明](docs/provider-contract.md)
- [作品画廊 V2 计划](docs/library-v2-plan.md)
- [灵感中心路线](docs/inspiration-center-roadmap.md)
- [v0.5.25 中英双语发布说明](docs/release-notes/0.5.25.md)
- [v0.5.25 Windows 安装验证](docs/release-notes/0.5.25-installer-validation.md)

## 当前版本

当前版本：`v0.5.25`

这是迁移到 `kuroii07/Kuroii-VisionHub` 后发布的首个预发布版本。仓库地址和软件内发布入口已经切换到新仓库，同时保留原有 AppData、Provider profile id、系统凭据绑定与内部兼容标识。

`v1.0` 前的重点是继续完成升级、卸载、签名风险、迁移和第二台电脑验证，不再混入大型功能扩张。

## 发布策略

- GitHub 仓库只提交源码、文档、测试和构建脚本。
- EXE、MSI、NSIS 和校验文件通过 GitHub Release 分发。
- 用户数据、生成图片、凭据和本机构建目录不进入源码仓库。
- 当前发布为预发布版本，正式稳定版计划在完成发布与迁移验证后提供。

## 许可

本仓库当前未附独立开源许可证。在许可证补齐前，请勿默认将源码视为可自由复制、修改或再分发。
