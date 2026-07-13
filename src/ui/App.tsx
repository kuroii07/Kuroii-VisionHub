import {
  ChevronRight,
  ClipboardPaste,
  Clock3,
  Copy,
  Database,
  Gauge,
  Gift,
  Grid2X2,
  HardDrive,
  Image,
  Layers,
  ListChecks,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Settings,
  Sidebar,
  Sparkles,
  Bookmark,
  Sun,
  Moon,
  Trash2,
  Upload,
  Wand2,
  X
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type {
  BatchGenerationQueue,
  BatchQueueCompareGroupTemplate,
  BatchQueueRunProgress,
  BatchQueueTaskTemplate,
  BatchQueueTemplate
} from '../domain/batchQueueTypes';
import type { InspirationAsset } from '../domain/inspirationTypes';
import type { GenerationMode, GenerationRecord, ImageGenerationRequest, ImageGenerationResult, ImageToImageAdapter, ProviderCapabilityStatus, ReferenceImage } from '../domain/providerTypes';
import { listProviders } from '../providers/registry';
import {
  chooseInspirationDir,
  chooseLibraryDir,
  deleteProviderSecret,
  diagnoseComfyUIConnection,
  diagnoseSdWebUIConnection,
  getProviderSecretStatus,
  exportSettingsBackup,
  getAppPaths,
  generateComfyUIImage,
  generateSdWebUIImage,
  generateOpenAIImage,
  getStorageSettings,
  recheckBackgroundGeneration,
  revealAppDataDir,
  isTauriRuntime,
  listOpenAICompatibleModels,
  openExternalUrl,
  revealGenerationFile,
  revealInspirationDir,
  revealLibraryDir,
  revealBackupsDir,
  saveGenerationRecord,
  saveProviderSecret,
  saveTextFileWithDialog,
  saveStorageSettings,
  type ComfyUIDiagnosisResult,
  type SdWebUIDiagnosisResult,
  type StorageSettings
} from '../services/desktopApi';
import {
  buildGeminiManualModelProbe,
  buildMiniMaxManualModelProbe,
  defaultBaseUrlPlaceholder,
  defaultEndpointPlaceholder,
  imageToImageAdapterDiagnosticDetail,
  imageToImageAdapterLabel,
  isGeminiProvider,
  isMiniMaxProvider,
  modelListUnsupportedMessage,
  officialFixedModelOptions,
  protocolLabel,
  providerEndpointPreview,
  providerEndpointHint,
  providerSupportsOpenAICompatibleModelList,
  providerUsesConfig,
  resolveImageToImageAdapterForDisplay
} from '../services/providerDisplay';
import {
  buildOfflineDiagnosticSummary,
  buildGenerationUsageReadinessItem,
  buildProviderReadinessItems,
  buildProviderStabilityDiagnosticItems,
  formatModelListFallbackMessage,
  isModelListUnavailableError,
  mapProviderErrorMessage,
  type ProviderDiagnosticLevel,
  type ProviderDiagnosticItem
} from '../services/providerDiagnostics';
import {
  defaultEndpointForProtocol,
  defaultOpenAICompatibleConfig,
  IMAGE_TO_IMAGE_ADAPTERS,
  exportProviderConfigMap,
  loadProviderConfig,
  normalizeProviderConfig,
  OFFICIAL_OPENAI_BASE_URL,
  parseProviderConfigImport,
  parseExtraHeaders,
  saveProviderConfig,
  serializeProviderConfig,
  type OpenAICompatibleConfig
} from '../services/providerConfig';
import {
  createProviderProfile,
  deleteProviderProfile,
  getProfilesForProvider,
  profileToProviderConfig,
  providerProfileSecretId,
  saveProviderProfiles,
  setProviderProfileEnabled,
  upsertProviderProfile,
  loadProviderProfiles,
  type ProviderConnectionProfile
} from '../services/providerProfiles';
import {
  IMAGE_PROMPT_REVERSE_SECRET_ID,
  promptPolishConfigId,
  PROMPT_POLISH_SECRET_ID,
  STARTUP_PAGE_OPTIONS,
  loadAppSettings,
  saveAppSettings,
  type AppPage,
  type AppSettings,
  type ImagePromptReverseSettings,
  type PromptPolishSettings,
  type ThemeMode
} from '../services/appSettings';
import {
  loadPromptTemplates,
  savePromptTemplates,
  type PromptTemplate
} from '../services/promptTemplates';
import { importInspirationAsset } from '../services/inspirationApi';
import { buildFreePlatformPrompt, type FreePlatform } from '../services/freePlatforms';
import { createTranslator, type Translator } from '../i18n';
import { readStorageValue, writeStorageValue } from '../services/safeStorage';
import {
  appendBatchQueueTasks,
  appendBatchQueueTasksAndCompareGroups,
  createBatchQueue,
  createBatchQueueCompareGroup,
  createBatchQueueTask,
  createQueuedGenerationSnapshot,
  loadBatchQueueStore,
  removeBatchQueueTask,
  saveBatchQueueStore,
  summarizeBatchQueue,
  updateBatchQueueTask,
  upsertBatchQueue
} from '../services/batchQueue';
import { executeQueuedGenerationTask } from '../services/batchQueueExecutor';
import { useStudioStore } from '../store/useStudioStore';
import {
  BatchQueueNameDialog,
  ConfirmDialog,
  ShortcutsModal,
  SystemInfoModal,
  type BatchQueueNameDialogState,
  type ConfirmDialogState
} from './AppDialogs';
import { BatchQueuePage } from './BatchQueuePage';
import { CachedInspirationPage } from './CachedInspirationPage';
import {
  ComfyUIWorkflowManagerModal,
  ComfyUIWorkflowSummaryPanel,
  type LocalComfyUIWorkflowFormat,
  type LocalComfyUIWorkflowNode,
  type LocalComfyUIWorkflowNodeRole,
  type LocalComfyUIWorkflowPreset,
  type LocalComfyUIWorkflowStore,
  type LocalComfyUIWorkflowSummary
} from './ComfyUIWorkflowPresentation';
import { ModernGeneratePage } from './GeneratePage';
import { FreeGenerationPage } from './FreeGenerationPage';
import { PromptTemplatesPage } from './PromptTemplatesPage';
import { SettingsPage } from './SettingsPage';
import { WorkspaceHomePage } from './WorkspaceHomePage';
import {
  ImagePreviewModal,
  type ImagePreviewNavigation,
  type ImagePreviewNavigationItem,
  type ImagePreviewState
} from './ImagePreviewModal';
import {
  getRecordTimeMs,
  isPotentialBackgroundCompletion
} from './generationRecordPresentation';
import { StudioSelect } from './StudioSelect';
import type { ConfirmDialogRequest } from './confirmDialog';
import { CachedLibraryPage } from './library/LibraryPage';
import {
  compactLibraryMetaEntry,
  libraryFocusSearchEvent,
  loadLibraryMeta,
  recordBackgroundPollUrl,
  saveLibraryMeta
} from './library/libraryModel';
import { appToastEventName, defaultToastDurationMs, useToastMessage, type ToastEventDetail, type ToastLevel } from './toast';
import { readUrlSearchParam } from './urlSearch';

const APP_VERSION = '0.5.16';
const ACTIVE_BATCH_QUEUE_STORAGE_KEY = 'visionhub.batch.activeQueueId.v1';

type Page = AppPage;
type ProviderPlatformType = 'aggregator' | 'official' | 'local';
type ProviderServiceTemplateStatus = 'connected' | 'configurable' | 'planned' | 'local-plan';
type ProviderServiceRegion = 'domestic' | 'overseas' | 'local' | 'custom';
type ProviderMatrixStatus = 'live' | 'configurable' | 'partial' | 'planned' | 'localPlan' | 'unsupported' | 'unknown';
type LocalModelDiagnosticStatus = 'idle' | 'checking' | 'online' | 'offline' | 'failed';
type ProviderMatrixCapabilityKey =
  | 'textToImage'
  | 'imageToImage'
  | 'multiReferenceImage'
  | 'imagesApi'
  | 'responsesApi'
  | 'openAICompatible'
  | 'officialProtocol'
  | 'localService';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image.'));
    reader.readAsDataURL(file);
  });
}

function splitImageResultIntoSingleImageRecords(result: ImageGenerationResult): ImageGenerationResult[] {
  if (result.status !== 'succeeded' || result.imageUrls.length <= 1) return [result];

  const localImagePaths = result.localImagePaths ?? [];
  const total = result.imageUrls.length;
  return result.imageUrls.map((imageUrl, index) => ({
    ...result,
    id: `${result.id}-${index + 1}`,
    imageUrls: [imageUrl],
    localImagePaths: localImagePaths[index] ? [localImagePaths[index]] : [],
    raw: {
      visionhub_split_image_record: {
        sourceResultId: result.id,
        imageIndex: index + 1,
        total
      },
      originalRaw: result.raw ?? null
    }
  }));
}
type ProviderDiagnosticsReportContext = {
  platformLabel: string;
  serviceLabel: string;
  providerName: string;
  profileName?: string;
  profileId?: string | null;
  modelId?: string;
  endpointPreview?: string;
  protocolLabel?: string;
  imageToImageAdapterLabel?: string;
  generatedAt: string;
};
type ProviderPlatformOption = {
  id: ProviderPlatformType;
  label: string;
  description: string;
};
type ProviderServiceTemplate = {
  id: string;
  platformType: ProviderPlatformType;
  label: string;
  description: string;
  status: ProviderServiceTemplateStatus;
  region: ProviderServiceRegion;
  sortRank: number;
  providerId?: string;
  defaultDisplayName?: string;
  apiDocUrl?: string;
  supportsTextToImage?: boolean;
  supportsImageToImage?: boolean;
  requiresPolling?: boolean;
  notes: string[];
};
type ProviderCapabilityMatrixCell = {
  status: ProviderMatrixStatus;
};
type ToastItem = {
  id: number;
  message: string;
  level: ToastLevel;
  durationMs: number;
};
type LocalComfyUIConfig = {
  baseUrl: string;
};
type LocalComfyUIDiagnosticState = {
  status: LocalModelDiagnosticStatus;
  result: ComfyUIDiagnosisResult | null;
  error: string;
};
type LocalSdWebUIConfig = {
  baseUrl: string;
};
type LocalSdWebUIDiagnosticState = {
  status: LocalModelDiagnosticStatus;
  result: SdWebUIDiagnosisResult | null;
  error: string;
};
const LOCAL_COMFYUI_CONFIG_STORAGE_KEY = 'visionhub.local.comfyui.config.v1';
const LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY = 'visionhub.local.comfyui.workflow.v1';
const LOCAL_SD_WEBUI_CONFIG_STORAGE_KEY = 'visionhub.local.sdwebui.config.v1';
const DEFAULT_COMFYUI_BASE_URL = 'http://127.0.0.1:8188';
const DEFAULT_SD_WEBUI_BASE_URL = 'http://127.0.0.1:7860';
const LOCAL_COMFYUI_DIAGNOSTIC_TIMEOUT_MS = 12_000;
const LOCAL_SD_WEBUI_DIAGNOSTIC_TIMEOUT_MS = 12_000;

const providerPlatformOptions: ProviderPlatformOption[] = [
  {
    id: 'aggregator',
    label: 'Relay / Aggregator API',
    description: 'Default entry for relays, aggregators, and OpenAI-compatible services.'
  },
  {
    id: 'official',
    label: 'Official API',
    description: 'Official provider entry. Live integrations can call real APIs; planned entries stay informational.'
  },
  {
    id: 'local',
    label: 'Local models',
    description: 'Local workflow entry that does not affect the online relay flow.'
  }
];

const providerServiceTemplates: ProviderServiceTemplate[] = [
  {
    id: 'aggregator-openai-compatible',
    platformType: 'aggregator',
    label: 'OpenAI-compatible relay',
    description: 'Live now. Best for relay services that wrap GPT Image, Nano Banana, Qwen, Doubao, Grok, Midjourney, Kling, and similar models as OpenAI-compatible APIs.',
    status: 'connected',
    region: 'custom',
    sortRank: 10,
    providerId: 'custom-http-provider',
    defaultDisplayName: 'OpenAI-compatible relay',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['Follow the provider docs for Base URL, model ID, and protocol path.', 'Legacy relay configs are migrated here without changing profile IDs.']
  },
  {
    id: 'aggregator-generic-api',
    platformType: 'aggregator',
    label: 'Aggregator API',
    description: 'Generic aggregator template. It can save config; image capabilities depend on the actual provider.',
    status: 'configurable',
    region: 'custom',
    sortRank: 20,
    providerId: 'custom-http-provider',
    defaultDisplayName: 'Aggregator API',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['Use this when there is no dedicated brand template.', 'Before saving, fill Base URL, model ID, and protocol from the provider docs.']
  },
  {
    id: 'siliconflow',
    platformType: 'aggregator',
    label: 'SiliconFlow',
    description: 'Mainland aggregator candidate. Kept configurable first; image capability needs model-level validation.',
    status: 'configurable',
    region: 'domestic',
    sortRank: 30,
    providerId: 'custom-http-provider',
    defaultDisplayName: 'SiliconFlow',
    apiDocUrl: 'https://docs.siliconflow.cn/',
    supportsTextToImage: true,
    supportsImageToImage: false,
    notes: ['Connection config can be saved; image models and OpenAI-compatible behavior depend on the provider.']
  },
  {
    id: 'aggregator-custom',
    platformType: 'aggregator',
    label: 'Other aggregator',
    description: 'Generic custom template for other OpenAI-compatible aggregator APIs.',
    status: 'configurable',
    region: 'custom',
    sortRank: 90,
    providerId: 'custom-http-provider',
    defaultDisplayName: 'Other aggregator',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['Keeps maximum manual config space for providers with unusual docs.']
  },
  {
    id: 'official-openai',
    platformType: 'official',
    label: 'OpenAI official',
    description: 'Live now; only for https://api.openai.com.',
    status: 'connected',
    region: 'overseas',
    sortRank: 10,
    providerId: 'openai-gpt-image',
    defaultDisplayName: 'OpenAI official',
    apiDocUrl: 'https://platform.openai.com/docs/guides/images',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['ChatGPT Plus web quota is not API quota.', 'Legacy official OpenAI configs are migrated here without changing profile IDs.']
  },
  {
    id: 'official-minimax',
    platformType: 'official',
    label: 'MiniMax official',
    description: 'First official API V4 slice for China; supports text-to-image through the official image endpoint.',
    status: 'configurable',
    region: 'domestic',
    sortRank: 20,
    providerId: 'minimax-image',
    defaultDisplayName: 'MiniMax official',
    apiDocUrl: 'https://platform.minimaxi.com/',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['Uses the MiniMax official Bearer API key, separate from relay keys.', 'Currently supports image-01 / image-01-live text-to-image and single character subject reference; multi-reference comes later.']
  },
  {
    id: 'official-mimo',
    platformType: 'official',
    label: 'Xiaomi MiMo official',
    description: 'Mainland candidate. The official API currently focuses on text, image understanding, and multimodal reasoning; no image-generation endpoint is open yet.',
    status: 'planned',
    region: 'domestic',
    sortRank: 30,
    apiDocUrl: 'https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/multimodal-understanding/image-understanding',
    supportsTextToImage: false,
    supportsImageToImage: false,
    notes: ['Docs show image understanding with URL / Base64 image input for captioning, classification, and visual Q&A.', 'No public text-to-image / image-to-image endpoint found; keep this as informational only.']
  },
  {
    id: 'official-gemini',
    platformType: 'official',
    label: 'Google Gemini / Nano Banana official',
    description: 'First global official API V4 slice; supports Gemini image generation / editing and saves returned inline images.',
    status: 'configurable',
    region: 'overseas',
    sortRank: 40,
    providerId: 'gemini-image',
    defaultDisplayName: 'Google Gemini official',
    apiDocUrl: 'https://ai.google.dev/gemini-api/docs/image-generation',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['Uses a Google Gemini API key, separate from relay keys.', 'Currently uses gemini-2.5-flash-image for text-to-image and reference-image editing; multi-image limits come later.']
  },
  {
    id: 'official-xai',
    platformType: 'official',
    label: 'xAI official',
    description: 'Planned only. Save, enable, and real test generation are disabled for now.',
    status: 'planned',
    region: 'overseas',
    sortRank: 50,
    apiDocUrl: 'https://docs.x.ai/docs/guides/image-generations',
    supportsTextToImage: true,
    supportsImageToImage: false,
    notes: ['Future work will follow the official image endpoint capabilities.']
  },
  {
    id: 'official-volcengine',
    platformType: 'official',
    label: 'Volcengine / Seedream official',
    description: 'Planned only. Save, enable, and real test generation are disabled for now.',
    status: 'planned',
    region: 'domestic',
    sortRank: 60,
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['Future work needs Volcengine auth, model parameters, and result persistence.']
  },
  {
    id: 'official-bailian',
    platformType: 'official',
    label: 'Alibaba Model Studio / Tongyi Wanxiang official',
    description: 'Planned only. Save, enable, and real test generation are disabled for now.',
    status: 'planned',
    region: 'domestic',
    sortRank: 70,
    apiDocUrl: 'https://help.aliyun.com/zh/model-studio/',
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['Future work needs official auth and async task polling.']
  },
  {
    id: 'official-kling',
    platformType: 'official',
    label: 'Kling enterprise API',
    description: 'Planned only. Save, enable, and real test generation are disabled for now.',
    status: 'planned',
    region: 'domestic',
    sortRank: 80,
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['Can become an image / video generation enterprise API route later.']
  },
  {
    id: 'official-jimeng',
    platformType: 'official',
    label: 'Jimeng enterprise API',
    description: 'Planned only. Save, enable, and real test generation are disabled for now.',
    status: 'planned',
    region: 'domestic',
    sortRank: 90,
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['Can become a mainland official enterprise API route later.']
  },
  {
    id: 'local-comfyui',
    platformType: 'local',
    label: 'ComfyUI',
    description: 'Local ComfyUI supports connection diagnostics, API workflow import, text-to-image, and image-to-image tests with LoadImage nodes.',
    status: 'configurable',
    region: 'local',
    sortRank: 10,
    providerId: 'comfyui-local',
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['Supports ComfyUI API workflows; regular UI workflows must be re-exported from ComfyUI in API format.', 'Currently writes Prompt, negative prompt, size, and Seed automatically; image-to-image uploads the first reference image into LoadImage nodes.']
  },
  {
    id: 'local-sd-webui',
    platformType: 'local',
    label: 'Stable Diffusion WebUI / Forge',
    description: '0.4.3 supports local connection diagnostics, txt2img, and gallery save. WebUI / Forge must be launched with --api.',
    status: 'configurable',
    region: 'local',
    sortRank: 20,
    providerId: 'sd-webui-local',
    supportsTextToImage: true,
    supportsImageToImage: false,
    notes: ['A1111 Stable Diffusion WebUI or Forge must be started with --api.', 'Current slice supports txt2img, Seed, negative prompt, sampler, steps, CFG, and gallery save; img2img / ControlNet comes later.']
  }
];

const providerServiceStatusRank: Record<ProviderServiceTemplateStatus, number> = {
  connected: 0,
  configurable: 1,
  'local-plan': 2,
  planned: 3
};

const providerMatrixColumnKeys: ProviderMatrixCapabilityKey[] = [
  'textToImage',
  'imageToImage',
  'multiReferenceImage',
  'imagesApi',
  'responsesApi',
  'openAICompatible',
  'officialProtocol',
  'localService'
];

function loadLocalComfyUIConfig(): LocalComfyUIConfig {
  const raw = readStorageValue(LOCAL_COMFYUI_CONFIG_STORAGE_KEY);
  if (!raw) return { baseUrl: DEFAULT_COMFYUI_BASE_URL };
  try {
    const parsed = JSON.parse(raw) as Partial<LocalComfyUIConfig>;
    return {
      baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim()
        ? parsed.baseUrl.trim()
        : DEFAULT_COMFYUI_BASE_URL
    };
  } catch (error) {
    console.warn('[VisionHub] local ComfyUI config parse failed; using default', error);
    return { baseUrl: DEFAULT_COMFYUI_BASE_URL };
  }
}

