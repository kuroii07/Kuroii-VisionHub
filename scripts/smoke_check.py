from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
required = [
    "package.json",
    "index.html",
    "src/main.tsx",
    "src/ui/App.tsx",
    "src/ui/styles.css",
    "src/services/appSettings.ts",
    "src/services/promptAssist.ts",
    "src/services/promptTemplates.ts",
    "src/services/freePlatforms.ts",
    "src/domain/providerTypes.ts",
    "src/providers/manifests.ts",
    "src/providers/registry.ts",
    "src/providers/mockAdapter.ts",
    "src/providers/openaiImagesAdapter.ts",
    "src/providers/tauriOpenAIAdapter.ts",
    "src/store/useStudioStore.ts",
    "src/services/desktopApi.ts",
    "src/ui/GeneratePage.tsx",
    "src/ui/PromptAssistModal.tsx",
    "src-tauri/tauri.conf.json",
    "src-tauri/Cargo.toml",
    "docs/provider-contract.md",
    "docs/roadmap.md",
    "planning/product-overview.svg",
]

missing = [path for path in required if not (ROOT / path).exists()]
if missing:
    raise SystemExit(f"Missing required files: {missing}")

package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
assert package["name"] == "visionhub-studio"
assert "tauri:dev" in package["scripts"]

manifest_src = (ROOT / "src/providers/manifests.ts").read_text(encoding="utf-8")
for provider_id in [
    "openai-gpt-image",
    "custom-http-provider",
    "comfyui-local",
    "gemini-image",
]:
    assert provider_id in manifest_src, f"Provider missing: {provider_id}"
for term in ["promptPolish", "textModels", "gpt-4o-mini", "中转站文本模型"]:
    assert term in manifest_src, f"Provider prompt polish capability missing: {term}"

app_src = (ROOT / "src/ui/App.tsx").read_text(encoding="utf-8")
for term in ["平台接入", "AI 创作", "Base URL", "API Key"]:
    assert term in app_src, f"UI term missing: {term}"
assert "AI 生图工作台" in app_src and "AI image workspace" in app_src, "Brand subtitle should support zh/en shell labels"
for term in [
    "loadAppSettings",
    "saveAppSettings",
    "PRIMARY_ACCENT_OPTIONS",
    "GENERATOR_ACCENT_OPTIONS",
    "DEFAULT_SIZE_OPTIONS",
    "DEFAULT_COUNT_OPTIONS",
    "OUTPUT_FORMAT_OPTIONS",
    "PROMPT_HISTORY_LIMIT_OPTIONS",
    "PROMPT_POLISH_ENGINE_OPTIONS",
    "PROMPT_POLISH_SECRET_ID",
    "PROMPT_POLISH_LANGUAGE_OPTIONS",
    "PROMPT_POLISH_STRENGTH_OPTIONS",
    "PROMPT_POLISH_PROTOCOL_OPTIONS",
    "STARTUP_PAGE_OPTIONS",
    "REFRESH_INTERVAL_OPTIONS",
    "LANGUAGE_OPTIONS",
    "DEFAULT_REFERENCE_ROLE_OPTIONS",
    "FILE_NAMING_RULE_OPTIONS",
    "settings.startupPage",
    "settings.refreshIntervalSeconds",
    "settings.sidebarCollapsed",
    "settings.compactMode",
    "settings.language",
    "settings.savePreferences",
    "settings.homeModules",
    "updateGenerationDefaults",
    "updatePromptHistory",
    "updateSavePreferences",
    "updateHomeModules",
    "默认生成模式",
    "默认参考图角色",
    "默认平台与模型",
    "首页模块",
    "作品保存偏好",
    "复用记录策略",
    "默认润色模式",
    "提示词润色引擎",
    "提示词润色专用配置",
    "DeepSeek",
    "保存润色配置",
    "refreshPromptPolishModels",
    "modelOptions",
    "语言、强度与协议",
    "updatePromptPolish",
    "savePromptPolishSecret",
    "getPolishModesForEngine",
    "onOpenLibraryDirectory",
    "onOpenAppDataDirectory",
    "onExportSettingsBackup",
    "settingsMessage",
]:
    assert term in app_src, f"Settings interaction missing: {term}"

