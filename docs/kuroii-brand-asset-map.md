# Kuroii VisionHub 品牌资产映射

Status: v0.5.1 brand integration baseline
Date: 2026-07-08

## 产品归属

- 产品显示名：`Kuroii VisionHub`
- 产品副标题：`AI Image Workflow Studio`
- 归属：`Kuroii Tools` / Desktop AI image workflow tool
- 关系：可作为 Kuroii Motion AI 创作流程中的 AI 图像工作台，但本产品不是 Motion / Video-first 工具。

## 兼容与安全边界

- Tauri `identifier` 继续保持 `studio.visionhub.app`，用于保留当前 AppData、画廊、历史、Provider profile 和系统凭据绑定。
- 不修改 Provider 协议、生成记录结构、API Key 存储、`profile:<profileId>`、`prompt-polish:default` 或 `image-reverse:default`。
- 不清空、不迁移、不重置用户历史、画廊、配置、缓存或凭据。

## Kuroii Cat 使用级别

| 级别 | 使用位置 | 说明 |
| --- | --- | --- |
| L0 | API Key、Raw 响应、批量危险操作、诊断明细 | 避免角色遮挡专业/风险信息 |
| L1 | Sidebar、状态提示、Provider 接入状态 | 默认克制使用 Kuroii app icon |
| L2 | 空状态、帮助、成功、轻量错误 | 当前仅准备 expression 资产，不强行插入主界面 |
| L3 | 首页 Hero、首次启动、更新说明 | 当前准备真实 pose 资产，后续按页面需要使用 |

## 已复制 / 派生资产

