import {
  Clock3,
  Copy,
  Database,
  Download,
  ExternalLink,
  FolderOpen,
  Gauge,
  Gift,
  Globe2,
  HardDrive,
  Image,
  ImagePlus,
  Info,
  Keyboard,
  Layers,
  Maximize2,
  Monitor,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Sidebar,
  Sparkles,
  Bookmark,
  Sun,
  Moon,
  Trash2,
  Upload,
  Wand2,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type WheelEvent } from 'react';
import type { InspirationAsset } from '../domain/inspirationTypes';
import type { GenerationRecord, ProviderCapabilityStatus, ReferenceImage } from '../domain/providerTypes';
import { listProviders } from '../providers/registry';
import {
  chooseLibraryDir,
  deleteProviderSecret,
  getProviderSecretStatus,
  exportSettingsBackup,
  generateOpenAIImage,
  getStorageSettings,
  revealAppDataDir,
  isTauriRuntime,
  listOpenAICompatibleModels,
  openExternalUrl,
  revealGenerationFile,
  revealLibraryDir,
  saveGenerationRecord,
  saveProviderSecret,
  saveStorageSettings,
  type StorageSettings
} from '../services/desktopApi';
import {
  defaultEndpointForProtocol,
  defaultOpenAICompatibleConfig,
  exportProviderConfigMap,
  applyProviderConfigPreset,
  loadProviderConfig,
  normalizeProviderConfig,
  parseProviderConfigImport,
  parseExtraHeaders,
  saveProviderConfig,
  serializeProviderConfig,
  PROVIDER_CONFIG_PRESETS,
  type OpenAICompatibleConfig
} from '../services/providerConfig';
import {
  DEFAULT_COUNT_OPTIONS,
  DEFAULT_QUALITY_OPTIONS,
  DEFAULT_SIZE_OPTIONS,
  GENERATOR_ACCENT_OPTIONS,
  getRecommendedGlobalAccent,
  OUTPUT_FORMAT_OPTIONS,
  PRIMARY_ACCENT_OPTIONS,
  PROMPT_HISTORY_LIMIT_OPTIONS,
  PROMPT_POLISH_ENGINE_OPTIONS,
  PROMPT_POLISH_LANGUAGE_OPTIONS,
  PROMPT_POLISH_PROTOCOL_OPTIONS,
  PROMPT_POLISH_STRENGTH_OPTIONS,
  REFRESH_INTERVAL_OPTIONS,
  REVIEW_MODE_OPTIONS,
  STARTUP_PAGE_OPTIONS,
  loadAppSettings,
  saveAppSettings,
  type AppPage,
  type AppSettings,
  type GenerationDefaults,
  type PromptHistorySettings,
  type PromptPolishSettings,
  type ThemeMode
} from '../services/appSettings';
import { POLISH_MODES } from '../services/promptAssist';
import {
  PROMPT_TEMPLATE_CATEGORIES,
  loadPromptTemplates,
  savePromptTemplates,
  type PromptTemplate
} from '../services/promptTemplates';
import { FREE_PLATFORMS, type FreePlatform } from '../services/freePlatforms';
import { useStudioStore } from '../store/useStudioStore';
import { ModernGeneratePage } from './GeneratePage';
import { InspirationPage } from './InspirationPage';
import { StudioSelect } from './StudioSelect';

type Page = AppPage;
type ProviderDiagnosticLevel = 'pass' | 'warn' | 'fail' | 'info';
type LibraryTimeFilter = 'all' | 'today' | '7d' | '30d';
type ProviderDiagnosticItem = {
  id: string;
  label: string;
  detail: string;
  level: ProviderDiagnosticLevel;
};

const statusLabel: Record<ProviderCapabilityStatus, string> = {
  supported: '支持',
  partial: '部分',
  planned: '规划',
  unknown: '待确认',
  unsupported: '不支持'
};


const GITHUB_REPOSITORY_URL = 'https://github.com/BlueSummer2333/VisionHub-Studio';
const GITHUB_RELEASES_URL = `${GITHUB_REPOSITORY_URL}/releases`;

type UtilityModal = 'system-info' | 'shortcuts' | null;
type GenerateShortcutName = 'submit' | 'focus-prompt' | 'add-reference' | 'clear-references' | 'mode-image' | 'mode-text';

const generateShortcutEventName: Record<GenerateShortcutName, string> = {
  submit: 'visionhub:generate-submit',
  'focus-prompt': 'visionhub:generate-focus-prompt',
  'add-reference': 'visionhub:generate-add-reference',
  'clear-references': 'visionhub:generate-clear-references',
  'mode-image': 'visionhub:generate-mode-image',
  'mode-text': 'visionhub:generate-mode-text'
};

const libraryFocusSearchEvent = 'visionhub:library-focus-search';

const shortcutGroups: Array<{ title: string; items: Array<{ keys: string[]; action: string }> }> = [
  {
    title: '全局',
    items: [
      { keys: ['Ctrl', '/'], action: '打开快捷键说明' },
      { keys: ['Ctrl', 'B'], action: '展开 / 收起侧边栏' },
      { keys: ['Ctrl', ','], action: '打开平台接入' },
      { keys: ['Ctrl', '1'], action: '打开 AI 创作' },
      { keys: ['Ctrl', '2'], action: '打开免费平台' },
      { keys: ['Ctrl', '3'], action: '打开作品画廊' },
      { keys: ['Ctrl', '4'], action: '打开灵感中心' },
      { keys: ['Ctrl', '5'], action: '打开提示词库' },
      { keys: ['Ctrl', '6'], action: '打开平台接入' },
      { keys: ['Ctrl', '7'], action: '打开偏好设置' },
      { keys: ['Esc'], action: '关闭浮窗 / 关闭图片预览' }
    ]
  },
  {
    title: 'AI 创作',
    items: [
      { keys: ['Ctrl', 'Enter'], action: '提交当前生成任务' },
      { keys: ['Ctrl', 'K'], action: '聚焦 Prompt 输入框' },
      { keys: ['Ctrl', 'Shift', 'R'], action: '添加参考图' },
      { keys: ['Ctrl', 'Shift', 'C'], action: '清空参考图' },
      { keys: ['Ctrl', 'Shift', 'I'], action: '切换到图生图' },
      { keys: ['Ctrl', 'Shift', 'T'], action: '切换到文生图' }
    ]
  },
  {
    title: '作品画廊 / 数据',
    items: [
      { keys: ['Ctrl', 'F'], action: '聚焦作品画廊搜索框' },
      { keys: ['Ctrl', 'O'], action: '打开作品画廊目录' },
      { keys: ['Ctrl', 'E'], action: '导出设置备份' }
    ]
  },
  {
    title: '图片预览',
    items: [
      { keys: ['+'], action: '放大预览图' },
      { keys: ['-'], action: '缩小预览图' },
      { keys: ['0'], action: '重置缩放和位置' },
      { keys: ['Space'], action: '重置缩放和位置' },
      { keys: ['Esc'], action: '关闭预览' }
    ]
  }
];

