from pathlib import Path
import json
import re
import runpy

ROOT = Path(__file__).resolve().parents[1]


def source_between(source: str, start_marker: str, end_marker: str, label: str) -> str:
    start = source.find(start_marker)
    end = source.find(end_marker, start)
    assert start >= 0 and end > start, f"{label} source block should be present"
    return source[start:end]


required = [
    "package.json",
    "index.html",
    "src/main.tsx",
    "src/ui/App.tsx",
    "src/ui/ImagePreviewModal.tsx",
    "src/ui/generationRecordPresentation.ts",
    "src/ui/library/LibraryPage.tsx",
    "src/ui/library/libraryModel.ts",
    "src/ui/urlSearch.ts",
    "src/ui/styles.css",
    "src/services/appSettings.ts",
    "src/services/promptAssist.ts",
    "src/services/promptTemplates.ts",
    "src/services/freePlatforms.ts",
    "src/services/providerDiagnostics.ts",
    "src/services/providerDisplay.ts",
    "src/domain/batchQueueTypes.ts",
    "src/domain/providerTypes.ts",
    "src/services/batchQueue.ts",
    "src/services/batchQueueExecutor.ts",
    "src/providers/manifests.ts",
    "src/providers/registry.ts",
    "src/providers/mockAdapter.ts",
    "src/providers/openaiImagesAdapter.ts",
    "src/providers/tauriOpenAIAdapter.ts",
    "src/store/useStudioStore.ts",
    "src/services/desktopApi.ts",
    "src/ui/GeneratePage.tsx",
    "src/ui/PromptAssistModal.tsx",
    "scripts/ui_qa_check.py",
    "src-tauri/tauri.conf.json",
    "src-tauri/Cargo.toml",
    "docs/provider-contract.md",
    "docs/roadmap.md",
    "planning/product-overview.svg",
]

missing = [path for path in required if not (ROOT / path).exists()]
if missing:
    raise SystemExit(f"Missing required files: {missing}")

ui_qa = runpy.run_path(str(ROOT / "scripts/ui_qa_check.py"))
ui_qa["main"]()

package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
assert package["name"] == "visionhub-studio"
assert "tauri:dev" in package["scripts"]

manifest_src = (ROOT / "src/providers/manifests.ts").read_text(encoding="utf-8")
for provider_id in [
    "openai-gpt-image",
    "custom-http-provider",
    "comfyui-local",
    "sd-webui-local",
    "gemini-image",
]:
    assert provider_id in manifest_src, f"Provider missing: {provider_id}"
for term in ["promptPolish", "textModels", "gpt-4o-mini", "中转站文本模型"]:
    assert term in manifest_src, f"Provider prompt polish capability missing: {term}"

app_src = (ROOT / "src/ui/App.tsx").read_text(encoding="utf-8")
image_preview_src = (ROOT / "src/ui/ImagePreviewModal.tsx").read_text(encoding="utf-8")
library_page_src = (ROOT / "src/ui/library/LibraryPage.tsx").read_text(encoding="utf-8")
library_model_src = (ROOT / "src/ui/library/libraryModel.ts").read_text(encoding="utf-8")
library_src = f"{library_model_src}\n{library_page_src}"
i18n_src = (ROOT / "src/i18n/index.ts").read_text(encoding="utf-8")
provider_display_src = (ROOT / "src/services/providerDisplay.ts").read_text(encoding="utf-8")
provider_diagnostics_src = (ROOT / "src/services/providerDiagnostics.ts").read_text(encoding="utf-8")
ui_terms = ["\u5e73\u53f0\u63a5\u5165", "AI \u521b\u4f5c", "Base URL", "API Key"]
for term in ui_terms:
    assert term in app_src or term in i18n_src, f"UI term missing: {term}"
