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


def button_source_with_marker(source: str, marker: str, label: str) -> str:
    matches = [
        match.group(0)
        for match in re.finditer(r"<button\b[^>]*>.*?</button>", source, re.DOTALL | re.IGNORECASE)
        if marker in match.group(0)
    ]
    assert len(matches) == 1, f"{label} should resolve to exactly one button, found {len(matches)}"
    return matches[0]


required = [
    "package.json",
    "index.html",
    "src/main.tsx",
    "src/ui/App.tsx",
    "src/ui/AppDialogs.tsx",
    "src/ui/BatchQueuePage.tsx",
    "src/ui/CachedInspirationPage.tsx",
    "src/ui/ComfyUIWorkflowPresentation.tsx",
    "src/ui/FreeGenerationPage.tsx",
    "src/ui/ImagePreviewModal.tsx",
    "src/ui/PromptTemplatesPage.tsx",
    "src/ui/ProviderPresentation.tsx",
    "src/ui/SettingsPage.tsx",
    "src/ui/WorkspaceHomePage.tsx",
    "src/ui/generationRecordPresentation.ts",
    "src/ui/library/LibraryPage.tsx",
    "src/ui/library/libraryModel.ts",
    "src/ui/urlSearch.ts",
    "src/ui/styles.css",
    "src/services/appSettings.ts",
    "src/services/comfyUIWorkflow.ts",
    "src/services/comfyUIWorkflow.test.ts",
    "src/services/providerCapabilityMatrix.ts",
    "src/services/providerCapabilityMatrix.test.ts",
    "src/services/providerServiceCatalog.ts",
    "src/services/providerServiceCatalog.test.ts",
    "src/services/providerProfileSelection.ts",
    "src/services/providerProfileSelection.test.ts",
    "src/services/providerDraftPresentation.ts",
    "src/services/providerDraftPresentation.test.ts",
    "src/services/providerConfigValidation.ts",
    "src/services/providerConfigValidation.test.ts",
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
app_dialogs_src = (ROOT / "src/ui/AppDialogs.tsx").read_text(encoding="utf-8")
batch_queue_page_src = (ROOT / "src/ui/BatchQueuePage.tsx").read_text(encoding="utf-8")
cached_inspiration_page_src = (ROOT / "src/ui/CachedInspirationPage.tsx").read_text(encoding="utf-8")
comfy_workflow_presentation_src = (ROOT / "src/ui/ComfyUIWorkflowPresentation.tsx").read_text(encoding="utf-8")
comfy_workflow_service_src = (ROOT / "src/services/comfyUIWorkflow.ts").read_text(encoding="utf-8")
provider_capability_matrix_src = (ROOT / "src/services/providerCapabilityMatrix.ts").read_text(encoding="utf-8")
provider_service_catalog_src = (ROOT / "src/services/providerServiceCatalog.ts").read_text(encoding="utf-8")
provider_profile_selection_src = (ROOT / "src/services/providerProfileSelection.ts").read_text(encoding="utf-8")
provider_draft_presentation_src = (ROOT / "src/services/providerDraftPresentation.ts").read_text(encoding="utf-8")
provider_config_validation_src = (ROOT / "src/services/providerConfigValidation.ts").read_text(encoding="utf-8")
free_generation_src = (ROOT / "src/ui/FreeGenerationPage.tsx").read_text(encoding="utf-8")
image_preview_src = (ROOT / "src/ui/ImagePreviewModal.tsx").read_text(encoding="utf-8")
prompt_templates_src = (ROOT / "src/ui/PromptTemplatesPage.tsx").read_text(encoding="utf-8")
provider_presentation_src = (ROOT / "src/ui/ProviderPresentation.tsx").read_text(encoding="utf-8")
settings_page_src = (ROOT / "src/ui/SettingsPage.tsx").read_text(encoding="utf-8")
workspace_home_page_src = (ROOT / "src/ui/WorkspaceHomePage.tsx").read_text(encoding="utf-8")
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
home_page_src = workspace_home_page_src
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
assert "function GeneratePage(" not in app_src and "function Gallery(" not in app_src, "Unmounted legacy generation/gallery UI should stay removed"
assert "generationFailureHint" not in app_src, "Legacy-only generation failure helper should stay removed"
assert "ModernGeneratePage" in app_src and "export function ModernGeneratePage" in generate_src, "Current generation workspace must stay mounted"
assert "import { PromptTemplatesPage } from './PromptTemplatesPage';" in app_src, "App shell should mount the extracted prompt templates page"
assert "<PromptTemplatesPage" in app_src, "App shell should render the extracted prompt templates page"
assert "function PromptTemplatesPage" not in app_src and "export function PromptTemplatesPage" in prompt_templates_src, "Prompt templates page should live outside App.tsx"
assert not re.search(r"from\s+['\"].*App['\"]", prompt_templates_src), "Prompt templates page must not import App.tsx"
assert "import { FreeGenerationPage } from './FreeGenerationPage';" in app_src, "App shell should mount the extracted free generation page"
assert "<FreeGenerationPage" in app_src, "App shell should render the extracted free generation page"
assert "function FreeGenerationPage" not in app_src and "export function FreeGenerationPage" in free_generation_src, "Free generation page should live outside App.tsx"
assert not re.search(r"from\s+['\"].*App['\"]", free_generation_src), "Free generation page must not import App.tsx"
assert "import { SettingsPage } from './SettingsPage';" in app_src, "App shell should mount the extracted settings page"
assert "<SettingsPage" in app_src and "appVersion={APP_VERSION}" in app_src, "App shell should render settings with the shared app version"
assert "function SettingsPage" not in app_src and "export function SettingsPage" in settings_page_src, "Settings page should live outside App.tsx"
assert "appVersion: string;" in settings_page_src and "{props.appVersion}" in settings_page_src, "Settings page should receive the App-owned version"
assert not re.search(r"from\s+['\"].*App['\"]", settings_page_src), "Settings page must not import App.tsx"
assert len(app_src.splitlines()) < 8000, "App.tsx should stay below the post-settings-extraction size guard"
settings_mount_src = source_between(app_src, "<SettingsPage", "/>", "Settings page mount")
for mapping in [
    "appVersion={APP_VERSION}",
    "onSettingsChange={updateAppSettings}",
    "onPromptPolishDraftChange={updatePromptPolishDraft}",
    "onSavePromptPolishConfig={savePromptPolishConfig}",
    "onRefreshPromptPolishModels={refreshPromptPolishModels}",
    "onPromptPolishSecretDraftChange={setPromptPolishSecretDraft}",
    "onSavePromptPolishSecret={savePromptPolishSecret}",
    "onImageReverseDraftChange={updateImageReverseDraft}",
    "onSaveImageReverseConfig={saveImageReverseConfig}",
    "onRefreshImageReverseModels={refreshImageReverseModels}",
    "onImageReverseSecretDraftChange={setImageReverseSecretDraft}",
    "onSaveImageReverseSecret={saveImageReverseSecret}",
    "onSelectLibraryPath={selectLibraryDirectory}",
    "onResetLibraryPath={resetLibraryDirectoryOverride}",
    "onOpenLibraryDirectory={openLibraryDirectory}",
    "onSelectInspirationPath={selectInspirationDirectory}",
    "onResetInspirationPath={resetInspirationDirectoryOverride}",
    "onOpenInspirationDirectory={openInspirationDirectory}",
    "onOpenAppDataDirectory={openAppDataDirectory}",
    "onOpenBackupsDirectory={openBackupsDirectory}",
    "onExportSettingsBackup={exportCurrentSettingsBackup}",
    "onExportMigrationGuide={exportMigrationGuide}",
    "onCheckUpdates={checkForUpdates}",
]:
    assert mapping in settings_mount_src, f"Settings page App callback mapping missing: {mapping}"
assert re.search(r"import\s*\{[^}]*\bBatchQueuePage\b[^}]*\}\s*from './BatchQueuePage';", app_src), "App shell should import the extracted batch queue page"
assert "<BatchQueuePage" in app_src, "App shell should render the extracted batch queue page"
assert "function BatchQueuePage" not in app_src and "export function BatchQueuePage" in batch_queue_page_src, "Batch queue page should live outside App.tsx"
assert not re.search(r"from\s+['\"].*App['\"]", batch_queue_page_src), "Batch queue page must not import App.tsx"
assert len(app_src.splitlines()) < 7300, "App.tsx should stay below the post-batch-queue-extraction size guard"
batch_queue_mount_src = source_between(app_src, "<BatchQueuePage", "/>", "Batch queue page mount")
for mapping in [
    "t={t}",
    "queues={batchQueueStore.queues}",
    "results={results}",
    "templates={batchQueueTemplates}",
    "activeQueueId={activeBatchQueueId}",
    "executingTaskId={executingBatchTaskId}",
    "runningQueueId={runningBatchQueueId}",
    "runProgress={batchQueueRunProgress}",
    "onPreview={openLibraryPreview}",
    "onNavigate={navigateTo}",
    "onSelectQueue={selectActiveBatchQueue}",
    "onCreateQueue={requestCreateBatchQueue}",
    "onRenameQueue={requestRenameBatchQueue}",
    "onDeleteQueue={requestDeleteBatchQueue}",
    "onRefresh={refreshBatchQueueStore}",
    "onStartQueue={requestStartBatchQueue}",
    "onStopQueue={requestStopBatchQueue}",
    "onExecuteTask={requestExecuteBatchQueueTask}",
    "onCancelTask={requestCancelBatchQueueTask}",
    "onRequeueTask={requestRequeueBatchQueueTask}",
    "onRequeueFailedTasks={requestRequeueFailedBatchQueueTasks}",
    "onDeleteTask={requestDeleteBatchQueueTask}",
    "onSaveTemplate={requestSaveActiveBatchQueueTemplate}",
    "onApplyTemplate={requestApplyBatchQueueTemplate}",
    "onDeleteTemplate={requestDeleteBatchQueueTemplate}",
]:
    assert mapping in batch_queue_mount_src, f"Batch queue App callback mapping missing: {mapping}"
assert "import { WorkspaceHomePage } from './WorkspaceHomePage';" in app_src, "App shell should import the extracted workspace home page"
assert "<WorkspaceHomePage" in app_src, "App shell should render the extracted workspace home page"
assert "function WorkspaceHomePage" not in app_src and "export function WorkspaceHomePage" in workspace_home_page_src, "Workspace home page should live outside App.tsx"
assert not re.search(r"from\s+['\"].*App['\"]", workspace_home_page_src), "Workspace home page must not import App.tsx"
assert len(app_src.splitlines()) < 6900, "App.tsx should stay below the post-workspace-home-extraction size guard"
workspace_home_mount_src = source_between(app_src, "<WorkspaceHomePage", "/>", "Workspace home page mount")
for mapping in [
    "providerName={generationSelectedProvider.name}",
    "providerProfileName={activeGenerationProfile?.displayName ?? t('home.provider.noSavedProfile')}",
    "providerModelId={activeGenerationConfig.modelId || selectedModelId || t('home.provider.noModel')}",
    "selectedProviderId={selectedProviderId}",
    "isRealProviderReady={isRealProviderReady}",
    "secretAvailable={generationSecretAvailable}",
    "desktopRuntime={desktopRuntime}",
    "localComfyUIDiagnostic={localComfyUIDiagnostic}",
    "localComfyUIWorkflowStore={localComfyUIWorkflowStore}",
    "activeComfyUIWorkflowPreset={activeComfyUIWorkflowPreset}",
    "resultSummary={homeResultSummary}",
    "recentSuccessRecords={homeRecentSuccessRecords}",
    "recentFailureRecords={homeRecentFailureRecords}",
    "favoriteRecords={homeFavoriteRecords}",
    "referenceRecords={homeReferenceRecords}",
    "providerNameMap={homeProviderNameMap}",
    "homeModules={appSettings.homeModules}",
    "t={t}",
    "onNavigate={navigateTo}",
    "onUseRecordAsReference={useRecordAsReference}",
    "onOpenComfyUIWorkflowManager={() => setIsComfyUIWorkflowManagerOpen(true)}",
]:
    assert mapping in workspace_home_mount_src, f"Workspace home App callback mapping missing: {mapping}"
for term in [
    "export function WorkspaceHomePage",
    "mergeWorkspaceRecords",
    "WorkspaceHomeEmpty",
    "formatWorkspaceHomeTime",
    "home.resume.emptyTitle",
    "home.attention.emptyTitle",
    "home.materials.emptyTitle",
    "diagnoseGenerationFailure",
    "generationStatusClass",
    "generationStatusLabel",
    "generationFailureCategoryLabel",
    "props.onUseRecordAsReference(record)",
    "props.onNavigate('generate')",
    "props.onOpenComfyUIWorkflowManager",
]:
    assert term in workspace_home_page_src, f"Workspace home interaction missing: {term}"
app_dialogs_import = re.search(r"import\s*\{(?P<bindings>[^}]*)\}\s*from './AppDialogs';", app_src, re.DOTALL)
assert app_dialogs_import, "App shell should import the extracted app dialogs"
for binding in [
    "BatchQueueNameDialog",
    "ConfirmDialog",
    "ShortcutsModal",
    "SystemInfoModal",
    "BatchQueueNameDialogState",
    "ConfirmDialogState",
]:
    assert re.search(rf"\b{binding}\b", app_dialogs_import.group("bindings")), f"AppDialogs import missing: {binding}"
for component in [
    "BatchQueueNameDialog",
    "ConfirmDialog",
    "UtilityModalShell",
    "ShortcutsModal",
    "SystemInfoModal",
]:
    assert f"function {component}" not in app_src, f"{component} should not remain defined in App.tsx"
    assert f"export function {component}" in app_dialogs_src, f"{component} should be exported from AppDialogs.tsx"
for type_name in ["ConfirmDialogState", "BatchQueueNameDialogState"]:
    assert not re.search(rf"^type {type_name}\b", app_src, re.MULTILINE), f"{type_name} should not remain defined in App.tsx"
    assert re.search(rf"^export type {type_name}\b", app_dialogs_src, re.MULTILINE), f"{type_name} should be exported from AppDialogs.tsx"
assert "const shortcutGroups" not in app_src and "const shortcutGroups" in app_dialogs_src, "Shortcut presentation definitions should live with the shortcuts modal"
assert not re.search(r"from\s+['\"].*App['\"]", app_dialogs_src), "App dialogs must not import App.tsx"
assert "appVersion: string;" in app_dialogs_src and "value: props.appVersion" in app_dialogs_src, "System info should receive the App-owned version"
assert "import { UtilityModalShell } from './AppDialogs';" in comfy_workflow_presentation_src, "ComfyUI workflow presentation should reuse the shared utility modal shell"
assert "import { CachedInspirationPage } from './CachedInspirationPage';" in app_src, "App shell should import the cached inspiration page"
assert "<CachedInspirationPage" in app_src, "App shell should mount the cached inspiration page"
assert "const CachedInspirationPage" not in app_src, "Cached inspiration page should not remain defined in App.tsx"
assert "export const CachedInspirationPage = memo(" in cached_inspiration_page_src, "Cached inspiration page should be exported from its own module"
assert not re.search(r"from\s+['\"].*App['\"]", cached_inspiration_page_src), "Cached inspiration page must not import App.tsx"
assert "props.isActive && props.preview" in cached_inspiration_page_src, "Inspiration preview should only render while its cached page is active"
assert len(app_src.splitlines()) < 6600, "App.tsx should stay below the post-cached-inspiration-extraction size guard"
cached_inspiration_mount_src = source_between(app_src, "<CachedInspirationPage", "/>", "Cached inspiration page mount")
for mapping in [
    "t={t}",
    "isActive={page === 'inspiration'}",
    "preview={inspirationPreview}",
    "onPreview={openInspirationPreview}",
    "onNavigatePreview={navigateInspirationPreview}",
    "onClosePreview={closeInspirationPreview}",
    "onUseAsReference={useInspirationAssetAsReference}",
    "onUsePrompt={useInspirationPrompt}",
    "onCreateTemplate={createPromptTemplateFromInspiration}",
    "onRequestConfirm={requestConfirm}",
    "imagePromptReverse={appSettings.imagePromptReverse}",
    "imagePromptReverseSecretAvailable={imageReverseSecretAvailable}",
    "onOpenSettings={() => navigateTo('settings')}",
    "importVersion={inspirationImportVersion}",
]:
    assert mapping in cached_inspiration_mount_src, f"Cached inspiration App prop mapping missing: {mapping}"
for mapping in [
    "t={props.t}",
    "onPreview={props.onPreview}",
    "onUseAsReference={props.onUseAsReference}",
    "onUsePrompt={props.onUsePrompt}",
    "onCreateTemplate={props.onCreateTemplate}",
    "onRequestConfirm={props.onRequestConfirm}",
    "imagePromptReverse={props.imagePromptReverse}",
    "imagePromptReverseSecretAvailable={props.imagePromptReverseSecretAvailable}",
    "onOpenSettings={props.onOpenSettings}",
    "importVersion={props.importVersion}",
]:
    assert mapping in cached_inspiration_page_src, f"Cached inspiration page prop forwarding missing: {mapping}"
for mapping in [
    "imageUrl={props.preview.imageUrl}",
    "navigation={props.preview.navigation}",
    "onNavigate={props.onNavigatePreview}",
    "onClose={props.onClosePreview}",
]:
    assert mapping in cached_inspiration_page_src, f"Cached inspiration preview mapping missing: {mapping}"
shortcuts_mount_src = source_between(app_src, "<ShortcutsModal", "/>", "Shortcuts modal mount")
for mapping in [
    "t={t}",
    "onClose={() => setActiveUtilityModal(null)}",
]:
    assert mapping in shortcuts_mount_src, f"Shortcuts modal App prop mapping missing: {mapping}"
for shortcut_entry in [
    "{ keys: ['Ctrl', '/'], actionKey: 'shortcut.action.openShortcuts' }",
    "{ keys: ['Ctrl', 'B'], actionKey: 'shortcut.action.toggleSidebar' }",
    "{ keys: ['Ctrl', ','], actionKey: 'shortcut.action.openProviders' }",
    "{ keys: ['Ctrl', '0'], actionKey: 'shortcut.action.openHome' }",
    "{ keys: ['Ctrl', '1'], actionKey: 'shortcut.action.openGenerate' }",
    "{ keys: ['Ctrl', '2'], actionKey: 'shortcut.action.openFree' }",
    "{ keys: ['Ctrl', '3'], actionKey: 'shortcut.action.openLibrary' }",
    "{ keys: ['Ctrl', '4'], actionKey: 'shortcut.action.openInspiration' }",
    "{ keys: ['Ctrl', '5'], actionKey: 'shortcut.action.openTemplates' }",
    "{ keys: ['Ctrl', '6'], actionKey: 'shortcut.action.openProviders' }",
    "{ keys: ['Ctrl', '7'], actionKey: 'shortcut.action.openSettings' }",
    "{ keys: ['Ctrl', '8'], actionKey: 'shortcut.action.openBatch' }",
    "{ keys: ['Esc'], actionKey: 'shortcut.action.closeOverlay' }",
    "{ keys: ['Ctrl', 'Enter'], actionKey: 'shortcut.action.submitGenerate' }",
    "{ keys: ['Ctrl', 'K'], actionKey: 'shortcut.action.focusPrompt' }",
    "{ keys: ['Ctrl', 'Shift', 'R'], actionKey: 'shortcut.action.addReference' }",
    "{ keys: ['Ctrl', 'Shift', 'C'], actionKey: 'shortcut.action.clearReferences' }",
    "{ keys: ['Ctrl', 'Shift', 'I'], actionKey: 'shortcut.action.modeImage' }",
    "{ keys: ['Ctrl', 'Shift', 'T'], actionKey: 'shortcut.action.modeText' }",
    "{ keys: ['Ctrl', 'F'], actionKey: 'shortcut.action.focusLibrarySearch' }",
    "{ keys: ['Ctrl', 'O'], actionKey: 'shortcut.action.openLibraryDir' }",
    "{ keys: ['Ctrl', 'E'], actionKey: 'shortcut.action.exportSettingsBackup' }",
    "{ keys: ['+'], actionKey: 'shortcut.action.zoomInPreview' }",
    "{ keys: ['-'], actionKey: 'shortcut.action.zoomOutPreview' }",
    "{ keys: ['0'], actionKey: 'shortcut.action.resetPreview' }",
    "{ keys: ['Space'], actionKey: 'shortcut.action.resetPreview' }",
    "{ keys: ['Esc'], actionKey: 'shortcut.action.closePreview' }",
]:
    assert shortcut_entry in app_dialogs_src, f"Shortcuts modal entry missing: {shortcut_entry}"
system_info_mount_src = source_between(app_src, "<SystemInfoModal", "/>", "System info modal mount")
for mapping in [
    "t={t}",
    "appVersion={APP_VERSION}",
    "desktopRuntime={desktopRuntime}",
    "storageSettings={storageSettings}",
    "settingsMessage={settingsMessage}",
    "onClose={() => setActiveUtilityModal(null)}",
]:
    assert mapping in system_info_mount_src, f"System info modal App prop mapping missing: {mapping}"
confirm_dialog_mount_src = source_between(app_src, "<ConfirmDialog\n", "/>", "Confirm dialog mount")
for mapping in [
    "t={t}",
    "request={confirmDialog}",
    "onClose={() => setConfirmDialog(null)}",
    "onError={(error) => setConfirmDialog((current) => (current ? { ...current, error } : current))}",
]:
    assert mapping in confirm_dialog_mount_src, f"Confirm dialog App prop mapping missing: {mapping}"
batch_name_mount_src = source_between(app_src, "<BatchQueueNameDialog\n", "/>", "Batch queue name dialog mount")
for mapping in [
    "t={t}",
    "mode={batchQueueNameDialog.mode}",
    "defaultName={batchQueueNameDialog.defaultName}",
    "onClose={() => setBatchQueueNameDialog(null)}",
    "onSubmit={(name) => submitBatchQueueName(batchQueueNameDialog, name)}",
]:
    assert mapping in batch_name_mount_src, f"Batch queue name dialog App prop mapping missing: {mapping}"
comfy_workflow_import = re.search(r"import\s*\{(?P<bindings>[^}]*)\}\s*from './ComfyUIWorkflowPresentation';", app_src, re.DOTALL)
assert comfy_workflow_import, "App shell should import the extracted ComfyUI workflow presentation module"
for binding in [
    "ComfyUIWorkflowManagerModal",
    "ComfyUIWorkflowSummaryPanel",
]:
    assert re.search(rf"\b{binding}\b", comfy_workflow_import.group("bindings")), f"ComfyUI workflow presentation import missing: {binding}"
comfy_workflow_service_import = re.search(r"import\s*\{(?P<bindings>[^}]*)\}\s*from '../services/comfyUIWorkflow';", app_src, re.DOTALL)
assert comfy_workflow_service_import, "App shell should import the extracted ComfyUI workflow service"
for binding in [
    "createLocalWorkflowPreset",
    "loadLocalComfyUIWorkflowStore",
    "parseComfyUIWorkflow",
    "readTextFile",
    "saveLocalComfyUIWorkflowStore",
    "LocalComfyUIWorkflowPreset",
    "LocalComfyUIWorkflowStore",
]:
    assert re.search(rf"\b{binding}\b", comfy_workflow_service_import.group("bindings")), f"ComfyUI workflow service import missing: {binding}"
for component in ["ComfyUIWorkflowManagerModal", "ComfyUIWorkflowSummaryPanel"]:
    assert f"function {component}" not in app_src, f"{component} should not remain defined in App.tsx"
    assert f"export function {component}" in comfy_workflow_presentation_src, f"{component} should be exported from the presentation module"
for type_name in [
    "LocalComfyUIWorkflowFormat",
    "LocalComfyUIWorkflowNodeRole",
    "LocalComfyUIWorkflowNode",
    "LocalComfyUIWorkflowSummary",
    "LocalComfyUIWorkflowPreset",
    "LocalComfyUIWorkflowStore",
]:
    assert not re.search(rf"^type {type_name}\b", app_src, re.MULTILINE), f"{type_name} should not remain defined in App.tsx"
    assert re.search(rf"^export type {type_name}\b", comfy_workflow_service_src, re.MULTILINE), f"{type_name} should be exported from the workflow service"
assert "from '../services/comfyUIWorkflow'" in comfy_workflow_presentation_src, "ComfyUI workflow presentation should import shared workflow types from the service"
for helper in ["workflowFormatLabel", "comfyUIWorkflowRunStatus"]:
    assert f"function {helper}" not in app_src, f"{helper} should not remain defined in App.tsx"
    assert f"function {helper}" in comfy_workflow_presentation_src, f"{helper} should live in the presentation module"
assert not re.search(r"from\s+['\"].*App['\"]", comfy_workflow_presentation_src), "ComfyUI workflow presentation must not import App.tsx"
assert "<UtilityModalShell" in comfy_workflow_presentation_src, "ComfyUI workflow manager should reuse the extracted utility modal shell"
assert "<ComfyUIWorkflowSummaryPanel preset={activeWorkflowPreset} t={props.t} />" in app_src, "Provider settings should keep the workflow summary panel mount"
comfy_workflow_manager_mount_src = source_between(app_src, "<ComfyUIWorkflowManagerModal", "/>", "ComfyUI workflow manager mount")
for mapping in [
    "t={t}",
    "store={localComfyUIWorkflowStore}",
    "onClose={() => setIsComfyUIWorkflowManagerOpen(false)}",
    "const nextStore = { ...localComfyUIWorkflowStore, activeId: presetId };",
    "setLocalComfyUIWorkflowStore(nextStore);",
    "saveLocalComfyUIWorkflowStore(nextStore);",
    "localComfyUIWorkflowStore.presets.filter((preset: LocalComfyUIWorkflowPreset) => preset.id !== presetId)",
    "activeId: localComfyUIWorkflowStore.activeId === presetId ? nextPresets[0]?.id ?? null : localComfyUIWorkflowStore.activeId",
    "presets: nextPresets",
]:
    assert mapping in comfy_workflow_manager_mount_src, f"ComfyUI workflow manager App mapping missing: {mapping}"
for responsibility in [
    "function importLocalComfyUIWorkflow",
    "function clearLocalComfyUIWorkflow",
    "async function runLocalComfyUIDiagnostics",
    "diagnoseComfyUIConnection({",
    "generateComfyUIImage({",
]:
    assert responsibility in app_src, f"ComfyUI workflow App responsibility missing: {responsibility}"
for helper in [
    "createLocalWorkflowPreset",
    "normalizeLocalComfyUIWorkflowStore",
    "loadLocalComfyUIWorkflowStore",
    "saveLocalComfyUIWorkflowStore",
    "readTextFile",
    "parseComfyUIWorkflow",
]:
    assert f"function {helper}" not in app_src, f"{helper} should not remain defined in App.tsx"
    assert f"function {helper}" in comfy_workflow_service_src, f"{helper} should live in the workflow service"
assert "LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY = 'visionhub.local.comfyui.workflow.v1'" in comfy_workflow_service_src, "ComfyUI workflow storage key must remain unchanged"
assert "removeStorageValue(LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY)" in comfy_workflow_service_src, "Empty ComfyUI workflow stores should use safe storage cleanup"
assert "from '../services/comfyUIWorkflow'" in app_src, "App should import ComfyUI workflow helpers from the service"
assert not re.search(r"from\s+['\"].*App['\"]", comfy_workflow_service_src), "ComfyUI workflow service must not import App.tsx"
for presentation_term in [
    "props.store.presets.find((preset) => preset.id === props.store.activeId)",
    "onClick={() => props.onSelect(preset.id)}",
    "onClick={() => props.onDelete(activePreset.id)}",
    "<ComfyUIWorkflowSummaryPanel preset={activePreset} t={props.t} />",
]:
    assert presentation_term in comfy_workflow_presentation_src, f"ComfyUI workflow presentation behavior missing: {presentation_term}"
assert len(app_src.splitlines()) < 6250, "App.tsx should stay below the post-ComfyUI-workflow-service extraction size guard"
provider_presentation_import = re.search(
    r"import\s*\{(?P<bindings>.*?)\}\s*from\s*['\"]\./ProviderPresentation['\"]",
    app_src,
    re.DOTALL,
)
assert provider_presentation_import, "App should import the extracted Provider presentation module"
for component in [
    "ProviderCapabilityMatrixPanel",
    "ProviderDiagnosticsResults",
    "ProviderReadinessPanel",
    "ServiceTemplateMeta",
]:
    assert re.search(rf"\b{component}\b", provider_presentation_import.group("bindings")), f"Provider presentation import missing: {component}"
    assert f"function {component}" not in app_src, f"{component} should not remain defined in App.tsx"
    assert f"export function {component}" in provider_presentation_src, f"{component} should be exported from ProviderPresentation.tsx"
assert not re.search(r"from\s+['\"].*App['\"]", provider_presentation_src), "Provider presentation must not import App.tsx"
assert app_src.count("<ServiceTemplateMeta ") == 4, "Provider service metadata should keep all four existing mounts"
assert "<ProviderReadinessPanel items={offlineDiagnosticItems} t={props.t} />" in app_src, "Provider readiness rendering should use the extracted panel"
provider_matrix_mount_src = source_between(app_src, "<ProviderCapabilityMatrixPanel", "/>", "Provider capability matrix mount")
for mapping in [
    "columns={localizedMatrixColumns}",
    "rows={providerMatrixRows}",
    "selectedTemplateId={props.selectedServiceTemplate.id}",
    "onSelectTemplate={props.onServiceTemplateChange}",
    "t={props.t}",
]:
    assert mapping in provider_matrix_mount_src, f"Provider capability matrix mapping missing: {mapping}"
assert "<ProviderDiagnosticsResults diagnostics={props.diagnostics} t={props.t} />" in app_src, "Provider diagnostics results should use the extracted renderer"
for responsibility in [
    "getProviderCapabilityMatrixCell(template, column, props.providers)",
    "buildProviderReadinessItems({",
    "buildOfflineDiagnosticSummary({",
    "onClick={props.onRunTestGeneration}",
    "onClick={props.onCopyDiagnostics}",
    "void props.onRunDiagnostics();",
]:
    assert responsibility in app_src, f"Provider behavior should remain App-owned: {responsibility}"
for forbidden in [
    "secretDraft",
    "onSaveSecret",
    "onRefreshModels",
    "onRunDiagnostics",
    "onCopyDiagnostics",
    "onRunTestGeneration",
    "saveProviderConfig",
    "providerProfileSecretId",
    "localStorage",
]:
    assert forbidden not in provider_presentation_src, f"Provider presentation must stay read-only: {forbidden}"
assert len(app_src.splitlines()) < 6075, "App.tsx should stay below the post-Provider-presentation extraction size guard"
provider_capability_matrix_import = re.search(
    r"import\s*\{(?P<bindings>.*?)\}\s*from\s*['\"]\.\./services/providerCapabilityMatrix['\"]",
    app_src,
    re.DOTALL,
)
assert provider_capability_matrix_import, "App should import the extracted Provider capability matrix service"
for binding in [
    "getProviderCapabilityMatrixCell",
    "providerMatrixColumnKeys",
    "ProviderMatrixCapabilityKey",
]:
    assert re.search(rf"\b{binding}\b", provider_capability_matrix_import.group("bindings")), f"Provider capability matrix import missing: {binding}"
for helper in [
    "mapProviderCapabilityToMatrixStatus",
    "resolveProtocolMatrixStatus",
    "getProviderCapabilityMatrixCell",
]:
    assert f"function {helper}" not in app_src, f"{helper} should not remain defined in App.tsx"
    assert f"function {helper}" in provider_capability_matrix_src, f"{helper} should live in providerCapabilityMatrix.ts"
for type_name in [
    "ProviderMatrixStatus",
    "ProviderMatrixCapabilityKey",
    "ProviderCapabilityMatrixCell",
]:
    assert not re.search(rf"^type {type_name}\b", app_src, re.MULTILINE), f"{type_name} should not remain defined in App.tsx"
    assert re.search(rf"^export type {type_name}\b", provider_capability_matrix_src, re.MULTILINE), f"{type_name} should be exported from providerCapabilityMatrix.ts"
assert "export const providerMatrixColumnKeys" in provider_capability_matrix_src, "Provider matrix column order should live in the service"
assert not re.search(r"from\s+['\"].*App['\"]", provider_capability_matrix_src), "Provider capability matrix service must not import App.tsx"
for responsibility in [
    "providerMatrixColumnKeys.map((key) => ({ key, label: providerMatrixColumnLabel(key) }))",
    "getProviderCapabilityMatrixCell(template, column, props.providers)",
]:
    assert responsibility in app_src, f"Provider settings should keep matrix composition responsibility: {responsibility}"
for forbidden in [
    "localStorage",
    "fetch(",
    "invoke(",
    "apiKey",
    "secretId",
    "generateOpenAIImage",
    "saveProviderConfig",
]:
    assert forbidden not in provider_capability_matrix_src, f"Provider capability matrix service must stay pure: {forbidden}"
assert len(app_src.splitlines()) < 5960, "App.tsx should stay below the post-Provider-capability-matrix extraction size guard"
provider_service_catalog_import = re.search(
    r"import\s*\{(?P<bindings>.*?)\}\s*from\s*['\"]\.\./services/providerServiceCatalog['\"]",
    app_src,
    re.DOTALL,
)
assert provider_service_catalog_import, "App should import the extracted Provider service catalog"
for binding in [
    "getDefaultProviderServiceTemplateForProvider",
    "getProviderServiceTemplate",
    "getProviderServiceTemplatesForPlatform",
    "isProviderServiceTemplateConfigurable",
    "providerPlatformOptions",
    "providerServiceTemplates",
    "ProviderPlatformOption",
    "ProviderPlatformType",
    "ProviderServiceRegion",
    "ProviderServiceTemplate",
    "ProviderServiceTemplateStatus",
]:
    assert re.search(rf"\b{binding}\b", provider_service_catalog_import.group("bindings")), f"Provider service catalog import missing: {binding}"
for helper in [
    "getProviderServiceTemplatesForPlatform",
    "getProviderServiceTemplate",
    "isProviderServiceTemplateConfigurable",
    "getDefaultProviderServiceTemplateForProvider",
]:
    assert f"function {helper}" not in app_src, f"{helper} should not remain defined in App.tsx"
    assert f"function {helper}" in provider_service_catalog_src, f"{helper} should live in providerServiceCatalog.ts"
for type_name in [
    "ProviderPlatformType",
    "ProviderServiceTemplateStatus",
    "ProviderServiceRegion",
    "ProviderPlatformOption",
    "ProviderServiceTemplate",
]:
    assert not re.search(rf"^type {type_name}\b", app_src, re.MULTILINE), f"{type_name} should not remain defined in App.tsx"
    assert re.search(rf"^export type {type_name}\b", provider_service_catalog_src, re.MULTILINE), f"{type_name} should be exported from providerServiceCatalog.ts"
for constant in ["providerPlatformOptions", "providerServiceTemplates", "providerServiceStatusRank"]:
    assert not re.search(rf"^const {constant}\b", app_src, re.MULTILINE), f"{constant} should not remain defined in App.tsx"
    assert re.search(rf"^(?:export )?const {constant}\b", provider_service_catalog_src, re.MULTILINE), f"{constant} should live in providerServiceCatalog.ts"
assert not re.search(r"from\s+['\"].*App['\"]", provider_service_catalog_src), "Provider service catalog must not import App.tsx"
for responsibility in [
    "providerServiceTemplateDisplayName(selectedServiceTemplate, t)",
]:
    assert responsibility in app_src, f"Provider App responsibility should remain in App.tsx: {responsibility}"
for forbidden in [
    "localStorage",
    "fetch(",
    "invoke(",
    "apiKey",
    "secretId",
    "generateOpenAIImage",
    "saveProviderConfig",
]:
    assert forbidden not in provider_service_catalog_src, f"Provider service catalog must stay pure: {forbidden}"
assert len(app_src.splitlines()) < 5700, "App.tsx should stay below the post-Provider-service-catalog extraction size guard"
provider_profile_selection_import = re.search(
    r"import\s*\{(?P<bindings>.*?)\}\s*from\s*['\"]\.\./services/providerProfileSelection['\"]",
    app_src,
    re.DOTALL,
)
assert provider_profile_selection_import, "App should import the extracted Provider profile selection service"
for binding in [
    "buildProviderProfileFilterOptions",
    "matchesProviderProfileFilter",
    "providerProfileBelongsToTemplate",
    "ProviderProfileFilter",
]:
    assert re.search(rf"\b{binding}\b", provider_profile_selection_import.group("bindings")), f"Provider profile selection import missing: {binding}"
for helper in [
    "buildProviderProfileFilterOptions",
    "matchesProviderProfileFilter",
    "providerProfileBelongsToTemplate",
]:
    assert f"function {helper}" not in app_src, f"{helper} should not remain defined in App.tsx"
    assert f"function {helper}" in provider_profile_selection_src, f"{helper} should live in providerProfileSelection.ts"
assert not re.search(r"^type ProviderProfileFilter\b", app_src, re.MULTILINE), "ProviderProfileFilter should not remain defined in App.tsx"
assert re.search(r"^export type ProviderProfileFilter\b", provider_profile_selection_src, re.MULTILINE), "ProviderProfileFilter should be exported from providerProfileSelection.ts"
assert not re.search(r"from\s+['\"].*App['\"]", provider_profile_selection_src), "Provider profile selection must not import App.tsx"
for responsibility in [
    "function deleteCurrentProviderProfile",
    "function toggleProviderProfile",
    "deleteProviderProfile(providerProfiles, profileId)",
    "setProviderProfileEnabled(providerProfiles, profileId, enabled)",
    "deleteProviderSecret(providerProfileSecretId(profileId))",
]:
    assert responsibility in app_src, f"Provider profile mutation should remain App-owned: {responsibility}"
for forbidden in [
    "localStorage",
    "readStorageValue",
    "writeStorageValue",
    "saveProviderProfiles",
    "deleteProviderProfile",
    "setProviderProfileEnabled",
    "providerProfileSecretId",
    "apiKey",
    "secretId",
]:
    assert forbidden not in provider_profile_selection_src, f"Provider profile selection must stay pure: {forbidden}"
assert "providerProfiles.filter((profile) => providerProfileBelongsToTemplate(profile, selectedServiceTemplate))" in app_src, "App should keep selected-template profile composition"
assert "buildProviderProfileFilterOptions(props.providerProfiles, props.t)" in app_src, "Provider settings should keep filter option composition"
assert "props.providerProfiles.filter((profile) => matchesProviderProfileFilter(profile, profileFilter))" in app_src, "Provider settings should keep filtered profile composition"
assert len(app_src.splitlines()) < 5660, "App.tsx should stay below the post-Provider-profile-selection extraction size guard"
provider_draft_presentation_import = re.search(
    r"import\s*\{(?P<bindings>.*?)\}\s*from\s*['\"]\.\./services/providerDraftPresentation['\"]",
    app_src,
    re.DOTALL,
)
assert provider_draft_presentation_import, "App should import the extracted Provider draft/presentation service"
for binding in [
    "createEmptyProviderDraftConfig",
    "providerGenerationLabel",
    "providerServiceTemplateDisplayName",
]:
    assert re.search(rf"\b{binding}\b", provider_draft_presentation_import.group("bindings")), f"Provider draft/presentation import missing: {binding}"
for helper in [
    "createEmptyProviderDraftConfig",
    "providerGenerationLabel",
    "providerServiceTemplateDisplayName",
]:
    assert f"function {helper}" not in app_src, f"{helper} should not remain defined in App.tsx"
    assert f"function {helper}" in provider_draft_presentation_src, f"{helper} should live in providerDraftPresentation.ts"
assert not re.search(r"from\s+['\"].*App['\"]", provider_draft_presentation_src), "Provider draft/presentation service must not import App.tsx"
for responsibility in [
    "function saveCurrentProviderConfig",
    "async function saveActiveProviderSecret",
    "async function refreshModels",
    "async function runProviderProfileConnectionTest",
    "async function runProviderTestGeneration",
    "createEmptyProviderDraftConfig(selectedProvider, selectedServiceTemplate, t)",
]:
    assert responsibility in app_src, f"Provider action should remain App-owned: {responsibility}"
for forbidden in [
    "localStorage",
    "readStorageValue",
    "writeStorageValue",
    "saveProviderConfig",
    "saveProviderSecret",
    "listOpenAICompatibleModels",
    "generateOpenAIImage",
    "apiKey",
    "secretId",
]:
    assert forbidden not in provider_draft_presentation_src, f"Provider draft/presentation service must stay pure: {forbidden}"
assert len(app_src.splitlines()) < 5630, "App.tsx should stay below the post-Provider-draft-presentation extraction size guard"
provider_config_validation_import = re.search(
    r"import\s*\{(?P<bindings>.*?)\}\s*from\s*['\"]\.\./services/providerConfigValidation['\"]",
    app_src,
    re.DOTALL,
)
assert provider_config_validation_import, "App should import the extracted Provider config validation service"
for binding in [
    "ensureManualModelOption",
    "isProviderConnectionProfileLike",
    "safeProviderConfigText",
]:
    assert re.search(rf"\b{binding}\b", provider_config_validation_import.group("bindings")), f"Provider config validation import missing: {binding}"
for helper in [
    "ensureManualModelOption",
    "isProviderConnectionProfileLike",
    "safeProviderConfigText",
]:
    assert f"function {helper}" not in app_src, f"{helper} should not remain defined in App.tsx"
    assert f"function {helper}" in provider_config_validation_src, f"{helper} should live in providerConfigValidation.ts"
assert not re.search(r"from\s+['\"].*App['\"]", provider_config_validation_src), "Provider config validation must not import App.tsx"
for responsibility in [
    "async function importProviderConfigFromClipboard",
    "navigator.clipboard?.readText()",
    "parseProviderConfigImport(text)",
    "setProviderConfig(importedConfig)",
    "saveProviderConfig(selectedProvider.id, nextConfig)",
    "persistProfile({",
]:
    assert responsibility in app_src, f"Provider import/persistence responsibility should remain App-owned: {responsibility}"
for forbidden in [
    "localStorage",
    "readStorageValue",
    "writeStorageValue",
    "saveProviderConfig",
    "saveProviderProfiles",
    "navigator.clipboard",
    "parseProviderConfigImport",
    "providerProfileSecretId",
    "apiKey",
    "secretId",
]:
    assert forbidden not in provider_config_validation_src, f"Provider config validation must stay pure: {forbidden}"
assert len(app_src.splitlines()) < 5610, "App.tsx should stay below the post-Provider-config-validation extraction size guard"
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
    "PROMPT_POLISH_SECRET_ID",
    "IMAGE_PROMPT_REVERSE_SECRET_ID",
    "function updateAppSettings",
    "function refreshPromptPolishModels",
    "function savePromptPolishSecret",
    "function refreshImageReverseModels",
    "function saveImageReverseSecret",
    "function selectLibraryDirectory",
    "function resetLibraryDirectoryOverride",
    "function openLibraryDirectory",
    "function selectInspirationDirectory",
    "function resetInspirationDirectoryOverride",
    "function openInspirationDirectory",
    "function openAppDataDirectory",
    "function openBackupsDirectory",
    "function exportCurrentSettingsBackup",
    "function exportMigrationGuide",
    "settingsMessage",
]:
    assert term in app_src, f"App-owned settings responsibility missing: {term}"