export function App() {
  const providers = useMemo(() => listProviders(), []);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadAppSettings());
  const [page, setPage] = useState<Page>(() => appSettings.startupPage);
  const [secretDraft, setSecretDraft] = useState('');
  const [secretAvailable, setSecretAvailable] = useState(false);
  const [secretMessage, setSecretMessage] = useState('');
  const [providerConfig, setProviderConfig] = useState<OpenAICompatibleConfig>(
    defaultOpenAICompatibleConfig
  );
  const [configMessage, setConfigMessage] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [activeUtilityModal, setActiveUtilityModal] = useState<UtilityModal>(null);
  const [freePlatformMessage, setFreePlatformMessage] = useState('');
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [isRunningTestGeneration, setIsRunningTestGeneration] = useState(false);
  const [providerDiagnostics, setProviderDiagnostics] = useState<ProviderDiagnosticItem[]>([]);
  const [generatePreviewUrl, setGeneratePreviewUrl] = useState<string | null>(null);
  const [libraryPreviewUrl, setLibraryPreviewUrl] = useState<string | null>(null);
  const [inspirationPreviewUrl, setInspirationPreviewUrl] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => appSettings.sidebarCollapsed);
  const [storageSettings, setStorageSettings] = useState<StorageSettings | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [generateSessionStartedAt] = useState(() => Date.now());
  const themeMode = appSettings.themeMode;

  const {
    selectedProviderId,
    selectedModelId,
    prompt,
    count,
    size,
    quality,
    isGenerating,
    isHistoryLoaded,
    results,
    addResult,
    removeResult,
    loadHistory,
    setSelectedProvider,
    setPrompt,
    setCount,
    setSize,
    setQuality,
    setSelectedModel,
    generate
  } = useStudioStore();

  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? providers[0];
  const desktopRuntime = isTauriRuntime();
  const supportsOpenAICompatible =
    selectedProviderId === 'openai-gpt-image' || selectedProviderId === 'custom-http-provider';
  const isRealProviderReady = desktopRuntime && supportsOpenAICompatible && secretAvailable;

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!desktopRuntime) return;
    let isActive = true;
    getStorageSettings()
      .then((settings) => {
        if (!isActive || !settings) return;
        setStorageSettings(settings);
      })
      .catch((error) => {
        if (isActive) setSettingsMessage(error instanceof Error ? error.message : String(error));
      });

    return () => {
      isActive = false;
    };
  }, [desktopRuntime]);

  useEffect(() => {
    setSecretDraft('');
    setSecretMessage('');
    setConfigMessage('');
    setProviderDiagnostics([]);
    const config = loadProviderConfig(selectedProviderId);
    setProviderConfig(config);
    if (supportsOpenAICompatible) setSelectedModel(config.modelId);

    if (!desktopRuntime) {
      setSecretAvailable(false);
      return;
    }

    void getProviderSecretStatus(selectedProviderId)
      .then((status) => setSecretAvailable(status.available))
      .catch(() => setSecretAvailable(false));
  }, [desktopRuntime, selectedProviderId, setSelectedModel, supportsOpenAICompatible]);

  function selectProvider(providerId: string) {
    setSelectedProvider(providerId);
  }

  function navigateTo(nextPage: Page) {
    setGeneratePreviewUrl(null);
    setLibraryPreviewUrl(null);
    setInspirationPreviewUrl(null);
    setPage(nextPage);
  }

  function dispatchGenerateShortcut(shortcut: GenerateShortcutName) {
    const eventName = generateShortcutEventName[shortcut];
    if (page !== 'generate') {
      navigateTo('generate');
      window.setTimeout(() => window.dispatchEvent(new Event(eventName)), 0);
      return;
    }
    window.dispatchEvent(new Event(eventName));
  }

  function focusLibrarySearch() {
    if (page !== 'library') {
      navigateTo('library');
      window.setTimeout(() => window.dispatchEvent(new Event(libraryFocusSearchEvent)), 0);
      return;
    }
    window.dispatchEvent(new Event(libraryFocusSearchEvent));
  }

  async function checkForUpdates() {
    try {
      await openExternalUrl(GITHUB_RELEASES_URL);
      setSettingsMessage('\u5df2\u6253\u5f00 GitHub Releases\u3002');
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function isEditableShortcutTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
  }

  function handleGlobalShortcut(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    const primaryModifier = event.ctrlKey || event.metaKey;
    const isEditableTarget = isEditableShortcutTarget(event.target);

    if (activeUtilityModal) {
      if (key === 'escape') {
        event.preventDefault();
        setActiveUtilityModal(null);
      }
      return;
    }

    if (key === 'escape' && (generatePreviewUrl || libraryPreviewUrl || inspirationPreviewUrl)) {
      event.preventDefault();
      setGeneratePreviewUrl(null);
      setLibraryPreviewUrl(null);
      setInspirationPreviewUrl(null);
      return;
    }

    if (!primaryModifier || event.altKey) return;

    if (key === '/' || key === '?') {
      event.preventDefault();
      setActiveUtilityModal('shortcuts');
      return;
    }

    if (key === 'enter') {
      event.preventDefault();
      dispatchGenerateShortcut('submit');
      return;
    }

    if (key === 'k') {
      event.preventDefault();
      dispatchGenerateShortcut('focus-prompt');
      return;
    }

    if (event.shiftKey && key === 'r') {
      event.preventDefault();
      dispatchGenerateShortcut('add-reference');
      return;
    }

    if (event.shiftKey && key === 'c') {
      event.preventDefault();
      dispatchGenerateShortcut('clear-references');
      return;
    }

    if (event.shiftKey && key === 'i') {
      event.preventDefault();
      dispatchGenerateShortcut('mode-image');
      return;
    }

    if (event.shiftKey && key === 't') {
      event.preventDefault();
      dispatchGenerateShortcut('mode-text');
      return;
    }

    if (isEditableTarget) return;

    if (key === 'b') {
      event.preventDefault();
      updateSidebarCollapsed(!isSidebarCollapsed);
      return;
    }

    if (key === ',') {
      event.preventDefault();
      navigateTo('providers');
      return;
    }

    const pageShortcuts: Record<string, Page> = {
      '1': 'generate',
      '2': 'free',
      '3': 'library',
      '4': 'inspiration',
      '5': 'templates',
      '6': 'providers',
      '7': 'settings'
    };
    const shortcutPage = pageShortcuts[key];
    if (shortcutPage) {
      event.preventDefault();
      navigateTo(shortcutPage);
      return;
    }

    if (key === 'f') {
      event.preventDefault();
      focusLibrarySearch();
      return;
    }

    if (key === 'o') {
      event.preventDefault();
      void openLibraryDirectory();
      return;
    }

    if (key === 'e') {
      event.preventDefault();
      void exportCurrentSettingsBackup();
    }
  }

  function generationRecordToReference(record: GenerationRecord): ReferenceImage | null {
    const imageUrl = record.imageUrls[0];
    if (!imageUrl) return null;
    return {
      id: `generated-${record.id}-${Date.now()}`,
      name: record.providerName ? `${record.providerName} 生成图` : '生成结果',
      mimeType: imageUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : imageUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/png',
      dataUrl: imageUrl.startsWith('data:image/') ? imageUrl : undefined,
      localPath: record.localImagePaths?.[0],
      previewUrl: imageUrl,
      source: 'generated-result',
      sourceGenerationId: record.id
    };
  }

  function useRecordAsReference(record: GenerationRecord) {
    const reference = generationRecordToReference(record);
    if (!reference) return;
    setReferenceImages((current) => [
      reference,
      ...current.filter((item) => item.sourceGenerationId !== record.id)
    ].slice(0, 4));
    setGeneratePreviewUrl(null);
    setLibraryPreviewUrl(null);
    setInspirationPreviewUrl(null);
    navigateTo('generate');
  }

  function useInspirationAssetAsReference(asset: InspirationAsset) {
    if (!asset.imageUrl) return;
    const reference: ReferenceImage = {
      id: `inspiration-${asset.id}-${Date.now()}`,
      name: asset.title || '灵感收藏',
      mimeType: asset.imageUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : asset.imageUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/png',
      dataUrl: asset.imageUrl.startsWith('data:image/') ? asset.imageUrl : undefined,
      localPath: asset.imagePath,
      previewUrl: asset.imageUrl,
      source: 'inspiration'
    };
    setReferenceImages((current) => [
      reference,
      ...current.filter((item) => item.id !== reference.id)
    ].slice(0, 4));
    setPrompt(asset.originalPrompt || asset.inferredPrompt || prompt);
    setGeneratePreviewUrl(null);
    setLibraryPreviewUrl(null);
    setInspirationPreviewUrl(null);
    navigateTo('generate');
  }

  function useInspirationPrompt(promptText: string) {
    if (!promptText.trim()) return;
    setPrompt(promptText);
    navigateTo('generate');
  }

  function createPromptTemplateFromInspiration(title: string, promptText: string, tags: string[]) {
    const trimmedPrompt = promptText.trim();
    if (!trimmedPrompt) return '没有可用 Prompt。';
    const templates = loadPromptTemplates();
    const template: PromptTemplate = {
      id: `inspiration-${Date.now()}`,
      title: title.trim() || '灵感模板',
      category: 'style',
      tone: '来自灵感中心收藏',
      prompt: trimmedPrompt,
      tags: tags.length ? tags : ['灵感中心']
    };
    savePromptTemplates([template, ...templates.filter((item) => item.prompt !== trimmedPrompt)].slice(0, 200));
    return '已转入提示词库。';
  }

  function updateAppSettings(patch: Partial<AppSettings>) {
    if (typeof patch.sidebarCollapsed === 'boolean') {
      setIsSidebarCollapsed(patch.sidebarCollapsed);
    }
    setAppSettings((current) => saveAppSettings({ ...current, ...patch }));
  }

  function updateThemeMode(mode: ThemeMode) {
    updateAppSettings({ themeMode: mode });
  }

  function toggleThemeMode() {
    updateThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  }

  function updateSidebarCollapsed(nextCollapsed: boolean) {
    setIsSidebarCollapsed(nextCollapsed);
    updateAppSettings({ sidebarCollapsed: nextCollapsed });
  }


  useEffect(() => {
    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [activeUtilityModal, page, generatePreviewUrl, libraryPreviewUrl, inspirationPreviewUrl, isSidebarCollapsed, desktopRuntime, appSettings]);

  async function openLibraryDirectory() {
    if (!desktopRuntime) {
      setSettingsMessage('请在 Tauri 桌面端打开作品画廊目录。');
      return;
    }
    try {
      await revealLibraryDir();
      setSettingsMessage('已打开作品画廊目录。');
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function openAppDataDirectory() {
    if (!desktopRuntime) {
      setSettingsMessage('请在 Tauri 桌面端打开数据目录。');
      return;
    }
    try {
      await revealAppDataDir();
      setSettingsMessage('已打开应用数据目录。');
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function selectLibraryDirectory() {
    if (!desktopRuntime) {
      setSettingsMessage('请在 Tauri 桌面端修改本地图库路径。');
      return;
    }
    try {
      const nextSettings = await chooseLibraryDir();
      if (!nextSettings) {
        setSettingsMessage('已取消选择图库目录。');
        return;
      }
      setStorageSettings(nextSettings);
      setSettingsMessage(`图库目录已切换：${nextSettings.resolved_library_dir}`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function resetLibraryDirectoryOverride() {
    if (!desktopRuntime) {
      setSettingsMessage('请在 Tauri 桌面端修改本地图库路径。');
      return;
    }
    try {
      const nextSettings = await saveStorageSettings(undefined);
      setStorageSettings(nextSettings);
      setSettingsMessage(`已恢复默认图库目录：${nextSettings.resolved_library_dir}`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function exportCurrentSettingsBackup() {
    if (!desktopRuntime) {
      setSettingsMessage('请在 Tauri 桌面端导出设置备份。');
      return;
    }
    try {
      const result = await exportSettingsBackup({
        appSettings,
        providerConfigs: exportProviderConfigMap()
      });
      setSettingsMessage(`已导出设置备份：${result.path}`);
      await revealGenerationFile(result.path);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function handleConfigChange<K extends keyof OpenAICompatibleConfig>(
    key: K,
    value: OpenAICompatibleConfig[K]
  ) {
    setProviderConfig((current) => {
      if (key === 'protocol') {
        const protocol = value as OpenAICompatibleConfig['protocol'];
        return { ...current, protocol, endpointPath: defaultEndpointForProtocol(protocol) };
      }
      return { ...current, [key]: value };
    });
    if (key === 'modelId') setSelectedModel(String(value));
  }

  function saveCurrentProviderConfig() {
    try {
      parseExtraHeaders(providerConfig.extraHeadersJson);
      new URL(providerConfig.baseUrl);
      if (!providerConfig.endpointPath.startsWith('/')) {
        throw new Error('接口路径必须以 / 开头。');
      }
      const normalizedConfig = normalizeProviderConfig(providerConfig);
      saveProviderConfig(selectedProviderId, normalizedConfig);
      setProviderConfig(normalizedConfig);
      setSelectedModel(normalizedConfig.modelId);
      setConfigMessage('中转配置已保存。');
    } catch (error) {
      setConfigMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function applyCurrentProviderPreset(presetId: string) {
    const nextConfig = applyProviderConfigPreset(providerConfig, presetId);
    setProviderConfig(nextConfig);
    setSelectedModel(nextConfig.modelId);
    setConfigMessage('已套用预设，请确认 Base URL 和模型后保存。');
  }

  async function copyCurrentProviderConfig() {
    try {
      await navigator.clipboard?.writeText(serializeProviderConfig(providerConfig));
      setConfigMessage('当前 Provider 配置已复制，API Key 不会包含在导出内容中。');
    } catch (error) {
      setConfigMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function importProviderConfigFromClipboard() {
    try {
      const text = await navigator.clipboard?.readText();
      if (!text?.trim()) throw new Error('剪贴板里没有可导入的 Provider JSON。');
      const importedConfig = parseProviderConfigImport(text);
      setProviderConfig(importedConfig);
      setSelectedModel(importedConfig.modelId);
      setConfigMessage('已从剪贴板导入 Provider 配置，请确认后保存。');
    } catch (error) {
      setConfigMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function pinCurrentModelAsDefault() {
    try {
      const normalizedConfig = normalizeProviderConfig(providerConfig);
      saveProviderConfig(selectedProviderId, normalizedConfig);
      setProviderConfig(normalizedConfig);
      setSelectedModel(normalizedConfig.modelId);
      setConfigMessage(`已将 ${normalizedConfig.modelId} 设为默认模型。`);
    } catch (error) {
      setConfigMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function copyPromptAndOpenPlatform(platform: FreePlatform) {
    try {
      if (!prompt.trim()) throw new Error('请先在 AI 创作里写好 Prompt。');
      await navigator.clipboard?.writeText(prompt);
      await openExternalUrl(platform.url);
      setFreePlatformMessage(`已复制 Prompt，并打开 ${platform.name}。`);
    } catch (error) {
      setFreePlatformMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function copyPromptForPlatform(platform: FreePlatform) {
    try {
      if (!prompt.trim()) throw new Error('请先在 AI 创作里写好 Prompt。');
      await navigator.clipboard?.writeText(prompt);
      setFreePlatformMessage(`已复制 Prompt，可粘贴到 ${platform.name}。`);
    } catch (error) {
      setFreePlatformMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function openPlatform(platform: FreePlatform) {
    try {
      await openExternalUrl(platform.url);
      setFreePlatformMessage(`已打开 ${platform.name}。`);
    } catch (error) {
      setFreePlatformMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveSecret() {
    if (!desktopRuntime) {
      setSecretMessage('当前是网页预览模式，只有 Tauri 桌面端会写入系统凭据。');
      return;
    }
    try {
      const status = await saveProviderSecret(selectedProviderId, secretDraft);
      setSecretAvailable(status.available);
      setSecretDraft('');
      setSecretMessage('API Key 已保存到系统安全凭据。');
    } catch (error) {
      setSecretMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function deleteSecret() {
    if (!desktopRuntime) return;
    const status = await deleteProviderSecret(selectedProviderId);
    setSecretAvailable(status.available);
    setSecretMessage('API Key 已删除。');
  }

  async function refreshModels() {
    if (!desktopRuntime) {
      setConfigMessage('请在 Tauri 桌面端刷新模型列表。');
      return;
    }
    if (!secretAvailable) {
      setConfigMessage('请先保存 API Key，再刷新模型列表。');
      return;
    }

    setIsRefreshingModels(true);
    setConfigMessage('正在刷新模型列表…');
    try {
      const models = await listOpenAICompatibleModels(
        selectedProviderId,
        providerConfig.baseUrl,
        parseExtraHeaders(providerConfig.extraHeadersJson)
      );
      const modelOptions = models.map((model) => model.id);
      const nextModelId =
        modelOptions.find((id) => id === providerConfig.modelId) ??
        modelOptions.find((id) => id.toLowerCase().includes('image')) ??
        modelOptions[0] ??
        providerConfig.modelId;
      const nextConfig = { ...providerConfig, modelOptions, modelId: nextModelId };
      setProviderConfig(nextConfig);
      saveProviderConfig(selectedProviderId, nextConfig);
      setSelectedModel(nextModelId);
      setConfigMessage(`已刷新 ${modelOptions.length} 个模型。`);
    } catch (error) {
      setConfigMessage(mapProviderErrorMessage(error));
    } finally {
      setIsRefreshingModels(false);
    }
  }

  async function runProviderDiagnostics() {
    setIsRunningDiagnostics(true);
    const checks: ProviderDiagnosticItem[] = [];

    function push(item: ProviderDiagnosticItem) {
      checks.push(item);
      setProviderDiagnostics([...checks]);
    }

    try {
      push({
        id: 'runtime',
        label: '桌面运行环境',
        level: desktopRuntime ? 'pass' : 'warn',
        detail: desktopRuntime ? '已在 Tauri 桌面端运行，可访问系统凭据与本地目录。' : '当前像是网页预览模式，真实密钥、文件夹和网络诊断不可用。'
      });

      push({
        id: 'adapter',
        label: 'Provider 接入状态',
        level: supportsOpenAICompatible ? 'pass' : 'info',
        detail: supportsOpenAICompatible ? '当前 Provider 支持 OpenAI-compatible 官方/中转配置。' : '当前 Provider 仍是路线图占位，暂不支持真实连通性诊断。'
      });

      if (!supportsOpenAICompatible) return;

      let endpointPreview = '';
      try {
        const baseUrl = new URL(providerConfig.baseUrl);
        endpointPreview = `${baseUrl.origin}${providerConfig.endpointPath.startsWith('/') ? providerConfig.endpointPath : `/${providerConfig.endpointPath}`}`;
        push({
          id: 'base-url',
          label: 'Base URL',
          level: 'pass',
          detail: `格式有效：${baseUrl.origin}`
        });
      } catch {
        push({
          id: 'base-url',
          label: 'Base URL',
          level: 'fail',
          detail: 'Base URL 不是有效网址，请使用 https://api.openai.com 或中转站根地址。'
        });
      }

      try {
        parseExtraHeaders(providerConfig.extraHeadersJson);
        push({
          id: 'headers',
          label: '额外 Headers',
          level: 'pass',
          detail: 'JSON 格式有效。'
        });
      } catch (error) {
        push({
          id: 'headers',
          label: '额外 Headers',
          level: 'fail',
          detail: error instanceof Error ? error.message : String(error)
        });
      }

      push({
        id: 'secret',
        label: 'API Key',
        level: secretAvailable ? 'pass' : 'warn',
        detail: secretAvailable ? '系统安全凭据里已有密钥。' : '尚未保存密钥；可以先保存 API Key，再刷新模型或生成图片。'
      });

      push({
        id: 'protocol',
        label: '协议与接口路径',
        level: providerConfig.protocol === 'custom-images' || providerConfig.endpointPath === defaultEndpointForProtocol(providerConfig.protocol) ? 'pass' : 'warn',
        detail: `当前协议：${providerConfig.protocol}；目标接口：${endpointPreview || providerConfig.endpointPath}`
      });

      if (!desktopRuntime || !secretAvailable) {
        push({
          id: 'network',
          label: '模型列表连通性',
          level: 'info',
          detail: '需要桌面端和已保存密钥后才能执行在线模型列表诊断。'
        });
        return;
      }

      const models = await listOpenAICompatibleModels(
        selectedProviderId,
        providerConfig.baseUrl,
        parseExtraHeaders(providerConfig.extraHeadersJson)
      );
      const imageModelCount = models.filter((model) => model.id.toLowerCase().includes('image')).length;
      push({
        id: 'models',
        label: '模型列表连通性',
        level: models.length > 0 ? 'pass' : 'warn',
        detail: models.length > 0 ? `成功读取 ${models.length} 个模型，其中 ${imageModelCount} 个 ID 包含 image。` : '接口可调用但没有返回模型，请检查中转站是否支持 /v1/models。'
      });
    } catch (error) {
      push({
        id: 'network-error',
        label: '在线诊断错误',
        level: 'fail',
        detail: mapProviderErrorMessage(error)
      });
    } finally {
      setIsRunningDiagnostics(false);
    }
  }

  async function runProviderTestGeneration() {
    if (!supportsOpenAICompatible) {
      setConfigMessage('当前 Provider 还没有真实图片生成 Adapter，暂不能测试生成。');
      return;
    }
    if (!desktopRuntime) {
      setConfigMessage('测试生成需要 Tauri 桌面端运行时。');
      return;
    }
    if (!secretAvailable) {
      setConfigMessage('请先保存 API Key，再执行测试生成。');
      return;
    }

    setIsRunningTestGeneration(true);
    setConfigMessage('正在调用真实接口生成 1 张测试小样…');
    try {
      const normalizedConfig = normalizeProviderConfig(providerConfig);
      new URL(normalizedConfig.baseUrl);
      const extraHeaders = parseExtraHeaders(normalizedConfig.extraHeadersJson);
      if (!normalizedConfig.endpointPath.startsWith('/')) {
        throw new Error('接口路径必须以 / 开头。');
      }

      saveProviderConfig(selectedProviderId, normalizedConfig);
      setProviderConfig(normalizedConfig);
      setSelectedModel(normalizedConfig.modelId);

      const result = await generateOpenAIImage({
        providerId: selectedProviderId,
        modelId: normalizedConfig.modelId,
        prompt:
          'VisionHub Studio provider test image, a clean minimal glowing glass cube on a dark desk, soft studio light, square composition, no text',
        count: 1,
        size: '1024x1024',
        quality: 'auto',
        baseUrl: normalizedConfig.baseUrl,
        protocol: normalizedConfig.protocol,
        endpointPath: normalizedConfig.endpointPath,
        extraHeaders,
        metadata: { source: 'provider-hub-test-generation' }
      });
      const saved = await saveGenerationRecord(result, selectedProvider.name);
      addResult(saved);

      if (saved.status === 'succeeded' && saved.imageUrls[0]) {
        setPage('providers');
        setGeneratePreviewUrl(null);
        setLibraryPreviewUrl(null);
        setConfigMessage('测试生成成功：已生成 1 张小样图，并自动保存到作品画廊。');
      } else {
        setConfigMessage(`测试生成未成功：${mapProviderErrorMessage(saved.error ?? '接口没有返回图片。')} 已写入作品画廊失败记录。`);
      }
    } catch (error) {
      setConfigMessage(mapProviderErrorMessage(error));
    } finally {
      setIsRunningTestGeneration(false);
    }
  }

  const navItems: Array<{ page: Page; label: string; icon: ReactNode }> = [
    { page: 'generate', label: 'AI 创作', icon: <Wand2 size={18} /> },
    { page: 'free', label: '免费平台', icon: <Gift size={18} /> },
    { page: 'library', label: '作品画廊', icon: <Image size={18} /> },
    { page: 'inspiration', label: '灵感中心', icon: <Bookmark size={18} /> },
    { page: 'templates', label: '提示词库', icon: <Layers size={18} /> },
    { page: 'providers', label: '平台接入', icon: <Database size={18} /> },
    { page: 'settings', label: '偏好设置', icon: <Settings size={18} /> }
  ];

  const appShellStyle = {
    '--app-primary': appSettings.primaryAccent,
    '--app-purple': appSettings.primaryAccent,
    '--app-accent': appSettings.generatorAccent,
    '--app-accent-strong': appSettings.generatorAccent,
    '--generator-accent': appSettings.generatorAccent
  } as CSSProperties;

  return (
    <div
      className={`appShell theme-${themeMode} ${isSidebarCollapsed ? 'sidebarCollapsed' : ''}`}
      style={appShellStyle}
    >
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">
            <Sparkles size={22} />
          </div>
          <div className="brandText">
            <strong>VisionHub Studio</strong>
            <span>{'AI \u751f\u56fe\u5de5\u4f5c\u53f0'}</span>
          </div>
          
        </div>

        <nav className="navGroup">
          {navItems.map((item) => (
            <button
              key={item.page}
              className={`navItem ${page === item.page ? 'active' : ''}`}
              data-tooltip={item.label}
              title={isSidebarCollapsed ? item.label : undefined}
              onClick={() => navigateTo(item.page)}
            >
              {item.icon} <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebarDock">
          <div className="sectionTitle">工作区</div>
          <div className="dockCard">
            <strong>当前任务</strong>
            <span>AI 创作、作品画廊、提示词库与平台接入从左侧导航进入。</span>
          </div>
          <div className="dockCard subtle">
            <strong>后续预留</strong>
            <span>项目资产库、批量队列、多模型对比会放在这里。</span>
          </div>
        </div>
        <div className="sidebarFooter">
          <button
            className="themeToggle"
            type="button"
            data-tooltip={themeMode === 'dark' ? '切换浅色模式' : '切换暗色模式'}
            title={themeMode === 'dark' ? '切换浅色模式' : '切换暗色模式'}
            onClick={toggleThemeMode}
          >
            {themeMode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{themeMode === 'dark' ? '暗色模式' : '浅色模式'}</span>
          </button>
          <button
            className="sidebarCollapseButton"
            type="button"
            data-tooltip={isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            title={isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            onClick={() => updateSidebarCollapsed(!isSidebarCollapsed)}
          >
            <Sidebar size={17} />
            <span>{isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}</span>
          </button>
        </div>
      </aside>

      <main className={`workspace ${page === 'generate' ? 'workspaceGenerate' : ''}`}>
        {page === 'generate' ? (
          <>
            <ModernGeneratePage
              providers={providers}
              selectedProvider={selectedProvider}
              selectedProviderId={selectedProviderId}
              supportsOpenAICompatible={supportsOpenAICompatible}
              isRealProviderReady={isRealProviderReady}
              providerConfig={providerConfig}
              selectedModelId={selectedModelId}
              prompt={prompt}
              count={count}
              size={size}
              quality={quality}
              isGenerating={isGenerating}
              results={results}
              isHistoryLoaded={isHistoryLoaded}
              defaultMode={appSettings.generationDefaults.defaultMode}
              defaultOutputFormat={appSettings.generationDefaults.outputFormat}
              defaultReviewMode={appSettings.generationDefaults.reviewMode}
              promptHistorySettings={appSettings.promptHistory}
              promptPolishSettings={appSettings.promptPolish}
              sessionStartedAtMs={generateSessionStartedAt}
              onProviderChange={selectProvider}
              onModelChange={(modelId) => {
                if (supportsOpenAICompatible) handleConfigChange('modelId', modelId);
                else setSelectedModel(modelId);
              }}
              onPromptChange={setPrompt}
              onCountChange={setCount}
              onSizeChange={setSize}
              onQualityChange={setQuality}
              onGenerate={generate}
              onPreview={setGeneratePreviewUrl}
              referenceImages={referenceImages}
              onReferenceImagesChange={setReferenceImages}
            />
            {generatePreviewUrl ? (
              <ImagePreviewModal imageUrl={generatePreviewUrl} onClose={() => setGeneratePreviewUrl(null)} />
            ) : null}
          </>
        ) : page === 'free' ? (
          <FreeGenerationPage
            prompt={prompt}
            message={freePlatformMessage}
            onCopyPrompt={copyPromptForPlatform}
            onOpenPlatform={openPlatform}
            onCopyPromptAndOpen={copyPromptAndOpenPlatform}
            onImportLibrary={() => {
              navigateTo('library');
              setFreePlatformMessage('请把网页下载的图片拖入或通过后续导入入口加入作品画廊。');
            }}
          />
        ) : page === 'providers' ? (
          <ProviderSettingsPage
            providers={providers}
            selectedProvider={selectedProvider}
            selectedProviderId={selectedProviderId}
            desktopRuntime={desktopRuntime}
            secretAvailable={secretAvailable}
            secretDraft={secretDraft}
            secretMessage={secretMessage}
            providerConfig={providerConfig}
            configMessage={configMessage}
            isRefreshingModels={isRefreshingModels}
            supportsOpenAICompatible={supportsOpenAICompatible}
            onProviderChange={selectProvider}
            onSecretDraftChange={setSecretDraft}
            onSaveSecret={saveSecret}
            onDeleteSecret={deleteSecret}
            onConfigChange={handleConfigChange}
            onRefreshModels={refreshModels}
            onSaveConfig={saveCurrentProviderConfig}
            onRunDiagnostics={runProviderDiagnostics}
            onRunTestGeneration={runProviderTestGeneration}
            onApplyPreset={applyCurrentProviderPreset}
            onCopyConfig={copyCurrentProviderConfig}
            onImportConfig={importProviderConfigFromClipboard}
            onPinModel={pinCurrentModelAsDefault}
            isRunningDiagnostics={isRunningDiagnostics}
            isRunningTestGeneration={isRunningTestGeneration}
            diagnostics={providerDiagnostics}
          />
        ) : page === 'settings' ? (
          <SettingsPage
            appSettings={appSettings}
            providers={providers}
            desktopRuntime={desktopRuntime}
            settingsMessage={settingsMessage}
            storageSettings={storageSettings}
            onSettingsChange={updateAppSettings}
            onSelectLibraryPath={selectLibraryDirectory}
            onResetLibraryPath={resetLibraryDirectoryOverride}
            onOpenLibraryDirectory={openLibraryDirectory}
            onOpenAppDataDirectory={openAppDataDirectory}
            onExportSettingsBackup={exportCurrentSettingsBackup}
            onOpenSystemInfo={() => setActiveUtilityModal('system-info')}
            onOpenShortcuts={() => setActiveUtilityModal('shortcuts')}
            onCheckUpdates={checkForUpdates}
          />
        ) : page === 'library' ? (
          <>
            <LibraryPage
              providers={providers}
              results={results}
              isHistoryLoaded={isHistoryLoaded}
              onPreview={setLibraryPreviewUrl}
              onUseAsReference={useRecordAsReference}
              onDelete={async (recordId) => {
                setLibraryPreviewUrl(null);
                await removeResult(recordId);
              }}
            />
            {libraryPreviewUrl ? (
              <ImagePreviewModal imageUrl={libraryPreviewUrl} onClose={() => setLibraryPreviewUrl(null)} />
            ) : null}
          </>
        ) : page === 'inspiration' ? (
          <>
            <InspirationPage
              onPreview={setInspirationPreviewUrl}
              onUseAsReference={useInspirationAssetAsReference}
              onUsePrompt={useInspirationPrompt}
              onCreateTemplate={createPromptTemplateFromInspiration}
            />
            {inspirationPreviewUrl ? (
              <ImagePreviewModal imageUrl={inspirationPreviewUrl} onClose={() => setInspirationPreviewUrl(null)} />
            ) : null}
          </>
        ) : (
          <PromptTemplatesPage
            onUseTemplate={(templatePrompt) => {
              setPrompt(templatePrompt);
              navigateTo('generate');
            }}
          />
        )}
      </main>

      {activeUtilityModal === 'shortcuts' ? (
        <ShortcutsModal onClose={() => setActiveUtilityModal(null)} />
      ) : null}
      {activeUtilityModal === 'system-info' ? (
        <SystemInfoModal
          desktopRuntime={desktopRuntime}
          storageSettings={storageSettings}
          settingsMessage={settingsMessage}
          onClose={() => setActiveUtilityModal(null)}
        />
      ) : null}
    </div>
  );
}

function GeneratePage(props: {
  providers: ReturnType<typeof listProviders>;
  selectedProvider: ReturnType<typeof listProviders>[number];
  selectedProviderId: string;
  supportsOpenAICompatible: boolean;
  isRealProviderReady: boolean;
  providerConfig: OpenAICompatibleConfig;
  selectedModelId: string;
  prompt: string;
  count: number;
  size: string;
  quality: string;
  isGenerating: boolean;
  isHistoryLoaded: boolean;
  results: ReturnType<typeof useStudioStore.getState>['results'];
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onPromptChange: (prompt: string) => void;
  onCountChange: (count: number) => void;
  onSizeChange: (size: string) => void;
  onQualityChange: (quality: string) => void;
  onGenerate: () => void;
  onPreview: (imageUrl: string) => void;
}) {
  const modelOptions = props.supportsOpenAICompatible
    ? props.providerConfig.modelOptions.length > 0
      ? props.providerConfig.modelOptions
      : [props.providerConfig.modelId]
    : props.selectedProvider.models.map((model) => model.id);
  const modelValue = props.supportsOpenAICompatible ? props.providerConfig.modelId : props.selectedModelId;

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Generation Workspace</p>
          <h1>专注生图：选择平台、模型、尺寸和精度，然后开始生成。</h1>
        </div>
        <div className="statusPills">
          <span>
            <ShieldCheck size={15} /> {props.isRealProviderReady ? '真实通道已就绪' : '未配置密钥时使用演示模式'}
          </span>
          <span>
            <Gauge size={15} /> 当前 Provider：{props.selectedProvider.name}
          </span>
        </div>
      </header>

      <section className="generationLayout">
        <div className="composerCard">
          <div className="cardHeader">
            <div>
              <span className="badge">Create</span>
              <h2>生图控制台</h2>
            </div>
            <StudioSelect
              value={props.selectedProviderId}
              onChange={props.onProviderChange}
              options={props.providers.map((provider) => ({ value: provider.id, label: provider.name }))}
            />
          </div>

          <textarea
            className="promptInput"
            value={props.prompt}
            onChange={(event) => props.onPromptChange(event.target.value)}
            placeholder="描述你想生成的图片，例如：赛博国风海报、商业产品图、角色设定、分镜概念图…"
          />

          <div className="generationControls">
            <label>
              模型
              <StudioSelect
                value={modelValue}
                onChange={props.onModelChange}
                options={modelOptions.map((modelId) => ({ value: modelId, label: modelId }))}
              />
            </label>
            <label>
              尺寸比例
              <StudioSelect
                value={props.size}
                onChange={props.onSizeChange}
                options={[
                  { value: '1024x1024', label: '1:1 · 1024x1024' },
                  { value: '1024x1536', label: '2:3 · 1024x1536' },
                  { value: '1536x1024', label: '3:2 · 1536x1024' }
                ]}
              />
            </label>
            <label>
              精度
              <StudioSelect
                value={props.quality}
                onChange={props.onQualityChange}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'high', label: 'High' }
                ]}
              />
            </label>
            <label>
              数量
              <input
                type="number"
                min={1}
                max={4}
                value={props.count}
                onChange={(event) => props.onCountChange(Number(event.target.value))}
              />
            </label>
          </div>

          <button className="generateButton" onClick={props.onGenerate} disabled={props.isGenerating || !props.prompt.trim()}>
            <Sparkles size={18} /> {props.isGenerating ? '生成中…' : props.isRealProviderReady ? '调用真实接口生成' : '生成 Demo 图片'}
          </button>
          <p className="modeHint">
            模型来源于平台接入的配置；如果要新增中转站、刷新模型或修改 API Key，请前往平台接入。
          </p>
        </div>
      </section>

      <Gallery
        providers={props.providers}
        results={props.results}
        isHistoryLoaded={props.isHistoryLoaded}
        onPreview={props.onPreview}
      />
    </>
  );
}

function FreeGenerationPage(props: {
  prompt: string;
  message: string;
  onCopyPrompt: (platform: FreePlatform) => void;
  onOpenPlatform: (platform: FreePlatform) => void;
  onCopyPromptAndOpen: (platform: FreePlatform) => void;
  onImportLibrary: () => void;
}) {
  const [regionFilter, setRegionFilter] = useState<'all' | FreePlatform['region']>('all');
  const [kindFilter, setKindFilter] = useState<'all' | FreePlatform['kind']>('all');
  const promptReady = props.prompt.trim().length > 0;
  const filteredPlatforms = FREE_PLATFORMS.filter((platform) => {
    const matchesRegion = regionFilter === 'all' || platform.region === regionFilter;
    const matchesKind = kindFilter === 'all' || platform.kind === kindFilter;
    return matchesRegion && matchesKind;
  });

  return (
    <>
      <header className="topbar freeTopbar">
        <div>
          <p className="eyebrow">Free Platform Studio</p>
          <h1>免费平台：用网页登录额度试平台，用 API Key 做稳定自动生成。</h1>
        </div>
        <div className="statusPills">
          <span>
            <Gift size={15} /> {FREE_PLATFORMS.length} 个平台
          </span>
          <span>
            <Copy size={15} /> {promptReady ? 'Prompt 已准备' : '等待 Prompt'}
          </span>
        </div>
      </header>

      <section className="freeToolbar">
        <div className="segmentedControl compactSegment">
          <button className={regionFilter === 'all' ? 'active' : ''} onClick={() => setRegionFilter('all')}>
            全部
          </button>
          <button className={regionFilter === 'china' ? 'active' : ''} onClick={() => setRegionFilter('china')}>
            国内
          </button>
          <button className={regionFilter === 'global' ? 'active' : ''} onClick={() => setRegionFilter('global')}>
            海外
          </button>
        </div>
        <StudioSelect
          value={kindFilter}
          onChange={(value) => setKindFilter(value as 'all' | FreePlatform['kind'])}
          options={[
            { value: 'all', label: '全部能力' },
            { value: 'chat-image', label: '聊天生图' },
            { value: 'image', label: '图片生成' },
            { value: 'image-video', label: '图像 / 视频' }
          ]}
        />
        <button className="rowActionButton" onClick={props.onImportLibrary}>
          <FolderOpen size={15} /> 导入到画廊
        </button>
      </section>

      {props.message ? <p className="freeNotice">{props.message}</p> : null}

      <section className="freePlatformGrid">
        {filteredPlatforms.map((platform) => (
          <article className="freePlatformCard" key={platform.id}>
            <div className="freePlatformHeader">
              <div
                className="freePlatformLogo"
                style={{ background: platform.brandColor }}
                aria-hidden="true"
              >
                {platform.logoText}
              </div>
              <div>
                <strong>{platform.name}</strong>
                <small>{platform.vendor}</small>
              </div>
            </div>

            <div className="freePlatformMeta">
              <span>{platform.region === 'china' ? '国内平台' : '海外平台'}</span>
              <span>{platform.kind === 'image-video' ? '图像 / 视频' : platform.kind === 'chat-image' ? '聊天生图' : '图片生成'}</span>
            </div>

            <p>{platform.bestFor}</p>
            <small className="quotaHint">{platform.quotaHint}</small>

            <div className="freePlatformActions">
              <button
                className="miniButton primaryMini"
                disabled={!promptReady}
                onClick={() => props.onCopyPromptAndOpen(platform)}
              >
                <ExternalLink size={13} /> 复制并打开
              </button>
              <button className="miniButton" disabled={!promptReady} onClick={() => props.onCopyPrompt(platform)}>
                <Copy size={13} /> Prompt
              </button>
              <button className="miniButton" onClick={() => props.onOpenPlatform(platform)}>
                <Globe2 size={13} /> 网页
              </button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function ProviderSettingsPage(props: {
  providers: ReturnType<typeof listProviders>;
  selectedProvider: ReturnType<typeof listProviders>[number];
  selectedProviderId: string;
  desktopRuntime: boolean;
  secretAvailable: boolean;
  secretDraft: string;
  secretMessage: string;
  providerConfig: OpenAICompatibleConfig;
  configMessage: string;
  isRefreshingModels: boolean;
  supportsOpenAICompatible: boolean;
  onProviderChange: (providerId: string) => void;
  onSecretDraftChange: (secret: string) => void;
  onSaveSecret: () => void;
  onDeleteSecret: () => void;
  onConfigChange: <K extends keyof OpenAICompatibleConfig>(key: K, value: OpenAICompatibleConfig[K]) => void;
  onRefreshModels: () => void;
  onSaveConfig: () => void;
  onRunDiagnostics: () => void;
  onRunTestGeneration: () => void;
  onApplyPreset: (presetId: string) => void;
  onCopyConfig: () => void;
  onImportConfig: () => void;
  onPinModel: () => void;
  isRunningDiagnostics: boolean;
  isRunningTestGeneration: boolean;
  diagnostics: ProviderDiagnosticItem[];
}) {
  const capabilityRows = [
    ['文生图', 'textToImage'],
    ['图生图', 'imageToImage'],
    ['编辑', 'editImage'],
    ['多参考图', 'multiReferenceImage'],
    ['系列图', 'generateSeries'],
    ['图生视频', 'imageToVideo']
  ] as const;
  const diagnosticsSummary = {
    pass: props.diagnostics.filter((item) => item.level === 'pass').length,
    warn: props.diagnostics.filter((item) => item.level === 'warn').length,
    fail: props.diagnostics.filter((item) => item.level === 'fail').length,
    info: props.diagnostics.filter((item) => item.level === 'info').length
  };

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">平台接入中心</p>
          <h1>管理官方 API 与中转站：Base URL、API Key、模型刷新和协议类型。</h1>
        </div>
      </header>

      <section className="settingsLayout">
        <div className="providerDirectory">
          <div className="sectionTitle">Provider 列表</div>
          {props.providers.map((provider) => (
            <button
              key={provider.id}
              className={`providerCard ${provider.id === props.selectedProviderId ? 'selected' : ''}`}
              onClick={() => props.onProviderChange(provider.id)}
            >
              <span className={`regionDot ${provider.region}`} />
              <div>
                <strong>{provider.name}</strong>
                <small>
                  {provider.vendor} · {provider.phase}
                </small>
              </div>
            </button>
          ))}
        </div>

        <div className="settingsPanel">
          <div className="providerHero">
            <Globe2 size={22} />
            <div>
              <h2>{props.selectedProvider.name}</h2>
              <p>
                {props.selectedProvider.vendor} · {props.selectedProvider.region} ·{' '}
                {props.selectedProvider.executionModes.join(' / ')}
              </p>
            </div>
          </div>

          <div className="matrix compact">
            {capabilityRows.map(([label, key]) => (
              <div className="matrixRow" key={key}>
                <span>{label}</span>
                <strong className={props.selectedProvider.capabilities[key]}>
                  {statusLabel[props.selectedProvider.capabilities[key]]}
                </strong>
              </div>
            ))}
          </div>

          {props.supportsOpenAICompatible ? (
            <div className="relayBox standalone">
              <strong>官方 / 中转配置</strong>
              <div className="providerPresetGrid">
                {PROVIDER_CONFIG_PRESETS.map((preset) => (
                  <button
                    type="button"
                    className="providerPresetButton"
                    key={preset.id}
                    title={preset.description}
                    onClick={() => props.onApplyPreset(preset.id)}
                  >
                    <span>{preset.label}</span>
                    <small>{preset.description}</small>
                  </button>
                ))}
              </div>
              <label>
                名称
                <input
                  value={props.providerConfig.displayName}
                  onChange={(event) => props.onConfigChange('displayName', event.target.value)}
                  placeholder="例如 AIXW-GPT-Image2"
                />
              </label>
              <label>
                Base URL
                <input
                  value={props.providerConfig.baseUrl}
                  onChange={(event) => props.onConfigChange('baseUrl', event.target.value)}
                  placeholder="https://api.openai.com 或 https://你的中转站"
                />
              </label>
              <label>
                API Key
                <input
                  type="password"
                  placeholder={props.desktopRuntime ? props.selectedProvider.auth.label : '请在 Tauri 桌面端保存密钥'}
                  value={props.secretDraft}
                  onChange={(event) => props.onSecretDraftChange(event.target.value)}
                  disabled={!props.desktopRuntime}
                />
              </label>
              <div className="secretActions">
                <button className="ghostButton" onClick={props.onSaveSecret} disabled={!props.desktopRuntime || !props.secretDraft.trim()}>
                  保存密钥
                </button>
                <button className="ghostButton danger" onClick={props.onDeleteSecret} disabled={!props.desktopRuntime || !props.secretAvailable}>
                  删除
                </button>
              </div>
              <p className="secretMessage">
                密钥状态：{props.desktopRuntime ? (props.secretAvailable ? '已配置' : '未配置') : '网页预览模式'}
              </p>
              {props.secretMessage ? <p className="secretMessage">{props.secretMessage}</p> : null}

              <label>
                模型 ID
                <div className="modelPicker">
                  {props.providerConfig.modelOptions.length > 0 ? (
                    <StudioSelect
                      value={props.providerConfig.modelId}
                      onChange={(value) => props.onConfigChange('modelId', value)}
                      options={props.providerConfig.modelOptions.map((modelId) => ({ value: modelId, label: modelId }))}
                    />
                  ) : (
                    <input
                      value={props.providerConfig.modelId}
                      onChange={(event) => props.onConfigChange('modelId', event.target.value)}
                      placeholder="gpt-image-1 / gpt-image-2 / gpt-image-2-all"
                    />
                  )}
                  <button className="iconButton" onClick={props.onRefreshModels} disabled={props.isRefreshingModels}>
                    {props.isRefreshingModels ? '…' : '刷新'}
                  </button>
                  <button className="iconButton" onClick={props.onPinModel} title="设为默认模型">
                    默认
                  </button>
                </div>
              </label>

              <label>
                协议类型
                <StudioSelect
                  value={props.providerConfig.protocol}
                  onChange={(value) => props.onConfigChange('protocol', value as OpenAICompatibleConfig['protocol'])}
                  options={[
                    { value: 'images', label: 'OpenAI Images API' },
                    { value: 'responses', label: 'OpenAI Responses API' },
                    { value: 'chat-completions', label: 'Chat Completions 图片包装' },
                    { value: 'custom-images', label: '自定义图片接口路径' }
                  ]}
                />
              </label>
              <label>
                接口路径
                <input
                  value={props.providerConfig.endpointPath}
                  onChange={(event) => props.onConfigChange('endpointPath', event.target.value)}
                  placeholder="/v1/images/generations"
                />
              </label>
              <label>
                额外 Headers(JSON)
                <input
                  value={props.providerConfig.extraHeadersJson}
                  onChange={(event) => props.onConfigChange('extraHeadersJson', event.target.value)}
                  placeholder='{"X-Trace":"visionhub"}'
                />
              </label>
              <button className="ghostButton relaySave" onClick={props.onSaveConfig}>
                保存并启用
              </button>
              <div className="providerConfigActions">
                <button className="ghostButton" type="button" onClick={props.onCopyConfig}>
                  <Copy size={15} /> 复制配置
                </button>
                <button className="ghostButton" type="button" onClick={props.onImportConfig}>
                  <Upload size={15} /> 导入剪贴板
                </button>
              </div>
              <div className="providerDiagnostics">
                <div className="diagnosticsHeader">
                  <div>
                    <strong>Provider 诊断助手</strong>
                    <small>先检查桌面环境、密钥、Base URL、Headers、协议路径和模型列表；再用测试生成确认图片接口。</small>
                  </div>
                  <div className="diagnosticsActions">
                    <button className="rowActionButton" onClick={props.onRunDiagnostics} disabled={props.isRunningDiagnostics}>
                      <RefreshCcw size={15} /> {props.isRunningDiagnostics ? '诊断中…' : '运行诊断'}
                    </button>
                    <button
                      className="rowActionButton primaryAction"
                      onClick={props.onRunTestGeneration}
                      disabled={!props.desktopRuntime || !props.secretAvailable || props.isRunningTestGeneration}
                      title={!props.secretAvailable ? '请先保存 API Key' : '调用真实接口生成 1 张测试小样'}
                    >
                      <Sparkles size={15} /> {props.isRunningTestGeneration ? '测试中…' : '测试生成'}
                    </button>
                  </div>
                </div>
                {props.diagnostics.length === 0 ? (
                  <p className="diagnosticsHint">保存配置后可运行诊断；如果没有 API Key，也会先给出本地配置检查结果。</p>
                ) : (
                  <>
                    <div className="diagnosticsSummary">
                      <span className="pass">通过 {diagnosticsSummary.pass}</span>
                      <span className="warn">注意 {diagnosticsSummary.warn}</span>
                      <span className="fail">错误 {diagnosticsSummary.fail}</span>
                      <span className="info">提示 {diagnosticsSummary.info}</span>
                    </div>
                    <div className="diagnosticsList">
                      {props.diagnostics.map((item) => (
                        <div className={`diagnosticsItem ${item.level}`} key={item.id}>
                          <span>{item.level === 'pass' ? '通过' : item.level === 'warn' ? '注意' : item.level === 'fail' ? '错误' : '提示'}</span>
                          <div>
                            <strong>{item.label}</strong>
                            <small>{item.detail}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {props.configMessage ? <p className="secretMessage">{props.configMessage}</p> : null}
            </div>
          ) : (
            <div className="integrationBox">
              <strong>接入状态</strong>
              <p>当前 Provider 仍为路线图占位，真实 API Adapter 尚未接入。</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function SettingsPage(props: {
  appSettings: AppSettings;
  providers: ReturnType<typeof listProviders>;
  desktopRuntime: boolean;
  settingsMessage: string;
  storageSettings: StorageSettings | null;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  onSelectLibraryPath: () => void;
  onResetLibraryPath: () => void;
  onOpenLibraryDirectory: () => void;
  onOpenAppDataDirectory: () => void;
  onExportSettingsBackup: () => void;
  onOpenSystemInfo: () => void;
  onOpenShortcuts: () => void;
  onCheckUpdates: () => void;
}) {
  const settings = props.appSettings;
  const generationDefaults = settings.generationDefaults;
  const promptHistory = settings.promptHistory;
  const promptPolish = settings.promptPolish;
  const defaultProvider = props.providers.find((provider) => provider.id === generationDefaults.defaultProviderId) ?? props.providers[0];
  const defaultModelOptions = defaultProvider.models.map((model) => ({ value: model.id, label: model.label || model.id }));
  const selectedDefaultModel = defaultModelOptions.some((option) => option.value === generationDefaults.defaultModelId)
    ? generationDefaults.defaultModelId
    : defaultModelOptions[0]?.value ?? generationDefaults.defaultModelId;
  const polishProvider = props.providers.find((provider) => provider.id === promptPolish.providerId) ?? props.providers[0];
  const polishModelOptions = (polishProvider.textModels?.length ? polishProvider.textModels : polishProvider.models).map((model) => ({
    value: model.id,
    label: model.label || model.id
  }));
  const selectedPolishModel = polishModelOptions.some((option) => option.value === promptPolish.modelId)
    ? promptPolish.modelId
    : polishModelOptions[0]?.value ?? promptPolish.modelId;
  const polishStatus = polishProvider.capabilities.promptPolish;

  function updateGenerationDefaults(patch: Partial<GenerationDefaults>) {
    props.onSettingsChange({ generationDefaults: { ...generationDefaults, ...patch } });
  }

  function updatePromptHistory(patch: Partial<PromptHistorySettings>) {
    props.onSettingsChange({ promptHistory: { ...promptHistory, ...patch } });
  }

  function updatePromptPolish(patch: Partial<PromptPolishSettings>) {
    props.onSettingsChange({ promptPolish: { ...promptPolish, ...patch } });
  }

  function updateDefaultProvider(providerId: string) {
    const provider = props.providers.find((item) => item.id === providerId) ?? props.providers[0];
    updateGenerationDefaults({
      defaultProviderId: provider.id,
      defaultModelId: provider.models[0]?.id ?? generationDefaults.defaultModelId
    });
  }

  function updatePromptPolishProvider(providerId: string) {
    const provider = props.providers.find((item) => item.id === providerId) ?? props.providers[0];
    const firstTextModel = provider.textModels?.[0]?.id ?? provider.models[0]?.id ?? promptPolish.modelId;
    updatePromptPolish({ providerId: provider.id, modelId: firstTextModel });
  }

  return (
    <section className="systemSettingsPage">
      <header className="systemSettingsHeader">
        <div>
          <p className="eyebrow">偏好设置</p>
          <h1>偏好设置</h1>
        </div>
        <div className="settingsHeaderActions">
          <button type="button" title="系统信息" aria-label="系统信息" onClick={props.onOpenSystemInfo}>
            <Info size={16} />
          </button>
          <button type="button" title="快捷键" aria-label="快捷键" onClick={props.onOpenShortcuts}>
            <Keyboard size={16} />
          </button>
          <button type="button" title="检查更新" aria-label="检查更新" onClick={props.onCheckUpdates}>
            <RefreshCcw size={16} />
          </button>
        </div>
      </header>

      <div className="settingsSectionLabel">外观设置</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>主题</strong>
          </div>
          <div className="segmentedControl">
            <button className={settings.themeMode === 'light' ? 'active' : ''} onClick={() => props.onSettingsChange({ themeMode: 'light' })}>
              <Sun size={14} /> 浅色
            </button>
            <button className={settings.themeMode === 'dark' ? 'active' : ''} onClick={() => props.onSettingsChange({ themeMode: 'dark' })}>
              <Moon size={14} /> 深色
            </button>
            <button disabled>
              <Monitor size={14} /> 跟随系统
            </button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>语言</strong>
          </div>
          <div className="segmentedControl compactSegment">
            <button className="active">中文</button>
            <button disabled>English</button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>主颜色</strong>
            <small>控制品牌标识、主按钮和主要选中态；切换后会同步一套匹配的全局强调色。</small>
          </div>
          <div className="colorDotRow">
            {PRIMARY_ACCENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`colorDot ${settings.primaryAccent === option.value ? 'active' : ''}`}
                style={{ background: option.value }}
                title={option.label}
                aria-label={`主颜色：${option.label}`}
                onClick={() => props.onSettingsChange({
                  primaryAccent: option.value,
                  generatorAccent: getRecommendedGlobalAccent(option.value)
                })}
              />
            ))}
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>全局强调色</strong>
            <small>控制胶囊、描边、焦点、提示词弹窗和 AI 创作参数等辅助高亮。</small>
          </div>
          <div className="colorDotRow">
            {GENERATOR_ACCENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`colorDot ${settings.generatorAccent === option.value ? 'active' : ''}`}
                style={{ background: option.value }}
                title={option.label}
                aria-label={`全局强调色：${option.label}`}
                onClick={() => props.onSettingsChange({ generatorAccent: option.value })}
              />
            ))}
          </div>
        </div>
      </article>

      <div className="settingsSectionLabel">生成默认值</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>默认生成模式</strong>
            <small>打开 AI 创作时默认使用文生图或图生图工作流。</small>
          </div>
          <div className="segmentedControl compactSegment">
            <button className={generationDefaults.defaultMode === 'text' ? 'active' : ''} onClick={() => updateGenerationDefaults({ defaultMode: 'text' })}>
              文生图
            </button>
            <button className={generationDefaults.defaultMode === 'image' ? 'active' : ''} onClick={() => updateGenerationDefaults({ defaultMode: 'image' })}>
              图生图
            </button>
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>默认平台与模型</strong>
            <small>作为新会话初始化参数；真实 API 的模型列表仍以平台接入页保存的配置为准。</small>
          </div>
          <div className="settingsInlineGrid">
            <StudioSelect
              value={generationDefaults.defaultProviderId}
              onChange={updateDefaultProvider}
              options={props.providers.map((provider) => ({ value: provider.id, label: provider.name }))}
            />
            <StudioSelect
              value={selectedDefaultModel}
              onChange={(value) => updateGenerationDefaults({ defaultModelId: value })}
              options={defaultModelOptions}
            />
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>默认图片参数</strong>
            <small>尺寸、数量、质量会作为 AI 创作页的默认生成参数。</small>
          </div>
          <div className="settingsInlineGrid triple">
            <StudioSelect
              value={generationDefaults.defaultSize}
              onChange={(value) => updateGenerationDefaults({ defaultSize: value })}
              options={DEFAULT_SIZE_OPTIONS}
            />
            <StudioSelect
              value={String(generationDefaults.defaultCount)}
              onChange={(value) => updateGenerationDefaults({ defaultCount: Number(value) })}
              options={DEFAULT_COUNT_OPTIONS.map((option) => ({ value: String(option.value), label: option.label }))}
            />
            <StudioSelect
              value={generationDefaults.defaultQuality}
              onChange={(value) => updateGenerationDefaults({ defaultQuality: value })}
              options={DEFAULT_QUALITY_OPTIONS}
            />
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>输出与审核偏好</strong>
            <small>控制创作页底部的输出格式和审核模式默认值。</small>
          </div>
          <div className="settingsInlineGrid">
            <StudioSelect
              value={generationDefaults.outputFormat}
              onChange={(value) => updateGenerationDefaults({ outputFormat: value as GenerationDefaults['outputFormat'] })}
              options={OUTPUT_FORMAT_OPTIONS}
            />
            <StudioSelect
              value={generationDefaults.reviewMode}
              onChange={(value) => updateGenerationDefaults({ reviewMode: value as GenerationDefaults['reviewMode'] })}
              options={REVIEW_MODE_OPTIONS}
            />
          </div>
        </div>
      </article>

      <div className="settingsSectionLabel">提示词与历史</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>复用记录策略</strong>
            <small>控制 AI 创作页「复用记录」弹窗如何展示历史 Prompt。</small>
          </div>
          <div className="settingsBooleanGrid">
            <button className={promptHistory.enabled ? 'active' : ''} onClick={() => updatePromptHistory({ enabled: !promptHistory.enabled })}>保存历史</button>
            <button className={promptHistory.dedupe ? 'active' : ''} onClick={() => updatePromptHistory({ dedupe: !promptHistory.dedupe })}>去重</button>
            <button className={promptHistory.includeFailed ? 'active' : ''} onClick={() => updatePromptHistory({ includeFailed: !promptHistory.includeFailed })}>包含失败</button>
            <button className={promptHistory.showThumbnails ? 'active' : ''} onClick={() => updatePromptHistory({ showThumbnails: !promptHistory.showThumbnails })}>缩略图</button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>历史上限</strong>
            <small>复用记录最多展示多少条 Prompt，避免列表过长。</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={String(promptHistory.maxItems)}
              onChange={(value) => updatePromptHistory({ maxItems: Number(value) })}
              options={PROMPT_HISTORY_LIMIT_OPTIONS.map((option) => ({ value: String(option.value), label: option.label }))}
            />
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>默认润色模式</strong>
            <small>提示词润色弹窗打开后默认选中的扩写方向。</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={promptHistory.defaultPolishMode}
              onChange={(value) => updatePromptHistory({ defaultPolishMode: value })}
              options={POLISH_MODES.map((mode) => ({ value: mode.id, label: mode.label }))}
            />
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>提示词润色引擎</strong>
            <small>本地规则不消耗额度；模型润色会使用平台接入页已保存的 API Key。</small>
          </div>
          <div className="settingsInlineGrid">
            <StudioSelect
              value={promptPolish.engine}
              onChange={(value) => updatePromptPolish({ engine: value as PromptPolishSettings['engine'] })}
              options={PROMPT_POLISH_ENGINE_OPTIONS}
            />
            <button
              className={promptPolish.fallbackToLocal ? 'settingsTogglePill active' : 'settingsTogglePill'}
              onClick={() => updatePromptPolish({ fallbackToLocal: !promptPolish.fallbackToLocal })}
            >
              失败时本地兜底
            </button>
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>润色平台与模型</strong>
            <small>
              当前能力：{polishProvider.name} · {statusLabel[polishStatus]}。若模型不在列表中，可先选自定义中转并在平台接入页保存 Base URL / API Key。
            </small>
          </div>
          <div className="settingsInlineGrid">
            <StudioSelect
              value={promptPolish.providerId}
              onChange={updatePromptPolishProvider}
              options={props.providers.map((provider) => ({
                value: provider.id,
                label: `${provider.name} · ${statusLabel[provider.capabilities.promptPolish]}`
              }))}
            />
            <StudioSelect
              value={selectedPolishModel}
              onChange={(value) => updatePromptPolish({ modelId: value })}
              options={polishModelOptions}
            />
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>语言、强度与协议</strong>
            <small>控制模型润色输出语言、扩写力度，以及 OpenAI-compatible 文本调用协议。</small>
          </div>
          <div className="settingsInlineGrid triple">
            <StudioSelect
              value={promptPolish.language}
              onChange={(value) => updatePromptPolish({ language: value as PromptPolishSettings['language'] })}
              options={PROMPT_POLISH_LANGUAGE_OPTIONS}
            />
            <StudioSelect
              value={promptPolish.strength}
              onChange={(value) => updatePromptPolish({ strength: value as PromptPolishSettings['strength'] })}
              options={PROMPT_POLISH_STRENGTH_OPTIONS}
            />
            <StudioSelect
              value={promptPolish.protocol}
              onChange={(value) => updatePromptPolish({ protocol: value as PromptPolishSettings['protocol'] })}
              options={PROMPT_POLISH_PROTOCOL_OPTIONS}
            />
          </div>
        </div>

        <p className="settingsNotice">模型润色不会读取或导出你的 API Key；密钥仍由桌面端安全凭据存储。未配置 Key 或请求失败时，会按设置自动回退到本地规则润色。</p>
      </article>

      <div className="settingsSectionLabel">数据与缓存</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>启动页面</strong>
            <small>打开软件后默认进入哪个工作区。</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={settings.startupPage}
              onChange={(value) => props.onSettingsChange({ startupPage: value as AppPage })}
              options={STARTUP_PAGE_OPTIONS}
            />
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{'\u4fa7\u8fb9\u680f\u9ed8\u8ba4\u72b6\u6001'}</strong>
            <small>{'\u8bb0\u4f4f\u4f60\u4e0a\u4e00\u6b21\u9009\u62e9\u7684\u5c55\u5f00\u6216\u6536\u7f29\u72b6\u6001\u3002'}</small>
          </div>
          <div className="segmentedControl compactSegment">
            <button className={!settings.sidebarCollapsed ? 'active' : ''} onClick={() => props.onSettingsChange({ sidebarCollapsed: false })}>
              {'\u5c55\u5f00'}
            </button>
            <button className={settings.sidebarCollapsed ? 'active' : ''} onClick={() => props.onSettingsChange({ sidebarCollapsed: true })}>
              {'\u6536\u7f29'}
            </button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>数据刷新频率</strong>
            <small>控制历史记录、作品画廊与任务状态的刷新节奏。</small>
          </div>
          <div className="segmentedControl compactSegment">
            {REFRESH_INTERVAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={settings.refreshIntervalSeconds === option.value ? 'active' : ''}
                onClick={() => props.onSettingsChange({ refreshIntervalSeconds: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>作品画廊目录</strong>
            <small>生成图片会保存到当前图库目录；历史 JSON 仍放在应用数据目录，方便追踪记录。</small>
          </div>
          <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onOpenLibraryDirectory}>
            <HardDrive size={15} /> {'\u6253\u5f00'}
          </button>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>本地图库路径</strong>
            <small>
              {props.storageSettings
                ? `当前：${props.storageSettings.resolved_library_dir}`
                : props.desktopRuntime
                  ? '正在读取当前图库路径…'
                  : '桌面端可自定义图库路径。'}
            </small>
            {props.storageSettings ? (
              <small className="settingsPathMeta">
                默认：{props.storageSettings.default_library_dir}
              </small>
            ) : null}
          </div>
          <div className="settingsPathEditor">
            <div className="settingsPathActions">
              <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onSelectLibraryPath}>
                <FolderOpen size={15} /> 选择路径
              </button>
              <button className="rowActionButton subtle" disabled={!props.desktopRuntime} onClick={props.onResetLibraryPath}>
                <RefreshCcw size={15} /> 默认目录
              </button>
            </div>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{'\u5e94\u7528\u6570\u636e\u76ee\u5f55'}</strong>
            <small>{'\u5305\u542b\u751f\u6210\u5386\u53f2\u3001\u672c\u5730\u56fe\u518c\u3001\u5907\u4efd\u6587\u4ef6\u548c\u5e94\u7528\u6570\u636e\u3002'}</small>
          </div>
          <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onOpenAppDataDirectory}>
            <FolderOpen size={15} /> {'\u6253\u5f00'}
          </button>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>备份与恢复</strong>
            <small>{'\u5bfc\u51fa\u5e94\u7528\u8bbe\u7f6e\u3001Provider \u914d\u7f6e\u548c\u672c\u5730\u5386\u53f2\u3002API Key \u4e0d\u4f1a\u88ab\u5bfc\u51fa\u3002'}</small>
          </div>
          <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onExportSettingsBackup}>
            <Download size={15} /> {'\u5bfc\u51fa\u8bbe\u7f6e'}
          </button>
        </div>
        {props.settingsMessage ? <p className="settingsActionMessage">{props.settingsMessage}</p> : null}
      </article>

      <div className="settingsSectionLabel">关于与软件升级</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>版本</strong>
          </div>
          <span className="settingsValue">0.1.0-dev</span>
        </div>
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>软件升级</strong>
            <small>后续可接入 Tauri updater、GitHub Release 或自定义更新源。</small>
          </div>
          <button className="rowActionButton" type="button" onClick={props.onCheckUpdates}>
            <RefreshCcw size={15} /> 检查更新
          </button>
        </div>
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>技术栈</strong>
            <small>Tauri v2 + React + TypeScript，本地历史保存，密钥由系统凭据管理。</small>
          </div>
          <span className="settingsValue">Desktop MVP</span>
        </div>
      </article>
    </section>
  );
}

function Gallery(props: {
  providers: ReturnType<typeof listProviders>;
  results: ReturnType<typeof useStudioStore.getState>['results'];
  isHistoryLoaded: boolean;
  onPreview: (imageUrl: string) => void;
}) {
  const successCount = props.results.filter((result) => result.status === 'succeeded').length;
  const latest = props.results[0];

  return (
    <>
      <section className="galleryHeader">
        <div>
          <h2>生成历史</h2>
          <p>
            {props.isHistoryLoaded ? `已载入 ${props.results.length} 条记录，成功图片 ${successCount} 组。` : '正在载入本地历史…'}
            {latest ? ` 最新：${formatTime(latest.createdAt)}` : ''}
          </p>
        </div>
        <button className="ghostButton" disabled>
          <Download size={16} /> 批量导出
        </button>
      </section>
      <section className="gallery">
        {props.results.length === 0 ? (
          <div className="emptyState">
            <Sparkles size={42} />
            <h3>先生成一张图片</h3>
            <p>真实 Provider 接入后，这里会保存每张图的来源平台、模型、Prompt、成本和耗时。</p>
          </div>
        ) : (
          props.results.map((result) => (
            <article className={`resultCard ${result.status === 'failed' ? 'failed' : ''}`} key={result.id}>
              {result.imageUrls[0] ? (
                <button className="imageButton" onClick={() => props.onPreview(result.imageUrls[0])}>
                  <img src={result.imageUrls[0]} alt={result.prompt} />
                  <span>
                    <Maximize2 size={15} /> 预览
                  </span>
                </button>
              ) : (
                <div className="failedPreview">生成失败</div>
              )}
              <div className="resultBody">
                <div className="resultTitleRow">
                  <strong>{result.providerName ?? props.providers.find((provider) => provider.id === result.providerId)?.name}</strong>
                    <span className={`statusBadge ${result.status}`}>{result.status === 'succeeded' ? '\u6210\u529f' : '\u5931\u8d25'}</span>
                </div>
                <p title={result.prompt}>{result.prompt}</p>
                <div className="metadataRow">
                  <span>{result.modelId}</span>
                  <span>
                    <Clock3 size={12} /> {formatTime(result.createdAt)}
                  </span>
                  <span>{result.durationMs ?? '-'}ms</span>
                </div>
                {result.error ? <small className="errorText">{result.error}</small> : <small>{result.costHint}</small>}
                <div className="cardActions">
                  <button className="miniButton" onClick={() => void navigator.clipboard?.writeText(result.prompt)}>
                    <Copy size={13} /> Prompt
                  </button>
                  <button
                    className="miniButton"
                    disabled={!result.localImagePaths?.[0]}
                    onClick={() => result.localImagePaths?.[0] && void revealGenerationFile(result.localImagePaths[0])}
                  >
                    <FolderOpen size={13} /> 文件夹
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}

function LibraryPage(props: {
  providers: ReturnType<typeof listProviders>;
  results: ReturnType<typeof useStudioStore.getState>['results'];
  isHistoryLoaded: boolean;
  onPreview: (imageUrl: string) => void;
  onUseAsReference: (record: GenerationRecord) => void;
  onDelete: (recordId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'succeeded' | 'failed'>('all');
  const [modeFilter, setModeFilter] = useState<'all' | 'text-to-image' | 'image-to-image' | 'with-references'>('all');
  const [timeFilter, setTimeFilter] = useState<LibraryTimeFilter>('all');
  const [copyMessage, setCopyMessage] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const providerNameMap = new Map(props.providers.map((provider) => [provider.id, provider.name]));
  const libraryItems = props.results.filter((result) => result.imageUrls.length > 0 || result.status === 'failed');
  const successCount = libraryItems.filter((result) => result.status === 'succeeded').length;
  const failedCount = libraryItems.filter((result) => result.status === 'failed').length;
  const localPathCount = libraryItems.filter((result) => result.localImagePaths?.[0]).length;
  const nowMs = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const recentCutoff = nowMs - 7 * 24 * 60 * 60 * 1000;
  const recentCount = libraryItems.filter((result) => getRecordTimeMs(result.createdAt) >= recentCutoff).length;
  const successRate = libraryItems.length ? Math.round((successCount / libraryItems.length) * 100) : 0;
  const durations = libraryItems
    .map((result) => result.durationMs)
    .filter((duration): duration is number => typeof duration === 'number' && Number.isFinite(duration) && duration > 0);
  const averageDuration = durations.length
    ? `${Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)}ms`
    : '\u6682\u65e0\u8017\u65f6';
  const topProvider = getTopLibraryValue(
    libraryItems.map((result) => result.providerName ?? providerNameMap.get(result.providerId) ?? result.providerId)
  );
  const topModel = getTopLibraryValue(libraryItems.map((result) => result.modelId));
  const normalizedQuery = query.trim().toLowerCase();
  const providerOptions = [
    { value: 'all', label: '\u5168\u90e8 Provider' },
    ...props.providers.map((provider) => ({ value: provider.id, label: provider.name }))
  ];
  const statusOptions = [
    { value: 'all', label: '\u5168\u90e8\u72b6\u6001' },
    { value: 'succeeded', label: '\u6210\u529f' },
    { value: 'failed', label: '\u5931\u8d25' }
  ];
  const modeOptions = [
    { value: 'all', label: '\u5168\u90e8\u7c7b\u578b' },
    { value: 'text-to-image', label: '\u6587\u751f\u56fe' },
    { value: 'image-to-image', label: '\u56fe\u751f\u56fe' },
    { value: 'with-references', label: '\u6709\u53c2\u8003\u56fe' }
  ];
  const timeOptions = [
    { value: 'all', label: '\u5168\u90e8\u65f6\u95f4' },
    { value: 'today', label: '\u4eca\u5929' },
    { value: '7d', label: '\u8fd1 7 \u5929' },
    { value: '30d', label: '\u8fd1 30 \u5929' }
  ];
  const filteredItems = libraryItems.filter((result) => {
    const providerName = result.providerName ?? providerNameMap.get(result.providerId) ?? result.providerId;
    const generationMode = result.generationMode ?? 'text-to-image';
    const recordTime = getRecordTimeMs(result.createdAt);
    const matchesProvider = providerFilter === 'all' || result.providerId === providerFilter;
    const matchesStatus = statusFilter === 'all' || result.status === statusFilter;
    const matchesMode =
      modeFilter === 'all' ||
      generationMode === modeFilter ||
      (modeFilter === 'with-references' && Boolean(result.referenceImages?.length));
    const matchesTime =
      timeFilter === 'all' ||
      (timeFilter === 'today' && recordTime >= todayStart.getTime()) ||
      (timeFilter === '7d' && recordTime >= nowMs - 7 * 24 * 60 * 60 * 1000) ||
      (timeFilter === '30d' && recordTime >= nowMs - 30 * 24 * 60 * 60 * 1000);
    const referenceText = result.referenceImages?.map((reference) => `${reference.name ?? ''} ${reference.source}`).join(' ') ?? '';
    const haystack = [result.prompt, result.modelId, result.providerId, providerName, referenceText, result.error ?? '']
      .join(' ')
      .toLowerCase();
    const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
    return matchesProvider && matchesStatus && matchesMode && matchesTime && matchesQuery;
  });

  useEffect(() => {
    function focusSearch() {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
    window.addEventListener(libraryFocusSearchEvent, focusSearch);
    return () => window.removeEventListener(libraryFocusSearchEvent, focusSearch);
  }, []);

  async function copyText(label: string, value?: string) {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
      setCopyMessage(`${label} copied`);
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    }
  }


  async function deleteRecord(recordId: string) {
    const confirmed = window.confirm('确定删除这条图册记录吗？这只会从 VisionHub 图册中移除记录，不会删除磁盘上的图片文件。');
    if (!confirmed) return;
    try {
      await props.onDelete(recordId);
      setCopyMessage('已删除图册记录');
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    }
  }
  return (
    <>
      <header className="topbar libraryTopbar">
        <div>
          <p className="eyebrow">Local Library</p>
          <h1>{'\u672c\u5730\u56fe\u518c\uff1a\u7ba1\u7406\u5df2\u751f\u6210\u56fe\u7247\u3001\u67e5\u770b Prompt\u3001\u590d\u5236\u8def\u5f84\u5e76\u6253\u5f00\u6240\u5728\u6587\u4ef6\u5939\u3002'}</h1>
        </div>
        <div className="statusPills">
          <span><Image size={15} /> {props.isHistoryLoaded ? `${successCount} ${'\u7ec4\u6210\u529f\u56fe\u7247'}` : '\u6b63\u5728\u52a0\u8f7d'}</span>
          <span><HardDrive size={15} /> {localPathCount} {'\u7ec4\u5df2\u843d\u76d8'}</span>
          <span><Info size={15} /> {failedCount} {'\u6761\u5931\u8d25\u8bb0\u5f55'}</span>
        </div>
      </header>

      <section className="libraryToolbar">
        <label className="librarySearchBox">
          <span>{'\u641c\u7d22 Prompt / \u6a21\u578b / Provider'}</span>
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search local generations"
          />
        </label>
        <label>
          <span>Provider</span>
          <StudioSelect value={providerFilter} onChange={setProviderFilter} options={providerOptions} />
        </label>
        <label>
          <span>{'\u72b6\u6001'}</span>
          <StudioSelect value={statusFilter} onChange={(value) => setStatusFilter(value as 'all' | 'succeeded' | 'failed')} options={statusOptions} />
        </label>
        <label>
          <span>{'\u7c7b\u578b'}</span>
          <StudioSelect value={modeFilter} onChange={(value) => setModeFilter(value as typeof modeFilter)} options={modeOptions} />
        </label>
        <label>
          <span>{'\u65f6\u95f4'}</span>
          <StudioSelect value={timeFilter} onChange={(value) => setTimeFilter(value as LibraryTimeFilter)} options={timeOptions} />
        </label>
      </section>

      <section className="libraryInsightGrid">
        <article className="libraryInsightCard primary">
          <span>{'\u6210\u529f\u7387'}</span>
          <strong>{props.isHistoryLoaded ? `${successRate}%` : '--'}</strong>
          <small>{successCount} {'\u6210\u529f'} / {failedCount} {'\u5931\u8d25'}</small>
        </article>
        <article className="libraryInsightCard">
          <span>{'\u5e73\u5747\u8017\u65f6'}</span>
          <strong>{props.isHistoryLoaded ? averageDuration : '--'}</strong>
          <small>{durations.length ? `${durations.length} ${'\u6761\u8bb0\u5f55\u53ef\u8ba1\u7b97'}` : '\u7b49\u5f85\u771f\u5b9e Provider \u8fd4\u56de'}</small>
        </article>
        <article className="libraryInsightCard">
          <span>{'\u6700\u5e38\u7528 Provider'}</span>
          <strong>{topProvider.label}</strong>
          <small>{topProvider.count ? `${topProvider.count} ${'\u6b21\u751f\u6210'}` : '\u5c1a\u65e0\u6570\u636e'}</small>
        </article>
        <article className="libraryInsightCard">
          <span>{'\u6700\u5e38\u7528\u6a21\u578b'}</span>
          <strong>{topModel.label}</strong>
          <small>{recentCount} {'\u6761\u8fd1 7 \u5929\u8bb0\u5f55'}</small>
        </article>
      </section>

      {copyMessage ? <p className="libraryNotice">{copyMessage}</p> : null}

      {!props.isHistoryLoaded ? (
        <div className="emptyState libraryEmpty"><Sparkles size={42} /><h3>{'\u6b63\u5728\u52a0\u8f7d\u672c\u5730\u5386\u53f2'}</h3></div>
      ) : filteredItems.length === 0 ? (
        <div className="emptyState libraryEmpty">
          <Sparkles size={42} />
          <h3>{libraryItems.length === 0 ? '\u8fd8\u6ca1\u6709\u672c\u5730\u56fe\u7247' : '\u6ca1\u6709\u7b26\u5408\u6761\u4ef6\u7684\u8bb0\u5f55'}</h3>
          <p>{libraryItems.length === 0 ? '\u5148\u5728\u751f\u6210\u5de5\u4f5c\u53f0\u751f\u6210\u4e00\u5f20\u56fe\uff0c\u6210\u529f\u540e\u4f1a\u81ea\u52a8\u8fdb\u5165\u672c\u5730\u56fe\u518c\u3002' : '\u8bd5\u7740\u6e05\u7a7a\u641c\u7d22\u8bcd\u6216\u5207\u6362\u7b5b\u9009\u6761\u4ef6\u3002'}</p>
        </div>
      ) : (
        <section className="libraryGrid">
          {filteredItems.map((result) => {
            const imageUrl = result.imageUrls[0];
            const localPath = result.localImagePaths?.[0];
            const providerName = result.providerName ?? providerNameMap.get(result.providerId) ?? result.providerId;
            const modeLabel = (result.generationMode ?? 'text-to-image') === 'image-to-image' ? '\u56fe\u751f\u56fe' : '\u6587\u751f\u56fe';
            const referenceCount = result.referenceImages?.length ?? 0;
            const referenceSummary = summarizeReferenceSources(result.referenceImages);
            const savedStatus = result.error ? '' : localPath ? '\u5df2\u4fdd\u5b58\u5230\u672c\u5730' : result.costHint;
            return (
              <article className={`libraryCard ${result.status === 'failed' ? 'failed' : ''}`} key={result.id}>
                {imageUrl ? (
                  <button className="libraryThumb" onClick={() => props.onPreview(imageUrl)}>
                    <img src={imageUrl} alt={result.prompt} />
                    <span><Maximize2 size={15} /> {'\u9884\u89c8'}</span>
                  </button>
                ) : (
                  <div className="libraryFailedThumb">{'\u751f\u6210\u5931\u8d25'}</div>
                )}
                <div className="libraryCardBody">
                  <div className="resultTitleRow">
                    <strong>{providerName}</strong>
                    <div className="cardTopActions">
                      <span className="statusBadge modeBadge">{modeLabel}</span>
                      {referenceCount > 0 ? <span className="statusBadge referenceBadge" title={`\u53c2\u8003\u6765\u6e90\uff1a${referenceSummary}`}>{referenceCount}{'\u53c2\u8003'}</span> : null}
                      <span className={`statusBadge ${result.status}`}>{result.status === 'succeeded' ? '\u6210\u529f' : '\u5931\u8d25'}</span>
                      <button className="iconMiniButton dangerMiniButton" type="button" title="删除记录" onClick={() => void deleteRecord(result.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <p title={result.prompt}>{result.prompt}</p>
                  <div className="metadataRow">
                    <span>{result.modelId}</span>
                    <span><Clock3 size={12} /> {formatTime(result.createdAt)}</span>
                    <span>{result.durationMs ?? '-'}ms</span>
                  </div>
                  {result.error ? (
                    <small className="errorText">{result.error}</small>
                  ) : (
                    <small title={referenceSummary ? `\u53c2\u8003\u6765\u6e90\uff1a${referenceSummary}` : undefined}>
                      {savedStatus}{referenceCount > 0 ? ` / ${referenceCount} \u5f20\u53c2\u8003` : ''}
                    </small>
                  )}
                  <div className="cardActions libraryActions">
                    <button className="miniButton" disabled={!imageUrl} onClick={() => props.onUseAsReference(result)}><ImagePlus size={13} /> {'\u53c2\u8003'}</button>
                    <button className="miniButton" onClick={() => void copyText('Prompt', result.prompt)}><Copy size={13} /> Prompt</button>
                    <button className="miniButton" disabled={!localPath && !imageUrl} onClick={() => void copyText('Path', localPath ?? imageUrl)}><Copy size={13} /> {'\u8def\u5f84'}</button>
                    <button className="miniButton" disabled={!localPath} onClick={() => localPath && void revealGenerationFile(localPath)}><FolderOpen size={13} /> {'\u6587\u4ef6\u5939'}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}

function PromptTemplatesPage(props: { onUseTemplate: (prompt: string) => void }) {
  const templates = useMemo(() => loadPromptTemplates(), []);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [copyMessage, setCopyMessage] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = category === 'all' || template.category === category;
    const haystack = [template.title, template.tone, template.prompt, ...template.tags].join(' ').toLowerCase();
    const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
    return matchesCategory && matchesQuery;
  });

  async function copyTemplate(template: PromptTemplate) {
    try {
      await navigator.clipboard?.writeText(template.prompt);
      setCopyMessage(`Copied: ${template.title}`);
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <header className="topbar templateTopbar">
        <div>
          <p className="eyebrow">Prompt Templates</p>
          <h1>{'\u63d0\u793a\u8bcd\u6a21\u677f\uff1a\u5feb\u901f\u5957\u7528\u89d2\u8272\u3001\u4ea7\u54c1\u3001\u6d77\u62a5\u3001\u573a\u666f\u548c\u98ce\u683c\u63a2\u7d22\u7684\u5e38\u7528\u63d0\u793a\u8bcd\u3002'}</h1>
        </div>
        <div className="statusPills">
          <span><Layers size={15} /> {templates.length} {'\u4e2a\u6a21\u677f'}</span>
          <span><Sparkles size={15} /> {filteredTemplates.length} {'\u4e2a\u7ed3\u679c'}</span>
        </div>
      </header>

      <section className="templateToolbar">
        <label className="templateSearchBox">
          <span>{'\u641c\u7d22\u6807\u9898 / \u6807\u7b7e / Prompt'}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search prompt templates" />
        </label>
        <label>
          <span>{'\u5206\u7c7b'}</span>
          <StudioSelect value={category} onChange={setCategory} options={PROMPT_TEMPLATE_CATEGORIES} />
        </label>
      </section>

      {copyMessage ? <p className="libraryNotice">{copyMessage}</p> : null}

      {filteredTemplates.length === 0 ? (
        <div className="emptyState templateEmpty">
          <Sparkles size={42} />
          <h3>{'\u6ca1\u6709\u7b26\u5408\u6761\u4ef6\u7684\u6a21\u677f'}</h3>
          <p>{'\u8bd5\u7740\u6e05\u7a7a\u641c\u7d22\u8bcd\u6216\u5207\u6362\u5206\u7c7b\u3002'}</p>
        </div>
      ) : (
        <section className="templateGrid">
          {filteredTemplates.map((template) => (
            <article className="templateCard" key={template.id}>
              <div className="templateCardHeader">
                <span className="badge">{PROMPT_TEMPLATE_CATEGORIES.find((item) => item.value === template.category)?.label}</span>
                <strong>{template.title}</strong>
                <small>{template.tone}</small>
              </div>
              <p>{template.prompt}</p>
              <div className="templateTags">
                {template.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <div className="cardActions templateActions">
                <button className="miniButton" onClick={() => props.onUseTemplate(template.prompt)}>
                  <Wand2 size={13} /> {'\u5957\u7528'}
                </button>
                <button className="miniButton" onClick={() => void copyTemplate(template)}>
                  <Copy size={13} /> {'\u590d\u5236'}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}


function UtilityModalShell(props: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') props.onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [props.onClose]);

  return (
    <div className="modalBackdrop utilityModalBackdrop" onClick={props.onClose}>
      <section className="utilityModal" role="dialog" aria-modal="true" aria-label={props.title} onClick={(event) => event.stopPropagation()}>
        <header className="utilityModalHeader">
          <div>
            {props.eyebrow ? <p className="eyebrow">{props.eyebrow}</p> : null}
            <h2>{props.title}</h2>
          </div>
          <button type="button" title="关闭" aria-label="关闭" onClick={props.onClose}>
            <X size={18} />
          </button>
        </header>
        {props.children}
      </section>
    </div>
  );
}

function ShortcutsModal(props: { onClose: () => void }) {
  return (
    <UtilityModalShell title="快捷键" eyebrow="Keyboard Shortcuts" onClose={props.onClose}>
      <div className="shortcutModalContent">
        {shortcutGroups.map((group) => (
          <section className="shortcutGroup" key={group.title}>
            <h3>{group.title}</h3>
            <div className="shortcutList">
              {group.items.map((item) => (
                <div className="shortcutRow" key={`${group.title}-${item.action}`}>
                  <div className="shortcutKeys">
                    {item.keys.map((key) => <kbd key={key}>{key}</kbd>)}
                  </div>
                  <span>{item.action}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </UtilityModalShell>
  );
}

function SystemInfoModal(props: {
  desktopRuntime: boolean;
  storageSettings: StorageSettings | null;
  settingsMessage: string;
  onClose: () => void;
}) {
  const rows = [
    { label: '版本', value: '0.1.0-dev' },
    { label: '运行环境', value: props.desktopRuntime ? 'Tauri 桌面端' : 'Web 预览模式' },
    { label: '作品画廊目录', value: props.storageSettings?.resolved_library_dir ?? (props.desktopRuntime ? '正在读取…' : '桌面端可用') },
    { label: '默认图库目录', value: props.storageSettings?.default_library_dir ?? '—' },
    { label: '最近操作', value: props.settingsMessage || '暂无新的设置操作' }
  ];

  return (
    <UtilityModalShell title="系统信息" eyebrow="System" onClose={props.onClose}>
      <div className="systemInfoList">
        {rows.map((row) => (
          <div className="systemInfoRow" key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </UtilityModalShell>
  );
}

function ImagePreviewModal(props: { imageUrl: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const pointerDownPoint = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
    didDrag.current = false;
    window.setTimeout(() => modalRef.current?.focus(), 0);
  }, [props.imageUrl]);

  function clampScale(value: number) {
    return Math.min(6, Math.max(0.25, value));
  }

  function zoomBy(delta: number) {
    setScale((current) => clampScale(Number((current + delta).toFixed(2))));
  }

  function resetView() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
    didDrag.current = false;
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.nativeEvent.cancelable) {
      event.nativeEvent.preventDefault();
    }
    zoomBy(event.deltaY > 0 ? -0.12 : 0.12);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDownPoint.current = { x: event.clientX, y: event.clientY };
    didDrag.current = false;
    setIsDragging(true);
    setDragStart({
      x: event.clientX - offset.x,
      y: event.clientY - offset.y
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    const moveX = event.clientX - pointerDownPoint.current.x;
    const moveY = event.clientY - pointerDownPoint.current.y;
    if (Math.hypot(moveX, moveY) > 4) didDrag.current = true;
    setOffset({
      x: event.clientX - dragStart.x,
      y: event.clientY - dragStart.y
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  }

  function handleViewportClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    if (event.target === event.currentTarget) props.onClose();
  }

  function handlePreviewKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      props.onClose();
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(0.2);
      return;
    }
    if (event.key === '-') {
      event.preventDefault();
      zoomBy(-0.2);
      return;
    }
    if (event.key === '0' || event.key === ' ') {
      event.preventDefault();
      resetView();
    }
  }

  return (
    <div ref={modalRef} className="modalBackdrop" onClick={props.onClose} onKeyDown={handlePreviewKeyDown} tabIndex={-1}>
      <div className="previewModal">
        <div className="previewToolbar" onClick={(event) => event.stopPropagation()}>
          <button type="button" title="缩小" onClick={() => zoomBy(-0.2)}>
            <ZoomOut size={16} />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button type="button" title="放大" onClick={() => zoomBy(0.2)}>
            <ZoomIn size={16} />
          </button>
          <button type="button" title="适配窗口" onClick={resetView}>
            <Maximize2 size={16} />
          </button>
          <button type="button" title="关闭预览" onClick={props.onClose}>
            <X size={18} />
          </button>
        </div>
        <div
          className={`previewViewport ${isDragging ? 'isDragging' : ''}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={resetView}
          onClick={handleViewportClick}
        >
          <img
            src={props.imageUrl}
            alt="生成图片预览"
            draggable={false}
            onClick={(event) => event.stopPropagation()}
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`
            }}
          />
        </div>
      </div>
    </div>
  );
}

function getTopLibraryValue(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let label = '\u5c1a\u65e0\u6570\u636e';
  let count = 0;
  for (const [key, value] of counts) {
    if (value > count) {
      label = key;
      count = value;
    }
  }
  return { label, count };
}

function getRecordTimeMs(value: string) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarizeReferenceSources(references?: ReferenceImage[]) {
  if (!references?.length) return '';
  const labels: Record<ReferenceImage['source'], string> = {
    upload: '\u672c\u5730',
    'generated-result': '\u4f5c\u54c1',
    clipboard: '\u526a\u8d34\u677f',
    'drag-drop': '\u62d6\u62fd',
    inspiration: '\u7075\u611f'
  };
  const counts = new Map<string, number>();
  for (const reference of references) {
    const label = labels[reference.source] ?? reference.source;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, count]) => `${label} ${count}`).join('\u3001');
}

function formatTime(value: string) {
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 0 ? new Date(numeric) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function mapProviderErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid api key')) {
    return `密钥校验失败：请检查 API Key 是否正确，或中转站是否要求 Bearer Token。原始错误：${message}`;
  }
  if (lower.includes('403') || lower.includes('forbidden')) {
    return `接口无权限：账号、模型或中转站策略可能不允许当前请求。原始错误：${message}`;
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return `接口路径可能不匹配：请检查 Base URL、协议类型和接口路径。原始错误：${message}`;
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota')) {
    return `额度或频率受限：请稍后重试，或检查账户额度/中转站限流。原始错误：${message}`;
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return `请求超时：请检查网络、中转站可用性或代理链路。原始错误：${message}`;
  }
  if (lower.includes('failed to fetch') || lower.includes('dns') || lower.includes('connection')) {
    return `网络连接失败：请检查 Base URL 是否可访问，或中转站服务是否在线。原始错误：${message}`;
  }
  if (lower.includes('json')) {
    return `返回内容解析失败：接口可能不是 OpenAI-compatible JSON 响应。原始错误：${message}`;
  }
  return message;
}

function PlaceholderPage(props: { title: string }) {
  return (
    <div className="placeholderPage">
      <Sparkles size={42} />
      <h1>{props.title}</h1>
      <p>这个模块将在生成链路稳定后继续实现。</p>
    </div>
  );
}