for term in [
    "libraryGridV2",
    "libraryFloatingDock",
    "libraryDetailDrawer",
    "LibraryViewMode",
    "LibrarySortMode",
    "LibraryMetaMap",
    "toggleFavorite",
    "quickFilters",
    "shapeFilter",
    "formatFilter",
    "ratingFilter",
    "providerFilter",
    "statusFilter",
    "copyText",
    "revealGenerationFile",
]:
    assert term in app_src, f"Library v2 interaction missing: {term}"

generate_src = (ROOT / "src/ui/GeneratePage.tsx").read_text(encoding="utf-8")
for term in [
    "PromptAssistModal",
    "PromptAssistMode",
    "setAssistMode",
    "applyAssistedPrompt",
    "onApplyPrompt={applyAssistedPrompt}",
    "setAssistMode('inspiration')",
    "setAssistMode('polish')",
    "setAssistMode('reuse')",
    "defaultMode",
    "defaultOutputFormat",
    "promptHistorySettings",
    "promptPolishSettings",
    "effectivePromptPolishSettings",
    "promptPolishQuickGroup",
    "quickPolishOptions",
]:
    assert term in generate_src, f"Generate page prompt assist missing: {term}"

prompt_assist_src = (ROOT / "src/services/promptAssist.ts").read_text(encoding="utf-8")
for term in [
    "PromptAssistMode",
    "INSPIRATION_TEMPLATES",
    "POLISH_MODES",
    "renderInspirationPrompt",
    "polishPrompt",
    "PROMPT_STYLE_PRESETS",
    "applyPromptStyle",
]:
    assert term in prompt_assist_src, f"Prompt assist service missing: {term}"

prompt_assist_modal_src = (ROOT / "src/ui/PromptAssistModal.tsx").read_text(encoding="utf-8")
for term in [
    "InspirationPanel",
    "PolishPanel",
    "ReusePanel",
    "PromptHistorySettings",
    "PromptPolishSettings",
    "polishPromptWithProvider",
    "polishModelOptions",
    "onModelChange",
    "本地规则润色",
    "开始模型重写",
    "模型润色失败",
    "结构化重写",
    "includeFailed",
    "showThumbnails",
    "maxItems",
    "PromptPreview",
    "PROMPT_STYLE_PRESETS",
    "promptPolishConfigId",
    "画风/风格",
    "AssistActions",
    "reuseRecordList",
]:
    assert term in prompt_assist_modal_src, f"Prompt assist modal missing: {term}"

generate_page_src = (ROOT / "src/ui/GeneratePage.tsx").read_text(encoding="utf-8")
for term in [
    "resolveActivePromptPolishConfigId",
    "quickPolishConfigId",
    "promptPolishConfigId",
    "promptPolishConfigOptions",
]:
    assert term in generate_page_src, f"Generate page prompt polish sync missing: {term}"

for term in [
    "PromptTemplatesPage",
    "loadPromptTemplates",
    "PROMPT_TEMPLATE_CATEGORIES",
    "templateToolbar",
    "promptLibraryLayout",
    "promptTemplateDetail",
    "toggleTemplateFavorite",
    "markTemplateUsed",
    "copyTemplate",
    "onUseTemplate",
]:
    assert term in app_src, f"Prompt templates v2 interaction missing: {term}"

for term in [
    "FreeGenerationPage",
    "FREE_PLATFORMS",
    "免费平台",
    "onCopyPromptAndOpen",
    "openExternalUrl(platform.url)",
    "freePlatformMessage",
]:
    assert term in app_src, f"Free generation studio missing: {term}"