for term in [
    "PRIMARY_ACCENT_OPTIONS",
    "GENERATOR_ACCENT_OPTIONS",
    "DEFAULT_SIZE_OPTIONS",
    "DEFAULT_COUNT_OPTIONS",
    "OUTPUT_FORMAT_OPTIONS",
    "PROMPT_HISTORY_LIMIT_OPTIONS",
    "PROMPT_POLISH_ENGINE_OPTIONS",
    "PROMPT_POLISH_LANGUAGE_OPTIONS",
    "PROMPT_POLISH_STRENGTH_OPTIONS",
    "PROMPT_POLISH_PROTOCOL_OPTIONS",
    "STARTUP_PAGE_OPTIONS",
    "REFRESH_INTERVAL_OPTIONS",
    "LANGUAGE_OPTIONS",
    "DEFAULT_REFERENCE_ROLE_OPTIONS",
    "FILE_NAMING_RULE_OPTIONS",
    "settings.startupPage",
    "refreshIntervalSeconds",
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
    "settings.savePolishConfig",
    "modelOptions",
    "settings.languageStrengthProtocol",
    "updatePromptPolish",
    "getPolishModesForEngine",
    "onClick={props.onRefreshPromptPolishModels}",
    "onClick={props.onSavePromptPolishSecret}",
    "onClick={props.onSavePromptPolishConfig}",
    "onClick={props.onRefreshImageReverseModels}",
    "onClick={props.onSaveImageReverseSecret}",
    "onClick={props.onSaveImageReverseConfig}",
    "onClick={props.onOpenLibraryDirectory}",
    "onClick={props.onOpenInspirationDirectory}",
    "onClick={props.onOpenAppDataDirectory}",
    "onClick={props.onOpenBackupsDirectory}",
    "onClick={props.onExportSettingsBackup}",
    "onClick={props.onExportMigrationGuide}",
]:
    assert term in settings_page_src, f"Settings page interaction missing: {term}"