assert "AI 图片工作台" in i18n_src, "Chinese brand subtitle should stay localized"
assert "AI Image Workflow Studio" in i18n_src, "English brand subtitle should stay localized"
home_page_src = source_between(app_src, "function WorkspaceHomePage", "function PromptTemplatesPage", "Workspace home page")
assert "props.homeModules.roadmap" not in home_page_src, "Workspace home should not re-render the removed roadmap module"
assert "home.route.label" not in home_page_src, "Workspace home should not show the removed roadmap strip"

assert "convertFileSrc" in (ROOT / "src/services/desktopApi.ts").read_text(encoding="utf-8"), "Local image display should use Tauri file URLs instead of startup base64 hydration"
main_rs = (ROOT / "src-tauri/src/main.rs").read_text(encoding="utf-8")
assert "compact_generation_record_for_history" in main_rs, "History records should be compacted before persistence"
assert "changed |= hydrate_record_image_urls(&app, record)" not in main_rs, "History load should not hydrate every local image into base64 at startup"
assert "fn is_external_image_url" in main_rs and "asset.localhost" in main_rs, "Reference submission must not treat Tauri asset.localhost preview URLs as external images"
request_url_source = source_between(
    main_rs,
    "async fn reference_image_to_request_url",
    "async fn reference_image_to_bytes",
    "Reference URL conversion function",
)
assert request_url_source.find("reference.local_path") < request_url_source.find(".preview_url"), "Reference URL conversion should prefer local_path over preview_url"
assert ".filter(|url| is_external_image_url(url))" in request_url_source, "Reference URL conversion should only download real external preview URLs"
bytes_source = source_between(
    main_rs,
    "async fn reference_image_to_bytes",
    "fn is_external_image_url",
    "Reference byte conversion function",
)
assert bytes_source.find("reference.local_path") < bytes_source.find(".preview_url"), "Reference byte conversion should prefer local_path over preview_url"
assert ".filter(|url| is_external_image_url(url))" in bytes_source, "Reference byte conversion should only download real external preview URLs"
assert 'else if protocol == "images"' in main_rs and '"openai-images-edit".to_string()' in main_rs, "Images protocol auto image-to-image should use OpenAI Images edits instead of JSON image/images"
assert "if (config.protocol === 'images') return 'openai-images-edit';" in provider_display_src, "Provider UI should show the same Images auto image-to-image mapping as the backend"
for helper in [
    "function providerUsesConfig",
    "function providerSupportsOpenAICompatibleModelList",
    "function officialFixedModelOptions",
    "function buildMiniMaxManualModelProbe",
    "function buildGeminiManualModelProbe",
    "function modelListUnsupportedMessage",
    "function defaultBaseUrlPlaceholder",
    "function defaultEndpointPlaceholder",
    "function providerEndpointHint",
    "function protocolLabel",
    "function imageToImageAdapterLabel",
    "function providerEndpointPreview",
    "function endpointRiskHint",
    "function referenceSubmissionHint",
]:
    assert helper in provider_display_src, f"Provider display helper should live in providerDisplay.ts: {helper}"
    assert helper not in app_src, f"Provider display helper should not be redefined in App.tsx: {helper}"
for helper in [
    "function buildProviderReadinessItems",
    "function buildGenerationUsageReadinessItem",
    "function buildOfflineDiagnosticSummary",
    "function providerErrorText",
    "function isModelListUnavailableError",
    "function formatModelListFallbackMessage",
    "function mapProviderErrorMessage",
    "function buildProviderStabilityDiagnosticItems",
    "function providerCostRiskHint",
]:
    assert helper in provider_diagnostics_src, f"Provider diagnostics helper should live in providerDiagnostics.ts: {helper}"
    assert helper not in app_src, f"Provider diagnostics helper should not be redefined in App.tsx: {helper}"