for term in [
    "ProviderDiagnosticItem",
    "runProviderDiagnostics",
    "mapProviderErrorMessage",
    "配置自检报告",
    "onRunDiagnostics",
    "onRunProfileConnectionTest",
    "onCopyConfig",
    "onCopyDiagnostics",
    "onImportConfig",
    "onPinModel",
    "isRunningDiagnostics",
    "isRunningTestGeneration",
    "runProviderTestGeneration",
    "generateOpenAIImage",
    "saveGenerationRecord",
    "测试生成",
    "provider-hub-test-generation",
    "diagnostics",
    "diagnosticsSummary",
    "providerAccessLayout",
    "平台类型",
    "服务模板",
    "OpenAI 兼容中转",
    "MiniMax 官方",
    "minimax-image",
    "/v1/image_generation",
    "Google Gemini / Nano Banana 官方",
    "gemini-image",
    "/v1beta/models/{model}:generateContent",
    "小米 MiMo 官方",
    "图像理解",
    "providerServiceRegionLabel",
    "sortRank",
    "serviceTemplateMeta",
    "本地规划",
    "serviceTemplateId",
]:
    assert term in app_src, f"Provider diagnostics v1 missing: {term}"
brand_block = app_src.split('<div className="brand">', 1)[1].split('<nav className="navGroup">', 1)[0]
footer_block = app_src.split('<div className="sidebarFooter">', 1)[1].split("</div>", 1)[0]
assert "sidebarCollapseButton" not in brand_block, "Collapse button should not stay in the brand area"
assert "sidebarCollapseButton" in footer_block, "Collapse button should live in sidebar footer"

settings_src = (ROOT / "src/services/appSettings.ts").read_text(encoding="utf-8")
for term in [
    "visionhub.app.settings",
    "startupPage",
    "sidebarCollapsed",
    "primaryAccent",
    "generatorAccent",
    "language",
    "compactMode",
    "'free'",
    "AppLanguage",
    "GenerationDefaults",
    "DefaultReferenceRole",
    "PromptHistorySettings",
    "SavePreferences",
    "HomeModuleSettings",
    "DEFAULT_SIZE_OPTIONS",
    "DEFAULT_COUNT_OPTIONS",
    "OUTPUT_FORMAT_OPTIONS",
    "DEFAULT_REFERENCE_ROLE_OPTIONS",
    "FILE_NAMING_RULE_OPTIONS",
    "LANGUAGE_OPTIONS",
    "PROMPT_HISTORY_LIMIT_OPTIONS",
    "PromptPolishSettings",
    "PROMPT_POLISH_ENGINE_OPTIONS",
    "PROMPT_POLISH_LANGUAGE_OPTIONS",
    "PROMPT_POLISH_STRENGTH_OPTIONS",
    "PROMPT_POLISH_PROTOCOL_OPTIONS",
    "generationDefaults",
    "promptHistory",
    "promptPolish",
    "savePreferences",
    "homeModules",
]:
    assert term in settings_src, f"App settings persistence missing: {term}"

free_platform_src = (ROOT / "src/services/freePlatforms.ts").read_text(encoding="utf-8")
for term in ["FREE_PLATFORMS", "doubao", "jimeng", "kling", "qwen", "chatgpt", "grok", "gemini", "tongyi-wanxiang", "liblib", "seaart"]:
    assert term in free_platform_src, f"Free platform missing: {term}"

prompt_templates_src = (ROOT / "src/services/promptTemplates.ts").read_text(encoding="utf-8")
for term in ["DEFAULT_PROMPT_TEMPLATES", "PROMPT_TEMPLATE_CATEGORIES", "visionhub.prompt.templates"]:
    assert term in prompt_templates_src, f"Prompt template service missing: {term}"

provider_config_src = (ROOT / "src/services/providerConfig.ts").read_text(encoding="utf-8")
for term in [
    "PROVIDER_CONFIG_PRESETS",
    "applyProviderConfigPreset",
    "serializeProviderConfig",
    "parseProviderConfigImport",
    "normalizeProviderConfig",
]:
    assert term in provider_config_src, f"Provider config preset/import helper missing: {term}"