for key in [
    "settings.startupPage",
    "settings.sidebarCollapsed",
    "settings.compactMode",
    "settings.language",
    "settings.savePreferences",
    "settings.homeModules",
    "settings.defaultMode",
    "settings.defaultReferenceRole",
    "settings.defaultProviderModel",
    "settings.reuseHistoryPolicy",
    "settings.defaultPolishMode",
    "settings.promptPolishEngine",
    "settings.promptPolishProviderProfile",
    "settings.savePolishConfig",
    "settings.languageStrengthProtocol",
]:
    assert key in settings_page_src, f"Settings page translation usage missing: {key}"
    assert key in i18n_src, f"Settings translation fixture missing: {key}"

for term in [
    "handleAddCurrentGenerationToBatchQueue",
    "createQueuedGenerationSnapshot",
    "loadBatchQueueStore",
    "summarizeBatchQueue",
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
]:
    assert term in app_src, f"App-owned batch queue responsibility missing: {term}"

for term in [
    "export function BatchQueuePage",
    "summarizeBatchQueue",
    "summarizeBatchVariantGroups",
    "BatchQueueStat",
    "batch.emptyQueueTitle",
    "batch.emptyTitle",
]:
    assert term in batch_queue_page_src, f"Batch queue page interaction missing: {term}"