generate_src = (ROOT / "src/ui/GeneratePage.tsx").read_text(encoding="utf-8")
generate_label_src = source_between(generate_src, "const effectiveActiveGeneratingMode", "const failedLatest", "Generate button label")
assert "activeGeneratingMode ?? activeGeneratingModeRef.current" in generate_label_src, "Generate button label should use the synchronous active mode fallback"
assert "props.isGenerating && effectiveActiveGeneratingMode === currentGenerationMode" in generate_label_src, "Generate button should compare against the current panel mode"
generate_run_src = source_between(generate_src, "function runGenerate()", "function addToBatchQueue()", "Generate submit handler")
assert "activeGeneratingModeRef.current = 'image-to-image';" in generate_run_src, "Image-to-image submit should set active mode before generation starts"
assert "activeGeneratingModeRef.current = 'text-to-image';" in generate_run_src, "Text-to-image submit should set active mode before generation starts"
assert "activeGeneratingModeRef.current = null;" in generate_src, "Generate button active mode should reset after generation finishes"
assert "import { CachedLibraryPage } from './library/LibraryPage';" in app_src, "App shell should mount the extracted library module"
assert "const LibraryPage" not in app_src and "const LibraryPage" in library_page_src, "Library page should live outside App.tsx"
assert "const ImagePreviewModal" not in app_src and "const ImagePreviewModal" in image_preview_src, "Shared image preview should live outside App.tsx"
assert not re.search(r"from\s+['\"].*App['\"]", library_src), "Library modules must not import App.tsx"
assert len(app_src.splitlines()) < 11000, "App.tsx should stay below the post-extraction size guard"
assert "const LIBRARY_INITIAL_RENDER_COUNT = 18;" in library_model_src, "Library initial render should stay small for large local image galleries"
assert "const LIBRARY_RENDER_BATCH_SIZE = 18;" in library_model_src, "Library thumbnail batches should stay incremental"
assert "IntersectionObserver" in library_page_src and "library.performance.loadMore" in library_page_src, "Library needs scroll/manual incremental thumbnail loading"
assert "requestIdleCallback(run" in library_page_src, "Library color analysis should run during idle time instead of thumbnail load hot path"
assert "prepare_library_thumbnails" in main_rs and "library-thumbnails-v1" in main_rs, "Library should generate real cached thumbnails in AppData"
assert "is_allowed_library_image_path(app, &source)" in main_rs, "Thumbnail generation must stay inside the configured library scope"
assert "file_name.starts_with(\"thumb-\")" in main_rs and "LIBRARY_THUMBNAIL_CACHE_MAX_FILES" in main_rs, "Thumbnail cleanup must be limited to dedicated cache files"
assert "prepareLibraryThumbnails" in (ROOT / "src/services/desktopApi.ts").read_text(encoding="utf-8"), "Desktop API should expose typed thumbnail preparation"
assert "props.thumbnailPending ? undefined : props.thumbnail?.thumbnailUrl ?? imageUrl" in library_page_src, "Gallery cards should wait for cached thumbnails before falling back to original images"
assert "props.onPreview(props.record, imageUrl)" in library_page_src, "Gallery preview must continue opening the original image"
assert "createTranslator(appSettings.language)" in app_src, "App shell should use the shared i18n translator"
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
    "settings.defaultMode",
    "settings.defaultReferenceRole",
    "settings.defaultProviderModel",
    "settings.homeModules",
    "settings.savePreferences",
    "settings.reuseHistoryPolicy",
    "settings.defaultPolishMode",
    "settings.promptPolishEngine",
    "settings.promptPolishProviderProfile",
    "DeepSeek",
    "settings.savePolishConfig",
    "refreshPromptPolishModels",
    "modelOptions",
    "settings.languageStrengthProtocol",
    "updatePromptPolish",
    "savePromptPolishSecret",
    "getPolishModesForEngine",
    "onOpenLibraryDirectory",
    "onOpenAppDataDirectory",
    "onOpenBackupsDirectory",
    "onExportMigrationGuide",
    "onExportSettingsBackup",
    "settingsMessage",
    "BatchQueuePage",
    "batch.title",
    "handleAddCurrentGenerationToBatchQueue",
    "createQueuedGenerationSnapshot",
    "loadBatchQueueStore",
    "summarizeBatchQueue",
    "onRefresh={refreshBatchQueueStore}",
    "executeQueuedGenerationTask",
    "requestExecuteBatchQueueTask",
    "executeBatchQueueTaskNow",
    "requestRequeueBatchQueueTask",
    "requestStartBatchQueue",
    "requestStopBatchQueue",
    "requestDeleteBatchQueueTask",
    "handleAddBatchVariantsToBatchQueue",
    "handleAddCompareGroupToBatchQueue",
    "createBatchQueueCompareGroup",
    "appendBatchQueueTasksAndCompareGroups",
    "compareGroupId",
    "visionhub_batch_variants",
    "batch-variants",
    "visionhub_model_compare",
    "visionhub_queue_retry",
    "batch.task.execute",
    "batch.task.execute",
    "batch.task.requeue",
    "batch.task.delete",
    "batch.action.pauseTitle",
]:
    assert term in app_src or term in i18n_src, f"Settings interaction missing: {term}"

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
    assert term in library_src, f"Library v2 interaction missing: {term}"