desktop_api_src = (ROOT / "src/services/desktopApi.ts").read_text(encoding="utf-8")
for term in ["revealAppDataDir", "revealLibraryDir", "exportSettingsBackup", "getAppPaths", "openExternalUrl", "polishPromptWithProvider"]:
    assert term in desktop_api_src, f"Desktop settings API missing: {term}"

store_src = (ROOT / "src/store/useStudioStore.ts").read_text(encoding="utf-8")
for term in ["validateGenerationRequest", "请先在平台接入设置 Base URL", "not-configured"]:
    assert term in store_src, f"Generation preflight missing: {term}"

manifests_src = (ROOT / "src/providers/manifests.ts").read_text(encoding="utf-8")
for term in ["minimax-image", "MiniMax API Key", "image-01-live", "gemini-image", "Gemini API Key", "gemini-2.5-flash-image", "imageToImage: 'partial'"]:
    assert term in manifests_src, f"Provider manifest missing: {term}"

tauri_src = (ROOT / "src-tauri/src/main.rs").read_text(encoding="utf-8")
for term in ["get_app_paths", "reveal_app_data_dir", "reveal_library_dir", "export_settings_backup", "open_external_url", "polish_prompt_with_provider", "PromptPolishRequest", "extract_text_response", "prompt_polish_mode_rules", "ensure_prompt_polish_changed", "generate_minimax_image", "visionhub_minimax_request", "visionhub_minimax_diagnostic", "subject_reference", "build_minimax_subject_reference", "generate_gemini_image", "visionhub_gemini_request", "visionhub_gemini_diagnostic", "gemini_reference_part", "inlineData", "sanitize_generation_record_raw", "visionhub_redacted_image_payload"]:
    assert term in tauri_src, f"Tauri settings command missing: {term}"

styles_src = (ROOT / "src/ui/styles.css").read_text(encoding="utf-8")
for selector in [
    ".appShell.theme-light .providerDirectory",
    ".appShell.theme-light .settingsPanel",
    ".appShell.theme-light .systemSettingsPage",
    ".appShell .sidebarFooter",
    ".appShell.sidebarCollapsed .sidebarCollapseButton",
    ".appShell .brandText span",
    ".appShell.sidebarCollapsed .sidebarFooter .sidebarCollapseButton",
    ".settingsTallRow",
    ".settingsInlineGrid",
    ".settingsInlineGrid.triple",
    ".settingsBooleanGrid",
    ".settingsBooleanGrid button",
    ".settingsBooleanGrid button.active",
    ".settingsTogglePill",
    ".settingsNotice",
    ".libraryFloatingDock",
    ".libraryDockBar",
    ".libraryDockPanel",
    ".libraryGridV2",
    ".libraryCardV2",
    ".libraryDetailDrawer",
    ".libraryGrid",
    ".libraryCard",
    ".templateToolbar",
    ".templateGrid",
    ".templateCard",
    ".providerDiagnostics",
    ".diagnosticsActions",
    ".rowActionButton.primaryAction",
    ".diagnosticsItem",
    ".providerConfigActions",
    ".diagnosticsSummary",
    ".freeToolbar",
    ".freePlatformGrid",
    ".freePlatformCard",
    ".freePlatformLogo",
    ".promptAssistBackdrop",
    ".promptAssistWindow",
    ".promptAssistHeader",
    ".promptAssistClose",
    ".promptAssistBody.twoColumn",
    ".promptAssistBody.singleColumn",
    ".assistTemplateList",
    ".assistDetailPanel",
    ".assistFieldGrid",
    ".promptPreviewBox",
    ".assistActionRow",
    ".polishModeRow",
    ".polishEngineBar",
    ".polishCompareGrid",
    ".reuseSearch",
    ".reuseRecordList",
    ".reuseRecordCard",
    ".reuseNoImage",
    ".assistEmpty",
]:
    assert selector in styles_src, f"Remote UI hardening selector missing: {selector}"

svg = (ROOT / "planning/product-overview.svg").read_text(encoding="utf-8")
assert re.search(r"VisionHub Studio", svg)
print("Smoke check passed: VisionHub Studio scaffold is complete.")
