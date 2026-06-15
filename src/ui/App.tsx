import {
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Clock3,
  Copy,
  Database,
  Download,
  ExternalLink,
  FolderOpen,
  Gauge,
  Gift,
  Globe2,
  Grid2X2,
  HardDrive,
  Image,
  ImagePlus,
  Info,
  Keyboard,
  Layers,
  Maximize2,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Sidebar,
  Sparkles,
  Bookmark,
  SlidersHorizontal,
  Star,
  Sun,
  Moon,
  Trash2,
  Upload,
  Wand2,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import type { InspirationAsset } from '../domain/inspirationTypes';
import type { GenerationRecord, ImageGenerationResult, ImageToImageAdapter, ProviderCapabilityStatus, ReferenceImage } from '../domain/providerTypes';
import { listProviders } from '../providers/registry';
import {
  chooseInspirationDir,
  chooseLibraryDir,
  deleteProviderSecret,
  diagnoseComfyUIConnection,
  getProviderSecretStatus,
  exportSettingsBackup,
  generateComfyUIImage,
  generateOpenAIImage,
  getStorageSettings,
  importLibraryImagesFromFiles,
  importLibraryImagesFromFolder,
  loadLibraryData,
  recheckBackgroundGeneration,
  revealAppDataDir,
  isTauriRuntime,
  listOpenAICompatibleModels,
  openExternalUrl,
  revealGenerationFile,
  revealInspirationDir,
  revealLibraryDir,
  saveGenerationRecord,
  saveLibraryData,
  saveProviderSecret,
  saveTextFileWithDialog,
  saveStorageSettings,
  type LibraryDataPayload,
  type ComfyUIDiagnosisResult,
  type StorageSettings
} from '../services/desktopApi';
import { diagnoseGenerationFailure, type GenerationFailureCategory, type GenerationFailureSeverity } from '../services/generationErrorDiagnostics';
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
  DEFAULT_COUNT_OPTIONS,
  DEFAULT_QUALITY_OPTIONS,
  DEFAULT_REFERENCE_ROLE_OPTIONS,
  DEFAULT_SIZE_OPTIONS,
  FILE_NAMING_RULE_OPTIONS,
  GENERATOR_ACCENT_OPTIONS,
  getRecommendedGlobalAccent,
  LANGUAGE_OPTIONS,
  promptPolishConfigId,
  OUTPUT_FORMAT_OPTIONS,
  PRIMARY_ACCENT_OPTIONS,
  PROMPT_HISTORY_LIMIT_OPTIONS,
  PROMPT_POLISH_ENGINE_OPTIONS,
  PROMPT_POLISH_LANGUAGE_OPTIONS,
  PROMPT_POLISH_PROTOCOL_OPTIONS,
  PROMPT_POLISH_SECRET_ID,
  PROMPT_POLISH_STRENGTH_OPTIONS,
  REFRESH_INTERVAL_OPTIONS,
  STARTUP_PAGE_OPTIONS,
  loadAppSettings,
  saveAppSettings,
  type AppPage,
  type AppSettings,
  type GenerationDefaults,
  type HomeModuleSettings,
  type PromptHistorySettings,
  type PromptPolishSettings,
  type ThemeMode
} from '../services/appSettings';
import { getPolishModesForEngine, resolvePolishMode } from '../services/promptAssist';
import {
  PROMPT_TEMPLATE_CATEGORIES,
  createPromptTemplate,
  loadPromptTemplates,
  savePromptTemplates,
  type PromptTemplateCategory,
  type PromptTemplate
} from '../services/promptTemplates';
import { importInspirationAsset } from '../services/inspirationApi';
import { FREE_PLATFORMS, buildFreePlatformPrompt, type FreePlatform } from '../services/freePlatforms';
import { readStorageValue, writeStorageValue } from '../services/safeStorage';
import { useStudioStore } from '../store/useStudioStore';
import { ModernGeneratePage } from './GeneratePage';
import { InspirationPage } from './InspirationPage';
import { StudioSelect } from './StudioSelect';
import type { ConfirmDialogRequest } from './confirmDialog';
import { appToastEventName, defaultToastDurationMs, useToastMessage, type ToastEventDetail, type ToastLevel } from './toast';

const APP_VERSION = '0.3.7';

type Page = AppPage;
type ProviderDiagnosticLevel = 'pass' | 'warn' | 'fail' | 'info';
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
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
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

type LibraryTimeFilter = 'all' | 'today' | '7d' | '30d';
type LibraryViewMode = 'masonry' | 'adaptive' | 'square' | 'contain' | 'list';
type LibrarySortMode = 'newest' | 'oldest' | 'favorites' | 'provider' | 'model' | 'duration' | 'size' | 'filename';
type LibraryQuickFilter = 'favorites' | 'recent7d' | 'references' | 'failed' | 'local';
type LibraryShapeFilter = 'all' | 'landscape' | 'portrait' | 'square' | 'wide' | 'tall' | 'four-three' | 'three-four' | 'sixteen-nine' | 'nine-sixteen' | 'custom';
type LibraryFormatFilter = 'all' | 'png' | 'jpg' | 'gif' | 'webp' | 'svg' | 'unknown';
type LibraryRatingFilter = 'all' | 'unrated' | '1' | '2' | '3' | '4' | '5';
type LibraryColorFilter = 'all' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink' | 'mono';
type LibraryModeFilter = 'all' | 'text-to-image' | 'image-to-image' | 'with-references';
type ProviderDiagnosticItem = {
  id: string;
  label: string;
  detail: string;
  level: ProviderDiagnosticLevel;
};
type ProviderDiagnosticsReportContext = {
  platformLabel: string;
  serviceLabel: string;
  providerName: string;
  profileName?: string;
  profileId?: string | null;
  modelId?: string;
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
  label: string;
  detail: string;
};
type LibraryMetaEntry = {
  favorite?: boolean;
  tags?: string[];
  folderId?: string;
  collectionIds?: string[];
  note?: string;
  rating?: number;
  colorPalette?: string[];
  colorFamilies?: LibraryColorFilter[];
  imageSize?: string;
  colorAnalyzedAt?: string;
  colorAnalysisFailed?: boolean;
  lastViewedAt?: string;
  lastUsedAsReferenceAt?: string;
};
type LibraryMetaMap = Record<string, LibraryMetaEntry>;
type LibraryDisplaySettings = {
  showPrompt: boolean;
  showProvider: boolean;
  showModel: boolean;
  showFailed: boolean;
  showReferenceBadge: boolean;
  compact: boolean;
};
type LibraryCustomQuickFilterCriteria = {
  query?: string;
  providerFilter?: string;
  statusFilter?: 'all' | 'succeeded' | 'failed';
  modeFilter?: LibraryModeFilter;
  timeFilter?: LibraryTimeFilter;
  colorFilter?: LibraryColorFilter;
  shapeFilter?: LibraryShapeFilter;
  formatFilter?: LibraryFormatFilter;
  ratingFilter?: LibraryRatingFilter;
};
type LibraryCustomQuickFilter = {
  id: string;
  label: string;
  criteria: LibraryCustomQuickFilterCriteria;
  createdAt: string;
};
type LibraryFolder = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};
type LibraryCollection = {
  id: string;
  name: string;
  description?: string;
  coverRecordId?: string;
  createdAt: string;
};
type LibraryOrganization = {
  folders: LibraryFolder[];
  collections: LibraryCollection[];
};
type LibraryScope =
  | { type: 'all' }
  | { type: 'favorites' }
  | { type: 'recent7d' }
  | { type: 'local' }
  | { type: 'folder'; id: string }
  | { type: 'collection'; id: string };
type LibraryOrganizerDialogState = {
  type: 'folder' | 'collection';
  mode: 'create' | 'rename';
  defaultName: string;
  targetId?: string;
};
type LibraryAssignDialogState = {
  type: 'folder' | 'collection';
  recordIds: string[];
};
type LibraryAddAction = 'folder' | 'collection' | 'import-file' | 'batch-folder';
type LibraryContextMenuState = {
  x: number;
  y: number;
  recordId: string;
};
type ImagePreviewNavigationItem = {
  id: string;
  imageUrl: string;
  label: string;
};
type ImagePreviewNavigation = {
  items: ImagePreviewNavigationItem[];
  currentId: string;
};
type ImagePreviewState = {
  imageUrl: string;
  navigation?: ImagePreviewNavigation;
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
type LocalComfyUIWorkflowFormat = 'api' | 'ui' | 'unknown';
type LocalComfyUIWorkflowNodeRole = 'prompt' | 'sampler' | 'checkpoint' | 'size' | 'output' | 'loader' | 'other';
type LocalComfyUIWorkflowNode = {
  id: string;
  type: string;
  title?: string;
  role: LocalComfyUIWorkflowNodeRole;
  summary: string;
};
type LocalComfyUIWorkflowSummary = {
  fileName: string;
  importedAt: string;
  format: LocalComfyUIWorkflowFormat;
  nodeCount: number;
  linkCount: number | null;
  promptNodes: LocalComfyUIWorkflowNode[];
  samplerNodes: LocalComfyUIWorkflowNode[];
  checkpointNodes: LocalComfyUIWorkflowNode[];
  sizeNodes: LocalComfyUIWorkflowNode[];
  outputNodes: LocalComfyUIWorkflowNode[];
  loaderNodes: LocalComfyUIWorkflowNode[];
  otherKeyNodes: LocalComfyUIWorkflowNode[];
  warnings: string[];
};
type LocalComfyUIWorkflowPreset = {
  id: string;
  name: string;
  summary: LocalComfyUIWorkflowSummary;
  rawWorkflow?: unknown;
  createdAt: string;
  updatedAt: string;
};
type LocalComfyUIWorkflowStore = {
  activeId: string | null;
  presets: LocalComfyUIWorkflowPreset[];
};

const LIBRARY_META_STORAGE_KEY = 'visionhub.library.meta.v1';
const LIBRARY_DISPLAY_STORAGE_KEY = 'visionhub.library.display.v1';
const LIBRARY_CUSTOM_QUICK_FILTERS_STORAGE_KEY = 'visionhub.library.customQuickFilters.v1';
const LIBRARY_ORGANIZATION_STORAGE_KEY = 'visionhub.library.organization.v1';
const LOCAL_COMFYUI_CONFIG_STORAGE_KEY = 'visionhub.local.comfyui.config.v1';
const LOCAL_COMFYUI_WORKFLOW_STORAGE_KEY = 'visionhub.local.comfyui.workflow.v1';
const DEFAULT_COMFYUI_BASE_URL = 'http://127.0.0.1:8188';
const LOCAL_COMFYUI_DIAGNOSTIC_TIMEOUT_MS = 12_000;

const providerPlatformOptions: ProviderPlatformOption[] = [
  {
    id: 'aggregator',
    label: '中转站 / 聚合 API',
    description: '默认主入口，适合中转站、聚合站和 OpenAI-compatible 服务。'
  },
  {
    id: 'official',
    label: '官方 API',
    description: '官方服务商入口；当前只有 OpenAI 官方已接入真实生图。'
  },
  {
    id: 'local',
    label: '本地模型',
    description: '本地工作流规划区，暂不影响在线中转站使用。'
  }
];

const providerServiceTemplates: ProviderServiceTemplate[] = [
  {
    id: 'aggregator-openai-compatible',
    platformType: 'aggregator',
    label: 'OpenAI 兼容中转',
    description: '当前真实可用。适合把 GPT Image、Nano Banana、Qwen、豆包、Grok、Midjourney、可灵等包装成 OpenAI-compatible 的中转站。',
    status: 'connected',
    region: 'custom',
    sortRank: 10,
    providerId: 'custom-http-provider',
    defaultDisplayName: 'OpenAI 兼容中转',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['Base URL、模型 ID、协议路径以服务商文档为准。', '旧的中转站配置会自动归到这里，profile id 不会变化。']
  },
  {
    id: 'aggregator-generic-api',
    platformType: 'aggregator',
    label: '聚合网站 API',
    description: '通用聚合站模板；能保存配置，图片能力取决于服务商实际支持。',
    status: 'configurable',
    region: 'custom',
    sortRank: 20,
    providerId: 'custom-http-provider',
    defaultDisplayName: '聚合网站 API',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['适合没有明确品牌模板的聚合 API。', '保存前请按服务商文档填写 Base URL、模型 ID 和协议。']
  },
  {
    id: 'siliconflow',
    platformType: 'aggregator',
    label: '硅基流动',
    description: '国内主流聚合站候选；先作为可配置模板，图片能力待按实际模型验证。',
    status: 'configurable',
    region: 'domestic',
    sortRank: 30,
    providerId: 'custom-http-provider',
    defaultDisplayName: '硅基流动',
    apiDocUrl: 'https://docs.siliconflow.cn/',
    supportsTextToImage: true,
    supportsImageToImage: false,
    notes: ['可保存连接配置；图片模型和 OpenAI-compatible 兼容程度以服务商为准。']
  },
  {
    id: 'aggregator-custom',
    platformType: 'aggregator',
    label: '其他聚合站',
    description: '通用自定义模板，适合其他 OpenAI-compatible 聚合 API。',
    status: 'configurable',
    region: 'custom',
    sortRank: 90,
    providerId: 'custom-http-provider',
    defaultDisplayName: '其他聚合站',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['保留最大手动配置空间，适合服务商文档比较特殊的场景。']
  },
  {
    id: 'official-openai',
    platformType: 'official',
    label: 'OpenAI 官方',
    description: '当前真实可用；仅用于 https://api.openai.com。',
    status: 'connected',
    region: 'overseas',
    sortRank: 10,
    providerId: 'openai-gpt-image',
    defaultDisplayName: 'OpenAI 官方',
    apiDocUrl: 'https://platform.openai.com/docs/guides/images',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['ChatGPT Plus 网页额度不等于 API 额度。', '旧官方 OpenAI 配置会自动归到这里，profile id 不会变化。']
  },
  {
    id: 'official-minimax',
    platformType: 'official',
    label: 'MiniMax 官方',
    description: '国内官方 API V4 第一批；支持按官方图片接口接入文生图。',
    status: 'configurable',
    region: 'domestic',
    sortRank: 20,
    providerId: 'minimax-image',
    defaultDisplayName: 'MiniMax 官方',
    apiDocUrl: 'https://platform.minimaxi.com/',
    supportsTextToImage: true,
    supportsImageToImage: false,
    notes: ['使用 MiniMax 官方 Bearer API Key，独立于中转站 Key。', '当前先接入 image-01 / image-01-live 文生图，图生图后续补。']
  },
  {
    id: 'official-mimo',
    platformType: 'official',
    label: '小米 MiMo 官方',
    description: '国内主流候选；先核验是否开放文生图 / 图生图 API endpoint。',
    status: 'planned',
    region: 'domestic',
    sortRank: 30,
    apiDocUrl: 'https://mimo.xiaomi.com/',
    supportsTextToImage: false,
    supportsImageToImage: false,
    notes: ['MiMo 官网有 API Access 入口，但需确认图片生成 API 是否公开。', '确认前只展示候选说明，不开放真实生图。']
  },
  {
    id: 'official-gemini',
    platformType: 'official',
    label: 'Google Gemini / Nano Banana 官方',
    description: '待接入；当前只展示规划，不允许保存启用或真实试生图。',
    status: 'planned',
    region: 'overseas',
    sortRank: 40,
    apiDocUrl: 'https://ai.google.dev/gemini-api/docs/image-generation',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['后续需要单独实现官方 API adapter、鉴权和图片返回解析。']
  },
  {
    id: 'official-xai',
    platformType: 'official',
    label: 'xAI 官方',
    description: '待接入；当前只展示规划，不允许保存启用或真实试生图。',
    status: 'planned',
    region: 'overseas',
    sortRank: 50,
    apiDocUrl: 'https://docs.x.ai/docs/guides/image-generations',
    supportsTextToImage: true,
    supportsImageToImage: false,
    notes: ['后续按官方图片接口能力接入。']
  },
  {
    id: 'official-volcengine',
    platformType: 'official',
    label: '火山方舟 / Seedream 官方',
    description: '待接入；当前只展示规划，不允许保存启用或真实试生图。',
    status: 'planned',
    region: 'domestic',
    sortRank: 60,
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['后续需要接入火山鉴权、模型参数和结果落盘链路。']
  },
  {
    id: 'official-bailian',
    platformType: 'official',
    label: '阿里百炼 / 通义万相官方',
    description: '待接入；当前只展示规划，不允许保存启用或真实试生图。',
    status: 'planned',
    region: 'domestic',
    sortRank: 70,
    apiDocUrl: 'https://help.aliyun.com/zh/model-studio/',
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['后续需要接入官方鉴权与异步任务轮询。']
  },
  {
    id: 'official-kling',
    platformType: 'official',
    label: '可灵企业 API',
    description: '待接入；当前只展示规划，不允许保存启用或真实试生图。',
    status: 'planned',
    region: 'domestic',
    sortRank: 80,
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['后续可作为图像 / 视频生成企业 API 路线。']
  },
  {
    id: 'official-jimeng',
    platformType: 'official',
    label: '即梦企业 API',
    description: '待接入；当前只展示规划，不允许保存启用或真实试生图。',
    status: 'planned',
    region: 'domestic',
    sortRank: 90,
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['后续可作为国内官方企业 API 路线。']
  },
  {
    id: 'local-comfyui',
    platformType: 'local',
    label: 'ComfyUI',
    description: '本地 ComfyUI 已支持连接诊断、API workflow 导入和 AI 创作台最小文生图测试。',
    status: 'local-plan',
    region: 'local',
    sortRank: 10,
    providerId: 'comfyui-local',
    supportsTextToImage: true,
    supportsImageToImage: false,
    requiresPolling: true,
    notes: ['先支持 ComfyUI API workflow；UI workflow 需要从 ComfyUI 重新导出 API 格式。', '当前 MVP 会自动写入 Prompt、负面提示词、尺寸和 Seed。']
  },
  {
    id: 'local-sd-webui',
    platformType: 'local',
    label: 'Stable Diffusion WebUI / Forge',
    description: '本地主流候选；V4 后续先做连接诊断和 txt2img。',
    status: 'local-plan',
    region: 'local',
    sortRank: 20,
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['后续接入本地 endpoint、采样器、尺寸和 ControlNet 参数。']
  }
];

const providerServiceStatusLabel: Record<ProviderServiceTemplateStatus, string> = {
  connected: '已接入',
  configurable: '可配置',
  planned: '待接入',
  'local-plan': '本地规划'
};

const providerServiceRegionLabel: Record<ProviderServiceRegion, string> = {
  domestic: '国内',
  overseas: '国外',
  local: '本地',
  custom: '自定义'
};

const providerServiceStatusRank: Record<ProviderServiceTemplateStatus, number> = {
  connected: 0,
  configurable: 1,
  'local-plan': 2,
  planned: 3
};

const providerMatrixStatusLabel: Record<ProviderMatrixStatus, string> = {
  live: '已接入',
  configurable: '可配置',
  partial: '部分',
  planned: '待接入',
  localPlan: '本地规划',
  unsupported: '不支持',
  unknown: '待确认'
};

const providerMatrixColumns: Array<{ key: ProviderMatrixCapabilityKey; label: string }> = [
  { key: 'textToImage', label: '文生图' },
  { key: 'imageToImage', label: '图生图' },
  { key: 'multiReferenceImage', label: '多参考' },
  { key: 'imagesApi', label: 'Images' },
  { key: 'responsesApi', label: 'Responses' },
  { key: 'openAICompatible', label: '兼容中转' },
  { key: 'officialProtocol', label: '官方协议' },
  { key: 'localService', label: '本地服务' }
];

const defaultLibraryDisplaySettings: LibraryDisplaySettings = {
  showPrompt: true,
  showProvider: true,
  showModel: true,
  showFailed: false,
  showReferenceBadge: true,
  compact: false
};

const libraryViewOptions: Array<{ value: LibraryViewMode; label: string }> = [
  { value: 'masonry', label: '瀑布流' },
  { value: 'adaptive', label: '自适应' },
  { value: 'square', label: '正方形' },
  { value: 'contain', label: '完整宽高比' },
  { value: 'list', label: '列表视图' }
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
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
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
  const summary = summarizeApiWorkflowInputs(inputs, summaryKeysByRole[role]) || '已识别节点，后续映射时可展开查看完整字段。';
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
  if (!promptNodes.length) warnings.push('未识别到文本提示词节点，后续需要手动指定 Prompt 写入位置。');
  if (!samplerNodes.length) warnings.push('未识别到采样器节点，后续真实生成前需要手动确认任务入口。');
  if (!outputNodes.length) warnings.push('未识别到保存或预览图片节点，后续需要确认输出结果读取方式。');
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
    throw new Error('workflow JSON 顶层不是对象，无法识别。');
  }
  const apiSummary = parseComfyUIApiWorkflow(fileName, record);
  if (apiSummary) return apiSummary;
  const uiSummary = parseComfyUIUiWorkflow(fileName, record);
  if (uiSummary) return uiSummary;
  return buildComfyUIWorkflowSummary(fileName, 'unknown', [], null);
}

function workflowFormatLabel(format: LocalComfyUIWorkflowFormat) {
  if (format === 'api') return 'API Workflow';
  if (format === 'ui') return 'UI Workflow';
  return '未知格式';
}

function comfyUIWorkflowRunStatus(preset: LocalComfyUIWorkflowPreset) {
  if (preset.summary.format === 'api' && preset.rawWorkflow) return '可用于创作台生成';
  if (preset.summary.format === 'api') return '旧记录需重新导入';
  if (preset.summary.format === 'ui') return '需导出 API workflow';
  return '暂不可生成';
}

const librarySortOptions: Array<{ value: LibrarySortMode; label: string }> = [
  { value: 'newest', label: '最新优先' },
  { value: 'oldest', label: '最早优先' },
  { value: 'favorites', label: '收藏优先' },
  { value: 'provider', label: '平台分组' },
  { value: 'model', label: '模型分组' },
  { value: 'duration', label: '生成耗时' },
  { value: 'size', label: '图片尺寸' },
  { value: 'filename', label: '文件名' }
];

const libraryQuickFilters: Array<{ value: LibraryQuickFilter; label: string }> = [
  { value: 'favorites', label: '收藏' },
  { value: 'recent7d', label: '最近 7 天' },
  { value: 'references', label: '有参考图' },
  { value: 'local', label: '本地已落盘' }
];

const libraryShapeOptions: Array<{ value: LibraryShapeFilter; label: string }> = [
  { value: 'all', label: '全部形状' },
  { value: 'landscape', label: '横图' },
  { value: 'portrait', label: '竖图' },
  { value: 'square', label: '方形' },
  { value: 'wide', label: '细长横图' },
  { value: 'tall', label: '细长竖图' },
  { value: 'four-three', label: '4:3' },
  { value: 'three-four', label: '3:4' },
  { value: 'sixteen-nine', label: '16:9' },
  { value: 'nine-sixteen', label: '9:16' },
  { value: 'custom', label: '自定义' }
];

const libraryFormatOptions: Array<{ value: LibraryFormatFilter; label: string }> = [
  { value: 'all', label: '全部格式' },
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
  { value: 'gif', label: 'GIF' },
  { value: 'svg', label: 'SVG' },
  { value: 'unknown', label: '未知格式' }
];

const libraryRatingOptions: Array<{ value: LibraryRatingFilter; label: string }> = [
  { value: 'all', label: '全部评分' },
  { value: '5', label: '★★★★★' },
  { value: '4', label: '★★★★☆' },
  { value: '3', label: '★★★☆☆' },
  { value: '2', label: '★★☆☆☆' },
  { value: '1', label: '★☆☆☆☆' },
  { value: 'unrated', label: '尚未评分' }
];

const libraryRatingValues = [1, 2, 3, 4, 5] as const;

const libraryColorOptions: Array<{ value: LibraryColorFilter; label: string; color: string }> = [
  { value: 'all', label: '全部颜色', color: '#64748b' },
  { value: 'red', label: '红色', color: '#ef4444' },
  { value: 'orange', label: '橙色', color: '#f97316' },
  { value: 'yellow', label: '黄色', color: '#eab308' },
  { value: 'green', label: '绿色', color: '#22c55e' },
  { value: 'cyan', label: '青色', color: '#06b6d4' },
  { value: 'blue', label: '蓝色', color: '#3b82f6' },
  { value: 'purple', label: '紫色', color: '#8b5cf6' },
  { value: 'pink', label: '粉色', color: '#ec4899' },
  { value: 'mono', label: '黑白', color: '#64748b' }
];

const libraryAddActions: Array<{ id: LibraryAddAction; label: string; detail: string }> = [
  { id: 'folder', label: '新建文件夹', detail: '后续会用于整理本地作品。' },
  { id: 'collection', label: '新建收藏集', detail: '适合按项目、风格或客户归档。' },
  { id: 'import-file', label: '导入本地图片', detail: '索引单张或多张本地图片，不移动原文件。' },
  { id: 'batch-folder', label: '批量导入文件夹', detail: '扫描所选文件夹内图片，不移动原文件。' }
];

const libraryFolderColors = ['#14b8a6', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#22c55e'];

function isPotentialBackgroundCompletion(record: Pick<GenerationRecord, 'status' | 'error' | 'raw'>) {
  return diagnoseGenerationFailure(record).isPotentialBackgroundCompletion;
}

function generationStatusLabel(record: Pick<GenerationRecord, 'status' | 'error' | 'raw'>) {
  if (record.status === 'succeeded') return '成功';
  if (isPotentialBackgroundCompletion(record)) return '待核查';
  if (record.status === 'running') return '生成中';
  if (record.status === 'queued') return '排队中';
  if (record.status === 'cancelled') return '已取消';
  return '失败';
}

function generationStatusClass(record: Pick<GenerationRecord, 'status' | 'error' | 'raw'>) {
  return isPotentialBackgroundCompletion(record) ? 'pendingRecovery' : record.status;
}

function generationFailureHint(record: Pick<GenerationRecord, 'status' | 'error' | 'raw'>) {
  const diagnosis = diagnoseGenerationFailure(record);
  return `${diagnosis.title}：${diagnosis.summary}`;
}

function generationFailureActions(record: Pick<GenerationRecord, 'status' | 'error' | 'raw' | 'generationMode' | 'referenceImages' | 'modelId' | 'providerId'>) {
  return diagnoseGenerationFailure(record).actions;
}

function generationFailureDetails(record: Pick<GenerationRecord, 'status' | 'error' | 'raw' | 'generationMode' | 'referenceImages' | 'modelId' | 'providerId'>) {
  return diagnoseGenerationFailure(record).details;
}

const generationFailureCategoryLabels: Record<GenerationFailureCategory, string> = {
  auth: '认证',
  permission: '权限',
  quota: '额度',
  'rate-limit': '限流',
  protocol: '协议',
  model: '模型',
  parameter: '参数',
  'content-safety': '安全',
  'timeout-background': '后台待核查',
  server: '服务商',
  network: '网络',
  'response-format': '响应格式',
  'no-image': '无图片',
  unknown: '待确认'
};

const generationFailureSeverityLabels: Record<GenerationFailureSeverity, string> = {
  error: '阻断',
  warning: '警告',
  info: '提示'
};

function safeStringifyDiagnosticRaw(raw: unknown) {
  if (raw == null) return '';
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

function clipDiagnosticText(text: string, maxLength = 1400) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n…已截断，复制 Raw 可查看完整内容。`;
}

function generationFailureRawText(record: Pick<GenerationRecord, 'error' | 'raw' | 'status' | 'generationMode' | 'referenceImages' | 'modelId' | 'providerId'>) {
  const diagnosis = diagnoseGenerationFailure(record);
  return safeStringifyDiagnosticRaw(record.raw) || diagnosis.rawMessage || record.error || '';
}

function generationFailureCopyText(record: GenerationRecord, providerName?: string) {
  const diagnosis = diagnoseGenerationFailure(record);
  const detailLines = generationFailureDetails(record);
  return [
    'VisionHub 生成失败诊断',
    `诊断：${diagnosis.title}`,
    `摘要：${diagnosis.summary}`,
    `分类：${generationFailureCategoryLabels[diagnosis.category]} / ${generationFailureSeverityLabels[diagnosis.severity]}`,
    `状态：${generationStatusLabel(record)} (${record.status})`,
    providerName ? `平台：${providerName} (${record.providerId})` : `平台：${record.providerName ?? record.providerId}`,
    `模型：${record.modelId || '-'}`,
    `模式：${(record.generationMode ?? 'text-to-image') === 'image-to-image' ? '图生图' : (record.generationMode === 'imported' ? '导入图片' : '文生图')}`,
    `参考图：${record.referenceImages?.length ?? 0} 张`,
    record.durationMs ? `耗时：${record.durationMs}ms` : '',
    record.createdAt ? `创建时间：${record.createdAt}` : '',
    getRecordPrimaryPath(record) ? `图片/路径：${getRecordPrimaryPath(record)}` : '',
    detailLines.length ? `细节：${detailLines.join(' · ')}` : '',
    diagnosis.actions.length ? `建议：\n${diagnosis.actions.map((action, index) => `${index + 1}. ${action}`).join('\n')}` : '',
    diagnosis.rawMessage ? `原始错误：${diagnosis.rawMessage}` : ''
  ].filter(Boolean).join('\n\n');
}

function generationRequestSummaryCopyText(record: GenerationRecord, providerName?: string) {
  const diagnosis = diagnoseGenerationFailure(record);
  const rawText = generationFailureRawText(record);
  return [
    'VisionHub 请求摘要',
    `记录 ID：${record.id}`,
    `状态：${generationStatusLabel(record)} (${record.status})`,
    `平台：${providerName ?? record.providerName ?? record.providerId}`,
    `Provider ID：${record.providerId}`,
    `模型：${record.modelId || '-'}`,
    `模式：${(record.generationMode ?? 'text-to-image') === 'image-to-image' ? '图生图' : (record.generationMode === 'imported' ? '导入图片' : '文生图')}`,
    `参考图：${record.referenceImages?.length ?? 0} 张`,
    record.costHint ? `费用提示：${record.costHint}` : '',
    record.durationMs ? `耗时：${record.durationMs}ms` : '',
    record.createdAt ? `创建时间：${record.createdAt}` : '',
    getRecordPrimaryPath(record) ? `主路径：${getRecordPrimaryPath(record)}` : '',
    `诊断分类：${generationFailureCategoryLabels[diagnosis.category]} / ${generationFailureSeverityLabels[diagnosis.severity]}`,
    diagnosis.httpStatus ? `HTTP：${diagnosis.httpStatus}` : '',
    diagnosis.traceId ? `trace_id：${diagnosis.traceId}` : '',
    diagnosis.requestId ? `request_id：${diagnosis.requestId}` : '',
    `Prompt：\n${record.prompt}`,
    record.error ? `错误：${record.error}` : '',
    rawText ? `Raw 摘要：\n${clipDiagnosticText(rawText, 1800)}` : ''
  ].filter(Boolean).join('\n\n');
}

function buildProviderDiagnosticsReport(checks: ProviderDiagnosticItem[], context: ProviderDiagnosticsReportContext) {
  const counts = checks.reduce((acc, item) => {
    acc[item.level] += 1;
    return acc;
  }, { pass: 0, warn: 0, fail: 0, info: 0 } as Record<ProviderDiagnosticLevel, number>);
  return [
    'VisionHub 配置自检报告',
    `生成时间：${context.generatedAt}`,
    `平台路线：${context.platformLabel}`,
    `服务模板：${context.serviceLabel}`,
    `Provider：${context.providerName}`,
    context.profileName ? `配置实例：${context.profileName}${context.profileId ? ` (${context.profileId})` : ''}` : '配置实例：当前编辑草稿',
    context.modelId ? `模型：${context.modelId}` : '',
    `统计：通过 ${counts.pass} / 注意 ${counts.warn} / 错误 ${counts.fail} / 提示 ${counts.info}`,
    '',
    ...checks.map((item, index) => [
      `#${index + 1} ${item.label}`,
      `等级：${item.level === 'pass' ? '通过' : item.level === 'warn' ? '注意' : item.level === 'fail' ? '错误' : '提示'}`,
      `说明：${item.detail}`
    ].join('\n')),
    '',
    '安全说明：本报告不会包含 API Key；只记录当前配置是否已保存密钥，不导出具体密钥值。'
  ].filter((line) => line !== '').join('\n\n');
}

type LibraryRecoveryAdvice = {
  title: string;
  summary: string;
  actions: string[];
};

function rawObjectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readRawStringPath(raw: unknown, path: string[]) {
  let current: unknown = raw;
  for (const key of path) {
    const object = rawObjectValue(current);
    if (!object) return '';
    current = object[key];
  }
  return typeof current === 'string' ? current.trim() : '';
}

function recordBackgroundPollUrl(record: Pick<GenerationRecord, 'raw'>) {
  return readRawStringPath(record.raw, ['poll_url']) || readRawStringPath(record.raw, ['visionhub_recovery', 'poll_url']);
}

function isBackgroundRecoveryCandidate(record: Pick<GenerationRecord, 'status' | 'error' | 'raw'>) {
  return Boolean((record.status === 'failed' || record.error) && recordBackgroundPollUrl(record) && isPotentialBackgroundCompletion(record));
}

function buildLibraryRecoveryAdvice(record: GenerationRecord): LibraryRecoveryAdvice | null {
  const diagnosis = diagnoseGenerationFailure(record);
  const hasPreview = Boolean(record.imageUrls[0]);
  const hasLocalPath = Boolean(record.localImagePaths?.[0]);
  const hasPollUrl = Boolean(recordBackgroundPollUrl(record));

  if (diagnosis.isPotentialBackgroundCompletion) {
    return {
      title: hasPollUrl ? '后台任务可重查' : '后台结果待人工核查',
      summary: hasPollUrl
        ? '这条记录保存了后台轮询地址，可直接重查；如果返回图片，VisionHub 会自动下载并恢复到作品画廊。'
        : '这条记录像是同步超时，但 raw 里没有可自动重查的 poll_url，需要到中转站后台按 trace/request id 核对。',
      actions: [
        hasPollUrl ? '点击“重查后台任务”，不要先重新生成，避免重复消耗额度。' : '复制诊断或请求摘要，到中转站后台查是否已有完成结果。',
        '如果后台已成功但软件未恢复，可把图片下载到本地后通过“导入本地图片”加入作品画廊。',
        '后续同类任务可降低尺寸、数量或质量，减少同步超时概率。'
      ]
    };
  }

  if (record.status === 'succeeded' && hasLocalPath && !hasPreview) {
    return {
      title: '本地图片路径存在，但预览索引缺失',
      summary: '记录保存了本地路径，却没有可显示的图片地址，通常可通过重载历史重新补齐显示链接。',
      actions: [
        '先点击 AI 创作页或作品画廊里的“重载历史”。',
        '如果仍无法预览，复制路径并确认文件是否还在原目录。',
        '不要删除记录；确认文件存在后再决定是否重新导入。'
      ]
    };
  }

  if (record.status === 'succeeded' && !hasLocalPath && hasPreview) {
    return {
      title: '只有远程 / raw 图片，尚未稳定落盘',
      summary: '记录能预览，但缺少本地图片路径；如果远程链接过期，后续可能无法继续作为参考图。',
      actions: [
        '重载历史会尝试从 raw 或 data URL 补写到本地图库。',
        '如果图片来自网页下载，建议另存后通过“导入本地图片”建立稳定索引。',
        '迁移电脑前优先打包本地图库目录，而不是只复制历史 JSON。'
      ]
    };
  }

  if (record.status === 'failed' && diagnosis.category === 'no-image') {
    return {
      title: '接口响应里没有可恢复图片',
      summary: '服务端有返回，但当前解析规则没有找到图片字段，可能是模型不对或协议返回结构不兼容。',
      actions: [
        '确认模型是真正的图片模型，不是文本对话模型。',
        '复制 Raw 给中转站或检查图片字段位置，再决定是否调整协议映射。',
        '重新生成前先用 1 张、小尺寸和默认质量排除参数问题。'
      ]
    };
  }

  if (record.status === 'failed' && diagnosis.category === 'response-format') {
    return {
      title: '返回格式异常，无法自动恢复',
      summary: '接口返回了 HTML、网关页或非标准 JSON，VisionHub 不能从这类响应里恢复图片。',
      actions: [
        '检查 Base URL 是否填成网页控制台或带了具体接口路径。',
        '到平台接入页运行“配置自检报告”，确认 Base URL、接口路径和 Headers。',
        '不要修改系统代理；优先换一个已验证的中转站 API 地址测试。'
      ]
    };
  }

  if (record.status === 'failed') {
    return {
      title: '失败记录恢复建议',
      summary: '这条记录没有可直接恢复的图片。建议先保留记录，用诊断信息定位配置或服务商问题。',
      actions: [
        '先复制诊断和请求摘要，确认认证、模型、协议路径、参数或额度问题。',
        '修正配置后再重新生成，避免用错误配置反复消耗额度。',
        '如果中转站后台已有图片，可下载后通过“导入本地图片”加入作品画廊。'
      ]
    };
  }

  return null;
}

function loadLibraryMeta(): LibraryMetaMap {
  const raw = readStorageValue(LIBRARY_META_STORAGE_KEY);
  if (!raw) return {};
  try {
    return normalizeLibraryMeta(JSON.parse(raw));
  } catch (error) {
    console.warn('[VisionHub] library meta parse failed; using empty meta', error);
    return {};
  }
}

function normalizeLibraryMeta(value: unknown): LibraryMetaMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: LibraryMetaMap = {};
  Object.entries(value as Record<string, unknown>).forEach(([recordId, entry]) => {
    if (!recordId || !entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    const source = entry as Record<string, unknown>;
    const next: LibraryMetaEntry = {};
    if (typeof source.favorite === 'boolean') next.favorite = source.favorite;
    if (Array.isArray(source.tags)) next.tags = source.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean);
    if (typeof source.folderId === 'string' && source.folderId.trim()) next.folderId = source.folderId.trim();
    if (Array.isArray(source.collectionIds)) next.collectionIds = source.collectionIds.filter((id): id is string => typeof id === 'string').map((id) => id.trim()).filter(Boolean);
    if (typeof source.note === 'string' && source.note.trim()) next.note = source.note;
    if (typeof source.rating === 'number' && Number.isFinite(source.rating) && source.rating >= 1 && source.rating <= 5) next.rating = source.rating;
    if (Array.isArray(source.colorPalette)) next.colorPalette = source.colorPalette.filter((color): color is string => typeof color === 'string');
    if (Array.isArray(source.colorFamilies)) next.colorFamilies = source.colorFamilies.filter((family): family is LibraryColorFilter => (
      typeof family === 'string' && ['all', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'mono'].includes(family)
    ));
    if (typeof source.imageSize === 'string' && source.imageSize.trim()) next.imageSize = source.imageSize.trim();
    if (typeof source.colorAnalyzedAt === 'string' && source.colorAnalyzedAt.trim()) next.colorAnalyzedAt = source.colorAnalyzedAt;
    if (typeof source.colorAnalysisFailed === 'boolean') next.colorAnalysisFailed = source.colorAnalysisFailed;
    if (typeof source.lastViewedAt === 'string' && source.lastViewedAt.trim()) next.lastViewedAt = source.lastViewedAt;
    if (typeof source.lastUsedAsReferenceAt === 'string' && source.lastUsedAsReferenceAt.trim()) next.lastUsedAsReferenceAt = source.lastUsedAsReferenceAt;
    if (Object.keys(next).length) normalized[recordId] = next;
  });
  return normalized;
}

function saveLibraryMeta(meta: LibraryMetaMap) {
  writeStorageValue(LIBRARY_META_STORAGE_KEY, JSON.stringify(meta));
}

function normalizeLibraryDisplaySettings(value: Partial<LibraryDisplaySettings> | null | undefined): LibraryDisplaySettings {
  return {
    showPrompt: typeof value?.showPrompt === 'boolean' ? value.showPrompt : defaultLibraryDisplaySettings.showPrompt,
    showProvider: typeof value?.showProvider === 'boolean' ? value.showProvider : defaultLibraryDisplaySettings.showProvider,
    showModel: typeof value?.showModel === 'boolean' ? value.showModel : defaultLibraryDisplaySettings.showModel,
    showFailed: typeof value?.showFailed === 'boolean' ? value.showFailed : defaultLibraryDisplaySettings.showFailed,
    showReferenceBadge: typeof value?.showReferenceBadge === 'boolean' ? value.showReferenceBadge : defaultLibraryDisplaySettings.showReferenceBadge,
    compact: typeof value?.compact === 'boolean' ? value.compact : defaultLibraryDisplaySettings.compact
  };
}

function loadLibraryDisplaySettings(): LibraryDisplaySettings {
  const raw = readStorageValue(LIBRARY_DISPLAY_STORAGE_KEY);
  if (!raw) return defaultLibraryDisplaySettings;
  try {
    return normalizeLibraryDisplaySettings(JSON.parse(raw) as Partial<LibraryDisplaySettings>);
  } catch (error) {
    console.warn('[VisionHub] library display settings parse failed; using defaults', error);
    return defaultLibraryDisplaySettings;
  }
}

function saveLibraryDisplaySettings(settings: LibraryDisplaySettings) {
  const normalized = normalizeLibraryDisplaySettings(settings);
  writeStorageValue(LIBRARY_DISPLAY_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function loadLibraryCustomQuickFilters(): LibraryCustomQuickFilter[] {
  const raw = readStorageValue(LIBRARY_CUSTOM_QUICK_FILTERS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LibraryCustomQuickFilter[];
    return Array.isArray(parsed) ? parsed.filter((item) => item.id && item.label && item.criteria) : [];
  } catch (error) {
    console.warn('[VisionHub] library custom quick filters parse failed; using empty list', error);
    return [];
  }
}

function saveLibraryCustomQuickFilters(filters: LibraryCustomQuickFilter[]) {
  writeStorageValue(LIBRARY_CUSTOM_QUICK_FILTERS_STORAGE_KEY, JSON.stringify(filters));
}

function normalizeLibraryOrganization(value: Partial<LibraryOrganization> | null | undefined): LibraryOrganization {
  const folders = Array.isArray(value?.folders)
    ? value.folders
        .filter((folder): folder is LibraryFolder => Boolean(folder?.id && folder.name))
        .map((folder) => ({
          id: folder.id,
          name: folder.name,
          color: folder.color || libraryFolderColors[0],
          createdAt: folder.createdAt || new Date().toISOString()
        }))
    : [];
  const collections = Array.isArray(value?.collections)
    ? value.collections
        .filter((collection): collection is LibraryCollection => Boolean(collection?.id && collection.name))
        .map((collection) => ({
          id: collection.id,
          name: collection.name,
          description: collection.description,
          coverRecordId: collection.coverRecordId,
          createdAt: collection.createdAt || new Date().toISOString()
        }))
    : [];
  return { folders, collections };
}

function loadLibraryOrganization(): LibraryOrganization {
  const raw = readStorageValue(LIBRARY_ORGANIZATION_STORAGE_KEY);
  if (!raw) return { folders: [], collections: [] };
  try {
    return normalizeLibraryOrganization(JSON.parse(raw) as Partial<LibraryOrganization>);
  } catch (error) {
    console.warn('[VisionHub] library organization parse failed; using empty organization', error);
    return { folders: [], collections: [] };
  }
}

function saveLibraryOrganization(organization: LibraryOrganization) {
  writeStorageValue(LIBRARY_ORGANIZATION_STORAGE_KEY, JSON.stringify(organization));
}

function normalizeLibraryCustomQuickFilters(value: unknown): LibraryCustomQuickFilter[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is LibraryCustomQuickFilter => Boolean(
    item && typeof item === 'object' && !Array.isArray(item) &&
    typeof (item as LibraryCustomQuickFilter).id === 'string' &&
    typeof (item as LibraryCustomQuickFilter).label === 'string' &&
    (item as LibraryCustomQuickFilter).criteria &&
    typeof (item as LibraryCustomQuickFilter).criteria === 'object'
  ));
}

function buildLibraryDataPayload(
  meta: LibraryMetaMap,
  organization: LibraryOrganization,
  displaySettings: LibraryDisplaySettings,
  customQuickFilters: LibraryCustomQuickFilter[]
): LibraryDataPayload {
  return {
    version: 1,
    meta,
    organization,
    display_settings: displaySettings,
    custom_quick_filters: customQuickFilters
  };
}

function compactLibraryMetaEntry(entry: LibraryMetaEntry): LibraryMetaEntry {
  const compacted = { ...entry };
  (Object.keys(compacted) as Array<keyof LibraryMetaEntry>).forEach((key) => {
    const value = compacted[key];
    if (value === undefined || (Array.isArray(value) && value.length === 0)) {
      delete compacted[key];
    }
  });
  return compacted;
}

function getRecordPrimaryPath(record: GenerationRecord) {
  return record.localImagePaths?.[0] ?? record.imageUrls[0] ?? '';
}

function isRevealableLocalPath(value?: string) {
  if (!value) return false;
  const trimmed = value.trim();
  return Boolean(trimmed) && !/^https?:\/\//i.test(trimmed) && !/^data:/i.test(trimmed);
}

function getRecordRevealPath(record: GenerationRecord) {
  const localPath = record.localImagePaths?.find(isRevealableLocalPath);
  if (localPath) return localPath;
  return record.imageUrls.find(isRevealableLocalPath) ?? '';
}

function getRecordFileName(record: GenerationRecord) {
  const path = getRecordPrimaryPath(record);
  return path.split(/[\\/]/).filter(Boolean).pop() ?? '';
}

function parseSizePixels(size?: string) {
  if (!size) return 0;
  const match = size.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return 0;
  return Number(match[1]) * Number(match[2]);
}

function parseSizeDimensions(size?: string): [number, number] | null {
  if (!size) return null;
  const match = size.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

function getRecordSizeLabel(record: GenerationRecord, meta?: LibraryMetaEntry) {
  const raw = record.raw as {
    size?: string;
    width?: number;
    height?: number;
    image_width?: number;
    image_height?: number;
    request?: { size?: string; width?: number; height?: number };
    output?: { size?: string; width?: number; height?: number };
  } | undefined;
  const width = raw?.width ?? raw?.image_width ?? raw?.output?.width ?? raw?.request?.width;
  const height = raw?.height ?? raw?.image_height ?? raw?.output?.height ?? raw?.request?.height;
  if (width && height) return `${width}x${height}`;
  return raw?.size ?? raw?.output?.size ?? raw?.request?.size ?? meta?.imageSize ?? '-';
}

function formatBytes(bytes?: number) {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '未知';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${unitIndex === 0 ? Math.round(value) : value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function getRecordDataUrlBytes(source: string) {
  if (!source.startsWith('data:image/')) return undefined;
  const [, payload = ''] = source.split(',', 2);
  if (!payload) return undefined;
  if (source.includes(';base64,')) {
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }
  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).length;
  } catch {
    return payload.length;
  }
}

function getRecordFileSizeLabel(record: GenerationRecord) {
  const raw = record.raw as {
    fileSize?: number;
    file_size?: number;
    sizeBytes?: number;
    size_bytes?: number;
    bytes?: number;
    image_bytes?: number;
    output?: { fileSize?: number; file_size?: number; sizeBytes?: number; size_bytes?: number; bytes?: number };
  } | undefined;
  const byteSize =
    raw?.fileSize ??
    raw?.file_size ??
    raw?.sizeBytes ??
    raw?.size_bytes ??
    raw?.bytes ??
    raw?.image_bytes ??
    raw?.output?.fileSize ??
    raw?.output?.file_size ??
    raw?.output?.sizeBytes ??
    raw?.output?.size_bytes ??
    raw?.output?.bytes ??
    getRecordDataUrlBytes(record.imageUrls[0] ?? '');
  return formatBytes(byteSize);
}

function getRecordFormatLabel(record: GenerationRecord) {
  const format = getRecordFormat(record);
  const labels: Record<LibraryFormatFilter, string> = {
    all: '全部',
    png: 'PNG',
    jpg: 'JPG',
    webp: 'WebP',
    gif: 'GIF',
    svg: 'SVG',
    unknown: '未知'
  };
  return labels[format];
}

function getLibraryColorLabel(color?: LibraryColorFilter) {
  return libraryColorOptions.find((option) => option.value === color)?.label ?? '';
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string) {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return { hue: 0, saturation: 0, lightness };
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue = max === r
    ? ((g - b) / delta + (g < b ? 6 : 0)) * 60
    : max === g
      ? ((b - r) / delta + 2) * 60
      : ((r - g) / delta + 4) * 60;
  return { hue, saturation, lightness };
}

function getColorFamily(red: number, green: number, blue: number): LibraryColorFilter {
  const { hue, saturation, lightness } = rgbToHsl(red, green, blue);
  if (saturation < 0.16 || lightness < 0.16 || lightness > 0.9) return 'mono';
  if (hue < 18 || hue >= 344) return 'red';
  if (hue < 45) return 'orange';
  if (hue < 72) return 'yellow';
  if (hue < 155) return 'green';
  if (hue < 195) return 'cyan';
  if (hue < 250) return 'blue';
  if (hue < 292) return 'purple';
  if (hue < 344) return 'pink';
  return 'mono';
}

function getFilterColorFamilies(filter: LibraryColorFilter): LibraryColorFilter[] {
  if (filter === 'all') return ['all'];
  if (filter === 'orange') return ['orange', 'red', 'yellow'];
  if (filter === 'cyan') return ['cyan', 'blue', 'green'];
  if (filter === 'purple') return ['purple', 'blue', 'pink'];
  if (filter === 'pink') return ['pink', 'red', 'purple'];
  return [filter];
}

function colorPaletteMatchesFilter(palette: string[] | undefined, filter: LibraryColorFilter) {
  if (filter === 'all') return true;
  if (!palette?.length) return false;
  const accepted = new Set(getFilterColorFamilies(filter));
  return palette.some((hex) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;
    return accepted.has(getColorFamily(rgb.red, rgb.green, rgb.blue));
  });
}

function libraryColorMatchesFilter(meta: LibraryMetaEntry | undefined, filter: LibraryColorFilter) {
  if (filter === 'all') return true;
  if (!meta) return false;
  const accepted = new Set(getFilterColorFamilies(filter));
  return (
    Boolean(meta.colorFamilies?.some((family) => accepted.has(family))) ||
    colorPaletteMatchesFilter(meta.colorPalette, filter)
  );
}

function analyzeImageColors(image: HTMLImageElement) {
  if (!image.naturalWidth || !image.naturalHeight) return null;
  const canvas = document.createElement('canvas');
  const size = 48;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  const buckets = new Map<string, { red: number; green: number; blue: number; count: number; score: number }>();
  const familyScores = new Map<LibraryColorFilter, number>();
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 96) continue;
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const { saturation, lightness } = rgbToHsl(red, green, blue);
    const weight = 0.45 + saturation * 1.3 + (1 - Math.abs(lightness - 0.52)) * 0.45;
    const family = getColorFamily(red, green, blue);
    familyScores.set(family, (familyScores.get(family) ?? 0) + weight);
    const key = `${Math.round(red / 28)}-${Math.round(green / 28)}-${Math.round(blue / 28)}`;
    const current = buckets.get(key) ?? { red: 0, green: 0, blue: 0, count: 0, score: 0 };
    current.red += red;
    current.green += green;
    current.blue += blue;
    current.count += 1;
    current.score += weight;
    buckets.set(key, current);
  }
  const palette = Array.from(buckets.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, 10)
    .map((bucket) => rgbToHex(
      Math.round(bucket.red / bucket.count),
      Math.round(bucket.green / bucket.count),
      Math.round(bucket.blue / bucket.count)
    ));
  const familyEntries = Array.from(familyScores.entries())
    .filter(([family]) => family !== 'all')
    .sort((left, right) => right[1] - left[1]);
  const topFamilyScore = familyEntries[0]?.[1] ?? 0;
  const families = Array.from(new Set([
    ...familyEntries
      .filter(([, score]) => score >= topFamilyScore * 0.14)
      .slice(0, 8)
      .map(([family]) => family),
    ...palette
      .map((hex) => hexToRgb(hex))
      .filter((rgb): rgb is { red: number; green: number; blue: number } => Boolean(rgb))
      .map((rgb) => getColorFamily(rgb.red, rgb.green, rgb.blue))
  ]));
  return palette.length ? { palette, families } : null;
}

function ratioClose(left: number, right: number) {
  return Math.abs(left - right) < 0.04;
}

function getRecordShapeTokens(record: GenerationRecord, meta?: LibraryMetaEntry): LibraryShapeFilter[] {
  const dimensions = parseSizeDimensions(getRecordSizeLabel(record, meta));
  if (!dimensions) return ['custom'];
  const [width, height] = dimensions;
  if (!width || !height) return ['custom'];
  const ratio = width / height;
  const tokens: LibraryShapeFilter[] = ['custom'];
  if (ratioClose(ratio, 1)) tokens.push('square');
  if (ratio > 1.04) tokens.push('landscape');
  if (ratio < 0.96) tokens.push('portrait');
  if (ratio >= 1.9) tokens.push('wide');
  if (ratio <= 0.53) tokens.push('tall');
  if (ratioClose(ratio, 4 / 3)) tokens.push('four-three');
  if (ratioClose(ratio, 3 / 4)) tokens.push('three-four');
  if (ratioClose(ratio, 16 / 9)) tokens.push('sixteen-nine');
  if (ratioClose(ratio, 9 / 16)) tokens.push('nine-sixteen');
  return tokens;
}

function getRecordFormat(record: GenerationRecord): LibraryFormatFilter {
  const source = getRecordPrimaryPath(record).toLowerCase();
  const dataUrlMatch = source.match(/^data:image\/([^;,]+)/);
  const extensionMatch = source.match(/\.([a-z0-9]+)(?:$|[?#])/);
  const rawFormat = dataUrlMatch?.[1] ?? extensionMatch?.[1] ?? '';
  if (rawFormat === 'jpeg' || rawFormat === 'jpg') return 'jpg';
  if (rawFormat === 'png') return 'png';
  if (rawFormat === 'webp') return 'webp';
  if (rawFormat === 'gif') return 'gif';
  if (rawFormat === 'svg' || rawFormat === 'svg+xml') return 'svg';
  return 'unknown';
}

function sortLibraryRecords(records: GenerationRecord[], sortMode: LibrarySortMode, meta: LibraryMetaMap, providerNameMap: Map<string, string>) {
  return [...records].sort((a, b) => {
    if (sortMode === 'favorites') {
      const favoriteDiff = Number(Boolean(meta[b.id]?.favorite)) - Number(Boolean(meta[a.id]?.favorite));
      if (favoriteDiff !== 0) return favoriteDiff;
      return getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    if (sortMode === 'oldest') return getRecordTimeMs(a.createdAt) - getRecordTimeMs(b.createdAt);
    if (sortMode === 'provider') {
      const left = providerNameMap.get(a.providerId) ?? a.providerName ?? a.providerId;
      const right = providerNameMap.get(b.providerId) ?? b.providerName ?? b.providerId;
      return left.localeCompare(right, 'zh-Hans-CN') || getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    if (sortMode === 'model') {
      return a.modelId.localeCompare(b.modelId, 'zh-Hans-CN') || getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    if (sortMode === 'duration') {
      return (b.durationMs ?? -1) - (a.durationMs ?? -1) || getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    if (sortMode === 'size') {
      return parseSizePixels(getRecordSizeLabel(b, meta[b.id])) - parseSizePixels(getRecordSizeLabel(a, meta[a.id])) || getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    if (sortMode === 'filename') {
      return getRecordFileName(a).localeCompare(getRecordFileName(b), 'zh-Hans-CN') || getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    return getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
  });
}

const LIBRARY_INITIAL_RENDER_COUNT = 48;
const LIBRARY_RENDER_BATCH_SIZE = 72;

function useStableEvent<T extends (...args: any[]) => unknown>(handler: T): T {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  return useCallback(((...args: Parameters<T>) => handlerRef.current(...args)) as T, []);
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

function matrixStatusDetail(template: ProviderServiceTemplate, status: ProviderMatrixStatus, columnLabel: string) {
  if (status === 'live') return `${columnLabel} 已有真实调用入口，可在当前版本使用。`;
  if (status === 'configurable') return `${columnLabel} 可保存配置，实际可用性以服务商模型和协议为准。`;
  if (status === 'partial') return `${columnLabel} 有入口或部分映射，仍需要按服务商协议验证。`;
  if (status === 'planned') return `${columnLabel} 仅路线展示，当前不会开放保存、启用或真实试生图。`;
  if (status === 'localPlan') return `${columnLabel} 属于本地模型规划，不影响在线平台主流程。`;
  if (status === 'unsupported') return `${template.label} 当前不支持 ${columnLabel}。`;
  return `${columnLabel} 需要结合服务商文档确认。`;
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
    status,
    label: providerMatrixStatusLabel[status],
    detail: matrixStatusDetail(template, status, column.label)
  };
}


const GITHUB_REPOSITORY_URL = 'https://github.com/BlueSummer2333/VisionHub-Studio';
const GITHUB_RELEASES_URL = `${GITHUB_REPOSITORY_URL}/releases`;

type UtilityModal = 'system-info' | 'shortcuts' | null;
type GenerateShortcutName = 'submit' | 'focus-prompt' | 'add-reference' | 'clear-references' | 'mode-image' | 'mode-text';
type ConfirmDialogState = ConfirmDialogRequest & { error?: string };

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
      { keys: ['Ctrl', '0'], action: '打开工作台首页' },
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

function readUrlSearchParam(name: string) {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

function readUrlSearchList(name: string) {
  return (readUrlSearchParam(name) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function App() {
  const providers = useMemo(() => listProviders(), []);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => readInitialAppSettings());
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
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [generateSessionStartedAt] = useState(() => Date.now());
  const autoRecheckedRecordIdsRef = useRef<Set<string>>(new Set());
  const localComfyUIDiagnosticRequestRef = useRef(0);
  const localComfyUIAutoCheckRunningRef = useRef(false);
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
  const isRealProviderReady = desktopRuntime && (
    (generationProviderUsesConfig && generationSecretAvailable) ||
    isComfyUIGenerationReady
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
      const draftConfig = createEmptyProviderDraftConfig(selectedProvider, selectedServiceTemplate);
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
      : createEmptyProviderDraftConfig(selectedProvider, selectedServiceTemplate);
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
        error: 'ComfyUI 连接诊断需要 Tauri 桌面端运行时。'
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
            reject(new Error('ComfyUI 连接诊断超时：本次请求超过 12 秒没有返回，请确认地址是否为当前可访问的本地服务。'));
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

  async function importLocalComfyUIWorkflow(file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) {
      const message = '请选择 ComfyUI 导出的 JSON workflow 文件。';
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
        ? `已导入 API workflow：识别到 ${summary.nodeCount} 个节点，可在 AI 创作台选择 ComfyUI 后测试生成。`
        : `已导入 workflow：识别到 ${summary.nodeCount} 个节点。当前文件不是 API workflow，真实生成前需要重新导出 API 格式。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLocalComfyUIWorkflowError(`workflow 解析失败：${message}`);
      setConfigMessage(`workflow 解析失败：${message}`);
    }
  }

  function clearLocalComfyUIWorkflow() {
    const nextStore: LocalComfyUIWorkflowStore = { activeId: null, presets: [] };
    setLocalComfyUIWorkflowStore(nextStore);
    setLocalComfyUIWorkflowError('');
    saveLocalComfyUIWorkflowStore(nextStore);
    setConfigMessage('已清除 ComfyUI workflow 解析预览。');
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

  async function runCreativeDeskGenerate(options?: Parameters<typeof generate>[0]) {
    if (selectedProviderId !== 'comfyui-local') {
      await generate(options);
      return;
    }

    useStudioStore.setState({ isGenerating: true });
    const activeWorkflowPreset =
      localComfyUIWorkflowStore.presets.find((item) => item.id === localComfyUIWorkflowStore.activeId) ??
      localComfyUIWorkflowStore.presets[0] ??
      null;
    try {
      if (!desktopRuntime) {
        throw new Error('ComfyUI 本地生成需要 Tauri 桌面端运行时。');
      }
      if ((options?.mode ?? 'text-to-image') === 'image-to-image') {
        throw new Error('ComfyUI 创作台 MVP 先支持文生图；图生图需要后续单独做图片上传和节点映射。');
      }
      if (!activeWorkflowPreset) {
        throw new Error('请先到平台接入 > 本地模型 > ComfyUI 导入 API workflow。');
      }
      if (activeWorkflowPreset.summary.format !== 'api' || !activeWorkflowPreset.rawWorkflow) {
        throw new Error('当前 ComfyUI 预设没有可提交的 API workflow。请在 ComfyUI 里启用 Dev mode 后重新导出 API 格式 workflow。');
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
        timeoutMs: 180_000
      });
      const recordsToSave = splitImageResultIntoSingleImageRecords({
        ...result,
        generationMode: 'text-to-image',
        referenceImages: []
      });
      const savedRecords: GenerationRecord[] = [];
      for (const record of recordsToSave) {
        savedRecords.push(await saveGenerationRecord(record, 'ComfyUI / 本地模型'));
      }
      for (const saved of [...savedRecords].reverse()) {
        addResult(saved);
      }
      const firstSaved = savedRecords[0];
      if (firstSaved?.status === 'succeeded' && firstSaved.imageUrls[0]) {
        setGeneratePreviewUrl(firstSaved.imageUrls[0]);
        setConfigMessage(savedRecords.length > 1 ? `ComfyUI 生成成功：${savedRecords.length} 张结果已保存到作品画廊。` : 'ComfyUI 生成成功：结果已保存到作品画廊。');
      } else {
        setConfigMessage(`ComfyUI 生成未成功：${firstSaved?.error ?? '没有返回图片。'} 已写入作品画廊失败记录。`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed: GenerationRecord = {
        id: `comfyui-error-${Date.now()}`,
        providerId: 'comfyui-local',
        providerName: 'ComfyUI / 本地模型',
        modelId: activeWorkflowPreset?.name ?? 'ComfyUI Workflow',
        status: 'failed',
        prompt,
        imageUrls: [],
        localImagePaths: [],
        costHint: '本地 ComfyUI 生成，不消耗在线 API 额度。',
        error: message,
        raw: {
          visionhub_comfyui_error: 'frontend_preflight_failed',
          workflow: activeWorkflowPreset?.summary.fileName ?? null
        },
        createdAt: new Date().toISOString(),
        generationMode: options?.mode ?? 'text-to-image',
        referenceImages: []
      };
      const saved = await saveGenerationRecord(failed, failed.providerName);
      addResult(saved);
      setConfigMessage(`ComfyUI 生成未成功：${message} 已写入作品画廊失败记录。`);
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
            // 自动重查只做轻量恢复尝试，失败仍保留手动诊断入口，避免打扰正常创作。
          }
        }
        if (!cancelled && (checked || recovered)) {
          window.dispatchEvent(new CustomEvent(appToastEventName, {
            detail: {
              message: recovered ? `后台任务自动恢复 ${recovered} 条记录` : `已自动重查 ${checked} 条后台记录，暂未发现可恢复图片`,
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
      name: asset.title || '灵感收藏',
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
  }, [navigateTo, prompt, setPrompt]);

  const useInspirationPrompt = useCallback((promptText: string) => {
    if (!promptText.trim()) return;
    setPrompt(promptText);
    navigateTo('generate');
  }, [navigateTo, setPrompt]);

  const createPromptTemplateFromInspiration = useCallback((title: string, promptText: string, tags: string[]) => {
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
  }, []);

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

  async function openInspirationDirectory() {
    if (!desktopRuntime) {
      setSettingsMessage('请在 Tauri 桌面端打开图片收藏目录。');
      return;
    }
    try {
      await revealInspirationDir();
      setSettingsMessage('已打开图片收藏目录。');
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
      const nextSettings = await saveStorageSettings({
        libraryDirOverride: null,
        inspirationDirOverride: storageSettings?.inspiration_dir_override ?? undefined
      });
      setStorageSettings(nextSettings);
      setSettingsMessage(`已恢复默认图库目录：${nextSettings.resolved_library_dir}`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function selectInspirationDirectory() {
    if (!desktopRuntime) {
      setSettingsMessage('请在 Tauri 桌面端修改图片收藏目录。');
      return;
    }
    try {
      const nextSettings = await chooseInspirationDir();
      if (!nextSettings) {
        setSettingsMessage('已取消选择图片收藏目录。');
        return;
      }
      setStorageSettings(nextSettings);
      setSettingsMessage(`图片收藏目录已切换：${nextSettings.resolved_inspiration_dir}`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function resetInspirationDirectoryOverride() {
    if (!desktopRuntime) {
      setSettingsMessage('请在 Tauri 桌面端修改图片收藏目录。');
      return;
    }
    try {
      const nextSettings = await saveStorageSettings({
        libraryDirOverride: storageSettings?.library_dir_override ?? undefined,
        inspirationDirOverride: null
      });
      setStorageSettings(nextSettings);
      setSettingsMessage(`已恢复默认图片收藏目录：${nextSettings.resolved_inspiration_dir}`);
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
        providerConfigs: {
          legacy: exportProviderConfigMap(),
          profiles: providerProfiles.map((profile) => ({
            ...profile,
            secret: undefined
          }))
        }
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
      setSecretMessage('当前服务模板尚未接入，暂不能保存密钥。');
      return false;
    }
    const trimmedSecret = secretDraft.trim();
    if (!trimmedSecret) {
      setSecretMessage(secretAvailable ? 'API Key 已配置；如需更换，请先输入新的 API Key。' : '请先填写 API Key。');
      return false;
    }
    if (!desktopRuntime) {
      setSecretMessage('当前是网页预览模式，只有 Tauri 桌面端会写入系统凭据。');
      return false;
    }

    setIsSavingSecret(true);
    try {
      const status = await saveProviderSecret(activeSecretId(), trimmedSecret);
      setSecretAvailable(status.available);
      setSecretDraft('');
      setSecretMessage(selectedProfileId ? 'API Key 已保存到当前配置实例。' : 'API Key 已保存；保存配置后会绑定到配置实例。');
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
      setSettingsMessage(promptPolishSecretAvailable ? '润色专用 API Key 已配置；如需更换，请先输入新的 Key。' : '请先填写润色专用 API Key。');
      return false;
    }
    if (!desktopRuntime) {
      setSettingsMessage('当前是网页预览模式，只有 Tauri 桌面端会写入系统凭据。');
      return false;
    }

    setIsSavingPromptPolishSecret(true);
    try {
      const status = await saveProviderSecret(PROMPT_POLISH_SECRET_ID, trimmedSecret);
      setPromptPolishSecretAvailable(status.available);
      setPromptPolishSecretDraft('');
      setSettingsMessage('润色专用 API Key 已保存，不会影响生图平台配置。');
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
    const displayName = promptPolishDraft.displayName.trim() || '提示词润色专用配置';
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
    setSettingsMessage('提示词润色配置已保存；本地润色仍可在引擎里切换使用。');
  }

  async function refreshPromptPolishModels() {
    const baseUrl = promptPolishDraft.baseUrl.trim();
    if (!baseUrl) {
      setSettingsMessage('请先填写润色专用 Base URL。');
      return;
    }
    if (!desktopRuntime) {
      setSettingsMessage('当前是网页预览模式，只有 Tauri 桌面端可以刷新模型列表。');
      return;
    }
    if (!promptPolishSecretAvailable) {
      setSettingsMessage('请先保存润色专用 API Key，再刷新模型列表。');
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
        setSettingsMessage('模型接口已返回，但没有发现可用模型。');
        return;
      }
      setPromptPolishDraft((current) => ({
        ...current,
        modelOptions,
        modelId: modelOptions.includes(current.modelId.trim()) ? current.modelId.trim() : ''
      }));
      setSettingsMessage(`已刷新 ${modelOptions.length} 个润色文本模型，请在模型选择框里选择或手动填写后保存配置。`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshingPromptPolishModels(false);
    }
  }

  function buildProfileFromCurrentConfig(enable: boolean) {
    if (!isSelectedServiceConfigurable) {
      throw new Error('当前服务模板尚未接入，暂不能保存配置。');
    }
    if (!providerConfig.baseUrl.trim()) {
      throw new Error('请先填写 Base URL。');
    }
    if (!providerConfig.modelId.trim()) {
      throw new Error('请先填写模型 ID。');
    }
    const normalizedConfig = normalizeProviderConfig({
      ...providerConfig,
      displayName: providerConfig.displayName.trim() || inferProfileName(providerConfig)
    });
    new URL(normalizedConfig.baseUrl);
    if (!normalizedConfig.endpointPath.startsWith('/')) {
      throw new Error('接口路径必须以 / 开头。');
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
          throw new Error('当前是网页预览模式，只有 Tauri 桌面端会写入系统凭据。');
        }
        const status = await saveProviderSecret(providerProfileSecretId(profile.id), secretDraft);
        setSecretAvailable(status.available);
        setSecretDraft('');
        setSecretMessage('API Key 已保存到当前配置实例。');
      }
      persistProfile(profile);
      setConfigActionState('saved');
      setConfigMessage(
        enable
          ? `已保存并启用：${profile.displayName}。已加入左侧配置列表。`
          : `已保存：${profile.displayName}。已加入左侧配置列表，暂未启用。`
      );
    } catch (error) {
      setConfigActionState('failed');
      setConfigMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function startNewProviderProfile() {
    if (!isSelectedServiceConfigurable) {
      setConfigMessage('当前服务模板尚未接入，只展示规划说明。');
      return;
    }
    const draftConfig = createEmptyProviderDraftConfig(selectedProvider, selectedServiceTemplate);
    setIsCreatingProviderProfile(true);
    setSelectedProfileId(null);
    setProviderConfig(draftConfig);
    setSecretDraft('');
    setSecretAvailable(false);
    setSecretMessage('');
    setProviderDiagnostics([]);
    setConfigActionState('idle');
    setSelectedModel(draftConfig.modelId);
    setConfigMessage('正在新建配置；保存后会出现在左侧配置列表。');
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
      title: '删除配置实例',
      message: `确定删除配置「${profile.displayName}」吗？这不会删除作品画廊，也不会影响已经保存的图片。`,
      confirmLabel: '删除',
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
        setConfigMessage(`已删除配置：${profile.displayName}`);
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
      setConfigMessage(`${enabled ? '已启用' : '已停用'}：${profile.displayName}`);
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
      return `${selectedServiceTemplate.label || selectedProvider.name} · ${config.modelId || 'model'}`;
    }
  }

  async function copyCurrentProviderConfig() {
    try {
      await navigator.clipboard?.writeText(serializeProviderConfig(providerConfig));
      setConfigMessage('当前平台接入配置已复制，API Key 不会包含在导出内容中。');
    } catch (error) {
      setConfigMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function copyProviderDiagnosticsReport() {
    try {
      if (!providerDiagnostics.length) throw new Error('请先运行一次配置自检报告。');
      const report = buildProviderDiagnosticsReport(providerDiagnostics, {
        platformLabel: providerPlatformOptions.find((item) => item.id === selectedPlatformType)?.label ?? selectedPlatformType,
        serviceLabel: selectedServiceTemplate.label,
        providerName: selectedProvider.name,
        profileName: selectedProfile?.displayName,
        profileId: selectedProfile?.id ?? selectedProfileId,
        modelId: providerConfig.modelId,
        generatedAt: new Date().toISOString()
      });
      await navigator.clipboard?.writeText(report);
      setConfigMessage('配置自检报告已复制，内容不包含 API Key。');
    } catch (error) {
      setConfigMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function importProviderConfigFromClipboard() {
    try {
      const text = await navigator.clipboard?.readText();
      if (!text?.trim()) throw new Error('剪贴板里没有可粘贴的平台配置 JSON。');
      const importedConfig = parseProviderConfigImport(text);
      setProviderConfig(importedConfig);
      setSelectedModel(importedConfig.modelId);
      setConfigMessage('已从剪贴板粘贴配置，并填入配置详情。请确认后保存。');
    } catch (error) {
      setConfigMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function pinCurrentModelAsDefault() {
    try {
      const normalizedConfig = normalizeProviderConfig(providerConfig);
      const profile = buildProfileFromCurrentConfig(true);
      persistProfile({ ...profile, ...normalizedConfig, enabled: true });
      setConfigMessage(`已将 ${normalizedConfig.modelId} 设为默认模型。`);
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
        ? `已复制 ${platform.name} 专用 Prompt，并打开网页。`
        : `已打开 ${platform.name} 网页。`);
    } catch (error) {
      setFreePlatformMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function copyPromptForPlatform(platform: FreePlatform) {
    try {
      if (!prompt.trim()) throw new Error('请先在 AI 创作里写好 Prompt。');
      await navigator.clipboard?.writeText(buildFreePlatformPrompt(platform, prompt));
      setFreePlatformMessage(`已复制 ${platform.name} 专用 Prompt。`);
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

  async function importWebResultFromPlatform(platform: FreePlatform, file: File) {
    try {
      if (!file.type.startsWith('image/')) throw new Error('请选择网页下载的图片文件。');
      const adaptedPrompt = buildFreePlatformPrompt(platform, prompt);
      const dataUrl = await fileToDataUrl(file);
      await importInspirationAsset({
        title: `${platform.name} 网页成品 · ${file.name.replace(/\.[^.]+$/, '')}`,
        dataUrl,
        fileName: file.name,
        sourceUrl: platform.url,
        sourcePlatform: platform.name,
        originalPrompt: adaptedPrompt || prompt.trim() || undefined,
        tags: ['免费平台', platform.name, platform.region === 'china' ? '国内平台' : '海外平台', platform.supportsImageToImage ? '图生图' : '文生图'],
        note: `从 ${platform.name} 网页下载后导入。${platform.commercialNote}`,
        licenseStatus: platform.commercialUse === 'allowed' ? 'commercial-confirmed' : 'reference-only'
      });
      setIsInspirationPageMounted(true);
      setInspirationImportVersion((version) => version + 1);
      setFreePlatformMessage(`已把 ${platform.name} 网页下载图导入图片收藏。`);
    } catch (error) {
      setFreePlatformMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function refreshModels() {
    if (!isSelectedServiceConfigurable) {
      setConfigMessage('当前服务模板尚未接入，暂不能刷新模型。');
      return;
    }
    if (!providerSupportsOpenAICompatibleModelList(selectedProvider.id)) {
      setConfigMessage('当前官方 API 暂不提供 OpenAI 兼容模型列表，已保留模板内置模型和手动模型 ID。');
      return;
    }
    if (!desktopRuntime) {
      setConfigMessage('请在 Tauri 桌面端刷新模型列表。');
      return;
    }
    if (!secretAvailable) {
      const savedSecret = await saveActiveProviderSecret();
      if (!savedSecret) {
        setConfigMessage('请先保存 API Key，再刷新模型列表。');
        return;
      }
    }

    setIsRefreshingModels(true);
    setConfigMessage('正在刷新模型列表…');
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
      const modelProbe = buildModelProbe(nextModelId, modelOptions, '来自模型列表刷新。');
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
      setConfigMessage(`已刷新 ${modelOptions.length} 个模型。${modelProbe.available ? '' : ' 当前模型未在列表中，已保留手动选择。'}`);
    } catch (error) {
      if (isModelListUnavailableError(error)) {
        const nextConfig = ensureManualModelOption(providerConfig);
        setProviderConfig(nextConfig);
        saveProviderConfig(selectedProvider.id, nextConfig);
        if (selectedProfile) {
          const message = formatModelListFallbackMessage(error, nextConfig.modelId);
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
        setConfigMessage(formatModelListFallbackMessage(error, nextConfig.modelId));
      } else {
        setConfigMessage(mapProviderErrorMessage(error));
      }
    } finally {
      setIsRefreshingModels(false);
    }
  }

  async function probeCurrentModel() {
    if (!isSelectedServiceConfigurable) {
      setConfigMessage('当前服务模板尚未接入，暂不能探测模型。');
      return;
    }
    if (!desktopRuntime) {
      setConfigMessage('请在 Tauri 桌面端探测模型。');
      return;
    }
    if (!providerConfig.modelId.trim()) {
      setConfigMessage('请先填写模型 ID。');
      return;
    }
    if (!secretAvailable) {
      const savedSecret = await saveActiveProviderSecret();
      if (!savedSecret) {
        setConfigMessage('请先保存 API Key，再探测模型。');
        return;
      }
    }

    setIsProbingModel(true);
    setConfigMessage(`正在探测模型：${providerConfig.modelId.trim()}…`);
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
      const modelProbe = buildModelProbe(providerConfig.modelId, modelOptions, `延迟 ${latencyMs} ms。`);
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
          label: '当前模型探测',
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
          message: formatModelListFallbackMessage(error, nextConfig.modelId)
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
        const message = mapProviderErrorMessage(error);
        updateProviderProfileTestState(selectedProfileId, 'failed', latencyMs, message);
        setConfigMessage(message);
      }
    } finally {
      setIsProbingModel(false);
    }
  }

  async function runProviderDiagnostics(targetProfile?: ProviderConnectionProfile) {
    setIsRunningDiagnostics(true);
    const checks: ProviderDiagnosticItem[] = [];
    if (!targetProfile && !isSelectedServiceConfigurable) {
      const plannedChecks: ProviderDiagnosticItem[] = [
        {
          id: 'template-status',
          label: '服务模板状态',
          level: 'info',
          detail: `${providerServiceStatusLabel[selectedServiceTemplate.status]}：${selectedServiceTemplate.description}`
        }
      ];
      setProviderDiagnostics(plannedChecks);
      setConfigMessage('当前服务模板尚未接入，只展示路线规划。');
      setIsRunningDiagnostics(false);
      return;
    }
    const targetProviderId = targetProfile?.providerId ?? selectedProvider.id;
    const targetProvider = providers.find((provider) => provider.id === targetProviderId) ?? selectedProvider;
    const targetConfig = targetProfile ? profileToProviderConfig(targetProfile) : providerConfig;
    const targetSecretId = targetProfile ? providerProfileSecretId(targetProfile.id) : activeSecretId();
    const targetSupportsOpenAICompatible = providerUsesConfig(targetProviderId);
    const targetSupportsModelList = providerSupportsOpenAICompatibleModelList(targetProviderId);
    const startedAt = performance.now();
    let profileStatus: ProviderConnectionProfile['lastTestStatus'] = 'warning';
    let profileMessage = '诊断未完成。';
    let profilePatch: Partial<Pick<ProviderConnectionProfile, 'lastModelCount' | 'lastImageModelCount' | 'lastModelProbe'>> = {};

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
        label: '平台接入状态',
        level: targetSupportsOpenAICompatible ? 'pass' : 'info',
        detail: targetSupportsOpenAICompatible ? '当前平台已接入可配置的真实请求链路。' : '当前平台仍是路线图占位，暂不支持真实连通性诊断。'
      });

      if (!targetSupportsOpenAICompatible) {
        profileMessage = '当前平台暂不支持真实连通性诊断。';
        return;
      }

      push({
        id: 'profile-secret-channel',
        label: '配置实例与密钥通道',
        level: targetProfile || selectedProfileId ? 'pass' : 'info',
        detail: targetProfile || selectedProfileId
          ? '当前配置已绑定独立密钥；配置 ID 保持不变，系统凭据不会随文案调整重建。'
          : '当前是临时配置草稿；保存为配置实例后会使用独立密钥。'
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
            ? `格式有效，但看起来填到了具体接口：${baseUrlPath}。建议 Base URL 只保留 ${baseUrl.origin}，具体路径放到“接口路径”。`
            : `格式有效：${baseUrl.origin}`
        });
      } catch {
        push({
          id: 'base-url',
          label: 'Base URL',
          level: 'fail',
          detail: 'Base URL 不是有效网址，请使用 https://api.openai.com 或中转站根地址。'
        });
      }

      const endpointPath = targetConfig.endpointPath.trim();
      const expectedEndpointPath = defaultEndpointForProtocol(targetConfig.protocol);
      push({
        id: 'endpoint-path-shape',
        label: '接口路径格式',
        level: endpointPath.startsWith('/') ? 'pass' : 'warn',
        detail: endpointPath.startsWith('/')
          ? `路径格式正常：${endpointPath}`
          : `建议以 / 开头，例如 ${expectedEndpointPath}；保存配置时会自动补全，但界面里保持标准路径更清楚。`
      });

      const modelId = targetConfig.modelId.trim();
      push({
        id: 'model-id',
        label: '模型 ID',
        level: modelId ? 'pass' : 'fail',
        detail: modelId
          ? `当前模型：${modelId}`
          : '模型 ID 为空；即使密钥正确，也无法执行真实生图或模型列表回填。'
      });

      try {
        parseExtraHeaders(targetConfig.extraHeadersJson);
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

      if (targetConfig.extraHeadersJson.toLowerCase().includes('authorization')) {
        push({
          id: 'authorization-header',
          label: '鉴权 Header',
          level: 'warn',
          detail: '额外 Headers 中包含 Authorization。通常 API Key 会由系统凭据通道注入，除非中转站文档明确要求，否则不要在这里重复放密钥。'
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
        if (!targetProfile || targetProfile.id === selectedProfileId) {
          setSecretAvailable(currentSecretAvailable);
        }
      }

      push({
        id: 'secret',
        label: 'API Key',
        level: currentSecretAvailable ? 'pass' : 'warn',
        detail: currentSecretAvailable ? '系统安全凭据里已有密钥。' : '尚未保存密钥；可以先填写 API Key，再点击保存或保存并启用。'
      });

      buildProviderReadinessItems({
        profile: targetProfile ?? selectedProfile,
        config: targetConfig,
        providerId: targetProviderId,
        desktopRuntime,
        secretAvailable: currentSecretAvailable,
        serviceConfigurable: true,
        supportsOpenAICompatible: targetSupportsOpenAICompatible
      }).forEach((item) => push({ ...item, id: `readiness-${item.id}` }));

      push({
        id: 'protocol',
        label: '协议与接口路径',
        level: targetConfig.endpointPath.trim().startsWith('/') ? 'pass' : 'warn',
        detail: targetConfig.endpointPath === defaultEndpointForProtocol(targetConfig.protocol)
          ? `当前协议：${targetConfig.protocol}；使用默认目标接口：${endpointPreview || targetConfig.endpointPath}`
          : `当前协议：${targetConfig.protocol}；使用自定义目标接口：${endpointPreview || targetConfig.endpointPath}`
      });

      push({
        id: 'image-to-image-adapter',
        label: '图生图映射',
        level: targetConfig.imageToImageAdapter === 'auto' ? 'info' : 'pass',
        detail: imageToImageAdapterDiagnosticDetail(targetConfig, targetProviderId)
      });

      if (storageSettings) {
        push({
          id: 'library-storage',
          label: '作品保存目录',
          level: 'pass',
          detail: `当前保存到：${storageSettings.resolved_library_dir}`
        });
      } else {
        push({
          id: 'library-storage',
          label: '作品保存目录',
          level: desktopRuntime ? 'warn' : 'info',
          detail: desktopRuntime ? '尚未读取到图库保存路径；可到偏好设置确认作品画廊目录。' : '网页预览模式无法读取桌面图库目录。'
        });
      }

      if (appSettings.promptPolish.engine === 'provider') {
        let polishSecretAvailable = promptPolishSecretAvailable;
        if (desktopRuntime) {
          const polishStatus = await getProviderSecretStatus(PROMPT_POLISH_SECRET_ID);
          polishSecretAvailable = polishStatus.available;
          setPromptPolishSecretAvailable(polishSecretAvailable);
        }
        const polishConfigReady = Boolean(appSettings.promptPolish.baseUrl.trim() && appSettings.promptPolish.modelId.trim());
        push({
          id: 'prompt-polish-channel',
          label: '提示词润色通道',
          level: polishConfigReady && polishSecretAvailable ? 'pass' : 'warn',
          detail: polishConfigReady
            ? polishSecretAvailable
              ? `模型润色使用独立凭据 ${PROMPT_POLISH_SECRET_ID}，不会复用生图平台 Key。`
              : `模型润色配置已填写，但独立凭据 ${PROMPT_POLISH_SECRET_ID} 尚未保存；失败时会按设置回退到本地规则。`
            : '当前启用模型润色，但 Base URL 或模型 ID 不完整；建议补全或切回本地规则。'
        });
      } else {
        push({
          id: 'prompt-polish-channel',
          label: '提示词润色通道',
          level: 'info',
          detail: '当前默认使用本地规则润色，不消耗额度；模型润色仍保留独立凭据通道。'
        });
      }

      if (targetConfig.protocol === 'responses') {
        push({
          id: 'responses-background',
          label: 'Responses 后台轮询',
          level: 'info',
          detail: '生成请求会优先尝试 background/store 并轮询 response id；若中转不支持 background 会回退同步请求，长任务仍可能受 524 影响。'
        });
      }

      if (!targetSupportsModelList) {
        const nextConfig = ensureManualModelOption(targetConfig);
        if (!targetProfile || targetProfile.id === selectedProfileId) {
          setProviderConfig(nextConfig);
          saveProviderConfig(targetProviderId, nextConfig);
          setSelectedModel(nextConfig.modelId);
        }
        profileStatus = 'warning';
        profileMessage = '当前官方 API 暂不提供 OpenAI 兼容模型列表；已保留模板内置模型和手动模型 ID，可继续用真实试生图验证。';
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
          label: '模型列表连通性',
          level: 'info',
          detail: profileMessage
        });
        return;
      }

      if (!desktopRuntime || !currentSecretAvailable) {
        profileStatus = 'warning';
        profileMessage = !desktopRuntime ? '需要 Tauri 桌面端运行时。' : '缺少 API Key，未执行在线延迟测试。';
        push({
          id: 'network',
          label: '模型列表连通性',
          level: 'info',
          detail: '需要桌面端和已保存密钥后才能执行在线模型列表诊断。'
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
        const modelProbe = buildModelProbe(targetConfig.modelId, modelOptions, '来自配置自检。');
        profileStatus = models.length > 0 && modelProbe.available ? 'passed' : 'warning';
        profileMessage =
          models.length > 0 && modelProbe.available
            ? `连接成功，延迟 ${latencyMs} ms，读取 ${models.length} 个模型，当前模型可见。`
            : models.length > 0
              ? `连接成功，延迟 ${latencyMs} ms，读取 ${models.length} 个模型，但当前模型未出现在列表中。`
            : `接口可调用，延迟 ${latencyMs} ms，但没有返回模型。`;
        push({
          id: 'models',
          label: '模型列表连通性',
          level: models.length > 0 ? 'pass' : 'warn',
          detail: models.length > 0 ? `成功读取 ${models.length} 个模型，其中 ${imageModelCount} 个 ID 包含 image；延迟 ${latencyMs} ms。` : `接口可调用但没有返回模型；延迟 ${latencyMs} ms，已保留当前手动模型 ID。`
        });
        push({
          id: 'model-probe',
          label: '当前模型探测',
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
          if (!targetProfile || targetProfile.id === selectedProfileId) {
            setProviderConfig(nextConfig);
            saveProviderConfig(targetProviderId, nextConfig);
            setSelectedModel(nextConfig.modelId);
          }
          profileStatus = 'warning';
          profileMessage = `${formatModelListFallbackMessage(error, nextConfig.modelId)} 延迟 ${latencyMs} ms。`;
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
            label: '模型列表连通性',
            level: 'warn',
            detail: profileMessage
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      profileStatus = 'failed';
      profileMessage = mapProviderErrorMessage(error);
      push({
        id: 'network-error',
        label: '在线诊断错误',
        level: 'fail',
        detail: mapProviderErrorMessage(error)
      });
    } finally {
      updateProviderProfileTestState(
        targetProfile?.id ?? selectedProfileId,
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
    setConfigMessage(`正在测试连接延迟：${profile.displayName}…`);
    await runProviderDiagnostics(profile);
  }

  async function runProviderTestGeneration() {
    if (!isSelectedServiceConfigurable) {
      setConfigMessage('当前服务模板尚未接入，暂不能真实试生图。');
      return;
    }
    if (!supportsOpenAICompatible) {
      setConfigMessage('当前平台还没有真实图片生成适配器，暂不能测试生成。');
      return;
    }
    if (!desktopRuntime) {
      setConfigMessage('测试生成需要 Tauri 桌面端运行时。');
      return;
    }
    if (!secretAvailable) {
      const savedSecret = await saveActiveProviderSecret();
      if (!savedSecret) {
        setConfigMessage('请先保存 API Key，再执行测试生成。');
        return;
      }
    }

    setIsRunningTestGeneration(true);
    setConfigMessage('正在调用真实接口生成 1 张测试小样…');
    const startedAt = performance.now();
    try {
      const normalizedConfig = normalizeProviderConfig(providerConfig);
      new URL(normalizedConfig.baseUrl);
      const extraHeaders = parseExtraHeaders(normalizedConfig.extraHeadersJson);
      if (!normalizedConfig.endpointPath.startsWith('/')) {
        throw new Error('接口路径必须以 / 开头。');
      }

      saveProviderConfig(selectedProvider.id, normalizedConfig);
      setProviderConfig(normalizedConfig);
      setSelectedModel(normalizedConfig.modelId);

      const result = await generateOpenAIImage({
        providerId: selectedProvider.id,
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
        secretId: activeSecretId(),
        metadata: { source: 'provider-hub-test-generation' }
      });
      const saved = await saveGenerationRecord(result, selectedProvider.name);
      addResult(saved);

      if (saved.status === 'succeeded' && saved.imageUrls[0]) {
        updateProviderProfileTestState(selectedProfileId, 'passed', Math.round(performance.now() - startedAt), '测试生成成功');
        setPage('providers');
        setGeneratePreviewUrl(null);
        setLibraryPreview(null);
        setConfigMessage('测试生成成功：已生成 1 张小样图，并自动保存到作品画廊。');
      } else if (isPotentialBackgroundCompletion(saved)) {
        const message = '测试生成待核查：同步连接先超时，但中转后台可能仍会继续生成。已写入作品画廊，稍后可重载历史或查看中转后台。';
        updateProviderProfileTestState(selectedProfileId, 'warning', Math.round(performance.now() - startedAt), message);
        setConfigMessage(message);
      } else {
        updateProviderProfileTestState(selectedProfileId, 'failed', Math.round(performance.now() - startedAt), saved.error ?? '接口没有返回图片。');
        setConfigMessage(`测试生成未成功：${mapProviderErrorMessage(saved.error ?? '接口没有返回图片。')} 已写入作品画廊失败记录。`);
      }
    } catch (error) {
      updateProviderProfileTestState(selectedProfileId, 'failed', Math.round(performance.now() - startedAt), mapProviderErrorMessage(error));
      setConfigMessage(mapProviderErrorMessage(error));
    } finally {
      setIsRunningTestGeneration(false);
    }
  }

  const shellIsEnglish = appSettings.language === 'en-US';
  const navLabels: Record<Page, string> = shellIsEnglish
    ? {
        home: 'Workspace',
        generate: 'AI Create',
        free: 'Free Tools',
        library: 'Gallery',
        inspiration: 'Inspiration',
        templates: 'Prompt Library',
        providers: 'Providers',
        settings: 'Preferences'
      }
    : {
        home: '工作台',
        generate: 'AI 创作',
        free: '免费平台',
        library: '作品画廊',
        inspiration: '灵感中心',
        templates: '提示词库',
        providers: '平台接入',
        settings: '偏好设置'
      };
  const navItems: Array<{ page: Page; label: string; icon: ReactNode }> = [
    { page: 'home', label: navLabels.home, icon: <Grid2X2 size={18} /> },
    { page: 'generate', label: navLabels.generate, icon: <Wand2 size={18} /> },
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
            <span className="brandGlyph">VH</span>
          </div>
          <div className="brandText">
            <strong>VisionHub Studio</strong>
            <span>{shellIsEnglish ? 'AI image workspace' : 'AI 生图工作台'}</span>
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

        <div className="sidebarDock">
          <div className="sectionTitle">工作区</div>
          <div className="dockCard">
            <strong>当前状态</strong>
            <span>{homeResultSummary.total} 条记录，{homeResultSummary.failed} 条失败，{homeResultSummary.pending} 条待核查。</span>
          </div>
          <div className="dockCard subtle">
            <strong>首页 V2</strong>
            <span>项目资产库、批量队列、多模型对比已整理为首页入口。</span>
          </div>
        </div>
        <div className="sidebarFooter">
          <button
            className="themeToggle"
            type="button"
            data-tooltip={resolvedThemeMode === 'dark' ? '切换浅色模式' : '切换暗色模式'}
            aria-label={resolvedThemeMode === 'dark' ? '切换浅色模式' : '切换暗色模式'}
            onClick={toggleThemeMode}
          >
            {resolvedThemeMode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{themeMode === 'system' ? '跟随系统' : resolvedThemeMode === 'dark' ? '暗色模式' : '浅色模式'}</span>
          </button>
          <button
            className="sidebarCollapseButton"
            type="button"
            data-tooltip={isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            aria-label={isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            onClick={() => updateSidebarCollapsed(!isSidebarCollapsed)}
          >
            <Sidebar size={17} />
            <span>{isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}</span>
          </button>
        </div>
      </aside>

      <main className={`workspace ${page === 'generate' ? 'workspaceGenerate' : page === 'home' ? 'workspaceHomeShell' : ''}`}>
        {isLibraryPageMounted ? (
          <CachedLibraryPage
            providers={providers}
            results={results}
            isHistoryLoaded={isHistoryLoaded}
            isActive={page === 'library'}
            preview={libraryPreview}
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
            isActive={page === 'inspiration'}
            preview={inspirationPreview}
            onPreview={openInspirationPreview}
            onNavigatePreview={navigateInspirationPreview}
            onClosePreview={closeInspirationPreview}
            onUseAsReference={useInspirationAssetAsReference}
            onUsePrompt={useInspirationPrompt}
            onCreateTemplate={createPromptTemplateFromInspiration}
            onRequestConfirm={requestConfirm}
            importVersion={inspirationImportVersion}
          />
        ) : null}
        {page === 'home' ? (
          <WorkspaceHomePage
            providerName={generationSelectedProvider.name}
            providerProfileName={activeGenerationProfile?.displayName ?? '未保存配置'}
            providerModelId={activeGenerationConfig.modelId || selectedModelId || '未选择模型'}
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
            onNavigate={navigateTo}
            onUseRecordAsReference={useRecordAsReference}
            onOpenComfyUIWorkflowManager={() => setIsComfyUIWorkflowManagerOpen(true)}
          />
        ) : page === 'generate' ? (
          <>
            <ModernGeneratePage
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
              onModelChange={(modelId) => {
                if (generationSupportsOpenAICompatible) handleConfigChange('modelId', modelId);
                else setSelectedModel(modelId);
              }}
              onPromptChange={setPrompt}
              onCountChange={setCount}
              onSizeChange={setSize}
              onQualityChange={setQuality}
              onGenerate={runCreativeDeskGenerate}
              onPreview={setGeneratePreviewUrl}
              onReloadHistory={loadHistory}
              onOpenLibrary={() => navigateTo('library')}
              onDeleteResult={removeResult}
              onRequestConfirm={requestConfirm}
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
            onCopyPrompt={copyPromptForPlatform}
            onOpenPlatform={openPlatform}
            onCopyPromptAndOpen={copyPromptAndOpenPlatform}
            onImportWebResult={importWebResultFromPlatform}
          />
        ) : page === 'providers' ? (
          <ProviderSettingsPage
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
            onLocalComfyUIBaseUrlChange={updateLocalComfyUIBaseUrl}
            onRunLocalComfyUIDiagnostics={runLocalComfyUIDiagnostics}
            onImportLocalComfyUIWorkflow={importLocalComfyUIWorkflow}
            onClearLocalComfyUIWorkflow={clearLocalComfyUIWorkflow}
            onToggleComfyUIWorkflowManager={() => setIsComfyUIWorkflowManagerOpen(true)}
          />
        ) : page === 'settings' ? (
          <SettingsPage
            appSettings={appSettings}
            providers={providers}
            desktopRuntime={desktopRuntime}
            storageSettings={storageSettings}
            promptPolishDraft={promptPolishDraft}
            promptPolishSecretDraft={promptPolishSecretDraft}
            promptPolishSecretAvailable={promptPolishSecretAvailable}
            isSavingPromptPolishSecret={isSavingPromptPolishSecret}
            isRefreshingPromptPolishModels={isRefreshingPromptPolishModels}
            onSettingsChange={updateAppSettings}
            onPromptPolishDraftChange={updatePromptPolishDraft}
            onSavePromptPolishConfig={savePromptPolishConfig}
            onRefreshPromptPolishModels={refreshPromptPolishModels}
            onPromptPolishSecretDraftChange={setPromptPolishSecretDraft}
            onSavePromptPolishSecret={savePromptPolishSecret}
            onSelectLibraryPath={selectLibraryDirectory}
            onResetLibraryPath={resetLibraryDirectoryOverride}
            onOpenLibraryDirectory={openLibraryDirectory}
            onSelectInspirationPath={selectInspirationDirectory}
            onResetInspirationPath={resetInspirationDirectoryOverride}
            onOpenInspirationDirectory={openInspirationDirectory}
            onOpenAppDataDirectory={openAppDataDirectory}
            onExportSettingsBackup={exportCurrentSettingsBackup}
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
            onUseTemplate={(templatePrompt) => {
              setPrompt(templatePrompt);
              navigateTo('generate');
            }}
          />
        ) : null}
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
      {isComfyUIWorkflowManagerOpen ? (
        <ComfyUIWorkflowManagerModal
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
          request={confirmDialog}
          onClose={() => setConfirmDialog(null)}
          onError={(error) => setConfirmDialog((current) => (current ? { ...current, error } : current))}
        />
      ) : null}
      {toasts.length ? (
        <div className="toastViewport" aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => (
            <div className={`appToast ${toast.level}`} key={toast.id}>
              <span />
              <p>{toast.message}</p>
              <button type="button" aria-label="关闭通知" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceHomePage(props: {
  providerName: string;
  providerProfileName: string;
  providerModelId: string;
  selectedProviderId: string;
  isRealProviderReady: boolean;
  secretAvailable: boolean;
  desktopRuntime: boolean;
  localComfyUIDiagnostic: LocalComfyUIDiagnosticState;
  localComfyUIWorkflowStore: LocalComfyUIWorkflowStore;
  activeComfyUIWorkflowPreset: LocalComfyUIWorkflowPreset | null;
  resultSummary: { total: number; succeeded: number; failed: number; pending: number };
  recentSuccessRecords: GenerationRecord[];
  recentFailureRecords: GenerationRecord[];
  favoriteRecords: GenerationRecord[];
  referenceRecords: GenerationRecord[];
  providerNameMap: Map<string, string>;
  homeModules: HomeModuleSettings;
  onNavigate: (page: Page) => void;
  onUseRecordAsReference: (record: GenerationRecord) => void;
  onOpenComfyUIWorkflowManager: () => void;
}) {
  const runnableWorkflowCount = props.localComfyUIWorkflowStore.presets.filter((preset) => Boolean(preset.rawWorkflow)).length;
  const comfyStatusLabel =
    props.localComfyUIDiagnostic.status === 'online'
      ? 'ComfyUI 在线'
      : props.localComfyUIDiagnostic.status === 'offline'
        ? 'ComfyUI 离线'
        : props.localComfyUIDiagnostic.status === 'failed'
          ? '连接失败'
          : props.localComfyUIDiagnostic.status === 'checking'
            ? '检查中'
            : '本地服务待检查';
  const comfyStatusTone =
    props.localComfyUIDiagnostic.status === 'online'
      ? 'ready'
      : props.localComfyUIDiagnostic.status === 'offline' || props.localComfyUIDiagnostic.status === 'failed'
        ? 'warning'
        : 'idle';
  const providerStatusTone = props.isRealProviderReady ? 'ready' : props.selectedProviderId === 'comfyui-local' || props.secretAvailable ? 'warning' : 'idle';
  const providerStatusLabel = props.isRealProviderReady
    ? '生成通道可用'
    : props.selectedProviderId === 'comfyui-local'
      ? '本地工作流待就绪'
      : '等待密钥或配置';
  const activeWorkflow = props.activeComfyUIWorkflowPreset;
  const activeWorkflowStatus = activeWorkflow ? comfyUIWorkflowRunStatus(activeWorkflow) : null;
  const continueRecord = props.recentSuccessRecords[0] ?? props.referenceRecords[0] ?? props.favoriteRecords[0] ?? null;
  const materialRecords = mergeWorkspaceRecords([
    ...props.recentSuccessRecords,
    ...props.referenceRecords,
    ...props.favoriteRecords
  ]).slice(0, 8);
  const pendingTaskCount = props.recentFailureRecords.length + props.resultSummary.pending;
  const quickActions: Array<{ page: Page; label: string; detail: string; icon: ReactNode }> = [
    { page: 'generate', label: 'AI 创作', detail: '继续生成', icon: <Wand2 size={16} /> },
    { page: 'library', label: '作品画廊', detail: '管理结果', icon: <Image size={16} /> },
    { page: 'inspiration', label: '灵感中心', detail: '收集素材', icon: <Bookmark size={16} /> },
    { page: 'templates', label: '提示词库', detail: '复用模板', icon: <Layers size={16} /> },
    { page: 'providers', label: '平台接入', detail: '检查配置', icon: <Database size={16} /> }
  ];
  const roadmapItems = [
    { title: '项目资产库', state: '入口 MVP', page: 'library' as Page },
    { title: '批量队列', state: '规划中', page: 'generate' as Page },
    { title: '多模型对比', state: '规划中', page: 'providers' as Page }
  ];

  function useRecordAsReferenceAndCreate(record: GenerationRecord) {
    props.onUseRecordAsReference(record);
    props.onNavigate('generate');
  }

  return (
    <section className="workspaceHome workspaceHomeV21" aria-label="工作台首页">
      <header className="workspaceCommandBar">
        <div className="workspaceCommandTitle">
          <span>Workspace Control</span>
          <h1>工作台首页</h1>
        </div>
        <div className="workspaceCommandStatus" aria-label="当前状态">
          <span className={`workspaceStatusPill ${providerStatusTone}`}>
            <ShieldCheck size={14} /> {providerStatusLabel}
          </span>
          <span className={`workspaceStatusPill ${comfyStatusTone}`}>
            <HardDrive size={14} /> {comfyStatusLabel}
          </span>
          <span className="workspaceStatusPill neutral">本地优先 · Key 不导出</span>
        </div>
        <div className="workspaceCommandActions">
          <button type="button" className="workspaceCommandButton primary" onClick={() => props.onNavigate('generate')}>
            <Wand2 size={15} /> 开始创作
          </button>
          <button type="button" className="workspaceCommandButton" onClick={() => props.onNavigate('library')}>
            <Image size={15} /> 打开画廊
          </button>
          <button type="button" className="workspaceCommandButton" onClick={() => props.onNavigate('providers')}>
            <Gauge size={15} /> 检查配置
          </button>
        </div>
      </header>

      {props.homeModules.resume || props.homeModules.attention ? (
      <section className={`workspaceFlowGrid ${!props.homeModules.resume || !props.homeModules.attention ? 'singleModule' : ''}`} aria-label="继续工作与待处理">
        {props.homeModules.resume ? <article className={`workspaceContinuePanel ${continueRecord ? '' : 'isEmpty'}`}>
          <div className="workspaceSectionHeading">
            <div>
              <p className="eyebrow">Resume</p>
              <h2>继续上次创作</h2>
            </div>
            <span className="workspaceSoftCounter">{props.resultSummary.succeeded} 张成功作品</span>
          </div>
          {continueRecord ? (
            <div className="workspaceContinueBody">
              <button
                type="button"
                className="workspaceContinuePreview"
                onClick={() => props.onNavigate('library')}
                aria-label="打开作品画廊查看最近作品"
              >
                <img src={continueRecord.imageUrls[0]} alt={continueRecord.prompt || getRecordFileName(continueRecord) || '最近生成作品'} loading="lazy" decoding="async" />
              </button>
              <div className="workspaceContinueInfo">
                <strong>{getRecordFileName(continueRecord) || continueRecord.prompt || '未命名作品'}</strong>
                <p>{continueRecord.prompt || '这条记录没有保存 Prompt，可以从画廊查看详情。'}</p>
                <div className="workspaceContinueMeta">
                  <span>{props.providerNameMap.get(continueRecord.providerId) ?? continueRecord.providerName ?? props.providerName}</span>
                  <span>{continueRecord.modelId || props.providerModelId}</span>
                  <span>{formatWorkspaceHomeTime(continueRecord.createdAt)}</span>
                </div>
                <div className="workspaceContinueActions">
                  <button type="button" className="workspaceCommandButton primary" onClick={() => useRecordAsReferenceAndCreate(continueRecord)}>
                    <ImagePlus size={15} /> 设为参考并创作
                  </button>
                  <button type="button" className="workspaceCommandButton" onClick={() => props.onNavigate('library')}>
                    <ExternalLink size={15} /> 打开详情
                  </button>
                  <button type="button" className="workspaceCommandButton" onClick={() => props.onNavigate('generate')}>
                    <Wand2 size={15} /> 继续创作台
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <WorkspaceHomeEmpty title="还没有可继续的作品" hint="进入 AI 创作生成第一张图后，这里会显示最近任务。" actionLabel="开始创作" onAction={() => props.onNavigate('generate')} />
          )}
        </article> : null}

        {props.homeModules.attention ? <aside className="workspaceTaskRail" aria-label="待处理与运行状态">
          <div className="workspaceMiniStats">
            <span><strong>{props.resultSummary.total}</strong>生成记录</span>
            <span><strong>{props.favoriteRecords.length}</strong>最近收藏</span>
            <span><strong>{props.referenceRecords.length}</strong>最近参考</span>
          </div>
          <div className="workspaceTodoPanel">
            <div className="workspaceSectionHeading compact">
              <div>
                <p className="eyebrow">Attention</p>
                <h2>待处理</h2>
              </div>
              <span className={pendingTaskCount ? 'workspaceSoftCounter warning' : 'workspaceSoftCounter'}>{pendingTaskCount} 项</span>
            </div>
            {props.recentFailureRecords.length || props.resultSummary.pending ? (
              <div className="workspaceTodoList">
                {props.resultSummary.pending ? (
                  <button type="button" className="workspaceTodoItem" onClick={() => props.onNavigate('library')}>
                    <span className="workspaceTodoDot pending" />
                    <span><strong>{props.resultSummary.pending} 条后台待核查</strong><small>可能需要重新检查生成状态</small></span>
                  </button>
                ) : null}
                {props.recentFailureRecords.map((record) => {
                  const diagnosis = diagnoseGenerationFailure(record);
                  return (
                    <button type="button" className="workspaceTodoItem" key={record.id} onClick={() => props.onNavigate('library')}>
                      <span className={`workspaceTodoDot ${generationStatusClass(record)}`} />
                      <span>
                        <strong>{generationStatusLabel(record)} · {generationFailureCategoryLabels[diagnosis.category]}</strong>
                        <small>{diagnosis.title} · {formatWorkspaceHomeTime(record.createdAt)}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <WorkspaceHomeEmpty title="暂无异常" hint="失败、待核查和需要配置的任务会集中出现在这里。" />
            )}
          </div>
          <div className="workspaceLocalSummary">
            <div>
              <strong>本地模型</strong>
              <span>{props.localComfyUIWorkflowStore.presets.length} 个 workflow / {runnableWorkflowCount} 个可生成</span>
              <small>{activeWorkflow ? `${activeWorkflow.name} · ${workflowFormatLabel(activeWorkflow.summary.format)} · ${activeWorkflowStatus ?? '待检查'}` : '未选择 workflow'}</small>
            </div>
            <button type="button" className="workspaceIconAction" onClick={props.onOpenComfyUIWorkflowManager} aria-label="打开 workflow 管理" title="打开 workflow 管理">
              <SlidersHorizontal size={15} />
            </button>
          </div>
        </aside> : null}
      </section>
      ) : null}

      {props.homeModules.materials ? <section className="workspaceAssetStripPanel" aria-label="最近素材">
        <div className="workspaceSectionHeading">
          <div>
            <p className="eyebrow">Material Strip</p>
            <h2>最近素材</h2>
          </div>
          <div className="workspaceStripFilters" aria-label="素材来源">
            <span>最近生成</span>
            <span>参考图</span>
            <span>收藏</span>
          </div>
        </div>
        {materialRecords.length ? (
          <div className="workspaceAssetStrip">
            {materialRecords.map((record) => (
              <article className="workspaceAssetTile" key={record.id}>
                <button type="button" className="workspaceAssetThumb" onClick={() => props.onNavigate('library')} aria-label="打开作品画廊查看素材">
                  <img src={record.imageUrls[0]} alt={record.prompt || getRecordFileName(record) || '素材缩略图'} loading="lazy" decoding="async" />
                </button>
                <div className="workspaceAssetMeta">
                  <strong>{getRecordFileName(record) || record.prompt || '未命名素材'}</strong>
                  <span>{formatWorkspaceHomeTime(record.createdAt)}</span>
                </div>
                <div className="workspaceAssetActions">
                  <button type="button" onClick={() => useRecordAsReferenceAndCreate(record)}>参考</button>
                  <button type="button" onClick={() => props.onNavigate('library')}>详情</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <WorkspaceHomeEmpty title="暂无素材" hint="生成、收藏或设为参考后，素材会以横向条带展示。" actionLabel="进入画廊" onAction={() => props.onNavigate('library')} />
        )}
      </section> : null}

      {props.homeModules.quickActions ? <section className="workspaceCommandDock" aria-label="常用入口">
        <span className="workspaceDockLabel">常用入口</span>
        {quickActions.map((item) => (
          <button type="button" key={item.page} className="workspaceDockButton" onClick={() => props.onNavigate(item.page)}>
            {item.icon}
            <span><strong>{item.label}</strong><small>{item.detail}</small></span>
          </button>
        ))}
      </section> : null}

      {props.homeModules.roadmap ? <section className="workspaceRouteStrip" aria-label="后续路线">
        <span className="workspaceDockLabel">后续路线</span>
        {roadmapItems.map((item) => (
          <button type="button" key={item.title} className="workspaceRouteItem" onClick={() => props.onNavigate(item.page)}>
            <strong>{item.title}</strong>
            <small>{item.state}</small>
          </button>
        ))}
      </section> : null}
    </section>
  );
}

function mergeWorkspaceRecords(records: GenerationRecord[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (!record.imageUrls[0] || seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

function WorkspaceHomeEmpty(props: { title: string; hint: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="workspaceHomeEmpty">
      <Sparkles size={18} />
      <strong>{props.title}</strong>
      <small>{props.hint}</small>
      {props.actionLabel && props.onAction ? (
        <button type="button" className="workspaceCommandButton" onClick={props.onAction}>{props.actionLabel}</button>
      ) : null}
    </div>
  );
}

function formatWorkspaceHomeTime(value: string) {
  const time = getRecordTimeMs(value);
  if (!time) return '时间未知';
  const diffMs = Date.now() - time;
  if (diffMs < 60 * 1000) return '刚刚';
  if (diffMs < 60 * 60 * 1000) return `${Math.max(1, Math.round(diffMs / (60 * 1000)))} 分钟前`;
  if (diffMs < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.round(diffMs / (60 * 60 * 1000)))} 小时前`;
  if (diffMs < 7 * 24 * 60 * 60 * 1000) return `${Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)))} 天前`;
  return new Date(time).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
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
            <Gauge size={15} /> 当前平台：{props.selectedProvider.name}
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
  onCopyPrompt: (platform: FreePlatform) => void;
  onOpenPlatform: (platform: FreePlatform) => void;
  onCopyPromptAndOpen: (platform: FreePlatform) => void;
  onImportWebResult: (platform: FreePlatform, file: File) => void;
}) {
  type FreePlatformUsageStatus = 'unused' | 'registered' | 'favorite' | 'unavailable';
  type FreePlatformPrefs = Record<string, { status: FreePlatformUsageStatus; note: string }>;

  const FREE_PLATFORM_PREFS_KEY = 'visionhub.freePlatformPrefs.v1';
  const FREE_PLATFORM_LOGO_CACHE_KEY = 'visionhub.freePlatformLogoCache.v2';
  const statusOptions: Array<{ value: FreePlatformUsageStatus; label: string }> = [
    { value: 'unused', label: '未使用' },
    { value: 'registered', label: '已注册' },
    { value: 'favorite', label: '常用' },
    { value: 'unavailable', label: '暂不可用' }
  ];
  const commercialLabelMap: Record<FreePlatform['commercialUse'], string> = {
    unknown: '商用待确认',
    personal: '仅个人使用',
    limited: '商用需复核',
    allowed: '可商用'
  };
  const loginLabelMap: Record<FreePlatform['loginRequirement'], string> = {
    required: '需要登录',
    optional: '可免登录',
    unknown: '登录规则待确认'
  };
  function loadFreePlatformPrefs(): FreePlatformPrefs {
    const raw = readStorageValue(FREE_PLATFORM_PREFS_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as FreePlatformPrefs;
      return Object.fromEntries(
        Object.entries(parsed).map(([id, value]) => [
          id,
          {
            status: statusOptions.some((item) => item.value === value?.status) ? value.status : 'unused',
            note: typeof value?.note === 'string' ? value.note.slice(0, 500) : ''
          }
        ])
      );
    } catch (error) {
      console.warn('[VisionHub] free platform prefs parse failed; using defaults', error);
      return {};
    }
  }

  function loadFreePlatformLogoCache(): Record<string, string | null> {
    const raw = readStorageValue(FREE_PLATFORM_LOGO_CACHE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, string | null>;
      return Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => value === null || typeof value === 'string')
      );
    } catch (error) {
      console.warn('[VisionHub] free platform logo cache parse failed; using defaults', error);
      return {};
    }
  }

  const [regionFilter, setRegionFilter] = useState<'all' | FreePlatform['region']>('all');
  const [kindFilter, setKindFilter] = useState<'all' | FreePlatform['kind']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FreePlatformUsageStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [prefs, setPrefs] = useState<FreePlatformPrefs>(() => loadFreePlatformPrefs());
  const [detailPlatformId, setDetailPlatformId] = useState<string | null>(null);
  const [expandedListPlatformId, setExpandedListPlatformId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [importTargetPlatform, setImportTargetPlatform] = useState<FreePlatform | null>(null);
  const [resolvedLogoUrls, setResolvedLogoUrls] = useState<Record<string, string | null>>(() => loadFreePlatformLogoCache());
  const webResultInputRef = useRef<HTMLInputElement | null>(null);
  const promptReady = props.prompt.trim().length > 0;

  function savePrefs(nextPrefs: FreePlatformPrefs) {
    setPrefs(nextPrefs);
    writeStorageValue(FREE_PLATFORM_PREFS_KEY, JSON.stringify(nextPrefs));
  }

  function updatePlatformPrefs(platformId: string, patch: Partial<FreePlatformPrefs[string]>) {
    const current = prefs[platformId] ?? { status: 'unused', note: '' };
    savePrefs({
      ...prefs,
      [platformId]: {
        status: patch.status ?? current.status,
        note: patch.note ?? current.note
      }
    });
  }

  function toggleFavorite(platformId: string) {
    const current = prefs[platformId]?.status ?? 'unused';
    updatePlatformPrefs(platformId, { status: current === 'favorite' ? 'registered' : 'favorite' });
  }

  function startImportWebResult(platform: FreePlatform) {
    setImportTargetPlatform(platform);
    webResultInputRef.current?.click();
  }

  function resolveInitialLogoUrl(platform: FreePlatform) {
    return Object.prototype.hasOwnProperty.call(resolvedLogoUrls, platform.id)
      ? resolvedLogoUrls[platform.id]
      : platform.logoUrl;
  }

  function markResolvedLogoUrl(platformId: string, url: string | null) {
    setResolvedLogoUrls((current) => {
      if (current[platformId] === url) return current;
      const next = { ...current, [platformId]: url };
      const persistent = Object.fromEntries(Object.entries(next).filter(([, value]) => typeof value === 'string'));
      writeStorageValue(FREE_PLATFORM_LOGO_CACHE_KEY, JSON.stringify(persistent));
      return next;
    });
  }

  function handleWebResultSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = Array.from(event.target.files ?? []).find((item) => item.type.startsWith('image/'));
    if (file && importTargetPlatform) {
      props.onImportWebResult(importTargetPlatform, file);
    }
    event.target.value = '';
  }

  const filteredPlatforms = FREE_PLATFORMS.filter((platform) => {
    const platformPrefs = prefs[platform.id] ?? { status: 'unused', note: '' };
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesRegion = regionFilter === 'all' || platform.region === regionFilter;
    const matchesKind = kindFilter === 'all' || platform.kind === kindFilter;
    const matchesStatus = statusFilter === 'all' || platformPrefs.status === statusFilter;
    const matchesSearch = !normalizedQuery
      || [
        platform.name,
        platform.vendor,
        platform.bestFor,
        platform.freeQuota,
        platform.commercialNote,
        platform.promptHint,
        platform.tags.join(' '),
        platformPrefs.note
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesRegion && matchesKind && matchesStatus && matchesSearch;
  });
  const favoriteCount = FREE_PLATFORMS.filter((platform) => prefs[platform.id]?.status === 'favorite').length;

  return (
    <>
      <header className="topbar freeTopbar">
        <div className="pageTitleBlock">
          <p className="eyebrow">Web Platform Helper</p>
          <h1>免费平台助手</h1>
          <p>整理常用网页平台，复制适配 Prompt；网页生成后把下载图片导入图片收藏管理。</p>
        </div>
        <div className="statusPills">
          <span>
            <Gift size={15} /> {FREE_PLATFORMS.length} 个平台
          </span>
          <span>
            <Star size={15} /> {favoriteCount} 个常用
          </span>
          <span>
            <Copy size={15} /> {promptReady ? '可复制适配 Prompt' : '先写 Prompt'}
          </span>
        </div>
      </header>

      <section className="freeWorkflowStrip" aria-label="免费平台使用流程">
        <div>
          <strong>1. 复制并打开</strong>
          <span>把当前 Prompt 转成平台适配版并打开网页。</span>
        </div>
        <div>
          <strong>2. 网页生成下载</strong>
          <span>在平台网页里手动生成并下载图片。</span>
        </div>
        <div>
          <strong>3. 导入成品</strong>
          <span>选择下载图，存入灵感中心图片收藏。</span>
        </div>
      </section>

      <section className="freeToolbar">
        <input
          ref={webResultInputRef}
          className="visuallyHidden"
          type="file"
          accept="image/*"
          onChange={handleWebResultSelected}
        />
        <div className="freeFilterGroup">
          <div className="segmentedControl compactSegment">
            <button className={regionFilter === 'all' ? 'active' : ''} onClick={() => setRegionFilter('all')}>
              全部
            </button>
            <button className={regionFilter === 'china' ? 'active' : ''} onClick={() => setRegionFilter('china')}>
              国内
            </button>
            <button className={regionFilter === 'global' ? 'active' : ''} onClick={() => setRegionFilter('global')}>
              国外
            </button>
          </div>
        </div>
        <div className="freeActionGroup">
          <label className="freeSearchBox">
            <span>搜索平台 / 标签 / 备注</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="例如：图生图、商用、中文、海报"
            />
          </label>
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
          <StudioSelect
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as 'all' | FreePlatformUsageStatus)}
            options={[
              { value: 'all', label: '全部状态' },
              ...statusOptions
            ]}
          />
          <button
            className={`miniButton favoriteFilterButton ${statusFilter === 'favorite' ? 'active' : ''}`}
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'favorite' ? 'all' : 'favorite')}
            title={statusFilter === 'favorite' ? '显示全部平台' : '只看收藏平台'}
            aria-label={statusFilter === 'favorite' ? '显示全部平台' : '只看收藏平台'}
          >
            <Star size={13} fill={statusFilter === 'favorite' ? 'currentColor' : 'none'} /> 收藏
          </button>
          <div className="segmentedControl compactSegment freeViewSwitch" aria-label="免费平台视图切换">
            <button className={viewMode === 'card' ? 'active' : ''} onClick={() => setViewMode('card')}>
              <Grid2X2 size={13} /> 卡片
            </button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>
              <Layers size={13} /> 列表
            </button>
          </div>
        </div>
      </section>

      <section className={viewMode === 'list' ? 'freePlatformList' : 'freePlatformGrid'}>
        {filteredPlatforms.map((platform) => {
          const platformPrefs = prefs[platform.id] ?? { status: 'unused', note: '' };
          const isListExpanded = viewMode === 'list' && expandedListPlatformId === platform.id;
          return (
          <article className={`freePlatformCard ${viewMode === 'list' ? 'listMode' : ''} ${isListExpanded ? 'expanded' : ''}`} key={platform.id}>
            <div className="freePlatformHeader">
              <div
                className="freePlatformLogo"
                style={{ background: platform.brandColor }}
                aria-label={`${platform.name} Logo`}
              >
                {resolveInitialLogoUrl(platform) ? (
                  <img
                    src={resolveInitialLogoUrl(platform) ?? undefined}
                    alt=""
                    loading="lazy"
                    onLoad={(event) => markResolvedLogoUrl(platform.id, event.currentTarget.currentSrc || event.currentTarget.src)}
                    onError={(event) => {
                      const image = event.currentTarget;
                      const fallbackIndex = Number(image.dataset.fallbackIndex ?? '0');
                      const fallbackUrls = platform.fallbackLogoUrls?.length
                        ? platform.fallbackLogoUrls
                        : [platform.fallbackLogoUrl];
                      const nextUrl = fallbackUrls[fallbackIndex];
                      if (nextUrl) {
                        image.dataset.fallbackIndex = String(fallbackIndex + 1);
                        image.src = nextUrl;
                        return;
                      }
                      markResolvedLogoUrl(platform.id, null);
                    }}
                  />
                ) : null}
                <span>{platform.logoText}</span>
              </div>
              <div>
                <strong>{platform.name}</strong>
                <small>{platform.vendor}</small>
              </div>
              <button
                className={`iconButton favoritePlatformButton ${platformPrefs.status === 'favorite' ? 'active' : ''}`}
                onClick={() => toggleFavorite(platform.id)}
                title={platformPrefs.status === 'favorite' ? '取消常用' : '标记常用'}
                aria-label={platformPrefs.status === 'favorite' ? `取消常用 ${platform.name}` : `标记常用 ${platform.name}`}
              >
                <Star size={15} fill={platformPrefs.status === 'favorite' ? 'currentColor' : 'none'} />
              </button>
            </div>

            <div className="freePlatformMeta">
              <span>{platform.region === 'china' ? '国内平台' : '海外平台'}</span>
              <span>{platform.kind === 'image-video' ? '图像 / 视频' : platform.kind === 'chat-image' ? '聊天生图' : '图片生成'}</span>
              <span>{loginLabelMap[platform.loginRequirement]}</span>
              <span>{platform.supportsImageToImage ? '支持图生图' : '偏文生图'}</span>
            </div>

            <p>{platform.bestFor}</p>
            <div className="freePlatformQuickInfo">
              <span>{platform.freeQuota}</span>
              <span>{commercialLabelMap[platform.commercialUse]}</span>
            </div>

            <div className="freePlatformActions">
              <button
                className="miniButton primaryMini"
                onClick={() => props.onCopyPromptAndOpen(platform)}
                title={promptReady ? `复制 ${platform.name} 专用 Prompt 并打开网页` : `打开 ${platform.name} 网页`}
                aria-label={promptReady ? `复制 ${platform.name} 专用 Prompt 并打开网页` : `打开 ${platform.name} 网页`}
              >
                <ExternalLink size={13} /> 复制并打开
              </button>
              <button
                className="miniButton"
                onClick={() => startImportWebResult(platform)}
                title={`导入从 ${platform.name} 网页下载的图片`}
                aria-label={`导入从 ${platform.name} 网页下载的图片`}
              >
                <FolderOpen size={13} /> 导入成品
              </button>
              <button
                className="miniButton subtleMini freePlatformDetailButton"
                onClick={() => {
                  if (viewMode === 'card') {
                    setDetailPlatformId(platform.id);
                    return;
                  }
                  setExpandedListPlatformId((current) => current === platform.id ? null : platform.id);
                }}
                title={`查看 ${platform.name} 详情`}
                aria-label={`查看 ${platform.name} 详情`}
              >
                <Info size={13} /> 详情
              </button>
            </div>
            {isListExpanded ? (
              <div className="freePlatformExpandedPanel">
                <div className="freePlatformDetails">
                  <small><strong>额度：</strong>{platform.freeQuota}</small>
                  <small><strong>限制：</strong>{platform.watermarkLimit}</small>
                  <small><strong>商用：</strong>{platform.commercialNote}</small>
                  <small><strong>Prompt：</strong>{platform.promptHint}</small>
                </div>
                <div className="freePlatformDetailControls">
                  <label>
                    使用状态
                    <StudioSelect
                      value={platformPrefs.status}
                      onChange={(value) => updatePlatformPrefs(platform.id, { status: value as FreePlatformUsageStatus })}
                      options={statusOptions}
                    />
                  </label>
                </div>
                <label>
                  我的备注
                  <textarea
                    value={platformPrefs.note}
                    onChange={(event) => updatePlatformPrefs(platform.id, { note: event.target.value.slice(0, 500) })}
                    placeholder={`记录 ${platform.name} 的账号、额度、试用结果或商用注意`}
                    rows={3}
                  />
                </label>
              </div>
            ) : null}
          </article>
        );
        })}
      </section>
      {viewMode === 'card' && detailPlatformId ? (() => {
        const platform = FREE_PLATFORMS.find((item) => item.id === detailPlatformId);
        if (!platform) return null;
        const platformPrefs = prefs[platform.id] ?? { status: 'unused', note: '' };
        return (
          <div className="freePlatformDrawerBackdrop" onClick={() => setDetailPlatformId(null)}>
            <aside className="freePlatformDrawer" role="dialog" aria-modal="true" aria-label={`${platform.name} 详情`} onClick={(event) => event.stopPropagation()}>
              <div className="freePlatformDrawerHeader">
                <div className="freePlatformLogo" style={{ background: platform.brandColor }} aria-label={`${platform.name} Logo`}>
                  {resolveInitialLogoUrl(platform) ? (
                    <img
                      src={resolveInitialLogoUrl(platform) ?? undefined}
                      alt=""
                      loading="lazy"
                      onLoad={(event) => markResolvedLogoUrl(platform.id, event.currentTarget.currentSrc || event.currentTarget.src)}
                      onError={(event) => {
                        const image = event.currentTarget;
                        const fallbackIndex = Number(image.dataset.fallbackIndex ?? '0');
                        const fallbackUrls = platform.fallbackLogoUrls?.length
                          ? platform.fallbackLogoUrls
                          : [platform.fallbackLogoUrl];
                        const nextUrl = fallbackUrls[fallbackIndex];
                        if (nextUrl) {
                          image.dataset.fallbackIndex = String(fallbackIndex + 1);
                          image.src = nextUrl;
                          return;
                        }
                        markResolvedLogoUrl(platform.id, null);
                      }}
                    />
                  ) : null}
                  <span>{platform.logoText}</span>
                </div>
                <div>
                  <p className="eyebrow">Web Platform Detail</p>
                  <h2>{platform.name}</h2>
                  <small>{platform.vendor}</small>
                </div>
                <button className="iconButton" onClick={() => setDetailPlatformId(null)} aria-label="关闭详情">
                  <X size={16} />
                </button>
              </div>
              <div className="freePlatformMeta">
                <span>{platform.region === 'china' ? '国内平台' : '海外平台'}</span>
                <span>{platform.kind === 'image-video' ? '图像 / 视频' : platform.kind === 'chat-image' ? '聊天生图' : '图片生成'}</span>
                <span>{loginLabelMap[platform.loginRequirement]}</span>
                <span>{platform.supportsImageToImage ? '支持图生图' : '偏文生图'}</span>
              </div>
              <p className="freePlatformDrawerSummary">{platform.bestFor}</p>
              <div className="freePlatformDetails">
                <small><strong>额度：</strong>{platform.freeQuota}</small>
                <small><strong>限制：</strong>{platform.watermarkLimit}</small>
                <small><strong>商用：</strong>{platform.commercialNote}</small>
                <small><strong>Prompt：</strong>{platform.promptHint}</small>
              </div>
              <label className="freePlatformDrawerField">
                <span>使用状态</span>
                <StudioSelect
                  value={platformPrefs.status}
                  onChange={(value) => updatePlatformPrefs(platform.id, { status: value as FreePlatformUsageStatus })}
                  options={statusOptions}
                />
              </label>
              <div className="freePlatformDrawerActions">
                <button className="miniButton primaryMini" onClick={() => props.onCopyPromptAndOpen(platform)}>
                  <ExternalLink size={13} /> 复制并打开
                </button>
                <button className="miniButton" disabled={!promptReady} onClick={() => props.onCopyPrompt(platform)}>
                  <Copy size={13} /> 只复制 Prompt
                </button>
                <button className="miniButton" onClick={() => props.onOpenPlatform(platform)}>
                  <Globe2 size={13} /> 只打开网页
                </button>
                <button className="miniButton" onClick={() => startImportWebResult(platform)}>
                  <FolderOpen size={13} /> 导入成品
                </button>
              </div>
              <label className="freePlatformDrawerField">
                <span>我的备注</span>
                <textarea
                  value={platformPrefs.note}
                  onChange={(event) => updatePlatformPrefs(platform.id, { note: event.target.value.slice(0, 500) })}
                  placeholder={`记录 ${platform.name} 的账号、额度、试用结果或商用注意`}
                  rows={4}
                />
              </label>
            </aside>
          </div>
        );
      })() : null}
    </>
  );
}

function ProviderSettingsPage(props: {
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
  onLocalComfyUIBaseUrlChange: (baseUrl: string) => void;
  onRunLocalComfyUIDiagnostics: () => void;
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
  const selectedPlatform = props.platformOptions.find((item) => item.id === props.selectedPlatformType);
  const serviceTemplateOptions = props.serviceTemplates.map((template) => ({
    value: template.id,
    label: `${providerServiceRegionLabel[template.region]} · ${template.label}`,
    description: `${providerServiceStatusLabel[template.status]} · ${template.description}`
  }));
  const providerMatrixRows = props.serviceTemplates.map((template) => ({
    template,
    cells: providerMatrixColumns.map((column) => getProviderCapabilityMatrixCell(template, column, props.providers))
  }));
  const [isCapabilityMatrixOpen, setIsCapabilityMatrixOpen] = useState(false);
  const [isReadinessOpen, setIsReadinessOpen] = useState(false);
  const activeProfile = props.providerProfiles.find((profile) => profile.id === props.selectedProfileId) ?? null;
  const isGenerationProviderSelected = props.selectedProviderId === props.generationProviderId;
  const generationProfile = isGenerationProviderSelected
    ? props.providerProfiles.find((profile) => profile.enabled) ?? props.providerProfiles[0] ?? null
    : null;
  const generationProfileSummary = !isGenerationProviderSelected
    ? 'AI 创作当前使用其他平台'
    : generationProfile
      ? `AI 创作使用 ${generationProfile.displayName}`
      : 'AI 创作暂无配置';
  const profileFilterOptions = buildProviderProfileFilterOptions(props.providerProfiles);
  const filteredProviderProfiles = props.providerProfiles.filter((profile) => matchesProviderProfileFilter(profile, profileFilter));
  const visibleProviderProfiles = props.isSelectedServiceConfigurable ? filteredProviderProfiles : [];
  const readinessItems = buildProviderReadinessItems({
    profile: activeProfile,
    config: props.providerConfig,
    providerId: props.selectedProviderId,
    desktopRuntime: props.desktopRuntime,
    secretAvailable: props.secretAvailable,
    serviceConfigurable: props.isSelectedServiceConfigurable,
    supportsOpenAICompatible: props.supportsOpenAICompatible
  });
  const offlineDiagnosticItems = [
    ...readinessItems,
    buildGenerationUsageReadinessItem({
      profile: activeProfile,
      generationProfile,
      selectedProviderId: props.selectedProviderId,
      generationProviderId: props.generationProviderId
    })
  ];
  const offlineDiagnosticSummary = buildOfflineDiagnosticSummary({
    profile: activeProfile,
    config: props.providerConfig,
    desktopRuntime: props.desktopRuntime,
    secretAvailable: props.secretAvailable,
    generationProfile,
    selectedProviderId: props.selectedProviderId,
    generationProviderId: props.generationProviderId
  });
  const protocolOptions = [
    {
      value: 'images',
      label: 'OpenAI Images API',
      description: '适合 OpenAI 官方图片生成和多数图片中转，默认路径 /v1/images/generations。'
    },
    {
      value: 'responses',
      label: 'OpenAI Responses API',
      description: '适合支持 Responses 协议的上游，可用文本 + 图片工具方式生成图片。'
    },
    {
      value: 'chat-completions',
      label: 'Chat Completions 图片包装',
      description: '适合把图片生成包装进聊天接口的中转站，兼容性取决于服务商实现。'
    },
    {
      value: 'custom-images',
      label: '自定义图片接口路径',
      description: '适合非标准图片接口，可手动填写 endpoint path。'
    }
  ];
  const imageToImageAdapterOptions = IMAGE_TO_IMAGE_ADAPTERS.map((adapter) => ({
    value: adapter,
    label: imageToImageAdapterLabel(adapter),
    description: imageToImageAdapterDescription(adapter)
  }));
  const workflowFileInputRef = useRef<HTMLInputElement | null>(null);
  const isComfyUITemplate = props.selectedServiceTemplate.id === 'local-comfyui';
  const comfyUIResult = props.localComfyUIDiagnostic.result;
  const activeWorkflowPreset = props.localComfyUIWorkflowStore.presets.find((item) => item.id === props.localComfyUIWorkflowStore.activeId) ?? props.localComfyUIWorkflowStore.presets[0] ?? null;
  const comfyUIStatusLabel: Record<LocalModelDiagnosticStatus, string> = {
    idle: '未测试',
    checking: '测试中',
    online: '在线',
    offline: '离线',
    failed: '失败'
  };

  return (
    <>
      <header className="topbar providerAccessTopbar">
        <div className="pageTitleBlock">
          <p className="eyebrow">Platform Access</p>
          <h1>平台接入</h1>
          <p>默认从中转站 / 聚合 API 开始；官方和本地待接入模板只展示规划，不会误触保存、启用或真实试生图。</p>
        </div>
      </header>

      <section className="settingsLayout providerAccessLayout">
        <div className="providerDirectory">
          <div className="providerAccessControls">
            <div>
              <span className="providerPickerLabel">平台类型</span>
              <div className="segmentedControl providerTypeSwitch">
                {props.platformOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={option.id === props.selectedPlatformType ? 'active' : ''}
                    onClick={() => props.onPlatformTypeChange(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <small>{selectedPlatform?.description}</small>
            </div>
            <label className="providerPickerLabel">
              服务模板
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
              <strong>配置实例</strong>
              <small>{props.providerProfiles.length} 个配置 · {generationProfileSummary}</small>
            </div>
            <button
              type="button"
              className="miniButton profileAddButton"
              onClick={props.onNewProfile}
              disabled={!props.isSelectedServiceConfigurable}
            >
              <Plus size={14} /> 新增
            </button>
          </div>
          <div className="providerProfileFilters" aria-label="配置实例筛选">
            {profileFilterOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                className={profileFilter === option.id ? 'active' : ''}
                onClick={() => setProfileFilter(option.id)}
              >
                <span>{option.label}</span>
                <strong>{option.count}</strong>
              </button>
            ))}
          </div>
          <div className="profileList">
            {!props.isSelectedServiceConfigurable ? (
              <div className="profileEmpty">
                <strong>{providerServiceStatusLabel[props.selectedServiceTemplate.status]}</strong>
                <span>当前模板只展示规划，暂不开放保存、启用或真实试生图。</span>
              </div>
            ) : props.providerProfiles.length === 0 ? (
              <div className="profileEmpty">
                <strong>还没有配置</strong>
                <span>点击新增后保存，配置会出现在这里。</span>
              </div>
            ) : visibleProviderProfiles.length === 0 ? (
              <div className="profileEmpty">
                <strong>没有匹配的配置</strong>
                <span>切换筛选条件，或新增一个配置实例。</span>
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
                      <span className={`profileStatus ${profile.lastTestStatus}`}>{profileLabel(profile.lastTestStatus)}</span>
                    </div>
                    <small>{profile.baseUrl.replace(/^https?:\/\//, '')} · {profile.modelId}</small>
                    <div className="profileMeta">
                      <span>{protocolLabel(profile.protocol)}</span>
                      {generationProfile?.id === profile.id ? <span className="activeUse">创作使用</span> : null}
                      {profile.lastLatencyMs ? <span>{profile.lastLatencyMs} ms</span> : null}
                      {profile.enabled ? <span className="enabled">已启用</span> : <span>未启用</span>}
                    </div>
                    <div className="profileModelSummary">
                      {typeof profile.lastModelCount === 'number' ? <span>模型 {profile.lastModelCount}</span> : <span>模型未刷新</span>}
                      {typeof profile.lastImageModelCount === 'number' ? <span>疑似图片 {profile.lastImageModelCount}</span> : null}
                      {profile.lastModelProbe ? (
                        <span className={profile.lastModelProbe.available ? 'matched' : 'missing'}>
                          {profile.lastModelProbe.available ? '当前模型已命中' : '当前模型未命中'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="profileActions" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className="iconMiniButton"
                      data-tooltip="测试连接延迟"
                      aria-label="测试连接延迟"
                      onClick={() => {
                        void props.onRunProfileConnectionTest(profile.id);
                      }}
                    >
                      <Gauge size={13} />
                    </button>
                    <button
                      type="button"
                      className="iconMiniButton"
                      data-tooltip="编辑配置"
                      aria-label="编辑配置"
                      onClick={() => props.onSelectProfile(profile.id)}
                    >
                      <Pencil size={13} />
                    </button>
                    <button type="button" className="iconMiniButton dangerMiniButton" data-tooltip="删除配置" aria-label="删除配置" onClick={() => props.onDeleteProfile(profile.id)}>
                      <Trash2 size={13} />
                    </button>
                    <button
                      type="button"
                      className={`profileSwitch ${profile.enabled ? 'on' : ''}`}
                      data-tooltip={profile.enabled ? '停用' : '启用'}
                      aria-label={profile.enabled ? '停用' : '启用'}
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
                  <strong>ComfyUI 连接诊断</strong>
                  <small>只读取本地服务基础信息，不提交 workflow，不加入生成队列。</small>
                </div>
                <span className={`serviceStatusBadge localDiagnostic-${props.localComfyUIDiagnostic.status}`}>
                  {comfyUIStatusLabel[props.localComfyUIDiagnostic.status]}
                </span>
              </div>
              <ServiceTemplateMeta template={props.selectedServiceTemplate} />
              <div className="localLabNotice">
                <HardDrive size={18} />
                <div>
                  <strong>本地实验室 MVP</strong>
                  <span>已支持 API workflow 文生图测试；普通 UI workflow 需要重新导出 API 格式后才能在创作台提交。</span>
                </div>
              </div>
              <label>
                本地服务地址
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
                  >
                    <Gauge size={15} /> {props.localComfyUIDiagnostic.status === 'checking' ? '测试中…' : '测试连接'}
                  </button>
                </div>
                <small className="providerFieldHint">
                  默认 ComfyUI 地址通常是 {DEFAULT_COMFYUI_BASE_URL}；如果改过监听端口，请填写实际地址。
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
                <div className="localDiagnosticMessage idle">填写地址后点击测试连接；未启动本地服务不会影响中转站 / 聚合 API 主流程。</div>
              )}
              {comfyUIResult ? (
                <div className="localDiagnosticStats">
                  <span>节点 {comfyUIResult.objectInfoNodeCount ?? '-'}</span>
                  <span>运行 {comfyUIResult.queueRunning ?? '-'}</span>
                  <span>待处理 {comfyUIResult.queuePending ?? '-'}</span>
                </div>
              ) : null}
              {comfyUIResult ? (
                <div className="localEndpointList">
                  {comfyUIResult.endpoints.map((endpoint) => (
                    <div className={`localEndpointItem ${endpoint.ok ? 'pass' : 'fail'}`} key={endpoint.path}>
                      <span>{endpoint.ok ? '通过' : '失败'}</span>
                      <div>
                        <strong>{endpoint.path}{endpoint.status ? ` · HTTP ${endpoint.status}` : ''}</strong>
                        <small>{endpoint.detail}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <section className="localWorkflowBox" aria-label="ComfyUI workflow JSON 解析预览">
                <div className="localWorkflowHeader">
                  <div>
                    <strong>Workflow JSON</strong>
                    <small>导入 API workflow 后，AI 创作台会写入 Prompt、尺寸和 Seed 并提交本地队列。</small>
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
                      <Upload size={14} /> 导入 JSON
                    </button>
                    {props.localComfyUIWorkflowStore.presets.length ? (
                      <button type="button" className="miniButton" onClick={props.onToggleComfyUIWorkflowManager}>
                        <Layers size={14} /> 管理器
                      </button>
                    ) : null}
                    {props.localComfyUIWorkflowStore.presets.length ? (
                      <button type="button" className="miniButton" onClick={props.onClearLocalComfyUIWorkflow}>
                        <X size={14} /> 清除
                      </button>
                    ) : null}
                  </div>
                </div>
                {props.localComfyUIWorkflowError ? (
                  <div className="localDiagnosticMessage failed">{props.localComfyUIWorkflowError}</div>
                ) : null}
                {activeWorkflowPreset ? (
                  <ComfyUIWorkflowSummaryPanel preset={activeWorkflowPreset} />
                ) : (
                  <div className="localDiagnosticMessage idle">
                    导入 ComfyUI API workflow JSON 后，会预览 Prompt、KSampler、尺寸、Checkpoint 和输出节点候选。
                  </div>
                )}
              </section>
              <div className="serviceTemplateNotes">
                {props.selectedServiceTemplate.notes.map((note) => (
                  <span key={note}>{note}</span>
                ))}
              </div>
            </div>
          ) : props.isSelectedServiceConfigurable && props.supportsOpenAICompatible ? (
            <div className="relayBox standalone">
              <div className="providerConfigHeader">
                <div>
                  <strong>配置详情</strong>
                  <small>{props.selectedServiceTemplate.label} · {props.selectedServiceTemplate.description}</small>
                </div>
                <span className={`serviceStatusBadge ${props.selectedServiceTemplate.status}`}>
                  {providerServiceStatusLabel[props.selectedServiceTemplate.status]}
                </span>
              </div>
              <ServiceTemplateMeta template={props.selectedServiceTemplate} />
              <div className="providerConfigHealth">
                <span>{activeProfile ? `配置：${profileLabel(activeProfile.lastTestStatus)}` : '配置：草稿'}</span>
                <span>{props.secretAvailable ? '密钥：已配置' : '密钥：未配置'}</span>
                <span>{activeProfile?.lastModelProbe ? (activeProfile.lastModelProbe.available ? '模型：已命中' : '模型：未命中') : '模型：未探测'}</span>
              </div>
              <section className="providerOfflineDiagnostic" aria-label="非消耗配置诊断">
                <div className="providerOfflineDiagnosticSummary">
                  <span>非消耗诊断</span>
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
                  placeholder={defaultBaseUrlPlaceholder(props.selectedProviderId)}
                />
              </label>
              <label>
                API Key
                <div className="secretInputRow">
                  <input
                    type="password"
                    placeholder={props.desktopRuntime ? props.selectedProvider.auth.label : '请在 Tauri 桌面端保存密钥'}
                    value={props.secretDraft}
                    onChange={(event) => props.onSecretDraftChange(event.target.value)}
                    disabled={!props.desktopRuntime}
                  />
                  <button
                    type="button"
                    className="iconButton secretSaveButton"
                    onClick={props.onSaveSecret}
                    disabled={!props.desktopRuntime || props.isSavingSecret || !props.secretDraft.trim()}
                  >
                    {props.isSavingSecret ? '保存中…' : '保存密钥'}
                  </button>
                </div>
              </label>
              <p className="secretMessage">
                密钥状态：{props.desktopRuntime ? (props.secretAvailable ? '已配置' : '未配置') : '网页预览模式'}
              </p>
              <label>
                模型 ID
                <div className="modelPicker">
                  <input
                    list="provider-model-options"
                    value={props.providerConfig.modelId}
                    onChange={(event) => props.onConfigChange('modelId', event.target.value)}
                    placeholder="填写服务商支持的模型 ID，例如 gpt-image-2 / nano-banana / qwen-image"
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
                    title={props.supportsModelList ? '刷新模型列表' : '当前官方 API 暂不提供 OpenAI 兼容模型列表'}
                    aria-label={props.supportsModelList ? '刷新模型列表' : '当前官方 API 暂不提供 OpenAI 兼容模型列表'}
                  >
                    {props.isRefreshingModels ? '…' : '刷新'}
                  </button>
                  <button className="iconButton" onClick={props.onProbeModel} disabled={props.isProbingModel || props.isRefreshingModels}>
                    {props.isProbingModel ? '…' : '探测'}
                  </button>
                  <button className="iconButton" onClick={props.onPinModel}>
                    默认
                  </button>
                </div>
              </label>

              <label>
                协议类型
                <StudioSelect
                  value={props.providerConfig.protocol}
                  onChange={(value) => props.onConfigChange('protocol', value as OpenAICompatibleConfig['protocol'])}
                  options={protocolOptions}
                />
              </label>
              <label>
                图生图映射
                <StudioSelect
                  value={props.providerConfig.imageToImageAdapter}
                  onChange={(value) => props.onConfigChange('imageToImageAdapter', value as ImageToImageAdapter)}
                  options={imageToImageAdapterOptions}
                />
                <small className="providerFieldHint">
                  {imageToImageAdapterDiagnosticDetail(props.providerConfig, props.selectedProviderId)}
                </small>
              </label>
              <label>
                接口路径
                <input
                  value={props.providerConfig.endpointPath}
                  onChange={(event) => props.onConfigChange('endpointPath', event.target.value)}
                  placeholder={defaultEndpointPlaceholder(props.selectedProviderId)}
                />
                <small className="providerFieldHint">
                  {providerEndpointHint(props.selectedProviderId)}
                </small>
              </label>
              <label>
                额外 Headers(JSON)
                <input
                  value={props.providerConfig.extraHeadersJson}
                  onChange={(event) => props.onConfigChange('extraHeadersJson', event.target.value)}
                  placeholder='{"X-Trace":"visionhub"}'
                />
              </label>
              <div className="providerPrimaryActions">
                <button className="ghostButton relaySave" onClick={props.onSaveOnly}>
                  保存
                </button>
                <button className="ghostButton relaySave primaryAction" onClick={props.onSaveConfig}>
                  {props.configActionState === 'saving'
                    ? '保存中…'
                    : props.configActionState === 'saved'
                      ? '已保存'
                      : props.configActionState === 'failed'
                        ? '保存失败'
                        : '保存并启用'}
                </button>
                <button className="ghostButton" type="button" onClick={props.onCopyConfig}>
                  <Copy size={15} /> 复制配置
                </button>
                <button className="ghostButton" type="button" onClick={props.onImportConfig}>
                  <ClipboardPaste size={15} /> 粘贴配置
                </button>
              </div>
              <div className="providerAuxToggles">
                <button
                  type="button"
                  className={`capabilityMatrixToggle readinessToggle ${isReadinessOpen ? 'open' : ''}`}
                  onClick={() => setIsReadinessOpen((value) => !value)}
                  aria-expanded={isReadinessOpen}
                >
                  <ChevronRight size={15} /> {isReadinessOpen ? '收起诊断' : '查看诊断详情'}
                </button>
                <button
                  type="button"
                  className={`capabilityMatrixToggle ${isCapabilityMatrixOpen ? 'open' : ''}`}
                  onClick={() => setIsCapabilityMatrixOpen((value) => !value)}
                  aria-expanded={isCapabilityMatrixOpen}
                >
                  <ChevronRight size={15} /> {isCapabilityMatrixOpen ? '收起矩阵' : '查看能力矩阵'}
                </button>
              </div>
              {isReadinessOpen ? (
                <section className="providerReadinessPanel" aria-label="非消耗配置诊断详情">
                  <div className="providerReadinessHeader">
                    <strong>非消耗诊断详情</strong>
                    <small>只检查本地配置、密钥通道、模型列表记录和创作页生效关系；不执行真实生成。</small>
                  </div>
                  <div className="providerReadinessGrid">
                    {offlineDiagnosticItems.map((item) => (
                      <div className={`providerReadinessItem ${item.level}`} key={item.id}>
                        <div>
                          <div className="providerReadinessTitleRow">
                            <strong>{item.label}</strong>
                            <span>{item.level === 'pass' ? '通过' : item.level === 'warn' ? '注意' : item.level === 'fail' ? '错误' : '提示'}</span>
                          </div>
                          <small>{item.detail}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
              {isCapabilityMatrixOpen ? (
                <section className="providerCapabilityPanel expanded" aria-label="平台能力矩阵 V2">
                  <div className="providerCapabilityHeaderBlock">
                    <div>
                      <strong>能力矩阵 V2</strong>
                      <small>按服务模板横向查看真实接入、可配置、待接入和本地规划状态。</small>
                    </div>
                    <div className="providerCapabilityLegend" aria-label="能力状态说明">
                      {(['live', 'configurable', 'partial', 'planned', 'localPlan'] as ProviderMatrixStatus[]).map((status) => (
                        <span className={`capabilityCell ${status}`} key={status}>{providerMatrixStatusLabel[status]}</span>
                      ))}
                    </div>
                  </div>
                  <div className="providerCapabilityScroll">
                    <div className="providerCapabilityGrid providerCapabilityTableHead" role="row">
                      <span>服务模板</span>
                      {providerMatrixColumns.map((column) => (
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
                            <strong>{row.template.label}</strong>
                            <small>{providerServiceRegionLabel[row.template.region]} · {providerServiceStatusLabel[row.template.status]} · {row.template.description}</small>
                          </span>
                          {row.cells.map((cell, index) => (
                            <span
                              className={`capabilityCell ${cell.status}`}
                              title={`${providerMatrixColumns[index].label}：${cell.label}。${cell.detail}`}
                              key={providerMatrixColumns[index].key}
                            >
                              {cell.label}
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
                    <strong>配置自检报告</strong>
                    <small>默认做非消耗检查；“真实试生图”会调用接口并可能消耗额度，当前 API Key 不可用时先不要点。</small>
                  </div>
                  <div className="diagnosticsActions">
                    <button className="rowActionButton" onClick={props.onRunDiagnostics} disabled={props.isRunningDiagnostics}>
                      <RefreshCcw size={15} /> {props.isRunningDiagnostics ? '自检中…' : '运行自检'}
                    </button>
                    <button className="rowActionButton" onClick={props.onCopyDiagnostics} disabled={!props.diagnostics.length} title="复制不含 API Key 的配置自检报告">
                      <Copy size={15} /> 复制报告
                    </button>
                    <button
                      className="rowActionButton primaryAction"
                      onClick={props.onRunTestGeneration}
                      disabled={!props.desktopRuntime || !props.secretAvailable || props.isRunningTestGeneration || !props.isSelectedServiceConfigurable}
                      title={!props.secretAvailable ? '请先保存 API Key' : '调用真实接口生成 1 张测试小样，可能消耗额度'}
                    >
                      <Sparkles size={15} /> {props.isRunningTestGeneration ? '测试中…' : '真实试生图'}
                    </button>
                  </div>
                </div>
                {props.diagnostics.length === 0 ? (
                  <p className="diagnosticsHint">保存配置后可运行自检；不会提交生图请求，也不会验证模型一定可生图。</p>
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
            </div>
          ) : (
            <div className="integrationBox">
              <strong>接入状态</strong>
              <p>{props.selectedServiceTemplate.description}</p>
              <ServiceTemplateMeta template={props.selectedServiceTemplate} />
              <div className="serviceTemplateNotes">
                {props.selectedServiceTemplate.notes.map((note) => (
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

function ServiceTemplateMeta({ template }: { template: ProviderServiceTemplate }) {
  const capabilityLabels = [
    template.supportsTextToImage ? '文生图' : null,
    template.supportsImageToImage ? '图生图' : null,
    template.requiresPolling ? '异步任务' : null
  ].filter(Boolean);

  return (
    <div className="serviceTemplateMeta" aria-label="服务模板信息">
      <span className={`regionBadge ${template.region}`}>{providerServiceRegionLabel[template.region]}</span>
      <span className={`serviceStatusBadge ${template.status}`}>{providerServiceStatusLabel[template.status]}</span>
      {capabilityLabels.length ? <span>{capabilityLabels.join(' / ')}</span> : <span>能力待确认</span>}
      {template.apiDocUrl ? (
        <span className="serviceDocHint">文档已登记</span>
      ) : null}
    </div>
  );
}

function ComfyUIWorkflowSummaryPanel({ preset }: { preset: LocalComfyUIWorkflowPreset }) {
  const summary = preset.summary;
  const groups: Array<{ label: string; nodes: LocalComfyUIWorkflowNode[] }> = [
    { label: '提示词', nodes: summary.promptNodes },
    { label: '采样器', nodes: summary.samplerNodes },
    { label: 'Checkpoint', nodes: summary.checkpointNodes },
    { label: '尺寸', nodes: summary.sizeNodes },
    { label: '输出', nodes: summary.outputNodes },
    { label: '加载器', nodes: summary.loaderNodes }
  ].filter((group) => group.nodes.length > 0);

  return (
    <div className="localWorkflowSummary">
      <div className="localWorkflowMeta">
        <span>{workflowFormatLabel(summary.format)}</span>
        <span>{comfyUIWorkflowRunStatus(preset)}</span>
        <span>节点 {summary.nodeCount}</span>
        <span>连线 {summary.linkCount ?? '-'}</span>
      </div>
      <div className="localWorkflowFile">
        <strong>{preset.name}</strong>
        <small>{summary.fileName} · {preset.rawWorkflow ? '已保存完整 API workflow，可在创作台测试。' : '当前只保存了解析摘要，需要重新导入 API workflow 才能生成。'}</small>
      </div>
      {summary.format === 'api' && !preset.rawWorkflow ? (
        <div className="localDiagnosticMessage failed">这是旧版导入记录，缺少完整 workflow JSON。请重新导入同一个 API workflow 文件。</div>
      ) : null}
      {summary.warnings.length ? (
        <div className="localWorkflowWarnings">
          {summary.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
      {groups.length ? (
        <div className="localWorkflowNodeGroups">
          {groups.map((group) => (
            <section className="localWorkflowNodeGroup" key={group.label}>
              <div className="localWorkflowNodeGroupHeader">
                <strong>{group.label}</strong>
                <span>{group.nodes.length}</span>
              </div>
              <div className="localWorkflowNodeList">
                {group.nodes.slice(0, 4).map((node) => (
                  <div className="localWorkflowNodeItem" key={`${group.label}-${node.id}`}>
                    <strong>#{node.id} · {node.title || node.type}</strong>
                    <small>{node.title ? node.type : node.summary}</small>
                    {node.title ? <small>{node.summary}</small> : null}
                  </div>
                ))}
                {group.nodes.length > 4 ? <span className="localWorkflowMore">还有 {group.nodes.length - 4} 个候选节点</span> : null}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="localDiagnosticMessage failed">没有识别到可用节点，请确认导出的是 ComfyUI workflow JSON。</div>
      )}
    </div>
  );
}

function ComfyUIWorkflowManagerModal(props: {
  store: LocalComfyUIWorkflowStore;
  onClose: () => void;
  onSelect: (presetId: string) => void;
  onDelete: (presetId: string) => void;
}) {
  const activePreset = props.store.presets.find((preset) => preset.id === props.store.activeId) ?? props.store.presets[0] ?? null;

  return (
    <UtilityModalShell title="ComfyUI 工作流管理器" eyebrow="Local Workflow" className="comfyWorkflowModal" onClose={props.onClose}>
      <div className="comfyWorkflowManager">
        <aside className="comfyWorkflowList" aria-label="已添加的 ComfyUI 工作流">
          {props.store.presets.length ? (
            props.store.presets.map((preset) => (
              <button
                type="button"
                className={preset.id === activePreset?.id ? 'active' : ''}
                onClick={() => props.onSelect(preset.id)}
                key={preset.id}
              >
                <strong>{preset.name}</strong>
                <span>{workflowFormatLabel(preset.summary.format)} · {comfyUIWorkflowRunStatus(preset)} · 节点 {preset.summary.nodeCount}</span>
              </button>
            ))
          ) : (
            <div className="comfyWorkflowEmpty">
              <strong>还没有工作流</strong>
              <span>回到平台接入页导入 ComfyUI workflow JSON。</span>
            </div>
          )}
        </aside>
        <section className="comfyWorkflowDetail" aria-label="ComfyUI 工作流详情">
          {activePreset ? (
            <>
              <div className="comfyWorkflowDetailHeader">
                <div>
                  <strong>{activePreset.name}</strong>
                  <small>{activePreset.summary.fileName} · {workflowFormatLabel(activePreset.summary.format)}</small>
                </div>
                <button type="button" className="miniButton dangerMiniButton" onClick={() => props.onDelete(activePreset.id)}>
                  <Trash2 size={14} /> 删除
                </button>
              </div>
              <ComfyUIWorkflowSummaryPanel preset={activePreset} />
            </>
          ) : (
            <div className="comfyWorkflowEmpty">
              <strong>请选择工作流</strong>
              <span>导入后可以在这里查看每个 workflow 的节点详情。</span>
            </div>
          )}
        </section>
      </div>
    </UtilityModalShell>
  );
}

function SettingsPage(props: {
  appSettings: AppSettings;
  providers: ReturnType<typeof listProviders>;
  desktopRuntime: boolean;
  storageSettings: StorageSettings | null;
  systemTheme: 'dark' | 'light';
  promptPolishDraft: PromptPolishSettings;
  promptPolishSecretDraft: string;
  promptPolishSecretAvailable: boolean;
  isSavingPromptPolishSecret: boolean;
  isRefreshingPromptPolishModels: boolean;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  onPromptPolishDraftChange: (patch: Partial<PromptPolishSettings>) => void;
  onSavePromptPolishConfig: () => void;
  onRefreshPromptPolishModels: () => void;
  onPromptPolishSecretDraftChange: (value: string) => void;
  onSavePromptPolishSecret: () => void;
  onSelectLibraryPath: () => void;
  onResetLibraryPath: () => void;
  onOpenLibraryDirectory: () => void;
  onSelectInspirationPath: () => void;
  onResetInspirationPath: () => void;
  onOpenInspirationDirectory: () => void;
  onOpenAppDataDirectory: () => void;
  onExportSettingsBackup: () => void;
  onOpenSystemInfo: () => void;
  onOpenShortcuts: () => void;
  onCheckUpdates: () => void;
}) {
  const settings = props.appSettings;
  const generationDefaults = settings.generationDefaults;
  const promptHistory = settings.promptHistory;
  const savePreferences = settings.savePreferences;
  const homeModules = settings.homeModules;
  const promptPolish = props.promptPolishDraft;
  const promptPolishDefaultMode = resolvePolishMode(promptHistory.defaultPolishMode, promptPolish.engine);
  const promptPolishModeOptions = getPolishModesForEngine(promptPolish.engine);
  const defaultProvider = props.providers.find((provider) => provider.id === generationDefaults.defaultProviderId) ?? props.providers[0];
  const defaultModelOptions = defaultProvider.models.map((model) => ({ value: model.id, label: model.label || model.id }));
  const selectedDefaultModel = defaultModelOptions.some((option) => option.value === generationDefaults.defaultModelId)
    ? generationDefaults.defaultModelId
    : defaultModelOptions[0]?.value ?? generationDefaults.defaultModelId;
  const [developerMode, setDeveloperMode] = useState(false);

  function updateGenerationDefaults(patch: Partial<GenerationDefaults>) {
    props.onSettingsChange({ generationDefaults: { ...generationDefaults, ...patch } });
  }

  function updatePromptHistory(patch: Partial<PromptHistorySettings>) {
    props.onSettingsChange({ promptHistory: { ...promptHistory, ...patch } });
  }

  function updateSavePreferences(patch: Partial<AppSettings['savePreferences']>) {
    props.onSettingsChange({ savePreferences: { ...savePreferences, ...patch } });
  }

  function updateHomeModules(patch: Partial<HomeModuleSettings>) {
    props.onSettingsChange({ homeModules: { ...homeModules, ...patch } });
  }

  function updatePromptPolish(patch: Partial<PromptPolishSettings>, options?: { commit?: boolean }) {
    const nextPromptPolish = { ...promptPolish, ...patch };
    props.onPromptPolishDraftChange(patch);
    if (options?.commit) {
      props.onSettingsChange({ promptPolish: nextPromptPolish });
    }
  }

  function deletePromptPolishConfig(configId: string) {
    const nextConfigs = promptPolish.savedConfigs.filter((config) => config.id !== configId);
    const currentConfigId = promptPolishConfigId(promptPolish.displayName, promptPolish.baseUrl);
    const nextActive = configId === currentConfigId ? nextConfigs[0] : null;
    const nextPromptPolish: PromptPolishSettings = {
      ...promptPolish,
      ...(nextActive
        ? {
            displayName: nextActive.displayName,
            baseUrl: nextActive.baseUrl,
            modelId: nextActive.modelId,
            modelOptions: nextActive.modelOptions,
            extraHeadersJson: nextActive.extraHeadersJson,
            protocol: nextActive.protocol
          }
        : {}),
      ...(configId === currentConfigId && !nextActive
        ? {
            displayName: '提示词润色专用配置',
            baseUrl: '',
            modelId: '',
            modelOptions: [],
            extraHeadersJson: '{}',
            protocol: 'chat-completions' as const
          }
        : {}),
      savedConfigs: nextConfigs
    };
    props.onPromptPolishDraftChange(nextPromptPolish);
    props.onSettingsChange({ promptPolish: nextPromptPolish });
  }

  function updateDefaultProvider(providerId: string) {
    const provider = props.providers.find((item) => item.id === providerId) ?? props.providers[0];
    updateGenerationDefaults({
      defaultProviderId: provider.id,
      defaultModelId: provider.models[0]?.id ?? generationDefaults.defaultModelId
    });
  }

  return (
    <section className="systemSettingsPage">
      <header className="systemSettingsHeader">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1>偏好设置</h1>
          <span>把默认工作流、语言、首页模块和数据管理集中到一个配置中心。</span>
        </div>
        <div className="settingsHeaderActions">
          <button type="button" data-tooltip="系统信息" aria-label="系统信息" onClick={props.onOpenSystemInfo}>
            <Info size={16} />
          </button>
          <button type="button" data-tooltip="快捷键" aria-label="快捷键" onClick={props.onOpenShortcuts}>
            <Keyboard size={16} />
          </button>
          <button type="button" data-tooltip="检查更新" aria-label="检查更新" onClick={props.onCheckUpdates}>
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
          <div className="segmentedControl themeSegment">
            <button className={settings.themeMode === 'light' ? 'active' : ''} onClick={() => props.onSettingsChange({ themeMode: 'light' })}>
              <Sun size={14} /> 浅色
            </button>
            <button className={settings.themeMode === 'dark' ? 'active' : ''} onClick={() => props.onSettingsChange({ themeMode: 'dark' })}>
              <Moon size={14} /> 深色
            </button>
            <button className={settings.themeMode === 'system' ? 'active' : ''} onClick={() => props.onSettingsChange({ themeMode: 'system' })}>
              <Monitor size={14} /> 跟随系统
            </button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>语言</strong>
            <small>只提供中文和英文手动切换，本轮不做跟随系统，避免启动判断分支和闪烁。</small>
          </div>
          <div className="segmentedControl compactSegment">
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={settings.language === option.value ? 'active' : ''}
                onClick={() => props.onSettingsChange({ language: option.value })}
              >
                {option.shortLabel}
              </button>
            ))}
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

      <div className="settingsSectionLabel">界面与首页</div>
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
            <strong>侧边栏默认状态</strong>
            <small>记住你上一次选择的展开或收缩状态。</small>
          </div>
          <div className="segmentedControl compactSegment">
            <button className={!settings.sidebarCollapsed ? 'active' : ''} onClick={() => props.onSettingsChange({ sidebarCollapsed: false })}>
              展开
            </button>
            <button className={settings.sidebarCollapsed ? 'active' : ''} onClick={() => props.onSettingsChange({ sidebarCollapsed: true })}>
              收缩
            </button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>界面密度</strong>
            <small>紧凑模式会压缩首页和设置页间距，适合小屏或多窗口工作。</small>
          </div>
          <button
            className={settings.compactMode ? 'settingsTogglePill active' : 'settingsTogglePill'}
            type="button"
            onClick={() => props.onSettingsChange({ compactMode: !settings.compactMode })}
          >
            {settings.compactMode ? '紧凑模式' : '标准模式'}
          </button>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>首页模块</strong>
            <small>控制工作台首页显示哪些区域；隐藏后不影响对应功能页。</small>
          </div>
          <div className="settingsBooleanGrid homeModuleGrid">
            <button className={homeModules.resume ? 'active' : ''} onClick={() => updateHomeModules({ resume: !homeModules.resume })}>继续创作</button>
            <button className={homeModules.attention ? 'active' : ''} onClick={() => updateHomeModules({ attention: !homeModules.attention })}>待处理</button>
            <button className={homeModules.materials ? 'active' : ''} onClick={() => updateHomeModules({ materials: !homeModules.materials })}>最近素材</button>
            <button className={homeModules.quickActions ? 'active' : ''} onClick={() => updateHomeModules({ quickActions: !homeModules.quickActions })}>常用入口</button>
            <button className={homeModules.roadmap ? 'active' : ''} onClick={() => updateHomeModules({ roadmap: !homeModules.roadmap })}>后续路线</button>
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

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>默认参考图角色</strong>
            <small>新加入参考图时优先使用的角色标记；仍可在创作台单张调整。</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={generationDefaults.defaultReferenceRole}
              onChange={(value) => updateGenerationDefaults({ defaultReferenceRole: value as GenerationDefaults['defaultReferenceRole'] })}
              options={DEFAULT_REFERENCE_ROLE_OPTIONS}
            />
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
            <strong>输出格式偏好</strong>
            <small>控制创作页底部的默认输出格式。</small>
          </div>
          <div className="settingsInlineGrid">
            <StudioSelect
              value={generationDefaults.outputFormat}
              onChange={(value) => updateGenerationDefaults({ outputFormat: value as GenerationDefaults['outputFormat'] })}
              options={OUTPUT_FORMAT_OPTIONS}
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
            <small>跟随当前润色引擎切换，本地规则和模型扩写方向分开保存。</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={promptPolishDefaultMode.id}
              onChange={(value) => updatePromptHistory({ defaultPolishMode: value })}
              options={promptPolishModeOptions.map((mode) => ({ value: mode.id, label: mode.label }))}
            />
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>提示词润色引擎</strong>
            <small>本地规则不消耗额度；模型润色使用下方独立配置，不复用生图平台 Key。</small>
          </div>
          <div className="settingsInlineGrid promptPolishEngineControls">
            <button
              className={promptPolish.fallbackToLocal ? 'settingsTogglePill active' : 'settingsTogglePill'}
              onClick={() => updatePromptPolish({ fallbackToLocal: !promptPolish.fallbackToLocal }, { commit: true })}
            >
              失败时本地兜底
            </button>
            <StudioSelect
              value={promptPolish.engine}
              onChange={(value) => updatePromptPolish({ engine: value as PromptPolishSettings['engine'] }, { commit: true })}
              options={PROMPT_POLISH_ENGINE_OPTIONS}
            />
          </div>
        </div>

        <div className="settingsConfigBlock">
          <div className="promptPolishConfigHeader">
            <div className="settingsRowMain promptPolishIntro">
              <strong>提示词润色专用配置</strong>
              <small>这里单独保存润色用的接口信息和 API Key，可接入 DeepSeek、聚合站或其他 OpenAI-compatible 文本模型。</small>
            </div>
            <div className="promptPolishHeaderTools">
              <div className="settingsPresetRow">
                <button
                  type="button"
                  className={promptPolish.displayName === 'DeepSeek 提示词润色' ? 'active' : ''}
                  onClick={() => updatePromptPolish({
                    displayName: 'DeepSeek 提示词润色',
                    baseUrl: 'https://api.deepseek.com',
                    modelId: '',
                    modelOptions: [],
                    protocol: 'chat-completions'
                  })}
                >
                  DeepSeek
                </button>
                <button
                  type="button"
                  className={promptPolish.displayName === '聚合站文本润色' ? 'active' : ''}
                  onClick={() => updatePromptPolish({
                    displayName: '聚合站文本润色',
                    baseUrl: '',
                    modelId: '',
                    modelOptions: [],
                    protocol: 'chat-completions'
                  })}
                >
                  聚合站通用
                </button>
                <button
                  type="button"
                  className={promptPolish.displayName === 'OpenAI 官方文本润色' ? 'active' : ''}
                  onClick={() => updatePromptPolish({
                    displayName: 'OpenAI 官方文本润色',
                    baseUrl: OFFICIAL_OPENAI_BASE_URL,
                    modelId: '',
                    modelOptions: [],
                    protocol: 'chat-completions'
                  })}
                >
                  OpenAI 官方
                </button>
              </div>
              <div className="settingsStatusPills compact">
                <span className={promptPolish.baseUrl.trim() ? 'ready' : ''}>Base URL</span>
                <span className={promptPolish.modelId.trim() ? 'ready' : ''}>模型 ID</span>
                <span className={props.promptPolishSecretAvailable ? 'ready' : ''}>API Key</span>
              </div>
            </div>
          </div>
          <div className="settingsConfigGrid">
            <label>
              配置名称
              <input
                value={promptPolish.displayName}
                placeholder="提示词润色专用配置"
                onChange={(event) => updatePromptPolish({ displayName: event.target.value })}
              />
            </label>
            <label>
              Base URL
              <input
                value={promptPolish.baseUrl}
                placeholder="例如 https://api.example.com"
                onChange={(event) => updatePromptPolish({ baseUrl: event.target.value })}
              />
            </label>
            <label>
              模型选择 / 手动填写
              <div className="settingsModelSelectRow">
                <input
                  value={promptPolish.modelId}
                  list="prompt-polish-model-options"
                  placeholder={promptPolish.modelOptions.length > 0 ? '选择刷新出的模型，或手动输入模型 ID' : '先刷新模型列表；刷不出来就手动填写模型 ID'}
                  onChange={(event) => updatePromptPolish({ modelId: event.target.value })}
                />
                <datalist id="prompt-polish-model-options">
                  {promptPolish.modelOptions.map((modelId) => <option key={modelId} value={modelId} />)}
                </datalist>
                <button type="button" onClick={props.onRefreshPromptPolishModels} disabled={props.isRefreshingPromptPolishModels}>
                  {props.isRefreshingPromptPolishModels ? '刷新中…' : '刷新'}
                </button>
              </div>
              <small>刷新读取 /v1/models；列表没有目标模型时直接在同一个输入框填写。</small>
            </label>
            <label>
              API Key
              <div className="settingsSecretInputRow">
                <input
                  type="password"
                  value={props.promptPolishSecretDraft}
                  placeholder={props.promptPolishSecretAvailable ? '已保存，输入新 Key 可替换' : '粘贴润色专用 API Key'}
                  onChange={(event) => props.onPromptPolishSecretDraftChange(event.target.value)}
                />
                <button type="button" onClick={props.onSavePromptPolishSecret} disabled={props.isSavingPromptPolishSecret}>
                  {props.isSavingPromptPolishSecret ? '保存中…' : '保存'}
                </button>
              </div>
              <small>{props.promptPolishSecretAvailable ? '润色专用 Key 已配置。' : '尚未保存润色专用 Key。'}</small>
            </label>
            <details className="settingsAdvancedBox settingsWideField">
              <summary>
                <span>高级设置：Headers JSON</span>
                <small>默认保持 {'{}'}</small>
              </summary>
              <p>用于给少数中转站或企业 API 额外传请求头，例如 <code>{'{"X-Provider":"visionhub"}'}</code>。一般服务商不需要，保持空对象即可。</p>
              <textarea
                rows={3}
                value={promptPolish.extraHeadersJson}
                placeholder='{"X-Provider": "visionhub"}'
                onChange={(event) => updatePromptPolish({ extraHeadersJson: event.target.value })}
              />
            </details>
            <div className="settingsConfigActions settingsWideField">
              <button type="button" className="rowActionButton" onClick={props.onSavePromptPolishConfig}>
                <ShieldCheck size={14} /> 保存润色配置
              </button>
              <small>保存配置不会保存 API Key；API Key 仍需单独点击上方“保存”。</small>
            </div>
            <div className="promptPolishConfigInstances settingsWideField">
              <strong>已保存配置实例</strong>
              {promptPolish.savedConfigs.length === 0 ? (
                <p>保存当前配置后会显示在这里。</p>
              ) : (
                <div>
                  {promptPolish.savedConfigs.map((config) => (
                    <article key={config.id} className={config.id === promptPolishConfigId(promptPolish.displayName, promptPolish.baseUrl) ? 'active' : ''}>
                      <button
                        type="button"
                        onClick={() => updatePromptPolish({
                          displayName: config.displayName,
                          baseUrl: config.baseUrl,
                          modelId: config.modelId,
                          modelOptions: config.modelOptions,
                          extraHeadersJson: config.extraHeadersJson,
                          protocol: config.protocol
                        })}
                      >
                        <span>{config.displayName}</span>
                        <small>{config.modelId || '未设置模型'} · {config.baseUrl || '未设置 Base URL'}</small>
                      </button>
                      <button type="button" className="promptPolishConfigDelete" data-tooltip="删除配置实例" aria-label={`删除配置实例：${config.displayName}`} onClick={() => deletePromptPolishConfig(config.id)}>
                        <Trash2 size={13} />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
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

        <p className="settingsNotice">模型润色不会读取或导出你的 API Key；密钥由桌面端安全凭据存储在独立的润色通道。未配置或请求失败时，会按设置自动回退到本地规则润色。</p>
      </article>

      <div className="settingsSectionLabel">作品保存偏好</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>文件命名规则</strong>
            <small>记录为默认保存策略；当前桌面落盘仍会保留安全的唯一文件名，后续批量导出优先读取这里。</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={savePreferences.fileNamingRule}
              onChange={(value) => updateSavePreferences({ fileNamingRule: value as AppSettings['savePreferences']['fileNamingRule'] })}
              options={FILE_NAMING_RULE_OPTIONS}
            />
          </div>
        </div>
        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>分组策略</strong>
            <small>用于后续导出、项目资产库和批量整理；不会移动现有图库文件。</small>
          </div>
          <div className="settingsBooleanGrid compactTwo">
            <button className={savePreferences.groupByDate ? 'active' : ''} onClick={() => updateSavePreferences({ groupByDate: !savePreferences.groupByDate })}>按日期分组</button>
            <button className={savePreferences.groupByProject ? 'active' : ''} onClick={() => updateSavePreferences({ groupByProject: !savePreferences.groupByProject })}>按项目分组</button>
          </div>
        </div>
      </article>

      <div className="settingsSectionLabel">数据与缓存</div>
      <article className="settingsGroupCard">
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
          <div className="settingsPathActions">
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onSelectLibraryPath}>
              <FolderOpen size={15} /> 选择路径
            </button>
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onOpenLibraryDirectory}>
              <HardDrive size={15} /> 打开
            </button>
            <button className="rowActionButton subtle" disabled={!props.desktopRuntime} onClick={props.onResetLibraryPath}>
              <RefreshCcw size={15} /> 默认目录
            </button>
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>图片收藏目录</strong>
            <small>
              {props.storageSettings
                ? `当前：${props.storageSettings.resolved_inspiration_dir}`
                : props.desktopRuntime
                  ? '正在读取图片收藏路径…'
                  : '桌面端可自定义图片收藏路径。'}
            </small>
            {props.storageSettings ? (
              <small className="settingsPathMeta">
                默认：{props.storageSettings.default_inspiration_dir}
              </small>
            ) : null}
          </div>
          <div className="settingsPathActions">
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onSelectInspirationPath}>
              <FolderOpen size={15} /> 选择路径
            </button>
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onOpenInspirationDirectory}>
              <HardDrive size={15} /> 打开
            </button>
            <button className="rowActionButton subtle" disabled={!props.desktopRuntime} onClick={props.onResetInspirationPath}>
              <RefreshCcw size={15} /> 默认目录
            </button>
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
            <small>{'\u5bfc\u51fa\u5e94\u7528\u8bbe\u7f6e\u3001\u5e73\u53f0\u914d\u7f6e\u548c\u672c\u5730\u5386\u53f2\u3002API Key \u4e0d\u4f1a\u88ab\u5bfc\u51fa\u3002'}</small>
          </div>
          <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onExportSettingsBackup}>
            <Download size={15} /> {'\u5bfc\u51fa\u8bbe\u7f6e'}
          </button>
        </div>
      </article>

      <div className="settingsSectionLabel">软件升级</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow versionSettingsRow">
          <div className="settingsRowMain">
            <strong>版本</strong>
          </div>
          <span className="settingsValue">{APP_VERSION}</span>
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
            <strong>开发者模式</strong>
            <small>打开后显示运行时和技术栈信息。</small>
          </div>
          <button
            className={developerMode ? 'settingsTogglePill active' : 'settingsTogglePill'}
            type="button"
            onClick={() => setDeveloperMode((current) => !current)}
          >
            {developerMode ? '已开启' : '关闭'}
          </button>
        </div>
        {developerMode ? <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>技术栈</strong>
            <small>Tauri v2 + React + TypeScript，本地历史保存，密钥由系统凭据管理。</small>
          </div>
          <span className="settingsValue">Desktop MVP</span>
        </div> : null}
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
            <p>真实平台接入后，这里会保存每张图的来源平台、模型、Prompt、成本和耗时。</p>
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
                    <span className={`statusBadge ${generationStatusClass(result)}`}>{generationStatusLabel(result)}</span>
                </div>
                <p title={result.prompt}>{result.prompt}</p>
                <div className="metadataRow">
                  <span>{result.modelId}</span>
                  <span>
                    <Clock3 size={12} /> {formatTime(result.createdAt)}
                  </span>
                  <span>{result.durationMs ?? '-'}ms</span>
                </div>
                {result.error ? <small className="errorText">{generationFailureHint(result)}</small> : <small>{result.costHint}</small>}
                <div className="cardActions">
                  <button className="miniButton" onClick={() => void navigator.clipboard?.writeText(result.prompt)}>
                    <Copy size={13} /> Prompt
                  </button>
                  <button
                    className="miniButton"
                    disabled={!getRecordRevealPath(result)}
                    onClick={() => {
                      const path = getRecordRevealPath(result);
                      if (path) void revealGenerationFile(path);
                    }}
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

const CachedLibraryPage = memo(function CachedLibraryPage(props: {
  providers: ReturnType<typeof listProviders>;
  results: ReturnType<typeof useStudioStore.getState>['results'];
  isHistoryLoaded: boolean;
  isActive: boolean;
  preview: ImagePreviewState | null;
  onAddResult: (record: GenerationRecord) => void;
  onPreview: (imageUrl: string, navigation?: ImagePreviewNavigation) => void;
  onNavigatePreview: (item: ImagePreviewNavigationItem) => void;
  onClosePreview: () => void;
  onUseAsReference: (record: GenerationRecord) => void;
  onRetryRecord: (record: GenerationRecord) => void;
  onRecheckBackgroundRecord: (record: GenerationRecord) => Promise<GenerationRecord>;
  onRequestConfirm: (request: ConfirmDialogRequest) => void;
  onDelete: (recordId: string) => Promise<void>;
}) {
  return (
    <section
      className={`workspacePage cachedLibraryPage ${props.isActive ? 'active' : 'inactive'}`}
      aria-hidden={!props.isActive}
    >
      <LibraryPage
        providers={props.providers}
        results={props.results}
        isHistoryLoaded={props.isHistoryLoaded}
        onAddResult={props.onAddResult}
        onPreview={props.onPreview}
        onUseAsReference={props.onUseAsReference}
        onRetryRecord={props.onRetryRecord}
        onRecheckBackgroundRecord={props.onRecheckBackgroundRecord}
        onRequestConfirm={props.onRequestConfirm}
        onDelete={props.onDelete}
      />
      {props.isActive && props.preview ? (
        <ImagePreviewModal
          imageUrl={props.preview.imageUrl}
          navigation={props.preview.navigation}
          onNavigate={props.onNavigatePreview}
          onClose={props.onClosePreview}
        />
      ) : null}
    </section>
  );
});

const CachedInspirationPage = memo(function CachedInspirationPage(props: {
  isActive: boolean;
  preview: ImagePreviewState | null;
  onPreview: (imageUrl: string, navigation?: ImagePreviewNavigation) => void;
  onNavigatePreview: (item: ImagePreviewNavigationItem) => void;
  onClosePreview: () => void;
  onUseAsReference: (asset: InspirationAsset) => void;
  onUsePrompt: (prompt: string) => void;
  onCreateTemplate: (title: string, prompt: string, tags: string[]) => string;
  onRequestConfirm: (request: ConfirmDialogRequest) => void;
  importVersion: number;
}) {
  return (
    <section
      className={`workspacePage cachedInspirationPage ${props.isActive ? 'active' : 'inactive'}`}
      aria-hidden={!props.isActive}
    >
      <InspirationPage
        onPreview={props.onPreview}
        onUseAsReference={props.onUseAsReference}
        onUsePrompt={props.onUsePrompt}
        onCreateTemplate={props.onCreateTemplate}
        onRequestConfirm={props.onRequestConfirm}
        importVersion={props.importVersion}
      />
      {props.isActive && props.preview ? (
        <ImagePreviewModal
          imageUrl={props.preview.imageUrl}
          navigation={props.preview.navigation}
          onNavigate={props.onNavigatePreview}
          onClose={props.onClosePreview}
        />
      ) : null}
    </section>
  );
});

const LibraryRecordCard = memo(function LibraryRecordCard(props: {
  record: GenerationRecord;
  providerName: string;
  meta?: LibraryMetaEntry;
  isSelected: boolean;
  viewMode: LibraryViewMode;
  displaySettings: LibraryDisplaySettings;
  isCurrentScopeRemovable: boolean;
  onSelect: (recordId: string, event?: MouseEvent<HTMLElement>) => void;
  onOpenContextMenu: (recordId: string, event: MouseEvent<HTMLElement>) => void;
  onPreview: (record: GenerationRecord, imageUrl?: string) => void;
  onAnalyzeColors: (recordId: string, image: HTMLImageElement) => void;
  onToggleFavorite: (recordId: string) => void;
  onOpenDetails: (record: GenerationRecord) => void;
  onOpenDiagnostics: (record: GenerationRecord) => void;
  onUseAsReference: (record: GenerationRecord) => void;
  onCopyPrompt: (record: GenerationRecord) => void;
  onCopyPath: (record: GenerationRecord) => void;
  onExportRecord: (record: GenerationRecord) => void;
  onAssignFolder: (recordId: string) => void;
  onAssignCollection: (recordId: string) => void;
  onRemoveFromCurrentScope: (recordId: string) => void;
  onDelete: (recordId: string) => void;
}) {
  const imageUrl = props.record.imageUrls[0];
  const modeLabel = (props.record.generationMode ?? 'text-to-image') === 'image-to-image' ? '\u56fe\u751f\u56fe' : '\u6587\u751f\u56fe';
  const referenceCount = props.record.referenceImages?.length ?? 0;
  const referenceSummary = summarizeReferenceSources(props.record.referenceImages);
  const isFavorite = Boolean(props.meta?.favorite);

  return (
    <article
      className={`libraryCard libraryCardV2 ${props.record.status === 'failed' ? 'failed' : ''} ${isFavorite ? 'favorite' : ''} ${props.isSelected ? 'selected' : ''}`}
      aria-selected={props.isSelected}
      onClick={(event) => {
        const target = event.target;
        if (target instanceof Element && target.closest('button, a, input, select, textarea, .libraryQuickMenu')) return;
        props.onSelect(props.record.id, event);
      }}
      onContextMenu={(event) => props.onOpenContextMenu(props.record.id, event)}
    >
      <button
        className={`librarySelectMark ${props.isSelected ? 'active' : ''}`}
        type="button"
        aria-label={props.isSelected ? '取消选择' : '选择图片'}
        onClick={(event) => {
          event.stopPropagation();
          props.onSelect(props.record.id, event);
        }}
      >
        <span />
      </button>
      {imageUrl ? (
        <button
          className="libraryThumb"
          onClick={(event) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey) {
              props.onSelect(props.record.id, event);
              return;
            }
            props.onPreview(props.record, imageUrl);
          }}
        >
          <img
            src={imageUrl}
            alt={props.record.prompt}
            loading="lazy"
            decoding="async"
            onLoad={(event) => props.onAnalyzeColors(props.record.id, event.currentTarget)}
          />
          <span><Maximize2 size={15} /> {'\u9884\u89c8'}</span>
        </button>
      ) : (
        <div className="libraryFailedThumb">{'\u751f\u6210\u5931\u8d25'}</div>
      )}
      <div className="libraryImageOverlay">
        <button className={`iconMiniButton favoriteButton ${isFavorite ? 'active' : ''}`} type="button" data-tooltip={isFavorite ? '取消收藏' : '收藏'} aria-label={isFavorite ? '取消收藏' : '收藏'} onClick={() => props.onToggleFavorite(props.record.id)}>
          <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        <div className="libraryMoreMenuWrap">
          <button className="iconMiniButton" type="button" data-tooltip="更多操作" aria-label="更多操作">
            <MoreHorizontal size={15} />
          </button>
          <div className="libraryQuickMenu" aria-label="图片操作">
            <button type="button" onClick={() => props.onOpenDetails(props.record)}><Info size={13} /> 图片详情</button>
            {props.record.error || props.record.status === 'failed' ? (
              <button type="button" onClick={() => props.onOpenDiagnostics(props.record)}><Gauge size={13} /> 查看诊断</button>
            ) : null}
            <button type="button" disabled={!imageUrl} onClick={() => props.onUseAsReference(props.record)}><ImagePlus size={13} /> 设为参考图</button>
            <button type="button" onClick={() => props.onCopyPrompt(props.record)}><Copy size={13} /> 复制 Prompt</button>
            <button type="button" disabled={!getRecordPrimaryPath(props.record)} onClick={() => props.onCopyPath(props.record)}><Copy size={13} /> 复制路径</button>
            <button type="button" onClick={() => props.onExportRecord(props.record)}><Download size={13} /> 导出清单</button>
            <span className="libraryMenuDivider" />
            <button type="button" onClick={() => props.onToggleFavorite(props.record.id)}><Star size={13} /> {isFavorite ? '取消收藏' : '加入收藏'}</button>
            <button type="button" onClick={() => props.onAssignFolder(props.record.id)}><FolderOpen size={13} /> 移至文件夹</button>
            <button type="button" onClick={() => props.onAssignCollection(props.record.id)}><Bookmark size={13} /> 加入收藏集</button>
            {props.isCurrentScopeRemovable ? (
              <button type="button" onClick={() => props.onRemoveFromCurrentScope(props.record.id)}><X size={13} /> 移出当前分类</button>
            ) : null}
            <span className="libraryMenuDivider" />
            <button className="dangerAction" type="button" onClick={() => props.onDelete(props.record.id)}><Trash2 size={13} /> 删除记录</button>
          </div>
        </div>
      </div>
      <div className="libraryCardBody">
        <div className="resultTitleRow">
          <strong>{props.displaySettings.showProvider ? props.providerName : formatTime(props.record.createdAt)}</strong>
          <div className="cardTopActions">
            <span className="statusBadge modeBadge">{modeLabel}</span>
            {props.displaySettings.showReferenceBadge && referenceCount > 0 ? <span className="statusBadge referenceBadge" title={`\u53c2\u8003\u6765\u6e90\uff1a${referenceSummary}`}>{referenceCount}{'\u53c2\u8003'}</span> : null}
            <span className={`statusBadge ${generationStatusClass(props.record)}`}>{generationStatusLabel(props.record)}</span>
          </div>
        </div>
        {props.viewMode === 'list' || props.displaySettings.showPrompt ? <p title={props.record.prompt}>{props.record.prompt}</p> : null}
        <div className="metadataRow">
          {props.displaySettings.showModel ? <span>{props.record.modelId}</span> : null}
          <span><Clock3 size={12} /> {formatTime(props.record.createdAt)}</span>
        </div>
      </div>
    </article>
  );
});

const LibraryPage = memo(function LibraryPage(props: {
  providers: ReturnType<typeof listProviders>;
  results: ReturnType<typeof useStudioStore.getState>['results'];
  isHistoryLoaded: boolean;
  onAddResult: (record: GenerationRecord) => void;
  onPreview: (imageUrl: string, navigation?: ImagePreviewNavigation) => void;
  onUseAsReference: (record: GenerationRecord) => void;
  onRetryRecord: (record: GenerationRecord) => void;
  onRecheckBackgroundRecord: (record: GenerationRecord) => Promise<GenerationRecord>;
  onRequestConfirm: (request: ConfirmDialogRequest) => void;
  onDelete: (recordId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'succeeded' | 'failed'>(() => {
    const status = readUrlSearchParam('status');
    return status === 'all' || status === 'succeeded' || status === 'failed' ? status : 'all';
  });
  const [modeFilter, setModeFilter] = useState<LibraryModeFilter>('all');
  const [timeFilter, setTimeFilter] = useState<LibraryTimeFilter>('all');
  const [colorFilter, setColorFilter] = useState<LibraryColorFilter>('all');
  const [shapeFilter, setShapeFilter] = useState<LibraryShapeFilter>('all');
  const [formatFilter, setFormatFilter] = useState<LibraryFormatFilter>('all');
  const [ratingFilter, setRatingFilter] = useState<LibraryRatingFilter>('all');
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [quickFilters, setQuickFilters] = useState<LibraryQuickFilter[]>([]);
  const [customQuickFilters, setCustomQuickFilters] = useState<LibraryCustomQuickFilter[]>(() => loadLibraryCustomQuickFilters());
  const [activeCustomQuickFilterIds, setActiveCustomQuickFilterIds] = useState<string[]>([]);
  const [libraryOrganization, setLibraryOrganization] = useState<LibraryOrganization>(() => loadLibraryOrganization());
  const [libraryScope, setLibraryScope] = useState<LibraryScope>({ type: 'all' });
  const [libraryOrganizerOpen, setLibraryOrganizerOpen] = useState(() => readUrlSearchParam('organizer') === '1');
  const [organizerDialog, setOrganizerDialog] = useState<LibraryOrganizerDialogState | null>(null);
  const [assignDialog, setAssignDialog] = useState<LibraryAssignDialogState | null>(null);
  const [quickFilterEditorOpen, setQuickFilterEditorOpen] = useState(false);
  const [quickFilterName, setQuickFilterName] = useState('');
  const [viewMode, setViewMode] = useState<LibraryViewMode>('adaptive');
  const [sortMode, setSortMode] = useState<LibrarySortMode>('newest');
  const [thumbnailScale, setThumbnailScale] = useState(1);
  const [searchVisible, setSearchVisible] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [activePanel, setActivePanel] = useState<'main' | 'view' | 'display' | 'sort' | 'add' | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(() => readUrlSearchParam('record'));
  const [diagnosticRecordId, setDiagnosticRecordId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>(() => readUrlSearchList('selected'));
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<LibraryContextMenuState | null>(null);
  const [libraryMeta, setLibraryMeta] = useState<LibraryMetaMap>(() => loadLibraryMeta());
  const [displaySettings, setDisplaySettings] = useState<LibraryDisplaySettings>(() => loadLibraryDisplaySettings());
  const [renderedItemCount, setRenderedItemCount] = useState(LIBRARY_INITIAL_RENDER_COUNT);
  const [copyMessage, setCopyMessage] = useState('');
  const [recheckingRecordId, setRecheckingRecordId] = useState<string | null>(null);
  const dockRef = useRef<HTMLElement | null>(null);
  const colorFilterRef = useRef<HTMLLabelElement | null>(null);
  const quickFilterEditorRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const libraryDataHydratedRef = useRef(!isTauriRuntime());
  const pendingImageMetaPatchesRef = useRef<Record<string, Partial<LibraryMetaEntry>>>({});
  const imageMetaFlushRef = useRef<{ timerId: number | null; idleId: number | null }>({ timerId: null, idleId: null });
  useToastMessage(copyMessage, setCopyMessage);

  const flushImageMetaPatches = useCallback(() => {
    const patches = pendingImageMetaPatchesRef.current;
    pendingImageMetaPatchesRef.current = {};
    imageMetaFlushRef.current.timerId = null;
    imageMetaFlushRef.current.idleId = null;
    const entries = Object.entries(patches);
    if (!entries.length) return;
    setLibraryMeta((current) => {
      let changed = false;
      const next = { ...current };
      entries.forEach(([recordId, patch]) => {
        const entry = compactLibraryMetaEntry({
          ...next[recordId],
          ...patch
        });
        const previous = next[recordId];
        if (Object.keys(entry).length) {
          if (JSON.stringify(previous ?? {}) !== JSON.stringify(entry)) {
            next[recordId] = entry;
            changed = true;
          }
          return;
        }
        if (previous) {
          delete next[recordId];
          changed = true;
        }
      });
      if (!changed) return current;
      saveLibraryMeta(next);
      return next;
    });
  }, []);

  const queueImageMetaPatch = useCallback((recordId: string, patch: Partial<LibraryMetaEntry>) => {
    pendingImageMetaPatchesRef.current[recordId] = {
      ...pendingImageMetaPatchesRef.current[recordId],
      ...patch
    };
    if (imageMetaFlushRef.current.timerId !== null || imageMetaFlushRef.current.idleId !== null) return;
    imageMetaFlushRef.current.timerId = window.setTimeout(() => {
      imageMetaFlushRef.current.timerId = null;
      if ('requestIdleCallback' in window) {
        imageMetaFlushRef.current.idleId = window.requestIdleCallback(flushImageMetaPatches, { timeout: 1200 });
        return;
      }
      flushImageMetaPatches();
    }, 180);
  }, [flushImageMetaPatches]);

  useEffect(() => () => {
    if (imageMetaFlushRef.current.timerId !== null) {
      window.clearTimeout(imageMetaFlushRef.current.timerId);
    }
    if (imageMetaFlushRef.current.idleId !== null && 'cancelIdleCallback' in window) {
      window.cancelIdleCallback(imageMetaFlushRef.current.idleId);
    }
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;

    async function hydrateLibraryData() {
      try {
        const data = await loadLibraryData();
        if (cancelled) return;

        if (data?.exists) {
          const nextMeta = normalizeLibraryMeta(data.meta);
          const nextOrganization = normalizeLibraryOrganization(data.organization as Partial<LibraryOrganization>);
          const nextDisplaySettings = normalizeLibraryDisplaySettings(data.display_settings as Partial<LibraryDisplaySettings>);
          const nextCustomQuickFilters = normalizeLibraryCustomQuickFilters(data.custom_quick_filters);

          setLibraryMeta(nextMeta);
          setLibraryOrganization(nextOrganization);
          setDisplaySettings(nextDisplaySettings);
          setCustomQuickFilters(nextCustomQuickFilters);

          saveLibraryMeta(nextMeta);
          saveLibraryOrganization(nextOrganization);
          saveLibraryDisplaySettings(nextDisplaySettings);
          saveLibraryCustomQuickFilters(nextCustomQuickFilters);
        } else {
          void saveLibraryData(buildLibraryDataPayload(libraryMeta, libraryOrganization, displaySettings, customQuickFilters));
        }
      } catch (error) {
        console.warn('[VisionHub] library metadata file sync failed; local cache is still available', error);
        if (!cancelled) setCopyMessage('画廊元数据文件读取失败，已暂用本地缓存');
      } finally {
        if (!cancelled) libraryDataHydratedRef.current = true;
      }
    }

    void hydrateLibraryData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!libraryDataHydratedRef.current || !isTauriRuntime()) return;
    let idleId: number | null = null;
    const save = () => {
      void saveLibraryData(buildLibraryDataPayload(libraryMeta, libraryOrganization, displaySettings, customQuickFilters))
        .catch((error) => {
          console.warn('[VisionHub] library metadata file save failed; local cache is still available', error);
        });
    };
    const timer = window.setTimeout(() => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(save, { timeout: 2000 });
        return;
      }
      save();
    }, 650);
    return () => {
      window.clearTimeout(timer);
      if (idleId !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [libraryMeta, libraryOrganization, displaySettings, customQuickFilters]);
  const isDockSubPanel = activePanel !== null && activePanel !== 'main' && activePanel !== 'add';
  const providerNameMap = useMemo(
    () => new Map(props.providers.map((provider) => [provider.id, providerGenerationLabel(provider)])),
    [props.providers]
  );
  const providerOptions = useMemo(
    () => [
      { value: 'all', label: '全部平台' },
      ...props.providers.map((provider) => ({ value: provider.id, label: providerGenerationLabel(provider) }))
    ],
    [props.providers]
  );
  const libraryItems = useMemo(
    () => props.results.filter((result) => result.imageUrls.length > 0 || result.status === 'failed'),
    [props.results]
  );
  const libraryRecordMap = useMemo(
    () => new Map(libraryItems.map((record) => [record.id, record])),
    [libraryItems]
  );
  const { successCount, failedCount, localPathCount } = useMemo(() => {
    let success = 0;
    let failed = 0;
    let local = 0;
    libraryItems.forEach((record) => {
      if (record.status === 'succeeded') success += 1;
      if (record.status === 'failed') failed += 1;
      if (record.localImagePaths?.[0]) local += 1;
    });
    return { successCount: success, failedCount: failed, localPathCount: local };
  }, [libraryItems]);
  const { nowMs, todayStartMs } = useMemo(() => {
    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return { nowMs: now, todayStartMs: today.getTime() };
  }, [libraryItems.length]);
  const normalizedQuery = query.trim().toLowerCase();
  const activeCustomFilters = useMemo(
    () => activeCustomQuickFilterIds
      .map((filterId) => customQuickFilters.find((item) => item.id === filterId) ?? null)
      .filter((filter): filter is LibraryCustomQuickFilter => Boolean(filter)),
    [activeCustomQuickFilterIds, customQuickFilters]
  );
  const filteringMetaSignature = useMemo(() => {
    const needsFavorite =
      sortMode === 'favorites' ||
      libraryScope.type === 'favorites' ||
      quickFilters.includes('favorites') ||
      Boolean(normalizedQuery);
    const needsFolder = libraryScope.type === 'folder';
    const needsCollection = libraryScope.type === 'collection';
    const needsColor = colorFilter !== 'all' || activeCustomFilters.some((filter) => Boolean(filter.criteria.colorFilter && filter.criteria.colorFilter !== 'all')) || Boolean(normalizedQuery);
    const needsShape = shapeFilter !== 'all' || sortMode === 'size' || activeCustomFilters.some((filter) => Boolean(filter.criteria.shapeFilter && filter.criteria.shapeFilter !== 'all'));
    const needsRating = ratingFilter !== 'all' || activeCustomFilters.some((filter) => Boolean(filter.criteria.ratingFilter && filter.criteria.ratingFilter !== 'all'));
    const needsTags = Boolean(normalizedQuery) || activeCustomFilters.some((filter) => Boolean(filter.criteria.query?.trim()));
    if (!needsFavorite && !needsFolder && !needsCollection && !needsColor && !needsShape && !needsRating && !needsTags) return 'none';
    return libraryItems.map((record) => {
      const meta = libraryMeta[record.id];
      if (!meta) return record.id;
      return [
        record.id,
        needsFavorite ? Number(Boolean(meta.favorite)) : '',
        needsFolder ? meta.folderId ?? '' : '',
        needsCollection ? meta.collectionIds?.join(',') ?? '' : '',
        needsColor ? `${meta.colorFamilies?.join(',') ?? ''}|${meta.colorPalette?.join(',') ?? ''}` : '',
        needsShape ? meta.imageSize ?? '' : '',
        needsRating ? meta.rating ?? '' : '',
        needsTags ? meta.tags?.join(',') ?? '' : ''
      ].join(':');
    }).join('|');
  }, [activeCustomFilters, colorFilter, libraryItems, libraryMeta, libraryScope, normalizedQuery, quickFilters, ratingFilter, shapeFilter, sortMode]);
  const statusOptions = [
    { value: 'all', label: '默认状态' },
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
  const filteredItems = useMemo(() => sortLibraryRecords(libraryItems.filter((result) => {
    const providerName = providerNameMap.get(result.providerId) ?? result.providerName ?? result.providerId;
    const generationMode = result.generationMode ?? 'text-to-image';
    const recordTime = getRecordTimeMs(result.createdAt);
    const matchesProvider = providerFilter === 'all' || result.providerId === providerFilter;
    const matchesStatus = statusFilter === 'all' ? result.status !== 'failed' : result.status === statusFilter;
    const matchesMode =
      modeFilter === 'all' ||
      generationMode === modeFilter ||
      (modeFilter === 'with-references' && Boolean(result.referenceImages?.length));
    const matchesTime =
      timeFilter === 'all' ||
      (timeFilter === 'today' && recordTime >= todayStartMs) ||
      (timeFilter === '7d' && recordTime >= nowMs - 7 * 24 * 60 * 60 * 1000) ||
      (timeFilter === '30d' && recordTime >= nowMs - 30 * 24 * 60 * 60 * 1000);
    const referenceText = result.referenceImages?.map((reference) => `${reference.name ?? ''} ${reference.source}`).join(' ') ?? '';
    const meta = libraryMeta[result.id];
    const shapeTokens = getRecordShapeTokens(result, meta);
    const format = getRecordFormat(result);
    const rating = meta?.rating;
    const matchesShape = shapeFilter === 'all' || shapeTokens.includes(shapeFilter);
    const matchesFormat = formatFilter === 'all' || format === formatFilter;
    const matchesRating =
      ratingFilter === 'all' ||
      (ratingFilter === 'unrated' && !rating) ||
      (ratingFilter !== 'unrated' && rating === Number(ratingFilter));
    const matchesColor = libraryColorMatchesFilter(meta, colorFilter);
    const matchesQuickFilters = quickFilters.every((filter) => {
      if (filter === 'favorites') return Boolean(meta?.favorite);
      if (filter === 'recent7d') return recordTime >= nowMs - 7 * 24 * 60 * 60 * 1000;
      if (filter === 'references') return Boolean(result.referenceImages?.length);
      if (filter === 'failed') return result.status === 'failed';
      if (filter === 'local') return Boolean(result.localImagePaths?.[0]);
      return true;
    });
    const matchesLibraryScope =
      libraryScope.type === 'all' ||
      (libraryScope.type === 'favorites' && Boolean(meta?.favorite)) ||
      (libraryScope.type === 'recent7d' && recordTime >= nowMs - 7 * 24 * 60 * 60 * 1000) ||
      (libraryScope.type === 'local' && Boolean(result.localImagePaths?.[0])) ||
      (libraryScope.type === 'folder' && meta?.folderId === libraryScope.id) ||
      (libraryScope.type === 'collection' && Boolean(meta?.collectionIds?.includes(libraryScope.id)));
    const matchesCustomQuickFilters = activeCustomFilters.every((filter) => {
      const criteria = filter.criteria;
      if (criteria.query?.trim()) {
        const customQuery = criteria.query.trim().toLowerCase();
        const customText = [
          result.prompt,
          result.modelId,
          result.providerId,
          providerName,
          result.status,
          referenceText,
          result.error ?? '',
          getRecordFileName(result),
          getRecordPrimaryPath(result),
          meta?.favorite ? 'favorite 收藏 starred 星标 已收藏' : '',
          ...(meta?.colorFamilies?.map((family) => getLibraryColorLabel(family)) ?? []),
          ...(meta?.tags ?? [])
        ].join(' ').toLowerCase();
        if (!customText.includes(customQuery)) return false;
      }
      if (criteria.providerFilter && criteria.providerFilter !== 'all' && result.providerId !== criteria.providerFilter) return false;
      if (criteria.statusFilter && criteria.statusFilter !== 'all' && result.status !== criteria.statusFilter) return false;
      if (criteria.statusFilter === 'all' && result.status === 'failed') return false;
      if (criteria.modeFilter && criteria.modeFilter !== 'all' && generationMode !== criteria.modeFilter && !(criteria.modeFilter === 'with-references' && Boolean(result.referenceImages?.length))) return false;
      if (criteria.timeFilter === 'today' && recordTime < todayStartMs) return false;
      if (criteria.timeFilter === '7d' && recordTime < nowMs - 7 * 24 * 60 * 60 * 1000) return false;
      if (criteria.timeFilter === '30d' && recordTime < nowMs - 30 * 24 * 60 * 60 * 1000) return false;
      if (criteria.colorFilter && !libraryColorMatchesFilter(meta, criteria.colorFilter)) return false;
      if (criteria.shapeFilter && criteria.shapeFilter !== 'all' && !shapeTokens.includes(criteria.shapeFilter)) return false;
      if (criteria.formatFilter && criteria.formatFilter !== 'all' && format !== criteria.formatFilter) return false;
      if (criteria.ratingFilter === 'unrated' && rating) return false;
      if (criteria.ratingFilter && criteria.ratingFilter !== 'all' && criteria.ratingFilter !== 'unrated' && rating !== Number(criteria.ratingFilter)) return false;
      return true;
    });
    const statusText = generationStatusLabel(result);
    const modeSearchText = generationMode === 'image-to-image' ? '图生图 image-to-image img2img' : '文生图 text-to-image txt2img';
    const haystack = [
      result.prompt,
      result.modelId,
      result.providerId,
      providerName,
      statusText,
      result.status,
      modeSearchText,
      referenceText,
      result.error ?? '',
      getRecordFileName(result),
      getRecordPrimaryPath(result),
      meta?.favorite ? 'favorite 收藏 starred 星标 已收藏' : '',
      ...(meta?.colorFamilies?.map((family) => getLibraryColorLabel(family)) ?? []),
      result.localImagePaths?.[0] ? 'local 本地 已落盘 文件存在' : '',
      result.referenceImages?.length ? 'reference 参考图 有参考图' : '',
      ...(meta?.tags ?? [])
    ]
      .join(' ')
      .toLowerCase();
    const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
    return matchesProvider && matchesStatus && matchesMode && matchesTime && matchesShape && matchesFormat && matchesRating && matchesColor && matchesQuickFilters && matchesLibraryScope && matchesCustomQuickFilters && matchesQuery;
  }), sortMode, libraryMeta, providerNameMap), [
    activeCustomFilters,
    colorFilter,
    filteringMetaSignature,
    formatFilter,
    libraryItems,
    libraryScope,
    modeFilter,
    normalizedQuery,
    nowMs,
    providerFilter,
    providerNameMap,
    quickFilters,
    ratingFilter,
    shapeFilter,
    sortMode,
    statusFilter,
    timeFilter,
    todayStartMs
  ]);
  const filteredIds = useMemo(() => filteredItems.map((result) => result.id), [filteredItems]);
  const filteredIdsSignature = useMemo(() => filteredIds.join('|'), [filteredIds]);
  const selectedIdSet = useMemo(() => new Set(selectedRecordIds), [selectedRecordIds]);
  const visibleLibraryItems = useMemo(
    () => filteredItems.slice(0, Math.min(renderedItemCount, filteredItems.length)),
    [filteredItems, renderedItemCount]
  );
  const selectedRecord = selectedRecordId ? libraryRecordMap.get(selectedRecordId) ?? null : null;
  const diagnosticRecord = diagnosticRecordId ? libraryRecordMap.get(diagnosticRecordId) ?? null : null;
  const selectedRecords = useMemo(
    () => selectedRecordIds
      .map((recordId) => libraryRecordMap.get(recordId) ?? null)
      .filter((result): result is GenerationRecord => Boolean(result)),
    [libraryRecordMap, selectedRecordIds]
  );
  const contextRecord = contextMenu ? libraryRecordMap.get(contextMenu.recordId) ?? null : null;
  const contextSelection = selectedRecords.length ? selectedRecords : contextRecord ? [contextRecord] : [];
  const diagnosticRecordProviderName = diagnosticRecord ? providerNameMap.get(diagnosticRecord.providerId) ?? diagnosticRecord.providerName ?? diagnosticRecord.providerId : '';
  const diagnosticRecordFailureDiagnosis = useMemo(
    () => diagnosticRecord && (diagnosticRecord.error || diagnosticRecord.status === 'failed') ? diagnoseGenerationFailure(diagnosticRecord) : null,
    [diagnosticRecord]
  );
  const diagnosticRecordFailureDetails = useMemo(
    () => diagnosticRecordFailureDiagnosis && diagnosticRecord ? generationFailureDetails(diagnosticRecord) : [],
    [diagnosticRecord, diagnosticRecordFailureDiagnosis]
  );
  const diagnosticRecordFailureActions = useMemo(
    () => diagnosticRecordFailureDiagnosis && diagnosticRecord ? generationFailureActions(diagnosticRecord) : [],
    [diagnosticRecord, diagnosticRecordFailureDiagnosis]
  );
  const diagnosticRecordFailureRawText = useMemo(
    () => diagnosticRecordFailureDiagnosis && diagnosticRecord ? generationFailureRawText(diagnosticRecord) : '',
    [diagnosticRecord, diagnosticRecordFailureDiagnosis]
  );
  const diagnosticRecordRecoveryAdvice = useMemo(
    () => diagnosticRecord ? buildLibraryRecoveryAdvice(diagnosticRecord) : null,
    [diagnosticRecord]
  );
  const selectedRecordRecoveryAdvice = useMemo(
    () => selectedRecord ? buildLibraryRecoveryAdvice(selectedRecord) : null,
    [selectedRecord]
  );
  const selectedRecordMeta = selectedRecord ? libraryMeta[selectedRecord.id] : undefined;
  const selectedRecordFileName = selectedRecord ? getRecordFileName(selectedRecord) || selectedRecord.id : '';
  const selectedRecordDetailMeta = selectedRecord
    ? [selectedRecord.modelId || '-', getRecordSizeLabel(selectedRecord, selectedRecordMeta), getRecordFileSizeLabel(selectedRecord), getRecordFormatLabel(selectedRecord)]
    : [];
  const selectedRecordFolder = selectedRecordMeta?.folderId
    ? libraryOrganization.folders.find((folder) => folder.id === selectedRecordMeta.folderId)
    : undefined;
  const selectedRecordCollections = selectedRecordMeta?.collectionIds?.length
    ? libraryOrganization.collections.filter((collection) => selectedRecordMeta.collectionIds?.includes(collection.id))
    : [];
  const { folderCounts, collectionCounts, favoriteScopeCount, recentScopeCount, localScopeCount } = useMemo(() => {
    const nextFolderCounts = new Map<string, number>();
    const nextCollectionCounts = new Map<string, number>();
    let favorite = 0;
    let recent = 0;
    let local = 0;
    libraryItems.forEach((record) => {
      const meta = libraryMeta[record.id];
      if (meta?.folderId) nextFolderCounts.set(meta.folderId, (nextFolderCounts.get(meta.folderId) ?? 0) + 1);
      meta?.collectionIds?.forEach((collectionId) => {
        nextCollectionCounts.set(collectionId, (nextCollectionCounts.get(collectionId) ?? 0) + 1);
      });
      if (meta?.favorite) favorite += 1;
      if (getRecordTimeMs(record.createdAt) >= nowMs - 7 * 24 * 60 * 60 * 1000) recent += 1;
      if (record.localImagePaths?.[0]) local += 1;
    });
    return {
      folderCounts: nextFolderCounts,
      collectionCounts: nextCollectionCounts,
      favoriteScopeCount: favorite,
      recentScopeCount: recent,
      localScopeCount: local
    };
  }, [libraryItems, libraryMeta, nowMs]);
  const selectedScopeTitle =
    libraryScope.type === 'all' ? '全部作品'
      : libraryScope.type === 'favorites' ? '收藏'
      : libraryScope.type === 'recent7d' ? '最近 7 天'
      : libraryScope.type === 'local' ? '本地已落盘'
      : libraryScope.type === 'folder' ? libraryOrganization.folders.find((folder) => folder.id === libraryScope.id)?.name ?? '文件夹'
      : libraryOrganization.collections.find((collection) => collection.id === libraryScope.id)?.name ?? '收藏集';

  useEffect(() => {
    const total = filteredItems.length;
    const initialCount = Math.min(LIBRARY_INITIAL_RENDER_COUNT, total);
    setRenderedItemCount(initialCount);
    if (total <= initialCount) return;

    let cancelled = false;
    let frameId = 0;
    let nextCount = initialCount;
    const renderNextBatch = () => {
      frameId = window.requestAnimationFrame(() => {
        if (cancelled) return;
        nextCount = Math.min(nextCount + LIBRARY_RENDER_BATCH_SIZE, total);
        setRenderedItemCount(nextCount);
        if (nextCount < total) renderNextBatch();
      });
    };

    renderNextBatch();
    return () => {
      cancelled = true;
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [filteredIdsSignature, filteredItems.length]);

  useEffect(() => {
    function focusSearch() {
      setSearchVisible(true);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
    window.addEventListener(libraryFocusSearchEvent, focusSearch);
    return () => window.removeEventListener(libraryFocusSearchEvent, focusSearch);
  }, []);
  useEffect(() => {
    if (!props.isHistoryLoaded) return;
    if (selectedRecordId && !libraryRecordMap.has(selectedRecordId)) {
      setSelectedRecordId(null);
    }
    if (diagnosticRecordId && !libraryRecordMap.has(diagnosticRecordId)) {
      setDiagnosticRecordId(null);
    }
    setSelectedRecordIds((current) => {
      const next = current.filter((recordId) => libraryRecordMap.has(recordId));
      return next.length === current.length ? current : next;
    });
  }, [diagnosticRecordId, libraryRecordMap, props.isHistoryLoaded, selectedRecordId]);

  useEffect(() => {
    if (!activePanel) return;
    function closePanelOnOutsidePointer(event: globalThis.PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (dockRef.current?.contains(target)) return;
      setActivePanel(null);
    }
    window.addEventListener('pointerdown', closePanelOnOutsidePointer);
    return () => window.removeEventListener('pointerdown', closePanelOnOutsidePointer);
  }, [activePanel]);

  useEffect(() => {
    if (!colorMenuOpen) return;
    function closeColorMenu(event: globalThis.PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (colorFilterRef.current?.contains(target)) return;
      setColorMenuOpen(false);
    }
    window.addEventListener('pointerdown', closeColorMenu);
    return () => window.removeEventListener('pointerdown', closeColorMenu);
  }, [colorMenuOpen]);

  useEffect(() => {
    if (!quickFilterEditorOpen) return;
    function closeQuickFilterEditor(event: globalThis.PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (quickFilterEditorRef.current?.contains(target)) return;
      setQuickFilterEditorOpen(false);
    }
    window.addEventListener('pointerdown', closeQuickFilterEditor);
    return () => window.removeEventListener('pointerdown', closeQuickFilterEditor);
  }, [quickFilterEditorOpen]);

  useEffect(() => {
    if (!libraryOrganizerOpen) return;
    function closeOrganizerOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setLibraryOrganizerOpen(false);
    }
    window.addEventListener('keydown', closeOrganizerOnEscape);
    return () => window.removeEventListener('keydown', closeOrganizerOnEscape);
  }, [libraryOrganizerOpen]);

  useEffect(() => {
    if (!contextMenu) return;
    function closeContextMenu(event: globalThis.PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('.libraryContextMenu')) return;
      setContextMenu(null);
    }
    function closeContextMenuOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setContextMenu(null);
    }
    window.addEventListener('pointerdown', closeContextMenu);
    window.addEventListener('keydown', closeContextMenuOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeContextMenu);
      window.removeEventListener('keydown', closeContextMenuOnEscape);
    };
  }, [contextMenu]);

  async function copyText(label: string, value?: string) {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
      setCopyMessage(`${label} copied`);
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function updateLibraryMeta(recordId: string, patch: Partial<LibraryMetaEntry>) {
    setLibraryMeta((current) => {
      const entry = compactLibraryMetaEntry({
        ...current[recordId],
        ...patch
      });
      const next = { ...current };
      if (Object.keys(entry).length) next[recordId] = entry;
      else delete next[recordId];
      saveLibraryMeta(next);
      return next;
    });
  }

  function toggleFavorite(recordId: string) {
    const isFavorite = Boolean(libraryMeta[recordId]?.favorite);
    updateLibraryMeta(recordId, { favorite: !isFavorite });
    setCopyMessage(isFavorite ? '已取消收藏' : '已加入收藏');
  }

  function setRecordRating(recordId: string, rating: number) {
    const currentRating = libraryMeta[recordId]?.rating;
    updateLibraryMeta(recordId, { rating: currentRating === rating ? undefined : rating });
  }

  function analyzeRecordColors(recordId: string, image: HTMLImageElement) {
    const current = libraryMeta[recordId];
    const pending = pendingImageMetaPatchesRef.current[recordId];
    if (pending?.colorPalette?.length || pending?.colorAnalysisFailed) return;
    const imageSize = image.naturalWidth && image.naturalHeight ? `${image.naturalWidth}x${image.naturalHeight}` : undefined;
    const shouldAnalyzeColors = !current?.colorPalette?.length || current.colorPalette.length < 10 || current.colorAnalysisFailed;
    if (!shouldAnalyzeColors) {
      if (imageSize && current?.imageSize !== imageSize) queueImageMetaPatch(recordId, { imageSize });
      return;
    }
    try {
      const result = analyzeImageColors(image);
      if (!result) {
        queueImageMetaPatch(recordId, { imageSize, colorAnalysisFailed: true });
        return;
      }
      queueImageMetaPatch(recordId, {
        imageSize,
        colorPalette: result.palette,
        colorFamilies: result.families,
        colorAnalyzedAt: new Date().toISOString(),
        colorAnalysisFailed: false
      });
    } catch {
      queueImageMetaPatch(recordId, { colorAnalysisFailed: true });
    }
  }

  function setRecordsFavorite(recordIds: string[], favorite: boolean) {
    const uniqueIds = Array.from(new Set(recordIds)).filter((recordId) => libraryRecordMap.has(recordId));
    if (!uniqueIds.length) return;
    setLibraryMeta((current) => {
      const next = { ...current };
      uniqueIds.forEach((recordId) => {
        next[recordId] = {
          ...next[recordId],
          favorite
        };
      });
      saveLibraryMeta(next);
      return next;
    });
    setContextMenu(null);
    setCopyMessage(favorite ? `已收藏 ${uniqueIds.length} 项` : `已取消收藏 ${uniqueIds.length} 项`);
  }

  function updateDisplaySettings(patch: Partial<LibraryDisplaySettings>) {
    setDisplaySettings((current) => {
      const next = saveLibraryDisplaySettings({ ...current, ...patch });
      return next;
    });
  }

  function selectRecord(recordId: string, event?: MouseEvent<HTMLElement>) {
    setContextMenu(null);
    const primaryModifier = Boolean(event?.ctrlKey || event?.metaKey);
    const shiftModifier = Boolean(event?.shiftKey);
    if (shiftModifier && selectionAnchorId) {
      const anchorIndex = filteredIds.indexOf(selectionAnchorId);
      const targetIndex = filteredIds.indexOf(recordId);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
        setSelectedRecordIds(filteredIds.slice(start, end + 1));
        return;
      }
    }
    if (primaryModifier) {
      setSelectedRecordIds((current) => (
        current.includes(recordId)
          ? current.filter((item) => item !== recordId)
          : [...current, recordId]
      ));
      setSelectionAnchorId(recordId);
      return;
    }
    setSelectedRecordIds([recordId]);
    setSelectionAnchorId(recordId);
  }

  function selectAllFilteredRecords() {
    setSelectedRecordIds(filteredIds);
    setSelectionAnchorId(filteredIds[0] ?? null);
    setContextMenu(null);
  }

  function clearSelection() {
    setSelectedRecordIds([]);
    setSelectionAnchorId(null);
    setContextMenu(null);
  }

  function openLibraryContextMenu(recordId: string, event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedIdSet.has(recordId)) {
      setSelectedRecordIds([recordId]);
      setSelectionAnchorId(recordId);
    }
    const menuWidth = 176;
    const menuHeight = 430;
    setContextMenu({
      x: Math.min(event.clientX, Math.max(12, window.innerWidth - menuWidth - 12)),
      y: Math.min(event.clientY, Math.max(12, window.innerHeight - menuHeight - 12)),
      recordId
    });
  }

  function openRecordDetails(record: GenerationRecord) {
    setSelectedRecordId(record.id);
    setDiagnosticRecordId(null);
  }

  function openRecordDiagnostics(record: GenerationRecord) {
    setDiagnosticRecordId(record.id);
    setSelectedRecordId(null);
  }

  function createLibraryPreviewNavigation(record: GenerationRecord): ImagePreviewNavigation | undefined {
    const items = filteredItems
      .filter((item) => Boolean(item.imageUrls[0]))
      .map((item) => ({
        id: item.id,
        imageUrl: item.imageUrls[0],
        label: getRecordFileName(item) || item.prompt || '作品图片'
      }));
    return items.length > 1 ? { items, currentId: record.id } : undefined;
  }

  function previewRecord(record: GenerationRecord, imageUrl?: string) {
    if (!imageUrl) return;
    props.onPreview(imageUrl, createLibraryPreviewNavigation(record));
  }

  const handleSelectRecord = useStableEvent(selectRecord);
  const handleOpenLibraryContextMenu = useStableEvent(openLibraryContextMenu);
  const handlePreviewRecord = useStableEvent(previewRecord);
  const handleAnalyzeRecordColors = useStableEvent(analyzeRecordColors);
  const handleToggleFavorite = useStableEvent(toggleFavorite);
  const handleOpenRecordDetails = useStableEvent(openRecordDetails);
  const handleOpenRecordDiagnostics = useStableEvent(openRecordDiagnostics);
  const handleUseRecordAsReference = useStableEvent(useRecordAsReference);
  const handleCopyRecordPrompt = useStableEvent((record: GenerationRecord) => {
    void copyText('Prompt', record.prompt);
  });
  const handleCopyRecordPath = useStableEvent((record: GenerationRecord) => {
    void copyText('Path', getRecordPrimaryPath(record));
  });
  const handleExportRecord = useStableEvent((record: GenerationRecord) => {
    exportSelectedRecordList([record]);
  });
  const handleAssignRecordFolder = useStableEvent((recordId: string) => {
    setAssignDialog({ type: 'folder', recordIds: [recordId] });
  });
  const handleAssignRecordCollection = useStableEvent((recordId: string) => {
    setAssignDialog({ type: 'collection', recordIds: [recordId] });
  });
  const handleRemoveRecordFromCurrentScope = useStableEvent((recordId: string) => {
    removeRecordsFromCurrentScope([recordId]);
  });
  const handleDeleteRecord = useStableEvent((recordId: string) => {
    void deleteRecord(recordId);
  });

  function useRecordAsReference(record: GenerationRecord) {
    updateLibraryMeta(record.id, { lastUsedAsReferenceAt: new Date().toISOString() });
    props.onUseAsReference(record);
  }

  async function deleteRecord(recordId: string) {
    props.onRequestConfirm({
      title: '删除图册记录',
      message: '确定删除这条图册记录吗？这只会从 VisionHub 图册中移除记录，不会删除磁盘上的图片文件。',
      confirmLabel: '删除',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await props.onDelete(recordId);
          setSelectedRecordId((current) => (current === recordId ? null : current));
          setDiagnosticRecordId((current) => (current === recordId ? null : current));
          setSelectedRecordIds((current) => current.filter((item) => item !== recordId));
          setCopyMessage('已删除图册记录');
        } catch (error) {
          setCopyMessage(error instanceof Error ? error.message : String(error));
          throw error;
        }
      }
    });
  }

  async function deleteRecords(recordIds: string[]) {
    const uniqueIds = Array.from(new Set(recordIds)).filter((recordId) => libraryRecordMap.has(recordId));
    if (!uniqueIds.length) return;
    if (uniqueIds.length === 1) {
      await deleteRecord(uniqueIds[0]);
      return;
    }
    props.onRequestConfirm({
      title: '批量删除图册记录',
      message: `确定删除选中的 ${uniqueIds.length} 条图册记录吗？这只会从 VisionHub 图册中移除记录，不会删除磁盘上的图片文件。`,
      confirmLabel: '删除',
      tone: 'danger',
      onConfirm: async () => {
        try {
          for (const recordId of uniqueIds) {
            await props.onDelete(recordId);
          }
          setSelectedRecordIds((current) => current.filter((recordId) => !uniqueIds.includes(recordId)));
          setSelectedRecordId((current) => (current && uniqueIds.includes(current) ? null : current));
          setDiagnosticRecordId((current) => (current && uniqueIds.includes(current) ? null : current));
          setSelectionAnchorId(null);
          setContextMenu(null);
          setCopyMessage(`已删除 ${uniqueIds.length} 条图册记录`);
        } catch (error) {
          setCopyMessage(error instanceof Error ? error.message : String(error));
          throw error;
        }
      }
    });
  }

  async function copySelectedPrompts(records: GenerationRecord[]) {
    const prompts = records.map((record, index) => `${records.length > 1 ? `${index + 1}. ` : ''}${record.prompt}`).join('\n\n');
    await copyText(records.length > 1 ? 'Prompts' : 'Prompt', prompts);
    setContextMenu(null);
  }

  async function copySelectedPaths(records: GenerationRecord[]) {
    const paths = records
      .map((record) => getRecordPrimaryPath(record))
      .filter(Boolean);
    if (!paths.length) {
      setCopyMessage('选中记录没有可复制路径');
      setContextMenu(null);
      return;
    }
    await copyText(paths.length > 1 ? 'Paths' : 'Path', paths.join('\n'));
    setContextMenu(null);
  }

  function buildLibraryRecordList(records: GenerationRecord[]) {
    const exportedAt = new Date().toLocaleString('zh-CN');
    return [
      '# VisionHub Studio 作品画廊记录清单',
      '',
      `- 导出时间：${exportedAt}`,
      `- 记录数量：${records.length}`,
      '',
      ...records.flatMap((record, index) => {
        const providerName = providerNameMap.get(record.providerId) ?? record.providerName ?? record.providerId;
        const primaryPath = getRecordPrimaryPath(record) || '-';
        const fileName = getRecordFileName(record) || record.id;
        const meta = libraryMeta[record.id];
        return [
          `## ${index + 1}. ${fileName}`,
          '',
          `- ID：${record.id}`,
          `- 状态：${generationStatusLabel(record)}`,
          `- 平台：${providerName}`,
          `- 模型：${record.modelId || '-'}`,
          `- 类型：${(record.generationMode ?? 'text-to-image') === 'image-to-image' ? '图生图' : '文生图'}`,
          `- 生成时间：${formatTime(record.createdAt)}`,
          `- 文件 / 图片路径：${primaryPath}`,
          `- 收藏：${meta?.favorite ? '是' : '否'}`,
          `- 尺寸：${getRecordSizeLabel(record, meta)}`,
          '',
          'Prompt：',
          '',
          '```text',
          record.prompt || '',
          '```',
          ''
        ];
      })
    ].join('\n');
  }

  async function exportSelectedRecordList(records: GenerationRecord[]) {
    if (!records.length) return;
    try {
      const content = buildLibraryRecordList(records);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const suggestedFileName = `visionhub-library-records-${timestamp}.md`;
      if (isTauriRuntime()) {
        const result = await saveTextFileWithDialog({ suggestedFileName, content });
        if (!result.saved) {
          setCopyMessage('已取消导出清单');
          return;
        }
        setCopyMessage(result.path ? `已导出：${result.path}` : `已导出 ${records.length} 条记录清单`);
      } else {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = suggestedFileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 800);
        setCopyMessage(`已导出 ${records.length} 条记录清单`);
      }
      setContextMenu(null);
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function openContextDetails(records: GenerationRecord[]) {
    if (records.length !== 1) return;
    openRecordDetails(records[0]);
    setContextMenu(null);
  }

  function openContextDiagnostics(records: GenerationRecord[]) {
    if (records.length !== 1) return;
    openRecordDiagnostics(records[0]);
    setContextMenu(null);
  }

  async function recheckDiagnosticRecord(record: GenerationRecord) {
    setRecheckingRecordId(record.id);
    try {
      const updated = await props.onRecheckBackgroundRecord(record);
      setDiagnosticRecordId(updated.id);
      setSelectedRecordId(null);
      setCopyMessage(updated.status === 'succeeded' ? '后台任务已恢复到作品画廊' : '后台任务已重查');
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRecheckingRecordId(null);
    }
  }

  function useContextRecordAsReference(records: GenerationRecord[]) {
    if (records.length !== 1) return;
    useRecordAsReference(records[0]);
    setContextMenu(null);
  }

  function handleAddAction(action: LibraryAddAction) {
    setActivePanel(null);
    if (action === 'folder') {
      openCreateOrganizerDialog('folder');
      return;
    }
    if (action === 'collection') {
      openCreateOrganizerDialog('collection');
      return;
    }
    if (action === 'import-file') {
      void importLibraryFiles();
      return;
    }
    if (action === 'batch-folder') {
      void importLibraryFolder();
    }
  }

  function selectLibraryScope(scope: LibraryScope) {
    setLibraryScope(scope);
    setLibraryOrganizerOpen(false);
  }

  function updateLibraryOrganization(next: LibraryOrganization) {
    setLibraryOrganization(next);
    saveLibraryOrganization(next);
  }

  function openCreateOrganizerDialog(type: LibraryOrganizerDialogState['type']) {
    setOrganizerDialog({
      type,
      mode: 'create',
      defaultName: type === 'folder'
        ? `文件夹 ${libraryOrganization.folders.length + 1}`
        : `收藏集 ${libraryOrganization.collections.length + 1}`
    });
  }

  function openRenameOrganizerDialog(type: LibraryOrganizerDialogState['type'], targetId: string, defaultName: string) {
    setOrganizerDialog({
      type,
      mode: 'rename',
      targetId,
      defaultName
    });
  }

  function createLibraryFolder(name: string) {
    const folder: LibraryFolder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      color: libraryFolderColors[libraryOrganization.folders.length % libraryFolderColors.length],
      createdAt: new Date().toISOString()
    };
    updateLibraryOrganization({
      ...libraryOrganization,
      folders: [...libraryOrganization.folders, folder]
    });
    if (selectedRecordIds.length) {
      setLibraryMeta((current) => {
        const next = { ...current };
        selectedRecordIds.forEach((recordId) => {
          next[recordId] = { ...next[recordId], folderId: folder.id };
        });
        saveLibraryMeta(next);
        return next;
      });
    }
    selectLibraryScope({ type: 'folder', id: folder.id });
    setCopyMessage(selectedRecordIds.length ? `已创建文件夹并归入 ${selectedRecordIds.length} 项` : `已创建文件夹：${name}`);
  }

  function createLibraryCollection(name: string) {
    const collection: LibraryCollection = {
      id: `collection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      coverRecordId: selectedRecordIds[0],
      createdAt: new Date().toISOString()
    };
    updateLibraryOrganization({
      ...libraryOrganization,
      collections: [...libraryOrganization.collections, collection]
    });
    if (selectedRecordIds.length) {
      setLibraryMeta((current) => {
        const next = { ...current };
        selectedRecordIds.forEach((recordId) => {
          const ids = next[recordId]?.collectionIds ?? [];
          next[recordId] = {
            ...next[recordId],
            collectionIds: ids.includes(collection.id) ? ids : [...ids, collection.id]
          };
        });
        saveLibraryMeta(next);
        return next;
      });
    }
    selectLibraryScope({ type: 'collection', id: collection.id });
    setCopyMessage(selectedRecordIds.length ? `已创建收藏集并加入 ${selectedRecordIds.length} 项` : `已创建收藏集：${name}`);
  }

  function deleteLibraryFolder(folder: LibraryFolder) {
    props.onRequestConfirm({
      title: '删除文件夹',
      message: `确定删除“${folder.name}”吗？图片记录和磁盘文件都会保留，只会移除这个画廊文件夹分类。`,
      confirmLabel: '删除',
      tone: 'danger',
      onConfirm: async () => {
        const nextOrganization = {
          ...libraryOrganization,
          folders: libraryOrganization.folders.filter((item) => item.id !== folder.id)
        };
        updateLibraryOrganization(nextOrganization);
        setLibraryMeta((current) => {
          const next = { ...current };
          Object.entries(next).forEach(([recordId, meta]) => {
            if (meta.folderId === folder.id) {
              next[recordId] = { ...meta, folderId: undefined };
            }
          });
          saveLibraryMeta(next);
          return next;
        });
        if (libraryScope.type === 'folder' && libraryScope.id === folder.id) selectLibraryScope({ type: 'all' });
        setCopyMessage(`已删除文件夹：${folder.name}`);
      }
    });
  }

  function deleteLibraryCollection(collection: LibraryCollection) {
    props.onRequestConfirm({
      title: '删除收藏集',
      message: `确定删除“${collection.name}”吗？图片记录和磁盘文件都会保留，只会移除这个收藏集。`,
      confirmLabel: '删除',
      tone: 'danger',
      onConfirm: async () => {
        const nextOrganization = {
          ...libraryOrganization,
          collections: libraryOrganization.collections.filter((item) => item.id !== collection.id)
        };
        updateLibraryOrganization(nextOrganization);
        setLibraryMeta((current) => {
          const next = { ...current };
          Object.entries(next).forEach(([recordId, meta]) => {
            if (meta.collectionIds?.includes(collection.id)) {
              next[recordId] = {
                ...meta,
                collectionIds: meta.collectionIds.filter((id) => id !== collection.id)
              };
            }
          });
          saveLibraryMeta(next);
          return next;
        });
        if (libraryScope.type === 'collection' && libraryScope.id === collection.id) selectLibraryScope({ type: 'all' });
        setCopyMessage(`已删除收藏集：${collection.name}`);
      }
    });
  }

  function renameLibraryOrganizerItem(dialog: LibraryOrganizerDialogState, name: string) {
    if (!dialog.targetId) return;
    const nextOrganization = dialog.type === 'folder'
      ? {
          ...libraryOrganization,
          folders: libraryOrganization.folders.map((folder) => (
            folder.id === dialog.targetId ? { ...folder, name } : folder
          ))
        }
      : {
          ...libraryOrganization,
          collections: libraryOrganization.collections.map((collection) => (
            collection.id === dialog.targetId ? { ...collection, name } : collection
          ))
        };
    updateLibraryOrganization(nextOrganization);
    setCopyMessage(`已重命名：${name}`);
  }

  function assignRecordsToFolder(recordIds: string[], folderId: string) {
    if (!recordIds.length) return;
    setLibraryMeta((current) => {
      const next = { ...current };
      recordIds.forEach((recordId) => {
        next[recordId] = { ...next[recordId], folderId };
      });
      saveLibraryMeta(next);
      return next;
    });
    setAssignDialog(null);
    setContextMenu(null);
    setCopyMessage(`已移动 ${recordIds.length} 项到文件夹`);
  }

  function assignRecordsToCollection(recordIds: string[], collectionId: string) {
    if (!recordIds.length) return;
    setLibraryMeta((current) => {
      const next = { ...current };
      recordIds.forEach((recordId) => {
        const ids = next[recordId]?.collectionIds ?? [];
        next[recordId] = {
          ...next[recordId],
          collectionIds: ids.includes(collectionId) ? ids : [...ids, collectionId]
        };
      });
      saveLibraryMeta(next);
      return next;
    });
    setAssignDialog(null);
    setContextMenu(null);
    setCopyMessage(`已加入 ${recordIds.length} 项到收藏集`);
  }

  function removeRecordsFromCurrentScope(recordIds: string[]) {
    if (!recordIds.length || (libraryScope.type !== 'folder' && libraryScope.type !== 'collection')) return;
    setLibraryMeta((current) => {
      const next = { ...current };
      recordIds.forEach((recordId) => {
        const meta = next[recordId] ?? {};
        if (libraryScope.type === 'folder' && meta.folderId === libraryScope.id) {
          next[recordId] = { ...meta, folderId: undefined };
        } else if (libraryScope.type === 'collection' && meta.collectionIds?.includes(libraryScope.id)) {
          next[recordId] = {
            ...meta,
            collectionIds: meta.collectionIds.filter((id) => id !== libraryScope.id)
          };
        }
      });
      saveLibraryMeta(next);
      return next;
    });
    setContextMenu(null);
    setCopyMessage(`已从当前分类移出 ${recordIds.length} 项`);
  }

  async function importLibraryFiles() {
    try {
      const result = await importLibraryImagesFromFiles();
      const records = result.records;
      records.forEach(props.onAddResult);
      attachImportedRecordsToCurrentScope(records);
      setCopyMessage(importLibrarySummary('导入图片', records.length, result.skippedDuplicates, result.skippedUnsupported));
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function importLibraryFolder() {
    try {
      const result = await importLibraryImagesFromFolder();
      const records = result.records;
      records.forEach(props.onAddResult);
      attachImportedRecordsToCurrentScope(records);
      setCopyMessage(importLibrarySummary('导入文件夹', records.length, result.skippedDuplicates, result.skippedUnsupported));
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function importLibrarySummary(label: string, imported: number, skippedDuplicates: number, skippedUnsupported: number) {
    if (!imported && !skippedDuplicates && !skippedUnsupported) return '未选择图片或没有新增图片';
    const parts = [`${label}：新增 ${imported}`];
    if (skippedDuplicates) parts.push(`跳过重复 ${skippedDuplicates}`);
    if (skippedUnsupported) parts.push(`跳过不支持 ${skippedUnsupported}`);
    return parts.join('，');
  }

  function attachImportedRecordsToCurrentScope(records: GenerationRecord[]) {
    if (!records.length || (libraryScope.type !== 'folder' && libraryScope.type !== 'collection')) return;
    setLibraryMeta((current) => {
      const next = { ...current };
      records.forEach((record) => {
        if (libraryScope.type === 'folder') {
          next[record.id] = { ...next[record.id], folderId: libraryScope.id };
          return;
        }
        const ids = next[record.id]?.collectionIds ?? [];
        next[record.id] = {
          ...next[record.id],
          collectionIds: ids.includes(libraryScope.id) ? ids : [...ids, libraryScope.id]
        };
      });
      saveLibraryMeta(next);
      return next;
    });
  }

  function clearLibraryFilters() {
    setQuery('');
    setProviderFilter('all');
    setStatusFilter('all');
    setModeFilter('all');
    setTimeFilter('all');
    setColorFilter('all');
    setShapeFilter('all');
    setFormatFilter('all');
    setRatingFilter('all');
    setQuickFilters([]);
    setActiveCustomQuickFilterIds([]);
  }

  function toggleQuickFilter(filter: LibraryQuickFilter) {
    setQuickFilters((current) => (
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter]
    ));
  }

  function currentCustomQuickFilterCriteria(): LibraryCustomQuickFilterCriteria {
    return {
      query: query.trim() || undefined,
      providerFilter,
      statusFilter,
      modeFilter,
      timeFilter,
      colorFilter,
      shapeFilter,
      formatFilter,
      ratingFilter
    };
  }

  function customQuickFilterHasCriteria(criteria: LibraryCustomQuickFilterCriteria) {
    return Boolean(
      criteria.query ||
      criteria.providerFilter !== 'all' ||
      criteria.statusFilter !== 'all' ||
      criteria.modeFilter !== 'all' ||
      criteria.timeFilter !== 'all' ||
      criteria.colorFilter !== 'all' ||
      criteria.shapeFilter !== 'all' ||
      criteria.formatFilter !== 'all' ||
      criteria.ratingFilter !== 'all'
    );
  }

  function addCustomQuickFilter() {
    const criteria = currentCustomQuickFilterCriteria();
    if (!customQuickFilterHasCriteria(criteria)) {
      setCopyMessage('请先设置一个筛选条件，再保存快捷筛选。');
      return;
    }
    const label = quickFilterName.trim() || `筛选 ${customQuickFilters.length + 1}`;
    const nextFilter: LibraryCustomQuickFilter = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      criteria,
      createdAt: new Date().toISOString()
    };
    const next = [...customQuickFilters, nextFilter];
    setCustomQuickFilters(next);
    saveLibraryCustomQuickFilters(next);
    setActiveCustomQuickFilterIds((current) => [...current, nextFilter.id]);
    setQuickFilterName('');
    setQuickFilterEditorOpen(false);
    setCopyMessage(`已添加快捷筛选：${label}`);
  }

  function deleteCustomQuickFilter(filterId: string) {
    const next = customQuickFilters.filter((filter) => filter.id !== filterId);
    setCustomQuickFilters(next);
    saveLibraryCustomQuickFilters(next);
    setActiveCustomQuickFilterIds((current) => current.filter((id) => id !== filterId));
    setCopyMessage('已删除快捷筛选');
  }

  function toggleCustomQuickFilter(filterId: string) {
    setActiveCustomQuickFilterIds((current) => (
      current.includes(filterId)
        ? current.filter((id) => id !== filterId)
        : [...current, filterId]
    ));
  }

  const gridStyle = { '--library-thumb-scale': thumbnailScale } as CSSProperties;
  const activeFilterCount = [
    providerFilter !== 'all',
    statusFilter !== 'all',
    modeFilter !== 'all',
    timeFilter !== 'all',
    colorFilter !== 'all',
    shapeFilter !== 'all',
    formatFilter !== 'all',
    ratingFilter !== 'all',
    quickFilters.length > 0,
    activeCustomQuickFilterIds.length > 0,
    Boolean(query.trim())
  ].filter(Boolean).length;
  return (
    <>
      <header className="topbar libraryTopbar">
        <div className="pageTitleBlock">
          <p className="eyebrow">Local Library</p>
          <h1>{'\u4f5c\u54c1\u753b\u5eca'}</h1>
          <p>{'\u7ba1\u7406\u5df2\u751f\u6210\u56fe\u7247\uff0c\u67e5\u770b Prompt\uff0c\u590d\u5236\u8def\u5f84\u5e76\u6253\u5f00\u6240\u5728\u6587\u4ef6\u5939\u3002'}</p>
        </div>
        <div className="statusPills">
          <span><Image size={15} /> {props.isHistoryLoaded ? `${successCount} ${'\u7ec4\u6210\u529f\u56fe\u7247'}` : '\u6b63\u5728\u52a0\u8f7d'}</span>
          <span><HardDrive size={15} /> {localPathCount} {'\u7ec4\u5df2\u843d\u76d8'}</span>
          <span><Info size={15} /> {failedCount} {'\u6761\u5931\u8d25\u8bb0\u5f55'}</span>
        </div>
      </header>

      {filtersVisible ? (
        <section className="libraryInlineFilters" aria-label="作品画廊过滤器">
          <div className="libraryStructuredFilters">
            <label><span>平台</span><StudioSelect className="libraryFilterSelect filterIconPlatform" leadingIcon={<Globe2 size={15} />} value={providerFilter} onChange={setProviderFilter} options={providerOptions} /></label>
            <label><span>状态</span><StudioSelect className="libraryFilterSelect filterIconStatus" leadingIcon={<Info size={15} />} value={statusFilter} onChange={(value) => setStatusFilter(value as 'all' | 'succeeded' | 'failed')} options={statusOptions} /></label>
            <label><span>类型</span><StudioSelect className="libraryFilterSelect filterIconType" leadingIcon={<Image size={15} />} value={modeFilter} onChange={(value) => setModeFilter(value as typeof modeFilter)} options={modeOptions} /></label>
            <label><span>时间</span><StudioSelect className="libraryFilterSelect filterIconTime" leadingIcon={<Clock3 size={15} />} value={timeFilter} onChange={(value) => setTimeFilter(value as LibraryTimeFilter)} options={timeOptions} /></label>
            <label className="libraryColorFilter" ref={colorFilterRef}>
              <span>颜色</span>
              <button
                className={`libraryColorFilterButton ${colorMenuOpen ? 'active' : ''}`}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={colorMenuOpen}
                onClick={() => setColorMenuOpen((value) => !value)}
              >
                <span className="libraryColorWheel" />
                <span>{getLibraryColorLabel(colorFilter) || '颜色'}</span>
              </button>
              {colorMenuOpen ? (
                <div className="libraryColorFilterMenu" role="listbox" aria-label="颜色筛选">
                  {libraryColorOptions.map((option) => (
                    <button
                      className={colorFilter === option.value ? 'active' : ''}
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={colorFilter === option.value}
                      onClick={() => {
                        setColorFilter(option.value);
                        setColorMenuOpen(false);
                      }}
                    >
                      <span style={{ background: option.color }} />
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>
            <label><span>形状</span><StudioSelect className="libraryFilterSelect filterIconShape" leadingIcon={<Grid2X2 size={15} />} value={shapeFilter} onChange={(value) => setShapeFilter(value as LibraryShapeFilter)} options={libraryShapeOptions} /></label>
            <label><span>格式</span><StudioSelect className="libraryFilterSelect filterIconFormat" leadingIcon={<Database size={15} />} value={formatFilter} onChange={(value) => setFormatFilter(value as LibraryFormatFilter)} options={libraryFormatOptions} /></label>
            <label><span>评分</span><StudioSelect className="libraryFilterSelect filterIconRating" leadingIcon={<Star size={15} />} value={ratingFilter} onChange={(value) => setRatingFilter(value as LibraryRatingFilter)} options={libraryRatingOptions} /></label>
            <button className="miniButton libraryClearFiltersButton" type="button" disabled={!activeFilterCount} onClick={clearLibraryFilters}>
              {activeFilterCount ? `清空 ${activeFilterCount}` : '清空'}
            </button>
          </div>
          <div className="libraryQuickFilters" aria-label="快捷筛选">
            {libraryQuickFilters.map((filter) => (
              <button
                className={`libraryQuickFilterChip ${quickFilters.includes(filter.value) ? 'active' : ''}`}
                key={filter.value}
                type="button"
                onClick={() => toggleQuickFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
            {customQuickFilters.map((filter) => {
              const isActive = activeCustomQuickFilterIds.includes(filter.id);
              return (
                <span className={`libraryCustomQuickFilter ${isActive ? 'active' : ''}`} key={filter.id}>
                  <button
                    className="libraryCustomQuickFilterToggle"
                    type="button"
                    onClick={() => toggleCustomQuickFilter(filter.id)}
                    title={filter.label}
                  >
                    {filter.label}
                  </button>
                  <button
                    className="libraryCustomQuickFilterDelete"
                    type="button"
                    aria-label={`删除快捷筛选 ${filter.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteCustomQuickFilter(filter.id);
                    }}
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
            <div className="libraryQuickFilterAddWrap" ref={quickFilterEditorRef}>
              <button
                className={`libraryQuickFilterAddButton ${quickFilterEditorOpen ? 'active' : ''}`}
                type="button"
                aria-label="添加自定义快捷筛选"
                aria-haspopup="dialog"
                aria-expanded={quickFilterEditorOpen}
                onClick={() => setQuickFilterEditorOpen((value) => !value)}
              >
                <Plus size={14} />
              </button>
              {quickFilterEditorOpen ? (
                <div className="libraryQuickFilterEditor" role="dialog" aria-label="添加快捷筛选">
                  <div>
                    <strong>自定义快捷筛选</strong>
                    <span>保存当前搜索词和上方筛选条件</span>
                  </div>
                  <input
                    value={quickFilterName}
                    onChange={(event) => setQuickFilterName(event.target.value)}
                    placeholder={`筛选 ${customQuickFilters.length + 1}`}
                    maxLength={16}
                  />
                  <button className="libraryQuickFilterSave" type="button" onClick={addCustomQuickFilter}>
                    保存当前筛选
                  </button>
                  {customQuickFilters.length ? (
                    <div className="libraryQuickFilterManage" aria-label="管理自定义快捷筛选">
                      {customQuickFilters.map((filter) => (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => deleteCustomQuickFilter(filter.id)}
                          title={`删除 ${filter.label}`}
                        >
                          <span>{filter.label}</span>
                          <X size={12} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {selectedRecords.length > 0 ? (
        <section className="librarySelectionBar" aria-label="当前选择">
          <strong>已选 {selectedRecords.length} 项</strong>
          <span>{selectedRecords.length === filteredItems.length ? '当前结果已全选' : `当前结果 ${filteredItems.length} 项`}</span>
          <button className="miniButton" type="button" onClick={selectAllFilteredRecords}>全选当前结果</button>
          <button className="miniButton" type="button" onClick={clearSelection}>取消选择</button>
          <div className="libraryBatchMenuWrap">
            <button className="miniButton" type="button"><MoreHorizontal size={13} /> 批量操作</button>
            <div className="libraryQuickMenu libraryBatchMenu" aria-label="批量操作">
              <button type="button" onClick={() => setRecordsFavorite(selectedRecordIds, true)}><Star size={13} /> 加入收藏</button>
              <button type="button" onClick={() => setRecordsFavorite(selectedRecordIds, false)}><Star size={13} /> 取消收藏</button>
              <span className="libraryMenuDivider" />
              <button type="button" onClick={() => void copySelectedPrompts(selectedRecords)}><Copy size={13} /> 复制 Prompt</button>
              <button type="button" onClick={() => void copySelectedPaths(selectedRecords)}><Copy size={13} /> 复制路径</button>
              <button type="button" onClick={() => exportSelectedRecordList(selectedRecords)}><Download size={13} /> 导出清单</button>
              <span className="libraryMenuDivider" />
              <button type="button" onClick={() => setAssignDialog({ type: 'folder', recordIds: selectedRecordIds })}><FolderOpen size={13} /> 移至文件夹</button>
              <button type="button" onClick={() => setAssignDialog({ type: 'collection', recordIds: selectedRecordIds })}><Bookmark size={13} /> 加入收藏集</button>
              {(libraryScope.type === 'folder' || libraryScope.type === 'collection') ? (
                <button type="button" onClick={() => removeRecordsFromCurrentScope(selectedRecordIds)}><X size={13} /> 移出当前分类</button>
              ) : null}
            </div>
          </div>
          <button className="miniButton danger" type="button" onClick={() => void deleteRecords(selectedRecordIds)}><Trash2 size={13} /> 删除</button>
        </section>
      ) : null}

      <section className="libraryWorkspace" aria-label="作品画廊内容">
        {libraryOrganizerOpen ? (
          <button className="libraryOrganizerBackdrop" type="button" aria-label="关闭画廊分类" onClick={() => setLibraryOrganizerOpen(false)} />
        ) : null}
        <aside className={`libraryOrganizer ${libraryOrganizerOpen ? 'open' : ''}`} aria-label="画廊分类" aria-hidden={!libraryOrganizerOpen}>
          <div className="libraryOrganizerHeader">
            <div>
              <strong>画廊分类</strong>
              <span>{selectedScopeTitle}</span>
            </div>
            <button className="iconMiniButton" type="button" data-tooltip="关闭" aria-label="关闭画廊分类" onClick={() => setLibraryOrganizerOpen(false)}><X size={14} /></button>
          </div>
          <div className="libraryOrganizerGroup">
            <button className={libraryScope.type === 'all' ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'all' })}>
              <Image size={14} /><span>全部作品</span><em>{libraryItems.length}</em>
            </button>
            <button className={libraryScope.type === 'favorites' ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'favorites' })}>
              <Star size={14} /><span>收藏</span><em>{favoriteScopeCount}</em>
            </button>
            <button className={libraryScope.type === 'recent7d' ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'recent7d' })}>
              <Clock3 size={14} /><span>最近 7 天</span><em>{recentScopeCount}</em>
            </button>
            <button className={libraryScope.type === 'local' ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'local' })}>
              <HardDrive size={14} /><span>本地已落盘</span><em>{localScopeCount}</em>
            </button>
          </div>
          <div className="libraryOrganizerSection">
            <div><strong>文件夹</strong><button type="button" aria-label="新建文件夹" onClick={() => openCreateOrganizerDialog('folder')}><Plus size={13} /></button></div>
            {libraryOrganization.folders.length ? libraryOrganization.folders.map((folder) => (
              <div className="libraryOrganizerItem" key={folder.id}>
                <button className={libraryScope.type === 'folder' && libraryScope.id === folder.id ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'folder', id: folder.id })}>
                  <span className="libraryFolderDot" style={{ background: folder.color }} /><span>{folder.name}</span><em>{folderCounts.get(folder.id) ?? 0}</em>
                </button>
                <span className="libraryOrganizerItemActions">
                  <button
                    className="libraryOrganizerIconAction"
                    type="button"
                    aria-label={`重命名文件夹 ${folder.name}`}
                    onClick={() => openRenameOrganizerDialog('folder', folder.id, folder.name)}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="libraryOrganizerDelete"
                    type="button"
                    aria-label={`删除文件夹 ${folder.name}`}
                    onClick={() => deleteLibraryFolder(folder)}
                  >
                    <X size={12} />
                  </button>
                </span>
              </div>
            )) : <p>还没有文件夹</p>}
          </div>
          <div className="libraryOrganizerSection">
            <div><strong>收藏集</strong><button type="button" aria-label="新建收藏集" onClick={() => openCreateOrganizerDialog('collection')}><Plus size={13} /></button></div>
            {libraryOrganization.collections.length ? libraryOrganization.collections.map((collection) => (
              <div className="libraryOrganizerItem" key={collection.id}>
                <button className={libraryScope.type === 'collection' && libraryScope.id === collection.id ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'collection', id: collection.id })}>
                  <Bookmark size={14} /><span>{collection.name}</span><em>{collectionCounts.get(collection.id) ?? 0}</em>
                </button>
                <span className="libraryOrganizerItemActions">
                  <button
                    className="libraryOrganizerIconAction"
                    type="button"
                    aria-label={`重命名收藏集 ${collection.name}`}
                    onClick={() => openRenameOrganizerDialog('collection', collection.id, collection.name)}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="libraryOrganizerDelete"
                    type="button"
                    aria-label={`删除收藏集 ${collection.name}`}
                    onClick={() => deleteLibraryCollection(collection)}
                  >
                    <X size={12} />
                  </button>
                </span>
              </div>
            )) : <p>还没有收藏集</p>}
          </div>
        </aside>

        <div className="libraryContentPane">
          <div className="libraryScopeBar">
            <strong>
              {libraryScope.type === 'favorites' ? <Star size={15} /> :
                libraryScope.type === 'recent7d' ? <Clock3 size={15} /> :
                libraryScope.type === 'local' ? <HardDrive size={15} /> :
                libraryScope.type === 'folder' ? <FolderOpen size={15} /> :
                libraryScope.type === 'collection' ? <Bookmark size={15} /> :
                <Image size={15} />}
              {selectedScopeTitle}
            </strong>
            <span>{filteredItems.length} 项</span>
            {libraryScope.type !== 'all' ? (
              <button className="libraryScopeClearButton" type="button" aria-label="返回全部作品" onClick={() => selectLibraryScope({ type: 'all' })}>
                <X size={13} />
              </button>
            ) : null}
          </div>

          {!props.isHistoryLoaded ? (
            <div className="emptyState libraryEmpty"><Sparkles size={42} /><h3>{'\u6b63\u5728\u52a0\u8f7d\u672c\u5730\u5386\u53f2'}</h3></div>
          ) : filteredItems.length === 0 ? (
            <div className="emptyState libraryEmpty">
              <Sparkles size={42} />
              <h3>{libraryItems.length === 0 ? '\u8fd8\u6ca1\u6709\u672c\u5730\u56fe\u7247' : '\u6ca1\u6709\u7b26\u5408\u6761\u4ef6\u7684\u8bb0\u5f55'}</h3>
              <p>{libraryItems.length === 0 ? '\u5148\u5728\u751f\u6210\u5de5\u4f5c\u53f0\u751f\u6210\u4e00\u5f20\u56fe\uff0c\u6210\u529f\u540e\u4f1a\u81ea\u52a8\u8fdb\u5165\u672c\u5730\u56fe\u518c\u3002' : '\u8bd5\u7740\u6e05\u7a7a\u641c\u7d22\u8bcd\u6216\u5207\u6362\u7b5b\u9009\u6761\u4ef6\u3002'}</p>
            </div>
          ) : (
            <section className={`libraryGrid libraryGridV2 view-${viewMode} ${displaySettings.compact ? 'compact' : ''}`} style={gridStyle}>
              {visibleLibraryItems.map((result) => (
                <LibraryRecordCard
                  key={result.id}
                  record={result}
                  providerName={providerNameMap.get(result.providerId) ?? result.providerName ?? result.providerId}
                  meta={libraryMeta[result.id]}
                  isSelected={selectedIdSet.has(result.id)}
                  viewMode={viewMode}
                  displaySettings={displaySettings}
                  isCurrentScopeRemovable={libraryScope.type === 'folder' || libraryScope.type === 'collection'}
                  onSelect={handleSelectRecord}
                  onOpenContextMenu={handleOpenLibraryContextMenu}
                  onPreview={handlePreviewRecord}
                  onAnalyzeColors={handleAnalyzeRecordColors}
                  onToggleFavorite={handleToggleFavorite}
                  onOpenDetails={handleOpenRecordDetails}
                  onOpenDiagnostics={handleOpenRecordDiagnostics}
                  onUseAsReference={handleUseRecordAsReference}
                  onCopyPrompt={handleCopyRecordPrompt}
                  onCopyPath={handleCopyRecordPath}
                  onExportRecord={handleExportRecord}
                  onAssignFolder={handleAssignRecordFolder}
                  onAssignCollection={handleAssignRecordCollection}
                  onRemoveFromCurrentScope={handleRemoveRecordFromCurrentScope}
                  onDelete={handleDeleteRecord}
                />
              ))}
            </section>
          )}
        </div>
      </section>

      {contextMenu && contextSelection.length > 0 ? (
        <div
          className="libraryContextMenu"
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="libraryContextMenuHeader">
            <strong>{contextSelection.length > 1 ? `${contextSelection.length} 项已选` : '图片操作'}</strong>
            <button className="iconMiniButton" type="button" data-tooltip="关闭" aria-label="关闭" onClick={() => setContextMenu(null)}><X size={13} /></button>
          </div>
          {contextSelection.length === 1 ? (
            <>
              <button type="button" role="menuitem" onClick={() => openContextDetails(contextSelection)}>
                <Info size={13} /> 打开详情
              </button>
              {contextSelection[0]?.error || contextSelection[0]?.status === 'failed' ? (
                <button type="button" role="menuitem" onClick={() => openContextDiagnostics(contextSelection)}>
                  <Gauge size={13} /> 查看诊断
                </button>
              ) : null}
              <button type="button" role="menuitem" disabled={!contextSelection[0]?.imageUrls[0]} onClick={() => useContextRecordAsReference(contextSelection)}>
                <ImagePlus size={13} /> 设为参考图
              </button>
            </>
          ) : null}
          <button type="button" role="menuitem" onClick={() => void copySelectedPrompts(contextSelection)}>
            <Copy size={13} /> 复制 Prompt
          </button>
          <button type="button" role="menuitem" onClick={() => void copySelectedPaths(contextSelection)}>
            <Copy size={13} /> 复制路径
          </button>
          <button type="button" role="menuitem" onClick={() => exportSelectedRecordList(contextSelection)}>
            <Download size={13} /> 导出清单
          </button>
          <span className="libraryMenuDivider" />
          <button type="button" role="menuitem" onClick={() => setAssignDialog({ type: 'folder', recordIds: contextSelection.map((record) => record.id) })}>
            <FolderOpen size={13} /> 移至文件夹
          </button>
          <button type="button" role="menuitem" onClick={() => setAssignDialog({ type: 'collection', recordIds: contextSelection.map((record) => record.id) })}>
            <Bookmark size={13} /> 加入收藏集
          </button>
          {(libraryScope.type === 'folder' || libraryScope.type === 'collection') ? (
            <button type="button" role="menuitem" onClick={() => removeRecordsFromCurrentScope(contextSelection.map((record) => record.id))}>
              <X size={13} /> 移出当前分类
            </button>
          ) : null}
          <span className="libraryMenuDivider" />
          {contextSelection.length === 1 ? (
            <button type="button" role="menuitem" onClick={() => setRecordsFavorite(contextSelection.map((record) => record.id), !libraryMeta[contextSelection[0].id]?.favorite)}>
              <Star size={13} /> {libraryMeta[contextSelection[0].id]?.favorite ? '取消收藏' : '加入收藏'}
            </button>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => setRecordsFavorite(contextSelection.map((record) => record.id), true)}>
                <Star size={13} /> 加入收藏
              </button>
              <button type="button" role="menuitem" onClick={() => setRecordsFavorite(contextSelection.map((record) => record.id), false)}>
                <Star size={13} /> 取消收藏
              </button>
            </>
          )}
          <button className="dangerAction" type="button" role="menuitem" onClick={() => void deleteRecords(contextSelection.map((record) => record.id))}>
            <Trash2 size={13} /> {contextSelection.length > 1 ? '删除选中记录' : '删除记录'}
          </button>
        </div>
      ) : null}

      {organizerDialog ? (
        <LibraryOrganizerDialog
          type={organizerDialog.type}
          mode={organizerDialog.mode}
          defaultName={organizerDialog.defaultName}
          selectedCount={selectedRecordIds.length}
          onClose={() => setOrganizerDialog(null)}
          onSubmit={(name) => {
            if (organizerDialog.mode === 'rename') renameLibraryOrganizerItem(organizerDialog, name);
            else if (organizerDialog.type === 'folder') createLibraryFolder(name);
            else createLibraryCollection(name);
            setOrganizerDialog(null);
          }}
        />
      ) : null}

      {assignDialog ? (
        <LibraryAssignDialog
          type={assignDialog.type}
          recordCount={assignDialog.recordIds.length}
          assignedIds={
            assignDialog.type === 'folder'
              ? Array.from(new Set(assignDialog.recordIds.map((recordId) => libraryMeta[recordId]?.folderId).filter((id): id is string => Boolean(id))))
              : Array.from(new Set(assignDialog.recordIds.flatMap((recordId) => libraryMeta[recordId]?.collectionIds ?? [])))
          }
          folders={libraryOrganization.folders}
          collections={libraryOrganization.collections}
          onClose={() => setAssignDialog(null)}
          onCreate={() => {
            setAssignDialog(null);
            openCreateOrganizerDialog(assignDialog.type);
          }}
          onSelect={(targetId) => {
            if (assignDialog.type === 'folder') assignRecordsToFolder(assignDialog.recordIds, targetId);
            else assignRecordsToCollection(assignDialog.recordIds, targetId);
          }}
        />
      ) : null}

      <section ref={dockRef} className={`libraryFloatingDock ${searchVisible ? '' : 'collapsed'}`}>
        {activePanel ? (
          <div className={`libraryDockPanel dockPanel-${activePanel} ${activePanel === 'add' ? 'dockAlignEnd' : 'dockAlignStart'}`}>
            <div className="libraryDockPanelHeader">
              <strong>
                {activePanel === 'main' ? '画廊菜单' : activePanel === 'view' ? '网格样式' : activePanel === 'display' ? '显示设置' : activePanel === 'sort' ? '排序方式' : '新增'}
              </strong>
              <button
                className="iconMiniButton"
                type="button"
                data-tooltip={isDockSubPanel ? '返回菜单' : '关闭面板'}
                aria-label={isDockSubPanel ? '返回菜单' : '关闭面板'}
                onClick={() => setActivePanel(isDockSubPanel ? 'main' : null)}
              >
                {isDockSubPanel ? <Sidebar size={14} /> : <X size={14} />}
              </button>
            </div>
            {activePanel === 'main' ? (
              <div className="libraryMainMenuGrid">
                <button type="button" onClick={() => setSearchVisible((value) => !value)}>
                  <Sidebar size={15} />
                  <span>{searchVisible ? '隐藏搜索栏' : '显示搜索栏'}</span>
                </button>
                <button type="button" onClick={() => setFiltersVisible((value) => !value)}>
                  <SlidersHorizontal size={15} />
                  <span>{filtersVisible ? '隐藏过滤器' : '显示过滤器'}{activeFilterCount ? ` (${activeFilterCount})` : ''}</span>
                </button>
                <button className="menuHasChild" type="button" onClick={() => setActivePanel('view')}>
                  <Grid2X2 size={15} />
                  <span>网格样式</span>
                  <ChevronRight className="menuChevron" size={14} />
                </button>
                <button className="menuHasChild" type="button" onClick={() => setActivePanel('display')}>
                  <Settings size={15} />
                  <span>显示设置</span>
                  <ChevronRight className="menuChevron" size={14} />
                </button>
                <button className="menuHasChild" type="button" onClick={() => setActivePanel('sort')}>
                  <Clock3 size={15} />
                  <span>排序方式</span>
                  <ChevronRight className="menuChevron" size={14} />
                </button>
                <button type="button" onClick={() => setThumbnailScale((value) => Math.min(1.28, Number((value + 0.08).toFixed(2))))}>
                  <ZoomIn size={15} />
                  <span>放大</span>
                </button>
                <button type="button" onClick={() => setThumbnailScale((value) => Math.max(0.78, Number((value - 0.08).toFixed(2))))}>
                  <ZoomOut size={15} />
                  <span>缩小</span>
                </button>
              </div>
            ) : null}
            {activePanel === 'view' ? (
              <div className="librarySegmentGrid">
                {libraryViewOptions.map((option) => (
                  <button className={viewMode === option.value ? 'active' : ''} key={option.value} type="button" onClick={() => setViewMode(option.value)}>{option.label}</button>
                ))}
                <button type="button" onClick={() => setThumbnailScale((value) => Math.min(1.28, Number((value + 0.08).toFixed(2))))}><ZoomIn size={14} /> 放大</button>
                <button type="button" onClick={() => setThumbnailScale((value) => Math.max(0.78, Number((value - 0.08).toFixed(2))))}><ZoomOut size={14} /> 缩小</button>
              </div>
            ) : null}
            {activePanel === 'display' ? (
              <div className="libraryDisplayList">
                <label><input type="checkbox" checked={displaySettings.showPrompt} onChange={(event) => updateDisplaySettings({ showPrompt: event.target.checked })} /> 显示卡片 Prompt 摘要</label>
                <label><input type="checkbox" checked={displaySettings.showProvider} onChange={(event) => updateDisplaySettings({ showProvider: event.target.checked })} /> 显示平台</label>
                <label><input type="checkbox" checked={displaySettings.showModel} onChange={(event) => updateDisplaySettings({ showModel: event.target.checked })} /> 显示模型名</label>
                <label><input type="checkbox" checked={displaySettings.showReferenceBadge} onChange={(event) => updateDisplaySettings({ showReferenceBadge: event.target.checked })} /> 显示参考图标记</label>
                <label><input type="checkbox" checked={displaySettings.compact} onChange={(event) => updateDisplaySettings({ compact: event.target.checked })} /> 紧凑间距</label>
              </div>
            ) : null}
            {activePanel === 'sort' ? (
              <div className="librarySegmentGrid">
                {librarySortOptions.map((option) => (
                  <button className={sortMode === option.value ? 'active' : ''} key={option.value} type="button" onClick={() => setSortMode(option.value)}>{option.label}</button>
                ))}
              </div>
            ) : null}
            {activePanel === 'add' ? (
              <div className="libraryAddList">
                {libraryAddActions.map((action) => (
                  <button key={action.id} type="button" onClick={() => handleAddAction(action.id)}>
                    {action.id === 'folder' ? <FolderOpen size={15} /> : action.id === 'collection' ? <Bookmark size={15} /> : action.id === 'import-file' ? <Upload size={15} /> : <Database size={15} />}
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="libraryDockBar">
          <button className={`libraryDockIcon ${libraryOrganizerOpen ? 'active' : ''}`} type="button" data-tooltip="画廊分类" aria-label="画廊分类" onClick={() => setLibraryOrganizerOpen((value) => !value)}>
            <FolderOpen size={18} />
          </button>
          <button className="libraryDockIcon" type="button" data-tooltip="菜单" aria-label="菜单" onClick={() => setActivePanel((panel) => panel === 'main' ? null : 'main')}>
            <SlidersHorizontal size={18} />{activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          {searchVisible ? (
            <label className="libraryDockSearch">
              <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Prompt、模型、平台、收藏、路径或错误信息" />
            </label>
          ) : (
            <button className="libraryDockRestore" type="button" onClick={() => setSearchVisible(true)}>显示搜索栏</button>
          )}
          <button className="libraryDockAdd" type="button" data-tooltip="新增" aria-label="新增" onClick={() => setActivePanel((panel) => panel === 'add' ? null : 'add')}><Plus size={19} /></button>
        </div>
      </section>

      {selectedRecord ? (
        <>
          <button
            className="libraryDetailBackdrop"
            type="button"
            aria-label="关闭图片详情"
            onClick={() => setSelectedRecordId(null)}
          />
          <aside className="libraryDetailDrawer" aria-label="图片详情">
            <div className="libraryDetailHeader">
              <div className="libraryDetailTitle">
                <p className="eyebrow">Image Details</p>
                <h2>{libraryMeta[selectedRecord.id]?.favorite ? '收藏作品' : '图片详情'}</h2>
                <small title={selectedRecordFileName}>{selectedRecordFileName}</small>
              </div>
              <div className="libraryDetailHeaderActions">
                <button className="iconMiniButton" type="button" data-tooltip="关闭详情" aria-label="关闭详情" onClick={() => setSelectedRecordId(null)}><X size={15} /></button>
              </div>
            </div>
            {selectedRecord.imageUrls[0] ? (
              <div className="libraryDetailPreview">
                <button className="libraryDetailPreviewImageButton" type="button" onClick={() => props.onPreview(selectedRecord.imageUrls[0])}>
                  <img
                    src={selectedRecord.imageUrls[0]}
                    alt={selectedRecord.prompt}
                    decoding="async"
                    onLoad={(event) => analyzeRecordColors(selectedRecord.id, event.currentTarget)}
                  />
                </button>
                <div className="libraryRatingControl" aria-label="图片评分">
                  {libraryRatingValues.map((rating) => (
                    <button
                      className={(selectedRecordMeta?.rating ?? 0) >= rating ? 'active' : ''}
                      key={rating}
                      type="button"
                      aria-label={`${rating} 星`}
                      title={`${rating} 星`}
                      onClick={() => setRecordRating(selectedRecord.id, rating)}
                    >
                      <Star size={15} fill={(selectedRecordMeta?.rating ?? 0) >= rating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <span className="libraryDetailImageMetaOverlay" aria-label="图片信息">
                  {selectedRecordDetailMeta.map((item, index) => (
                    <span key={`${item}-${index}`}>{item}</span>
                  ))}
                </span>
              </div>
            ) : (
              <div className="libraryDetailMissing">没有可预览图片</div>
            )}
            <div className="libraryDetailColorSection">
              <span>主色</span>
              {selectedRecordMeta?.colorPalette?.length ? (
                <div className="libraryAutoColorPalette" aria-label="自动识别主色">
                  {selectedRecordMeta.colorPalette.map((color) => (
                    <span key={color} title={color} style={{ background: color }} />
                  ))}
                </div>
              ) : (
                <small>{selectedRecordMeta?.colorAnalysisFailed ? '未识别' : '分析中'}</small>
              )}
            </div>
            <div className="libraryDetailSection promptDetailSection">
              <div className="libraryPromptHeader">
                <strong>Prompt</strong>
                <button className="miniButton libraryPromptCopyButton" type="button" onClick={() => void copyText('Prompt', selectedRecord.prompt)}>
                  <Copy size={12} /> 复制
                </button>
              </div>
              <p>{selectedRecord.prompt}</p>
            </div>
            <div className="libraryDetailOrganizerSection">
              <div className="libraryDetailOrganizerHeader">
                <div className="libraryDetailOrganizerTitleLine">
                  <strong>归类</strong>
                  <div className="libraryDetailOrganizerChips">
                    {selectedRecordFolder ? (
                      <button type="button" onClick={() => {
                        selectLibraryScope({ type: 'folder', id: selectedRecordFolder.id });
                        setSelectedRecordId(null);
                      }}>
                        <span className="libraryFolderDot" style={{ background: selectedRecordFolder.color }} />
                        <span>{selectedRecordFolder.name}</span>
                      </button>
                    ) : (
                      <span><FolderOpen size={13} /> 未归入文件夹</span>
                    )}
                    {selectedRecordCollections.length ? selectedRecordCollections.map((collection) => (
                      <button key={collection.id} type="button" onClick={() => {
                        selectLibraryScope({ type: 'collection', id: collection.id });
                        setSelectedRecordId(null);
                      }}>
                        <Bookmark size={13} />
                        <span>{collection.name}</span>
                      </button>
                    )) : (
                      <span><Bookmark size={13} /> 未加入收藏集</span>
                    )}
                  </div>
                </div>
                <div className="libraryDetailOrganizerActions">
                  <button className="iconMiniButton" type="button" data-tooltip="移至文件夹" aria-label="移至文件夹" onClick={() => setAssignDialog({ type: 'folder', recordIds: [selectedRecord.id] })}><FolderOpen size={14} /></button>
                  <button className="iconMiniButton" type="button" data-tooltip="加入收藏集" aria-label="加入收藏集" onClick={() => setAssignDialog({ type: 'collection', recordIds: [selectedRecord.id] })}><Bookmark size={14} /></button>
                  {(libraryScope.type === 'folder' || libraryScope.type === 'collection') ? (
                    <button className="iconMiniButton" type="button" data-tooltip="移出当前分类" aria-label="移出当前分类" onClick={() => removeRecordsFromCurrentScope([selectedRecord.id])}><X size={14} /></button>
                  ) : null}
                </div>
              </div>
            </div>
            {selectedRecordRecoveryAdvice ? (
              <div className="libraryDetailSection libraryRecoveryAdvicePanel">
                <div className="generationDiagnosticHeader">
                  <div>
                    <span>恢复建议</span>
                    <strong>{selectedRecordRecoveryAdvice.title}</strong>
                  </div>
                </div>
                <p>{selectedRecordRecoveryAdvice.summary}</p>
                <ul className="generationErrorActionsList libraryErrorActionsList">
                  {selectedRecordRecoveryAdvice.actions.map((action) => <li key={action}>{action}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="libraryDetailActions">
              <button className={`miniButton ${libraryMeta[selectedRecord.id]?.favorite ? 'active' : ''}`} type="button" onClick={() => toggleFavorite(selectedRecord.id)}><Star size={13} /> {libraryMeta[selectedRecord.id]?.favorite ? '已收藏' : '收藏'}</button>
              <button className="miniButton" type="button" disabled={!selectedRecord.imageUrls[0]} onClick={() => useRecordAsReference(selectedRecord)}><ImagePlus size={13} /> 设为参考图</button>
              <button className="miniButton" type="button" onClick={() => props.onRetryRecord(selectedRecord)}><RefreshCcw size={13} /> 重新生成</button>
              {selectedRecord.error || selectedRecord.status === 'failed' ? (
                <button className="miniButton" type="button" onClick={() => openRecordDiagnostics(selectedRecord)}><Gauge size={13} /> 查看诊断</button>
              ) : null}
              <button className="miniButton" type="button" disabled={!getRecordPrimaryPath(selectedRecord)} onClick={() => void copyText('Path', getRecordPrimaryPath(selectedRecord))}><Copy size={13} /> 路径</button>
              <button className="miniButton" type="button" disabled={!getRecordRevealPath(selectedRecord)} onClick={() => {
                const path = getRecordRevealPath(selectedRecord);
                if (path) void revealGenerationFile(path);
              }}><FolderOpen size={13} /> 文件夹</button>
              <button className="miniButton danger" type="button" onClick={() => void deleteRecord(selectedRecord.id)}><Trash2 size={13} /> 删除记录</button>
            </div>
            {selectedRecord.referenceImages?.length ? (
              <div
                className="libraryDetailSection libraryReferenceDetailSection"
                style={{ '--reference-detail-list-max-height': `${Math.min(selectedRecord.referenceImages.length * 92 - 10, 358)}px` } as CSSProperties}
              >
                <strong>参考图来源</strong>
                <div className="libraryReferenceDetailList">
                  {selectedRecord.referenceImages.map((reference, index) => {
                    const previewUrl = getReferencePreviewUrl(reference);
                    return (
                      <article className="libraryReferenceDetailItem" key={reference.id || `${reference.source}-${index}`}>
                        <button
                          className="libraryReferenceDetailThumb"
                          type="button"
                          disabled={!previewUrl}
                          onClick={() => previewUrl && props.onPreview(previewUrl)}
                        >
                          {previewUrl ? <img src={previewUrl} alt={reference.name ?? `参考图 ${index + 1}`} /> : <ImagePlus size={16} />}
                        </button>
                        <div>
                          <strong>{reference.name || `参考图 ${index + 1}`}</strong>
                          <span>{referenceSourceDisplayLabel(reference.source)} · {referenceRoleLabel(reference.role)}</span>
                          {reference.localPath ? <small title={reference.localPath}>{reference.localPath}</small> : null}
                          {reference.sourceGenerationId ? <small>来源记录：{reference.sourceGenerationId}</small> : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </aside>
        </>
      ) : null}
      {diagnosticRecord && diagnosticRecordFailureDiagnosis ? (
        <>
          <button
            className="libraryDetailBackdrop"
            type="button"
            aria-label="关闭错误诊断"
            onClick={() => setDiagnosticRecordId(null)}
          />
          <aside className="libraryDetailDrawer libraryDiagnosticDrawer" aria-label="错误诊断">
            <div className="libraryDetailHeader">
              <div className="libraryDetailTitle">
                <p className="eyebrow">Error Diagnostics</p>
                <h2>错误诊断</h2>
                <small title={getRecordFileName(diagnosticRecord) || diagnosticRecord.id}>{getRecordFileName(diagnosticRecord) || diagnosticRecord.id}</small>
              </div>
              <div className="libraryDetailHeaderActions">
                <button className="iconMiniButton" type="button" data-tooltip="查看详情" aria-label="查看详情" onClick={() => openRecordDetails(diagnosticRecord)}><Info size={15} /></button>
                <button className="iconMiniButton" type="button" data-tooltip="关闭诊断" aria-label="关闭诊断" onClick={() => setDiagnosticRecordId(null)}><X size={15} /></button>
              </div>
            </div>
            <div className={`libraryDetailSection warning generationDiagnosticPanel severity-${diagnosticRecordFailureDiagnosis.severity}`}>
              <div className="generationDiagnosticHeader">
                <div>
                  <span>错误诊断报告</span>
                  <strong>{diagnosticRecordFailureDiagnosis.title}</strong>
                </div>
                <em>{generationFailureCategoryLabels[diagnosticRecordFailureDiagnosis.category]} · {generationFailureSeverityLabels[diagnosticRecordFailureDiagnosis.severity]}</em>
              </div>
              <p>{diagnosticRecordFailureDiagnosis.summary}</p>
              <div className="generationDiagnosisChips" aria-label="诊断关键参数">
                <span>状态：{generationStatusLabel(diagnosticRecord)}</span>
                <span>平台：{diagnosticRecordProviderName}</span>
                <span>模型：{diagnosticRecord.modelId || '-'}</span>
                {diagnosticRecordFailureDetails.map((detail) => <span key={detail}>{detail}</span>)}
              </div>
              {diagnosticRecordFailureDiagnosis.isPotentialBackgroundCompletion ? (
                <div className="generationBackgroundNotice">
                  <Clock3 size={14} />
                  <span>这类记录不一定彻底失败，建议先重载历史或到中转站后台核查是否已有生成结果，再决定是否重新生成。</span>
                </div>
              ) : null}
              {diagnosticRecordFailureDiagnosis.isPotentialBackgroundCompletion ? (
                <div className="generationRecoveryCallout">
                  <div>
                    <strong>后台任务重查</strong>
                    <span>如果 raw 中保存了 poll_url，可尝试向中转站重新查询结果；成功后会自动恢复到作品画廊。</span>
                  </div>
                  <button
                    className="miniButton"
                    type="button"
                    disabled={recheckingRecordId === diagnosticRecord.id}
                    onClick={() => void recheckDiagnosticRecord(diagnosticRecord)}
                  >
                    <RefreshCcw size={13} /> {recheckingRecordId === diagnosticRecord.id ? '重查中…' : '重查后台任务'}
                  </button>
                </div>
              ) : null}
              {diagnosticRecordRecoveryAdvice ? (
                <div className="generationDiagnosticBlock libraryRecoveryAdvicePanel compact">
                  <strong>{diagnosticRecordRecoveryAdvice.title}</strong>
                  <p>{diagnosticRecordRecoveryAdvice.summary}</p>
                  <ul className="generationErrorActionsList libraryErrorActionsList">
                    {diagnosticRecordRecoveryAdvice.actions.map((action) => <li key={action}>{action}</li>)}
                  </ul>
                </div>
              ) : null}
              <div className="generationDiagnosticBlock">
                <strong>建议操作</strong>
                <ul className="generationErrorActionsList libraryErrorActionsList">
                  {diagnosticRecordFailureActions.map((action) => <li key={action}>{action}</li>)}
                </ul>
              </div>
              {diagnosticRecordFailureRawText ? (
                <details className="generationRawDetails">
                  <summary>原始错误 / Raw 摘要</summary>
                  <pre>{clipDiagnosticText(diagnosticRecordFailureRawText)}</pre>
                </details>
              ) : null}
              <div className="libraryDetailInlineActions generationDiagnosticActions">
                <button className="miniButton" type="button" onClick={() => props.onRetryRecord(diagnosticRecord)}><RefreshCcw size={13} /> 重新生成</button>
                <button className="miniButton" type="button" onClick={() => void copyText('错误诊断', generationFailureCopyText(diagnosticRecord, diagnosticRecordProviderName))}><Copy size={13} /> 复制诊断</button>
                <button className="miniButton" type="button" onClick={() => void copyText('请求摘要', generationRequestSummaryCopyText(diagnosticRecord, diagnosticRecordProviderName))}><Copy size={13} /> 复制请求摘要</button>
                <button className="miniButton" type="button" disabled={!diagnosticRecordFailureRawText} onClick={() => void copyText('Raw', diagnosticRecordFailureRawText)}><Database size={13} /> 复制 Raw</button>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
});

function PromptTemplatesPage(props: { onUseTemplate: (prompt: string) => void }) {
  type TemplateSourceFilter = 'all' | 'default' | 'custom' | 'favorite' | 'recent';
  type TemplateViewMode = 'card' | 'list';
  type TemplateDraft = {
    id: string;
    title: string;
    category: PromptTemplateCategory;
    tone: string;
    description: string;
    prompt: string;
    tags: string;
  };

  const emptyDraft: TemplateDraft = {
    id: '',
    title: '',
    category: 'style',
    tone: '',
    description: '',
    prompt: '',
    tags: ''
  };
  const templateSourceOptions: Array<{ value: TemplateSourceFilter; label: string }> = [
    { value: 'all', label: '全部来源' },
    { value: 'default', label: '系统模板' },
    { value: 'custom', label: '我的模板' },
    { value: 'favorite', label: '已收藏' },
    { value: 'recent', label: '最近使用' }
  ];

  const [templates, setTemplates] = useState<PromptTemplate[]>(() => loadPromptTemplates());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | PromptTemplateCategory>('all');
  const [sourceFilter, setSourceFilter] = useState<TemplateSourceFilter>('all');
  const [viewMode, setViewMode] = useState<TemplateViewMode>('card');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [copyMessage, setCopyMessage] = useState('');
  useToastMessage(copyMessage, setCopyMessage);

  function persistTemplates(nextTemplates: PromptTemplate[]) {
    setTemplates(nextTemplates);
    savePromptTemplates(nextTemplates);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredTemplates = useMemo(() => {
    return templates
      .filter((template) => {
        const matchesCategory = category === 'all' || template.category === category;
        const matchesSource =
          sourceFilter === 'all' ||
          (sourceFilter === 'default' && !template.custom) ||
          (sourceFilter === 'custom' && template.custom) ||
          (sourceFilter === 'favorite' && template.favorite) ||
          (sourceFilter === 'recent' && Boolean(template.lastUsedAt));
        const haystack = [
          template.title,
          template.tone,
          template.description ?? '',
          template.prompt,
          ...template.tags,
          ...(template.variables ?? [])
        ].join(' ').toLowerCase();
        return matchesCategory && matchesSource && (!normalizedQuery || haystack.includes(normalizedQuery));
      })
      .sort((left, right) => {
        if (sourceFilter === 'recent') return Number(right.lastUsedAt ?? 0) - Number(left.lastUsedAt ?? 0);
        if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;
        return Number(right.lastUsedAt ?? 0) - Number(left.lastUsedAt ?? 0) || left.title.localeCompare(right.title, 'zh-CN');
      });
  }, [category, normalizedQuery, sourceFilter, templates]);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? filteredTemplates[0] ?? null,
    [filteredTemplates, selectedTemplateId, templates]
  );
  const selectedTemplateVariables = useMemo(() => {
    if (!selectedTemplate) return [];
    const fromTemplate = selectedTemplate.variables?.filter((variable) => variable.trim()) ?? [];
    if (fromTemplate.length) return Array.from(new Set(fromTemplate));
    return Array.from(new Set(Array.from(selectedTemplate.prompt.matchAll(/\{([^{}]+)\}/g)).map((match) => match[1].trim()).filter(Boolean)));
  }, [selectedTemplate]);
  const renderedPrompt = useMemo(() => {
    if (!selectedTemplate) return '';
    return selectedTemplate.prompt.replace(/\{([^{}]+)\}/g, (match, key: string) => {
      const value = variableValues[key.trim()]?.trim();
      return value || match;
    });
  }, [selectedTemplate, variableValues]);
  const favoriteCount = templates.filter((template) => template.favorite).length;
  const recentCount = templates.filter((template) => template.lastUsedAt).length;

  useEffect(() => {
    if (!filteredTemplates.length) {
      setSelectedTemplateId(null);
      return;
    }
    if (!selectedTemplateId || !filteredTemplates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(filteredTemplates[0].id);
    }
  }, [filteredTemplates, selectedTemplateId]);

  useEffect(() => {
    setVariableValues({});
  }, [selectedTemplate?.id]);

  function categoryLabel(value: PromptTemplateCategory) {
    return PROMPT_TEMPLATE_CATEGORIES.find((item) => item.value === value)?.label ?? value;
  }

  function tagsToText(tags: string[]) {
    return tags.join('，');
  }

  function parseTemplateTags(value: string) {
    return value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean);
  }

  function startCreateTemplate() {
    setEditingTemplateId('new');
    setDetailOpen(true);
    setDraft(emptyDraft);
  }

  function startEditTemplate(template: PromptTemplate) {
    setEditingTemplateId(template.id);
    setDetailOpen(true);
    setDraft({
      id: template.id,
      title: template.title,
      category: template.category,
      tone: template.tone,
      description: template.description ?? '',
      prompt: template.prompt,
      tags: tagsToText(template.tags)
    });
  }

  function cancelEditTemplate() {
    setEditingTemplateId(null);
    setDraft(emptyDraft);
  }

  function saveDraftTemplate() {
    const title = draft.title.trim();
    const prompt = draft.prompt.trim();
    if (!title || !prompt) {
      setCopyMessage('请填写模板标题和 Prompt。');
      return;
    }
    const previous = draft.id ? templates.find((template) => template.id === draft.id) : undefined;
    const shouldUpdateExisting = Boolean(previous?.custom);
    const nextTemplate = createPromptTemplate({
      id: shouldUpdateExisting ? previous?.id : undefined,
      title,
      category: draft.category,
      tone: draft.tone.trim() || '自定义模板',
      description: draft.description.trim() || undefined,
      prompt,
      tags: parseTemplateTags(draft.tags),
      favorite: previous?.favorite,
      lastUsedAt: previous?.lastUsedAt,
      usedCount: previous?.usedCount
    });
    const next = shouldUpdateExisting
      ? templates.map((template) => (template.id === draft.id ? { ...nextTemplate, createdAt: previous?.createdAt ?? nextTemplate.createdAt } : template))
      : [nextTemplate, ...templates];
    persistTemplates(next.slice(0, 300));
    setSelectedTemplateId(nextTemplate.id);
    setDetailOpen(true);
    cancelEditTemplate();
    setCopyMessage(shouldUpdateExisting ? '模板已更新。' : '已另存为我的模板。');
  }

  function deleteTemplate(template: PromptTemplate) {
    if (!template.custom) {
      setCopyMessage('系统模板不可删除；可以编辑后另存为我的模板。');
      return;
    }
    if (!window.confirm(`确定删除“${template.title}”吗？这只会删除提示词库里的模板，不影响作品和灵感收藏。`)) return;
    const next = templates.filter((item) => item.id !== template.id);
    persistTemplates(next);
    setSelectedTemplateId(next[0]?.id ?? null);
    setDetailOpen(false);
    if (editingTemplateId === template.id) cancelEditTemplate();
    setCopyMessage('模板已删除。');
  }

  function toggleTemplateFavorite(template: PromptTemplate) {
    persistTemplates(templates.map((item) => item.id === template.id ? { ...item, favorite: !item.favorite } : item));
  }

  function markTemplateUsed(template: PromptTemplate) {
    const now = String(Date.now());
    persistTemplates(templates.map((item) => item.id === template.id ? {
      ...item,
      lastUsedAt: now,
      usedCount: (item.usedCount ?? 0) + 1
    } : item));
  }

  function useTemplate(template: PromptTemplate) {
    const promptToUse = template.id === selectedTemplate?.id ? renderedPrompt : template.prompt;
    props.onUseTemplate(promptToUse);
    markTemplateUsed(template);
  }

  async function copyTemplate(template: PromptTemplate) {
    try {
      const promptToCopy = template.id === selectedTemplate?.id ? renderedPrompt : template.prompt;
      await navigator.clipboard?.writeText(promptToCopy);
      markTemplateUsed(template);
      setCopyMessage(`已复制：${template.title}`);
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function clearTemplateFilters() {
    setQuery('');
    setCategory('all');
    setSourceFilter('all');
  }

  return (
    <section className="promptLibraryPage">
      <header className="topbar templateTopbar">
        <div className="pageTitleBlock">
          <p className="eyebrow">Prompt Library</p>
          <h1>提示词库</h1>
          <p>管理可复用 Prompt 模板，支持分类、收藏、最近使用、自定义模板和变量预填。</p>
        </div>
        <div className="statusPills">
          <span><Layers size={15} /> {templates.length} 个模板</span>
          <span><Star size={15} /> {favoriteCount} 个收藏</span>
          <span><Clock3 size={15} /> {recentCount} 个最近使用</span>
        </div>
      </header>

      <section className="templateToolbar promptLibraryToolbar">
        <label className="templateSearchBox">
          <span>搜索标题 / 标签 / Prompt</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：电商、角色、图生图、免费平台" />
        </label>
        <label>
          <span>分类</span>
          <StudioSelect value={category} onChange={(value) => setCategory(value as 'all' | PromptTemplateCategory)} options={PROMPT_TEMPLATE_CATEGORIES} />
        </label>
        <label>
          <span>来源</span>
          <StudioSelect value={sourceFilter} onChange={(value) => setSourceFilter(value as TemplateSourceFilter)} options={templateSourceOptions} />
        </label>
        <div className="promptLibraryToolbarActions">
          <button
            className={`miniButton favoriteFilterButton ${sourceFilter === 'favorite' ? 'active' : ''}`}
            type="button"
            onClick={() => setSourceFilter(sourceFilter === 'favorite' ? 'all' : 'favorite')}
            title={sourceFilter === 'favorite' ? '显示全部模板' : '只看收藏模板'}
            aria-label={sourceFilter === 'favorite' ? '显示全部模板' : '只看收藏模板'}
          >
            <Star size={13} fill={sourceFilter === 'favorite' ? 'currentColor' : 'none'} /> 收藏
          </button>
          <div className="segmentedControl compactSegment" aria-label="提示词库视图">
            <button className={viewMode === 'card' ? 'active' : ''} onClick={() => setViewMode('card')} type="button"><Grid2X2 size={13} /> 卡片</button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} type="button"><Layers size={13} /> 列表</button>
          </div>
          <button className="miniButton" type="button" onClick={clearTemplateFilters}><X size={13} /> 清空</button>
          <button className="miniButton primaryMini" type="button" onClick={startCreateTemplate}><Plus size={13} /> 新建模板</button>
        </div>
      </section>

      <section className="promptCategoryStrip" aria-label="提示词库分类">
          {PROMPT_TEMPLATE_CATEGORIES.map((item) => {
            const count = item.value === 'all' ? templates.length : templates.filter((template) => template.category === item.value).length;
            return (
              <button className={category === item.value ? 'active' : ''} key={item.value} type="button" onClick={() => setCategory(item.value)}>
                <span>{item.label}</span>
                <small>{count}</small>
              </button>
            );
          })}
      </section>

      <section className="promptLibraryLayout">
        <section className="promptLibraryListPanel">
          <div className="promptLibraryListHeader">
            <strong>{filteredTemplates.length} 个结果</strong>
            <span>{sourceFilter === 'all' ? '全部来源' : templateSourceOptions.find((item) => item.value === sourceFilter)?.label}</span>
          </div>
          {filteredTemplates.length === 0 ? (
            <div className="emptyState templateEmpty">
              <Sparkles size={42} />
              <h3>没有符合条件的模板</h3>
              <p>可以清空筛选，或新建一个自定义模板。</p>
            </div>
          ) : (
            <div className={viewMode === 'list' ? 'promptTemplateList' : 'promptTemplateCards'}>
              {filteredTemplates.map((template) => (
                <article
                  className={`promptTemplateItem ${viewMode === 'list' ? 'listMode' : ''} ${selectedTemplate?.id === template.id ? 'active' : ''}`}
                  key={template.id}
                  onClick={() => { setSelectedTemplateId(template.id); setEditingTemplateId(null); setDetailOpen(true); }}
                >
                  <div className="promptTemplateItemHeader">
                    <span className="badge">{categoryLabel(template.category)}</span>
                    <button
                      className={`iconMiniButton promptFavoriteButton ${template.favorite ? 'active' : ''}`}
                      type="button"
                      title={template.favorite ? '取消收藏' : '收藏模板'}
                      aria-label={template.favorite ? `取消收藏 ${template.title}` : `收藏 ${template.title}`}
                      onClick={(event) => { event.stopPropagation(); toggleTemplateFavorite(template); }}
                    >
                      <Star size={13} fill={template.favorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <strong title={template.title}>{template.title}</strong>
                  <small>{template.tone || '未填写调性'}</small>
                  <p>{template.description || template.prompt}</p>
                  <div className="templateTags">
                    {template.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                  <div className="promptTemplateMetaLine">
                    <span>{template.custom ? '我的模板' : '系统模板'}</span>
                    <span>{template.usedCount ? `使用 ${template.usedCount} 次` : '尚未使用'}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      {detailOpen ? (
        <div className="templateDrawerBackdrop" onClick={() => { setDetailOpen(false); setEditingTemplateId(null); }}>
        <aside className="promptTemplateDetail templateDetailDrawer" aria-label="提示词模板详情" onClick={(event) => event.stopPropagation()}>
          {editingTemplateId ? (
            <>
              <div className="panelTitleRow">
                <div>
                  <strong>{editingTemplateId === 'new' ? '新建模板' : '编辑模板'}</strong>
                  <p>先做基础管理；导入 / 导出后续再接。</p>
                </div>
                <button className="iconMiniButton" type="button" onClick={() => { setDetailOpen(false); cancelEditTemplate(); }} title="关闭编辑" aria-label="关闭编辑"><X size={13} /></button>
              </div>
              <div className="promptTemplateEditor">
                <label><span>标题</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：赛博角色海报" /></label>
                <label><span>分类</span><StudioSelect value={draft.category} onChange={(value) => setDraft({ ...draft, category: value as PromptTemplateCategory })} options={PROMPT_TEMPLATE_CATEGORIES.filter((item) => item.value !== 'all') as Array<{ value: PromptTemplateCategory; label: string }>} /></label>
                <label><span>调性</span><input value={draft.tone} onChange={(event) => setDraft({ ...draft, tone: event.target.value })} placeholder="例如：电影感、高级、适合角色展示" /></label>
                <label><span>说明</span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={2} placeholder="这个模板最适合什么场景" /></label>
                <label><span>标签</span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="角色，海报，游戏" /></label>
                <label><span>Prompt</span><textarea value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} rows={8} placeholder="支持自定义变量，例如：{产品}、{材质}、{背景}。详情页会自动生成变量预填。" /></label>
              </div>
              <div className="sourceEditorActions">
                <button className="miniButton" type="button" onClick={() => { setDetailOpen(false); cancelEditTemplate(); }}><X size={13} /> 取消</button>
                <button className="miniButton primaryMini" type="button" onClick={saveDraftTemplate}><Pencil size={13} /> 保存模板</button>
              </div>
            </>
          ) : selectedTemplate ? (
            <>
              <div className="panelTitleRow">
                <div>
                  <span className="badge">{categoryLabel(selectedTemplate.category)}</span>
                  <strong>{selectedTemplate.title}</strong>
                  <p>{selectedTemplate.description || selectedTemplate.tone}</p>
                </div>
                <div className="templateDrawerTopActions">
                  <button
                    className={`iconMiniButton promptFavoriteButton ${selectedTemplate.favorite ? 'active' : ''}`}
                    type="button"
                    title={selectedTemplate.favorite ? '取消收藏' : '收藏模板'}
                    aria-label={selectedTemplate.favorite ? '取消收藏模板' : '收藏模板'}
                    onClick={() => toggleTemplateFavorite(selectedTemplate)}
                  >
                    <Star size={14} fill={selectedTemplate.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button className="iconMiniButton" type="button" onClick={() => setDetailOpen(false)} title="关闭详情" aria-label="关闭详情"><X size={13} /></button>
                </div>
              </div>

              <div className="promptTemplateDetailMeta">
                <span>{selectedTemplate.custom ? '我的模板' : '系统模板'}</span>
                <span>{selectedTemplate.usedCount ? `使用 ${selectedTemplate.usedCount} 次` : '尚未使用'}</span>
                <span>{selectedTemplate.lastUsedAt ? '最近已用' : '未进入最近使用'}</span>
              </div>

              <div className="promptTemplateVariables">
                <div className="sectionHeadingRow">
                  <strong>变量预填</strong>
                  <small>{selectedTemplateVariables.length} 个模板变量</small>
                </div>
                {selectedTemplateVariables.map((variable) => (
                  <label key={variable}>
                    <span>{variable}</span>
                    <input
                      value={variableValues[variable] ?? ''}
                      onChange={(event) => setVariableValues((current) => ({ ...current, [variable]: event.target.value }))}
                      placeholder={`填写${variable}`}
                    />
                  </label>
                ))}
              </div>

              <label className="promptTemplatePreview">
                <span>预览 Prompt</span>
                <textarea value={renderedPrompt} readOnly rows={9} />
              </label>

              <div className="templateTags promptTemplateDetailTags">
                {selectedTemplate.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>

              <div className="promptTemplateDetailActions">
                <button className="miniButton primaryMini" type="button" onClick={() => useTemplate(selectedTemplate)}><Wand2 size={13} /> 套用到创作台</button>
                <button className="miniButton" type="button" onClick={() => void copyTemplate(selectedTemplate)}><Copy size={13} /> 复制</button>
                <button className="miniButton" type="button" onClick={() => startEditTemplate(selectedTemplate)}><Pencil size={13} /> {selectedTemplate.custom ? '编辑' : '另存'}</button>
                <button
                  className="miniButton dangerText"
                  type="button"
                  disabled={!selectedTemplate.custom}
                  title={selectedTemplate.custom ? '删除模板' : '系统模板不可删除'}
                  onClick={() => deleteTemplate(selectedTemplate)}
                >
                  <Trash2 size={13} /> 删除
                </button>
              </div>
            </>
          ) : (
            <div className="emptyState templateEmpty">
              <Layers size={42} />
              <h3>选择一个模板</h3>
              <p>左侧选中模板后，这里会显示详情和变量预填。</p>
            </div>
          )}
        </aside>
        </div>
      ) : null}
    </section>
  );
}

function LibraryOrganizerDialog(props: {
  type: 'folder' | 'collection';
  mode: 'create' | 'rename';
  defaultName: string;
  selectedCount: number;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(props.defaultName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const title = props.mode === 'rename'
    ? props.type === 'folder' ? '重命名文件夹' : '重命名收藏集'
    : props.type === 'folder' ? '新建文件夹' : '新建收藏集';
  const hint = props.mode === 'rename'
    ? '只修改画廊内显示名称，不影响图片记录和磁盘文件。'
    : props.selectedCount
    ? `创建后会自动加入当前选中的 ${props.selectedCount} 项。`
    : props.type === 'folder'
      ? '用于把作品归入一个主要分类。'
      : '用于把作品加入可复用的项目合集。';

  useEffect(() => {
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') props.onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [props.onClose]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    props.onSubmit(trimmed);
  }

  return (
    <div className="modalBackdrop organizerDialogBackdrop" onClick={props.onClose}>
      <section className="organizerDialog" role="dialog" aria-modal="true" aria-labelledby="organizer-dialog-title" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="eyebrow">Gallery Organizer</p>
            <h2 id="organizer-dialog-title">{title}</h2>
          </div>
          <button className="iconMiniButton" type="button" data-tooltip="关闭" aria-label="关闭" onClick={props.onClose}><X size={15} /></button>
        </header>
        <label>
          <span>名称</span>
          <input
            ref={inputRef}
            value={name}
            maxLength={24}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <p>{hint}</p>
        <div className="organizerDialogActions">
          <button type="button" className="confirmCancelButton" onClick={props.onClose}>取消</button>
          <button type="button" className="confirmPrimaryButton" disabled={!name.trim()} onClick={submit}>{props.mode === 'rename' ? '保存' : '创建'}</button>
        </div>
      </section>
    </div>
  );
}

function LibraryAssignDialog(props: {
  type: 'folder' | 'collection';
  recordCount: number;
  assignedIds: string[];
  folders: LibraryFolder[];
  collections: LibraryCollection[];
  onClose: () => void;
  onCreate: () => void;
  onSelect: (targetId: string) => void;
}) {
  const items: Array<{ id: string; name: string; color?: string }> = props.type === 'folder'
    ? props.folders.map((folder) => ({ id: folder.id, name: folder.name, color: folder.color }))
    : props.collections.map((collection) => ({ id: collection.id, name: collection.name }));
  const title = props.type === 'folder' ? '移至文件夹' : '加入收藏集';
  const emptyText = props.type === 'folder' ? '还没有文件夹' : '还没有收藏集';

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') props.onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [props.onClose]);

  return (
    <div className="modalBackdrop organizerDialogBackdrop" onClick={props.onClose}>
      <section className="assignDialog" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="eyebrow">Gallery Organizer</p>
            <h2>{title}</h2>
            <span>{props.recordCount} 项</span>
          </div>
          <button className="iconMiniButton" type="button" data-tooltip="关闭" aria-label="关闭" onClick={props.onClose}><X size={15} /></button>
        </header>
        <div className="assignDialogList">
          {items.length ? items.map((item) => {
            const isAssigned = props.assignedIds.includes(item.id);
            const disabled = isAssigned && props.recordCount === 1;
            return (
            <button className={isAssigned ? 'assigned' : ''} key={item.id} type="button" disabled={disabled} onClick={() => props.onSelect(item.id)}>
              {props.type === 'folder'
                ? <span className="libraryFolderDot" style={{ background: item.color ?? libraryFolderColors[0] }} />
                : <Bookmark size={14} />}
              <span>{item.name}</span>
              {isAssigned ? <em>{props.recordCount === 1 ? '已在此处' : '部分已在'}</em> : null}
            </button>
            );
          }) : (
            <p>{emptyText}</p>
          )}
        </div>
        <button className="assignDialogCreate" type="button" onClick={props.onCreate}>
          <Plus size={14} /> {props.type === 'folder' ? '新建文件夹' : '新建收藏集'}
        </button>
      </section>
    </div>
  );
}

function ConfirmDialog(props: {
  request: ConfirmDialogState;
  onClose: () => void;
  onError: (error: string) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const confirmLabel = props.request.confirmLabel ?? '确认';
  const cancelLabel = props.request.cancelLabel ?? '取消';
  const tone = props.request.tone ?? 'default';

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) props.onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isSubmitting, props.onClose]);

  async function handleConfirm() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    props.onError('');
    try {
      await props.request.onConfirm();
      props.onClose();
    } catch (error) {
      props.onError(error instanceof Error ? error.message : String(error));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modalBackdrop confirmBackdrop" onClick={() => !isSubmitting && props.onClose()}>
      <section className={`confirmDialog ${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message" onClick={(event) => event.stopPropagation()}>
        <div className="confirmIconWrap">
          <Trash2 size={22} />
        </div>
        <div className="confirmContent">
          <p className="eyebrow">Confirm Action</p>
          <h2 id="confirm-dialog-title">{props.request.title}</h2>
          <p id="confirm-dialog-message">{props.request.message}</p>
          {props.request.error ? <small className="confirmError">{props.request.error}</small> : null}
        </div>
        <div className="confirmActions">
          <button type="button" className="confirmCancelButton" disabled={isSubmitting} onClick={props.onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={`confirmPrimaryButton ${tone}`} disabled={isSubmitting} onClick={() => void handleConfirm()}>
            {isSubmitting ? '处理中…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}


function UtilityModalShell(props: { title: string; eyebrow?: string; className?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') props.onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [props.onClose]);

  return (
    <div className="modalBackdrop utilityModalBackdrop" onClick={props.onClose}>
      <section className={`utilityModal ${props.className ?? ''}`} role="dialog" aria-modal="true" aria-label={props.title} onClick={(event) => event.stopPropagation()}>
        <header className="utilityModalHeader">
          <div>
            {props.eyebrow ? <p className="eyebrow">{props.eyebrow}</p> : null}
            <h2>{props.title}</h2>
          </div>
          <button type="button" data-tooltip="关闭" aria-label="关闭" onClick={props.onClose}>
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
    { label: '版本', value: APP_VERSION },
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

const ImagePreviewModal = memo(function ImagePreviewModal(props: {
  imageUrl: string;
  navigation?: ImagePreviewNavigation;
  onNavigate?: (item: ImagePreviewNavigationItem) => void;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const pointerDownPoint = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const navigationItems = props.navigation?.items ?? [];
  const navigationIndex = props.navigation
    ? navigationItems.findIndex((item) => item.id === props.navigation?.currentId)
    : -1;
  const hasPreviewNavigation = Boolean(props.onNavigate && navigationItems.length > 1 && navigationIndex >= 0);
  const canNavigatePrevious = hasPreviewNavigation && navigationIndex > 0;
  const canNavigateNext = hasPreviewNavigation && navigationIndex < navigationItems.length - 1;

  const applyImageTransform = useCallback((nextOffset: { x: number; y: number }, nextScale: number) => {
    if (!imageRef.current) return;
    imageRef.current.style.setProperty('--preview-offset-x', `${nextOffset.x}px`);
    imageRef.current.style.setProperty('--preview-offset-y', `${nextOffset.y}px`);
    imageRef.current.style.setProperty('--preview-scale', String(nextScale));
  }, []);

  useEffect(() => {
    setScale(1);
    offsetRef.current = { x: 0, y: 0 };
    scaleRef.current = 1;
    setIsDragging(false);
    didDrag.current = false;
    window.requestAnimationFrame(() => applyImageTransform({ x: 0, y: 0 }, 1));
    window.setTimeout(() => modalRef.current?.focus(), 0);
  }, [applyImageTransform, props.imageUrl]);

  function clampScale(value: number) {
    return Math.min(6, Math.max(0.25, value));
  }

  function zoomBy(delta: number) {
    setScale((current) => {
      const nextScale = clampScale(Number((current + delta).toFixed(2)));
      scaleRef.current = nextScale;
      applyImageTransform(offsetRef.current, nextScale);
      return nextScale;
    });
  }

  function resetView() {
    setScale(1);
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setIsDragging(false);
    didDrag.current = false;
    applyImageTransform({ x: 0, y: 0 }, 1);
  }

  function navigatePreview(delta: -1 | 1) {
    if (!hasPreviewNavigation) return;
    const target = navigationItems[navigationIndex + delta];
    if (!target) return;
    props.onNavigate?.(target);
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
      x: event.clientX - offsetRef.current.x,
      y: event.clientY - offsetRef.current.y
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    const moveX = event.clientX - pointerDownPoint.current.x;
    const moveY = event.clientY - pointerDownPoint.current.y;
    if (Math.hypot(moveX, moveY) > 4) didDrag.current = true;
    const nextOffset = {
      x: event.clientX - dragStart.x,
      y: event.clientY - dragStart.y
    };
    offsetRef.current = nextOffset;
    applyImageTransform(nextOffset, scaleRef.current);
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
    if (event.key === 'ArrowLeft' && hasPreviewNavigation) {
      event.preventDefault();
      navigatePreview(-1);
      return;
    }
    if (event.key === 'ArrowRight' && hasPreviewNavigation) {
      event.preventDefault();
      navigatePreview(1);
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

  const previewContent = (
    <div ref={modalRef} className="modalBackdrop previewModalBackdrop" onClick={props.onClose} onKeyDown={handlePreviewKeyDown} tabIndex={-1}>
      <div className="previewModal">
        <div className="previewToolbar" onClick={(event) => event.stopPropagation()}>
          <button type="button" data-tooltip="缩小" aria-label="缩小" onClick={() => zoomBy(-0.2)}>
            <ZoomOut size={16} />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button type="button" data-tooltip="放大" aria-label="放大" onClick={() => zoomBy(0.2)}>
            <ZoomIn size={16} />
          </button>
          <button type="button" data-tooltip="适配窗口" aria-label="适配窗口" onClick={resetView}>
            <Maximize2 size={16} />
          </button>
          <button type="button" data-tooltip="关闭预览" aria-label="关闭预览" onClick={props.onClose}>
            <X size={18} />
          </button>
        </div>
        {hasPreviewNavigation ? (
          <>
            <button
              className="previewNavButton previous"
              type="button"
              disabled={!canNavigatePrevious}
              data-tooltip="上一张"
              aria-label="上一张"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                navigatePreview(-1);
              }}
            >
              <ChevronLeft size={30} />
            </button>
            <button
              className="previewNavButton next"
              type="button"
              disabled={!canNavigateNext}
              data-tooltip="下一张"
              aria-label="下一张"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                navigatePreview(1);
              }}
            >
              <ChevronRight size={30} />
            </button>
            <div className="previewNavCounter" aria-label="预览序号">
              {navigationIndex + 1} / {navigationItems.length}
            </div>
          </>
        ) : null}
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
            ref={imageRef}
            src={props.imageUrl}
            alt="生成图片预览"
            draggable={false}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? previewContent : createPortal(previewContent, document.body);
});

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

function referenceRoleLabel(role?: ReferenceImage['role']) {
  const labels: Record<NonNullable<ReferenceImage['role']>, string> = {
    auto: '自动',
    composition: '构图',
    style: '风格',
    character: '角色',
    color: '颜色'
  };
  return role ? labels[role] ?? role : '自动';
}

function referenceSourceDisplayLabel(source: ReferenceImage['source']) {
  const labels: Record<ReferenceImage['source'], string> = {
    upload: '本地',
    'generated-result': '作品',
    clipboard: '剪贴板',
    'drag-drop': '拖拽',
    inspiration: '灵感'
  };
  return labels[source] ?? source;
}

function getReferencePreviewUrl(reference: ReferenceImage) {
  return reference.previewUrl || reference.dataUrl || reference.localPath || '';
}

function createEmptyProviderDraftConfig(
  provider: ReturnType<typeof listProviders>[number],
  serviceTemplate?: ProviderServiceTemplate
): OpenAICompatibleConfig {
  const isOfficialOpenAI = provider.id === 'openai-gpt-image';
  const isMiniMax = provider.id === 'minimax-image';
  const firstModel = provider.models[0]?.id ?? '';
  return {
    ...defaultOpenAICompatibleConfig,
    displayName: serviceTemplate?.defaultDisplayName ?? '',
    baseUrl: isOfficialOpenAI ? OFFICIAL_OPENAI_BASE_URL : isMiniMax ? 'https://api.minimaxi.com' : '',
    modelId: firstModel,
    protocol: isMiniMax ? 'custom-images' : 'images',
    endpointPath: isMiniMax ? '/v1/image_generation' : defaultEndpointForProtocol('images'),
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

function providerUsesConfig(providerId: string) {
  return providerId === 'openai-gpt-image' || providerId === 'custom-http-provider' || providerId === 'minimax-image';
}

function providerSupportsOpenAICompatibleModelList(providerId: string) {
  return providerId === 'openai-gpt-image' || providerId === 'custom-http-provider';
}

function defaultBaseUrlPlaceholder(providerId: string) {
  if (providerId === 'openai-gpt-image') return OFFICIAL_OPENAI_BASE_URL;
  if (providerId === 'minimax-image') return 'https://api.minimaxi.com';
  return 'https://你的聚合站或中转站';
}

function defaultEndpointPlaceholder(providerId: string) {
  if (providerId === 'minimax-image') return '/v1/image_generation';
  return '/v1/images/generations';
}

function providerEndpointHint(providerId: string) {
  if (providerId === 'minimax-image') {
    return 'MiniMax 官方文生图接口默认使用 /v1/image_generation；保存后真实请求会使用这里的路径。';
  }
  return '可按中转站文档自主修改，例如 /images/generations、/v1/images/generations 或 /v1/responses；保存后真实请求会使用这里的路径。';
}

function getDefaultProviderServiceTemplateForProvider(providerId: string) {
  if (providerId === 'custom-http-provider') return getProviderServiceTemplate('aggregator-openai-compatible');
  if (providerId === 'openai-gpt-image') return getProviderServiceTemplate('official-openai');
  if (providerId === 'minimax-image') return getProviderServiceTemplate('official-minimax');
  return providerServiceTemplates.find((template) => template.providerId === providerId);
}

function providerProfileBelongsToTemplate(
  profile: ProviderConnectionProfile,
  template: ProviderServiceTemplate
) {
  if (!template.providerId || profile.providerId !== template.providerId) return false;
  if (profile.serviceTemplateId) return profile.serviceTemplateId === template.id;
  return template.id === 'aggregator-openai-compatible' || template.id === 'official-openai' || template.id === 'official-minimax';
}

function providerGenerationLabel(provider: ReturnType<typeof listProviders>[number]) {
  const template = getDefaultProviderServiceTemplateForProvider(provider.id);
  const platform = template
    ? providerPlatformOptions.find((item) => item.id === template.platformType)
    : undefined;
  return template && platform ? `${platform.label} · ${template.label}` : provider.name;
}

type ProviderProfileFilter = 'all' | 'enabled' | 'passed' | 'warning' | 'failed' | 'untested';

function buildProviderProfileFilterOptions(profiles: ProviderConnectionProfile[]) {
  const counts: Record<ProviderProfileFilter, number> = {
    all: profiles.length,
    enabled: profiles.filter((profile) => profile.enabled).length,
    passed: profiles.filter((profile) => profile.lastTestStatus === 'passed').length,
    warning: profiles.filter((profile) => profile.lastTestStatus === 'warning').length,
    failed: profiles.filter((profile) => profile.lastTestStatus === 'failed').length,
    untested: profiles.filter((profile) => profile.lastTestStatus === 'untested').length
  };
  const labels: Record<ProviderProfileFilter, string> = {
    all: '全部',
    enabled: '已启用',
    passed: '已验证',
    warning: '注意',
    failed: '失败',
    untested: '未测试'
  };
  return (Object.keys(labels) as ProviderProfileFilter[]).map((id) => ({
    id,
    label: labels[id],
    count: counts[id]
  }));
}

function matchesProviderProfileFilter(profile: ProviderConnectionProfile, filter: ProviderProfileFilter) {
  if (filter === 'all') return true;
  if (filter === 'enabled') return profile.enabled;
  return profile.lastTestStatus === filter;
}

function profileLabel(status: ProviderConnectionProfile['lastTestStatus']) {
  const labels: Record<ProviderConnectionProfile['lastTestStatus'], string> = {
    untested: '未测试',
    passed: '通过',
    warning: '注意',
    failed: '失败'
  };
  return labels[status] ?? '未测试';
}

function protocolLabel(protocol: OpenAICompatibleConfig['protocol']) {
  const labels: Record<OpenAICompatibleConfig['protocol'], string> = {
    images: 'Images',
    responses: 'Responses',
    'chat-completions': 'Chat',
    'custom-images': 'Custom'
  };
  return labels[protocol];
}

function imageToImageAdapterLabel(adapter: ImageToImageAdapter) {
  const labels: Record<ImageToImageAdapter, string> = {
    auto: '自动选择',
    'openai-images-edit': 'OpenAI Images edits',
    'responses-input-image': 'Responses input_image',
    'chat-image-url': 'Chat image_url',
    'json-image-array': 'JSON image/images'
  };
  return labels[adapter];
}

function imageToImageAdapterDescription(adapter: ImageToImageAdapter) {
  const descriptions: Record<ImageToImageAdapter, string> = {
    auto: '按当前平台和协议自动选择，日常优先用这个。',
    'openai-images-edit': '官方 Images 图生图，使用 multipart 上传参考图。',
    'responses-input-image': 'Responses 协议，把参考图作为 input_image 发送。',
    'chat-image-url': '聊天接口包装图生图，把参考图放进 image_url。',
    'json-image-array': '自定义中转常用，发送 image 首图和 images 数组。'
  };
  return descriptions[adapter];
}

function resolveImageToImageAdapterForDisplay(
  config: OpenAICompatibleConfig,
  providerId: string
): Exclude<ImageToImageAdapter, 'auto'> {
  if (config.imageToImageAdapter !== 'auto') return config.imageToImageAdapter;
  if (providerId === 'openai-gpt-image' && config.protocol === 'images') return 'openai-images-edit';
  if (config.protocol === 'responses') return 'responses-input-image';
  if (config.protocol === 'chat-completions') return 'chat-image-url';
  return 'json-image-array';
}

function imageToImageAdapterDiagnosticDetail(config: OpenAICompatibleConfig, providerId: string) {
  const resolved = resolveImageToImageAdapterForDisplay(config, providerId);
  const prefix = config.imageToImageAdapter === 'auto'
    ? `自动：${imageToImageAdapterLabel(resolved)}`
    : `固定：${imageToImageAdapterLabel(resolved)}`;
  const fieldSummary: Record<Exclude<ImageToImageAdapter, 'auto'>, string> = {
    'openai-images-edit': 'multipart 字段 image / image[]，官方 Images 图生图优先。',
    'responses-input-image': 'JSON content[] 使用 input_text + input_image。',
    'chat-image-url': 'JSON messages[] 使用 text + image_url。',
    'json-image-array': 'JSON 使用 image 首图 + images 数组，适合自定义中转。'
  };
  return `${prefix}；${fieldSummary[resolved]}`;
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

function buildModelProbe(modelId: string, modelOptions: string[], source: string) {
  const normalizedModelId = modelId.trim();
  const available = Boolean(normalizedModelId) && modelOptions.includes(normalizedModelId);
  const checkedAt = new Date().toISOString();
  return {
    modelId: normalizedModelId,
    available,
    checkedAt,
    message: available
      ? `当前模型「${normalizedModelId}」已出现在服务商模型列表中。${source}`
      : modelOptions.length
        ? `当前模型「${normalizedModelId || '未填写'}」没有出现在模型列表中；可能是模型 ID 写错，也可能是中转站隐藏了图片模型。${source}`
        : `模型列表为空，已保留当前手动模型「${normalizedModelId || '未填写'}」。${source}`
  };
}

function buildProviderReadinessItems(input: {
  profile: ProviderConnectionProfile | null;
  config: OpenAICompatibleConfig;
  providerId: string;
  desktopRuntime: boolean;
  secretAvailable: boolean;
  serviceConfigurable: boolean;
  supportsOpenAICompatible: boolean;
}): ProviderDiagnosticItem[] {
  if (!input.serviceConfigurable || !input.supportsOpenAICompatible) {
    return [{
      id: 'route',
      label: '接入路线',
      level: 'info',
      detail: '当前服务模板仍是规划展示，不开放保存、启用或真实能力测试。'
    }];
  }

  const modelId = input.config.modelId.trim();
  const hasBaseUrl = Boolean(input.config.baseUrl.trim());
  const hasEndpointPath = input.config.endpointPath.trim().startsWith('/');
  const modelCount = input.profile?.lastModelCount;
  const modelProbe = input.profile?.lastModelProbe;
  const generationVerified = Boolean(input.profile?.lastMessage?.includes('测试生成成功'));
  const resolvedAdapter = resolveImageToImageAdapterForDisplay(input.config, input.providerId);
  const protocolLabelText = protocolLabel(input.config.protocol);

  return [
    {
      id: 'config-profile',
      label: '配置实例',
      level: input.profile ? 'pass' : 'info',
      detail: input.profile
        ? '已保存为配置实例，并使用当前配置实例的独立密钥。'
        : '当前仍是编辑草稿；保存后才会绑定独立密钥。'
    },
    {
      id: 'model-list',
      label: '模型列表',
      level: typeof modelCount === 'number' ? (modelCount > 0 ? 'pass' : 'warn') : 'info',
      detail: typeof modelCount === 'number'
        ? `最近一次读取到 ${modelCount} 个模型，疑似图片模型 ${input.profile?.lastImageModelCount ?? 0} 个。`
        : '尚未刷新 /v1/models；可点击刷新读取，若服务商不开放该接口也可以手动填写模型。'
    },
    {
      id: 'model-probe',
      label: '当前模型',
      level: modelProbe ? (modelProbe.available ? 'pass' : 'warn') : (modelId ? 'info' : 'fail'),
      detail: modelProbe?.message ?? (modelId ? `当前填写模型：${modelId}，尚未探测是否在模型列表中。` : '模型 ID 为空。')
    },
    {
      id: 'text-to-image',
      label: '文生图',
      level: generationVerified
        ? 'pass'
        : hasBaseUrl && modelId && hasEndpointPath && input.secretAvailable && input.desktopRuntime
          ? 'info'
          : 'warn',
      detail: generationVerified
        ? '最近一次真实试生图成功，说明当前配置至少通过了真实文生图链路。'
        : hasBaseUrl && modelId && hasEndpointPath && input.secretAvailable && input.desktopRuntime
          ? `基础配置已具备；需要手动点击“真实试生图”才会消耗额度并验证真实 ${protocolLabelText} 文生图链路。`
          : '需要补齐桌面端、API Key、Base URL、模型 ID 和接口路径后，才能进行真实文生图验证。'
    },
    {
      id: 'image-to-image',
      label: '图生图',
      level: hasEndpointPath && modelId ? 'info' : 'warn',
      detail: hasEndpointPath && modelId
        ? `当前映射为 ${imageToImageAdapterLabel(resolvedAdapter)}；这是协议映射检查，真实图生图仍需后续带参考图测试。`
        : '需要先补齐模型和接口路径，再检查图生图映射。'
    },
    {
      id: 'multi-reference',
      label: '多参考图',
      level: ['openai-images-edit', 'responses-input-image', 'chat-image-url', 'json-image-array'].includes(resolvedAdapter) ? 'info' : 'warn',
      detail: `当前会按 ${imageToImageAdapterLabel(resolvedAdapter)} 组织参考图；多参考是否可用取决于服务商协议实现，后续能力测试会单独验证。`
    }
  ];
}

function buildGenerationUsageReadinessItem(input: {
  profile: ProviderConnectionProfile | null;
  generationProfile: ProviderConnectionProfile | null;
  selectedProviderId: string;
  generationProviderId: string;
}): ProviderDiagnosticItem {
  if (input.selectedProviderId !== input.generationProviderId) {
    return {
      id: 'generation-usage',
      label: 'AI 创作页生效',
      level: 'info',
      detail: 'AI 创作页当前使用的是其他平台；启用当前配置后会同步切换到该平台。'
    };
  }
  if (!input.profile) {
    return {
      id: 'generation-usage',
      label: 'AI 创作页生效',
      level: 'warn',
      detail: '当前仍是编辑草稿，AI 创作页不会读取草稿配置；请先保存并启用。'
    };
  }
  if (input.generationProfile?.id === input.profile.id) {
    return {
      id: 'generation-usage',
      label: 'AI 创作页生效',
      level: 'pass',
      detail: `AI 创作页当前会读取「${input.profile.displayName}」及其独立密钥状态。`
    };
  }
  return {
    id: 'generation-usage',
    label: 'AI 创作页生效',
    level: 'warn',
    detail: input.generationProfile
      ? `AI 创作页当前读取「${input.generationProfile.displayName}」，不是正在编辑的「${input.profile.displayName}」。`
      : 'AI 创作页当前没有可读取的配置实例。'
  };
}

function buildOfflineDiagnosticSummary(input: {
  profile: ProviderConnectionProfile | null;
  config: OpenAICompatibleConfig;
  desktopRuntime: boolean;
  secretAvailable: boolean;
  generationProfile: ProviderConnectionProfile | null;
  selectedProviderId: string;
  generationProviderId: string;
}) {
  const modelId = input.config.modelId.trim();
  const hasBaseUrl = Boolean(input.config.baseUrl.trim());
  const hasEndpointPath = input.config.endpointPath.trim().startsWith('/');
  const modelProbe = input.profile?.lastModelProbe;
  const generationMatches =
    input.selectedProviderId === input.generationProviderId &&
    Boolean(input.profile && input.generationProfile?.id === input.profile.id);
  const missing: string[] = [];
  if (!input.profile) missing.push('未保存实例');
  if (!input.desktopRuntime) missing.push('非桌面端');
  if (!input.secretAvailable) missing.push('密钥未保存');
  if (!hasBaseUrl) missing.push('Base URL 为空');
  if (!modelId) missing.push('模型为空');
  if (!hasEndpointPath) missing.push('路径异常');
  if (!generationMatches) missing.push('创作页未使用');
  const modelState = modelProbe ? (modelProbe.available ? '模型已命中' : '模型未命中') : '模型未探测';
  const title = missing.length === 0
    ? '配置完整，等待真实生成验证'
    : `还有 ${missing.length} 项需要注意`;
  const detail = missing.length === 0
    ? '当前只完成非消耗检查；未执行真实生成，不代表模型一定可生图。'
    : `${missing.slice(0, 3).join(' / ')}${missing.length > 3 ? ' 等' : ''}；未执行真实生成。`;
  return {
    title,
    detail,
    chips: [
      { label: input.profile ? '实例已保存' : '实例草稿', level: input.profile ? 'pass' : 'warn' },
      { label: input.secretAvailable ? '密钥已保存' : '密钥未保存', level: input.secretAvailable ? 'pass' : 'warn' },
      { label: modelState, level: modelProbe?.available ? 'pass' : modelProbe ? 'warn' : 'info' },
      { label: generationMatches ? '创作页使用中' : '创作页未使用', level: generationMatches ? 'pass' : 'info' }
    ] as Array<{ label: string; level: ProviderDiagnosticLevel }>
  };
}

function providerErrorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isModelListUnavailableError(error: unknown) {
  const lower = providerErrorText(error).toLowerCase();
  return [
    'model list',
    '/v1/models',
    'http 403',
    '403 forbidden',
    'cannot parse',
    'body preview',
    '<!doctype html',
    'just a moment',
    'challenges.cloudflare.com',
    'cloudflare',
    'does not contain data array'
  ].some((hint) => lower.includes(hint));
}

function formatModelListFallbackMessage(error: unknown, modelId: string) {
  const mapped = mapProviderErrorMessage(error);
  const modelLabel = modelId.trim() || '当前手动模型 ID';
  return `模型列表无法读取，但这不影响手动模型使用。已保留「${modelLabel}」；如果中转站不开放 /v1/models 或被 Cloudflare 拦截，请直接保存，再用左侧延迟测试或右侧真实试生图验证。原始提示：${mapped}`;
}

function mapProviderErrorMessage(error: unknown) {
  const message = providerErrorText(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('model list') &&
    (lower.includes('<!doctype html') ||
      lower.includes('just a moment') ||
      lower.includes('challenges.cloudflare.com') ||
      lower.includes('cloudflare'))
  ) {
    return '模型列表接口返回了网页验证页，而不是 JSON。通常是中转站的 /v1/models 被 Cloudflare 或权限策略拦截；请手动填写模型 ID 后保存，再用左侧延迟测试或右侧真实试生图验证。';
  }

  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid api key')) {
    return `密钥校验失败：请检查 API Key 是否正确，或中转站是否要求 Bearer Token。原始错误：${message}`;
  }
  if (lower.includes('403') || lower.includes('forbidden')) {
    return `接口无权限：账号、模型或中转站策略可能不允许当前请求。原始错误：${message}`;
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return `接口路径可能不匹配：请检查 Base URL、协议类型和接口路径。原始错误：${message}`;
  }
  if (lower.includes('billing hard limit')) {
    return `OpenAI 账单硬限制：当前官方项目已达到 Billing hard limit。请到 OpenAI 控制台检查付款方式、余额、项目用量上限或组织额度。原始错误：${message}`;
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






