# VisionHub Studio

VisionHub Studio 是一个桌面优先的多 Provider AI 图片创作工作台，当前以 Tauri + React + TypeScript + Vite 实现。项目目标是把 GPT Image、OpenAI-compatible 中转、自定义 Provider，以及后续 Nano Banana / Grok / Seedream / 即梦 / 豆包 / 可灵等在线生图能力统一到一个本地软件里。

> 说明：本仓库只保存源码、配置、脚本和文档；不会提交 API Key、生成图片、个人 AppData 数据、`node_modules`、`dist` 或 `src-tauri/target` 构建产物。

## 当前功能

- AI 创作工作台
  - 文生图
  - 图生图
  - 最多 4 张参考图
  - 本地选择参考图
  - 拖拽添加参考图
  - 剪贴板粘贴参考图
  - 一键清空参考图
  - 生成后的“最近画面”可一键作为参考
- Provider / 模型配置
  - OpenAI-compatible 配置
  - Base URL、模型、协议、额外 Headers
  - API Key 通过桌面端系统凭据保存，不写入仓库
- 本地作品画廊
  - 文生图 / 图生图 / 有参考图筛选
  - 成功 / 失败筛选
  - Provider 筛选
  - 时间筛选：今天、近 7 天、近 30 天
  - 图生图记录显示参考图数量和参考来源
  - 图片预览、复制 Prompt、复制路径、打开文件夹
  - 删除图册记录，但不删除磁盘图片文件
- 图片预览
  - AI 创作和作品画廊各自独立预览状态
  - 滚轮缩放
  - 拖拽移动
  - 点击空白关闭
- 桌面体验
  - 浅色 / 深色主题
  - 可折叠侧边栏
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
├─ package.json
└─ vite.config.ts
```

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
git add .
git commit -m "chore: sync latest VisionHub Studio work"
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

- 版本：0.1.0
- 平台：Windows 优先
- 发布形态：本地自用 release exe / MSI / NSIS 安装包
- 签名状态：未签名；对外发布前需要代码签名，否则 Windows SmartScreen 可能提示未知发布者。

## 后续路线

- 图生图高级参数按 Provider 能力显示
- 自定义中转图生图协议配置
- 更多 Provider 接入：Nano Banana / Grok / Seedream / 即梦 / 豆包 / 可灵
- 参考图来源详情查看
- 图册批量管理与导出
- 更完整的 Provider 能力矩阵和错误诊断