assert "const selectQueue = () => props.onSelectQueue(queue.id);" in batch_queue_page_src, "Batch queue selection callback binding missing"
for marker, binding, label in [
    ("batch.queue.renameTitle", "props.onRenameQueue(queue.id);", "Batch queue rename button"),
    ("batch.queue.deleteTitle", "props.onDeleteQueue(queue.id);", "Batch queue delete button"),
    ("batch.action.pauseTitle", "isActiveQueueRunning ? props.onStopQueue(activeQueue.id) : props.onStartQueue(activeQueue.id)", "Batch queue run/pause button"),
    ("batch.action.retryFailedTitle", "props.onRequeueFailedTasks(activeQueue.id)", "Batch queue retry-failed button"),
    ("batch.action.saveTemplateTitle", "props.onSaveTemplate(activeQueue.id)", "Batch queue save-template button"),
    ("batch.template.applyTitle", "props.onApplyTemplate(template.id)", "Batch queue apply-template button"),
    ("batch.template.deleteTitle", "props.onDeleteTemplate(template.id)", "Batch queue delete-template button"),
    ("batch.task.requeueTitle", "props.onRequeueTask(task.queueId, task.id)", "Batch queue task requeue button"),
    ("batch.task.executeTitle", "props.onExecuteTask(task.queueId, task.id)", "Batch queue task execute button"),
    ("batch.task.cancelTitle", "props.onCancelTask(task.queueId, task.id)", "Batch queue task cancel button"),
    ("batch.task.deleteTitle", "props.onDeleteTask(task.queueId, task.id)", "Batch queue task delete button"),
]:
    button_src = button_source_with_marker(batch_queue_page_src, marker, label)
    assert binding in button_src, f"{label} callback binding missing: {binding}"