| Kuroii 源资产 | VisionHub 项目路径 | Size bytes | Image | SHA256 | 备注 |
| --- | --- | ---: | --- | --- | --- |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_标准版_app_icon_standard_v1.0_approved.png` | `src/ui/assets/kuroii/icon/kuroii-app-icon-standard.png` | 389545 | 1254x1254 | `6F5F1857A553BA4C1ACA249AB0703268DF21412D57C82114428C8013DEE89427` | Desktop/UI standard icon source |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_透明背景_app_icon_transparent_v1.0_approved.png` | `src/ui/assets/kuroii/icon/kuroii-app-icon-transparent.png` | 717467 | 1254x1254 | `C39A8F37EA1E389DAC6C2170821660CA77DAD50D3C7D3CCA2E95CEA136666182` | Transparent app logo for sidebar mark |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_反色版_app_icon_inverted_v1.0_approved.png` | `src/ui/assets/kuroii/icon/kuroii-app-icon-inverted.png` | 388092 | 1254x1254 | `63C39E7C0C62D3C50EB7E0A7866F26A5F7200BA7A170455EEC3A32E47AE47792` | Inverted icon retained for future dark/light mapping |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/06_ICO图标_ico_files/Kuroii_应用图标_多尺寸_app_icon_multi_v1.0_approved.ico` | `src-tauri/icons/icon.ico` | 67425 | 256x256 | `CA59016F16B300FE370F13B0E27F38FF1882A8A97F827F8F917CA5B9D14A122D` | Tauri Windows ICO |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_标准版_app_icon_standard_v1.0_approved.png` | `src-tauri/icons/icon.png` | 389545 | 1254x1254 | `6F5F1857A553BA4C1ACA249AB0703268DF21412D57C82114428C8013DEE89427` | Tauri source icon |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_标准版_app_icon_standard_v1.0_approved.png` | `src-tauri/icons/visionhub-logo.png` | 389545 | 1254x1254 | `6F5F1857A553BA4C1ACA249AB0703268DF21412D57C82114428C8013DEE89427` | Legacy filename kept for compatibility with existing project paths |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_透明背景_app_icon_transparent_v1.0_approved.png` | `src/ui/assets/visionhub-logo.png` | 717467 | 1254x1254 | `C39A8F37EA1E389DAC6C2170821660CA77DAD50D3C7D3CCA2E95CEA136666182` | Legacy UI logo filename now mapped to Kuroii app icon |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_透明背景_app_icon_transparent_v1.0_approved.png` | `src-tauri/icons/kuroii-app-icon-transparent.png` | 717467 | 1254x1254 | `C39A8F37EA1E389DAC6C2170821660CA77DAD50D3C7D3CCA2E95CEA136666182` | Explicit Kuroii transparent icon copy |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_标准版_app_icon_standard_v1.0_approved.png` | `src-tauri/icons/icon-16.png` | 3227 | 16x16 | `1FEFCE65D870A64768E4AFECC173CED7504D457DC6DB3F52CA03EBE46005CB1B` | Derived 16px Tauri icon |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_标准版_app_icon_standard_v1.0_approved.png` | `src-tauri/icons/icon-32.png` | 4104 | 32x32 | `704BC8CE0D7D79BDEDE2F22EC90E49A8C310AE0A6CDFB78BEE3C03559397BF2A` | Derived 32px Tauri icon |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_标准版_app_icon_standard_v1.0_approved.png` | `src-tauri/icons/icon-48.png` | 5109 | 48x48 | `CAF851BDB9D3DED3DF6E0650BC2D6CAAAC87A90DDA84D27CB61212467260B7D7` | Derived 48px Tauri icon |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_标准版_app_icon_standard_v1.0_approved.png` | `src-tauri/icons/icon-64.png` | 6206 | 64x64 | `57D7129EE7626E6455BBA4104407DBB1C1D42AFC4BCC925EFD43A9712BA141FA` | Derived 64px Tauri icon |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_标准版_app_icon_standard_v1.0_approved.png` | `src-tauri/icons/icon-128.png` | 12728 | 128x128 | `EE8336C80C6F19DDB6A0758E510F2217D208015313B08F0F9F5646BA0F1950EC` | Derived 128px Tauri icon |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_标准版_app_icon_standard_v1.0_approved.png` | `src-tauri/icons/icon-256.png` | 35949 | 256x256 | `425F8F407CEAC58E64ED674DE08E903FC1F6FEA80881CFB3C3D213ABB83C81BF` | Derived 256px Tauri icon |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_标准版_app_icon_standard_v1.0_approved.png` | `src-tauri/icons/installer-header.bmp` | 25818 | 150x57 | `C9539B7908DAE753790D5023BEFF842C091F020E1E20CE5C69903F6360C5DA92` | Derived NSIS installer header placeholder |
| `01_品牌资产_Brand_Assets/02_图标Icon_icon/01_应用图标_app_icon/Kuroii_应用图标_标准版_app_icon_standard_v1.0_approved.png` | `src-tauri/icons/installer-sidebar.bmp` | 154542 | 164x314 | `3AAB1CB485BE769520D6D990F92C19C40A4F608E9B32146A3591FE4AAF7CBC80` | Derived NSIS installer sidebar placeholder |
| `02_IP角色资产_IP_Assets/01_Kuroii小猫_kuroii_cat/03_表情_expressions/专注.png` | `src/ui/assets/kuroii/mascot/kuroii-cat-focus.png` | 998277 | 1254x1254 | `14255AD7F7A7A124718F3AD446F6C33FE293C0DB03AF159B0E9A3F051B972CD1` | Focus/thinking assistant state |
| `02_IP角色资产_IP_Assets/01_Kuroii小猫_kuroii_cat/03_表情_expressions/完成.png` | `src/ui/assets/kuroii/mascot/kuroii-cat-success.png` | 965506 | 1254x1254 | `823A02B216C8EF70638979F5DCB4F5B444AEF12213445CC45C6AE56CBD43F1A5` | Success/completed assistant state |
| `02_IP角色资产_IP_Assets/01_Kuroii小猫_kuroii_cat/03_表情_expressions/警告.png` | `src/ui/assets/kuroii/mascot/kuroii-cat-warning.png` | 1164591 | 1254x1254 | `9DE14F89604D378E0681F01CDDA70CF334E412E540D1B4AD98FB08AA97A69E95` | Warning state, for low-risk helper surfaces only |
| `02_IP角色资产_IP_Assets/01_Kuroii小猫_kuroii_cat/03_表情_expressions/休息.png` | `src/ui/assets/kuroii/mascot/kuroii-cat-idle.png` | 826417 | 1254x1254 | `2FF45C46BE5013E809BD0A178CC6EB7295D0F0551BF08A68D83B1254D15E9230` | Idle/rest state |
| `02_IP角色资产_IP_Assets/01_Kuroii小猫_kuroii_cat/03_表情_expressions/开心01.png` | `src/ui/assets/kuroii/mascot/kuroii-cat-happy.png` | 751698 | 1254x1254 | `734845D6386911B452C340B5248316C7E3D580F25C23816F32CE12A5CFCFA94A` | Happy/positive state |
| `02_IP角色资产_IP_Assets/01_Kuroii小猫_kuroii_cat/03_表情_expressions/疑惑01.png` | `src/ui/assets/kuroii/mascot/kuroii-cat-question.png` | 1004758 | 1254x1254 | `756585D12E878167794050FC5E2AE915A12F701630E8F575EAA3CFA1B4BE7061` | Question/help state |
| `02_IP角色资产_IP_Assets/01_Kuroii小猫_kuroii_cat/04_动作_poses/介绍展示.png` | `src/ui/assets/kuroii/poses/kuroii-cat-hero.png` | 847072 | 1524x1524 | `4E9C6FC5727575418D5CEA6705C325876B1CCC616246F6994CCAC93F6BA080DA` | L3 hero/onboarding pose |
| `02_IP角色资产_IP_Assets/01_Kuroii小猫_kuroii_cat/04_动作_poses/轻问候.png` | `src/ui/assets/kuroii/poses/kuroii-cat-welcome.png` | 1483073 | 1254x1254 | `99D1EC0D86161F63E6B030420850D0AAF2D3312D8478965A93D26690A3168234` | L3 welcome pose |

## 当前缺口 / 后续建议

- 横版 Logo、专用 Hero Banner、更新页插画暂未单独设计；当前用 approved app icon 作为第一阶段品牌入口。
- `installer-header.bmp` 与 `installer-sidebar.bmp` 是基于 approved app icon 派生的安装器占位图，后续可以补做专用安装器 KV。
- 视觉插画和 Kuroii Cat 后续应优先用于空状态、欢迎页、更新页，避免挤占 AI 创作台和 Provider 参数区。