generate_src = (ROOT / "src/ui/GeneratePage.tsx").read_text(encoding="utf-8")
i18n_src = (ROOT / "src/i18n/index.ts").read_text(encoding="utf-8")
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
    "onAddToBatchQueue",
    "batchQueueTaskCount",
    "onAddBatchVariantsToBatchQueue",
    "batchToolsDialog",
    "batchVariantBox",
    "batchVariantRatioOption",
    "onAddCompareGroupToBatchQueue",
    "compareProfileBox",
    "quickQueueActions",
    "quickQueueButton",
    "t('generate.queue.add')",
    "t('generate.queue.tools')",
    "t('generate.ratio.title')",
]:
    assert term in generate_src, f"Generate page prompt assist missing: {term}"

for term in [
    "'generate.queue.add'",
    "'generate.queue.tools'",
    "'generate.ratio.title'",
]:
    assert term in i18n_src, f"Generate i18n prompt assist missing: {term}"

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
    "assist.polish.localTag",
    "assist.polish.runModel",
    "assist.polish.failed",
    "assist.polish.providerOn",
    "includeFailed",
    "showThumbnails",
    "maxItems",
    "PromptPreview",
    "PROMPT_STYLE_PRESETS",
    "promptPolishConfigId",
    "assist.polish.stylePlaceholder",
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
    "free.import.tag.freePlatform",
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
    "selectGenerationProfile",
    "changeGenerationModel",
    "onProfileChange",
    "配置实例”下拉中选择当前使用哪一个",
    "provider.protocol.images-minimal.label",
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
    "local-sd-webui",
    "diagnoseSdWebUIConnection",
    "generateSdWebUIImage",
    "Stable Diffusion WebUI / Forge",
    "settings.exportMigrationGuide",
    "settings.backupMigration",
    "sdWebUI",
    "samplerName",
    "cfgScale",
    "LoadImage",
    "referenceCount",
]:
    assert term in app_src or term in i18n_src, f"Provider diagnostics v1 missing: {term}"
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
for term in ["revealAppDataDir", "revealLibraryDir", "revealBackupsDir", "exportSettingsBackup", "getAppPaths", "openExternalUrl", "polishPromptWithProvider", "diagnoseSdWebUIConnection", "generateSdWebUIImage"]:
    assert term in desktop_api_src, f"Desktop settings API missing: {term}"

store_src = (ROOT / "src/store/useStudioStore.ts").read_text(encoding="utf-8")
for term in ["validateGenerationRequest", "请先在平台接入设置 Base URL", "not-configured"]:
    assert term in store_src, f"Generation preflight missing: {term}"

batch_queue_types_src = (ROOT / "src/domain/batchQueueTypes.ts").read_text(encoding="utf-8")
for term in [
    "BatchGenerationQueue",
    "BatchQueueTask",
    "QueuedGenerationRequestSnapshot",
    "profileId",
    "secretId",
    "referencePolicy",
]:
    assert term in batch_queue_types_src, f"Batch queue type missing: {term}"