for key in [
    "batch.title",
    "batch.task.execute",
    "batch.task.requeue",
    "batch.task.delete",
    "batch.action.pauseTitle",
]:
    assert key in i18n_src, f"Batch queue translation fixture missing: {key}"

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
    "PROMPT_TEMPLATE_CATEGORIES",
    "templateToolbar",
    "promptLibraryLayout",
    "promptTemplateDetail",
    "toggleTemplateFavorite",
    "markTemplateUsed",
    "copyTemplate",
]:
    assert term in prompt_templates_src, f"Extracted prompt templates interaction missing: {term}"
for term in ["loadPromptTemplates", "savePromptTemplates", "createPromptTemplateFromInspiration"]:
    assert term in app_src, f"App prompt-template bridge missing: {term}"
assert "onUseTemplate=" in app_src, "App shell should keep the prompt-template apply callback"

for term in [
    "FREE_PLATFORMS",
    "FREE_PLATFORM_PREFS_KEY",
    "FREE_PLATFORM_LOGO_CACHE_KEY",
    "toggleFavorite",
    "startImportWebResult",
    "onCopyPromptAndOpen",
]:
    assert term in free_generation_src, f"Extracted free generation interaction missing: {term}"
for term in [
    "free.import.tag.freePlatform",
    "openExternalUrl(platform.url)",
    "freePlatformMessage",
]:
    assert term in app_src, f"App free generation bridge missing: {term}"
free_generation_bridge_src = source_between(
    app_src,
    "async function copyPromptAndOpenPlatform",
    "async function refreshModels",
    "Free generation App bridge",
)
for term in [
    "buildFreePlatformPrompt(platform, prompt)",
    "navigator.clipboard?.writeText",
    "openExternalUrl(platform.url)",
    "importInspirationAsset({",
    "setIsInspirationPageMounted(true)",
    "setInspirationImportVersion((version) => version + 1)",
]:
    assert term in free_generation_bridge_src, f"Free generation App bridge responsibility missing: {term}"
for callback in [
    "onCopyPrompt={copyPromptForPlatform}",
    "onOpenPlatform={openPlatform}",
    "onCopyPromptAndOpen={copyPromptAndOpenPlatform}",
    "onImportWebResult={importWebResultFromPlatform}",
]:
    assert callback in app_src, f"App shell free generation callback mapping missing: {callback}"

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
    "providerServiceRegionText",
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
    assert term in app_src or term in provider_presentation_src or term in provider_service_catalog_src or term in i18n_src, f"Provider diagnostics v1 missing: {term}"
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