function saveLocalComfyUIConfig(config: LocalComfyUIConfig) {
  writeStorageValue(LOCAL_COMFYUI_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function loadLocalSdWebUIConfig(): LocalSdWebUIConfig {
  const raw = readStorageValue(LOCAL_SD_WEBUI_CONFIG_STORAGE_KEY);
  if (!raw) return { baseUrl: DEFAULT_SD_WEBUI_BASE_URL };
  try {
    const parsed = JSON.parse(raw) as Partial<LocalSdWebUIConfig>;
    return {
      baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim()
        ? parsed.baseUrl.trim()
        : DEFAULT_SD_WEBUI_BASE_URL
    };
  } catch (error) {
    console.warn('[VisionHub] local SD WebUI config parse failed; using default', error);
    return { baseUrl: DEFAULT_SD_WEBUI_BASE_URL };
  }
}

function saveLocalSdWebUIConfig(config: LocalSdWebUIConfig) {
  writeStorageValue(LOCAL_SD_WEBUI_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function createLocalWorkflowPreset(summary: LocalComfyUIWorkflowSummary, name?: string, rawWorkflow?: unknown): LocalComfyUIWorkflowPreset {
  const now = new Date().toISOString();
  return {
    id: `comfyui-workflow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name?.trim() || summary.fileName.replace(/\.json$/i, '') || 'ComfyUI workflow',
    summary,
    rawWorkflow,
    createdAt: now,
    updatedAt: now
  };
}

function normalizeLocalComfyUIWorkflowStore(value: unknown): LocalComfyUIWorkflowStore {
  const record = asRecord(value);
  if (!record) return { activeId: null, presets: [] };
  if (typeof record.fileName === 'string') {
    const preset = createLocalWorkflowPreset(record as unknown as LocalComfyUIWorkflowSummary);
    return { activeId: preset.id, presets: [preset] };
  }
  const presets = Array.isArray(record.presets)
    ? record.presets
        .map((item) => {
          const preset = asRecord(item);
          const summary = asRecord(preset?.summary);
          if (!preset || !summary || typeof preset.id !== 'string' || typeof preset.name !== 'string' || typeof summary.fileName !== 'string') return null;
          return {
            ...preset,
            rawWorkflow: 'rawWorkflow' in preset ? preset.rawWorkflow : undefined
          } as unknown as LocalComfyUIWorkflowPreset;
        })
        .filter((item): item is LocalComfyUIWorkflowPreset => Boolean(item))
    : [];
  const activeId = typeof record.activeId === 'string' && presets.some((preset) => preset.id === record.activeId)
    ? record.activeId
    : presets[0]?.id ?? null;
  return { activeId, presets };
}

function loadLocalComfyUIWorkflowStore(): LocalComfyUIWorkflowStore {
  const raw = readStorageValue(LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY);
  if (!raw) return { activeId: null, presets: [] };
  try {
    return normalizeLocalComfyUIWorkflowStore(JSON.parse(raw) as unknown);
  } catch (error) {
    console.warn('[VisionHub] local ComfyUI workflow store parse failed; ignoring saved workflows', error);
    return { activeId: null, presets: [] };
  }
}

function saveLocalComfyUIWorkflowStore(store: LocalComfyUIWorkflowStore) {
  if (!store.presets.length) {
    window.localStorage.removeItem(LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY);
    return;
  }
  writeStorageValue(LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY, JSON.stringify(store));
}

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsText(file, 'utf-8');
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringifyWorkflowValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(stringifyWorkflowValue).filter(Boolean).join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return '';
}

function summarizeApiWorkflowInputs(inputs: Record<string, unknown> | null, keys: string[]) {
  if (!inputs) return '';
  return keys
    .filter((key) => key in inputs)
    .map((key) => `${key}: ${stringifyWorkflowValue(inputs[key])}`)
    .filter(Boolean)
    .join(' · ');
}

function classifyComfyUIRole(type: string): LocalComfyUIWorkflowNodeRole {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('cliptextencode') || lowerType.includes('prompt')) return 'prompt';
  if (lowerType.includes('ksampler') || lowerType.includes('sampler')) return 'sampler';
  if (lowerType.includes('checkpoint') || lowerType.includes('unetloader')) return 'checkpoint';
  if (lowerType.includes('emptylatent') || lowerType.includes('latentsize') || lowerType.includes('resize')) return 'size';
  if (lowerType.includes('saveimage') || lowerType.includes('previewimage')) return 'output';
  if (lowerType.includes('loader') || lowerType.includes('lora') || lowerType.includes('vae')) return 'loader';
  return 'other';
}

function makeWorkflowNode(id: string, type: string, title: string | undefined, inputs: Record<string, unknown> | null): LocalComfyUIWorkflowNode {
  const role = classifyComfyUIRole(type);
  const summaryKeysByRole: Record<LocalComfyUIWorkflowNodeRole, string[]> = {
    prompt: ['text', 'clip'],
    sampler: ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise', 'latent_image'],
    checkpoint: ['ckpt_name', 'unet_name', 'model_name'],
    size: ['width', 'height', 'batch_size', 'pixels'],
    output: ['filename_prefix', 'images'],
    loader: ['lora_name', 'vae_name', 'ckpt_name', 'model_name'],
    other: []
  };
  const summary = summarizeApiWorkflowInputs(inputs, summaryKeysByRole[role]) || 'Node detected. Expand the full fields later when mapping.';
  return {
    id,
    type,
    title,
    role,
    summary
  };
}

function parseComfyUIApiWorkflow(fileName: string, raw: Record<string, unknown>): LocalComfyUIWorkflowSummary | null {
  const entries = Object.entries(raw).filter(([, value]) => {
    const node = asRecord(value);
    return typeof node?.class_type === 'string';
  });
  if (!entries.length) return null;
  const nodes = entries.map(([id, value]) => {
    const node = asRecord(value);
    const type = String(node?.class_type ?? 'Unknown');
    return makeWorkflowNode(id, type, undefined, asRecord(node?.inputs));
  });
  return buildComfyUIWorkflowSummary(fileName, 'api', nodes, null);
}

function parseComfyUIUiWorkflow(fileName: string, raw: Record<string, unknown>): LocalComfyUIWorkflowSummary | null {
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  if (!rawNodes.length) return null;
  const nodes = rawNodes
    .map((value, index) => {
      const node = asRecord(value);
      if (!node) return null;
      const type = typeof node.type === 'string' ? node.type : typeof node.class_type === 'string' ? node.class_type : 'Unknown';
      const title = typeof node.title === 'string' ? node.title : undefined;
      const widgetsValues = Array.isArray(node.widgets_values)
        ? Object.fromEntries(node.widgets_values.map((item, valueIndex) => [`widget_${valueIndex + 1}`, item]))
        : null;
      return makeWorkflowNode(String(node.id ?? index + 1), type, title, widgetsValues);
    })
    .filter((node): node is LocalComfyUIWorkflowNode => Boolean(node));
  const linkCount = Array.isArray(raw.links) ? raw.links.length : null;
  return buildComfyUIWorkflowSummary(fileName, 'ui', nodes, linkCount);
}

function buildComfyUIWorkflowSummary(
  fileName: string,
  format: LocalComfyUIWorkflowFormat,
  nodes: LocalComfyUIWorkflowNode[],
  linkCount: number | null
): LocalComfyUIWorkflowSummary {
  const promptNodes = nodes.filter((node) => node.role === 'prompt');
  const samplerNodes = nodes.filter((node) => node.role === 'sampler');
  const checkpointNodes = nodes.filter((node) => node.role === 'checkpoint');
  const sizeNodes = nodes.filter((node) => node.role === 'size');
  const outputNodes = nodes.filter((node) => node.role === 'output');
  const loaderNodes = nodes.filter((node) => node.role === 'loader');
  const otherKeyNodes = nodes
    .filter((node) => node.role === 'other')
    .slice(0, 6);
  const warnings: string[] = [];
  if (!promptNodes.length) warnings.push('No text prompt node detected. Manually choose the Prompt target before generation.');
  if (!samplerNodes.length) warnings.push('No sampler node detected. Confirm the task entry before real generation.');
  if (!outputNodes.length) warnings.push('No save or preview image node detected. Confirm how output images should be read.');
  return {
    fileName,
    importedAt: new Date().toISOString(),
    format,
    nodeCount: nodes.length,
    linkCount,
    promptNodes,
    samplerNodes,
    checkpointNodes,
    sizeNodes,
    outputNodes,
    loaderNodes,
    otherKeyNodes,
    warnings
  };
}

function parseComfyUIWorkflow(fileName: string, content: string): LocalComfyUIWorkflowSummary {
  const raw = JSON.parse(content) as unknown;
  const record = asRecord(raw);
  if (!record) {
    throw new Error('Workflow JSON root is not an object and cannot be detected.');
  }
  const apiSummary = parseComfyUIApiWorkflow(fileName, record);
  if (apiSummary) return apiSummary;
  const uiSummary = parseComfyUIUiWorkflow(fileName, record);
  if (uiSummary) return uiSummary;
  return buildComfyUIWorkflowSummary(fileName, 'unknown', [], null);
}

function buildProviderDiagnosticsReport(checks: ProviderDiagnosticItem[], context: ProviderDiagnosticsReportContext, t: Translator) {
  const counts = checks.reduce((acc, item) => {
    acc[item.level] += 1;
    return acc;
  }, { pass: 0, warn: 0, fail: 0, info: 0 } as Record<ProviderDiagnosticLevel, number>);
  const levelLabel = (level: ProviderDiagnosticLevel) => t(`provider.report.level.${level}` as Parameters<Translator>[0]);
  return [
    t('provider.report.title'),
    t('provider.report.generatedAt', { value: context.generatedAt }),
    t('provider.report.platform', { value: context.platformLabel }),
    t('provider.report.service', { value: context.serviceLabel }),
    t('provider.report.provider', { value: context.providerName }),
    context.profileName
      ? t('provider.report.profile', { name: context.profileName, id: context.profileId ? ` (${context.profileId})` : '' })
      : t('provider.report.profileDraft'),
    context.modelId ? t('provider.report.model', { value: context.modelId }) : '',
    t('provider.report.summary', { pass: counts.pass, warn: counts.warn, fail: counts.fail, info: counts.info }),
    '',
    ...checks.map((item, index) => [
      `#${index + 1} ${item.label}`,
      t('provider.report.itemLevel', { level: levelLabel(item.level) }),
      t('provider.report.itemDetail', { detail: item.detail })
    ].join('\n')),
    '',
    t('provider.report.safety')
  ].filter((line) => line !== '').join('\n\n');
}

function isBackgroundRecoveryCandidate(record: Pick<GenerationRecord, 'status' | 'error' | 'raw'>) {
  return Boolean((record.status === 'failed' || record.error) && recordBackgroundPollUrl(record) && isPotentialBackgroundCompletion(record));
}

function mapProviderCapabilityToMatrixStatus(
  template: ProviderServiceTemplate,
  capabilityStatus: ProviderCapabilityStatus
): ProviderMatrixStatus {
  if (capabilityStatus === 'supported') {
    return template.status === 'connected' ? 'live' : template.status === 'configurable' ? 'configurable' : template.status === 'local-plan' ? 'localPlan' : 'planned';
  }
  if (capabilityStatus === 'partial') return 'partial';
  if (capabilityStatus === 'planned') return template.status === 'local-plan' ? 'localPlan' : 'planned';
  if (capabilityStatus === 'unsupported') return 'unsupported';
  return 'unknown';
}

function resolveProtocolMatrixStatus(template: ProviderServiceTemplate, capability: ProviderMatrixCapabilityKey): ProviderMatrixStatus {
  if (capability === 'localService') {
    return template.platformType === 'local' ? 'localPlan' : 'unsupported';
  }
  if (capability === 'officialProtocol') {
    if (template.platformType !== 'official') return 'unsupported';
    return template.status === 'connected' ? 'live' : 'planned';
  }
  if (capability === 'openAICompatible') {
    if (template.platformType !== 'aggregator') return 'unsupported';
    return template.status === 'connected' ? 'live' : template.status === 'configurable' ? 'configurable' : 'planned';
  }
  if (capability === 'imagesApi' || capability === 'responsesApi') {
    if (template.status === 'connected') return 'live';
    if (template.status === 'configurable') return 'configurable';
    if (template.status === 'local-plan') return 'unsupported';
    return 'planned';
  }
  return 'unknown';
}

function getProviderCapabilityMatrixCell(
  template: ProviderServiceTemplate,
  column: { key: ProviderMatrixCapabilityKey; label: string },
  providers: ReturnType<typeof listProviders>
): ProviderCapabilityMatrixCell {
  const provider = template.providerId ? providers.find((item) => item.id === template.providerId) : undefined;
  let status: ProviderMatrixStatus;

  if (column.key === 'textToImage' || column.key === 'imageToImage' || column.key === 'multiReferenceImage') {
    if (provider) {
      status = mapProviderCapabilityToMatrixStatus(template, provider.capabilities[column.key]);
    } else {
      status = template.status === 'local-plan' ? 'localPlan' : 'planned';
    }
  } else {
    status = resolveProtocolMatrixStatus(template, column.key);
  }

  return {
    status
  };
}


const GITHUB_REPOSITORY_URL = 'https://github.com/BlueSummer2333/VisionHub-Studio';
const GITHUB_RELEASES_URL = `${GITHUB_REPOSITORY_URL}/releases`;
const BATCH_QUEUE_TEMPLATE_STORAGE_KEY = 'visionhub.batch.queueTemplates.v1';
const MAX_BATCH_QUEUE_TEMPLATES = 40;

type UtilityModal = 'system-info' | 'shortcuts' | null;
type GenerateShortcutName = 'submit' | 'focus-prompt' | 'add-reference' | 'clear-references' | 'mode-image' | 'mode-text';
type GenerateSubmissionOptions = {
  mode?: GenerationMode;
  references?: ReferenceImage[];
  outputFormat?: ImageGenerationRequest['outputFormat'];
  outputCompression?: ImageGenerationRequest['outputCompression'];
  negativePrompt?: ImageGenerationRequest['negativePrompt'];
  seed?: ImageGenerationRequest['seed'];
  metadata?: ImageGenerationRequest['metadata'];
};

const generateShortcutEventName: Record<GenerateShortcutName, string> = {
  submit: 'visionhub:generate-submit',
  'focus-prompt': 'visionhub:generate-focus-prompt',
  'add-reference': 'visionhub:generate-add-reference',
  'clear-references': 'visionhub:generate-clear-references',
  'mode-image': 'visionhub:generate-mode-image',
  'mode-text': 'visionhub:generate-mode-text'
};

function loadBatchQueueTemplates(): BatchQueueTemplate[] {
  const raw = readStorageValue(BATCH_QUEUE_TEMPLATE_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeBatchQueueTemplate)
      .filter((template) => template.taskTemplates.length > 0)
      .slice(0, MAX_BATCH_QUEUE_TEMPLATES);
  } catch (error) {
    console.warn('[VisionHub] batch queue templates parse failed; using empty list', error);
    return [];
  }
}

function saveBatchQueueTemplates(templates: BatchQueueTemplate[]) {
  writeStorageValue(
    BATCH_QUEUE_TEMPLATE_STORAGE_KEY,
    JSON.stringify(templates.map(normalizeBatchQueueTemplate).slice(0, MAX_BATCH_QUEUE_TEMPLATES))
  );
}

function createBatchQueueTemplateFromQueue(queue: BatchGenerationQueue, name?: string, t?: Translator): BatchQueueTemplate {
  const now = new Date().toISOString();
  const taskTemplates = queue.tasks.map((task): BatchQueueTaskTemplate => ({
    kind: task.kind,
    compareGroupId: task.compareGroupId,
    title: task.title,
    snapshot: task.snapshot
  }));
  const compareGroups = (queue.compareGroups ?? [])
    .map((group): BatchQueueCompareGroupTemplate => ({
      id: group.id,
      prompt: group.prompt,
      profileIds: group.profileIds,
      taskIndexes: group.taskIds
        .map((taskId) => queue.tasks.findIndex((task) => task.id === taskId))
        .filter((index) => index >= 0)
    }))
    .filter((group) => group.taskIndexes.length > 0);

  return normalizeBatchQueueTemplate({
    id: createLocalId('batch-template'),
    name: name?.trim() || (t ? t('batch.template.defaultName', { name: queue.name }) : `${queue.name} template`),
    description: t ? t('batch.template.summary', { tasks: taskTemplates.length, groups: compareGroups.length }) : `${taskTemplates.length} tasks ? ${compareGroups.length} compare groups`,
    taskTemplates,
    compareGroups,
    createdAt: now,
    updatedAt: now,
    usedCount: 0
  });
}

function normalizeBatchQueueTemplate(value: Partial<BatchQueueTemplate>): BatchQueueTemplate {
  const createdAt = value.createdAt || new Date().toISOString();
  const taskTemplates = Array.isArray(value.taskTemplates)
    ? value.taskTemplates
      .map((task): BatchQueueTaskTemplate | null => {
        if (!task?.snapshot?.prompt?.trim()) return null;
        return {
          kind: task.kind === 'model-compare' ? 'model-compare' : task.kind === 'prompt-size-sweep' ? 'prompt-size-sweep' : 'single',
          compareGroupId: task.compareGroupId,
          title: task.title?.trim() || task.snapshot.prompt.slice(0, 40) || 'Untitled task',
          snapshot: task.snapshot
        };
      })
      .filter((task): task is BatchQueueTaskTemplate => Boolean(task))
    : [];
  return {
    id: value.id || createLocalId('batch-template'),
    name: value.name?.trim() || 'Untitled batch template',
    description: value.description?.trim() || undefined,
    taskTemplates,
    compareGroups: Array.isArray(value.compareGroups)
      ? value.compareGroups.map((group) => ({
        id: group.id || createLocalId('compare-template'),
        prompt: String(group.prompt || ''),
        profileIds: Array.isArray(group.profileIds) ? group.profileIds.map(String) : [],
        taskIndexes: Array.isArray(group.taskIndexes) ? group.taskIndexes.map((index) => Math.max(0, Math.round(Number(index)))) : []
      })).filter((group) => group.taskIndexes.length > 0)
      : [],
    createdAt,
    updatedAt: value.updatedAt || createdAt,
    lastUsedAt: value.lastUsedAt,
    usedCount: Math.max(0, Math.round(Number(value.usedCount ?? 0)))
  };
}

function createLocalId(prefix: string) {
  const cryptoApi = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoApi?.randomUUID) return `${prefix}-${cryptoApi.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readInitialAppSettings(): AppSettings {
  const settings = loadAppSettings();
  if (typeof window === 'undefined') return settings;

  const theme = readUrlSearchParam('theme');
  const mode = readUrlSearchParam('mode');
  let nextSettings = settings;
  if (theme === 'dark' || theme === 'light' || theme === 'system') {
    nextSettings = { ...nextSettings, themeMode: theme as ThemeMode };
  }
  if (mode === 'text' || mode === 'image') {
    nextSettings = {
      ...nextSettings,
      generationDefaults: {
        ...nextSettings.generationDefaults,
        defaultMode: mode
      }
    };
  }
  return nextSettings;
}

function readInitialPage(fallback: Page): Page {
  if (typeof window === 'undefined') return fallback;
  const page = readUrlSearchParam('page');
  return STARTUP_PAGE_OPTIONS.some((option) => option.value === page) ? page as Page : fallback;
}

export function App() {
  const providers = useMemo(() => listProviders(), []);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => readInitialAppSettings());
  const t = useMemo(() => createTranslator(appSettings.language), [appSettings.language]);
  const resolveProviderGenerationLabel = useCallback(
    (provider: ReturnType<typeof listProviders>[number]) => providerGenerationLabel(provider, t),
    [t]
  );
  const [page, setPage] = useState<Page>(() => readInitialPage(appSettings.startupPage));
  const [secretDraft, setSecretDraft] = useState('');
  const [secretAvailable, setSecretAvailable] = useState(false);
  const [generationSecretAvailable, setGenerationSecretAvailable] = useState(false);
  const [secretMessage, setSecretMessage] = useState('');
  const [providerConfig, setProviderConfig] = useState<OpenAICompatibleConfig>(
    defaultOpenAICompatibleConfig
  );
  const [providerProfiles, setProviderProfiles] = useState<ProviderConnectionProfile[]>(() => loadProviderProfiles());
  const [selectedPlatformType, setSelectedPlatformType] = useState<ProviderPlatformType>('aggregator');
  const [selectedServiceTemplateId, setSelectedServiceTemplateId] = useState('aggregator-openai-compatible');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isCreatingProviderProfile, setIsCreatingProviderProfile] = useState(false);
  const [configActionState, setConfigActionState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [configMessage, setConfigMessage] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [promptPolishSecretDraft, setPromptPolishSecretDraft] = useState('');
  const [promptPolishSecretAvailable, setPromptPolishSecretAvailable] = useState(false);
  const [isSavingPromptPolishSecret, setIsSavingPromptPolishSecret] = useState(false);
  const [promptPolishDraft, setPromptPolishDraft] = useState<PromptPolishSettings>(() => appSettings.promptPolish);
  const [isRefreshingPromptPolishModels, setIsRefreshingPromptPolishModels] = useState(false);
  const [imageReverseSecretDraft, setImageReverseSecretDraft] = useState('');
  const [imageReverseSecretAvailable, setImageReverseSecretAvailable] = useState(false);
  const [isSavingImageReverseSecret, setIsSavingImageReverseSecret] = useState(false);
  const [imageReverseDraft, setImageReverseDraft] = useState<ImagePromptReverseSettings>(() => appSettings.imagePromptReverse);
  const [isRefreshingImageReverseModels, setIsRefreshingImageReverseModels] = useState(false);
  const [activeUtilityModal, setActiveUtilityModal] = useState<UtilityModal>(null);
  const [freePlatformMessage, setFreePlatformMessage] = useState('');
  const [isSavingSecret, setIsSavingSecret] = useState(false);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [isProbingModel, setIsProbingModel] = useState(false);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [isRunningTestGeneration, setIsRunningTestGeneration] = useState(false);
  const [providerDiagnostics, setProviderDiagnostics] = useState<ProviderDiagnosticItem[]>([]);
  const [localComfyUIConfig, setLocalComfyUIConfig] = useState<LocalComfyUIConfig>(() => loadLocalComfyUIConfig());
  const [localComfyUIDiagnostic, setLocalComfyUIDiagnostic] = useState<LocalComfyUIDiagnosticState>({
    status: 'idle',
    result: null,
    error: ''
  });
  const [localSdWebUIConfig, setLocalSdWebUIConfig] = useState<LocalSdWebUIConfig>(() => loadLocalSdWebUIConfig());
  const [localSdWebUIDiagnostic, setLocalSdWebUIDiagnostic] = useState<LocalSdWebUIDiagnosticState>({
    status: 'idle',
    result: null,
    error: ''
  });
  const [localComfyUIWorkflowStore, setLocalComfyUIWorkflowStore] = useState<LocalComfyUIWorkflowStore>(() => loadLocalComfyUIWorkflowStore());
  const [isComfyUIWorkflowManagerOpen, setIsComfyUIWorkflowManagerOpen] = useState(false);
  const [localComfyUIWorkflowError, setLocalComfyUIWorkflowError] = useState('');
  const [generatePreviewUrl, setGeneratePreviewUrl] = useState<string | null>(null);
  const [libraryPreview, setLibraryPreview] = useState<ImagePreviewState | null>(null);
  const [inspirationPreview, setInspirationPreview] = useState<ImagePreviewState | null>(null);
  const [inspirationImportVersion, setInspirationImportVersion] = useState(0);
  const [isLibraryPageMounted, setIsLibraryPageMounted] = useState(() => page === 'library');
  const [isInspirationPageMounted, setIsInspirationPageMounted] = useState(() => page === 'inspiration');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => appSettings.sidebarCollapsed);
  const [isThemeSwitching, setIsThemeSwitching] = useState(false);
  const [storageSettings, setStorageSettings] = useState<StorageSettings | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [batchQueueStore, setBatchQueueStore] = useState(() => loadBatchQueueStore());
  const [activeBatchQueueId, setActiveBatchQueueId] = useState(() => readStorageValue(ACTIVE_BATCH_QUEUE_STORAGE_KEY) || '');
  const [executingBatchTaskId, setExecutingBatchTaskId] = useState<string | null>(null);
  const [runningBatchQueueId, setRunningBatchQueueId] = useState<string | null>(null);
  const [batchQueueRunProgress, setBatchQueueRunProgress] = useState<BatchQueueRunProgress | null>(null);
  const [batchQueueTemplates, setBatchQueueTemplates] = useState<BatchQueueTemplate[]>(() => loadBatchQueueTemplates());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [batchQueueNameDialog, setBatchQueueNameDialog] = useState<BatchQueueNameDialogState | null>(null);
  const [generateSessionStartedAt] = useState(() => Date.now());
  const autoRecheckedRecordIdsRef = useRef<Set<string>>(new Set());
  const localComfyUIDiagnosticRequestRef = useRef(0);
  const localComfyUIAutoCheckRunningRef = useRef(false);
  const localSdWebUIDiagnosticRequestRef = useRef(0);
  const localSdWebUIAutoCheckRunningRef = useRef(false);
  const batchQueueStopRequestedRef = useRef(false);
  const themeSwitchTimerRef = useRef<number | null>(null);
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const themeMode = appSettings.themeMode;
  const resolvedThemeMode = themeMode === 'system' ? systemTheme : themeMode;

  function syncDocumentTheme(mode: 'dark' | 'light') {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    document.documentElement.style.removeProperty('--app-bg');
    document.documentElement.style.removeProperty('--app-text');
    document.body.dataset.theme = mode;
  }

  function beginThemeSwitchLock() {
    if (typeof window === 'undefined') return;
    setIsThemeSwitching(true);
    document.documentElement.dataset.themeSwitching = 'true';
    if (themeSwitchTimerRef.current !== null) {
      window.clearTimeout(themeSwitchTimerRef.current);
    }
    themeSwitchTimerRef.current = window.setTimeout(() => {
      setIsThemeSwitching(false);
      delete document.documentElement.dataset.themeSwitching;
      themeSwitchTimerRef.current = null;
    }, 180);
  }

  useToastMessage(secretMessage, setSecretMessage);
  useToastMessage(configMessage, setConfigMessage);
  useToastMessage(settingsMessage, setSettingsMessage);
  useToastMessage(freePlatformMessage, setFreePlatformMessage);

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

  const generationSelectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? providers[0];
  const selectedServiceTemplate =
    getProviderServiceTemplate(selectedServiceTemplateId) ??
    getProviderServiceTemplatesForPlatform(selectedPlatformType)[0] ??
    providerServiceTemplates[0];
  const selectedProvider =
    providers.find((provider) => provider.id === (selectedServiceTemplate.providerId ?? selectedProviderId)) ??
    generationSelectedProvider;
  const isSelectedServiceConfigurable = isProviderServiceTemplateConfigurable(selectedServiceTemplate);
  const selectedProviderProfiles = useMemo(
    () => providerProfiles.filter((profile) => providerProfileBelongsToTemplate(profile, selectedServiceTemplate)),
    [providerProfiles, selectedServiceTemplate]
  );
  const selectedProfile = isCreatingProviderProfile
    ? null
    : selectedProviderProfiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const activeGenerationProfile = useMemo(
    () => getProfilesForProvider(providerProfiles, selectedProviderId).find((profile) => profile.enabled) ??
      getProfilesForProvider(providerProfiles, selectedProviderId)[0] ??
      null,
    [providerProfiles, selectedProviderId]
  );
  const activeGenerationConfig = activeGenerationProfile
    ? profileToProviderConfig(activeGenerationProfile)
    : loadProviderConfig(selectedProviderId);
  const desktopRuntime = isTauriRuntime();
  const selectedProviderUsesConfig = providerUsesConfig(selectedProvider.id);
  const generationProviderUsesConfig = providerUsesConfig(selectedProviderId);
  const selectedProviderSupportsModelList = providerSupportsOpenAICompatibleModelList(selectedProvider.id);
  const supportsOpenAICompatible = selectedProviderUsesConfig;
  const generationSupportsOpenAICompatible = generationProviderUsesConfig;
  const activeComfyUIWorkflowPreset =
    localComfyUIWorkflowStore.presets.find((item) => item.id === localComfyUIWorkflowStore.activeId) ??
    localComfyUIWorkflowStore.presets[0] ??
    null;
  const isComfyUIGenerationReady =
    desktopRuntime &&
    selectedProviderId === 'comfyui-local' &&
    Boolean(activeComfyUIWorkflowPreset?.rawWorkflow);
  const isSdWebUIGenerationReady =
    desktopRuntime &&
    selectedProviderId === 'sd-webui-local' &&
    Boolean(localSdWebUIConfig.baseUrl.trim());
  const isRealProviderReady = desktopRuntime && (
    (generationProviderUsesConfig && generationSecretAvailable) ||
    isComfyUIGenerationReady ||
    isSdWebUIGenerationReady
  );
  const homeProviderNameMap = useMemo(
    () => new Map(providers.map((provider) => [provider.id, provider.name])),
    [providers]
  );
  const homeLibraryMeta = useMemo(() => loadLibraryMeta(), [page, results]);
  const homeSortedRecords = useMemo(
    () => [...results].sort((a, b) => getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt)),
    [results]
  );
  const homeRecentSuccessRecords = useMemo(
    () => homeSortedRecords.filter((record) => record.status === 'succeeded' && Boolean(record.imageUrls[0])).slice(0, 4),
    [homeSortedRecords]
  );
  const homeRecentFailureRecords = useMemo(
    () => homeSortedRecords.filter((record) => record.status === 'failed' || isPotentialBackgroundCompletion(record)).slice(0, 3),
    [homeSortedRecords]
  );
  const homeFavoriteRecords = useMemo(
    () => homeSortedRecords
      .filter((record) => Boolean(homeLibraryMeta[record.id]?.favorite && record.imageUrls[0]))
      .sort((a, b) => {
        const left = homeLibraryMeta[a.id];
        const right = homeLibraryMeta[b.id];
        const leftTime = getRecordTimeMs(left?.lastViewedAt ?? left?.lastUsedAsReferenceAt ?? a.createdAt);
        const rightTime = getRecordTimeMs(right?.lastViewedAt ?? right?.lastUsedAsReferenceAt ?? b.createdAt);
        return rightTime - leftTime;
      })
      .slice(0, 4),
    [homeLibraryMeta, homeSortedRecords]
  );
  const homeReferenceRecords = useMemo(
    () => homeSortedRecords
      .filter((record) => Boolean(homeLibraryMeta[record.id]?.lastUsedAsReferenceAt && record.imageUrls[0]))
      .sort((a, b) => getRecordTimeMs(homeLibraryMeta[b.id]?.lastUsedAsReferenceAt ?? '') - getRecordTimeMs(homeLibraryMeta[a.id]?.lastUsedAsReferenceAt ?? ''))
      .slice(0, 4),
    [homeLibraryMeta, homeSortedRecords]
  );
  const homeResultSummary = useMemo(() => ({
    total: results.length,
    succeeded: results.filter((record) => record.status === 'succeeded').length,
    failed: results.filter((record) => record.status === 'failed').length,
    pending: results.filter(isPotentialBackgroundCompletion).length
  }), [results]);
  const batchQueueAggregate = useMemo(() => batchQueueStore.queues.reduce((acc, queue) => {
    const summary = summarizeBatchQueue(queue);
    acc.queueCount += 1;
    acc.total += summary.total;
    acc.pending += summary.pending;
    acc.running += summary.running;
    acc.succeeded += summary.succeeded;
    acc.failed += summary.failed;
    acc.cancelled += summary.cancelled;
    acc.requestedImages += summary.requestedImages;
    return acc;
  }, {
    queueCount: 0,
    total: 0,
    pending: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    requestedImages: 0
  }), [batchQueueStore]);
  const activeBatchQueue = useMemo(() => (
    (activeBatchQueueId ? batchQueueStore.queues.find((queue) => queue.id === activeBatchQueueId) : null)
    ?? batchQueueStore.queues[0]
    ?? null
  ), [activeBatchQueueId, batchQueueStore]);
  const activeBatchQueueSummary = useMemo(() => (
    activeBatchQueue ? summarizeBatchQueue(activeBatchQueue) : null
  ), [activeBatchQueue]);
  const openLibraryPreview = useCallback((imageUrl: string, navigation?: ImagePreviewNavigation) => {
    setLibraryPreview({ imageUrl, navigation });
  }, []);
  const closeLibraryPreview = useCallback(() => setLibraryPreview(null), []);
  const navigateLibraryPreview = useCallback((item: ImagePreviewNavigationItem) => {
    setLibraryPreview((current) => current ? {
      imageUrl: item.imageUrl,
      navigation: current.navigation ? { ...current.navigation, currentId: item.id } : undefined
    } : current);
  }, []);
  const openInspirationPreview = useCallback((imageUrl: string, navigation?: ImagePreviewNavigation) => {
    setInspirationPreview({ imageUrl, navigation });
  }, []);
  const closeInspirationPreview = useCallback(() => setInspirationPreview(null), []);
  const navigateInspirationPreview = useCallback((item: ImagePreviewNavigationItem) => {
    setInspirationPreview((current) => current ? {
      imageUrl: item.imageUrl,
      navigation: current.navigation ? { ...current.navigation, currentId: item.id } : undefined
    } : current);
  }, []);
  const deleteLibraryRecord = useCallback(async (recordId: string) => {
    setLibraryPreview(null);
    await removeResult(recordId);
  }, [removeResult]);

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
    if (!desktopRuntime) {
      setPromptPolishSecretAvailable(false);
      return;
    }
    let isActive = true;
    void getProviderSecretStatus(PROMPT_POLISH_SECRET_ID)
      .then((status) => {
        if (isActive) setPromptPolishSecretAvailable(status.available);
      })
      .catch(() => {
        if (isActive) setPromptPolishSecretAvailable(false);
      });

    return () => {
      isActive = false;
    };
  }, [desktopRuntime]);

  useEffect(() => {
    if (!desktopRuntime) {
      setImageReverseSecretAvailable(false);
      return;
    }
    let isActive = true;
    void getProviderSecretStatus(IMAGE_PROMPT_REVERSE_SECRET_ID)
      .then((status) => {
        if (isActive) setImageReverseSecretAvailable(status.available);
      })
      .catch(() => {
        if (isActive) setImageReverseSecretAvailable(false);
      });

    return () => {
      isActive = false;
    };
  }, [desktopRuntime]);

  useEffect(() => {
    if (!desktopRuntime || !generationSupportsOpenAICompatible) {
      setGenerationSecretAvailable(false);
      return;
    }
    let isActive = true;
    const secretId = activeGenerationProfile
      ? providerProfileSecretId(activeGenerationProfile.id)
      : selectedProviderId;
    void getProviderSecretStatus(secretId)
      .then(async (status) => {
        if (!isActive) return;
        if (status.available || !activeGenerationProfile) {
          setGenerationSecretAvailable(status.available);
          return;
        }
        const legacyStatus = await getProviderSecretStatus(selectedProviderId);
        if (isActive) setGenerationSecretAvailable(legacyStatus.available);
      })
      .catch(() => {
        if (isActive) setGenerationSecretAvailable(false);
      });

    return () => {
      isActive = false;
    };
  }, [activeGenerationProfile, desktopRuntime, generationSupportsOpenAICompatible, selectedProviderId]);

  useEffect(() => {
    setPromptPolishDraft(appSettings.promptPolish);
  }, [appSettings.promptPolish]);

  useEffect(() => {
    setImageReverseDraft(appSettings.imagePromptReverse);
  }, [appSettings.imagePromptReverse]);

  useEffect(() => {
    if (page === 'providers') return;
    const template = getDefaultProviderServiceTemplateForProvider(selectedProviderId);
    if (!template || template.id === selectedServiceTemplate.id) return;
    setSelectedPlatformType(template.platformType);
    setSelectedServiceTemplateId(template.id);
  }, [page, selectedProviderId, selectedServiceTemplate.id]);

  useEffect(() => {
    if (page === 'library') setIsLibraryPageMounted(true);
  }, [page]);

  useEffect(() => {
    if (page === 'inspiration') setIsInspirationPageMounted(true);
  }, [page]);

  useEffect(() => {
    setSecretDraft('');
    setSecretMessage('');
    setConfigMessage('');
    setConfigActionState('idle');
    setProviderDiagnostics([]);
    if (!isSelectedServiceConfigurable) {
      setIsCreatingProviderProfile(false);
      setSelectedProfileId(null);
      setProviderConfig(defaultOpenAICompatibleConfig);
      setSecretAvailable(false);
      return;
    }
    if (isCreatingProviderProfile) {
      const draftConfig = createEmptyProviderDraftConfig(selectedProvider, selectedServiceTemplate, t);
      setSelectedProfileId(null);
      setProviderConfig(draftConfig);
      setSecretAvailable(false);
      if (supportsOpenAICompatible) setSelectedModel(draftConfig.modelId);
      return;
    }

    const nextProfile =
      selectedProviderProfiles.find((profile) => profile.id === selectedProfileId) ??
      selectedProviderProfiles.find((profile) => profile.enabled) ??
      selectedProviderProfiles[0] ??
      null;
    const config = nextProfile
      ? profileToProviderConfig(nextProfile)
      : createEmptyProviderDraftConfig(selectedProvider, selectedServiceTemplate, t);
    setSelectedProfileId(nextProfile?.id ?? null);
    setProviderConfig(config);
    if (supportsOpenAICompatible) setSelectedModel(config.modelId);

    if (!desktopRuntime) {
      setSecretAvailable(false);
      return;
    }

    const secretId = nextProfile ? providerProfileSecretId(nextProfile.id) : selectedProvider.id;
    void getProviderSecretStatus(secretId)
      .then(async (status) => {
        if (status.available || !nextProfile) {
          setSecretAvailable(status.available);
          return;
        }
        const legacyStatus = await getProviderSecretStatus(selectedProvider.id);
        setSecretAvailable(legacyStatus.available);
      })
      .catch(() => setSecretAvailable(false));
  }, [
    desktopRuntime,
    selectedProvider.id,
    selectedProvider.name,
    selectedServiceTemplate,
    selectedProfileId,
    selectedProviderProfiles,
    isCreatingProviderProfile,
    isSelectedServiceConfigurable,
    setSelectedModel,
    supportsOpenAICompatible
  ]);

  function selectProvider(providerId: string) {
    setIsCreatingProviderProfile(false);
    setSelectedProfileId(null);
    setSelectedProvider(providerId);
    const template = getDefaultProviderServiceTemplateForProvider(providerId);
    if (template) {
      setSelectedPlatformType(template.platformType);
      setSelectedServiceTemplateId(template.id);
    }
  }

  function selectGenerationProfile(profileId: string) {
    const profile = providerProfiles.find((item) => item.id === profileId);
    if (!profile) return;
    const enabledProfiles = setProviderProfileEnabled(providerProfiles, profileId, true);
    const nextProfiles = [
      ...enabledProfiles.filter((item) => item.id === profileId),
      ...enabledProfiles.filter((item) => item.id !== profileId)
    ];
    saveProviderProfiles(nextProfiles);
    setProviderProfiles(nextProfiles);
    setIsCreatingProviderProfile(false);
    setSelectedProfileId(profile.id);
    setProviderConfig(profileToProviderConfig(profile));
    setSelectedProvider(profile.providerId);
    setSelectedModel(profile.modelId);
    const template = getDefaultProviderServiceTemplateForProvider(profile.providerId);
    if (template) {
      setSelectedPlatformType(template.platformType);
      setSelectedServiceTemplateId(template.id);
    }
    setConfigMessage(t('provider.message.generationProfileSelected', { name: profile.displayName }));
  }

  function changeGenerationModel(modelId: string) {
    if (generationSupportsOpenAICompatible && activeGenerationProfile) {
      const now = new Date().toISOString();
      const nextProfiles = providerProfiles.map((profile) =>
        profile.id === activeGenerationProfile.id
          ? {
              ...profile,
              modelId,
              modelOptions: Array.from(new Set([...profile.modelOptions, modelId].filter(Boolean))),
              updatedAt: now
            }
          : profile
      );
      setProviderProfiles(nextProfiles);
      saveProviderProfiles(nextProfiles);
      if (selectedProfileId === activeGenerationProfile.id) {
        setProviderConfig((current) => ({
          ...current,
          modelId,
          modelOptions: Array.from(new Set([...current.modelOptions, modelId].filter(Boolean)))
        }));
      }
      setSelectedModel(modelId);
      return;
    }
    if (generationSupportsOpenAICompatible) {
      handleConfigChange('modelId', modelId);
      return;
    }
    setSelectedModel(modelId);
  }

  function selectPlatformType(platformType: ProviderPlatformType) {
    const firstTemplate = getProviderServiceTemplatesForPlatform(platformType)[0] ?? providerServiceTemplates[0];
    setSelectedPlatformType(platformType);
    selectServiceTemplate(firstTemplate.id);
  }

  function selectServiceTemplate(templateId: string) {
    const template = getProviderServiceTemplate(templateId) ?? providerServiceTemplates[0];
    setSelectedServiceTemplateId(template.id);
    setSelectedPlatformType(template.platformType);
    setIsCreatingProviderProfile(false);
    setSelectedProfileId(null);
    setSecretDraft('');
    setSecretMessage('');
    setConfigMessage('');
    setConfigActionState('idle');
    setProviderDiagnostics([]);
    setLocalComfyUIDiagnostic({ status: 'idle', result: null, error: '' });
    setLocalSdWebUIDiagnostic({ status: 'idle', result: null, error: '' });
    if (template.providerId) {
      setSelectedProvider(template.providerId);
    }
  }

  function updateLocalComfyUIBaseUrl(baseUrl: string) {
    const nextConfig = { baseUrl };
    setLocalComfyUIConfig(nextConfig);
    saveLocalComfyUIConfig(nextConfig);
    localComfyUIDiagnosticRequestRef.current += 1;
    setLocalComfyUIDiagnostic((current) => ({ ...current, status: 'idle', error: '' }));
  }

  async function runLocalComfyUIDiagnostics(options?: { silent?: boolean }) {
    const silent = Boolean(options?.silent);
    if (!desktopRuntime) {
      setLocalComfyUIDiagnostic({
        status: 'failed',
        result: null,
        error: t('provider.local.message.comfyDesktopRequired')
      });
      return;
    }
    const requestId = localComfyUIDiagnosticRequestRef.current + 1;
    localComfyUIDiagnosticRequestRef.current = requestId;
    if (!silent) {
      setLocalComfyUIDiagnostic((current) => ({ ...current, status: 'checking', error: '' }));
    }
    try {
      const result = await Promise.race([
        diagnoseComfyUIConnection({
          baseUrl: localComfyUIConfig.baseUrl,
          timeoutMs: 4000
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => {
            reject(new Error(t('provider.local.message.comfyTimeout')));
          }, LOCAL_COMFYUI_DIAGNOSTIC_TIMEOUT_MS);
        })
      ]);
      if (requestId !== localComfyUIDiagnosticRequestRef.current) return;
      setLocalComfyUIDiagnostic({
        status: result.online ? 'online' : 'offline',
        result,
        error: ''
      });
      if (!silent) setConfigMessage(result.message);
    } catch (error) {
      if (requestId !== localComfyUIDiagnosticRequestRef.current) return;
      const message = error instanceof Error ? error.message : String(error);
      setLocalComfyUIDiagnostic({
        status: 'failed',
        result: null,
        error: message
      });
      if (!silent) setConfigMessage(message);
    }
  }


  function updateLocalSdWebUIBaseUrl(baseUrl: string) {
    const nextConfig = { baseUrl };
    setLocalSdWebUIConfig(nextConfig);
    saveLocalSdWebUIConfig(nextConfig);
    localSdWebUIDiagnosticRequestRef.current += 1;
    setLocalSdWebUIDiagnostic((current) => ({ ...current, status: 'idle', error: '' }));
  }

  async function runLocalSdWebUIDiagnostics(options?: { silent?: boolean }) {
    const silent = Boolean(options?.silent);
    if (!desktopRuntime) {
      setLocalSdWebUIDiagnostic({
        status: 'failed',
        result: null,
        error: t('provider.local.message.sdDesktopRequired')
      });
      return;
    }
    const requestId = localSdWebUIDiagnosticRequestRef.current + 1;
    localSdWebUIDiagnosticRequestRef.current = requestId;
    setLocalSdWebUIDiagnostic((current) => ({ ...current, status: 'checking', error: '' }));
    if (!silent) setConfigMessage(t('provider.local.message.sdTesting'));
    try {
      const result = await Promise.race([
        diagnoseSdWebUIConnection({
          baseUrl: localSdWebUIConfig.baseUrl,
          timeoutMs: LOCAL_SD_WEBUI_DIAGNOSTIC_TIMEOUT_MS
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => {
            reject(new Error(t('provider.local.message.sdTimeout')));
          }, LOCAL_SD_WEBUI_DIAGNOSTIC_TIMEOUT_MS);
        })
      ]);
      if (requestId !== localSdWebUIDiagnosticRequestRef.current) return;
      setLocalSdWebUIDiagnostic({
        status: result.online ? 'online' : 'offline',
        result,
        error: ''
      });
      if (!silent) setConfigMessage(result.message);
    } catch (error) {
      if (requestId !== localSdWebUIDiagnosticRequestRef.current) return;
      const message = error instanceof Error ? error.message : String(error);
      setLocalSdWebUIDiagnostic({
        status: 'failed',
        result: null,
        error: message
      });
      if (!silent) setConfigMessage(message);
    }
  }

  async function importLocalComfyUIWorkflow(file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) {
      const message = t('provider.local.message.comfySelectJson');
      setLocalComfyUIWorkflowError(message);
      setConfigMessage(message);
      return;
    }
    try {
      const text = await readTextFile(file);
      const summary = parseComfyUIWorkflow(file.name, text);
      const rawWorkflow = JSON.parse(text) as unknown;
      const preset = createLocalWorkflowPreset(summary, undefined, summary.format === 'api' ? rawWorkflow : undefined);
      const nextStore: LocalComfyUIWorkflowStore = {
        activeId: preset.id,
        presets: [...localComfyUIWorkflowStore.presets.filter((item) => item.name !== preset.name), preset]
      };
      setLocalComfyUIWorkflowStore(nextStore);
      saveLocalComfyUIWorkflowStore(nextStore);
      setLocalComfyUIWorkflowError('');
      setConfigMessage(summary.format === 'api'
        ? t('provider.local.message.comfyImportApi', { count: summary.nodeCount })
        : t('provider.local.message.comfyImportWorkflow', { count: summary.nodeCount }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLocalComfyUIWorkflowError(t('provider.local.message.comfyParseFailed', { message }));
      setConfigMessage(t('provider.local.message.comfyParseFailed', { message }));
    }
  }

  function clearLocalComfyUIWorkflow() {
    const nextStore: LocalComfyUIWorkflowStore = { activeId: null, presets: [] };
    setLocalComfyUIWorkflowStore(nextStore);
    setLocalComfyUIWorkflowError('');
    saveLocalComfyUIWorkflowStore(nextStore);
    setConfigMessage(t('provider.local.message.comfyCleared'));
  }

  useEffect(() => {
    if (!desktopRuntime || page !== 'providers' || selectedServiceTemplate.id !== 'local-comfyui') return;

    const runSilentCheck = () => {
      if (localComfyUIAutoCheckRunningRef.current) return;
      localComfyUIAutoCheckRunningRef.current = true;
      void runLocalComfyUIDiagnostics({ silent: true })
        .finally(() => {
          localComfyUIAutoCheckRunningRef.current = false;
        });
    };

    runSilentCheck();
    const timer = window.setInterval(runSilentCheck, 10_000);
    return () => window.clearInterval(timer);
  }, [desktopRuntime, page, selectedServiceTemplate.id, localComfyUIConfig.baseUrl]);


  useEffect(() => {
    if (!desktopRuntime || page !== 'providers' || selectedServiceTemplate.id !== 'local-sd-webui') return;

    const runSilentCheck = () => {
      if (localSdWebUIAutoCheckRunningRef.current) return;
      localSdWebUIAutoCheckRunningRef.current = true;
      void runLocalSdWebUIDiagnostics({ silent: true })
        .finally(() => {
          localSdWebUIAutoCheckRunningRef.current = false;
        });
    };

    runSilentCheck();
    const timer = window.setInterval(runSilentCheck, 10_000);
    return () => window.clearInterval(timer);
  }, [desktopRuntime, page, selectedServiceTemplate.id, localSdWebUIConfig.baseUrl]);

  async function runCreativeDeskGenerate(options?: Parameters<typeof generate>[0]) {
    if (selectedProviderId === 'sd-webui-local') {
      useStudioStore.setState({ isGenerating: true });
      try {
        if (!desktopRuntime) {
          throw new Error(t('provider.local.message.sdGenerateDesktopRequired'));
        }
        if ((options?.mode ?? 'text-to-image') === 'image-to-image') {
          throw new Error(t('provider.local.message.sdTxt2imgOnly'));
        }
        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt) {
          throw new Error(t('provider.local.message.sdPromptRequired'));
        }
        const sdWebUIOptions = options?.metadata?.sdWebUI;
        const sdWebUIParameters = sdWebUIOptions && typeof sdWebUIOptions === 'object' && !Array.isArray(sdWebUIOptions)
          ? sdWebUIOptions as { samplerName?: unknown; steps?: unknown; cfgScale?: unknown }
          : {};
        const result = await generateSdWebUIImage({
          baseUrl: localSdWebUIConfig.baseUrl,
          prompt: trimmedPrompt,
          negativePrompt: options?.negativePrompt,
          size,
          seed: options?.seed,
          count,
          outputFormat: options?.outputFormat,
          outputCompression: options?.outputCompression,
          timeoutMs: 240_000,
          samplerName: typeof sdWebUIParameters.samplerName === 'string' ? sdWebUIParameters.samplerName : undefined,
          steps: typeof sdWebUIParameters.steps === 'number' ? sdWebUIParameters.steps : undefined,
          cfgScale: typeof sdWebUIParameters.cfgScale === 'number' ? sdWebUIParameters.cfgScale : undefined
        });
        const recordsToSave = splitImageResultIntoSingleImageRecords({
          ...result,
          generationMode: 'text-to-image',
          referenceImages: []
        });
        const savedRecords: GenerationRecord[] = [];
        for (const record of recordsToSave) {
          savedRecords.push(await saveGenerationRecord(record, 'Stable Diffusion WebUI / Forge'));
        }
        for (const saved of [...savedRecords].reverse()) {
          addResult(saved);
        }
        const firstSaved = savedRecords[0];
        if (firstSaved?.status === 'succeeded' && firstSaved.imageUrls[0]) {
          setGeneratePreviewUrl(firstSaved.imageUrls[0]);
          setConfigMessage(savedRecords.length > 1 ? t('provider.local.message.sdSuccessMany', { count: savedRecords.length }) : t('provider.local.message.sdSuccessOne'));
        } else {
          setConfigMessage(t('provider.local.message.sdFailedSaved', { message: firstSaved?.error ?? t('provider.local.message.sdNoImage') }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failed: GenerationRecord = {
          id: `sd-webui-error-${Date.now()}`,
          providerId: 'sd-webui-local',
          providerName: 'Stable Diffusion WebUI / Forge',
          modelId: 'sd-webui-txt2img',
          status: 'failed',
          prompt,
          imageUrls: [],
          localImagePaths: [],
          costHint: t('provider.local.message.sdCostHint'),
          error: message,
          raw: {
            visionhub_sd_webui_error: 'frontend_preflight_failed',
            baseUrl: localSdWebUIConfig.baseUrl
          },
          createdAt: new Date().toISOString(),
          generationMode: options?.mode ?? 'text-to-image',
          referenceImages: []
        };
        const saved = await saveGenerationRecord(failed, failed.providerName);
        addResult(saved);
        setConfigMessage(t('provider.local.message.sdFailedSaved', { message }));
      } finally {
        useStudioStore.setState({ isGenerating: false });
      }
      return;
    }

    if (selectedProviderId !== 'comfyui-local') {
      const previousFirstResultId = useStudioStore.getState().results[0]?.id;
      await generate(options);
      const latestResult = useStudioStore.getState().results[0];
      if (latestResult && latestResult.id !== previousFirstResultId && latestResult.status === 'failed') {
        setConfigMessage(mapProviderErrorMessage(latestResult.error ?? t('provider.error.noImageReturned'), t));
      }
      return;
    }

    useStudioStore.setState({ isGenerating: true });
    const activeWorkflowPreset =
      localComfyUIWorkflowStore.presets.find((item) => item.id === localComfyUIWorkflowStore.activeId) ??
      localComfyUIWorkflowStore.presets[0] ??
      null;
    const generationMode = options?.mode ?? 'text-to-image';
    const references = options?.references ?? [];
    try {
      if (!desktopRuntime) {
        throw new Error(t('generate.error.comfy.desktopRequired'));
      }
      if (generationMode === 'image-to-image' && references.length === 0) {
        throw new Error(t('generate.error.comfy.referenceRequired'));
      }
      if (!activeWorkflowPreset) {
        throw new Error(t('generate.error.comfy.workflowSummary'));
      }
      if (activeWorkflowPreset.summary.format !== 'api' || !activeWorkflowPreset.rawWorkflow) {
        throw new Error(t('generate.error.comfy.workflowInvalid'));
      }
      const result = await generateComfyUIImage({
        baseUrl: localComfyUIConfig.baseUrl,
        workflow: activeWorkflowPreset.rawWorkflow,
        workflowName: activeWorkflowPreset.name,
        prompt,
        negativePrompt: options?.negativePrompt,
        size,
        seed: options?.seed,
        count,
        outputFormat: options?.outputFormat,
        outputCompression: options?.outputCompression,
        timeoutMs: 180_000,
        generationMode,
        references
      });
      const recordsToSave = splitImageResultIntoSingleImageRecords({
        ...result,
        generationMode,
        referenceImages: references
      });
      const savedRecords: GenerationRecord[] = [];
      for (const record of recordsToSave) {
        savedRecords.push(await saveGenerationRecord(record, t('provider.local.comfy.providerName')));
      }
      for (const saved of [...savedRecords].reverse()) {
        addResult(saved);
      }
      const firstSaved = savedRecords[0];
      if (firstSaved?.status === 'succeeded' && firstSaved.imageUrls[0]) {
        setGeneratePreviewUrl(firstSaved.imageUrls[0]);
        setConfigMessage(savedRecords.length > 1 ? t('provider.local.message.comfySuccessMany', { count: savedRecords.length }) : t('provider.local.message.comfySuccessOne'));
      } else {
        setConfigMessage(t('provider.local.message.comfyFailedSaved', { message: firstSaved?.error ?? t('provider.local.message.comfyNoImage') }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed: GenerationRecord = {
        id: `comfyui-error-${Date.now()}`,
        providerId: 'comfyui-local',
        providerName: t('provider.local.comfy.providerName'),
        modelId: activeWorkflowPreset?.name ?? 'ComfyUI Workflow',
        status: 'failed',
        prompt,
        imageUrls: [],
        localImagePaths: [],
        costHint: t('provider.local.message.comfyCostHint'),
        error: message,
        raw: {
          visionhub_comfyui_error: 'frontend_preflight_failed',
          workflow: activeWorkflowPreset?.summary.fileName ?? null,
          referenceCount: references.length
        },
        createdAt: new Date().toISOString(),
        generationMode,
        referenceImages: references
      };
      const saved = await saveGenerationRecord(failed, failed.providerName);
      addResult(saved);
      setConfigMessage(t('provider.local.message.comfyFailedSaved', { message }));
    } finally {
      useStudioStore.setState({ isGenerating: false });
    }
  }

  const navigateTo = useCallback((nextPage: Page) => {
    setGeneratePreviewUrl(null);
    setLibraryPreview(null);
    setInspirationPreview(null);
    setPage(nextPage);
  }, []);

  function refreshBatchQueueStore() {
    const store = loadBatchQueueStore();
    setBatchQueueStore(store);
    if (activeBatchQueueId && !store.queues.some((queue) => queue.id === activeBatchQueueId)) {
      selectActiveBatchQueue(store.queues[0]?.id ?? '');
    }
    setConfigMessage(t('batch.message.refreshed'));
  }

  function selectActiveBatchQueue(queueId: string) {
    setActiveBatchQueueId(queueId);
    writeStorageValue(ACTIVE_BATCH_QUEUE_STORAGE_KEY, queueId);
  }

  function resolveActiveBatchQueue(store = batchQueueStore) {
    return (activeBatchQueueId ? store.queues.find((queue) => queue.id === activeBatchQueueId) : null)
      ?? store.queues[0]
      ?? null;
  }

  function resolveTargetBatchQueue(store = batchQueueStore) {
    const existingQueue = resolveActiveBatchQueue(store);
    if (existingQueue) return { queue: existingQueue, exists: true };
    return {
      queue: createBatchQueue({
        name: t('batch.queue.defaultName'),
        description: t('batch.queue.defaultDescription'),
        status: 'ready'
      }),
      exists: false
    };
  }

  function requestCreateBatchQueue() {
    setBatchQueueNameDialog({
      mode: 'create',
      defaultName: t('batch.queue.newDefaultName')
    });
  }

  function submitBatchQueueName(dialog: BatchQueueNameDialogState, inputName: string) {
    const nextName = inputName.trim();
    if (!nextName) return;
    const store = loadBatchQueueStore();
    if (dialog.mode === 'rename') {
      if (!dialog.targetId) return;
      const queue = store.queues.find((item) => item.id === dialog.targetId);
      if (!queue) {
        setBatchQueueStore(store);
        setBatchQueueNameDialog(null);
        setConfigMessage(t('batch.message.queueNotFound'));
        return;
      }
      if (nextName === queue.name) {
        setBatchQueueNameDialog(null);
        setConfigMessage(t('batch.message.queueNameUnchanged'));
        return;
      }
      const nextStore = upsertBatchQueue({ ...queue, name: nextName }, store);
      setBatchQueueStore(nextStore);
      selectActiveBatchQueue(queue.id);
      setBatchQueueNameDialog(null);
      setConfigMessage(t('batch.message.queueRenamed', { name: nextName }));
      return;
    }

    const queue = createBatchQueue({
      name: nextName,
      description: t('batch.queue.customDescription'),
      status: 'ready'
    });
    const nextStore = upsertBatchQueue(queue, store);
    setBatchQueueStore(nextStore);
    selectActiveBatchQueue(queue.id);
    setBatchQueueNameDialog(null);
    setConfigMessage(t('batch.message.queueCreated', { name: queue.name }));
  }

  function requestRenameBatchQueue(queueId: string) {
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    if (!queue) {
      setBatchQueueStore(store);
      setConfigMessage(t('batch.message.queueNotFound'));
      return;
    }
    const summary = summarizeBatchQueue(queue);
    if (runningBatchQueueId === queue.id || summary.running > 0) {
      setConfigMessage(t('batch.message.queueRenameRunning'));
      return;
    }
    setBatchQueueNameDialog({
      mode: 'rename',
      targetId: queue.id,
      defaultName: queue.name
    });
  }

  function requestDeleteBatchQueue(queueId: string) {
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    if (!queue) {
      setBatchQueueStore(store);
      setConfigMessage(t('batch.message.queueNotFound'));
      return;
    }
    if (store.queues.length <= 1) {
      setConfigMessage(t('batch.message.queueKeepOne'));
      return;
    }
    const summary = summarizeBatchQueue(queue);
    if (runningBatchQueueId === queue.id || summary.running > 0) {
      setConfigMessage(t('batch.message.queueDeleteRunning'));
      return;
    }
    requestConfirm({
      title: t('batch.confirm.deleteQueueTitle'),
      message: [
        t('batch.confirm.deleteQueueIntro', { name: queue.name }),
        t('batch.confirm.deleteQueueSummary', { total: summary.total, pending: summary.pending, succeeded: summary.succeeded, failed: summary.failed, cancelled: summary.cancelled }),
        t('batch.confirm.deleteQueueGroups', { groups: queue.compareGroups?.length ?? 0 }),
        t('batch.confirm.deleteQueueSafe')
      ].join('\n'),
      confirmLabel: t('batch.confirm.deleteQueue'),
      cancelLabel: t('batch.confirm.cancel'),
      tone: 'danger',
      onConfirm: () => {
        const latestStore = loadBatchQueueStore();
        const nextQueues = latestStore.queues.filter((item) => item.id !== queue.id);
        const nextStore = {
          ...latestStore,
          queues: nextQueues,
          updatedAt: new Date().toISOString()
        };
        saveBatchQueueStore(nextStore);
        setBatchQueueStore(nextStore);
        const nextActiveId = nextQueues[0]?.id ?? '';
        selectActiveBatchQueue(nextActiveId);
        setConfigMessage(t('batch.message.queueDeleted', { name: queue.name }));
      }
    });
  }

  function createTasksFromBatchQueueTemplate(template: BatchQueueTemplate, queueId: string) {
    const appliedAt = new Date().toISOString();
    const compareGroupDrafts = new Map<string, ReturnType<typeof createBatchQueueCompareGroup>>();
    for (const group of template.compareGroups) {
      compareGroupDrafts.set(group.id, createBatchQueueCompareGroup({
        queueId,
        prompt: group.prompt,
        profileIds: group.profileIds
      }));
    }

    const tasks = template.taskTemplates.map((taskTemplate) => {
      const compareGroup = taskTemplate.compareGroupId ? compareGroupDrafts.get(taskTemplate.compareGroupId) : undefined;
      const snapshot = createQueuedGenerationSnapshot({
        ...taskTemplate.snapshot,
        references: taskTemplate.snapshot.references ?? [],
        metadata: {
          ...(taskTemplate.snapshot.metadata ?? {}),
          visionhub_queue_template: {
            templateId: template.id,
            templateName: template.name,
            appliedAt
          }
        },
        source: taskTemplate.snapshot.source,
        preserveEmbeddedReferenceImages: true
      });
      return createBatchQueueTask({
        queueId,
        snapshot,
        kind: taskTemplate.kind,
        compareGroupId: compareGroup?.id,
        title: taskTemplate.title,
        status: 'pending'
      });
    });

    const compareGroups = template.compareGroups
      .map((group) => {
        const compareGroup = compareGroupDrafts.get(group.id);
        if (!compareGroup) return null;
        return {
          ...compareGroup,
          taskIds: group.taskIndexes
            .map((index) => tasks[index]?.id)
            .filter((taskId): taskId is string => Boolean(taskId)),
          updatedAt: appliedAt
        };
      })
      .filter((group): group is ReturnType<typeof createBatchQueueCompareGroup> => Boolean(group?.taskIds.length));

    return { tasks, compareGroups };
  }

  function requestSaveActiveBatchQueueTemplate(queueId: string) {
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    if (!queue) {
      setBatchQueueStore(store);
      setConfigMessage(t('batch.message.queueNotFound'));
      return;
    }
    const summary = summarizeBatchQueue(queue);
    if (runningBatchQueueId === queue.id || summary.running > 0) {
      setConfigMessage(t('batch.message.templateSaveRunning'));
      return;
    }
    if (summary.total === 0) {
      setConfigMessage(t('batch.message.templateEmptyQueue'));
      return;
    }
    const template = createBatchQueueTemplateFromQueue(queue, undefined, t);
    const nextTemplates = [
      template,
      ...batchQueueTemplates.filter((item) => item.id !== template.id)
    ].slice(0, MAX_BATCH_QUEUE_TEMPLATES);
    saveBatchQueueTemplates(nextTemplates);
    setBatchQueueTemplates(nextTemplates);
    setConfigMessage(t('batch.message.templateSaved', { name: template.name, count: template.taskTemplates.length }));
  }

  function requestApplyBatchQueueTemplate(templateId: string) {
    const template = batchQueueTemplates.find((item) => item.id === templateId);
    if (!template) {
      setConfigMessage(t('batch.message.templateNotFound'));
      return;
    }
    const { queue, exists } = resolveTargetBatchQueue(loadBatchQueueStore());
    const { tasks, compareGroups } = createTasksFromBatchQueueTemplate(template, queue.id);
    if (!tasks.length) {
      setConfigMessage(t('batch.message.templateNoAppend'));
      return;
    }
    const nextStore = exists
      ? appendBatchQueueTasksAndCompareGroups(queue.id, tasks, compareGroups, loadBatchQueueStore())
      : upsertBatchQueue({ ...queue, tasks, compareGroups, status: 'ready' }, loadBatchQueueStore());
    const now = new Date().toISOString();
    const nextTemplates = [
      { ...template, usedCount: (template.usedCount ?? 0) + 1, lastUsedAt: now, updatedAt: now },
      ...batchQueueTemplates.filter((item) => item.id !== template.id)
    ].slice(0, MAX_BATCH_QUEUE_TEMPLATES);
    saveBatchQueueTemplates(nextTemplates);
    setBatchQueueTemplates(nextTemplates);
    setBatchQueueStore(nextStore);
    selectActiveBatchQueue(queue.id);
    setConfigMessage(t('batch.message.templateApplied', { name: template.name, count: tasks.length }));
    navigateTo('batch');
  }

  function requestDeleteBatchQueueTemplate(templateId: string) {
    const template = batchQueueTemplates.find((item) => item.id === templateId);
    if (!template) {
      setConfigMessage(t('batch.message.templateNotFound'));
      return;
    }
    requestConfirm({
      title: t('batch.confirm.deleteTemplateTitle'),
      message: [
        t('batch.confirm.deleteTemplateIntro', { name: template.name }),
        t('batch.confirm.deleteTemplateSafe')
      ].join('\n'),
      confirmLabel: t('batch.confirm.deleteTemplate'),
      cancelLabel: t('batch.confirm.keepTemplate'),
      tone: 'danger',
      onConfirm: () => {
        const nextTemplates = batchQueueTemplates.filter((item) => item.id !== template.id);
        saveBatchQueueTemplates(nextTemplates);
        setBatchQueueTemplates(nextTemplates);
        setConfigMessage(t('batch.message.templateDeleted', { name: template.name }));
      }
    });
  }

  function handleAddCurrentGenerationToBatchQueue(options: GenerateSubmissionOptions = {}) {
    const trimmedPrompt = prompt.trim();
    const generationMode = options.mode ?? 'text-to-image';
    const references = options.references ?? [];
    if (!trimmedPrompt) {
      setConfigMessage(t('batch.message.addPromptRequired'));
      return;
    }
    if (generationMode === 'image-to-image' && references.length === 0) {
      setConfigMessage(t('batch.message.addReferenceRequired'));
      return;
    }

    const providerModelId = generationSupportsOpenAICompatible
      ? activeGenerationConfig.modelId.trim()
      : selectedModelId.trim();
    if (!providerModelId) {
      setConfigMessage(t('batch.message.modelMissing'));
      return;
    }

    let extraHeaders: Record<string, string> | undefined;
    if (generationSupportsOpenAICompatible) {
      try {
        extraHeaders = parseExtraHeaders(activeGenerationConfig.extraHeadersJson);
      } catch (error) {
        setConfigMessage(t('batch.message.extraHeadersQueueParseFailed', { message: error instanceof Error ? error.message : String(error) }));
        return;
      }
    }

    const { queue, exists: existingQueue } = resolveTargetBatchQueue(batchQueueStore);
    const requestedCount = Math.max(1, Math.min(4, Math.round(count)));
    const snapshot = createQueuedGenerationSnapshot({
      providerId: selectedProviderId,
      providerName: generationSelectedProvider.name,
      profileId: activeGenerationProfile?.id,
      profileName: activeGenerationProfile?.displayName,
      modelId: providerModelId,
      prompt: trimmedPrompt,
      negativePrompt: options.negativePrompt,
      size,
      quality,
      outputFormat: options.outputFormat ?? appSettings.generationDefaults.outputFormat,
      outputCompression: options.outputCompression,
      count: requestedCount,
      generationMode,
      references,
      seed: options.seed,
      baseUrl: generationSupportsOpenAICompatible ? activeGenerationConfig.baseUrl : undefined,
      protocol: generationSupportsOpenAICompatible ? activeGenerationConfig.protocol : undefined,
      imageToImageAdapter: generationSupportsOpenAICompatible ? activeGenerationConfig.imageToImageAdapter : undefined,
      endpointPath: generationSupportsOpenAICompatible ? activeGenerationConfig.endpointPath : undefined,
      extraHeaders,
      secretId: activeGenerationProfile ? providerProfileSecretId(activeGenerationProfile.id) : undefined,
      metadata: {
        ...(options.metadata ?? {}),
        visionhub_batch_queue: {
          origin: 'generate-page',
          addedAt: new Date().toISOString(),
          realExecutionRequiresConfirmation: true
        }
      },
      source: 'generate-page'
    });
    const task = createBatchQueueTask({
      queueId: queue.id,
      snapshot,
      title: generationMode === 'image-to-image'
        ? t('batch.message.titleImageToImage', { model: providerModelId })
        : t('batch.message.titleTextToImage', { model: providerModelId })
    });
    const nextStore = existingQueue
      ? appendBatchQueueTasks(queue.id, [task], batchQueueStore)
      : upsertBatchQueue({ ...queue, tasks: [task], status: 'ready' }, batchQueueStore);
    setBatchQueueStore(nextStore);
    selectActiveBatchQueue(queue.id);
    const omittedReferenceCount = snapshot.referencePolicy?.omittedReferenceIds.length ?? 0;
    setConfigMessage([
      t('batch.message.addedCurrent', { queue: queue.name, provider: generationSelectedProvider.name, model: providerModelId, count: requestedCount }),
      omittedReferenceCount > 0 ? t('batch.message.omittedReferences', { count: omittedReferenceCount }) : ''
    ].filter(Boolean).join(' '));
    navigateTo('batch');
  }

  function handleAddBatchVariantsToBatchQueue(prompts: string[], sizes: string[], options: GenerateSubmissionOptions = {}) {
    const normalizedPrompts = Array.from(new Set(prompts.map((item) => item.trim()).filter(Boolean))).slice(0, 20);
    const normalizedSizes = Array.from(new Set(sizes.map((item) => item.trim()).filter(Boolean))).slice(0, 8);
    const generationMode = options.mode ?? 'text-to-image';
    const references = options.references ?? [];
    if (normalizedPrompts.length === 0) {
      setConfigMessage(t('batch.message.variantPromptRequired'));
      return;
    }
    if (normalizedSizes.length === 0) {
      setConfigMessage(t('batch.message.variantSizeRequired'));
      return;
    }
    if (generationMode === 'image-to-image' && references.length === 0) {
      setConfigMessage(t('batch.message.variantReferenceRequired'));
      return;
    }

    const providerModelId = generationSupportsOpenAICompatible
      ? activeGenerationConfig.modelId.trim()
      : selectedModelId.trim();
    if (!providerModelId) {
      setConfigMessage(t('batch.message.modelMissing'));
      return;
    }

    const estimatedTasks = normalizedPrompts.length * normalizedSizes.length;
    if (estimatedTasks > 40) {
      setConfigMessage(t('batch.message.variantTooManyTasks', { count: estimatedTasks }));
      return;
    }

    let extraHeaders: Record<string, string> | undefined;
    if (generationSupportsOpenAICompatible) {
      try {
        extraHeaders = parseExtraHeaders(activeGenerationConfig.extraHeadersJson);
      } catch (error) {
        setConfigMessage(t('batch.message.extraHeadersVariantParseFailed', { message: error instanceof Error ? error.message : String(error) }));
        return;
      }
    }

    const { queue, exists: existingQueue } = resolveTargetBatchQueue(batchQueueStore);
    const requestedCount = Math.max(1, Math.min(4, Math.round(count)));
    const addedAt = new Date().toISOString();
    const tasks: BatchGenerationQueue['tasks'] = [];

    for (const variantPrompt of normalizedPrompts) {
      for (const variantSize of normalizedSizes) {
        const snapshot = createQueuedGenerationSnapshot({
          providerId: selectedProviderId,
          providerName: generationSelectedProvider.name,
          profileId: activeGenerationProfile?.id,
          profileName: activeGenerationProfile?.displayName,
          modelId: providerModelId,
          prompt: variantPrompt,
          negativePrompt: options.negativePrompt,
          size: variantSize,
          quality,
          outputFormat: options.outputFormat ?? appSettings.generationDefaults.outputFormat,
          outputCompression: options.outputCompression,
          count: requestedCount,
          generationMode,
          references,
          seed: options.seed,
          baseUrl: generationSupportsOpenAICompatible ? activeGenerationConfig.baseUrl : undefined,
          protocol: generationSupportsOpenAICompatible ? activeGenerationConfig.protocol : undefined,
          imageToImageAdapter: generationSupportsOpenAICompatible ? activeGenerationConfig.imageToImageAdapter : undefined,
          endpointPath: generationSupportsOpenAICompatible ? activeGenerationConfig.endpointPath : undefined,
          extraHeaders,
          secretId: activeGenerationProfile ? providerProfileSecretId(activeGenerationProfile.id) : undefined,
          metadata: {
            ...(options.metadata ?? {}),
            visionhub_batch_variants: {
              origin: 'generate-page',
              addedAt,
              promptCount: normalizedPrompts.length,
              sizeCount: normalizedSizes.length,
              variantSize,
              realExecutionRequiresConfirmation: true
            }
          },
          source: 'batch-variants'
        });
        tasks.push(createBatchQueueTask({
          queueId: queue.id,
          snapshot,
          kind: 'prompt-size-sweep',
          title: t('batch.message.variantTitle', { size: variantSize, model: providerModelId })
        }));
      }
    }

    const nextStore = existingQueue
      ? appendBatchQueueTasks(queue.id, tasks, batchQueueStore)
      : upsertBatchQueue({ ...queue, tasks, status: 'ready' }, batchQueueStore);
    setBatchQueueStore(nextStore);
    selectActiveBatchQueue(queue.id);
    const omittedReferenceCount = tasks.reduce(
      (sum, task) => sum + (task.snapshot.referencePolicy?.omittedReferenceIds.length ?? 0),
      0
    );
    setConfigMessage([
      t('batch.message.variantAdded', { queue: queue.name, prompts: normalizedPrompts.length, sizes: normalizedSizes.length, tasks: tasks.length, count: requestedCount }),
      omittedReferenceCount > 0 ? t('batch.message.variantOmittedReferences', { count: omittedReferenceCount }) : ''
    ].filter(Boolean).join(' '));
    navigateTo('batch');
  }

  function handleAddCompareGroupToBatchQueue(profileIds: string[], options: GenerateSubmissionOptions = {}) {
    const trimmedPrompt = prompt.trim();
    const generationMode = options.mode ?? 'text-to-image';
    const references = options.references ?? [];
    if (!trimmedPrompt) {
      setConfigMessage(t('batch.message.comparePromptRequired'));
      return;
    }
    if (!generationSupportsOpenAICompatible) {
      setConfigMessage(t('batch.message.compareUnsupported'));
      return;
    }
    if (generationMode === 'image-to-image' && references.length === 0) {
      setConfigMessage(t('batch.message.compareReferenceRequired'));
      return;
    }

    const uniqueProfileIds = Array.from(new Set(profileIds)).filter(Boolean);
    const selectedProfiles = uniqueProfileIds
      .map((profileId) => providerProfiles.find((item) => item.id === profileId))
      .filter((profile): profile is ProviderConnectionProfile => Boolean(profile))
      .filter((profile) => profile.providerId === selectedProviderId);
    if (selectedProfiles.length < 2) {
      setConfigMessage(t('batch.message.compareProfilesRequired'));
      return;
    }

    const missingModelProfile = selectedProfiles.find((profile) => !profile.modelId.trim());
    if (missingModelProfile) {
      setConfigMessage(t('batch.message.compareModelMissing', { profile: missingModelProfile.displayName }));
      return;
    }

    const { queue, exists: existingQueue } = resolveTargetBatchQueue(batchQueueStore);
    const requestedCount = Math.max(1, Math.min(4, Math.round(count)));
    const compareGroupDraft = createBatchQueueCompareGroup({
      queueId: queue.id,
      prompt: trimmedPrompt,
      profileIds: selectedProfiles.map((profile) => profile.id)
    });
    const addedAt = new Date().toISOString();
    const tasks: BatchGenerationQueue['tasks'] = [];

    for (const profile of selectedProfiles) {
      const profileConfig = profileToProviderConfig(profile);
      let extraHeaders: Record<string, string> | undefined;
      try {
        extraHeaders = parseExtraHeaders(profileConfig.extraHeadersJson);
      } catch (error) {
        setConfigMessage(t('batch.message.compareHeadersParseFailed', { profile: profile.displayName, message: error instanceof Error ? error.message : String(error) }));
        return;
      }

      const snapshot = createQueuedGenerationSnapshot({
        providerId: profile.providerId,
        providerName: generationSelectedProvider.name,
        profileId: profile.id,
        profileName: profile.displayName,
        modelId: profileConfig.modelId.trim(),
        prompt: trimmedPrompt,
        negativePrompt: options.negativePrompt,
        size,
        quality,
        outputFormat: options.outputFormat ?? appSettings.generationDefaults.outputFormat,
        outputCompression: options.outputCompression,
        count: requestedCount,
        generationMode,
        references,
        seed: options.seed,
        baseUrl: profileConfig.baseUrl,
        protocol: profileConfig.protocol,
        imageToImageAdapter: profileConfig.imageToImageAdapter,
        endpointPath: profileConfig.endpointPath,
        extraHeaders,
        secretId: providerProfileSecretId(profile.id),
        metadata: {
          ...(options.metadata ?? {}),
          visionhub_model_compare: {
            compareGroupId: compareGroupDraft.id,
            origin: 'generate-page',
            addedAt,
            realExecutionRequiresConfirmation: true,
            profileId: profile.id,
            profileName: profile.displayName
          }
        },
        source: 'model-compare'
      });
      tasks.push(createBatchQueueTask({
        queueId: queue.id,
        snapshot,
        kind: 'model-compare',
        compareGroupId: compareGroupDraft.id,
        title: t('batch.message.compareTitle', { profile: profile.displayName || profileConfig.modelId, model: profileConfig.modelId })
      }));
    }

    const compareGroup = {
      ...compareGroupDraft,
      taskIds: tasks.map((task) => task.id),
      updatedAt: addedAt
    };
    const nextStore = existingQueue
      ? appendBatchQueueTasksAndCompareGroups(queue.id, tasks, [compareGroup], batchQueueStore)
      : upsertBatchQueue({ ...queue, tasks, compareGroups: [compareGroup], status: 'ready' }, batchQueueStore);
    setBatchQueueStore(nextStore);
    selectActiveBatchQueue(queue.id);
    const omittedReferenceCount = tasks.reduce(
      (sum, task) => sum + (task.snapshot.referencePolicy?.omittedReferenceIds.length ?? 0),
      0
    );
    setConfigMessage([
      t('batch.message.compareAdded', { queue: queue.name, profiles: selectedProfiles.length, tasks: tasks.length, count: requestedCount }),
      omittedReferenceCount > 0 ? t('batch.message.variantOmittedReferences', { count: omittedReferenceCount }) : ''
    ].filter(Boolean).join(' '));
    navigateTo('batch');
  }

  function setBatchTaskState(queueId: string, taskId: string, patch: Parameters<typeof updateBatchQueueTask>[2]) {
    const nextStore = updateBatchQueueTask(queueId, taskId, patch, loadBatchQueueStore());
    setBatchQueueStore(nextStore);
    return nextStore;
  }

  function setBatchQueueRunState(queueId: string, patch: Partial<BatchGenerationQueue>) {
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    if (!queue) {
      setBatchQueueStore(store);
      return store;
    }
    const nextStore = upsertBatchQueue({ ...queue, ...patch, id: queue.id }, store);
    setBatchQueueStore(nextStore);
    return nextStore;
  }

  function updateBatchQueueRunProgress(queueId: string, patch: Partial<BatchQueueRunProgress>) {
    setBatchQueueRunProgress((current) => (
      current?.queueId === queueId ? { ...current, ...patch } : current
    ));
  }

  async function executeBatchQueueTaskNow(
    queueId: string,
    taskId: string,
    options: { suppressMessage?: boolean } = {}
  ): Promise<'succeeded' | 'failed' | 'skipped'> {
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    const task = queue?.tasks.find((item) => item.id === taskId);
    if (!queue || !task) {
      if (!options.suppressMessage) setConfigMessage(t('batch.message.taskMissingRefresh'));
      setBatchQueueStore(store);
      return 'skipped';
    }
    if (task.status === 'running') {
      if (!options.suppressMessage) setConfigMessage(t('batch.message.taskRunning'));
      return 'skipped';
    }
    if (task.status === 'cancelled') {
      if (!options.suppressMessage) setConfigMessage(t('batch.message.taskCancelled'));
      return 'skipped';
    }
    setExecutingBatchTaskId(task.id);
    try {
      const execution = await executeQueuedGenerationTask(task, {
        providerName: task.snapshot.providerName,
        onTaskUpdate: (updatedTask) => {
          setBatchTaskState(queueId, taskId, updatedTask);
        }
      });
      for (const record of [...execution.records].reverse()) {
        addResult(record);
      }
      const nextStore = updateBatchQueueTask(queueId, taskId, execution.task, loadBatchQueueStore());
      setBatchQueueStore(nextStore);
      if (!options.suppressMessage) {
        setConfigMessage(execution.task.status === 'succeeded'
          ? t('batch.message.taskExecutionSuccess', { count: execution.records.length })
          : t('batch.message.taskExecutionFailedSaved', { message: execution.task.error ?? t('batch.message.noValidImage') }));
      }
      return execution.task.status === 'succeeded' ? 'succeeded' : 'failed';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBatchTaskState(queueId, taskId, { status: 'failed', error: message });
      if (!options.suppressMessage) setConfigMessage(t('batch.message.taskExecutionFailed', { message }));
      return 'failed';
    } finally {
      setExecutingBatchTaskId(null);
    }
  }

  async function executeBatchQueueSequentially(queueId: string) {
    if (runningBatchQueueId || executingBatchTaskId) {
      setConfigMessage(t('batch.message.queueAlreadyRunning'));
      return;
    }
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    if (!queue) {
      setBatchQueueStore(store);
      setConfigMessage(t('batch.message.queueNotFound'));
      return;
    }
    const initialPendingCount = queue.tasks.filter((task) => task.status === 'pending').length;
    if (initialPendingCount === 0) {
      setConfigMessage(t('batch.message.queueNoPending'));
      return;
    }

    batchQueueStopRequestedRef.current = false;
    setRunningBatchQueueId(queueId);
    setBatchQueueRunProgress({
      queueId,
      initialPendingCount,
      completedThisRun: 0,
      failedThisRun: 0,
      startedAt: new Date().toISOString()
    });
    setBatchQueueRunState(queueId, {
      status: 'running',
      startedAt: queue.startedAt ?? new Date().toISOString(),
      finishedAt: undefined
    });
    setConfigMessage(t('batch.message.sequentialStarted', { count: initialPendingCount }));

    let completedThisRun = 0;
    let failedThisRun = 0;
    try {
      while (!batchQueueStopRequestedRef.current) {
        const latestStore = loadBatchQueueStore();
        const latestQueue = latestStore.queues.find((item) => item.id === queueId);
        const nextTask = latestQueue?.tasks.find((task) => task.status === 'pending');
        if (!latestQueue || !nextTask) break;
        updateBatchQueueRunProgress(queueId, {
          currentTaskId: nextTask.id,
          currentTaskTitle: nextTask.title,
          completedThisRun,
          failedThisRun
        });
        const result = await executeBatchQueueTaskNow(queueId, nextTask.id, { suppressMessage: true });
        if (result === 'succeeded') completedThisRun += 1;
        if (result === 'failed') failedThisRun += 1;
        updateBatchQueueRunProgress(queueId, {
          completedThisRun,
          failedThisRun,
          currentTaskId: undefined,
          currentTaskTitle: undefined
        });
      }
    } finally {
      const finalStore = loadBatchQueueStore();
      const finalQueue = finalStore.queues.find((item) => item.id === queueId);
      if (finalQueue) {
        const summary = summarizeBatchQueue(finalQueue);
        const wasStopped = batchQueueStopRequestedRef.current && summary.pending > 0;
        const finalStatus: BatchGenerationQueue['status'] = wasStopped
          ? 'paused'
          : summary.pending > 0
            ? 'ready'
            : summary.failed > 0
              ? 'completed-with-errors'
              : 'completed';
        const nextStore = upsertBatchQueue({
          ...finalQueue,
          status: finalStatus,
          finishedAt: finalStatus === 'completed' || finalStatus === 'completed-with-errors'
            ? new Date().toISOString()
            : finalQueue.finishedAt
        }, finalStore);
        setBatchQueueStore(nextStore);
        setConfigMessage(wasStopped
          ? t('batch.message.sequentialStopped', { succeeded: completedThisRun, failed: failedThisRun, pending: summary.pending })
          : t('batch.message.sequentialCompleted', { succeeded: completedThisRun, failed: failedThisRun }));
      }
      batchQueueStopRequestedRef.current = false;
      setRunningBatchQueueId(null);
      setExecutingBatchTaskId(null);
      setBatchQueueRunProgress(null);
    }
  }

  function requestStartBatchQueue(queueId: string) {
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    if (!queue) {
      setBatchQueueStore(store);
      setConfigMessage(t('batch.message.queueNotFound'));
      return;
    }
    const pendingTasks = queue.tasks.filter((task) => task.status === 'pending');
    const pendingImages = pendingTasks.reduce((sum, task) => sum + Math.max(1, Math.min(4, Math.round(task.snapshot.count))), 0);
    if (pendingTasks.length === 0) {
      setConfigMessage(t('batch.message.queueNoPending'));
      return;
    }
    requestConfirm({
      title: t('batch.confirm.startQueueTitle'),
      message: [
        t('batch.confirm.startQueueSummary', { tasks: pendingTasks.length, images: pendingImages }),
        t('batch.confirm.startQueueCost'),
        t('batch.confirm.startQueueStopHint')
      ].join('\n'),
      confirmLabel: t('batch.confirm.startQueue'),
      cancelLabel: t('batch.confirm.skipRun'),
      onConfirm: () => {
        setConfigMessage(t('batch.message.startQueueConfirmed'));
        void executeBatchQueueSequentially(queueId);
      }
    });
  }

  function requestStopBatchQueue(queueId: string) {
    if (runningBatchQueueId !== queueId) {
      setConfigMessage(t('batch.message.noRunningQueue'));
      return;
    }
    batchQueueStopRequestedRef.current = true;
    updateBatchQueueRunProgress(queueId, { pauseRequested: true });
    setConfigMessage(t('batch.message.stopRequested'));
  }

  function requestDeleteBatchQueueTask(queueId: string, taskId: string) {
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    const task = queue?.tasks.find((item) => item.id === taskId);
    if (!queue || !task) {
      setBatchQueueStore(store);
      setConfigMessage(t('batch.message.taskMissing'));
      return;
    }
    if (task.status !== 'failed' && task.status !== 'cancelled') {
      setConfigMessage(t('batch.message.taskDeleteOnlyFailedCancelled'));
      return;
    }
    requestConfirm({
      title: t('batch.confirm.deleteTaskTitle'),
      message: [
        t('batch.confirm.deleteTaskIntro', { title: task.title }),
        t('batch.confirm.deleteTaskSafe')
      ].join('\n'),
      confirmLabel: t('batch.confirm.deleteTask'),
      cancelLabel: t('batch.confirm.keepTask'),
      tone: 'danger',
      onConfirm: () => {
        const nextStore = removeBatchQueueTask(queueId, taskId, loadBatchQueueStore());
        setBatchQueueStore(nextStore);
        setConfigMessage(t('batch.message.taskDeleted'));
      }
    });
  }

  function requestExecuteBatchQueueTask(queueId: string, taskId: string) {
    const queue = batchQueueStore.queues.find((item) => item.id === queueId);
    const task = queue?.tasks.find((item) => item.id === taskId);
    if (!queue || !task) {
      setConfigMessage(t('batch.message.taskMissingRefresh'));
      return;
    }
    const omittedReferenceCount = task.snapshot.referencePolicy?.omittedReferenceIds.length ?? 0;
    requestConfirm({
      title: t('batch.confirm.executeTaskTitle'),
      message: [
        t('batch.confirm.executeTaskSummary', { provider: task.snapshot.providerName ?? task.snapshot.providerId, profile: task.snapshot.profileName ?? t('batch.profileSnapshot'), model: task.snapshot.modelId, count: task.snapshot.count }),
        t('batch.confirm.executeTaskMeta', { mode: task.snapshot.generationMode === 'image-to-image' ? t('batch.mode.imageToImage') : t('batch.mode.textToImage'), size: task.snapshot.size }),
        omittedReferenceCount > 0 ? t('batch.confirm.executeTaskOmitted', { count: omittedReferenceCount }) : t('batch.confirm.executeTaskCost')
      ].join('\n'),
      confirmLabel: t('batch.confirm.executeTask'),
      cancelLabel: t('batch.confirm.skipRun'),
      onConfirm: () => {
        setConfigMessage(t('batch.message.taskExecuteStarted'));
        void executeBatchQueueTaskNow(queueId, taskId);
      }
    });
  }

  function requestCancelBatchQueueTask(queueId: string, taskId: string) {
    const queue = batchQueueStore.queues.find((item) => item.id === queueId);
    const task = queue?.tasks.find((item) => item.id === taskId);
    if (!queue || !task) return;
    requestConfirm({
      title: t('batch.confirm.cancelTaskTitle'),
      message: t('batch.confirm.cancelTaskMessage'),
      confirmLabel: t('batch.confirm.markCancelled'),
      cancelLabel: t('batch.confirm.keepTask'),
      tone: 'danger',
      onConfirm: () => {
        setBatchTaskState(queueId, taskId, {
          status: 'cancelled',
          error: task.error,
          finishedAt: new Date().toISOString()
        });
        setConfigMessage(t('batch.message.taskCancelledMarked'));
      }
    });
  }

  function createRetryBatchQueueTask(queueId: string, task: BatchGenerationQueue['tasks'][number]) {
    const retrySnapshot = createQueuedGenerationSnapshot({
      ...task.snapshot,
      references: task.snapshot.references ?? [],
      metadata: {
        ...(task.snapshot.metadata ?? {}),
        visionhub_queue_retry: {
          fromQueueId: queueId,
          fromTaskId: task.id,
          previousAttempt: task.attempt,
          previousError: task.error ?? null,
          requeuedAt: new Date().toISOString()
        }
      },
      source: 'library-retry',
      preserveEmbeddedReferenceImages: true
    });
    return createBatchQueueTask({
      queueId,
      snapshot: retrySnapshot,
      kind: task.kind,
      title: t('batch.message.retryTitle', { title: task.title }),
      status: 'pending'
    });
  }

  function requestRequeueBatchQueueTask(queueId: string, taskId: string) {
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    const task = queue?.tasks.find((item) => item.id === taskId);
    if (!queue || !task) {
      setConfigMessage(t('batch.message.taskMissingRefresh'));
      setBatchQueueStore(store);
      return;
    }
    if (task.status !== 'failed') {
      setConfigMessage(t('batch.message.requeueOnlyFailed'));
      return;
    }
    requestConfirm({
      title: t('batch.confirm.requeueTaskTitle'),
      message: [
        t('batch.confirm.requeueTaskCopy'),
        t('batch.confirm.requeueTaskKeep'),
        task.error ? t('batch.confirm.requeueTaskLastError', { message: task.error }) : ''
      ].filter(Boolean).join('\n'),
      confirmLabel: t('batch.confirm.requeue'),
      cancelLabel: t('batch.confirm.skipRetry'),
      onConfirm: () => {
        const retryTask = createRetryBatchQueueTask(queue.id, task);
        const nextStore = appendBatchQueueTasks(queue.id, [retryTask], loadBatchQueueStore());
        setBatchQueueStore(nextStore);
        setConfigMessage(t('batch.message.retryCreated'));
      }
    });
  }

  function requestRequeueFailedBatchQueueTasks(queueId: string) {
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    if (!queue) {
      setBatchQueueStore(store);
      setConfigMessage(t('batch.message.queueNotFound'));
      return;
    }
    const summary = summarizeBatchQueue(queue);
    if (runningBatchQueueId === queue.id || summary.running > 0 || executingBatchTaskId) {
      setConfigMessage(t('batch.message.bulkRequeueRunning'));
      return;
    }
    const failedTasks = queue.tasks.filter((task) => task.status === 'failed');
    if (!failedTasks.length) {
      setConfigMessage(t('batch.message.noFailedToRequeue'));
      return;
    }
    requestConfirm({
      title: t('batch.confirm.bulkRequeueTitle'),
      message: [
        t('batch.confirm.bulkRequeueIntro', { queue: queue.name, count: failedTasks.length }),
        t('batch.confirm.bulkRequeueKeep'),
        t('batch.confirm.bulkRequeueTail')
      ].join('\n'),
      confirmLabel: t('batch.confirm.bulkRequeue'),
      cancelLabel: t('batch.confirm.skipRetry'),
      onConfirm: () => {
        const latestStore = loadBatchQueueStore();
        const latestQueue = latestStore.queues.find((item) => item.id === queue.id);
        if (!latestQueue) {
          setBatchQueueStore(latestStore);
          setConfigMessage(t('batch.message.queueNotFound'));
          return;
        }
        const latestFailedTasks = latestQueue.tasks.filter((task) => task.status === 'failed');
        if (!latestFailedTasks.length) {
          setBatchQueueStore(latestStore);
          setConfigMessage(t('batch.message.noFailedToRequeue'));
          return;
        }
        const retryTasks = latestFailedTasks.map((task) => createRetryBatchQueueTask(latestQueue.id, task));
        const nextStore = appendBatchQueueTasks(latestQueue.id, retryTasks, latestStore);
        setBatchQueueStore(nextStore);
        selectActiveBatchQueue(latestQueue.id);
        setConfigMessage(t('batch.message.bulkRequeued', { count: retryTasks.length }));
      }
    });
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

    if (key === 'escape' && (generatePreviewUrl || libraryPreview || inspirationPreview)) {
      event.preventDefault();
      setGeneratePreviewUrl(null);
      setLibraryPreview(null);
      setInspirationPreview(null);
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
      '0': 'home',
      '1': 'generate',
      '2': 'free',
      '3': 'library',
      '4': 'inspiration',
      '5': 'templates',
      '6': 'providers',
      '7': 'settings',
      '8': 'batch'
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
      name: record.providerName ? t('app.reference.generatedName', { provider: record.providerName }) : t('app.reference.generatedFallback'),
      mimeType: imageUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : imageUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/png',
      dataUrl: imageUrl.startsWith('data:image/') ? imageUrl : undefined,
      localPath: record.localImagePaths?.[0],
      previewUrl: imageUrl,
      source: 'generated-result',
      sourceGenerationId: record.id,
      role: 'auto',
      addedAt: new Date().toISOString()
    };
  }

  const useRecordAsReference = useCallback((record: GenerationRecord) => {
    const reference = generationRecordToReference(record);
    if (!reference) return;
    const usedAt = new Date().toISOString();
    const meta = loadLibraryMeta();
    saveLibraryMeta({
      ...meta,
      [record.id]: compactLibraryMetaEntry({
        ...meta[record.id],
        lastUsedAsReferenceAt: usedAt
      })
    });
    setReferenceImages((current) => [
      reference,
      ...current.filter((item) => item.sourceGenerationId !== record.id)
    ].slice(0, 4));
    setGeneratePreviewUrl(null);
    setLibraryPreview(null);
    setInspirationPreview(null);
    navigateTo('generate');
  }, [navigateTo]);

  const retryRecordGeneration = useCallback((record: GenerationRecord) => {
    setPrompt(record.prompt);
    setReferenceImages((record.referenceImages ?? []).slice(0, 4));
    setGeneratePreviewUrl(null);
    setLibraryPreview(null);
    setInspirationPreview(null);
    navigateTo('generate');
  }, [navigateTo, setPrompt]);

  const recheckLibraryBackgroundRecord = useCallback(async (record: GenerationRecord) => {
    const matchingProfiles = providerProfiles.filter((profile) => profile.providerId === record.providerId);
    const targetProfile =
      matchingProfiles.find((profile) => profile.enabled && profile.modelId === record.modelId) ??
      matchingProfiles.find((profile) => profile.modelId === record.modelId) ??
      matchingProfiles.find((profile) => profile.enabled) ??
      matchingProfiles[0] ??
      null;
    const targetConfig = targetProfile
      ? profileToProviderConfig(targetProfile)
      : record.providerId === selectedProvider.id
        ? providerConfig
        : loadProviderConfig(record.providerId);
    const secretId = targetProfile
      ? providerProfileSecretId(targetProfile.id)
      : record.providerId === selectedProvider.id
        ? activeSecretId()
        : record.providerId;
    const updated = await recheckBackgroundGeneration(record.id, {
      secretId,
      extraHeaders: parseExtraHeaders(targetConfig.extraHeadersJson)
    });
    addResult(updated);
    return updated;
  }, [addResult, providerConfig, providerProfiles, selectedProfileId, selectedProvider.id]);

  useEffect(() => {
    if (!desktopRuntime || !isHistoryLoaded || isGenerating || typeof window === 'undefined') return;
    const candidates = results
      .filter(isBackgroundRecoveryCandidate)
      .filter((record) => !autoRecheckedRecordIdsRef.current.has(record.id))
      .slice(0, page === 'library' ? 3 : 1);
    if (!candidates.length) return;

    let cancelled = false;
    const delayMs = page === 'library' ? 1200 : Math.max(4500, appSettings.refreshIntervalSeconds * 1000);
    const timerId = window.setTimeout(() => {
      void (async () => {
        let checked = 0;
        let recovered = 0;
        for (const record of candidates) {
          if (cancelled) break;
          autoRecheckedRecordIdsRef.current.add(record.id);
          try {
            const updated = await recheckLibraryBackgroundRecord(record);
            checked += 1;
            if (updated.status === 'succeeded' && updated.imageUrls[0]) recovered += 1;
          } catch {
            // Automatic recheck is intentionally lightweight; failures still keep the manual diagnostics entry to avoid disrupting normal creation.
          }
        }
        if (!cancelled && (checked || recovered)) {
          window.dispatchEvent(new CustomEvent(appToastEventName, {
            detail: {
              message: recovered ? t('app.message.backgroundRecovered', { count: recovered }) : t('app.message.backgroundChecked', { count: checked }),
              level: recovered ? 'success' : 'info'
            } satisfies ToastEventDetail
          }));
        }
      })();
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [appSettings.refreshIntervalSeconds, desktopRuntime, isGenerating, isHistoryLoaded, page, recheckLibraryBackgroundRecord, results]);

  const useInspirationAssetAsReference = useCallback((asset: InspirationAsset) => {
    if (!asset.imageUrl) return;
    const reference: ReferenceImage = {
      id: `inspiration-${asset.id}-${Date.now()}`,
      name: asset.title || t('inspiration.flow.referenceName'),
      mimeType: asset.imageUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : asset.imageUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/png',
      dataUrl: asset.imageUrl.startsWith('data:image/') ? asset.imageUrl : undefined,
      localPath: asset.imagePath,
      previewUrl: asset.imageUrl,
      source: 'inspiration',
      role: 'auto',
      addedAt: new Date().toISOString()
    };
    setReferenceImages((current) => [
      reference,
      ...current.filter((item) => item.id !== reference.id)
    ].slice(0, 4));
    setPrompt(asset.originalPrompt || asset.inferredPrompt || prompt);
    setGeneratePreviewUrl(null);
    setLibraryPreview(null);
    setInspirationPreview(null);
    navigateTo('generate');
  }, [navigateTo, prompt, setPrompt, t]);

  const useInspirationPrompt = useCallback((promptText: string) => {
    if (!promptText.trim()) return;
    setPrompt(promptText);
    navigateTo('generate');
  }, [navigateTo, setPrompt]);

  const createPromptTemplateFromInspiration = useCallback((title: string, promptText: string, tags: string[]) => {
    const trimmedPrompt = promptText.trim();
    if (!trimmedPrompt) return t('inspiration.flow.noPrompt');
    const templates = loadPromptTemplates();
    const template: PromptTemplate = {
      id: `inspiration-${Date.now()}`,
      title: title.trim() || t('inspiration.flow.templateTitle'),
      category: 'style',
      tone: t('inspiration.flow.templateTone'),
      prompt: trimmedPrompt,
      tags: tags.length ? tags : [t('inspiration.flow.templateTag')]
    };
    savePromptTemplates([template, ...templates.filter((item) => item.prompt !== trimmedPrompt)].slice(0, 200));
    return t('inspiration.flow.templateSaved');
  }, [t]);

  function updateAppSettings(patch: Partial<AppSettings>) {
    if (typeof patch.sidebarCollapsed === 'boolean') {
      setIsSidebarCollapsed(patch.sidebarCollapsed);
    }
    if (patch.generationDefaults) {
      const nextGenerationDefaults = { ...appSettings.generationDefaults, ...patch.generationDefaults };
      if (nextGenerationDefaults.defaultProviderId !== selectedProviderId) {
        setSelectedProvider(nextGenerationDefaults.defaultProviderId);
      }
      if (nextGenerationDefaults.defaultModelId) {
        setSelectedModel(nextGenerationDefaults.defaultModelId);
      }
      setCount(nextGenerationDefaults.defaultCount);
      setSize(nextGenerationDefaults.defaultSize);
      setQuality(nextGenerationDefaults.defaultQuality);
    }
    if (patch.themeMode && patch.themeMode !== appSettings.themeMode && typeof window !== 'undefined') {
      beginThemeSwitchLock();
    }
    setAppSettings((current) => saveAppSettings({ ...current, ...patch }));
  }

  function updateThemeMode(mode: ThemeMode) {
    updateAppSettings({ themeMode: mode });
  }

  function toggleThemeMode() {
    updateThemeMode(resolvedThemeMode === 'dark' ? 'light' : 'dark');
  }

  function updateSidebarCollapsed(nextCollapsed: boolean) {
    setIsSidebarCollapsed(nextCollapsed);
    updateAppSettings({ sidebarCollapsed: nextCollapsed });
  }


  useEffect(() => {
    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [activeUtilityModal, page, generatePreviewUrl, libraryPreview, inspirationPreview, isSidebarCollapsed, desktopRuntime, appSettings]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    updateSystemTheme();
    mediaQuery.addEventListener?.('change', updateSystemTheme);
    return () => mediaQuery.removeEventListener?.('change', updateSystemTheme);
  }, []);

  useLayoutEffect(() => {
    syncDocumentTheme(resolvedThemeMode);
  }, [resolvedThemeMode]);

  useEffect(() => () => {
    if (typeof window !== 'undefined' && themeSwitchTimerRef.current !== null) {
      window.clearTimeout(themeSwitchTimerRef.current);
    }
    if (typeof document !== 'undefined') {
      delete document.documentElement.dataset.themeSwitching;
    }
  }, []);

  useEffect(() => {
    function handleToast(event: Event) {
      const detail = (event as CustomEvent<ToastEventDetail>).detail;
      if (!detail?.message?.trim()) return;
      const toast: ToastItem = {
        id: Date.now() + Math.random(),
        message: detail.message,
        level: detail.level ?? 'info',
        durationMs: detail.durationMs ?? defaultToastDurationMs
      };
      setToasts((current) => [...current, toast].slice(-4));
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, toast.durationMs);
    }
    window.addEventListener(appToastEventName, handleToast);
    return () => window.removeEventListener(appToastEventName, handleToast);
  }, []);

  const requestConfirm = useCallback((request: ConfirmDialogRequest) => {
    setConfirmDialog(request);
  }, []);

  async function openLibraryDirectory() {
    if (!desktopRuntime) {
      setSettingsMessage(t('settings.message.openLibraryDesktop'));
      return;
    }
    try {
      await revealLibraryDir();
      setSettingsMessage(t('settings.message.openLibraryDone'));
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function openInspirationDirectory() {
    if (!desktopRuntime) {
      setSettingsMessage(t('settings.message.openInspirationDesktop'));
      return;
    }
    try {
      await revealInspirationDir();
      setSettingsMessage(t('settings.message.openInspirationDone'));
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function openAppDataDirectory() {
    if (!desktopRuntime) {
      setSettingsMessage(t('settings.message.openAppDataDesktop'));
      return;
    }
    try {
      await revealAppDataDir();
      setSettingsMessage(t('settings.message.openAppDataDone'));
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function openBackupsDirectory() {
    if (!desktopRuntime) {
      setSettingsMessage(t('settings.message.openBackupsDesktop'));
      return;
    }
    try {
      await revealBackupsDir();
      setSettingsMessage(t('settings.message.openBackupsDone'));
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function selectLibraryDirectory() {
    if (!desktopRuntime) {
      setSettingsMessage(t('settings.message.selectLibraryDesktop'));
      return;
    }
    try {
      const nextSettings = await chooseLibraryDir();
      if (!nextSettings) {
        setSettingsMessage(t('settings.message.selectLibraryCancelled'));
        return;
      }
      setStorageSettings(nextSettings);
      setSettingsMessage(t('settings.message.selectLibraryDone', { path: nextSettings.resolved_library_dir }));
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function resetLibraryDirectoryOverride() {
    if (!desktopRuntime) {
      setSettingsMessage(t('settings.message.selectLibraryDesktop'));
      return;
    }
    try {
      const nextSettings = await saveStorageSettings({
        libraryDirOverride: null,
        inspirationDirOverride: storageSettings?.inspiration_dir_override ?? undefined
      });
      setStorageSettings(nextSettings);
      setSettingsMessage(t('settings.message.resetLibraryDone', { path: nextSettings.resolved_library_dir }));
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function selectInspirationDirectory() {
    if (!desktopRuntime) {
      setSettingsMessage(t('settings.message.selectInspirationDesktop'));
      return;
    }
    try {
      const nextSettings = await chooseInspirationDir();
      if (!nextSettings) {
        setSettingsMessage(t('settings.message.selectInspirationCancelled'));
        return;
      }
      setStorageSettings(nextSettings);
      setSettingsMessage(t('settings.message.selectInspirationDone', { path: nextSettings.resolved_inspiration_dir }));
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function resetInspirationDirectoryOverride() {
    if (!desktopRuntime) {
      setSettingsMessage(t('settings.message.selectInspirationDesktop'));
      return;
    }
    try {
      const nextSettings = await saveStorageSettings({
        libraryDirOverride: storageSettings?.library_dir_override ?? undefined,
        inspirationDirOverride: null
      });
      setStorageSettings(nextSettings);
      setSettingsMessage(t('settings.message.resetInspirationDone', { path: nextSettings.resolved_inspiration_dir }));
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function exportCurrentSettingsBackup() {
    if (!desktopRuntime) {
      setSettingsMessage(t('settings.message.exportBackupDesktop'));
      return;
    }
    try {
      const result = await exportSettingsBackup({
        appSettings,
        providerConfigs: {
          legacy: exportProviderConfigMap(),
          profiles: providerProfiles.map((profile) => ({
            ...profile,
            secret: undefined
          }))
        }
      });
      setSettingsMessage(t('settings.message.exportBackupDone', { path: result.path }));
      await revealGenerationFile(result.path);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function exportMigrationGuide() {
    if (!desktopRuntime) {
      setSettingsMessage(t('settings.message.exportMigrationDesktop'));
      return;
    }
    try {
      const [paths, latestStorageSettings] = await Promise.all([
        getAppPaths(),
        storageSettings ? Promise.resolve(storageSettings) : getStorageSettings()
      ]);
      const guideStorageSettings = latestStorageSettings ?? storageSettings;
      const createdAt = new Date().toISOString();
      const migrationNotConfigured = t('settings.migration.notConfigured');
      const migrationNotRead = t('settings.migration.notRead');
      const providerLines = providerProfiles.length
        ? providerProfiles.map((profile) => [
            `- ${profile.displayName || profile.id}`,
            `  - profile id: ${profile.id}`,
            `  - provider: ${profile.providerId}`,
            `  - model: ${profile.modelId || migrationNotConfigured}`,
            `  - base URL: ${profile.baseUrl || migrationNotConfigured}`,
            t('settings.migration.profileSecretLine', { secretId: `profile:${profile.id}` }),
            `  - extra headers: ${profile.extraHeadersJson && profile.extraHeadersJson !== '{}' ? t('settings.migration.extraHeadersConfigured') : migrationNotConfigured}`
          ].join('\n')).join('\n')
        : t('settings.migration.noProviderProfiles');
      const content = [
        t('settings.migration.title'),
        '',
        t('settings.migration.createdAt', { value: createdAt }),
        t('settings.migration.appVersion', { value: APP_VERSION }),
        '',
        t('settings.migration.purposeTitle'),
        '',
        t('settings.migration.purposeBody'),
        '',
        t('settings.migration.copyTitle'),
        '',
        t('settings.migration.pathAppData', { path: paths?.app_data_dir ?? migrationNotRead }),
        t('settings.migration.pathLibrary', { path: guideStorageSettings?.resolved_library_dir ?? paths?.library_dir ?? migrationNotRead }),
        t('settings.migration.pathInspiration', { path: guideStorageSettings?.resolved_inspiration_dir ?? migrationNotRead }),
        t('settings.migration.pathBackups', { path: paths?.backups_dir ?? migrationNotRead }),
        t('settings.migration.pathHistory', { path: paths?.history_file ?? migrationNotRead }),
        t('settings.migration.pathLibraryMeta', { path: paths?.library_meta_file ?? migrationNotRead }),
        t('settings.migration.pathStorageSettings', { path: guideStorageSettings?.settings_file ?? migrationNotRead }),
        '',
        t('settings.migration.notAutoTitle'),
        '',
        t('settings.migration.notAutoApiKey'),
        t('settings.migration.notAutoPromptPolish'),
        t('settings.migration.notAutoImageReverse'),
        t('settings.migration.notAutoProfile'),
        t('settings.migration.notAutoBuildArtifacts'),
        '',
        t('settings.migration.providerProfilesTitle'),
        '',
        providerLines,
        '',
        t('settings.migration.summaryTitle'),
        '',
        t('settings.migration.summaryStartup', { value: appSettings.startupPage }),
        t('settings.migration.summaryTheme', { value: appSettings.themeMode }),
        t('settings.migration.summaryLanguage', { value: appSettings.language }),
        t('settings.migration.summaryGenerationProvider', { value: appSettings.generationDefaults.defaultProviderId }),
        t('settings.migration.summaryModel', { value: appSettings.generationDefaults.defaultModelId || migrationNotConfigured }),
        t('settings.migration.summarySize', { value: appSettings.generationDefaults.defaultSize }),
        t('settings.migration.summaryCount', { count: appSettings.generationDefaults.defaultCount }),
        t('settings.migration.summaryPolishConfigCount', { count: appSettings.promptPolish.savedConfigs.length }),
        t('settings.migration.summaryImageReverseModel', { value: appSettings.imagePromptReverse.modelId || migrationNotConfigured }),
        '',
        t('settings.migration.stepsTitle'),
        '',
        t('settings.migration.step1'),
        t('settings.migration.step2'),
        t('settings.migration.step3'),
        t('settings.migration.step4'),
        t('settings.migration.step5'),
        t('settings.migration.step6'),
        '',
        t('settings.migration.securityTitle'),
        '',
        t('settings.migration.securityNoApiKey'),
        t('settings.migration.securityNoBinaries'),
        t('settings.migration.securityNoRaw'),
        t('settings.migration.securityKeepOldData'),
        ''
      ].join('\n');
      const suggestedFileName = `visionhub-migration-guide-${Date.now()}.md`;
      const result = await saveTextFileWithDialog({ suggestedFileName, content });
      if (!result.saved || !result.path) {
        setSettingsMessage(t('settings.message.exportMigrationCancelled'));
        return;
      }
      setSettingsMessage(t('settings.message.exportMigrationDone', { path: result.path }));
      await revealGenerationFile(result.path);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function handleConfigChange<K extends keyof OpenAICompatibleConfig>(
    key: K,
    value: OpenAICompatibleConfig[K]
  ) {
    setConfigActionState('idle');
    setProviderConfig((current) => {
      if (key === 'protocol') {
        const protocol = value as OpenAICompatibleConfig['protocol'];
        const currentEndpointPath = current.endpointPath.trim();
        const shouldUseProtocolDefault =
          !currentEndpointPath || currentEndpointPath === defaultEndpointForProtocol(current.protocol);
        return {
          ...current,
          protocol,
          endpointPath: shouldUseProtocolDefault ? defaultEndpointForProtocol(protocol) : current.endpointPath
        };
      }
      return { ...current, [key]: value };
    });
    if (key === 'modelId') setSelectedModel(String(value));
  }

  function activeSecretId() {
    return selectedProfileId ? providerProfileSecretId(selectedProfileId) : selectedProvider.id;
  }

  async function saveActiveProviderSecret() {
    if (!isSelectedServiceConfigurable) {
      setSecretMessage(t('provider.message.plannedSaveSecretBlocked'));
      return false;
    }
    const trimmedSecret = secretDraft.trim();
    if (!trimmedSecret) {
      setSecretMessage(secretAvailable ? t('provider.message.apiKeyChangeRequired') : t('provider.message.apiKeyRequired'));
      return false;
    }
    if (!desktopRuntime) {
      setSecretMessage(t('provider.message.desktopSecretRequired'));
      return false;
    }

    setIsSavingSecret(true);
    try {
      const status = await saveProviderSecret(activeSecretId(), trimmedSecret);
      setSecretAvailable(status.available);
      setSecretDraft('');
      setSecretMessage(selectedProfileId ? t('provider.message.apiKeySavedToProfile') : t('provider.message.apiKeySavedToDraft'));
      return status.available;
    } catch (error) {
      setSecretMessage(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setIsSavingSecret(false);
    }
  }

  async function savePromptPolishSecret() {
    const trimmedSecret = promptPolishSecretDraft.trim();
    if (!trimmedSecret) {
      setSettingsMessage(promptPolishSecretAvailable ? t('settings.promptPolishMessage.secretChangeRequired') : t('settings.promptPolishMessage.secretRequired'));
      return false;
    }
    if (!desktopRuntime) {
      setSettingsMessage(t('provider.message.desktopSecretRequired'));
      return false;
    }

    setIsSavingPromptPolishSecret(true);
    try {
      const status = await saveProviderSecret(PROMPT_POLISH_SECRET_ID, trimmedSecret);
      setPromptPolishSecretAvailable(status.available);
      setPromptPolishSecretDraft('');
      setSettingsMessage(t('settings.promptPolishMessage.secretSaved'));
      return status.available;
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setIsSavingPromptPolishSecret(false);
    }
  }

  function updatePromptPolishDraft(patch: Partial<PromptPolishSettings>) {
    setPromptPolishDraft((current) => ({ ...current, ...patch }));
  }

  function savePromptPolishConfig() {
    const displayName = promptPolishDraft.displayName.trim() || t('settings.promptPolishConfigPlaceholder');
    const baseUrl = promptPolishDraft.baseUrl.trim();
    const modelId = promptPolishDraft.modelId.trim();
    try {
      parseExtraHeaders(promptPolishDraft.extraHeadersJson);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
      return;
    }

    const modelOptions = Array.from(
      new Set([...promptPolishDraft.modelOptions, modelId].filter((item) => item.trim()).map((item) => item.trim()))
    );
    const configId = promptPolishConfigId(displayName, baseUrl);
    const nextSettings: PromptPolishSettings = {
      ...promptPolishDraft,
      displayName,
      baseUrl,
      modelId,
      modelOptions,
      savedConfigs: Array.from(new Map([
        ...promptPolishDraft.savedConfigs.map((config) => [config.id, config] as const),
        [
          configId,
          {
            id: configId,
            displayName,
            baseUrl,
            modelId,
            modelOptions,
            extraHeadersJson: promptPolishDraft.extraHeadersJson.trim() || '{}',
            protocol: promptPolishDraft.protocol
          }
        ] as const
      ]).values()).slice(0, 30)
    };
    updateAppSettings({ promptPolish: nextSettings });
    setSettingsMessage(t('settings.promptPolishMessage.configSaved'));
  }

  async function refreshPromptPolishModels() {
    const baseUrl = promptPolishDraft.baseUrl.trim();
    if (!baseUrl) {
      setSettingsMessage(t('settings.promptPolishMessage.baseUrlRequired'));
      return;
    }
    if (!desktopRuntime) {
      setSettingsMessage(t('settings.promptPolishMessage.desktopRefreshRequired'));
      return;
    }
    if (!promptPolishSecretAvailable) {
      setSettingsMessage(t('settings.promptPolishMessage.secretRequiredBeforeRefresh'));
      return;
    }

    setIsRefreshingPromptPolishModels(true);
    try {
      const models = await listOpenAICompatibleModels(
        'prompt-polish',
        baseUrl,
        parseExtraHeaders(promptPolishDraft.extraHeadersJson),
        PROMPT_POLISH_SECRET_ID
      );
      const modelOptions = Array.from(
        new Set([...models.map((model) => model.id), promptPolishDraft.modelId.trim()].filter(Boolean))
      );
      if (!modelOptions.length) {
        setSettingsMessage(t('settings.promptPolishMessage.noModels'));
        return;
      }
      setPromptPolishDraft((current) => ({
        ...current,
        modelOptions,
        modelId: modelOptions.includes(current.modelId.trim()) ? current.modelId.trim() : ''
      }));
      setSettingsMessage(t('settings.promptPolishMessage.modelsRefreshed', { count: modelOptions.length }));
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshingPromptPolishModels(false);
    }
  }


  async function saveImageReverseSecret() {
    const trimmedSecret = imageReverseSecretDraft.trim();
    if (!trimmedSecret) {
      setSettingsMessage(imageReverseSecretAvailable ? t('settings.imageReverseMessage.secretChangeRequired') : t('settings.imageReverseMessage.secretRequired'));
      return false;
    }
    if (!desktopRuntime) {
      setSettingsMessage(t('provider.message.desktopSecretRequired'));
      return false;
    }

    setIsSavingImageReverseSecret(true);
    try {
      const status = await saveProviderSecret(IMAGE_PROMPT_REVERSE_SECRET_ID, trimmedSecret);
      setImageReverseSecretAvailable(status.available);
      setImageReverseSecretDraft('');
      setSettingsMessage(t('settings.imageReverseMessage.secretSaved'));
      return status.available;
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setIsSavingImageReverseSecret(false);
    }
  }

  function updateImageReverseDraft(patch: Partial<ImagePromptReverseSettings>) {
    setImageReverseDraft((current) => ({ ...current, ...patch }));
  }

  function saveImageReverseConfig() {
    const displayName = imageReverseDraft.displayName.trim() || t('settings.imageReverseConfigPlaceholder');
    const baseUrl = imageReverseDraft.baseUrl.trim();
    const modelId = imageReverseDraft.modelId.trim();
    try {
      parseExtraHeaders(imageReverseDraft.extraHeadersJson);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
      return;
    }
    const modelOptions = Array.from(
      new Set([...imageReverseDraft.modelOptions, modelId].filter((item) => item.trim()).map((item) => item.trim()))
    );
    const nextSettings: ImagePromptReverseSettings = {
      ...imageReverseDraft,
      displayName,
      baseUrl,
      modelId,
      modelOptions,
      extraHeadersJson: imageReverseDraft.extraHeadersJson.trim() || '{}'
    };
    updateAppSettings({ imagePromptReverse: nextSettings });
    setSettingsMessage(t('settings.imageReverseMessage.configSaved'));
  }

  async function refreshImageReverseModels() {
    const baseUrl = imageReverseDraft.baseUrl.trim();
    if (!baseUrl) {
      setSettingsMessage(t('settings.imageReverseMessage.baseUrlRequired'));
      return;
    }
    if (imageReverseDraft.protocol === 'gemini-generate-content') {
      setSettingsMessage(t('settings.imageReverseMessage.geminiManualModel'));
      return;
    }
    if (!desktopRuntime) {
      setSettingsMessage(t('settings.imageReverseMessage.desktopRefreshRequired'));
      return;
    }
    if (!imageReverseSecretAvailable) {
      setSettingsMessage(t('settings.imageReverseMessage.secretRequiredBeforeRefresh'));
      return;
    }

    setIsRefreshingImageReverseModels(true);
    try {
      const models = await listOpenAICompatibleModels(
        'image-prompt-reverse',
        baseUrl,
        parseExtraHeaders(imageReverseDraft.extraHeadersJson),
        IMAGE_PROMPT_REVERSE_SECRET_ID
      );
      const modelOptions = Array.from(
        new Set([...models.map((model) => model.id), imageReverseDraft.modelId.trim()].filter(Boolean))
      );
      if (!modelOptions.length) {
        setSettingsMessage(t('settings.imageReverseMessage.noModels'));
        return;
      }
      setImageReverseDraft((current) => ({
        ...current,
        modelOptions,
        modelId: modelOptions.includes(current.modelId.trim()) ? current.modelId.trim() : ''
      }));
      setSettingsMessage(t('settings.imageReverseMessage.modelsRefreshed', { count: modelOptions.length }));
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshingImageReverseModels(false);
    }
  }

  function buildProfileFromCurrentConfig(enable: boolean) {
    if (!isSelectedServiceConfigurable) {
      throw new Error(t('provider.message.plannedSaveConfigBlocked'));
    }
    if (!providerConfig.baseUrl.trim()) {
      throw new Error(t('provider.error.baseUrlRequired'));
    }
    if (!providerConfig.modelId.trim()) {
      throw new Error(t('provider.error.modelIdRequired'));
    }
    const normalizedConfig = normalizeProviderConfig({
      ...providerConfig,
      displayName: providerConfig.displayName.trim() || inferProfileName(providerConfig)
    });
    new URL(normalizedConfig.baseUrl);
    if (!normalizedConfig.endpointPath.startsWith('/')) {
      throw new Error(t('provider.error.endpointPathSlash'));
    }

    const existing = selectedProfileId
      ? providerProfiles.find((profile) => profile.id === selectedProfileId)
      : undefined;
    const now = new Date().toISOString();
    return {
      ...(existing ?? createProviderProfile(selectedProvider.id, normalizedConfig)),
      ...normalizedConfig,
      providerId: selectedProvider.id,
      serviceTemplateId: selectedServiceTemplate.id,
      enabled: enable || existing?.enabled || false,
      updatedAt: now
    };
  }

  function persistProfile(profile: ProviderConnectionProfile) {
    const upserted = upsertProviderProfile(providerProfiles, profile);
    const nextProfiles = profile.enabled
      ? setProviderProfileEnabled(upserted, profile.id, true)
      : upserted;
    setProviderProfiles(nextProfiles);
    setIsCreatingProviderProfile(false);
    setSelectedProfileId(profile.id);
    setProviderConfig(profileToProviderConfig(profile));
    setSelectedModel(profile.modelId);
    if (profile.enabled) setSelectedProvider(profile.providerId);
    saveProviderConfig(selectedProvider.id, profileToProviderConfig(profile));
    return nextProfiles;
  }

  async function saveCurrentProviderConfig(enable = true) {
    setConfigActionState('saving');
    try {
      parseExtraHeaders(providerConfig.extraHeadersJson);
      const profile = buildProfileFromCurrentConfig(enable);
      if (secretDraft.trim()) {
        if (!desktopRuntime) {
          throw new Error(t('provider.message.desktopSecretRequired'));
        }
        const status = await saveProviderSecret(providerProfileSecretId(profile.id), secretDraft);
        setSecretAvailable(status.available);
        setSecretDraft('');
        setSecretMessage(t('provider.message.apiKeySavedToProfile'));
      }
      persistProfile(profile);
      setConfigActionState('saved');
      setConfigMessage(
        enable
          ? t('provider.message.profileSavedAndEnabled', { name: profile.displayName })
          : t('provider.message.profileSaved', { name: profile.displayName })
      );
    } catch (error) {
      setConfigActionState('failed');
      setConfigMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function startNewProviderProfile() {
    if (!isSelectedServiceConfigurable) {
      setConfigMessage(t('provider.message.templatePlanned'));
      return;
    }
    const draftConfig = createEmptyProviderDraftConfig(selectedProvider, selectedServiceTemplate, t);
    setIsCreatingProviderProfile(true);
    setSelectedProfileId(null);
    setProviderConfig(draftConfig);
    setSecretDraft('');
    setSecretAvailable(false);
    setSecretMessage('');
    setProviderDiagnostics([]);
    setConfigActionState('idle');
    setSelectedModel(draftConfig.modelId);
    setConfigMessage(t('provider.message.newProfileDraft'));
  }

  function selectProviderProfile(profileId: string) {
    const profile = providerProfiles.find((item) => item.id === profileId);
    if (!profile) return;
    setIsCreatingProviderProfile(false);
    setSelectedProfileId(profile.id);
    setProviderConfig(profileToProviderConfig(profile));
    setSelectedModel(profile.modelId);
    setSecretDraft('');
    setSecretMessage('');
    setConfigMessage('');
    setConfigActionState('idle');
    setProviderDiagnostics([]);
  }

  function deleteCurrentProviderProfile(profileId: string) {
    const profile = providerProfiles.find((item) => item.id === profileId);
    if (!profile) return;
    requestConfirm({
      title: t('provider.confirm.deleteProfileTitle'),
      message: t('provider.confirm.deleteProfileMessage', { name: profile.displayName }),
      confirmLabel: t('provider.confirm.deleteProfileButton'),
      tone: 'danger',
      onConfirm: async () => {
        const nextProfiles = deleteProviderProfile(providerProfiles, profileId);
        setProviderProfiles(nextProfiles);
        if (selectedProfileId === profileId) {
          const fallback =
            nextProfiles.find((item) => providerProfileBelongsToTemplate(item, selectedServiceTemplate)) ?? null;
          setIsCreatingProviderProfile(false);
          setSelectedProfileId(fallback?.id ?? null);
          setProviderConfig(fallback ? profileToProviderConfig(fallback) : defaultOpenAICompatibleConfig);
        }
        if (desktopRuntime) {
          await deleteProviderSecret(providerProfileSecretId(profileId)).catch(() => undefined);
        }
        setConfigMessage(t('provider.message.profileDeleted', { name: profile.displayName }));
      }
    });
  }

  function toggleProviderProfile(profileId: string, enabled: boolean) {
    const nextProfiles = setProviderProfileEnabled(providerProfiles, profileId, enabled);
    setProviderProfiles(nextProfiles);
    const profile = nextProfiles.find((item) => item.id === profileId);
    if (profile) {
      setIsCreatingProviderProfile(false);
      setSelectedProfileId(profile.id);
      setProviderConfig(profileToProviderConfig(profile));
      setSelectedModel(profile.modelId);
      if (enabled) setSelectedProvider(profile.providerId);
      setConfigMessage(t(enabled ? 'provider.message.profileEnabled' : 'provider.message.profileDisabled', { name: profile.displayName }));
    }
  }

  function updateProviderProfileTestState(
    profileId: string | null,
    status: ProviderConnectionProfile['lastTestStatus'],
    latencyMs: number,
    message: string,
    patch: Partial<Pick<ProviderConnectionProfile, 'lastModelCount' | 'lastImageModelCount' | 'lastModelProbe'>> = {}
  ) {
    if (!profileId) return;
    const now = new Date().toISOString();
    const nextProfiles = providerProfiles.map((profile) =>
      profile.id === profileId
        ? {
            ...profile,
            lastTestStatus: status,
            lastLatencyMs: latencyMs,
            lastMessage: message,
            lastTestedAt: now,
            ...patch,
            updatedAt: now
          }
        : profile
    );
    setProviderProfiles(nextProfiles);
    saveProviderProfiles(nextProfiles);
  }

  function inferProfileName(config: OpenAICompatibleConfig) {
    try {
      const host = new URL(config.baseUrl).hostname.replace(/^www\./, '');
      return `${host} · ${config.modelId || 'model'}`;
    } catch {
      return `${providerServiceTemplateDisplayName(selectedServiceTemplate, t) || selectedProvider.name} · ${config.modelId || 'model'}`;
    }
  }

  async function copyCurrentProviderConfig() {
    try {
      await navigator.clipboard?.writeText(serializeProviderConfig(providerConfig));
      setConfigMessage(t('provider.message.configCopied'));
    } catch (error) {
      setConfigMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function copyProviderDiagnosticsReport() {
    try {
      if (!providerDiagnostics.length) throw new Error(t('provider.message.runDiagnosticsFirst'));
      const report = buildProviderDiagnosticsReport(providerDiagnostics, {
        platformLabel: t(`provider.platform.${selectedPlatformType}.label` as Parameters<Translator>[0]),
        serviceLabel: t(`provider.service.${selectedServiceTemplate.id}.label` as Parameters<Translator>[0]),
        providerName: selectedProvider.name,
        profileName: selectedProfile?.displayName,
        profileId: selectedProfile?.id ?? selectedProfileId,
        modelId: providerConfig.modelId,
        protocolLabel: protocolLabel(providerConfig.protocol, t),
        endpointPreview: providerEndpointPreview(providerConfig),
        imageToImageAdapterLabel: imageToImageAdapterLabel(resolveImageToImageAdapterForDisplay(providerConfig, selectedProvider.id), t),
        generatedAt: new Date().toISOString()
      }, t);
      await navigator.clipboard?.writeText(report);
      setConfigMessage(t('provider.message.diagnosticsCopied'));
    } catch (error) {
      setConfigMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function importProviderConfigFromClipboard() {
    try {
      const text = await navigator.clipboard?.readText();
      if (!text?.trim()) throw new Error(t('provider.message.importClipboardEmpty'));
      const importedConfig = parseProviderConfigImport(text);
      setProviderConfig(importedConfig);
      setSelectedModel(importedConfig.modelId);
      setConfigMessage(t('provider.message.configPastedFromClipboard'));
    } catch (error) {
      setConfigMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function pinCurrentModelAsDefault() {
    try {
      const normalizedConfig = normalizeProviderConfig(providerConfig);
      const profile = buildProfileFromCurrentConfig(true);
      persistProfile({ ...profile, ...normalizedConfig, enabled: true });
      setConfigMessage(t('provider.message.defaultModelPinned', { model: normalizedConfig.modelId }));
    } catch (error) {
      setConfigMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function copyPromptAndOpenPlatform(platform: FreePlatform) {
    try {
      if (prompt.trim()) {
        await navigator.clipboard?.writeText(buildFreePlatformPrompt(platform, prompt));
      }
      await openExternalUrl(platform.url);
      setFreePlatformMessage(prompt.trim()
        ? t('free.message.copiedPromptAndOpened', { name: platform.name })
        : t('free.message.openedWebsite', { name: platform.name }));
    } catch (error) {
      setFreePlatformMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function copyPromptForPlatform(platform: FreePlatform) {
    try {
      if (!prompt.trim()) throw new Error(t('free.message.promptRequired'));
      await navigator.clipboard?.writeText(buildFreePlatformPrompt(platform, prompt));
      setFreePlatformMessage(t('free.message.copiedPrompt', { name: platform.name }));
    } catch (error) {
      setFreePlatformMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function openPlatform(platform: FreePlatform) {
    try {
      await openExternalUrl(platform.url);
      setFreePlatformMessage(t('free.message.openedPlatform', { name: platform.name }));
    } catch (error) {
      setFreePlatformMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function importWebResultFromPlatform(platform: FreePlatform, file: File) {
    try {
      if (!file.type.startsWith('image/')) throw new Error(t('free.message.imageFileRequired'));
      const adaptedPrompt = buildFreePlatformPrompt(platform, prompt);
      const dataUrl = await fileToDataUrl(file);
      await importInspirationAsset({
        title: t('free.import.title', { name: platform.name, file: file.name.replace(/\.[^.]+$/, '') }),
        dataUrl,
        fileName: file.name,
        sourceUrl: platform.url,
        sourcePlatform: platform.name,
        originalPrompt: adaptedPrompt || prompt.trim() || undefined,
        tags: [t('free.import.tag.freePlatform'), platform.name, platform.region === 'china' ? t('free.platform.region.china') : t('free.platform.region.global'), platform.supportsImageToImage ? t('free.import.tag.imageToImage') : t('free.import.tag.textToImage')],
        note: t('free.import.note', { name: platform.name, note: platform.commercialNote }),
        licenseStatus: platform.commercialUse === 'allowed' ? 'commercial-confirmed' : 'reference-only'
      });
      setIsInspirationPageMounted(true);
      setInspirationImportVersion((version) => version + 1);
      setFreePlatformMessage(t('free.message.importedToInspiration', { name: platform.name }));
    } catch (error) {
      setFreePlatformMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function refreshModels() {
    if (!isSelectedServiceConfigurable) {
      setConfigMessage(t('provider.message.plannedRefreshModelsBlocked'));
      return;
    }
    if (!providerSupportsOpenAICompatibleModelList(selectedProvider.id)) {
      setConfigMessage(modelListUnsupportedMessage(selectedProvider.id, providerConfig.modelId, t));
      return;
    }
    if (!desktopRuntime) {
      setConfigMessage(t('provider.message.refreshModelsDesktopRequired'));
      return;
    }
    if (!secretAvailable) {
      const savedSecret = await saveActiveProviderSecret();
      if (!savedSecret) {
        setConfigMessage(t('provider.message.refreshModelsKeyRequired'));
        return;
      }
    }

    setIsRefreshingModels(true);
    setConfigMessage(t('provider.message.refreshModelsRunning'));
    const startedAt = performance.now();
    try {
      const models = await listOpenAICompatibleModels(
        selectedProvider.id,
        providerConfig.baseUrl,
        parseExtraHeaders(providerConfig.extraHeadersJson),
        activeSecretId()
      );
      const modelOptions = models.map((model) => model.id);
      const imageModelCount = countLikelyImageModels(modelOptions);
      const nextModelId =
        modelOptions.find((id) => id === providerConfig.modelId) ??
        modelOptions.find((id) => id.toLowerCase().includes('image')) ??
        modelOptions[0] ??
        providerConfig.modelId;
      const modelProbe = buildModelProbe(nextModelId, modelOptions, t('provider.diagnostics.detail.modelProbeFromModelListRefresh'), t);
      const nextConfig = { ...providerConfig, modelOptions, modelId: nextModelId };
      const latencyMs = Math.round(performance.now() - startedAt);
      const testStatus = modelProbe.available ? 'passed' : 'warning';
      setProviderConfig(nextConfig);
      saveProviderConfig(selectedProvider.id, nextConfig);
      if (selectedProfile) {
        persistProfile({
          ...selectedProfile,
          ...nextConfig,
          lastTestStatus: testStatus,
          lastLatencyMs: latencyMs,
          lastMessage: modelProbe.message,
          lastTestedAt: new Date().toISOString(),
          lastModelCount: modelOptions.length,
          lastImageModelCount: imageModelCount,
          lastModelProbe: modelProbe
        });
      } else {
        updateProviderProfileTestState(
          selectedProfileId,
          testStatus,
          latencyMs,
          modelProbe.message,
          {
            lastModelCount: modelOptions.length,
            lastImageModelCount: imageModelCount,
            lastModelProbe: modelProbe
          }
        );
      }
      setSelectedModel(nextModelId);
      setConfigMessage(t('provider.message.refreshModelsDone', {
        count: modelOptions.length,
        suffix: modelProbe.available ? '' : t('provider.message.refreshModelsCurrentMissingSuffix')
      }));
    } catch (error) {
      if (isModelListUnavailableError(error)) {
        const nextConfig = ensureManualModelOption(providerConfig);
        setProviderConfig(nextConfig);
        saveProviderConfig(selectedProvider.id, nextConfig);
        if (selectedProfile) {
          const message = formatModelListFallbackMessage(error, nextConfig.modelId, t);
          persistProfile({
            ...selectedProfile,
            ...nextConfig,
            lastTestStatus: 'warning',
            lastLatencyMs: Math.round(performance.now() - startedAt),
            lastMessage: message,
            lastTestedAt: new Date().toISOString(),
            lastModelProbe: {
              modelId: nextConfig.modelId.trim(),
              available: false,
              checkedAt: new Date().toISOString(),
              message
            }
          });
        }
        setSelectedModel(nextConfig.modelId);
        setConfigMessage(formatModelListFallbackMessage(error, nextConfig.modelId, t));
      } else {
        setConfigMessage(mapProviderErrorMessage(error, t));
      }
    } finally {
      setIsRefreshingModels(false);
    }
  }

  async function probeCurrentModel() {
    if (!isSelectedServiceConfigurable) {
      setConfigMessage(t('provider.message.plannedProbeModelBlocked'));
      return;
    }
    if (!providerSupportsOpenAICompatibleModelList(selectedProvider.id)) {
      const fixedModelOptions = officialFixedModelOptions(selectedProvider.id);
      const nextConfig = ensureManualModelOption({
        ...providerConfig,
        modelOptions: Array.from(new Set([...providerConfig.modelOptions, ...fixedModelOptions, providerConfig.modelId.trim()].filter(Boolean)))
      });
      const probe = isMiniMaxProvider(selectedProvider.id)
        ? buildMiniMaxManualModelProbe(nextConfig.modelId, t('provider.diagnostics.detail.minimaxManualProbeHint'), t)
        : isGeminiProvider(selectedProvider.id)
          ? buildGeminiManualModelProbe(nextConfig.modelId, t('provider.diagnostics.detail.geminiManualProbeHint'), t)
          : buildModelProbe(nextConfig.modelId, nextConfig.modelOptions, t('provider.diagnostics.detail.modelListUnsupportedOpenAICompatible'), t);
      setProviderConfig(nextConfig);
      saveProviderConfig(selectedProvider.id, nextConfig);
      if (selectedProfile) {
        persistProfile({
          ...selectedProfile,
          ...nextConfig,
          lastTestStatus: 'warning',
          lastMessage: probe.message,
          lastTestedAt: new Date().toISOString(),
          lastModelProbe: probe
        });
      }
      setProviderDiagnostics((current) => [
        ...current.filter((item) => item.id !== 'model-probe'),
        {
          id: 'model-probe',
          label: t('provider.diagnostics.item.currentModelProbe'),
          level: probe.available ? 'info' : 'warn',
          detail: probe.message
        }
      ]);
      setConfigMessage(probe.message);
      return;
    }
    if (!desktopRuntime) {
      setConfigMessage(t('provider.message.probeModelDesktopRequired'));
      return;
    }
    if (!providerConfig.modelId.trim()) {
      setConfigMessage(t('provider.message.probeModelIdRequired'));
      return;
    }
    if (!secretAvailable) {
      const savedSecret = await saveActiveProviderSecret();
      if (!savedSecret) {
        setConfigMessage(t('provider.message.probeModelKeyRequired'));
        return;
      }
    }

    setIsProbingModel(true);
    setConfigMessage(t('provider.message.probeModelRunning', { model: providerConfig.modelId.trim() }));
    const startedAt = performance.now();
    try {
      const models = await listOpenAICompatibleModels(
        selectedProvider.id,
        providerConfig.baseUrl,
        parseExtraHeaders(providerConfig.extraHeadersJson),
        activeSecretId()
      );
      const modelOptions = models.map((model) => model.id);
      const latencyMs = Math.round(performance.now() - startedAt);
      const modelProbe = buildModelProbe(providerConfig.modelId, modelOptions, t('provider.diagnostics.detail.modelProbeLatencySource', { latency: latencyMs }), t);
      const imageModelCount = countLikelyImageModels(modelOptions);
      const nextConfig = {
        ...providerConfig,
        modelOptions: Array.from(new Set([...modelOptions, providerConfig.modelId.trim()].filter(Boolean)))
      };
      setProviderConfig(nextConfig);
      saveProviderConfig(selectedProvider.id, nextConfig);
      const testStatus = modelProbe.available ? 'passed' : 'warning';
      if (selectedProfile) {
        persistProfile({
          ...selectedProfile,
          ...nextConfig,
          lastTestStatus: testStatus,
          lastLatencyMs: latencyMs,
          lastMessage: modelProbe.message,
          lastTestedAt: new Date().toISOString(),
          lastModelCount: modelOptions.length,
          lastImageModelCount: imageModelCount,
          lastModelProbe: modelProbe
        });
      } else {
        updateProviderProfileTestState(
          selectedProfileId,
          testStatus,
          latencyMs,
          modelProbe.message,
          {
            lastModelCount: modelOptions.length,
            lastImageModelCount: imageModelCount,
            lastModelProbe: modelProbe
          }
        );
      }
      setProviderDiagnostics((current) => [
        ...current.filter((item) => item.id !== 'model-probe'),
        {
          id: 'model-probe',
          label: t('provider.diagnostics.item.currentModelProbe'),
          level: modelProbe.available ? 'pass' : 'warn',
          detail: modelProbe.message
        }
      ]);
      setConfigMessage(modelProbe.message);
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startedAt);
      if (isModelListUnavailableError(error)) {
        const nextConfig = ensureManualModelOption(providerConfig);
        const probe = {
          modelId: nextConfig.modelId.trim(),
          available: false,
          checkedAt: new Date().toISOString(),
          message: formatModelListFallbackMessage(error, nextConfig.modelId, t)
        };
        setProviderConfig(nextConfig);
        saveProviderConfig(selectedProvider.id, nextConfig);
        if (selectedProfile) {
          persistProfile({
            ...selectedProfile,
            ...nextConfig,
            lastTestStatus: 'warning',
            lastLatencyMs: latencyMs,
            lastMessage: probe.message,
            lastTestedAt: new Date().toISOString(),
            lastModelProbe: probe
          });
        } else {
          updateProviderProfileTestState(selectedProfileId, 'warning', latencyMs, probe.message, { lastModelProbe: probe });
        }
        setConfigMessage(probe.message);
      } else {
        const message = mapProviderErrorMessage(error, t);
        updateProviderProfileTestState(selectedProfileId, 'failed', latencyMs, message);
        setConfigMessage(message);
      }
    } finally {
      setIsProbingModel(false);
    }
  }

  async function runProviderDiagnostics(targetProfile?: ProviderConnectionProfile | unknown) {
    const diagnosticProfile = isProviderConnectionProfileLike(targetProfile) ? targetProfile : undefined;
    setIsRunningDiagnostics(true);
    const checks: ProviderDiagnosticItem[] = [];
    if (!diagnosticProfile && !isSelectedServiceConfigurable) {
      const plannedChecks: ProviderDiagnosticItem[] = [
        {
          id: 'template-status',
          label: t('provider.diagnostics.templateStatus'),
          level: 'info',
          detail: t('provider.statusDetail', {
            status: t(`provider.status.${selectedServiceTemplate.status}` as Parameters<Translator>[0]),
            description: t(`provider.service.${selectedServiceTemplate.id}.description` as Parameters<Translator>[0])
          })
        }
      ];
      setProviderDiagnostics(plannedChecks);
      setConfigMessage(t('provider.message.templatePlanned'));
      setIsRunningDiagnostics(false);
      return;
    }
    const targetProviderId = diagnosticProfile?.providerId ?? selectedProvider.id;
    const targetProvider = providers.find((provider) => provider.id === targetProviderId) ?? selectedProvider;
    const targetConfig = normalizeProviderConfig(diagnosticProfile ? profileToProviderConfig(diagnosticProfile) : providerConfig);
    const targetSecretId = diagnosticProfile ? providerProfileSecretId(diagnosticProfile.id) : activeSecretId();
    const targetSupportsOpenAICompatible = providerUsesConfig(targetProviderId);
    const targetSupportsModelList = providerSupportsOpenAICompatibleModelList(targetProviderId);
    const startedAt = performance.now();
    let profileStatus: ProviderConnectionProfile['lastTestStatus'] = 'warning';
    let profileMessage = t('provider.diagnostics.message.incomplete');
    let profilePatch: Partial<Pick<ProviderConnectionProfile, 'lastModelCount' | 'lastImageModelCount' | 'lastModelProbe'>> = {};

    function push(item: ProviderDiagnosticItem) {
      checks.push(item);
      setProviderDiagnostics([...checks]);
    }

    try {
      push({
        id: 'runtime',
        label: t('provider.diagnostics.item.runtime'),
        level: desktopRuntime ? 'pass' : 'warn',
        detail: desktopRuntime ? t('provider.diagnostics.detail.runtimeDesktop') : t('provider.diagnostics.detail.runtimeWeb')
      });

      push({
        id: 'adapter',
        label: t('provider.diagnostics.item.adapter'),
        level: targetSupportsOpenAICompatible ? 'pass' : 'info',
        detail: targetSupportsOpenAICompatible ? t('provider.diagnostics.detail.adapterReady') : t('provider.diagnostics.detail.adapterPlanned')
      });

      if (!targetSupportsOpenAICompatible) {
        profileMessage = t('provider.diagnostics.message.adapterUnsupported');
        return;
      }

      push({
        id: 'profile-secret-channel',
        label: t('provider.diagnostics.item.profileSecretChannel'),
        level: diagnosticProfile || selectedProfileId ? 'pass' : 'info',
        detail: diagnosticProfile || selectedProfileId
          ? t('provider.diagnostics.detail.profileSecretBound')
          : t('provider.diagnostics.detail.profileSecretDraft')
      });

      let endpointPreview = '';
      try {
        const baseUrl = new URL(targetConfig.baseUrl);
        endpointPreview = `${baseUrl.origin}${targetConfig.endpointPath.startsWith('/') ? targetConfig.endpointPath : `/${targetConfig.endpointPath}`}`;
        const baseUrlPath = baseUrl.pathname.replace(/\/+$/, '');
        const baseUrlLooksLikeEndpoint = /\/v\d+\/(images|responses|chat|models)/i.test(baseUrlPath);
        push({
          id: 'base-url',
          label: 'Base URL',
          level: baseUrlLooksLikeEndpoint ? 'warn' : 'pass',
          detail: baseUrlLooksLikeEndpoint
            ? t('provider.diagnostics.detail.baseUrlLooksEndpoint', { path: baseUrlPath, origin: baseUrl.origin })
            : t('provider.diagnostics.detail.baseUrlValid', { origin: baseUrl.origin })
        });
      } catch {
        push({
          id: 'base-url',
          label: 'Base URL',
          level: 'fail',
          detail: t('provider.diagnostics.detail.baseUrlInvalid')
        });
      }

      const endpointPath = targetConfig.endpointPath.trim();
      const expectedEndpointPath = defaultEndpointForProtocol(targetConfig.protocol);
      push({
        id: 'endpoint-path-shape',
        label: t('provider.diagnostics.item.endpointPath'),
        level: endpointPath.startsWith('/') ? 'pass' : 'warn',
        detail: endpointPath.startsWith('/')
          ? t('provider.diagnostics.detail.endpointPathValid', { path: endpointPath })
          : t('provider.diagnostics.detail.endpointPathSuggestion', { path: expectedEndpointPath })
      });

      const modelId = targetConfig.modelId.trim();
      push({
        id: 'model-id',
        label: t('provider.diagnostics.item.modelId'),
        level: modelId ? 'pass' : 'fail',
        detail: modelId
          ? t('provider.diagnostics.detail.modelIdCurrent', { model: modelId })
          : t('provider.diagnostics.detail.modelIdEmpty')
      });

      try {
        parseExtraHeaders(targetConfig.extraHeadersJson);
        push({
          id: 'headers',
          label: t('provider.diagnostics.item.extraHeaders'),
          level: 'pass',
          detail: t('provider.diagnostics.detail.headersValid')
        });
      } catch (error) {
        push({
          id: 'headers',
          label: t('provider.diagnostics.item.extraHeaders'),
          level: 'fail',
          detail: error instanceof Error ? error.message : String(error)
        });
      }

      if (targetConfig.extraHeadersJson.toLowerCase().includes('authorization')) {
        push({
          id: 'authorization-header',
          label: t('provider.diagnostics.item.authHeader'),
          level: 'warn',
          detail: t('provider.diagnostics.detail.authHeaderWarning')
        });
      }

      let currentSecretAvailable = secretAvailable;
      if (desktopRuntime) {
        const status = await getProviderSecretStatus(targetSecretId);
        currentSecretAvailable = status.available;
        if (!currentSecretAvailable && targetSecretId !== targetProviderId) {
          const legacyStatus = await getProviderSecretStatus(targetProviderId);
          currentSecretAvailable = legacyStatus.available;
        }
        if (!diagnosticProfile || diagnosticProfile.id === selectedProfileId) {
          setSecretAvailable(currentSecretAvailable);
        }
      }

      push({
        id: 'secret',
        label: 'API Key',
        level: currentSecretAvailable ? 'pass' : 'warn',
        detail: currentSecretAvailable ? t('provider.diagnostics.detail.secretReady') : t('provider.diagnostics.detail.secretMissing')
      });

      const targetTemplate = diagnosticProfile?.serviceTemplateId
        ? getProviderServiceTemplate(diagnosticProfile.serviceTemplateId)
        : getDefaultProviderServiceTemplateForProvider(targetProviderId) ?? selectedServiceTemplate;

      buildProviderReadinessItems({
        profile: diagnosticProfile ?? selectedProfile,
        config: targetConfig,
        providerId: targetProviderId,
        desktopRuntime,
        secretAvailable: currentSecretAvailable,
        serviceConfigurable: true,
        supportsOpenAICompatible: targetSupportsOpenAICompatible,
        t
      }).forEach((item) => push({ ...item, id: `readiness-${item.id}` }));

      buildProviderStabilityDiagnosticItems({
        config: targetConfig,
        providerId: targetProviderId,
        template: targetTemplate,
        supportsModelList: targetSupportsModelList,
        t
      }).forEach((item) => push({ ...item, id: `stability-${item.id}` }));

      push({
        id: 'protocol',
        label: t('provider.diagnostics.item.protocol'),
        level: targetConfig.endpointPath.trim().startsWith('/') ? 'pass' : 'warn',
        detail: targetConfig.endpointPath === defaultEndpointForProtocol(targetConfig.protocol)
          ? t('provider.diagnostics.detail.protocolDefaultEndpoint', { protocol: targetConfig.protocol, endpoint: endpointPreview || targetConfig.endpointPath })
          : t('provider.diagnostics.detail.protocolCustomEndpoint', { protocol: targetConfig.protocol, endpoint: endpointPreview || targetConfig.endpointPath })
      });

      push({
        id: 'image-to-image-adapter',
        label: t('provider.diagnostics.item.imageToImageAdapter'),
        level: targetConfig.imageToImageAdapter === 'auto' ? 'info' : 'pass',
        detail: imageToImageAdapterDiagnosticDetail(targetConfig, targetProviderId, t)
      });

      if (storageSettings) {
        push({
          id: 'library-storage',
          label: t('provider.diagnostics.item.libraryStorage'),
          level: 'pass',
          detail: t('provider.diagnostics.detail.libraryStoragePath', { path: storageSettings.resolved_library_dir })
        });
      } else {
        push({
          id: 'library-storage',
          label: t('provider.diagnostics.item.libraryStorage'),
          level: desktopRuntime ? 'warn' : 'info',
          detail: desktopRuntime ? t('provider.diagnostics.detail.libraryStorageMissing') : t('provider.diagnostics.detail.libraryStorageWeb')
        });
      }

      if (appSettings.promptPolish.engine === 'provider') {
        let polishSecretAvailable = promptPolishSecretAvailable;
        if (desktopRuntime) {
          const polishStatus = await getProviderSecretStatus(PROMPT_POLISH_SECRET_ID);
          polishSecretAvailable = polishStatus.available;
          setPromptPolishSecretAvailable(polishSecretAvailable);
        }
        const polishConfigReady = Boolean(safeProviderConfigText(appSettings.promptPolish.baseUrl) && safeProviderConfigText(appSettings.promptPolish.modelId));
        push({
          id: 'prompt-polish-channel',
          label: t('provider.diagnostics.item.promptPolishChannel'),
          level: polishConfigReady && polishSecretAvailable ? 'pass' : 'warn',
          detail: polishConfigReady
            ? polishSecretAvailable
              ? t('provider.diagnostics.detail.promptPolishReady', { id: PROMPT_POLISH_SECRET_ID })
              : t('provider.diagnostics.detail.promptPolishSecretMissing', { id: PROMPT_POLISH_SECRET_ID })
            : t('provider.diagnostics.detail.promptPolishConfigIncomplete')
        });
      } else {
        push({
          id: 'prompt-polish-channel',
          label: t('provider.diagnostics.item.promptPolishChannel'),
          level: 'info',
          detail: t('provider.diagnostics.detail.promptPolishLocal')
        });
      }

      if (targetConfig.protocol === 'responses') {
        push({
          id: 'responses-background',
          label: t('provider.diagnostics.item.responsesBackground'),
          level: 'info',
          detail: t('provider.diagnostics.detail.responsesBackground')
        });
      }

      if (!targetSupportsModelList) {
        const fixedModelOptions = officialFixedModelOptions(targetProviderId);
        const nextConfig = fixedModelOptions.length
          ? ensureManualModelOption({
              ...targetConfig,
              modelOptions: Array.from(new Set([...targetConfig.modelOptions, ...fixedModelOptions, targetConfig.modelId.trim()].filter(Boolean)))
            })
          : ensureManualModelOption(targetConfig);
        const modelProbe = isMiniMaxProvider(targetProviderId)
          ? buildMiniMaxManualModelProbe(nextConfig.modelId, t('provider.diagnostics.detail.minimaxManualProbeHint'), t)
          : isGeminiProvider(targetProviderId)
            ? buildGeminiManualModelProbe(nextConfig.modelId, t('provider.diagnostics.detail.geminiManualProbeHint'), t)
            : {
                modelId: nextConfig.modelId.trim(),
                available: false,
                checkedAt: new Date().toISOString(),
                message: modelListUnsupportedMessage(targetProviderId, nextConfig.modelId, t)
              };
        if (!diagnosticProfile || diagnosticProfile.id === selectedProfileId) {
          setProviderConfig(nextConfig);
          saveProviderConfig(targetProviderId, nextConfig);
          setSelectedModel(nextConfig.modelId);
        }
        profileStatus = 'warning';
        profileMessage = modelProbe.message;
        profilePatch = { lastModelProbe: modelProbe };
        push({
          id: 'models',
          label: isMiniMaxProvider(targetProviderId) ? t('provider.diagnostics.item.minimaxModelConfirm') : isGeminiProvider(targetProviderId) ? t('provider.diagnostics.item.geminiModelConfirm') : t('provider.diagnostics.item.modelListConnectivity'),
          level: 'info',
          detail: profileMessage
        });
        return;
      }

      if (!desktopRuntime || !currentSecretAvailable) {
        profileStatus = 'warning';
        profileMessage = !desktopRuntime ? t('provider.diagnostics.message.desktopRequired') : t('provider.diagnostics.message.apiKeyMissingSkipLatency');
        push({
          id: 'network',
          label: t('provider.diagnostics.item.modelListConnectivity'),
          level: 'info',
          detail: t('provider.diagnostics.detail.modelListPrerequisite')
        });
        return;
      }

      try {
        const models = await listOpenAICompatibleModels(
          targetProviderId,
          targetConfig.baseUrl,
          parseExtraHeaders(targetConfig.extraHeadersJson),
          targetSecretId
        );
        const latencyMs = Math.round(performance.now() - startedAt);
        const modelOptions = models.map((model) => model.id);
        const imageModelCount = countLikelyImageModels(modelOptions);
        const modelProbe = buildModelProbe(targetConfig.modelId, modelOptions, t('provider.diagnostics.detail.modelProbeFromDiagnostics'), t);
        profileStatus = models.length > 0 && modelProbe.available ? 'passed' : 'warning';
        profileMessage =
          models.length > 0 && modelProbe.available
            ? t('provider.diagnostics.detail.modelListSuccessVisible', { latency: latencyMs, count: models.length })
            : models.length > 0
              ? t('provider.diagnostics.detail.modelListSuccessMissing', { latency: latencyMs, count: models.length })
            : t('provider.diagnostics.detail.modelListEmpty', { latency: latencyMs });
        push({
          id: 'models',
          label: t('provider.diagnostics.item.modelListConnectivity'),
          level: models.length > 0 ? 'pass' : 'warn',
          detail: models.length > 0
            ? t('provider.diagnostics.detail.modelListStats', { count: models.length, imageCount: imageModelCount, latency: latencyMs })
            : t('provider.diagnostics.detail.modelListEmptyKeepManual', { latency: latencyMs })
        });
        push({
          id: 'model-probe',
          label: t('provider.diagnostics.item.currentModelProbe'),
          level: modelProbe.available ? 'pass' : 'warn',
          detail: modelProbe.message
        });
        profilePatch = {
          lastModelCount: modelOptions.length,
          lastImageModelCount: imageModelCount,
          lastModelProbe: modelProbe
        };
      } catch (error) {
        if (isModelListUnavailableError(error)) {
          const latencyMs = Math.round(performance.now() - startedAt);
          const nextConfig = ensureManualModelOption(targetConfig);
          if (!diagnosticProfile || diagnosticProfile.id === selectedProfileId) {
            setProviderConfig(nextConfig);
            saveProviderConfig(targetProviderId, nextConfig);
            setSelectedModel(nextConfig.modelId);
          }
          profileStatus = 'warning';
          profileMessage = t('provider.error.withLatency', { message: formatModelListFallbackMessage(error, nextConfig.modelId, t), latency: latencyMs });
          profilePatch = {
            lastModelProbe: {
              modelId: nextConfig.modelId.trim(),
              available: false,
              checkedAt: new Date().toISOString(),
              message: profileMessage
            }
          };
          push({
            id: 'models',
            label: t('provider.diagnostics.item.modelListConnectivity'),
            level: 'warn',
            detail: profileMessage
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      profileStatus = 'failed';
      profileMessage = mapProviderErrorMessage(error, t);
      push({
        id: 'network-error',
        label: t('provider.diagnostics.onlineError'),
        level: 'fail',
        detail: mapProviderErrorMessage(error, t)
      });
    } finally {
      updateProviderProfileTestState(
        diagnosticProfile?.id ?? selectedProfileId,
        profileStatus,
        Math.round(performance.now() - startedAt),
        profileMessage,
        profilePatch
      );
      setConfigMessage(profileMessage);
      setIsRunningDiagnostics(false);
    }
  }

  async function runProviderProfileConnectionTest(profileId: string) {
    const profile = providerProfiles.find((item) => item.id === profileId);
    if (!profile) return;
    setIsCreatingProviderProfile(false);
    setSelectedProfileId(profile.id);
    setProviderConfig(profileToProviderConfig(profile));
    setSelectedModel(profile.modelId);
    setConfigMessage(t('provider.message.testingLatency', { name: profile.displayName }));
    await runProviderDiagnostics(profile);
  }

  async function runProviderTestGeneration() {
    if (!isSelectedServiceConfigurable) {
      setConfigMessage(t('provider.message.plannedTestGenerationBlocked'));
      return;
    }
    if (!supportsOpenAICompatible) {
      setConfigMessage(t('provider.message.testGenerationAdapterUnsupported'));
      return;
    }
    if (!desktopRuntime) {
      setConfigMessage(t('provider.message.testGenerationDesktopRequired'));
      return;
    }
    if (!secretAvailable) {
      const savedSecret = await saveActiveProviderSecret();
      if (!savedSecret) {
        setConfigMessage(t('provider.message.testGenerationKeyRequired'));
        return;
      }
    }

    setIsRunningTestGeneration(true);
    setConfigMessage(t('provider.message.testGenerationRunning'));
    const startedAt = performance.now();
    try {
      const normalizedConfig = normalizeProviderConfig(providerConfig);
      new URL(normalizedConfig.baseUrl);
      const extraHeaders = parseExtraHeaders(normalizedConfig.extraHeadersJson);
      if (!normalizedConfig.endpointPath.startsWith('/')) {
        throw new Error(t('provider.error.endpointPathSlash'));
      }

      saveProviderConfig(selectedProvider.id, normalizedConfig);
      setProviderConfig(normalizedConfig);
      setSelectedModel(normalizedConfig.modelId);

      const result = await generateOpenAIImage({
        providerId: selectedProvider.id,
        modelId: normalizedConfig.modelId,
        prompt:
          'Kuroii VisionHub provider test image, a clean minimal glowing glass cube on a dark desk, soft studio light, square composition, no text',
        count: 1,
        size: '1024x1024',
        quality: 'auto',
        baseUrl: normalizedConfig.baseUrl,
        protocol: normalizedConfig.protocol,
        endpointPath: normalizedConfig.endpointPath,
        extraHeaders,
        secretId: activeSecretId(),
        metadata: { source: 'provider-hub-test-generation' }
      });
      const saved = await saveGenerationRecord(result, selectedProvider.name);
      addResult(saved);

      if (saved.status === 'succeeded' && saved.imageUrls[0]) {
        updateProviderProfileTestState(selectedProfileId, 'passed', Math.round(performance.now() - startedAt), t('provider.message.testGenerationSucceededState'));
        setPage('providers');
        setGeneratePreviewUrl(null);
        setLibraryPreview(null);
        setConfigMessage(t('provider.message.testGenerationSucceeded'));
      } else if (isPotentialBackgroundCompletion(saved)) {
        const message = t('provider.message.testGenerationBackgroundPending');
        updateProviderProfileTestState(selectedProfileId, 'warning', Math.round(performance.now() - startedAt), message);
        setConfigMessage(message);
      } else {
        updateProviderProfileTestState(selectedProfileId, 'failed', Math.round(performance.now() - startedAt), saved.error ?? t('provider.error.noImageReturned'));
        setConfigMessage(t('provider.message.testGenerationFailedRecord', { message: mapProviderErrorMessage(saved.error ?? t('provider.error.noImageReturned'), t) }));
      }
    } catch (error) {
      updateProviderProfileTestState(selectedProfileId, 'failed', Math.round(performance.now() - startedAt), mapProviderErrorMessage(error, t));
      setConfigMessage(mapProviderErrorMessage(error, t));
    } finally {
      setIsRunningTestGeneration(false);
    }
  }

  const navLabels: Record<Page, string> = {
    home: t('nav.home'),
    generate: t('nav.generate'),
    batch: t('nav.batch'),
    free: t('nav.free'),
    library: t('nav.library'),
    inspiration: t('nav.inspiration'),
    templates: t('nav.templates'),
    providers: t('nav.providers'),
    settings: t('nav.settings')
  };
  const navItems: Array<{ page: Page; label: string; icon: ReactNode }> = [
    { page: 'home', label: navLabels.home, icon: <Grid2X2 size={18} /> },
    { page: 'generate', label: navLabels.generate, icon: <Wand2 size={18} /> },
    { page: 'batch', label: navLabels.batch, icon: <ListChecks size={18} /> },
    { page: 'free', label: navLabels.free, icon: <Gift size={18} /> },
    { page: 'library', label: navLabels.library, icon: <Image size={18} /> },
    { page: 'inspiration', label: navLabels.inspiration, icon: <Bookmark size={18} /> },
    { page: 'templates', label: navLabels.templates, icon: <Layers size={18} /> },
    { page: 'providers', label: navLabels.providers, icon: <Database size={18} /> },
    { page: 'settings', label: navLabels.settings, icon: <Settings size={18} /> }
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
      className={`appShell theme-${resolvedThemeMode} ${isSidebarCollapsed ? 'sidebarCollapsed' : ''} ${appSettings.compactMode ? 'compactMode' : ''} ${isThemeSwitching ? 'themeSwitching' : ''}`}
      data-language={appSettings.language}
      style={appShellStyle}
    >
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark" aria-hidden="true">
            <span className="brandGlyph">Kuroii</span>
          </div>
          <div className="brandText">
            <strong>Kuroii VisionHub</strong>
            <span>{t('app.subtitle')}</span>
          </div>
          
        </div>

        <nav className="navGroup">
          {navItems.map((item) => (
            <button
              key={item.page}
              className={`navItem ${page === item.page ? 'active' : ''}`}
              data-tooltip={item.label}
              aria-label={item.label}
              onClick={() => navigateTo(item.page)}
            >
              {item.icon} <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebarFooter">
          <button
            className="themeToggle"
            type="button"
            data-tooltip={resolvedThemeMode === 'dark' ? t('theme.toLight') : t('theme.toDark')}
            aria-label={resolvedThemeMode === 'dark' ? t('theme.toLight') : t('theme.toDark')}
            onClick={toggleThemeMode}
          >
            {resolvedThemeMode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{themeMode === 'system' ? t('theme.system') : resolvedThemeMode === 'dark' ? t('theme.dark') : t('theme.light')}</span>
          </button>
          <button
            className="sidebarCollapseButton"
            type="button"
            data-tooltip={isSidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            aria-label={isSidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            onClick={() => updateSidebarCollapsed(!isSidebarCollapsed)}
          >
            <Sidebar size={17} />
            <span>{isSidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}</span>
          </button>
        </div>
      </aside>

      <main className={`workspace ${page === 'generate' ? 'workspaceGenerate' : page === 'home' ? 'workspaceHomeShell' : page === 'batch' ? 'workspaceBatchShell' : ''}`}>
        {isLibraryPageMounted ? (
          <CachedLibraryPage
            t={t}
            providers={providers}
            results={results}
            isHistoryLoaded={isHistoryLoaded}
            isActive={page === 'library'}
            preview={libraryPreview}
            resolveProviderLabel={resolveProviderGenerationLabel}
            onAddResult={addResult}
            onPreview={openLibraryPreview}
            onNavigatePreview={navigateLibraryPreview}
            onClosePreview={closeLibraryPreview}
            onUseAsReference={useRecordAsReference}
            onRetryRecord={retryRecordGeneration}
            onRecheckBackgroundRecord={recheckLibraryBackgroundRecord}
            onRequestConfirm={requestConfirm}
            onDelete={deleteLibraryRecord}
          />
        ) : null}
        {isInspirationPageMounted ? (
          <CachedInspirationPage
            t={t}
            isActive={page === 'inspiration'}
            preview={inspirationPreview}
            onPreview={openInspirationPreview}
            onNavigatePreview={navigateInspirationPreview}
            onClosePreview={closeInspirationPreview}
            onUseAsReference={useInspirationAssetAsReference}
            onUsePrompt={useInspirationPrompt}
            onCreateTemplate={createPromptTemplateFromInspiration}
            onRequestConfirm={requestConfirm}
            imagePromptReverse={appSettings.imagePromptReverse}
            imagePromptReverseSecretAvailable={imageReverseSecretAvailable}
            onOpenSettings={() => navigateTo('settings')}
            importVersion={inspirationImportVersion}
          />
        ) : null}
        {page === 'home' ? (
          <WorkspaceHomePage
            providerName={generationSelectedProvider.name}
            providerProfileName={activeGenerationProfile?.displayName ?? t('home.provider.noSavedProfile')}
            providerModelId={activeGenerationConfig.modelId || selectedModelId || t('home.provider.noModel')}
            selectedProviderId={selectedProviderId}
            isRealProviderReady={isRealProviderReady}
            secretAvailable={generationSecretAvailable}
            desktopRuntime={desktopRuntime}
            localComfyUIDiagnostic={localComfyUIDiagnostic}
            localComfyUIWorkflowStore={localComfyUIWorkflowStore}
            activeComfyUIWorkflowPreset={activeComfyUIWorkflowPreset}
            resultSummary={homeResultSummary}
            recentSuccessRecords={homeRecentSuccessRecords}
            recentFailureRecords={homeRecentFailureRecords}
            favoriteRecords={homeFavoriteRecords}
            referenceRecords={homeReferenceRecords}
            providerNameMap={homeProviderNameMap}
            homeModules={appSettings.homeModules}
              t={t}
            onNavigate={navigateTo}
            onUseRecordAsReference={useRecordAsReference}
            onOpenComfyUIWorkflowManager={() => setIsComfyUIWorkflowManagerOpen(true)}
          />
        ) : page === 'generate' ? (
          <>
            <ModernGeneratePage
              t={t}
              providers={providers}
              selectedProvider={generationSelectedProvider}
              selectedProviderId={selectedProviderId}
              supportsOpenAICompatible={generationSupportsOpenAICompatible}
              isRealProviderReady={isRealProviderReady}
              providerConfig={activeGenerationConfig}
              activeProfile={activeGenerationProfile ? {
                id: activeGenerationProfile.id,
                displayName: activeGenerationProfile.displayName,
                enabled: activeGenerationProfile.enabled,
                lastTestStatus: activeGenerationProfile.lastTestStatus,
                lastModelProbe: activeGenerationProfile.lastModelProbe
              } : null}
              providerProfiles={getProfilesForProvider(providerProfiles, selectedProviderId).map((profile) => ({
                id: profile.id,
                displayName: profile.displayName,
                modelId: profile.modelId,
                baseUrl: profile.baseUrl,
                enabled: profile.enabled,
                lastTestStatus: profile.lastTestStatus
              }))}
              activeProfileSecretAvailable={generationSecretAvailable}
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
              defaultReferenceRole={appSettings.generationDefaults.defaultReferenceRole}
              promptHistorySettings={appSettings.promptHistory}
              promptPolishSettings={appSettings.promptPolish}
              sessionStartedAtMs={generateSessionStartedAt}
              onProviderChange={selectProvider}
              onProfileChange={selectGenerationProfile}
              onModelChange={changeGenerationModel}
              onPromptChange={setPrompt}
              onCountChange={setCount}
              onSizeChange={setSize}
              onQualityChange={setQuality}
              onGenerate={runCreativeDeskGenerate}
              onAddToBatchQueue={handleAddCurrentGenerationToBatchQueue}
              onAddBatchVariantsToBatchQueue={handleAddBatchVariantsToBatchQueue}
              onAddCompareGroupToBatchQueue={handleAddCompareGroupToBatchQueue}
              batchQueueTaskCount={batchQueueAggregate.total}
              batchQueueCurrentName={activeBatchQueue?.name}
              batchQueueCurrentTaskCount={activeBatchQueueSummary?.total ?? 0}
              batchQueueCurrentPendingCount={activeBatchQueueSummary?.pending ?? 0}
              onOpenBatchQueue={() => navigateTo('batch')}
              onPreview={setGeneratePreviewUrl}
              onReloadHistory={loadHistory}
              onOpenLibrary={() => navigateTo('library')}
              onDeleteResult={removeResult}
              onRequestConfirm={requestConfirm}
              referenceImages={referenceImages}
              onReferenceImagesChange={setReferenceImages}
            />
            {generatePreviewUrl ? (
              <ImagePreviewModal t={t} imageUrl={generatePreviewUrl} onClose={() => setGeneratePreviewUrl(null)} />
            ) : null}
          </>
        ) : page === 'batch' ? (
          <BatchQueuePage
            t={t}
            queues={batchQueueStore.queues}
            results={results}
            templates={batchQueueTemplates}
            activeQueueId={activeBatchQueueId}
            executingTaskId={executingBatchTaskId}
            runningQueueId={runningBatchQueueId}
            runProgress={batchQueueRunProgress}
            onPreview={openLibraryPreview}
            onNavigate={navigateTo}
            onSelectQueue={selectActiveBatchQueue}
            onCreateQueue={requestCreateBatchQueue}
            onRenameQueue={requestRenameBatchQueue}
            onDeleteQueue={requestDeleteBatchQueue}
            onRefresh={refreshBatchQueueStore}
            onStartQueue={requestStartBatchQueue}
            onStopQueue={requestStopBatchQueue}
            onExecuteTask={requestExecuteBatchQueueTask}
            onCancelTask={requestCancelBatchQueueTask}
            onRequeueTask={requestRequeueBatchQueueTask}
            onRequeueFailedTasks={requestRequeueFailedBatchQueueTasks}
            onDeleteTask={requestDeleteBatchQueueTask}
            onSaveTemplate={requestSaveActiveBatchQueueTemplate}
            onApplyTemplate={requestApplyBatchQueueTemplate}
            onDeleteTemplate={requestDeleteBatchQueueTemplate}
          />
        ) : page === 'free' ? (
          <FreeGenerationPage
            t={t}
            prompt={prompt}
            onCopyPrompt={copyPromptForPlatform}
            onOpenPlatform={openPlatform}
            onCopyPromptAndOpen={copyPromptAndOpenPlatform}
            onImportWebResult={importWebResultFromPlatform}
          />
        ) : page === 'providers' ? (
          <ProviderSettingsPage
            t={t}
            providers={providers}
            selectedProvider={selectedProvider}
            selectedProviderId={selectedProvider.id}
            generationProviderId={selectedProviderId}
            platformOptions={providerPlatformOptions}
            selectedPlatformType={selectedPlatformType}
            serviceTemplates={getProviderServiceTemplatesForPlatform(selectedPlatformType)}
            selectedServiceTemplate={selectedServiceTemplate}
            isSelectedServiceConfigurable={isSelectedServiceConfigurable}
            desktopRuntime={desktopRuntime}
            secretAvailable={secretAvailable}
            secretDraft={secretDraft}
            providerConfig={providerConfig}
            providerProfiles={selectedProviderProfiles}
            selectedProfileId={selectedProfileId}
            configActionState={configActionState}
            isSavingSecret={isSavingSecret}
            isRefreshingModels={isRefreshingModels}
            isProbingModel={isProbingModel}
            supportsOpenAICompatible={supportsOpenAICompatible}
            supportsModelList={selectedProviderSupportsModelList}
            onPlatformTypeChange={selectPlatformType}
            onServiceTemplateChange={selectServiceTemplate}
            onSecretDraftChange={setSecretDraft}
            onSaveSecret={saveActiveProviderSecret}
            onConfigChange={handleConfigChange}
            onRefreshModels={refreshModels}
            onProbeModel={probeCurrentModel}
            onSaveConfig={() => saveCurrentProviderConfig(true)}
            onSaveOnly={() => saveCurrentProviderConfig(false)}
            onNewProfile={startNewProviderProfile}
            onSelectProfile={selectProviderProfile}
            onDeleteProfile={deleteCurrentProviderProfile}
            onToggleProfile={toggleProviderProfile}
            onRunDiagnostics={runProviderDiagnostics}
            onRunProfileConnectionTest={runProviderProfileConnectionTest}
            onRunTestGeneration={runProviderTestGeneration}
            onCopyConfig={copyCurrentProviderConfig}
            onCopyDiagnostics={copyProviderDiagnosticsReport}
            onImportConfig={importProviderConfigFromClipboard}
            onPinModel={pinCurrentModelAsDefault}
            isRunningDiagnostics={isRunningDiagnostics}
            isRunningTestGeneration={isRunningTestGeneration}
            diagnostics={providerDiagnostics}
            localComfyUIConfig={localComfyUIConfig}
            localComfyUIDiagnostic={localComfyUIDiagnostic}
            localComfyUIWorkflowStore={localComfyUIWorkflowStore}
            localComfyUIWorkflowError={localComfyUIWorkflowError}
            localSdWebUIConfig={localSdWebUIConfig}
            localSdWebUIDiagnostic={localSdWebUIDiagnostic}
            onLocalComfyUIBaseUrlChange={updateLocalComfyUIBaseUrl}
            onRunLocalComfyUIDiagnostics={runLocalComfyUIDiagnostics}
            onLocalSdWebUIBaseUrlChange={updateLocalSdWebUIBaseUrl}
            onRunLocalSdWebUIDiagnostics={runLocalSdWebUIDiagnostics}
            onImportLocalComfyUIWorkflow={importLocalComfyUIWorkflow}
            onClearLocalComfyUIWorkflow={clearLocalComfyUIWorkflow}
            onToggleComfyUIWorkflowManager={() => setIsComfyUIWorkflowManagerOpen(true)}
          />
        ) : page === 'settings' ? (
          <SettingsPage
            appVersion={APP_VERSION}
            appSettings={appSettings}
            providers={providers}
            desktopRuntime={desktopRuntime}
            storageSettings={storageSettings}
            t={t}
            promptPolishDraft={promptPolishDraft}
            promptPolishSecretDraft={promptPolishSecretDraft}
            promptPolishSecretAvailable={promptPolishSecretAvailable}
            isSavingPromptPolishSecret={isSavingPromptPolishSecret}
            isRefreshingPromptPolishModels={isRefreshingPromptPolishModels}
            imageReverseDraft={imageReverseDraft}
            imageReverseSecretDraft={imageReverseSecretDraft}
            imageReverseSecretAvailable={imageReverseSecretAvailable}
            isSavingImageReverseSecret={isSavingImageReverseSecret}
            isRefreshingImageReverseModels={isRefreshingImageReverseModels}
            onSettingsChange={updateAppSettings}
            onPromptPolishDraftChange={updatePromptPolishDraft}
            onSavePromptPolishConfig={savePromptPolishConfig}
            onRefreshPromptPolishModels={refreshPromptPolishModels}
            onPromptPolishSecretDraftChange={setPromptPolishSecretDraft}
            onSavePromptPolishSecret={savePromptPolishSecret}
            onImageReverseDraftChange={updateImageReverseDraft}
            onSaveImageReverseConfig={saveImageReverseConfig}
            onRefreshImageReverseModels={refreshImageReverseModels}
            onImageReverseSecretDraftChange={setImageReverseSecretDraft}
            onSaveImageReverseSecret={saveImageReverseSecret}
            onSelectLibraryPath={selectLibraryDirectory}
            onResetLibraryPath={resetLibraryDirectoryOverride}
            onOpenLibraryDirectory={openLibraryDirectory}
            onSelectInspirationPath={selectInspirationDirectory}
            onResetInspirationPath={resetInspirationDirectoryOverride}
            onOpenInspirationDirectory={openInspirationDirectory}
            onOpenAppDataDirectory={openAppDataDirectory}
            onOpenBackupsDirectory={openBackupsDirectory}
            onExportSettingsBackup={exportCurrentSettingsBackup}
            onExportMigrationGuide={exportMigrationGuide}
            onOpenSystemInfo={() => setActiveUtilityModal('system-info')}
            onOpenShortcuts={() => setActiveUtilityModal('shortcuts')}
            onCheckUpdates={checkForUpdates}
            systemTheme={systemTheme}
          />
        ) : page === 'library' ? (
          null
        ) : page === 'inspiration' ? (
          null
        ) : page === 'templates' ? (
          <PromptTemplatesPage
            t={t}
            onUseTemplate={(templatePrompt) => {
              setPrompt(templatePrompt);
              navigateTo('generate');
            }}
          />
        ) : null}
      </main>

      {activeUtilityModal === 'shortcuts' ? (
        <ShortcutsModal t={t} onClose={() => setActiveUtilityModal(null)} />
      ) : null}
      {activeUtilityModal === 'system-info' ? (
        <SystemInfoModal
          t={t}
          appVersion={APP_VERSION}
          desktopRuntime={desktopRuntime}
          storageSettings={storageSettings}
          settingsMessage={settingsMessage}
          onClose={() => setActiveUtilityModal(null)}
        />
      ) : null}
      {isComfyUIWorkflowManagerOpen ? (
        <ComfyUIWorkflowManagerModal
          t={t}
          store={localComfyUIWorkflowStore}
          onClose={() => setIsComfyUIWorkflowManagerOpen(false)}
          onSelect={(presetId) => {
            const nextStore = { ...localComfyUIWorkflowStore, activeId: presetId };
            setLocalComfyUIWorkflowStore(nextStore);
            saveLocalComfyUIWorkflowStore(nextStore);
          }}
          onDelete={(presetId) => {
            const nextPresets = localComfyUIWorkflowStore.presets.filter((preset: LocalComfyUIWorkflowPreset) => preset.id !== presetId);
            const nextStore = {
              activeId: localComfyUIWorkflowStore.activeId === presetId ? nextPresets[0]?.id ?? null : localComfyUIWorkflowStore.activeId,
              presets: nextPresets
            };
            setLocalComfyUIWorkflowStore(nextStore);
            saveLocalComfyUIWorkflowStore(nextStore);
          }}
        />
      ) : null}
      {confirmDialog ? (
        <ConfirmDialog
          t={t}
          request={confirmDialog}
          onClose={() => setConfirmDialog(null)}
          onError={(error) => setConfirmDialog((current) => (current ? { ...current, error } : current))}
        />
      ) : null}
      {batchQueueNameDialog ? (
        <BatchQueueNameDialog
          t={t}
          mode={batchQueueNameDialog.mode}
          defaultName={batchQueueNameDialog.defaultName}
          onClose={() => setBatchQueueNameDialog(null)}
          onSubmit={(name) => submitBatchQueueName(batchQueueNameDialog, name)}
        />
      ) : null}
      {toasts.length ? (
        <div className="toastViewport" aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => (
            <div className={`appToast ${toast.level}`} key={toast.id}>
              <span />
              <p>{toast.message}</p>
              <button type="button" aria-label={t('common.closeNotification')} onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProviderSettingsPage(props: {
  t: Translator;
  providers: ReturnType<typeof listProviders>;
  selectedProvider: ReturnType<typeof listProviders>[number];
  selectedProviderId: string;
  generationProviderId: string;
  platformOptions: ProviderPlatformOption[];
  selectedPlatformType: ProviderPlatformType;
  serviceTemplates: ProviderServiceTemplate[];
  selectedServiceTemplate: ProviderServiceTemplate;
  isSelectedServiceConfigurable: boolean;
  desktopRuntime: boolean;
  secretAvailable: boolean;
  secretDraft: string;
  providerConfig: OpenAICompatibleConfig;
  providerProfiles: ProviderConnectionProfile[];
  selectedProfileId: string | null;
  configActionState: 'idle' | 'saving' | 'saved' | 'failed';
  isSavingSecret: boolean;
  isRefreshingModels: boolean;
  isProbingModel: boolean;
  supportsOpenAICompatible: boolean;
  supportsModelList: boolean;
  onPlatformTypeChange: (platformType: ProviderPlatformType) => void;
  onServiceTemplateChange: (templateId: string) => void;
  onSecretDraftChange: (secret: string) => void;
  onSaveSecret: () => void;
  onConfigChange: <K extends keyof OpenAICompatibleConfig>(key: K, value: OpenAICompatibleConfig[K]) => void;
  onRefreshModels: () => void;
  onProbeModel: () => void;
  onSaveConfig: () => void;
  onSaveOnly: () => void;
  onNewProfile: () => void;
  onSelectProfile: (profileId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onToggleProfile: (profileId: string, enabled: boolean) => void;
  onRunDiagnostics: () => void;
  onRunProfileConnectionTest: (profileId: string) => void;
  onRunTestGeneration: () => void;
  onCopyConfig: () => void;
  onCopyDiagnostics: () => void;
  onImportConfig: () => void;
  onPinModel: () => void;
  localComfyUIConfig: LocalComfyUIConfig;
  localComfyUIDiagnostic: LocalComfyUIDiagnosticState;
  localComfyUIWorkflowStore: LocalComfyUIWorkflowStore;
  localComfyUIWorkflowError: string;
  localSdWebUIConfig: LocalSdWebUIConfig;
  localSdWebUIDiagnostic: LocalSdWebUIDiagnosticState;
  onLocalComfyUIBaseUrlChange: (baseUrl: string) => void;
  onRunLocalComfyUIDiagnostics: () => void;
  onLocalSdWebUIBaseUrlChange: (baseUrl: string) => void;
  onRunLocalSdWebUIDiagnostics: () => void;
  onImportLocalComfyUIWorkflow: (file: File | null) => void;
  onClearLocalComfyUIWorkflow: () => void;
  onToggleComfyUIWorkflowManager: () => void;
  isRunningDiagnostics: boolean;
  isRunningTestGeneration: boolean;
  diagnostics: ProviderDiagnosticItem[];
}) {
  const [profileFilter, setProfileFilter] = useState<ProviderProfileFilter>('all');
  const diagnosticsSummary = {
    pass: props.diagnostics.filter((item) => item.level === 'pass').length,
    warn: props.diagnostics.filter((item) => item.level === 'warn').length,
    fail: props.diagnostics.filter((item) => item.level === 'fail').length,
    info: props.diagnostics.filter((item) => item.level === 'info').length
  };
  const pt = (key: string, params?: Record<string, string | number>) => props.t(key as Parameters<Translator>[0], params);
  const providerPlatformLabel = (platformType: ProviderPlatformType) => pt(`provider.platform.${platformType}.label`);
  const providerPlatformDescription = (platformType: ProviderPlatformType) => pt(`provider.platform.${platformType}.description`);
  const providerServiceTemplateLabel = (template: ProviderServiceTemplate) => pt(`provider.service.${template.id}.label`);
  const providerServiceTemplateDescription = (template: ProviderServiceTemplate) => pt(`provider.service.${template.id}.description`);
  const providerServiceTemplateNotes = (template: ProviderServiceTemplate) => template.notes.map((_, index) => pt(`provider.service.${template.id}.note${index}`));
  const providerServiceStatusText = (status: ProviderServiceTemplateStatus) => pt(`provider.status.${status}`);
  const providerServiceRegionText = (region: ProviderServiceRegion) => pt(`provider.region.${region}`);
  const providerMatrixStatusText = (status: ProviderMatrixStatus) => pt(`provider.matrixStatus.${status}`);
  const providerMatrixColumnLabel = (key: ProviderMatrixCapabilityKey) => pt(`provider.matrixColumn.${key}`);
  const providerMatrixStatusDetail = (template: ProviderServiceTemplate, status: ProviderMatrixStatus, columnLabel: string) => {
    if (status === 'unsupported') {
      return pt('provider.matrixDetail.unsupported', { service: providerServiceTemplateLabel(template), column: columnLabel });
    }
    return pt(`provider.matrixDetail.${status}`, { column: columnLabel });
  };
  const providerProfileFilterLabel = (filter: ProviderProfileFilter) => pt(`provider.profileFilter.${filter}`);
  const providerDiagnosticLevelLabel = (level: ProviderDiagnosticLevel) => pt(`provider.diagnosticLevel.${level}`);
  const selectedPlatform = props.platformOptions.find((item) => item.id === props.selectedPlatformType);
  const serviceTemplateOptions = props.serviceTemplates.map((template) => ({
    value: template.id,
    label: `${providerServiceRegionText(template.region)} · ${providerServiceTemplateLabel(template)}`,
    description: `${providerServiceStatusText(template.status)} · ${providerServiceTemplateDescription(template)}`
  }));
  const localizedMatrixColumns = providerMatrixColumnKeys.map((key) => ({ key, label: providerMatrixColumnLabel(key) }));
  const providerMatrixRows = props.serviceTemplates.map((template) => ({
    template,
    cells: localizedMatrixColumns.map((column) => getProviderCapabilityMatrixCell(template, column, props.providers))
  }));
  const [isCapabilityMatrixOpen, setIsCapabilityMatrixOpen] = useState(false);
  const [isReadinessOpen, setIsReadinessOpen] = useState(false);
  const activeProfile = props.providerProfiles.find((profile) => profile.id === props.selectedProfileId) ?? null;
  const isGenerationProviderSelected = props.selectedProviderId === props.generationProviderId;
  const generationProfile = isGenerationProviderSelected
    ? props.providerProfiles.find((profile) => profile.enabled) ?? props.providerProfiles[0] ?? null
    : null;
  const generationProfileSummary = !isGenerationProviderSelected
    ? pt('provider.generation.otherPlatform')
    : generationProfile
      ? pt('provider.generation.usingProfile', { name: generationProfile.displayName })
      : pt('provider.generation.noConfig');
  const usesProviderProfiles = props.isSelectedServiceConfigurable && props.selectedServiceTemplate.platformType !== 'local';
  const profileFilterOptions = buildProviderProfileFilterOptions(props.providerProfiles, props.t);
  const filteredProviderProfiles = props.providerProfiles.filter((profile) => matchesProviderProfileFilter(profile, profileFilter));
  const visibleProviderProfiles = usesProviderProfiles ? filteredProviderProfiles : [];
  const readinessItems = buildProviderReadinessItems({
    profile: activeProfile,
    config: props.providerConfig,
    providerId: props.selectedProviderId,
    desktopRuntime: props.desktopRuntime,
    secretAvailable: props.secretAvailable,
    serviceConfigurable: props.isSelectedServiceConfigurable,
    supportsOpenAICompatible: props.supportsOpenAICompatible,
    t: props.t
  });
  const offlineDiagnosticItems = [
    ...readinessItems,
    buildGenerationUsageReadinessItem({
      profile: activeProfile,
      generationProfile,
      selectedProviderId: props.selectedProviderId,
      generationProviderId: props.generationProviderId,
      t: props.t
    })
  ];
  const offlineDiagnosticSummary = buildOfflineDiagnosticSummary({
    profile: activeProfile,
    config: props.providerConfig,
    desktopRuntime: props.desktopRuntime,
    secretAvailable: props.secretAvailable,
    generationProfile,
    selectedProviderId: props.selectedProviderId,
    generationProviderId: props.generationProviderId,
    t: props.t
  });
  const protocolOptions = (['images', 'images-minimal', 'responses', 'chat-completions', 'custom-images'] as OpenAICompatibleConfig['protocol'][]).map((protocol) => ({
    value: protocol,
    label: pt(`provider.protocol.${protocol}.label`),
    description: pt(`provider.protocol.${protocol}.description`)
  }));
  const imageToImageAdapterOptions = IMAGE_TO_IMAGE_ADAPTERS.map((adapter) => ({
    value: adapter,
    label: pt(`provider.i2i.${adapter}.label`),
    description: pt(`provider.i2i.${adapter}.description`)
  }));
  const resolvedImageToImageAdapter = resolveImageToImageAdapterForDisplay(props.providerConfig, props.selectedProviderId);
  const imageToImageAdapterDiagnosticText = pt('provider.i2i.diagnosticText', {
    prefix: props.providerConfig.imageToImageAdapter === 'auto'
      ? pt('provider.i2i.autoPrefix', { adapter: pt(`provider.i2i.${resolvedImageToImageAdapter}.label`) })
      : pt('provider.i2i.fixedPrefix', { adapter: pt(`provider.i2i.${resolvedImageToImageAdapter}.label`) }),
    field: pt(`provider.i2i.${resolvedImageToImageAdapter}.field`)
  });
  const workflowFileInputRef = useRef<HTMLInputElement | null>(null);
  const isComfyUITemplate = props.selectedServiceTemplate.id === 'local-comfyui';
  const isSdWebUITemplate = props.selectedServiceTemplate.id === 'local-sd-webui';
  const comfyUIResult = props.localComfyUIDiagnostic.result;
  const sdWebUIResult = props.localSdWebUIDiagnostic.result;
  const activeWorkflowPreset = props.localComfyUIWorkflowStore.presets.find((item) => item.id === props.localComfyUIWorkflowStore.activeId) ?? props.localComfyUIWorkflowStore.presets[0] ?? null;
  const comfyUIStatusLabel: Record<LocalModelDiagnosticStatus, string> = {
    idle: pt('provider.local.status.idle'),
    checking: pt('provider.local.status.checking'),
    online: pt('provider.local.status.online'),
    offline: pt('provider.local.status.offline'),
    failed: pt('provider.local.status.failed')
  };

  return (
    <>
      <header className="topbar providerAccessTopbar">
        <div className="pageTitleBlock">
          <p className="eyebrow">{pt('provider.eyebrow')}</p>
          <h1>{pt('provider.title')}</h1>
          <p>{pt('provider.subtitle')}</p>
        </div>
      </header>

      <section className="settingsLayout providerAccessLayout">
        <div className="providerDirectory">
          <div className="providerAccessControls">
            <div>
              <span className="providerPickerLabel">{pt('provider.platformType')}</span>
              <div className="segmentedControl providerTypeSwitch">
                {props.platformOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={option.id === props.selectedPlatformType ? 'active' : ''}
                    onClick={() => props.onPlatformTypeChange(option.id)}
                  >
                    {providerPlatformLabel(option.id)}
                  </button>
                ))}
              </div>
              <small>{selectedPlatform ? providerPlatformDescription(selectedPlatform.id) : ''}</small>
            </div>
            <label className="providerPickerLabel">
              {pt('provider.serviceTemplate')}
              <StudioSelect
                value={props.selectedServiceTemplate.id}
                onChange={props.onServiceTemplateChange}
                options={serviceTemplateOptions}
                className="providerPickerSelect"
              />
            </label>
          </div>
          <div className="profileListHeader">
            <div>
              <strong>{pt('provider.profileInstances')}</strong>
              <small>{pt('provider.profileCount', { count: props.providerProfiles.length })} · {generationProfileSummary}</small>
            </div>
            <button
              type="button"
              className="miniButton profileAddButton"
              onClick={props.onNewProfile}
              disabled={!usesProviderProfiles}
            >
              <Plus size={14} /> {pt('provider.addProfile')}
            </button>
          </div>
          <div className="providerProfileFilters" aria-label={pt('provider.profileFilterAria')}>
            {profileFilterOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                className={profileFilter === option.id ? 'active' : ''}
                onClick={() => setProfileFilter(option.id)}
              >
                <span>{providerProfileFilterLabel(option.id)}</span>
                <strong>{option.count}</strong>
              </button>
            ))}
          </div>
          <div className="profileList">
            {!usesProviderProfiles ? (
              <div className="profileEmpty">
                <strong>{props.selectedServiceTemplate.platformType === 'local' ? pt('provider.localEndpointConfig') : providerServiceStatusText(props.selectedServiceTemplate.status)}</strong>
                <span>{props.selectedServiceTemplate.platformType === 'local' ? pt('provider.localEndpointHint') : pt('provider.plannedTemplateHint')}</span>
              </div>
            ) : props.providerProfiles.length === 0 ? (
              <div className="profileEmpty">
                <strong>{pt('provider.noProfilesTitle')}</strong>
                <span>{pt('provider.noProfilesHint')}</span>
              </div>
            ) : visibleProviderProfiles.length === 0 ? (
              <div className="profileEmpty">
                <strong>{pt('provider.noMatchedProfilesTitle')}</strong>
                <span>{pt('provider.noMatchedProfilesHint')}</span>
              </div>
            ) : (
              visibleProviderProfiles.map((profile) => (
                <article
                  className={`profileCard ${profile.id === props.selectedProfileId ? 'selected' : ''}`}
                  key={profile.id}
                  onClick={() => props.onSelectProfile(profile.id)}
                >
                  <div className="profileAvatar">{profile.displayName.slice(0, 1).toUpperCase()}</div>
                  <div className="profileMain">
                    <div className="profileTitleRow">
                      <strong>{profile.displayName}</strong>
                      <span className={`profileStatus ${profile.lastTestStatus}`}>{pt(`provider.profileStatus.${profile.lastTestStatus}`)}</span>
                    </div>
                    <small>{profile.baseUrl.replace(/^https?:\/\//, '')} · {profile.modelId}</small>
                    <div className="profileMeta">
                      <span>{protocolLabel(profile.protocol, props.t)}</span>
                      {generationProfile?.id === profile.id ? <span className="activeUse">{pt('provider.profile.activeUse')}</span> : null}
                      {profile.lastLatencyMs ? <span>{profile.lastLatencyMs} ms</span> : null}
                      {profile.enabled ? <span className="enabled">{pt('provider.profile.enabled')}</span> : <span>{pt('provider.profile.disabled')}</span>}
                    </div>
                    <div className="profileModelSummary">
                      {typeof profile.lastModelCount === 'number' ? <span>{pt('provider.profile.modelCount', { count: profile.lastModelCount })}</span> : <span>{pt('provider.profile.modelNotRefreshed')}</span>}
                      {typeof profile.lastImageModelCount === 'number' ? <span>{pt('provider.profile.imageModelCount', { count: profile.lastImageModelCount })}</span> : null}
                      {profile.lastModelProbe ? (
                        <span className={profile.lastModelProbe.available ? 'matched' : 'missing'}>
                          {profile.lastModelProbe.available ? pt('provider.profile.modelMatched') : pt('provider.profile.modelMissing')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="profileActions" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className="iconMiniButton"
                      data-tooltip={pt('provider.action.testLatency')}
                      aria-label={pt('provider.action.testLatency')}
                      onClick={() => {
                        void props.onRunProfileConnectionTest(profile.id);
                      }}
                    >
                      <Gauge size={13} />
                    </button>
                    <button
                      type="button"
                      className="iconMiniButton"
                      data-tooltip={pt('provider.action.editProfile')}
                      aria-label={pt('provider.action.editProfile')}
                      onClick={() => props.onSelectProfile(profile.id)}
                    >
                      <Pencil size={13} />
                    </button>
                    <button type="button" className="iconMiniButton dangerMiniButton" data-tooltip={pt('provider.action.deleteProfile')} aria-label={pt('provider.action.deleteProfile')} onClick={() => props.onDeleteProfile(profile.id)}>
                      <Trash2 size={13} />
                    </button>
                    <button
                      type="button"
                      className={`profileSwitch ${profile.enabled ? 'on' : ''}`}
                      data-tooltip={profile.enabled ? pt('provider.action.disableProfile') : pt('provider.action.enableProfile')}
                      aria-label={profile.enabled ? pt('provider.action.disableProfile') : pt('provider.action.enableProfile')}
                      onClick={() => props.onToggleProfile(profile.id, !profile.enabled)}
                    >
                      <span />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="settingsPanel">
          {isComfyUITemplate ? (
            <div className="localLabBox">
              <div className="providerConfigHeader">
                <div>
                  <strong>{pt('provider.local.comfy.diagnosticsTitle')}</strong>
                  <small>{pt('provider.local.comfy.diagnosticsHint')}</small>
                </div>
                <span className={`serviceStatusBadge localDiagnostic-${props.localComfyUIDiagnostic.status}`}>
                  {comfyUIStatusLabel[props.localComfyUIDiagnostic.status]}
                </span>
              </div>
              <ServiceTemplateMeta template={props.selectedServiceTemplate} t={props.t} />
              <div className="localLabNotice">
                <HardDrive size={18} />
                <div>
                  <strong>{pt('provider.local.labMvp')}</strong>
                  <span>{pt('provider.local.comfy.mvpHint')}</span>
                </div>
              </div>
              <label>
                {pt('provider.localEndpointConfig')}
                <div className="localEndpointRow">
                  <input
                    value={props.localComfyUIConfig.baseUrl}
                    onChange={(event) => props.onLocalComfyUIBaseUrlChange(event.target.value)}
                    placeholder={DEFAULT_COMFYUI_BASE_URL}
                  />
                  <button
                    type="button"
                    className="iconButton"
                    onClick={props.onRunLocalComfyUIDiagnostics}
                    disabled={!props.desktopRuntime || props.localComfyUIDiagnostic.status === 'checking'}
                    title={pt('provider.local.comfy.testTitle')}
                    aria-label={pt('provider.local.comfy.testTitle')}
                  >
                    <Gauge size={15} /> {props.localComfyUIDiagnostic.status === 'checking' ? pt('provider.local.testing') : pt('provider.local.testConnection')}
                  </button>
                </div>
                <small className="providerFieldHint">
                  {pt('provider.local.comfy.defaultHint', { url: DEFAULT_COMFYUI_BASE_URL })}
                </small>
              </label>
              {props.localComfyUIDiagnostic.error ? (
                <div className="localDiagnosticMessage failed">{props.localComfyUIDiagnostic.error}</div>
              ) : comfyUIResult ? (
                <section className={`localDiagnosticMessage ${comfyUIResult.online ? 'online' : 'offline'}`}>
                  <strong>{comfyUIResult.message}</strong>
                  <span>{comfyUIResult.resolvedBaseUrl} · {comfyUIResult.latencyMs} ms</span>
                </section>
              ) : (
                <div className="localDiagnosticMessage idle">{pt('provider.local.comfy.idleHint')}</div>
              )}
              {comfyUIResult ? (
                <div className="localDiagnosticStats">
                  <span>{pt('provider.local.nodes', { count: comfyUIResult.objectInfoNodeCount ?? '-' })}</span>
                  <span>{pt('provider.local.running', { count: comfyUIResult.queueRunning ?? '-' })}</span>
                  <span>{pt('provider.local.pending', { count: comfyUIResult.queuePending ?? '-' })}</span>
                </div>
              ) : null}
              {comfyUIResult ? (
                <div className="localEndpointList">
                  {comfyUIResult.endpoints.map((endpoint) => (
                    <div className={`localEndpointItem ${endpoint.ok ? 'pass' : 'fail'}`} key={endpoint.path}>
                      <span>{endpoint.ok ? pt('provider.diagnosticLevel.pass') : pt('provider.diagnosticLevel.fail')}</span>
                      <div>
                        <strong>{endpoint.path}{endpoint.status ? ` · HTTP ${endpoint.status}` : ''}</strong>
                        <small>{endpoint.detail}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <section className="localWorkflowBox" aria-label={pt('provider.local.comfy.workflowPreviewAria')}>
                <div className="localWorkflowHeader">
                  <div>
                    <strong>Workflow JSON</strong>
                    <small>{pt('provider.local.comfy.workflowHint')}</small>
                  </div>
                  <div className="localWorkflowActions">
                    <input
                      ref={workflowFileInputRef}
                      type="file"
                      accept=".json,application/json"
                      className="hiddenFileInput"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        void props.onImportLocalComfyUIWorkflow(file);
                        event.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      className="miniButton"
                      onClick={() => workflowFileInputRef.current?.click()}
                    >
                      <Upload size={14} /> {pt('provider.local.importJson')}
                    </button>
                    {props.localComfyUIWorkflowStore.presets.length ? (
                      <button type="button" className="miniButton" onClick={props.onToggleComfyUIWorkflowManager}>
                        <Layers size={14} /> {pt('provider.local.manager')}
                      </button>
                    ) : null}
                    {props.localComfyUIWorkflowStore.presets.length ? (
                      <button type="button" className="miniButton" onClick={props.onClearLocalComfyUIWorkflow}>
                        <X size={14} /> {pt('provider.local.clear')}
                      </button>
                    ) : null}
                  </div>
                </div>
                {props.localComfyUIWorkflowError ? (
                  <div className="localDiagnosticMessage failed">{props.localComfyUIWorkflowError}</div>
                ) : null}
                {activeWorkflowPreset ? (
                  <ComfyUIWorkflowSummaryPanel preset={activeWorkflowPreset} t={props.t} />
                ) : (
                  <div className="localDiagnosticMessage idle">
                    {pt('provider.local.comfy.workflowEmpty')}
                  </div>
                )}
              </section>
              <div className="serviceTemplateNotes">
                {providerServiceTemplateNotes(props.selectedServiceTemplate).map((note) => (
                  <span key={note}>{note}</span>
                ))}
              </div>
            </div>
          ) : isSdWebUITemplate ? (
            <div className="localLabBox">
              <div className="providerConfigHeader">
                <div>
                  <strong>{pt('provider.local.sd.diagnosticsTitle')}</strong>
                  <small>{pt('provider.local.sd.diagnosticsHint')}</small>
                </div>
                <span className={`serviceStatusBadge localDiagnostic-${props.localSdWebUIDiagnostic.status}`}>
                  {comfyUIStatusLabel[props.localSdWebUIDiagnostic.status]}
                </span>
              </div>
              <ServiceTemplateMeta template={props.selectedServiceTemplate} t={props.t} />
              <div className="localLabNotice">
                <HardDrive size={18} />
                <div>
                  <strong>{pt('provider.local.sd.sliceTitle')}</strong>
                  <span>{pt('provider.local.sd.sliceHint')}</span>
                </div>
              </div>
              <label>
                {pt('provider.localEndpointConfig')}
                <div className="localEndpointRow">
                  <input
                    value={props.localSdWebUIConfig.baseUrl}
                    onChange={(event) => props.onLocalSdWebUIBaseUrlChange(event.target.value)}
                    placeholder={DEFAULT_SD_WEBUI_BASE_URL}
                  />
                  <button
                    type="button"
                    className="iconButton"
                    onClick={props.onRunLocalSdWebUIDiagnostics}
                    disabled={!props.desktopRuntime || props.localSdWebUIDiagnostic.status === 'checking'}
                    title={pt('provider.local.sd.testTitle')}
                    aria-label={pt('provider.local.sd.testTitle')}
                  >
                    <Gauge size={15} /> {props.localSdWebUIDiagnostic.status === 'checking' ? pt('provider.local.testingEllipsis') : pt('provider.local.testConnection')}
                  </button>
                </div>
                <small className="providerFieldHint">
                  {pt('provider.local.sd.defaultHint', { url: DEFAULT_SD_WEBUI_BASE_URL })}
                </small>
              </label>
              {props.localSdWebUIDiagnostic.error ? (
                <div className="localDiagnosticMessage failed">{props.localSdWebUIDiagnostic.error}</div>
              ) : sdWebUIResult ? (
                <section className={`localDiagnosticMessage ${sdWebUIResult.online ? 'online' : 'offline'}`}>
                  <strong>{sdWebUIResult.message}</strong>
                  <span>{sdWebUIResult.resolvedBaseUrl} - {sdWebUIResult.latencyMs} ms</span>
                </section>
              ) : (
                <div className="localDiagnosticMessage idle">{pt('provider.local.sd.idleHint')}</div>
              )}
              {sdWebUIResult ? (
                <div className="localDiagnosticStats">
                  <span>{pt('provider.local.currentModel', { model: sdWebUIResult.sdModelCheckpoint ?? '-' })}</span>
                  <span>{pt('provider.local.samplers', { count: sdWebUIResult.samplerCount ?? '-' })}</span>
                  <span>{pt('provider.local.models', { count: sdWebUIResult.modelCount ?? '-' })}</span>
                </div>
              ) : null}
              {sdWebUIResult ? (
                <div className="localEndpointList">
                  {sdWebUIResult.endpoints.map((endpoint) => (
                    <div className={`localEndpointItem ${endpoint.ok ? 'pass' : 'fail'}`} key={endpoint.path}>
                      <span>{endpoint.ok ? pt('provider.diagnosticLevel.pass') : pt('provider.diagnosticLevel.fail')}</span>
                      <div>
                        <strong>{endpoint.path}{endpoint.status ? ` - HTTP ${endpoint.status}` : ''}</strong>
                        <small>{endpoint.detail}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="localLabNotice">
                <Sparkles size={18} />
                <div>
                  <strong>{pt('provider.local.sd.usageTitle')}</strong>
                  <span>{pt('provider.local.sd.usageHint')}</span>
                </div>
              </div>
              <div className="serviceTemplateNotes">
                {providerServiceTemplateNotes(props.selectedServiceTemplate).map((note) => (
                  <span key={note}>{note}</span>
                ))}
              </div>
            </div>
          ) : props.isSelectedServiceConfigurable && props.supportsOpenAICompatible ? (
            <div className="relayBox standalone">
              <div className="providerConfigHeader">
                <div>
                  <strong>{pt('provider.configDetails')}</strong>
                  <small>{providerServiceTemplateLabel(props.selectedServiceTemplate)} · {providerServiceTemplateDescription(props.selectedServiceTemplate)}</small>
                </div>
                <span className={`serviceStatusBadge ${props.selectedServiceTemplate.status}`}>
                  {providerServiceStatusText(props.selectedServiceTemplate.status)}
                </span>
              </div>
              <ServiceTemplateMeta template={props.selectedServiceTemplate} t={props.t} />
              <div className="providerConfigHealth">
                <span>{activeProfile ? pt('provider.chip.configStatus', { status: pt(`provider.profileStatus.${activeProfile.lastTestStatus}`) }) : pt('provider.chip.configDraft')}</span>
                <span>{props.secretAvailable ? pt('provider.chip.secretConfigured') : pt('provider.chip.secretMissing')}</span>
                <span>{activeProfile?.lastModelProbe ? (activeProfile.lastModelProbe.available ? pt('provider.chip.modelMatched') : pt('provider.chip.modelMissing')) : pt('provider.chip.modelNotProbed')}</span>
              </div>
              <section className="providerOfflineDiagnostic" aria-label={pt('provider.offlineDiagnosticAria')}>
                <div className="providerOfflineDiagnosticSummary">
                  <span>{pt('provider.offlineDiagnostic')}</span>
                  <strong>{offlineDiagnosticSummary.title}</strong>
                  <small>{offlineDiagnosticSummary.detail}</small>
                </div>
                <div className="providerOfflineDiagnosticChips">
                  {offlineDiagnosticSummary.chips.map((chip) => (
                    <span className={chip.level} key={chip.label}>{chip.label}</span>
                  ))}
                </div>
              </section>
              <label>
                {pt('provider.field.name')}
                <input
                  value={props.providerConfig.displayName}
                  onChange={(event) => props.onConfigChange('displayName', event.target.value)}
                  placeholder={pt('provider.placeholder.profileName')}
                />
              </label>
              <label>
                Base URL
                <input
                  value={props.providerConfig.baseUrl}
                  onChange={(event) => props.onConfigChange('baseUrl', event.target.value)}
                  placeholder={defaultBaseUrlPlaceholder(props.selectedProviderId, props.t)}
                />
              </label>
              <label>
                API Key
                <div className="secretInputRow">
                  <input
                    type="password"
                    placeholder={props.desktopRuntime ? props.selectedProvider.auth.label : pt('provider.placeholder.desktopSecret')}
                    value={props.secretDraft}
                    onChange={(event) => props.onSecretDraftChange(event.target.value)}
                    disabled={!props.desktopRuntime}
                  />
                  <button
                    type="button"
                    className="iconButton secretSaveButton"
                    onClick={props.onSaveSecret}
                    disabled={!props.desktopRuntime || props.isSavingSecret || !props.secretDraft.trim()}
                    title={pt('provider.action.saveSecretTitle')}
                    aria-label={pt('provider.action.saveSecretTitle')}
                  >
                    {props.isSavingSecret ? pt('provider.action.saving') : pt('provider.action.saveSecret')}
                  </button>
                </div>
              </label>
              <p className="secretMessage">
                {pt('provider.secretStatus', { status: props.desktopRuntime ? (props.secretAvailable ? pt('provider.secret.configured') : pt('provider.secret.missing')) : pt('provider.secret.webPreview') })}
              </p>
              <label>
                {pt('provider.field.modelId')}
                <div className="modelPicker">
                  <input
                    list="provider-model-options"
                    value={props.providerConfig.modelId}
                    onChange={(event) => props.onConfigChange('modelId', event.target.value)}
                    placeholder={pt('provider.placeholder.modelId')}
                  />
                  <datalist id="provider-model-options">
                    {props.providerConfig.modelOptions.map((modelId) => (
                      <option value={modelId} key={modelId} />
                    ))}
                  </datalist>
                  <button
                    className="iconButton"
                    onClick={props.onRefreshModels}
                    disabled={props.isRefreshingModels || !props.supportsModelList}
                    title={props.supportsModelList ? pt('provider.action.refreshModels') : pt('provider.action.modelListUnsupported')}
                    aria-label={props.supportsModelList ? pt('provider.action.refreshModels') : pt('provider.action.modelListUnsupported')}
                  >
                    {props.isRefreshingModels ? '…' : pt('provider.action.refresh')}
                  </button>
                  <button
                    className="iconButton"
                    onClick={props.onProbeModel}
                    disabled={props.isProbingModel || props.isRefreshingModels || !props.supportsModelList}
                    title={props.supportsModelList ? pt('provider.action.probeModelTitle') : pt('provider.action.probeUnsupported')}
                    aria-label={props.supportsModelList ? pt('provider.action.probeModel') : pt('provider.action.probeUnsupported')}
                  >
                    {props.isProbingModel ? '…' : pt('provider.action.probe')}
                  </button>
                  <button className="iconButton" onClick={props.onPinModel} title={pt('provider.action.pinModel')} aria-label={pt('provider.action.pinModel')}>
                    {pt('provider.action.default')}
                  </button>
                </div>
              </label>

              <label>
                {pt('provider.field.protocol')}
                <StudioSelect
                  value={props.providerConfig.protocol}
                  onChange={(value) => props.onConfigChange('protocol', value as OpenAICompatibleConfig['protocol'])}
                  options={protocolOptions}
                />
              </label>
              <label>
                {pt('provider.field.i2iMapping')}
                <StudioSelect
                  value={props.providerConfig.imageToImageAdapter}
                  onChange={(value) => props.onConfigChange('imageToImageAdapter', value as ImageToImageAdapter)}
                  options={imageToImageAdapterOptions}
                />
                <small className="providerFieldHint">
                  {imageToImageAdapterDiagnosticText}
                </small>
              </label>
              <label>
                {pt('provider.field.endpointPath')}
                <input
                  value={props.providerConfig.endpointPath}
                  onChange={(event) => props.onConfigChange('endpointPath', event.target.value)}
                  placeholder={defaultEndpointPlaceholder(props.selectedProviderId, props.t)}
                />
                <small className="providerFieldHint">
                  {providerEndpointHint(props.selectedProviderId, props.t)}
                </small>
              </label>
              <label>
                {pt('provider.field.extraHeaders')}
                <input
                  value={props.providerConfig.extraHeadersJson}
                  onChange={(event) => props.onConfigChange('extraHeadersJson', event.target.value)}
                  placeholder='{"X-Trace":"visionhub"}'
                />
              </label>
              <div className="providerPrimaryActions">
                <button className="ghostButton relaySave" onClick={props.onSaveOnly}>
                  {pt('provider.action.save')}
                </button>
                <button className="ghostButton relaySave primaryAction" onClick={props.onSaveConfig}>
                  {props.configActionState === 'saving'
                    ? pt('provider.action.saving')
                    : props.configActionState === 'saved'
                      ? pt('provider.action.saved')
                      : props.configActionState === 'failed'
                        ? pt('provider.action.saveFailed')
                        : pt('provider.action.saveAndEnable')}
                </button>
                <button className="ghostButton" type="button" onClick={props.onCopyConfig}>
                  <Copy size={15} /> {pt('provider.action.copyConfig')}
                </button>
                <button className="ghostButton" type="button" onClick={props.onImportConfig}>
                  <ClipboardPaste size={15} /> {pt('provider.action.pasteConfig')}
                </button>
              </div>
              <div className="providerAuxToggles">
                <button
                  type="button"
                  className={`capabilityMatrixToggle readinessToggle ${isReadinessOpen ? 'open' : ''}`}
                  onClick={() => setIsReadinessOpen((value) => !value)}
                  aria-expanded={isReadinessOpen}
                >
                  <ChevronRight size={15} /> {isReadinessOpen ? pt('provider.action.collapseDiagnostics') : pt('provider.action.viewDiagnostics')}
                </button>
                <button
                  type="button"
                  className={`capabilityMatrixToggle ${isCapabilityMatrixOpen ? 'open' : ''}`}
                  onClick={() => setIsCapabilityMatrixOpen((value) => !value)}
                  aria-expanded={isCapabilityMatrixOpen}
                >
                  <ChevronRight size={15} /> {isCapabilityMatrixOpen ? pt('provider.action.collapseMatrix') : pt('provider.action.viewMatrix')}
                </button>
              </div>
              {isReadinessOpen ? (
                <section className="providerReadinessPanel" aria-label={pt('provider.readiness.aria')}>
                  <div className="providerReadinessHeader">
                    <strong>{pt('provider.readiness.title')}</strong>
                    <small>{pt('provider.readiness.hint')}</small>
                  </div>
                  <div className="providerReadinessGrid">
                    {offlineDiagnosticItems.map((item) => (
                      <div className={`providerReadinessItem ${item.level}`} key={item.id}>
                        <div>
                          <div className="providerReadinessTitleRow">
                            <strong>{item.label}</strong>
                            <span>{providerDiagnosticLevelLabel(item.level)}</span>
                          </div>
                          <small>{item.detail}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
              {isCapabilityMatrixOpen ? (
                <section className="providerCapabilityPanel expanded" aria-label={pt('provider.matrix.aria')}>
                  <div className="providerCapabilityHeaderBlock">
                    <div>
                      <strong>{pt('provider.matrix.title')}</strong>
                      <small>{pt('provider.matrix.hint')}</small>
                    </div>
                    <div className="providerCapabilityLegend" aria-label={pt('provider.matrix.legendAria')}>
                      {(['live', 'configurable', 'partial', 'planned', 'localPlan'] as ProviderMatrixStatus[]).map((status) => (
                        <span className={`capabilityCell ${status}`} key={status}>{providerMatrixStatusText(status)}</span>
                      ))}
                    </div>
                  </div>
                  <div className="providerCapabilityScroll">
                    <div className="providerCapabilityGrid providerCapabilityTableHead" role="row">
                      <span>{pt('provider.serviceTemplate')}</span>
                      {localizedMatrixColumns.map((column) => (
                        <span key={column.key}>{column.label}</span>
                      ))}
                    </div>
                    <div className="providerCapabilityRows">
                      {providerMatrixRows.map((row) => (
                        <button
                          type="button"
                          className={`providerCapabilityGrid providerCapabilityRow ${row.template.id === props.selectedServiceTemplate.id ? 'selected' : ''}`}
                          key={row.template.id}
                          onClick={() => props.onServiceTemplateChange(row.template.id)}
                          aria-pressed={row.template.id === props.selectedServiceTemplate.id}
                        >
                          <span className="providerCapabilityService">
                            <strong>{providerServiceTemplateLabel(row.template)}</strong>
                            <small>{providerServiceRegionText(row.template.region)} · {providerServiceStatusText(row.template.status)} · {providerServiceTemplateDescription(row.template)}</small>
                          </span>
                          {row.cells.map((cell, index) => (
                            <span
                              className={`capabilityCell ${cell.status}`}
                              title={pt('provider.matrix.cellTitle', {
                                column: localizedMatrixColumns[index].label,
                                status: providerMatrixStatusText(cell.status),
                                detail: providerMatrixStatusDetail(row.template, cell.status, localizedMatrixColumns[index].label)
                              })}
                              key={localizedMatrixColumns[index].key}
                            >
                              {providerMatrixStatusText(cell.status)}
                            </span>
                          ))}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}
              <div className="providerDiagnostics">
                <div className="diagnosticsHeader">
                  <div>
                    <strong>{pt('provider.diagnostics.title')}</strong>
                    <small>{pt('provider.diagnostics.hint')}</small>
                  </div>
                  <div className="diagnosticsActions">
                    <button
                      className="rowActionButton"
                      onClick={() => {
                        void props.onRunDiagnostics();
                      }}
                      disabled={props.isRunningDiagnostics}
                    >
                      <RefreshCcw size={15} /> {props.isRunningDiagnostics ? pt('provider.action.selfChecking') : pt('provider.action.runSelfCheck')}
                    </button>
                    <button className="rowActionButton" onClick={props.onCopyDiagnostics} disabled={!props.diagnostics.length} title={pt('provider.action.copyReportTitle')}>
                      <Copy size={15} /> {pt('provider.action.copyReport')}
                    </button>
                    <button
                      className="rowActionButton primaryAction"
                      onClick={props.onRunTestGeneration}
                      disabled={!props.desktopRuntime || !props.secretAvailable || props.isRunningTestGeneration || !props.isSelectedServiceConfigurable}
                      title={!props.secretAvailable ? pt('provider.action.needApiKey') : pt('provider.action.testGenerationTitle')}
                    >
                      <Sparkles size={15} /> {props.isRunningTestGeneration ? pt('provider.action.testing') : pt('provider.action.realTestGeneration')}
                    </button>
                  </div>
                </div>
                {props.diagnostics.length === 0 ? (
                  <p className="diagnosticsHint">{pt('provider.diagnostics.emptyHint')}</p>
                ) : (
                  <>
                    <div className="diagnosticsSummary">
                      <span className="pass">{pt('provider.summary.pass', { count: diagnosticsSummary.pass })}</span>
                      <span className="warn">{pt('provider.summary.warn', { count: diagnosticsSummary.warn })}</span>
                      <span className="fail">{pt('provider.summary.fail', { count: diagnosticsSummary.fail })}</span>
                      <span className="info">{pt('provider.summary.info', { count: diagnosticsSummary.info })}</span>
                    </div>
                    <div className="diagnosticsList">
                      {props.diagnostics.map((item) => (
                        <div className={`diagnosticsItem ${item.level}`} key={item.id}>
                          <span>{providerDiagnosticLevelLabel(item.level)}</span>
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
            </div>
          ) : (
            <div className="integrationBox">
              <strong>{pt('provider.integrationStatus')}</strong>
              <p>{providerServiceTemplateDescription(props.selectedServiceTemplate)}</p>
              <ServiceTemplateMeta template={props.selectedServiceTemplate} t={props.t} />
              <div className="serviceTemplateNotes">
                {providerServiceTemplateNotes(props.selectedServiceTemplate).map((note) => (
                  <span key={note}>{note}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function ServiceTemplateMeta({ template, t }: { template: ProviderServiceTemplate; t: Translator }) {
  const pt = (key: string, params?: Record<string, string | number>) => t(key as Parameters<Translator>[0], params);
  const capabilityLabels = [
    template.supportsTextToImage ? pt('provider.capability.textToImage') : null,
    template.supportsImageToImage ? pt('provider.capability.imageToImage') : null,
    template.requiresPolling ? pt('provider.capability.asyncTask') : null
  ].filter(Boolean);

  return (
    <div className="serviceTemplateMeta" aria-label={pt('provider.meta.aria')}>
      <span className={`regionBadge ${template.region}`}>{pt(`provider.region.${template.region}`)}</span>
      <span className={`serviceStatusBadge ${template.status}`}>{pt(`provider.status.${template.status}`)}</span>
      {capabilityLabels.length ? <span>{capabilityLabels.join(' / ')}</span> : <span>{pt('provider.capability.unknown')}</span>}
      {template.apiDocUrl ? (
        <span className="serviceDocHint">{pt('provider.meta.docRegistered')}</span>
      ) : null}
    </div>
  );
}

function providerServiceTemplateDisplayName(template: ProviderServiceTemplate, t?: Translator) {
  return t
    ? t(`provider.service.${template.id}.label` as Parameters<Translator>[0])
    : template.defaultDisplayName ?? template.label;
}

function createEmptyProviderDraftConfig(
  provider: ReturnType<typeof listProviders>[number],
  serviceTemplate?: ProviderServiceTemplate,
  t?: Translator
): OpenAICompatibleConfig {
  const isOfficialOpenAI = provider.id === 'openai-gpt-image';
  const isMiniMax = provider.id === 'minimax-image';
  const isGemini = provider.id === 'gemini-image';
  const firstModel = provider.models[0]?.id ?? '';
  return {
    ...defaultOpenAICompatibleConfig,
    displayName: serviceTemplate ? providerServiceTemplateDisplayName(serviceTemplate, t) : '',
    baseUrl: isOfficialOpenAI ? OFFICIAL_OPENAI_BASE_URL : isMiniMax ? 'https://api.minimaxi.com' : isGemini ? 'https://generativelanguage.googleapis.com' : '',
    modelId: firstModel,
    protocol: isMiniMax ? 'custom-images' : 'images',
    endpointPath: isMiniMax ? '/v1/image_generation' : isGemini ? '/v1beta/models/{model}:generateContent' : defaultEndpointForProtocol('images'),
    extraHeadersJson: '{}',
    modelOptions: provider.models.map((model) => model.id)
  };
}

function getProviderServiceTemplatesForPlatform(platformType: ProviderPlatformType) {
  return [...providerServiceTemplates]
    .filter((template) => template.platformType === platformType)
    .sort((a, b) =>
      providerServiceStatusRank[a.status] - providerServiceStatusRank[b.status] ||
      a.sortRank - b.sortRank ||
      a.label.localeCompare(b.label, 'zh-CN')
    );
}

function getProviderServiceTemplate(templateId: string) {
  return providerServiceTemplates.find((template) => template.id === templateId);
}

function isProviderServiceTemplateConfigurable(template: ProviderServiceTemplate) {
  return Boolean(template.providerId) && (template.status === 'connected' || template.status === 'configurable');
}

function getDefaultProviderServiceTemplateForProvider(providerId: string) {
  if (providerId === 'custom-http-provider') return getProviderServiceTemplate('aggregator-openai-compatible');
  if (providerId === 'openai-gpt-image') return getProviderServiceTemplate('official-openai');
  if (providerId === 'minimax-image') return getProviderServiceTemplate('official-minimax');
  if (providerId === 'gemini-image') return getProviderServiceTemplate('official-gemini');
  if (providerId === 'sd-webui-local') return getProviderServiceTemplate('local-sd-webui');
  return providerServiceTemplates.find((template) => template.providerId === providerId);
}

function providerProfileBelongsToTemplate(
  profile: ProviderConnectionProfile,
  template: ProviderServiceTemplate
) {
  if (!template.providerId || profile.providerId !== template.providerId) return false;
  if (profile.serviceTemplateId) return profile.serviceTemplateId === template.id;
  return template.id === 'aggregator-openai-compatible' || template.id === 'official-openai' || template.id === 'official-minimax' || template.id === 'official-gemini' || template.id === 'local-sd-webui';
}

function providerGenerationLabel(provider: ReturnType<typeof listProviders>[number], t: Translator) {
  const template = getDefaultProviderServiceTemplateForProvider(provider.id);
  if (!template) return provider.name;
  const platformLabel = t(`provider.platform.${template.platformType}.label` as Parameters<Translator>[0]);
  const serviceLabel = t(`provider.service.${template.id}.label` as Parameters<Translator>[0]);
  return `${platformLabel} · ${serviceLabel}`;
}

type ProviderProfileFilter = 'all' | 'enabled' | 'passed' | 'warning' | 'failed' | 'untested';

function buildProviderProfileFilterOptions(profiles: ProviderConnectionProfile[], t: Translator) {
  const counts: Record<ProviderProfileFilter, number> = {
    all: profiles.length,
    enabled: profiles.filter((profile) => profile.enabled).length,
    passed: profiles.filter((profile) => profile.lastTestStatus === 'passed').length,
    warning: profiles.filter((profile) => profile.lastTestStatus === 'warning').length,
    failed: profiles.filter((profile) => profile.lastTestStatus === 'failed').length,
    untested: profiles.filter((profile) => profile.lastTestStatus === 'untested').length
  };
  const ids: ProviderProfileFilter[] = ['all', 'enabled', 'passed', 'warning', 'failed', 'untested'];
  return ids.map((id) => ({
    id,
    label: t(`provider.profileFilter.${id}` as Parameters<Translator>[0]),
    count: counts[id]
  }));
}

function matchesProviderProfileFilter(profile: ProviderConnectionProfile, filter: ProviderProfileFilter) {
  if (filter === 'all') return true;
  if (filter === 'enabled') return profile.enabled;
  return profile.lastTestStatus === filter;
}

function safeProviderConfigText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isProviderConnectionProfileLike(value: unknown): value is ProviderConnectionProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<ProviderConnectionProfile>;
  return typeof candidate.id === 'string' && typeof candidate.providerId === 'string';
}

function ensureManualModelOption(config: OpenAICompatibleConfig): OpenAICompatibleConfig {
  const modelId = config.modelId.trim();
  if (!modelId || config.modelOptions.includes(modelId)) return config;
  return {
    ...config,
    modelOptions: [modelId, ...config.modelOptions]
  };
}

function countLikelyImageModels(modelIds: string[]) {
  return modelIds.filter((id) => /image|img|flux|sd|seedream|gpt-image|dall|wanx|qwen-image/i.test(id)).length;
}

function buildModelProbe(modelId: string, modelOptions: string[], source: string, t?: Translator) {
  const normalizedModelId = modelId.trim();
  const available = Boolean(normalizedModelId) && modelOptions.includes(normalizedModelId);
  const checkedAt = new Date().toISOString();
  const fallbackModel = normalizedModelId || (t ? t('provider.diagnostics.value.notFilled') : 'not filled');
  return {
    modelId: normalizedModelId,
    available,
    checkedAt,
    message: available
      ? t
        ? t('provider.diagnostics.detail.modelProbeAvailable', { model: normalizedModelId, source })
        : `Current model "${normalizedModelId}" appears in the provider model list. ${source}`
      : modelOptions.length
        ? t
          ? t('provider.diagnostics.detail.modelProbeMissing', { model: fallbackModel, source })
          : `Current model "${fallbackModel}" does not appear in the model list; the model ID may be wrong or the relay may hide image models. ${source}`
        : t
          ? t('provider.diagnostics.detail.modelProbeEmpty', { model: fallbackModel, source })
          : `Model list is empty. Kept current manual model "${fallbackModel}". ${source}`
  };
}