batch_queue_src = (ROOT / "src/services/batchQueue.ts").read_text(encoding="utf-8")
for term in [
    "visionhub.batch.queues.v1",
    "createQueuedGenerationSnapshot",
    "createBatchQueueTask",
    "appendBatchQueueTasks",
    "compactReferenceImageForQueue",
    "embeddedImageData",
    "dataUrlOmitted",
]:
    assert term in batch_queue_src, f"Batch queue snapshot service missing: {term}"

batch_queue_executor_src = (ROOT / "src/services/batchQueueExecutor.ts").read_text(encoding="utf-8")
for term in [
    "executeQueuedGenerationTask",
    "executeNextBatchQueueTask",
    "snapshotToImageGenerationRequest",
    "generateOpenAIImage",
    "saveGenerationRecord",
    "visionhub_queue_task",
    "profileId",
    "secretId",
]:
    assert term in batch_queue_executor_src, f"Batch queue executor missing: {term}"

manifests_src = (ROOT / "src/providers/manifests.ts").read_text(encoding="utf-8")
for term in ["minimax-image", "MiniMax API Key", "image-01-live", "gemini-image", "Gemini API Key", "gemini-2.5-flash-image", "sd-webui-local", "sd-webui-txt2img", "imageToImage: 'partial'"]:
    assert term in manifests_src, f"Provider manifest missing: {term}"

tauri_src = (ROOT / "src-tauri/src/main.rs").read_text(encoding="utf-8")
for term in ["get_app_paths", "reveal_app_data_dir", "reveal_library_dir", "reveal_backups_dir", "export_settings_backup", "open_external_url", "diagnose_sd_webui_connection", "generate_sd_webui_image", "sampler_name", "cfg_scale", "upload_comfyui_reference_image", "load_image_nodes", "polish_prompt_with_provider", "PromptPolishRequest", "extract_text_response", "prompt_polish_mode_rules", "ensure_prompt_polish_changed", "generate_minimax_image", "visionhub_minimax_request", "visionhub_minimax_diagnostic", "subject_reference", "build_minimax_subject_reference", "generate_gemini_image", "visionhub_gemini_request", "visionhub_gemini_diagnostic", "gemini_reference_part", "inlineData", "sanitize_generation_record_raw", "visionhub_redacted_image_payload", "collect_embedded_image_urls"]:
    assert term in tauri_src, f"Tauri settings command missing: {term}"
assert '"images-minimal"' in tauri_src and '"/v1/images/generations"' in tauri_src, "Minimal Images protocol missing"

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
    ".workspaceBatchShell",
    ".batchQueuePage",
    ".batchQueueHero",
    ".batchQueueStats",
    ".batchTaskItem",
    ".batchTaskActions",
    ".batchTaskError",
    ".batchVariantBadge",
    ".batchCompareBadge",
    ".batchToolsDialog",
    ".batchToolsTabs",
    ".batchVariantBox",
    ".batchVariantRatioOption",
    ".batchVariantActions",
    ".compareProfileBox",
    ".compareProfileOption",
    ".compareProfileActions",
    ".quickQueueActions",
    ".quickQueueButton",
    ".workspaceCommandButton.dangerAction",
]:
    assert selector in styles_src, f"Remote UI hardening selector missing: {selector}"

for term in ["removeBatchQueueTask", "批量队列不存在，无法删除任务。", "BatchQueueCompareGroup", "createBatchQueueCompareGroup", "prompt-size-sweep"]:
    assert term in batch_queue_src, f"Batch queue delete helper missing: {term}"

svg = (ROOT / "planning/product-overview.svg").read_text(encoding="utf-8")
assert re.search(r"VisionHub Studio", svg)
print("Smoke check passed: Kuroii VisionHub scaffold is complete.")
