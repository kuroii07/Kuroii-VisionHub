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
  ListChecks,
  Maximize2,
  Monitor,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
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
import type { BatchGenerationQueue } from '../domain/batchQueueTypes';
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
  revealBackupsDir,
  saveGenerationRecord,
  saveLibraryData,
  saveProviderSecret,
  saveTextFileWithDialog,
  saveStorageSettings,
  type LibraryDataPayload,
  type ComfyUIDiagnosisResult,
  type SdWebUIDiagnosisResult,
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
  IMAGE_PROMPT_REVERSE_DETAIL_OPTIONS,
  IMAGE_PROMPT_REVERSE_LANGUAGE_OPTIONS,
  IMAGE_PROMPT_REVERSE_PROTOCOL_OPTIONS,
  IMAGE_PROMPT_REVERSE_SECRET_ID,
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
  type ImagePromptReverseSettings,
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
import { ModernGeneratePage } from './GeneratePage';
import { InspirationPage } from './InspirationPage';
import { StudioSelect } from './StudioSelect';
import type { ConfirmDialogRequest } from './confirmDialog';
import { appToastEventName, defaultToastDurationMs, useToastMessage, type ToastEventDetail, type ToastLevel } from './toast';

const APP_VERSION = '0.4.6';
const ACTIVE_BATCH_QUEUE_STORAGE_KEY = 'visionhub.batch.activeQueueId.v1';

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
type LibrarySortMode = 'newest' | 'oldest' | 'favorites' | 'provider' | 'model' | 'duration' | 'size' | 'filename' | 'recent-viewed' | 'recent-reference';
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
  | { type: 'recent-viewed' }
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
type LocalSdWebUIConfig = {
  baseUrl: string;
};
type LocalSdWebUIDiagnosticState = {
  status: LocalModelDiagnosticStatus;
  result: SdWebUIDiagnosisResult | null;
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
const LOCAL_SD_WEBUI_CONFIG_STORAGE_KEY = 'visionhub.local.sdwebui.config.v1';
const DEFAULT_COMFYUI_BASE_URL = 'http://127.0.0.1:8188';
const DEFAULT_SD_WEBUI_BASE_URL = 'http://127.0.0.1:7860';
const LOCAL_COMFYUI_DIAGNOSTIC_TIMEOUT_MS = 12_000;
const LOCAL_SD_WEBUI_DIAGNOSTIC_TIMEOUT_MS = 12_000;

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
    supportsImageToImage: true,
    notes: ['使用 MiniMax 官方 Bearer API Key，独立于中转站 Key。', '当前接入 image-01 / image-01-live 文生图和单张人物主体参考图；多参考图后续补。']
  },
  {
    id: 'official-mimo',
    platformType: 'official',
    label: '小米 MiMo 官方',
    description: '国内主流候选；官方 API 当前面向文本、图像理解和全模态推理，暂未开放生图 endpoint。',
    status: 'planned',
    region: 'domestic',
    sortRank: 30,
    apiDocUrl: 'https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/multimodal-understanding/image-understanding',
    supportsTextToImage: false,
    supportsImageToImage: false,
    notes: ['官方文档显示图片能力是图像理解：支持 URL / Base64 图片输入，用于描述、分类和视觉问答。', '未发现公开文生图 / 图生图 endpoint；继续只展示候选说明，不开放真实生图。']
  },
  {
    id: 'official-gemini',
    platformType: 'official',
    label: 'Google Gemini / Nano Banana 官方',
    description: '海外官方 API V4 第一批；支持 Gemini 图片生成 / 编辑，返回 inline image 后落盘。',
    status: 'configurable',
    region: 'overseas',
    sortRank: 40,
    providerId: 'gemini-image',
    defaultDisplayName: 'Google Gemini 官方',
    apiDocUrl: 'https://ai.google.dev/gemini-api/docs/image-generation',
    supportsTextToImage: true,
    supportsImageToImage: true,
    notes: ['使用 Google Gemini API Key，独立于中转站 Key。', '当前接入 gemini-2.5-flash-image，支持文生图和参考图编辑；多图数量后续补。']
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
    description: '本地 ComfyUI 已支持连接诊断、API workflow 导入、文生图和带 LoadImage 节点的图生图测试。',
    status: 'configurable',
    region: 'local',
    sortRank: 10,
    providerId: 'comfyui-local',
    supportsTextToImage: true,
    supportsImageToImage: true,
    requiresPolling: true,
    notes: ['支持 ComfyUI API workflow；普通 UI workflow 需要从 ComfyUI 重新导出 API 格式。', '当前会自动写入 Prompt、负面提示词、尺寸、Seed；图生图会上传第一张参考图并写入 LoadImage 节点。']
  },
  {
    id: 'local-sd-webui',
    platformType: 'local',
    label: 'Stable Diffusion WebUI / Forge',
    description: '0.4.3 已支持本地连接诊断、txt2img 文生图和作品画廊保存；WebUI / Forge 启动时需要带 --api。',
    status: 'configurable',
    region: 'local',
    sortRank: 20,
    providerId: 'sd-webui-local',
    supportsTextToImage: true,
    supportsImageToImage: false,
    notes: ['A1111 Stable Diffusion WebUI 或 Forge 需要以 --api 启动。', '当前切片支持 txt2img、Seed、负面提示词、采样器、步数、CFG 和作品画廊保存；img2img / ControlNet 后续再接入。']
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
  { value: 'filename', label: '文件名' },
  { value: 'recent-viewed', label: '最近查看' },
  { value: 'recent-reference', label: '最近设为参考' }
];

const libraryQuickFilters: Array<{ value: LibraryQuickFilter; label: string }> = [
  { value: 'favorites', label: '收藏' },
  { value: 'recent7d', label: '最近 7 天' },
  { value: 'references', label: '有参考图' },
  { value: 'failed', label: '失败记录' },
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

type LibraryRecoveryAdviceKey =
  | 'backgroundPoll'
  | 'backgroundManual'
  | 'localPathMissingPreview'
  | 'remoteOnly'
  | 'noImage'
  | 'responseFormat'
  | 'failedGeneric';

type LibraryRecoveryAdvice = {
  key: LibraryRecoveryAdviceKey;
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
    return { key: hasPollUrl ? 'backgroundPoll' : 'backgroundManual' };
  }

  if (record.status === 'succeeded' && hasLocalPath && !hasPreview) {
    return { key: 'localPathMissingPreview' };
  }

  if (record.status === 'succeeded' && !hasLocalPath && hasPreview) {
    return { key: 'remoteOnly' };
  }

  if (record.status === 'failed' && diagnosis.category === 'no-image') {
    return { key: 'noImage' };
  }

  if (record.status === 'failed' && diagnosis.category === 'response-format') {
    return { key: 'responseFormat' };
  }

  if (record.status === 'failed') {
    return { key: 'failedGeneric' };
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
    if (sortMode === 'recent-viewed') {
      return getRecordTimeMs(meta[b.id]?.lastViewedAt ?? '') - getRecordTimeMs(meta[a.id]?.lastViewedAt ?? '') || getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
    }
    if (sortMode === 'recent-reference') {
      return getRecordTimeMs(meta[b.id]?.lastUsedAsReferenceAt ?? '') - getRecordTimeMs(meta[a.id]?.lastUsedAsReferenceAt ?? '') || getRecordTimeMs(b.createdAt) - getRecordTimeMs(a.createdAt);
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
const BATCH_QUEUE_TEMPLATE_STORAGE_KEY = 'visionhub.batch.queueTemplates.v1';
const MAX_BATCH_QUEUE_TEMPLATES = 40;

type UtilityModal = 'system-info' | 'shortcuts' | null;
type GenerateShortcutName = 'submit' | 'focus-prompt' | 'add-reference' | 'clear-references' | 'mode-image' | 'mode-text';
type ConfirmDialogState = ConfirmDialogRequest & { error?: string };
type BatchQueueNameDialogState = {
  mode: 'create' | 'rename';
  defaultName: string;
  targetId?: string;
};
type BatchQueueRunProgress = {
  queueId: string;
  initialPendingCount: number;
  completedThisRun: number;
  failedThisRun: number;
  currentTaskId?: string;
  currentTaskTitle?: string;
  startedAt: string;
  pauseRequested?: boolean;
};
type BatchQueueTaskTemplate = {
  kind: BatchGenerationQueue['tasks'][number]['kind'];
  compareGroupId?: string;
  title: string;
  snapshot: BatchGenerationQueue['tasks'][number]['snapshot'];
};
type BatchQueueCompareGroupTemplate = {
  id: string;
  prompt: string;
  profileIds: string[];
  taskIndexes: number[];
};
type BatchQueueTemplate = {
  id: string;
  name: string;
  description?: string;
  taskTemplates: BatchQueueTaskTemplate[];
  compareGroups: BatchQueueCompareGroupTemplate[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  usedCount?: number;
};
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

const libraryFocusSearchEvent = 'visionhub:library-focus-search';

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

function createBatchQueueTemplateFromQueue(queue: BatchGenerationQueue, name?: string): BatchQueueTemplate {
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
    name: name?.trim() || `${queue.name} 模板`,
    description: `${taskTemplates.length} 个任务 · ${compareGroups.length} 个对比组`,
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
          title: task.title?.trim() || task.snapshot.prompt.slice(0, 40) || '未命名任务',
          snapshot: task.snapshot
        };
      })
      .filter((task): task is BatchQueueTaskTemplate => Boolean(task))
    : [];
  return {
    id: value.id || createLocalId('batch-template'),
    name: value.name?.trim() || '未命名批量模板',
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

type ShortcutGroupDefinition = {
  titleKey: Parameters<Translator>[0];
  items: Array<{ keys: string[]; actionKey: Parameters<Translator>[0] }>;
};

const shortcutGroups: ShortcutGroupDefinition[] = [
  {
    titleKey: 'shortcut.group.global',
    items: [
      { keys: ['Ctrl', '/'], actionKey: 'shortcut.action.openShortcuts' },
      { keys: ['Ctrl', 'B'], actionKey: 'shortcut.action.toggleSidebar' },
      { keys: ['Ctrl', ','], actionKey: 'shortcut.action.openProviders' },
      { keys: ['Ctrl', '0'], actionKey: 'shortcut.action.openHome' },
      { keys: ['Ctrl', '1'], actionKey: 'shortcut.action.openGenerate' },
      { keys: ['Ctrl', '2'], actionKey: 'shortcut.action.openFree' },
      { keys: ['Ctrl', '3'], actionKey: 'shortcut.action.openLibrary' },
      { keys: ['Ctrl', '4'], actionKey: 'shortcut.action.openInspiration' },
      { keys: ['Ctrl', '5'], actionKey: 'shortcut.action.openTemplates' },
      { keys: ['Ctrl', '6'], actionKey: 'shortcut.action.openProviders' },
      { keys: ['Ctrl', '7'], actionKey: 'shortcut.action.openSettings' },
      { keys: ['Ctrl', '8'], actionKey: 'shortcut.action.openBatch' },
      { keys: ['Esc'], actionKey: 'shortcut.action.closeOverlay' }
    ]
  },
  {
    titleKey: 'shortcut.group.generate',
    items: [
      { keys: ['Ctrl', 'Enter'], actionKey: 'shortcut.action.submitGenerate' },
      { keys: ['Ctrl', 'K'], actionKey: 'shortcut.action.focusPrompt' },
      { keys: ['Ctrl', 'Shift', 'R'], actionKey: 'shortcut.action.addReference' },
      { keys: ['Ctrl', 'Shift', 'C'], actionKey: 'shortcut.action.clearReferences' },
      { keys: ['Ctrl', 'Shift', 'I'], actionKey: 'shortcut.action.modeImage' },
      { keys: ['Ctrl', 'Shift', 'T'], actionKey: 'shortcut.action.modeText' }
    ]
  },
  {
    titleKey: 'shortcut.group.libraryData',
    items: [
      { keys: ['Ctrl', 'F'], actionKey: 'shortcut.action.focusLibrarySearch' },
      { keys: ['Ctrl', 'O'], actionKey: 'shortcut.action.openLibraryDir' },
      { keys: ['Ctrl', 'E'], actionKey: 'shortcut.action.exportSettingsBackup' }
    ]
  },
  {
    titleKey: 'shortcut.group.preview',
    items: [
      { keys: ['+'], actionKey: 'shortcut.action.zoomInPreview' },
      { keys: ['-'], actionKey: 'shortcut.action.zoomOutPreview' },
      { keys: ['0'], actionKey: 'shortcut.action.resetPreview' },
      { keys: ['Space'], actionKey: 'shortcut.action.resetPreview' },
      { keys: ['Esc'], actionKey: 'shortcut.action.closePreview' }
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
    setConfigMessage(`AI 创作已切换到配置实例：${profile.displayName}`);
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
        error: 'Stable Diffusion WebUI / Forge 本地诊断需要在 Tauri 桌面版中运行。'
      });
      return;
    }
    const requestId = localSdWebUIDiagnosticRequestRef.current + 1;
    localSdWebUIDiagnosticRequestRef.current = requestId;
    setLocalSdWebUIDiagnostic((current) => ({ ...current, status: 'checking', error: '' }));
    if (!silent) setConfigMessage('正在测试 Stable Diffusion WebUI / Forge 本地连接...');
    try {
      const result = await Promise.race([
        diagnoseSdWebUIConnection({
          baseUrl: localSdWebUIConfig.baseUrl,
          timeoutMs: LOCAL_SD_WEBUI_DIAGNOSTIC_TIMEOUT_MS
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => {
            reject(new Error('SD WebUI / Forge 诊断 12 秒内未响应，请检查本地服务地址、端口以及是否带 --api 启动。'));
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
          throw new Error('Stable Diffusion WebUI / Forge 本地生成需要在 Tauri 桌面版中运行。');
        }
        if ((options?.mode ?? 'text-to-image') === 'image-to-image') {
          throw new Error('0.4.3 的 SD WebUI / Forge 切片暂只支持 txt2img；img2img 和 ControlNet 后续版本再接入。');
        }
        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt) {
          throw new Error('请先填写 Prompt，再运行 SD WebUI / Forge 本地生成。');
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
          setConfigMessage(savedRecords.length > 1 ? `SD WebUI / Forge 已生成 ${savedRecords.length} 张图片，并保存到作品画廊。` : 'SD WebUI / Forge 已生成成功，并保存到作品画廊。');
        } else {
          setConfigMessage(`SD WebUI / Forge 生成失败：${firstSaved?.error ?? '没有返回图片'}。失败记录已保存到作品画廊。`);
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
          costHint: '本地 Stable Diffusion WebUI / Forge 生成，不消耗在线 API 额度。',
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
        setConfigMessage(`SD WebUI / Forge 生成失败：${message}。失败记录已保存到作品画廊。`);
      } finally {
        useStudioStore.setState({ isGenerating: false });
      }
      return;
    }

    if (selectedProviderId !== 'comfyui-local') {
      await generate(options);
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
        throw new Error('ComfyUI 本地生成需要 Tauri 桌面端运行时。');
      }
      if (generationMode === 'image-to-image' && references.length === 0) {
        throw new Error('ComfyUI 图生图需要先添加至少一张参考图。');
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
          workflow: activeWorkflowPreset?.summary.fileName ?? null,
          referenceCount: references.length
        },
        createdAt: new Date().toISOString(),
        generationMode,
        referenceImages: references
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

  function refreshBatchQueueStore() {
    const store = loadBatchQueueStore();
    setBatchQueueStore(store);
    if (activeBatchQueueId && !store.queues.some((queue) => queue.id === activeBatchQueueId)) {
      selectActiveBatchQueue(store.queues[0]?.id ?? '');
    }
    setConfigMessage('已刷新批量队列本地状态。');
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
        name: '默认批量队列',
        description: '从 AI 创作台加入的生成任务会先进入这里，执行前仍需二次确认。',
        status: 'ready'
      }),
      exists: false
    };
  }

  function requestCreateBatchQueue() {
    setBatchQueueNameDialog({
      mode: 'create',
      defaultName: '新的批量队列'
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
        setConfigMessage('队列不存在，请刷新后重试。');
        return;
      }
      if (nextName === queue.name) {
        setBatchQueueNameDialog(null);
        setConfigMessage('队列名称未变化。');
        return;
      }
      const nextStore = upsertBatchQueue({ ...queue, name: nextName }, store);
      setBatchQueueStore(nextStore);
      selectActiveBatchQueue(queue.id);
      setBatchQueueNameDialog(null);
      setConfigMessage(`已重命名队列：${nextName}`);
      return;
    }

    const queue = createBatchQueue({
      name: nextName,
      description: '自定义队列：可用于不同项目、模型或比例测试。',
      status: 'ready'
    });
    const nextStore = upsertBatchQueue(queue, store);
    setBatchQueueStore(nextStore);
    selectActiveBatchQueue(queue.id);
    setBatchQueueNameDialog(null);
    setConfigMessage(`已新建队列：${queue.name}`);
  }

  function requestRenameBatchQueue(queueId: string) {
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    if (!queue) {
      setBatchQueueStore(store);
      setConfigMessage('队列不存在，请刷新后重试。');
      return;
    }
    const summary = summarizeBatchQueue(queue);
    if (runningBatchQueueId === queue.id || summary.running > 0) {
      setConfigMessage('这个队列正在执行，暂时不能重命名。请先停止并等待当前任务完成。');
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
      setConfigMessage('队列不存在，请刷新后重试。');
      return;
    }
    if (store.queues.length <= 1) {
      setConfigMessage('至少保留 1 个队列；如需清理，可删除失败或已取消的单个任务。');
      return;
    }
    const summary = summarizeBatchQueue(queue);
    if (runningBatchQueueId === queue.id || summary.running > 0) {
      setConfigMessage('这个队列正在执行，不能删除。请先停止并等待当前任务完成。');
      return;
    }
    requestConfirm({
      title: '删除这个队列？',
      message: [
        `将从本地批量队列中删除“${queue.name}”。`,
        `包含 ${summary.total} 个任务快照：${summary.pending} 个待执行、${summary.succeeded} 个成功、${summary.failed} 个失败、${summary.cancelled} 个已取消。`,
        `包含 ${queue.compareGroups?.length ?? 0} 个对比组。`,
        '这不会删除作品画廊记录，也不会删除磁盘图片文件。'
      ].join('\n'),
      confirmLabel: '删除队列',
      cancelLabel: '取消',
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
        setConfigMessage(`已删除队列：${queue.name}`);
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
      setConfigMessage('队列不存在，请刷新后重试。');
      return;
    }
    const summary = summarizeBatchQueue(queue);
    if (runningBatchQueueId === queue.id || summary.running > 0) {
      setConfigMessage('这个队列正在执行，暂时不能保存为模板。');
      return;
    }
    if (summary.total === 0) {
      setConfigMessage('空队列不能保存为模板。');
      return;
    }
    const template = createBatchQueueTemplateFromQueue(queue);
    const nextTemplates = [
      template,
      ...batchQueueTemplates.filter((item) => item.id !== template.id)
    ].slice(0, MAX_BATCH_QUEUE_TEMPLATES);
    saveBatchQueueTemplates(nextTemplates);
    setBatchQueueTemplates(nextTemplates);
    setConfigMessage(`已保存批量模板：${template.name}，包含 ${template.taskTemplates.length} 个任务。`);
  }

  function requestApplyBatchQueueTemplate(templateId: string) {
    const template = batchQueueTemplates.find((item) => item.id === templateId);
    if (!template) {
      setConfigMessage('批量模板不存在，请刷新后重试。');
      return;
    }
    const { queue, exists } = resolveTargetBatchQueue(loadBatchQueueStore());
    const { tasks, compareGroups } = createTasksFromBatchQueueTemplate(template, queue.id);
    if (!tasks.length) {
      setConfigMessage('这个批量模板没有可追加的任务。');
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
    setConfigMessage(`已套用批量模板「${template.name}」：追加 ${tasks.length} 个待执行任务。`);
    navigateTo('batch');
  }

  function requestDeleteBatchQueueTemplate(templateId: string) {
    const template = batchQueueTemplates.find((item) => item.id === templateId);
    if (!template) {
      setConfigMessage('批量模板不存在，请刷新后重试。');
      return;
    }
    requestConfirm({
      title: '删除这个批量模板？',
      message: [
        `将删除模板“${template.name}”。`,
        '这只删除模板，不会删除队列任务、作品画廊记录或磁盘图片。'
      ].join('\n'),
      confirmLabel: '删除模板',
      cancelLabel: '保留模板',
      tone: 'danger',
      onConfirm: () => {
        const nextTemplates = batchQueueTemplates.filter((item) => item.id !== template.id);
        saveBatchQueueTemplates(nextTemplates);
        setBatchQueueTemplates(nextTemplates);
        setConfigMessage(`已删除批量模板：${template.name}`);
      }
    });
  }

  function handleAddCurrentGenerationToBatchQueue(options: GenerateSubmissionOptions = {}) {
    const trimmedPrompt = prompt.trim();
    const generationMode = options.mode ?? 'text-to-image';
    const references = options.references ?? [];
    if (!trimmedPrompt) {
      setConfigMessage('请先输入 Prompt，再加入批量队列。');
      return;
    }
    if (generationMode === 'image-to-image' && references.length === 0) {
      setConfigMessage('图生图任务需要先添加至少一张参考图，再加入批量队列。');
      return;
    }

    const providerModelId = generationSupportsOpenAICompatible
      ? activeGenerationConfig.modelId.trim()
      : selectedModelId.trim();
    if (!providerModelId) {
      setConfigMessage('当前模型 ID 为空，请先在平台接入或创作台选择模型。');
      return;
    }

    let extraHeaders: Record<string, string> | undefined;
    if (generationSupportsOpenAICompatible) {
      try {
        extraHeaders = parseExtraHeaders(activeGenerationConfig.extraHeadersJson);
      } catch (error) {
        setConfigMessage(`额外 Headers JSON 无法解析，未加入队列：${error instanceof Error ? error.message : String(error)}`);
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
      title: `${generationMode === 'image-to-image' ? '图生图' : '文生图'} · ${providerModelId}`
    });
    const nextStore = existingQueue
      ? appendBatchQueueTasks(queue.id, [task], batchQueueStore)
      : upsertBatchQueue({ ...queue, tasks: [task], status: 'ready' }, batchQueueStore);
    setBatchQueueStore(nextStore);
    selectActiveBatchQueue(queue.id);
    const omittedReferenceCount = snapshot.referencePolicy?.omittedReferenceIds.length ?? 0;
    setConfigMessage([
      `已加入队列「${queue.name}」：${generationSelectedProvider.name} / ${providerModelId}，${requestedCount} 张。`,
      omittedReferenceCount > 0 ? `有 ${omittedReferenceCount} 张参考图未持久化大体积数据，执行前需要重新确认参考图。` : ''
    ].filter(Boolean).join(' '));
    navigateTo('batch');
  }

  function handleAddBatchVariantsToBatchQueue(prompts: string[], sizes: string[], options: GenerateSubmissionOptions = {}) {
    const normalizedPrompts = Array.from(new Set(prompts.map((item) => item.trim()).filter(Boolean))).slice(0, 20);
    const normalizedSizes = Array.from(new Set(sizes.map((item) => item.trim()).filter(Boolean))).slice(0, 8);
    const generationMode = options.mode ?? 'text-to-image';
    const references = options.references ?? [];
    if (normalizedPrompts.length === 0) {
      setConfigMessage('请至少输入 1 条 Prompt，再创建批量变体队列。');
      return;
    }
    if (normalizedSizes.length === 0) {
      setConfigMessage('请至少选择 1 个尺寸，再创建批量变体队列。');
      return;
    }
    if (generationMode === 'image-to-image' && references.length === 0) {
      setConfigMessage('图生图批量变体需要先添加至少一张参考图。');
      return;
    }

    const providerModelId = generationSupportsOpenAICompatible
      ? activeGenerationConfig.modelId.trim()
      : selectedModelId.trim();
    if (!providerModelId) {
      setConfigMessage('当前模型 ID 为空，请先在平台接入或创作台选择模型。');
      return;
    }

    const estimatedTasks = normalizedPrompts.length * normalizedSizes.length;
    if (estimatedTasks > 40) {
      setConfigMessage(`本次批量变体会创建 ${estimatedTasks} 个任务，超过单次上限 40 个；请减少 Prompt 或画面比例数量。`);
      return;
    }

    let extraHeaders: Record<string, string> | undefined;
    if (generationSupportsOpenAICompatible) {
      try {
        extraHeaders = parseExtraHeaders(activeGenerationConfig.extraHeadersJson);
      } catch (error) {
        setConfigMessage(`额外 Headers JSON 无法解析，未加入批量变体：${error instanceof Error ? error.message : String(error)}`);
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
          title: `批量变体 · ${variantSize} · ${providerModelId}`
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
      `已加入队列「${queue.name}」：批量变体 ${normalizedPrompts.length} 条 Prompt × ${normalizedSizes.length} 个比例 = ${tasks.length} 个任务，单任务 ${requestedCount} 张。`,
      omittedReferenceCount > 0 ? `有 ${omittedReferenceCount} 个任务的参考图未持久化大体积数据，执行前需要重新确认参考图。` : ''
    ].filter(Boolean).join(' '));
    navigateTo('batch');
  }

  function handleAddCompareGroupToBatchQueue(profileIds: string[], options: GenerateSubmissionOptions = {}) {
    const trimmedPrompt = prompt.trim();
    const generationMode = options.mode ?? 'text-to-image';
    const references = options.references ?? [];
    if (!trimmedPrompt) {
      setConfigMessage('请先输入 Prompt，再创建多模型对比队列。');
      return;
    }
    if (!generationSupportsOpenAICompatible) {
      setConfigMessage('多模型对比 V1 当前先支持中转站 / 聚合 API 和官方 OpenAI-compatible 配置实例。');
      return;
    }
    if (generationMode === 'image-to-image' && references.length === 0) {
      setConfigMessage('图生图对比任务需要先添加至少一张参考图。');
      return;
    }

    const uniqueProfileIds = Array.from(new Set(profileIds)).filter(Boolean);
    const selectedProfiles = uniqueProfileIds
      .map((profileId) => providerProfiles.find((item) => item.id === profileId))
      .filter((profile): profile is ProviderConnectionProfile => Boolean(profile))
      .filter((profile) => profile.providerId === selectedProviderId);
    if (selectedProfiles.length < 2) {
      setConfigMessage('请至少选择 2 个当前平台下的配置实例，再加入多模型对比队列。');
      return;
    }

    const missingModelProfile = selectedProfiles.find((profile) => !profile.modelId.trim());
    if (missingModelProfile) {
      setConfigMessage(`配置实例 ${missingModelProfile.displayName} 的模型 ID 为空，请先补全模型后再对比。`);
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
        setConfigMessage(`配置实例 ${profile.displayName} 的额外 Headers JSON 无法解析，未加入对比队列：${error instanceof Error ? error.message : String(error)}`);
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
        title: `对比 · ${profile.displayName || profileConfig.modelId} · ${profileConfig.modelId}`
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
      `已加入队列「${queue.name}」：多模型对比组 ${selectedProfiles.length} 个配置实例，${tasks.length} 个任务，单任务 ${requestedCount} 张。`,
      omittedReferenceCount > 0 ? `有 ${omittedReferenceCount} 个任务的参考图未持久化大体积数据，执行前需要重新确认参考图。` : ''
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
      if (!options.suppressMessage) setConfigMessage('队列任务不存在，请刷新批量队列后重试。');
      setBatchQueueStore(store);
      return 'skipped';
    }
    if (task.status === 'running') {
      if (!options.suppressMessage) setConfigMessage('这个任务正在执行中，请等待完成。');
      return 'skipped';
    }
    if (task.status === 'cancelled') {
      if (!options.suppressMessage) setConfigMessage('这个任务已取消，如需执行请后续使用重新入队功能。');
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
          ? `队列任务执行成功：已保存 ${execution.records.length} 条作品记录。`
          : `队列任务执行失败：${execution.task.error ?? '没有返回有效图片'}，失败记录已写入作品画廊。`);
      }
      return execution.task.status === 'succeeded' ? 'succeeded' : 'failed';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBatchTaskState(queueId, taskId, { status: 'failed', error: message });
      if (!options.suppressMessage) setConfigMessage(`队列任务执行失败：${message}`);
      return 'failed';
    } finally {
      setExecutingBatchTaskId(null);
    }
  }

  async function executeBatchQueueSequentially(queueId: string) {
    if (runningBatchQueueId || executingBatchTaskId) {
      setConfigMessage('已有队列任务正在执行，请等待当前任务完成。');
      return;
    }
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    if (!queue) {
      setBatchQueueStore(store);
      setConfigMessage('队列不存在，请刷新后重试。');
      return;
    }
    const initialPendingCount = queue.tasks.filter((task) => task.status === 'pending').length;
    if (initialPendingCount === 0) {
      setConfigMessage('当前队列没有待执行任务。');
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
    setConfigMessage(`已开始连续执行队列：共 ${initialPendingCount} 个待执行任务。`);

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
          ? `已停止连续执行：本轮成功 ${completedThisRun} 个，失败 ${failedThisRun} 个，剩余 ${summary.pending} 个待执行。`
          : `连续执行完成：本轮成功 ${completedThisRun} 个，失败 ${failedThisRun} 个。`);
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
      setConfigMessage('队列不存在，请刷新后重试。');
      return;
    }
    const pendingTasks = queue.tasks.filter((task) => task.status === 'pending');
    const pendingImages = pendingTasks.reduce((sum, task) => sum + Math.max(1, Math.min(4, Math.round(task.snapshot.count))), 0);
    if (pendingTasks.length === 0) {
      setConfigMessage('当前队列没有待执行任务。');
      return;
    }
    requestConfirm({
      title: '开始连续执行队列？',
      message: [
        `将按顺序执行 ${pendingTasks.length} 个待执行任务，预计请求 ${pendingImages} 张图片。`,
        '执行过程中会真实调用接口，可能消耗中转站或官方 API 额度。',
        '点击“停止执行”只会在当前任务完成后停止，不会强行中断已发出的请求。'
      ].join('\n'),
      confirmLabel: '开始执行',
      cancelLabel: '先不执行',
      onConfirm: () => {
        setConfigMessage('已开始连续执行队列，可继续操作其他页面；当前任务完成后会自动执行下一个待执行任务。');
        void executeBatchQueueSequentially(queueId);
      }
    });
  }

  function requestStopBatchQueue(queueId: string) {
    if (runningBatchQueueId !== queueId) {
      setConfigMessage('当前没有正在连续执行的这个队列。');
      return;
    }
    batchQueueStopRequestedRef.current = true;
    updateBatchQueueRunProgress(queueId, { pauseRequested: true });
    setConfigMessage('已请求暂停连续执行：当前任务完成后会暂停，不会再开始下一个任务。');
  }

  function requestDeleteBatchQueueTask(queueId: string, taskId: string) {
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    const task = queue?.tasks.find((item) => item.id === taskId);
    if (!queue || !task) {
      setBatchQueueStore(store);
      setConfigMessage('队列任务不存在，请刷新后重试。');
      return;
    }
    if (task.status !== 'failed' && task.status !== 'cancelled') {
      setConfigMessage('只有失败或已取消的队列任务可以删除。');
      return;
    }
    requestConfirm({
      title: '删除这个队列任务？',
      message: [
        `将从本地批量队列中删除“${task.title}”。`,
        '这只删除队列任务快照，不会删除作品画廊记录，也不会删除磁盘图片文件。'
      ].join('\n'),
      confirmLabel: '删除任务',
      cancelLabel: '保留任务',
      tone: 'danger',
      onConfirm: () => {
        const nextStore = removeBatchQueueTask(queueId, taskId, loadBatchQueueStore());
        setBatchQueueStore(nextStore);
        setConfigMessage('已删除队列任务；作品画廊记录和磁盘图片未受影响。');
      }
    });
  }

  function requestExecuteBatchQueueTask(queueId: string, taskId: string) {
    const queue = batchQueueStore.queues.find((item) => item.id === queueId);
    const task = queue?.tasks.find((item) => item.id === taskId);
    if (!queue || !task) {
      setConfigMessage('队列任务不存在，请刷新批量队列后重试。');
      return;
    }
    const omittedReferenceCount = task.snapshot.referencePolicy?.omittedReferenceIds.length ?? 0;
    requestConfirm({
      title: '执行这个队列任务？',
      message: [
        `将使用 ${task.snapshot.providerName ?? task.snapshot.providerId} / ${task.snapshot.profileName ?? '当前快照配置'} / ${task.snapshot.modelId} 生成 ${task.snapshot.count} 张图片。`,
        `模式：${task.snapshot.generationMode === 'image-to-image' ? '图生图' : '文生图'}，尺寸：${task.snapshot.size}。`,
        omittedReferenceCount > 0 ? `注意：有 ${omittedReferenceCount} 张参考图未完整持久化，可能会执行失败；建议重新加入带参考图的任务。` : '确认后会真实调用接口，可能消耗中转站或官方 API 额度。'
      ].join('\n'),
      confirmLabel: '确认执行',
      cancelLabel: '先不执行',
      onConfirm: () => {
        setConfigMessage('已开始执行队列任务，可继续操作其他页面；任务状态会在批量队列中更新。');
        void executeBatchQueueTaskNow(queueId, taskId);
      }
    });
  }

  function requestCancelBatchQueueTask(queueId: string, taskId: string) {
    const queue = batchQueueStore.queues.find((item) => item.id === queueId);
    const task = queue?.tasks.find((item) => item.id === taskId);
    if (!queue || !task) return;
    requestConfirm({
      title: '取消这个队列任务？',
      message: '取消只会把这个本地队列任务标记为已取消，不会删除作品画廊记录，也不会删除任何磁盘图片。',
      confirmLabel: '标记取消',
      cancelLabel: '保留任务',
      tone: 'danger',
      onConfirm: () => {
        setBatchTaskState(queueId, taskId, {
          status: 'cancelled',
          error: task.error,
          finishedAt: new Date().toISOString()
        });
        setConfigMessage('已将队列任务标记为取消。');
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
      title: `重试 · ${task.title}`,
      status: 'pending'
    });
  }

  function requestRequeueBatchQueueTask(queueId: string, taskId: string) {
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    const task = queue?.tasks.find((item) => item.id === taskId);
    if (!queue || !task) {
      setConfigMessage('队列任务不存在，请刷新批量队列后重试。');
      setBatchQueueStore(store);
      return;
    }
    if (task.status !== 'failed') {
      setConfigMessage('只有失败任务可以重新入队；待执行任务请直接执行。');
      return;
    }
    requestConfirm({
      title: '重新入队这个失败任务？',
      message: [
        '将复制原任务的 Prompt、模型、配置实例、尺寸和参考图快照，创建一个新的待执行任务。',
        '原失败任务和作品画廊里的失败记录都会保留，不会被覆盖。',
        task.error ? `上次错误：${task.error}` : ''
      ].filter(Boolean).join('\n'),
      confirmLabel: '重新入队',
      cancelLabel: '先不重试',
      onConfirm: () => {
        const retryTask = createRetryBatchQueueTask(queue.id, task);
        const nextStore = appendBatchQueueTasks(queue.id, [retryTask], loadBatchQueueStore());
        setBatchQueueStore(nextStore);
        setConfigMessage('已创建新的重试任务，原失败任务已保留。');
      }
    });
  }

  function requestRequeueFailedBatchQueueTasks(queueId: string) {
    const store = loadBatchQueueStore();
    const queue = store.queues.find((item) => item.id === queueId);
    if (!queue) {
      setBatchQueueStore(store);
      setConfigMessage('队列不存在，请刷新后重试。');
      return;
    }
    const summary = summarizeBatchQueue(queue);
    if (runningBatchQueueId === queue.id || summary.running > 0 || executingBatchTaskId) {
      setConfigMessage('当前还有队列任务正在执行，不能批量重新入队。');
      return;
    }
    const failedTasks = queue.tasks.filter((task) => task.status === 'failed');
    if (!failedTasks.length) {
      setConfigMessage('当前队列没有失败任务需要重新入队。');
      return;
    }
    requestConfirm({
      title: '批量重新入队失败任务？',
      message: [
        `将复制队列“${queue.name}”里的 ${failedTasks.length} 个失败任务，创建同等数量的新待执行任务。`,
        '原失败任务和作品画廊里的失败记录都会保留，不会被覆盖。',
        '新任务会排在当前队列末尾，仍需手动点击“执行全部待处理”。'
      ].join('\n'),
      confirmLabel: '批量重新入队',
      cancelLabel: '先不重试',
      onConfirm: () => {
        const latestStore = loadBatchQueueStore();
        const latestQueue = latestStore.queues.find((item) => item.id === queue.id);
        if (!latestQueue) {
          setBatchQueueStore(latestStore);
          setConfigMessage('队列不存在，请刷新后重试。');
          return;
        }
        const latestFailedTasks = latestQueue.tasks.filter((task) => task.status === 'failed');
        if (!latestFailedTasks.length) {
          setBatchQueueStore(latestStore);
          setConfigMessage('当前队列没有失败任务需要重新入队。');
          return;
        }
        const retryTasks = latestFailedTasks.map((task) => createRetryBatchQueueTask(latestQueue.id, task));
        const nextStore = appendBatchQueueTasks(latestQueue.id, retryTasks, latestStore);
        setBatchQueueStore(nextStore);
        selectActiveBatchQueue(latestQueue.id);
        setConfigMessage(`已批量重新入队 ${retryTasks.length} 个失败任务，原失败任务已保留。`);
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

  async function openBackupsDirectory() {
    if (!desktopRuntime) {
      setSettingsMessage('请在 Tauri 桌面端打开备份目录。');
      return;
    }
    try {
      await revealBackupsDir();
      setSettingsMessage('已打开备份目录。');
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

  async function exportMigrationGuide() {
    if (!desktopRuntime) {
      setSettingsMessage('请在 Tauri 桌面端导出迁移说明。');
      return;
    }
    try {
      const [paths, latestStorageSettings] = await Promise.all([
        getAppPaths(),
        storageSettings ? Promise.resolve(storageSettings) : getStorageSettings()
      ]);
      const guideStorageSettings = latestStorageSettings ?? storageSettings;
      const createdAt = new Date().toISOString();
      const providerLines = providerProfiles.length
        ? providerProfiles.map((profile) => [
            `- ${profile.displayName || profile.id}`,
            `  - profile id: ${profile.id}`,
            `  - provider: ${profile.providerId}`,
            `  - model: ${profile.modelId || '未配置'}`,
            `  - base URL: ${profile.baseUrl || '未配置'}`,
            `  - secret id: profile:${profile.id}（系统凭据，迁移后需要重新输入 API Key）`,
            `  - extra headers: ${profile.extraHeadersJson && profile.extraHeadersJson !== '{}' ? '已配置但不写入迁移说明，避免泄露敏感 Header' : '未配置'}`
          ].join('\n')).join('\n')
        : '- 当前没有保存的 Provider profile。';
      const content = [
        '# VisionHub Studio 迁移说明',
        '',
        `生成时间：${createdAt}`,
        `应用版本：${APP_VERSION}`,
        '',
        '## 这份说明的用途',
        '',
        '这不是自动恢复脚本，也不会包含 API Key。它只告诉你换电脑、重装系统或备份时需要复制哪些目录，以及哪些凭据需要重新输入。',
        '',
        '## 需要复制的目录 / 文件',
        '',
        `- 应用数据目录：${paths?.app_data_dir ?? '未读取到'}`,
        `- 作品画廊目录：${guideStorageSettings?.resolved_library_dir ?? paths?.library_dir ?? '未读取到'}`,
        `- 图片收藏目录：${guideStorageSettings?.resolved_inspiration_dir ?? '未读取到'}`,
        `- 备份目录：${paths?.backups_dir ?? '未读取到'}`,
        `- 生成历史文件：${paths?.history_file ?? '未读取到'}`,
        `- 画廊元数据文件：${paths?.library_meta_file ?? '未读取到'}`,
        `- 存储设置文件：${guideStorageSettings?.settings_file ?? '未读取到'}`,
        '',
        '## 不会自动迁移的内容',
        '',
        '- API Key：保存在系统凭据里，不导出、不写入这份说明。',
        '- prompt-polish:default：提示词润色独立凭据，换电脑后重新输入。',
        '- image-reverse:default：图片反推独立凭据，换电脑后重新输入。',
        '- profile:<profileId>：每个 Provider profile 的系统凭据，换电脑后按下面 profile id 重新输入。',
        '- 安装包、dist、target、node_modules 等构建产物：不需要复制，源码可重新构建。',
        '',
        '## Provider profiles',
        '',
        providerLines,
        '',
        '## 当前软件设置摘要',
        '',
        `- 启动页：${appSettings.startupPage}`,
        `- 主题：${appSettings.themeMode}`,
        `- 语言：${appSettings.language}`,
        `- 默认生图平台：${appSettings.generationDefaults.defaultProviderId}`,
        `- 默认模型：${appSettings.generationDefaults.defaultModelId}`,
        `- 默认尺寸：${appSettings.generationDefaults.defaultSize}`,
        `- 默认数量：${appSettings.generationDefaults.defaultCount}`,
        `- 提示词润色配置数量：${appSettings.promptPolish.savedConfigs.length}`,
        `- 图片反推模型：${appSettings.imagePromptReverse.modelId || '未配置'}`,
        '',
        '## 推荐迁移步骤',
        '',
        '1. 在旧电脑导出“设置备份”和这份“迁移说明”。',
        '2. 复制应用数据目录、作品画廊目录、图片收藏目录到新电脑。',
        '3. 在新电脑安装 / 构建 VisionHub Studio。',
        '4. 打开偏好设置，把作品画廊目录和图片收藏目录指向新位置。',
        '5. 到平台接入页按 profile id 重新输入 API Key，并运行测试连接 / 配置自检。',
        '6. 如果使用提示词润色或图片反推，分别重新输入 prompt-polish:default 和 image-reverse:default 对应密钥。',
        '',
        '## 安全边界',
        '',
        '- 这份说明不包含 API Key。',
        '- 这份说明不包含生成图片二进制。',
        '- 这份说明不包含 raw 大字段。',
        '- 迁移时不要清空旧电脑数据，确认新电脑能正常打开后再自行归档。',
        ''
      ].join('\n');
      const suggestedFileName = `visionhub-migration-guide-${Date.now()}.md`;
      const result = await saveTextFileWithDialog({ suggestedFileName, content });
      if (!result.saved || !result.path) {
        setSettingsMessage('已取消导出迁移说明。');
        return;
      }
      setSettingsMessage(`已导出迁移说明：${result.path}`);
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


  async function saveImageReverseSecret() {
    const trimmedSecret = imageReverseSecretDraft.trim();
    if (!trimmedSecret) {
      setSettingsMessage(imageReverseSecretAvailable ? '图片反推专用 API Key 已配置；如需更换，请先输入新的 Key。' : '请先填写图片反推专用 API Key。');
      return false;
    }
    if (!desktopRuntime) {
      setSettingsMessage('当前是网页预览模式，只有 Tauri 桌面端会写入系统凭据。');
      return false;
    }

    setIsSavingImageReverseSecret(true);
    try {
      const status = await saveProviderSecret(IMAGE_PROMPT_REVERSE_SECRET_ID, trimmedSecret);
      setImageReverseSecretAvailable(status.available);
      setImageReverseSecretDraft('');
      setSettingsMessage('图片反推专用 API Key 已保存，不会影响生图平台配置。');
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
    const displayName = imageReverseDraft.displayName.trim() || '图片反推 Prompt 专用配置';
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
    setSettingsMessage('图片反推 Prompt 专用配置已保存；它不会进入 AI 生图工作台模型列表。');
  }

  async function refreshImageReverseModels() {
    const baseUrl = imageReverseDraft.baseUrl.trim();
    if (!baseUrl) {
      setSettingsMessage('请先填写图片反推专用 Base URL。');
      return;
    }
    if (imageReverseDraft.protocol === 'gemini-generate-content') {
      setSettingsMessage('Gemini generateContent 暂不支持通过 /v1/models 自动刷新，请直接填写模型 ID。');
      return;
    }
    if (!desktopRuntime) {
      setSettingsMessage('当前是网页预览模式，只有 Tauri 桌面端可以刷新模型列表。');
      return;
    }
    if (!imageReverseSecretAvailable) {
      setSettingsMessage('请先保存图片反推专用 API Key，再刷新模型列表。');
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
        setSettingsMessage('模型接口已返回，但没有发现可用模型。');
        return;
      }
      setImageReverseDraft((current) => ({
        ...current,
        modelOptions,
        modelId: modelOptions.includes(current.modelId.trim()) ? current.modelId.trim() : ''
      }));
      setSettingsMessage(`已刷新 ${modelOptions.length} 个候选模型，请在图片反推模型框里选择或手动填写后保存配置。`);
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshingImageReverseModels(false);
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
      setConfigMessage(`${enabled ? '已启用' : '已停用'}：${profile.displayName}。可在 AI 创作台的“配置实例”下拉中选择当前使用哪一个。`);
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
        protocolLabel: protocolLabel(providerConfig.protocol),
        endpointPreview: providerEndpointPreview(providerConfig),
        imageToImageAdapterLabel: imageToImageAdapterLabel(resolveImageToImageAdapterForDisplay(providerConfig, selectedProvider.id)),
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
      setConfigMessage(modelListUnsupportedMessage(selectedProvider.id, providerConfig.modelId));
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
    if (!providerSupportsOpenAICompatibleModelList(selectedProvider.id)) {
      const fixedModelOptions = officialFixedModelOptions(selectedProvider.id);
      const nextConfig = ensureManualModelOption({
        ...providerConfig,
        modelOptions: Array.from(new Set([...providerConfig.modelOptions, ...fixedModelOptions, providerConfig.modelId.trim()].filter(Boolean)))
      });
      const probe = isMiniMaxProvider(selectedProvider.id)
        ? buildMiniMaxManualModelProbe(nextConfig.modelId, '未提交网络请求；请用“真实试生图”做最终联调。')
        : isGeminiProvider(selectedProvider.id)
          ? buildGeminiManualModelProbe(nextConfig.modelId, '未提交网络请求；请用“真实试生图”做最终联调。')
          : buildModelProbe(nextConfig.modelId, nextConfig.modelOptions, '当前 API 不提供 OpenAI-compatible 模型列表。');
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
          label: '当前模型探测',
          level: probe.available ? 'info' : 'warn',
          detail: probe.message
        }
      ]);
      setConfigMessage(probe.message);
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

  async function runProviderDiagnostics(targetProfile?: ProviderConnectionProfile | unknown) {
    const diagnosticProfile = isProviderConnectionProfileLike(targetProfile) ? targetProfile : undefined;
    setIsRunningDiagnostics(true);
    const checks: ProviderDiagnosticItem[] = [];
    if (!diagnosticProfile && !isSelectedServiceConfigurable) {
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
    const targetProviderId = diagnosticProfile?.providerId ?? selectedProvider.id;
    const targetProvider = providers.find((provider) => provider.id === targetProviderId) ?? selectedProvider;
    const targetConfig = normalizeProviderConfig(diagnosticProfile ? profileToProviderConfig(diagnosticProfile) : providerConfig);
    const targetSecretId = diagnosticProfile ? providerProfileSecretId(diagnosticProfile.id) : activeSecretId();
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
        level: diagnosticProfile || selectedProfileId ? 'pass' : 'info',
        detail: diagnosticProfile || selectedProfileId
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
        if (!diagnosticProfile || diagnosticProfile.id === selectedProfileId) {
          setSecretAvailable(currentSecretAvailable);
        }
      }

      push({
        id: 'secret',
        label: 'API Key',
        level: currentSecretAvailable ? 'pass' : 'warn',
        detail: currentSecretAvailable ? '系统安全凭据里已有密钥。' : '尚未保存密钥；可以先填写 API Key，再点击保存或保存并启用。'
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
        supportsOpenAICompatible: targetSupportsOpenAICompatible
      }).forEach((item) => push({ ...item, id: `readiness-${item.id}` }));

      buildProviderStabilityDiagnosticItems({
        config: targetConfig,
        providerId: targetProviderId,
        template: targetTemplate,
        supportsModelList: targetSupportsModelList
      }).forEach((item) => push({ ...item, id: `stability-${item.id}` }));

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
        const polishConfigReady = Boolean(safeProviderConfigText(appSettings.promptPolish.baseUrl) && safeProviderConfigText(appSettings.promptPolish.modelId));
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
        const fixedModelOptions = officialFixedModelOptions(targetProviderId);
        const nextConfig = fixedModelOptions.length
          ? ensureManualModelOption({
              ...targetConfig,
              modelOptions: Array.from(new Set([...targetConfig.modelOptions, ...fixedModelOptions, targetConfig.modelId.trim()].filter(Boolean)))
            })
          : ensureManualModelOption(targetConfig);
        const modelProbe = isMiniMaxProvider(targetProviderId)
          ? buildMiniMaxManualModelProbe(nextConfig.modelId, '非消耗诊断不会调用 MiniMax；请用真实试生图做最终联调。')
          : isGeminiProvider(targetProviderId)
            ? buildGeminiManualModelProbe(nextConfig.modelId, '非消耗诊断不会调用 Gemini；请用真实试生图做最终联调。')
            : {
                modelId: nextConfig.modelId.trim(),
                available: false,
                checkedAt: new Date().toISOString(),
                message: modelListUnsupportedMessage(targetProviderId, nextConfig.modelId)
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
          label: isMiniMaxProvider(targetProviderId) ? 'MiniMax 模型确认' : isGeminiProvider(targetProviderId) ? 'Gemini 模型确认' : '模型列表连通性',
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
          if (!diagnosticProfile || diagnosticProfile.id === selectedProfileId) {
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

  const t = useMemo(() => createTranslator(appSettings.language), [appSettings.language]);
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
            <span className="brandGlyph">VH</span>
          </div>
          <div className="brandText">
            <strong>VisionHub Studio</strong>
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

      <main className={`workspace ${page === 'generate' ? 'workspaceGenerate' : page === 'home' ? 'workspaceHomeShell' : page === 'batch' ? 'workspaceBatchShell' : ''}`}>
        {isLibraryPageMounted ? (
          <CachedLibraryPage
            t={t}
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

function BatchQueuePage(props: {
  t: Translator;
  queues: BatchGenerationQueue[];
  results: GenerationRecord[];
  templates: BatchQueueTemplate[];
  activeQueueId: string;
  executingTaskId: string | null;
  runningQueueId: string | null;
  runProgress: BatchQueueRunProgress | null;
  onPreview: (imageUrl: string, navigation?: ImagePreviewNavigation) => void;
  onNavigate: (page: Page) => void;
  onSelectQueue: (queueId: string) => void;
  onCreateQueue: () => void;
  onRenameQueue: (queueId: string) => void;
  onDeleteQueue: (queueId: string) => void;
  onRefresh: () => void;
  onStartQueue: (queueId: string) => void;
  onStopQueue: (queueId: string) => void;
  onExecuteTask: (queueId: string, taskId: string) => void;
  onCancelTask: (queueId: string, taskId: string) => void;
  onRequeueTask: (queueId: string, taskId: string) => void;
  onRequeueFailedTasks: (queueId: string) => void;
  onDeleteTask: (queueId: string, taskId: string) => void;
  onSaveTemplate: (queueId: string) => void;
  onApplyTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
}) {
  const t = props.t;
  const queueStatusLabel = (status: BatchGenerationQueue['status']) => {
    const labels: Record<BatchGenerationQueue['status'], string> = {
      draft: t('batch.status.draft'),
      ready: t('batch.status.ready'),
      running: t('batch.status.running'),
      paused: t('batch.status.paused'),
      completed: t('batch.status.completed'),
      'completed-with-errors': t('batch.status.completedWithErrors'),
      cancelled: t('batch.status.cancelled')
    };
    return labels[status] ?? status;
  };
  const taskStatusLabel = (status: BatchGenerationQueue['tasks'][number]['status']) => {
    const labels: Record<BatchGenerationQueue['tasks'][number]['status'], string> = {
      pending: t('batch.taskStatus.pending'),
      running: t('batch.taskStatus.running'),
      succeeded: t('batch.taskStatus.succeeded'),
      failed: t('batch.taskStatus.failed'),
      cancelled: t('batch.taskStatus.cancelled')
    };
    return labels[status] ?? status;
  };

  const activeQueue = (props.activeQueueId ? props.queues.find((queue) => queue.id === props.activeQueueId) : null)
    ?? props.queues[0]
    ?? null;
  const activeSummary = activeQueue ? summarizeBatchQueue(activeQueue) : {
    total: 0,
    pending: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    requestedImages: 0
  };
  const aggregate = props.queues.reduce((acc, queue) => {
    const summary = summarizeBatchQueue(queue);
    acc.total += summary.total;
    acc.pending += summary.pending;
    acc.running += summary.running;
    acc.succeeded += summary.succeeded;
    acc.failed += summary.failed;
    acc.requestedImages += summary.requestedImages;
    acc.compareGroups += queue.compareGroups?.length ?? 0;
    return acc;
  }, { total: 0, pending: 0, running: 0, succeeded: 0, failed: 0, requestedImages: 0, compareGroups: 0 });
  const visibleTasks = activeQueue ? [...activeQueue.tasks].reverse().slice(0, 80) : [];
  const compareGroupMap = new Map((activeQueue?.compareGroups ?? []).map((group) => [group.id, group]));
  const resultRecordMap = new Map(props.results.map((record) => [record.id, record]));
  const compareResultGroups = activeQueue ? (activeQueue.compareGroups ?? [])
    .map((group) => {
      const groupTasks = group.taskIds
        .map((taskId) => activeQueue.tasks.find((task) => task.id === taskId))
        .filter((task): task is BatchGenerationQueue['tasks'][number] => Boolean(task));
      const completedCount = groupTasks.filter((task) => task.status === 'succeeded' || task.status === 'failed' || task.status === 'cancelled').length;
      return {
        group,
        tasks: groupTasks,
        completedCount,
        resultCount: groupTasks.reduce((sum, task) => sum + task.resultRecordIds.filter((recordId) => resultRecordMap.has(recordId)).length, 0)
      };
    })
    .sort((a, b) => b.group.createdAt.localeCompare(a.group.createdAt))
    .slice(0, 4) : [];
  const batchVariantGroups = activeQueue ? summarizeBatchVariantGroups(activeQueue) : [];
  const omittedReferenceCount = visibleTasks.reduce(
    (sum, task) => sum + (task.snapshot.referencePolicy?.omittedReferenceIds.length ?? 0),
    0
  );
  const isActiveQueueRunning = Boolean(activeQueue && props.runningQueueId === activeQueue.id);
  const activeRunProgress = activeQueue && props.runProgress?.queueId === activeQueue.id ? props.runProgress : null;
  const canStartActiveQueue = Boolean(activeQueue && activeSummary.pending > 0 && !props.runningQueueId && !props.executingTaskId);
  const activeTaskId = props.executingTaskId ?? activeRunProgress?.currentTaskId ?? null;
  const activeExecutingTask = activeQueue && activeTaskId
    ? activeQueue.tasks.find((task) => task.id === activeTaskId)
    : null;
  const activeQueueFinishedCount = activeSummary.succeeded + activeSummary.failed + activeSummary.cancelled;
  const activeRunCompletedCount = activeRunProgress
    ? activeRunProgress.completedThisRun + activeRunProgress.failedThisRun
    : 0;
  const activeRunTotalCount = activeRunProgress?.initialPendingCount ?? activeSummary.total;
  const activeRunPercent = activeRunTotalCount > 0
    ? Math.min(100, Math.round((activeRunCompletedCount / activeRunTotalCount) * 100))
    : 0;
  const activeQueueProgressText = activeQueue
    ? isActiveQueueRunning
      ? activeRunProgress?.pauseRequested
        ? t('batch.progress.pauseRequested', { completed: activeRunCompletedCount, total: activeRunTotalCount })
        : t('batch.progress.running', { completed: activeRunCompletedCount, total: activeRunTotalCount, pending: activeSummary.pending })
      : activeSummary.pending > 0
        ? activeQueue.status === 'paused'
          ? t('batch.progress.paused', { pending: activeSummary.pending })
          : t('batch.progress.ready', { pending: activeSummary.pending })
        : t('batch.progress.finished', { finished: activeQueueFinishedCount, total: activeSummary.total })
    : t('batch.progress.noQueue');
  const activeQueuePrimaryActionLabel = isActiveQueueRunning
    ? activeRunProgress?.pauseRequested ? t('batch.action.pausing') : t('batch.action.pauseQueue')
    : activeQueue?.status === 'paused'
      ? t('batch.action.resumeQueue')
      : t('batch.action.runPending');
  const visibleTemplates = props.templates.slice(0, 4);
  const canSaveActiveQueueTemplate = Boolean(activeQueue && activeSummary.total > 0 && !isActiveQueueRunning && activeSummary.running === 0);

  return (
    <section className="batchQueuePage" aria-label={t('batch.aria')}>
      <header className="batchQueueHero">
        <div className="workspaceCommandTitle">
          <span>Batch Queue</span>
          <h1>{t('batch.title')}</h1>
        </div>
        <p>{t('batch.subtitle')}</p>
        <div className="batchQueueActions">
          <button
            type="button"
            className="workspaceCommandButton primary"
            onClick={() => props.onNavigate('generate')}
            title={t('batch.action.goCreateTitle')}
            aria-label={t('batch.action.goCreateTitle')}
          >
            <Wand2 size={15} /> {t('batch.action.goCreate')}
          </button>
          <button
            type="button"
            className="workspaceCommandButton"
            onClick={props.onRefresh}
            title={t('batch.action.refreshTitle')}
            aria-label={t('batch.action.refresh')}
          >
            <RefreshCcw size={15} /> {t('batch.action.refresh')}
          </button>
          <button
            type="button"
            className="workspaceCommandButton"
            onClick={props.onCreateQueue}
            title={t('batch.action.newQueueLongTitle')}
            aria-label={t('batch.action.newQueue')}
          >
            <Plus size={15} /> {t('batch.action.newQueue')}
          </button>
          <button
            type="button"
            className="workspaceCommandButton"
            disabled={!activeQueue || !canSaveActiveQueueTemplate}
            onClick={() => activeQueue ? props.onSaveTemplate(activeQueue.id) : undefined}
            title={t('batch.action.saveTemplateTitle')}
            aria-label={t('batch.action.saveTemplate')}
          >
            <Bookmark size={15} /> {t('batch.action.saveTemplate')}
          </button>
          <button
            type="button"
            className={`workspaceCommandButton ${isActiveQueueRunning ? 'dangerAction' : 'primary'}`}
            disabled={!activeQueue || (!isActiveQueueRunning && !canStartActiveQueue)}
            onClick={() => activeQueue ? (isActiveQueueRunning ? props.onStopQueue(activeQueue.id) : props.onStartQueue(activeQueue.id)) : undefined}
            title={isActiveQueueRunning ? t('batch.action.pauseTitle') : t('batch.action.runTitle')}
            aria-label={isActiveQueueRunning ? t('batch.action.pauseAria') : t('batch.action.runAria')}
          >
            {isActiveQueueRunning ? <Pause size={15} /> : <Play size={15} />} {activeQueuePrimaryActionLabel}
          </button>
          <button
            type="button"
            className="workspaceCommandButton"
            disabled={!activeQueue || activeSummary.failed === 0 || Boolean(props.runningQueueId) || Boolean(props.executingTaskId)}
            onClick={() => activeQueue ? props.onRequeueFailedTasks(activeQueue.id) : undefined}
            title={t('batch.action.retryFailedTitle')}
            aria-label={t('batch.action.retryFailedAria')}
          >
            <RefreshCcw size={15} /> {t('batch.action.retryFailed')}
          </button>
        </div>
      </header>

      {activeQueue ? (
        <div className={`batchQueueRunBanner ${isActiveQueueRunning ? 'running' : ''} ${activeQueue.status === 'paused' ? 'paused' : ''}`} aria-live="polite">
          <div>
            <strong>{isActiveQueueRunning ? activeRunProgress?.pauseRequested ? t('batch.banner.pauseRequested') : t('batch.banner.running') : activeQueue.status === 'paused' ? t('batch.banner.paused') : t('batch.banner.mode')}</strong>
            <span>{activeQueueProgressText}</span>
            {activeExecutingTask ? <em>{t('batch.currentTask', { title: activeExecutingTask.title })}</em> : null}
            {activeRunProgress?.currentTaskTitle && !activeExecutingTask ? <em>{t('batch.currentTask', { title: activeRunProgress.currentTaskTitle })}</em> : null}
          </div>
          {isActiveQueueRunning ? (
            <div className="batchQueueProgressTrack" aria-label={t('batch.progressAria', { percent: activeRunPercent })}>
              <span style={{ width: `${activeRunPercent}%` }} />
            </div>
          ) : null}
          <small>{t('batch.banner.serialHint')}</small>
        </div>
      ) : null}

      <div className="batchQueueStats" aria-label={t('batch.statsAria')}>
        <BatchQueueStat label={t('batch.stats.queues')} value={props.queues.length} hint={activeQueue?.name ?? t('batch.progress.noQueue')} />
        <BatchQueueStat label={t('batch.stats.tasks')} value={aggregate.total} hint={t('batch.stats.pendingHint', { count: aggregate.pending })} />
        <BatchQueueStat label={t('batch.stats.images')} value={aggregate.requestedImages} hint={t('batch.stats.imagesHint')} />
        <BatchQueueStat label={t('batch.stats.compareGroups')} value={aggregate.compareGroups} hint={t('batch.stats.compareGroupsHint', { count: activeQueue?.compareGroups?.length ?? 0 })} />
        <BatchQueueStat label={t('batch.stats.failedSucceeded')} value={`${aggregate.failed} / ${aggregate.succeeded}`} hint={t('batch.stats.writebackHint')} />
      </div>

      {activeQueue ? (
        <div className="batchQueueLayout">
          <aside className="batchQueueListPanel" aria-label={t('batch.queueListAria')}>
            <div className="workspaceSectionHeading compact">
              <div>
                <p className="eyebrow">Queues</p>
                <h2>{t('batch.queueListTitle')}</h2>
              </div>
              <button
                type="button"
                className="workspaceCommandButton batchQueueCreateButton"
                onClick={props.onCreateQueue}
                title={t('batch.action.newQueueShortTitle')}
                aria-label={t('batch.action.newQueue')}
              >
                <Plus size={14} /> {t('batch.action.new')}
              </button>
            </div>
            {props.queues.map((queue) => {
              const summary = summarizeBatchQueue(queue);
              const isSelected = activeQueue?.id === queue.id;
              const isQueueRunning = props.runningQueueId === queue.id || summary.running > 0;
              const canRenameQueue = !isQueueRunning;
              const canDeleteQueue = props.queues.length > 1 && !isQueueRunning;
              const selectQueue = () => props.onSelectQueue(queue.id);
              return (
                <article
                  className={`batchQueueCard ${isSelected ? 'active' : ''}`}
                  key={queue.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={selectQueue}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      selectQueue();
                    }
                  }}
                >
                  <div className="batchQueueCardHeader">
                    <strong>{queue.name}</strong>
                    {isSelected ? <em>{t('batch.queue.current')}</em> : null}
                  </div>
                  <span>{t('batch.queue.summary', { total: summary.total, pending: summary.pending, images: summary.requestedImages })}</span>
                  <small>{queueStatusLabel(queue.status)} - {t('batch.queue.compareGroupCount', { count: queue.compareGroups?.length ?? 0 })} - {formatWorkspaceHomeTime(queue.updatedAt)}</small>
                  <div className="batchQueueCardActions" aria-label={t('batch.queue.actionsAria', { name: queue.name })}>
                    <button
                      type="button"
                      className="workspaceCommandButton"
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onRenameQueue(queue.id);
                      }}
                      disabled={!canRenameQueue}
                      title={t('batch.queue.renameTitle')}
                      aria-label={t('batch.queue.renameAria', { name: queue.name })}
                    >
                      <Pencil size={13} /> {t('batch.queue.rename')}
                    </button>
                    <button
                      type="button"
                      className="workspaceCommandButton dangerAction"
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onDeleteQueue(queue.id);
                      }}
                      disabled={!canDeleteQueue}
                      title={canDeleteQueue ? t('batch.queue.deleteTitle') : t('batch.queue.deleteDisabledTitle')}
                      aria-label={t('batch.queue.deleteAria', { name: queue.name })}
                    >
                      <Trash2 size={13} /> {t('batch.queue.delete')}
                    </button>
                  </div>
                </article>
              );
            })}
          </aside>

          <section className="batchTaskPanel" aria-label={t('batch.taskListAria')}>
            <div className="workspaceSectionHeading compact">
              <div>
                <p className="eyebrow">Tasks</p>
                <h2>{t('batch.taskListTitle')}</h2>
              </div>
              {omittedReferenceCount > 0 ? (
                <span className="workspaceSoftCounter warning">{t('batch.task.omittedReferences', { count: omittedReferenceCount })}</span>
              ) : (
                <span className="workspaceSoftCounter">{t('batch.stats.pendingHint', { count: activeSummary.pending })}</span>
              )}
            </div>
            {visibleTemplates.length ? (
              <div className="batchTemplateList" aria-label={t('batch.templatesAria')}>
                {visibleTemplates.map((template) => (
                  <article className="batchTemplateCard" key={template.id}>
                    <div>
                      <strong>{template.name}</strong>
                      <span>{t('batch.template.summary', { tasks: template.taskTemplates.length, groups: template.compareGroups.length })}</span>
                      <small>
                        {template.usedCount ? t('batch.template.usedCount', { count: template.usedCount }) : t('batch.template.notUsed')}
                        {template.lastUsedAt ? ` · ${formatWorkspaceHomeTime(template.lastUsedAt)}` : ` · ${formatWorkspaceHomeTime(template.updatedAt)}`}
                      </small>
                    </div>
                    <div className="batchTemplateActions">
                      <button
                        type="button"
                        className="workspaceCommandButton primary"
                        onClick={() => props.onApplyTemplate(template.id)}
                        disabled={Boolean(props.runningQueueId) || Boolean(props.executingTaskId)}
                        title={t('batch.template.applyTitle')}
                        aria-label={t('batch.template.applyAria', { name: template.name })}
                      >
                        {t('batch.template.apply')}
                      </button>
                      <button
                        type="button"
                        className="workspaceCommandButton dangerAction"
                        onClick={() => props.onDeleteTemplate(template.id)}
                        disabled={Boolean(props.runningQueueId) || Boolean(props.executingTaskId)}
                        title={t('batch.template.deleteTitle')}
                        aria-label={t('batch.template.deleteAria', { name: template.name })}
                      >
                        {t('batch.template.delete')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {compareResultGroups.length ? (
              <div className="batchCompareResultList" aria-label={t('batch.compare.aria')}>
                {compareResultGroups.map(({ group, tasks, completedCount, resultCount }) => (
                  <article className="batchCompareResultGroup" key={group.id}>
                    <div className="batchCompareResultHeader">
                      <div>
                        <strong>{t('batch.compare.title')}</strong>
                        <span>{t('batch.compare.summary', { completed: completedCount, total: tasks.length, result: resultCount > 0 ? t('batch.compare.resultCount', { count: resultCount }) : t('batch.compare.statusOnly') })}</span>
                      </div>
                      <small>{formatWorkspaceHomeTime(group.createdAt)}</small>
                    </div>
                    <p>{group.prompt}</p>
                    <div className="batchCompareResultGrid">
                      {tasks.map((task) => {
                        const taskRecords = task.resultRecordIds
                          .map((recordId) => resultRecordMap.get(recordId))
                          .filter((record): record is GenerationRecord => Boolean(record));
                        const successRecord = taskRecords.find((record) => record.status === 'succeeded' && record.imageUrls[0]);
                        const firstRecord = taskRecords[0];
                        const previewUrl = successRecord?.imageUrls[0];
                        const status = firstRecord?.status ?? task.status;
                        return (
                          <article className={`batchCompareResultCard ${status}`} key={task.id}>
                            {previewUrl ? (
                              <button
                                type="button"
                                className="batchCompareThumb"
                                onClick={() => props.onPreview(previewUrl)}
                                title={t('batch.compare.previewTitle')}
                                aria-label={t('batch.compare.previewAria', { name: task.snapshot.profileName ?? task.snapshot.modelId })}
                              >
                                <img src={previewUrl} alt={task.title} loading="lazy" decoding="async" />
                              </button>
                            ) : (
                              <div className="batchCompareThumb empty">
                                <Image size={18} />
                                <span>{taskStatusLabel(task.status)}</span>
                              </div>
                            )}
                            <div className="batchCompareResultMeta">
                              <strong>{task.snapshot.profileName ?? task.snapshot.providerName ?? task.snapshot.providerId}</strong>
                              <span>{task.snapshot.modelId}</span>
                              <small>{task.snapshot.size} ? {t('batch.countImages', { count: task.snapshot.count })} ? {task.durationMs ? `${Math.round(task.durationMs / 1000)}s` : t('batch.durationPending')}</small>
                              {task.error || firstRecord?.error ? <em>{task.error ?? firstRecord?.error}</em> : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {batchVariantGroups.length ? (
              <div className="batchVariantGroupList" aria-label={t('batch.variant.aria')}>
                {batchVariantGroups.slice(0, 4).map((group) => (
                  <div className="batchVariantGroupCard" key={group.key}>
                    <div>
                      <strong>{t('batch.variant.title')}</strong>
                      <span>{t('batch.variant.summary', { prompts: group.promptCount, sizes: group.sizeCount, total: group.total })}</span>
                    </div>
                    <small>{group.sizes.join(' / ')}</small>
                    <em>{t('batch.variant.statusSummary', { succeeded: group.succeeded, running: group.running, pending: group.pending, failed: group.failed })}</em>
                  </div>
                ))}
              </div>
            ) : null}
            {visibleTasks.length ? (
              <div className="batchTaskList">
                {visibleTasks.map((task) => {
                  const isExecuting = props.executingTaskId === task.id;
                  const canExecute = task.status === 'pending' && !props.executingTaskId && !props.runningQueueId;
                  const canRequeue = task.status === 'failed' && !props.executingTaskId;
                  const canCancel = task.status === 'pending' && !props.executingTaskId && !props.runningQueueId;
                  const canDelete = (task.status === 'failed' || task.status === 'cancelled') && !props.executingTaskId && !props.runningQueueId;
                  const compareGroup = task.compareGroupId ? compareGroupMap.get(task.compareGroupId) : undefined;
                  const compareTaskIndex = compareGroup ? compareGroup.taskIds.indexOf(task.id) + 1 : 0;
                  const isBatchVariantTask = task.kind === 'prompt-size-sweep';
                  return (
                  <article className={`batchTaskItem ${isExecuting ? 'running' : ''}`} key={task.id}>
                    <div className="batchTaskMain">
                      <div className="batchTaskTitleRow">
                        <strong>{task.title}</strong>
                        {isBatchVariantTask ? (
                          <span className="batchVariantBadge" title={t('batch.variant.badgeTitle')}>
                            {t('batch.variant.badge')}
                          </span>
                        ) : null}
                        {compareGroup ? (
                          <span className="batchCompareBadge" title={t('batch.compare.badgeTitle', { id: compareGroup.id })}>
                            {t('batch.compare.badge', { index: compareTaskIndex > 0 ? `${compareTaskIndex}/${compareGroup.taskIds.length}` : compareGroup.taskIds.length })}
                          </span>
                        ) : null}
                        <span className={`batchTaskStatus ${task.status}`}>{taskStatusLabel(task.status)}</span>
                      </div>
                      <p>{task.snapshot.prompt}</p>
                      <div className="batchTaskMeta">
                        <span>{task.snapshot.generationMode === 'image-to-image' ? t('batch.mode.imageToImage') : t('batch.mode.textToImage')}</span>
                        <span>{task.snapshot.providerName ?? task.snapshot.providerId}</span>
                        <span>{task.snapshot.profileName ?? t('batch.profileUnbound')}</span>
                        <span>{task.snapshot.modelId}</span>
                        <span>{task.snapshot.size}</span>
                        <span>{t('batch.countImages', { count: task.snapshot.count })}</span>
                      </div>
                      {task.error ? <small className="batchTaskError">{task.error}</small> : null}
                    </div>
                    <div className="batchTaskSide">
                      <span>{formatWorkspaceHomeTime(task.createdAt)}</span>
                      <small>
                        {task.attempt > 0 ? t('batch.task.attemptPrefix', { count: task.attempt }) : ''}
                        {task.snapshot.referencePolicy?.omittedReferenceIds.length ? t('batch.task.referencesNeedConfirm') : t('batch.task.referenceCount', { count: task.snapshot.references?.length ?? 0 })}
                      </small>
                      <div className="batchTaskActions">
                        {task.status === 'failed' ? (
                          <button
                            type="button"
                            className="workspaceCommandButton primary"
                            onClick={() => props.onRequeueTask(task.queueId, task.id)}
                            disabled={!canRequeue}
                            title={t('batch.task.requeueTitle')}
                            aria-label={t('batch.task.requeueAria')}
                          >
                            {t('batch.task.requeue')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="workspaceCommandButton primary"
                            onClick={() => props.onExecuteTask(task.queueId, task.id)}
                            disabled={!canExecute}
                            title={t('batch.task.executeTitle')}
                            aria-label={t('batch.task.executeAria')}
                          >
                            {isExecuting ? t('batch.task.executing') : t('batch.task.execute')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="workspaceCommandButton"
                          onClick={() => props.onCancelTask(task.queueId, task.id)}
                          disabled={!canCancel}
                          title={t('batch.task.cancelTitle')}
                          aria-label={t('batch.task.cancelAria')}
                        >
                          {t('batch.task.cancel')}
                        </button>
                        {(task.status === 'failed' || task.status === 'cancelled') ? (
                          <button
                            type="button"
                            className="workspaceCommandButton dangerAction"
                            onClick={() => props.onDeleteTask(task.queueId, task.id)}
                            disabled={!canDelete}
                            title={t('batch.task.deleteTitle')}
                            aria-label={t('batch.task.deleteAria')}
                          >
                            {t('batch.task.delete')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            ) : (
              <div className="workspaceHomeEmpty">
                <strong>{t('batch.emptyQueueTitle')}</strong>
                <small>{t('batch.emptyQueueHint')}</small>
                <button type="button" className="workspaceCommandButton primary" onClick={() => props.onNavigate('generate')}>
                  <Wand2 size={15} /> {t('batch.action.addTask')}
                </button>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="workspaceHomeEmpty batchQueueEmpty">
          <ListChecks size={28} />
          <strong>{t('batch.emptyTitle')}</strong>
          <small>{t('batch.emptyHint')}</small>
          <div className="batchQueueEmptyActions">
            <button type="button" className="workspaceCommandButton primary" onClick={() => props.onNavigate('generate')}>
              <Wand2 size={15} /> {t('batch.action.goCreate')}
            </button>
            <button type="button" className="workspaceCommandButton" onClick={props.onCreateQueue}>
              <Plus size={15} /> {t('batch.action.newQueue')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

type BatchVariantGroupSummary = {
  key: string;
  promptCount: number;
  sizeCount: number;
  total: number;
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  sizes: string[];
  addedAt: string;
};

function summarizeBatchVariantGroups(queue: BatchGenerationQueue[]): BatchVariantGroupSummary[];
function summarizeBatchVariantGroups(queue: BatchGenerationQueue): BatchVariantGroupSummary[];
function summarizeBatchVariantGroups(queue: BatchGenerationQueue | BatchGenerationQueue[]): BatchVariantGroupSummary[] {
  const queues = Array.isArray(queue) ? queue : [queue];
  const groups = new Map<string, BatchVariantGroupSummary & { sizeSet: Set<string> }>();

  for (const currentQueue of queues) {
    for (const task of currentQueue.tasks) {
      if (task.kind !== 'prompt-size-sweep') continue;
      const meta = readBatchVariantMetadata(task);
      const addedAt = meta.addedAt || task.createdAt;
      const key = `${currentQueue.id}:${addedAt}:${meta.promptCount}:${meta.sizeCount}`;
      const existing = groups.get(key) ?? {
        key,
        promptCount: meta.promptCount,
        sizeCount: meta.sizeCount,
        total: 0,
        pending: 0,
        running: 0,
        succeeded: 0,
        failed: 0,
        cancelled: 0,
        sizes: [],
        sizeSet: new Set<string>(),
        addedAt
      };
      existing.total += 1;
      existing[task.status] += 1;
      const variantSize = meta.variantSize || task.snapshot.size;
      if (variantSize && !existing.sizeSet.has(variantSize)) {
        existing.sizeSet.add(variantSize);
        existing.sizes.push(variantSize);
      }
      groups.set(key, existing);
    }
  }

  return Array.from(groups.values())
    .map(({ sizeSet: _sizeSet, ...group }) => group)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

function readBatchVariantMetadata(task: BatchGenerationQueue['tasks'][number]) {
  const raw = task.snapshot.metadata?.visionhub_batch_variants;
  if (!raw || typeof raw !== 'object') {
    return {
      addedAt: task.createdAt,
      promptCount: 1,
      sizeCount: 1,
      variantSize: task.snapshot.size
    };
  }
  const metadata = raw as Record<string, unknown>;
  const promptCount = typeof metadata.promptCount === 'number' && Number.isFinite(metadata.promptCount)
    ? Math.max(1, Math.round(metadata.promptCount))
    : 1;
  const sizeCount = typeof metadata.sizeCount === 'number' && Number.isFinite(metadata.sizeCount)
    ? Math.max(1, Math.round(metadata.sizeCount))
    : 1;
  return {
    addedAt: typeof metadata.addedAt === 'string' ? metadata.addedAt : task.createdAt,
    promptCount,
    sizeCount,
    variantSize: typeof metadata.variantSize === 'string' ? metadata.variantSize : task.snapshot.size
  };
}

function BatchQueueStat(props: { label: string; value: number | string; hint: string }) {
  return (
    <div className="batchQueueStat">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.hint}</small>
    </div>
  );
}


function WorkspaceHomePage(props: {
  t: Translator;
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
      ? props.t('home.status.comfyOnline')
      : props.localComfyUIDiagnostic.status === 'offline'
        ? props.t('home.status.comfyOffline')
        : props.localComfyUIDiagnostic.status === 'failed'
          ? props.t('home.status.connectionFailed')
          : props.localComfyUIDiagnostic.status === 'checking'
            ? props.t('home.status.checking')
            : props.t('home.status.localPending');
  const comfyStatusTone =
    props.localComfyUIDiagnostic.status === 'online'
      ? 'ready'
      : props.localComfyUIDiagnostic.status === 'offline' || props.localComfyUIDiagnostic.status === 'failed'
        ? 'warning'
        : 'idle';
  const providerStatusTone = props.isRealProviderReady ? 'ready' : props.selectedProviderId === 'comfyui-local' || props.secretAvailable ? 'warning' : 'idle';
  const providerStatusLabel = props.isRealProviderReady
    ? props.t('home.status.providerReady')
    : props.selectedProviderId === 'comfyui-local'
      ? props.t('home.status.localWorkflowPending')
      : props.t('home.status.waitingSecret');
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
    { page: 'generate', label: props.t('nav.generate'), detail: props.t('home.quick.generateDetail'), icon: <Wand2 size={16} /> },
    { page: 'library', label: props.t('nav.library'), detail: props.t('home.quick.libraryDetail'), icon: <Image size={16} /> },
    { page: 'inspiration', label: props.t('nav.inspiration'), detail: props.t('home.quick.inspirationDetail'), icon: <Bookmark size={16} /> },
    { page: 'templates', label: props.t('nav.templates'), detail: props.t('home.quick.templatesDetail'), icon: <Layers size={16} /> },
    { page: 'providers', label: props.t('nav.providers'), detail: props.t('home.quick.providersDetail'), icon: <Database size={16} /> }
  ];
  const roadmapItems = [
    { title: props.t('home.route.gallery'), state: props.t('home.route.next'), page: 'library' as Page },
    { title: props.t('home.route.batch'), state: props.t('home.route.canCreate'), page: 'batch' as Page },
    { title: props.t('home.route.compare'), state: props.t('home.route.planned'), page: 'providers' as Page }
  ];

  function useRecordAsReferenceAndCreate(record: GenerationRecord) {
    props.onUseRecordAsReference(record);
    props.onNavigate('generate');
  }

  return (
    <section className="workspaceHome workspaceHomeV21" aria-label={props.t('home.aria')}>
      <header className="workspaceCommandBar">
        <div className="workspaceCommandTitle">
          <span>{props.t('home.command.eyebrow')}</span>
          <h1>{props.t('home.title')}</h1>
        </div>
        <div className="workspaceCommandStatus" aria-label={props.t('home.status.current')}>
          <span className={`workspaceStatusPill ${providerStatusTone}`}>
            <ShieldCheck size={14} /> {providerStatusLabel}
          </span>
          <span className={`workspaceStatusPill ${comfyStatusTone}`}>
            <HardDrive size={14} /> {comfyStatusLabel}
          </span>
          <span className="workspaceStatusPill neutral">{props.t('home.status.localFirst')}</span>
        </div>
        <div className="workspaceCommandActions">
          <button type="button" className="workspaceCommandButton primary" onClick={() => props.onNavigate('generate')}>
            <Wand2 size={15} /> {props.t('home.action.start')}
          </button>
          <button type="button" className="workspaceCommandButton" onClick={() => props.onNavigate('library')}>
            <Image size={15} /> {props.t('home.action.openGallery')}
          </button>
          <button type="button" className="workspaceCommandButton" onClick={() => props.onNavigate('providers')}>
            <Gauge size={15} /> {props.t('home.action.checkConfig')}
          </button>
        </div>
      </header>

      {props.homeModules.resume || props.homeModules.attention ? (
      <section className={`workspaceFlowGrid ${!props.homeModules.resume || !props.homeModules.attention ? 'singleModule' : ''}`} aria-label={props.t('home.resume.aria')}>
        {props.homeModules.resume ? <article className={`workspaceContinuePanel ${continueRecord ? '' : 'isEmpty'}`}>
          <div className="workspaceSectionHeading">
            <div>
              <p className="eyebrow">{props.t('home.resume.eyebrow')}</p>
              <h2>{props.t('home.resume.title')}</h2>
            </div>
            <span className="workspaceSoftCounter">{props.t('home.resume.successCount', { count: props.resultSummary.succeeded })}</span>
          </div>
          {continueRecord ? (
            <div className="workspaceContinueBody">
              <button
                type="button"
                className="workspaceContinuePreview"
                onClick={() => props.onNavigate('library')}
                aria-label={props.t('home.resume.openRecent')}
              >
                <img src={continueRecord.imageUrls[0]} alt={continueRecord.prompt || getRecordFileName(continueRecord) || props.t('home.resume.recentAlt')} loading="lazy" decoding="async" />
              </button>
              <div className="workspaceContinueInfo">
                <strong>{getRecordFileName(continueRecord) || continueRecord.prompt || props.t('home.resume.untitled')}</strong>
                <p>{continueRecord.prompt || props.t('home.resume.noPrompt')}</p>
                <div className="workspaceContinueMeta">
                  <span>{props.providerNameMap.get(continueRecord.providerId) ?? continueRecord.providerName ?? props.providerName}</span>
                  <span>{continueRecord.modelId || props.providerModelId}</span>
                  <span>{formatWorkspaceHomeTime(continueRecord.createdAt)}</span>
                </div>
                <div className="workspaceContinueActions">
                  <button type="button" className="workspaceCommandButton primary" onClick={() => useRecordAsReferenceAndCreate(continueRecord)}>
                    <ImagePlus size={15} /> {props.t('home.action.setReference')}
                  </button>
                  <button type="button" className="workspaceCommandButton" onClick={() => props.onNavigate('library')}>
                    <ExternalLink size={15} /> {props.t('home.action.openDetail')}
                  </button>
                  <button type="button" className="workspaceCommandButton" onClick={() => props.onNavigate('generate')}>
                    <Wand2 size={15} /> {props.t('home.action.continueDesk')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <WorkspaceHomeEmpty title={props.t('home.resume.emptyTitle')} hint={props.t('home.resume.emptyHint')} actionLabel={props.t('home.action.start')} onAction={() => props.onNavigate('generate')} />
          )}
        </article> : null}

        {props.homeModules.attention ? <aside className="workspaceTaskRail" aria-label={props.t('home.attention.aria')}>
          <div className="workspaceMiniStats">
            <span><strong>{props.resultSummary.total}</strong>{props.t('home.attention.totalRecords')}</span>
            <span><strong>{props.favoriteRecords.length}</strong>{props.t('home.attention.favorites')}</span>
            <span><strong>{props.referenceRecords.length}</strong>{props.t('home.attention.references')}</span>
          </div>
          <div className="workspaceTodoPanel">
            <div className="workspaceSectionHeading compact">
              <div>
                <p className="eyebrow">{props.t('home.attention.eyebrow')}</p>
                <h2>{props.t('home.attention.title')}</h2>
              </div>
              <span className={pendingTaskCount ? 'workspaceSoftCounter warning' : 'workspaceSoftCounter'}>{props.t('home.attention.itemCount', { count: pendingTaskCount })}</span>
            </div>
            {props.recentFailureRecords.length || props.resultSummary.pending ? (
              <div className="workspaceTodoList">
                {props.resultSummary.pending ? (
                  <button type="button" className="workspaceTodoItem" onClick={() => props.onNavigate('library')}>
                    <span className="workspaceTodoDot pending" />
                    <span><strong>{props.t('home.attention.pendingTitle', { count: props.resultSummary.pending })}</strong><small>{props.t('home.attention.pendingHint')}</small></span>
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
              <WorkspaceHomeEmpty title={props.t('home.attention.emptyTitle')} hint={props.t('home.attention.emptyHint')} />
            )}
          </div>
          <div className="workspaceLocalSummary">
            <div>
              <strong>{props.t('home.local.title')}</strong>
              <span>{props.t('home.local.workflowSummary', { total: props.localComfyUIWorkflowStore.presets.length, runnable: runnableWorkflowCount })}</span>
              <small>{activeWorkflow ? `${activeWorkflow.name} · ${workflowFormatLabel(activeWorkflow.summary.format)} · ${activeWorkflowStatus ?? props.t('home.status.checking')}` : props.t('home.local.noWorkflow')}</small>
            </div>
            <button type="button" className="workspaceIconAction" onClick={props.onOpenComfyUIWorkflowManager} aria-label={props.t('home.local.openManager')} title={props.t('home.local.openManager')}>
              <SlidersHorizontal size={15} />
            </button>
          </div>
        </aside> : null}
      </section>
      ) : null}

      {props.homeModules.materials ? <section className="workspaceAssetStripPanel" aria-label={props.t('home.materials.aria')}>
        <div className="workspaceSectionHeading">
          <div>
            <p className="eyebrow">{props.t('home.materials.eyebrow')}</p>
            <h2>{props.t('home.materials.title')}</h2>
          </div>
          <div className="workspaceStripFilters" aria-label={props.t('home.materials.sourceAria')}>
            <span>{props.t('home.materials.recent')}</span>
            <span>{props.t('home.materials.reference')}</span>
            <span>{props.t('home.materials.favorite')}</span>
          </div>
        </div>
        {materialRecords.length ? (
          <div className="workspaceAssetStrip">
            {materialRecords.map((record) => (
              <article className="workspaceAssetTile" key={record.id}>
                <button type="button" className="workspaceAssetThumb" onClick={() => props.onNavigate('library')} aria-label={props.t('home.materials.enterGallery')}>
                  <img src={record.imageUrls[0]} alt={record.prompt || getRecordFileName(record) || props.t('home.materials.thumbAlt')} loading="lazy" decoding="async" />
                </button>
                <div className="workspaceAssetMeta">
                  <strong>{getRecordFileName(record) || record.prompt || props.t('home.materials.untitled')}</strong>
                  <span>{formatWorkspaceHomeTime(record.createdAt)}</span>
                </div>
                <div className="workspaceAssetActions">
                  <button type="button" onClick={() => useRecordAsReferenceAndCreate(record)}>{props.t('home.action.reference')}</button>
                  <button type="button" onClick={() => props.onNavigate('library')}>{props.t('home.action.detail')}</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <WorkspaceHomeEmpty title={props.t('home.materials.emptyTitle')} hint={props.t('home.materials.emptyHint')} actionLabel={props.t('home.materials.enterGallery')} onAction={() => props.onNavigate('library')} />
        )}
      </section> : null}

      {props.homeModules.quickActions ? <section className="workspaceCommandDock" aria-label={props.t('home.quick.aria')}>
        <span className="workspaceDockLabel">{props.t('home.quick.label')}</span>
        {quickActions.map((item) => (
          <button type="button" key={item.page} className="workspaceDockButton" onClick={() => props.onNavigate(item.page)}>
            {item.icon}
            <span><strong>{item.label}</strong><small>{item.detail}</small></span>
          </button>
        ))}
      </section> : null}

      {props.homeModules.roadmap ? <section className="workspaceRouteStrip" aria-label={props.t('home.route.aria')}>
        <span className="workspaceDockLabel">{props.t('home.route.label')}</span>
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
  t: Translator;
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
  const t = props.t;
  const statusOptions: Array<{ value: FreePlatformUsageStatus; label: string }> = [
    { value: 'unused', label: t('free.status.unused') },
    { value: 'registered', label: t('free.status.registered') },
    { value: 'favorite', label: t('free.status.favorite') },
    { value: 'unavailable', label: t('free.status.unavailable') }
  ];
  const commercialLabelMap: Record<FreePlatform['commercialUse'], string> = {
    unknown: t('free.platform.commercial.unknown'),
    personal: t('free.platform.commercial.personal'),
    limited: t('free.platform.commercial.limited'),
    allowed: t('free.platform.commercial.allowed')
  };
  const loginLabelMap: Record<FreePlatform['loginRequirement'], string> = {
    required: t('free.platform.login.required'),
    optional: t('free.platform.login.optional'),
    unknown: t('free.platform.login.unknown')
  };
  const regionLabelMap: Record<FreePlatform['region'], string> = {
    china: t('free.platform.region.china'),
    global: t('free.platform.region.global')
  };
  const kindLabelMap: Record<FreePlatform['kind'], string> = {
    'chat-image': t('free.platform.kind.chat-image'),
    image: t('free.platform.kind.image'),
    'image-video': t('free.platform.kind.image-video')
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
          <h1>{t('free.title')}</h1>
          <p>{t('free.subtitle')}</p>
        </div>
        <div className="statusPills">
          <span>
            <Gift size={15} /> {t('free.stats.platforms', { count: FREE_PLATFORMS.length })}
          </span>
          <span>
            <Star size={15} /> {t('free.stats.favorites', { count: favoriteCount })}
          </span>
          <span>
            <Copy size={15} /> {promptReady ? t('free.stats.promptReady') : t('free.stats.promptMissing')}
          </span>
        </div>
      </header>

      <section className="freeWorkflowStrip" aria-label={t('free.workflowAria')}>
        <div>
          <strong>{t('free.workflow.copyTitle')}</strong>
          <span>{t('free.workflow.copyHint')}</span>
        </div>
        <div>
          <strong>{t('free.workflow.generateTitle')}</strong>
          <span>{t('free.workflow.generateHint')}</span>
        </div>
        <div>
          <strong>{t('free.workflow.importTitle')}</strong>
          <span>{t('free.workflow.importHint')}</span>
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
              {t('free.region.all')}
            </button>
            <button className={regionFilter === 'china' ? 'active' : ''} onClick={() => setRegionFilter('china')}>
              {t('free.region.china')}
            </button>
            <button className={regionFilter === 'global' ? 'active' : ''} onClick={() => setRegionFilter('global')}>
              {t('free.region.global')}
            </button>
          </div>
        </div>
        <div className="freeActionGroup">
          <label className="freeSearchBox">
            <span>{t('free.searchLabel')}</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('free.searchPlaceholder')}
            />
          </label>
          <StudioSelect
            value={kindFilter}
            onChange={(value) => setKindFilter(value as 'all' | FreePlatform['kind'])}
            options={[
              { value: 'all', label: t('free.kind.all') },
              { value: 'chat-image', label: t('free.kind.chat-image') },
              { value: 'image', label: t('free.kind.image') },
              { value: 'image-video', label: t('free.kind.image-video') }
            ]}
          />
          <StudioSelect
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as 'all' | FreePlatformUsageStatus)}
            options={[
              { value: 'all', label: t('free.status.all') },
              ...statusOptions
            ]}
          />
          <button
            className={`miniButton favoriteFilterButton ${statusFilter === 'favorite' ? 'active' : ''}`}
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'favorite' ? 'all' : 'favorite')}
            title={statusFilter === 'favorite' ? t('free.favorite.showAll') : t('free.favorite.only')}
            aria-label={statusFilter === 'favorite' ? t('free.favorite.showAll') : t('free.favorite.only')}
          >
            <Star size={13} fill={statusFilter === 'favorite' ? 'currentColor' : 'none'} /> {t('free.favorite.button')}
          </button>
          <div className="segmentedControl compactSegment freeViewSwitch" aria-label={t('free.viewAria')}>
            <button className={viewMode === 'card' ? 'active' : ''} onClick={() => setViewMode('card')}>
              <Grid2X2 size={13} /> {t('free.view.card')}
            </button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>
              <Layers size={13} /> {t('free.view.list')}
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
                title={platformPrefs.status === 'favorite' ? t('free.platform.favoriteRemove') : t('free.platform.favoriteAdd')}
                aria-label={platformPrefs.status === 'favorite'
                  ? t('free.platform.favoriteRemoveNamed', { name: platform.name })
                  : t('free.platform.favoriteAddNamed', { name: platform.name })}
              >
                <Star size={15} fill={platformPrefs.status === 'favorite' ? 'currentColor' : 'none'} />
              </button>
            </div>

            <div className="freePlatformMeta">
              <span>{regionLabelMap[platform.region]}</span>
              <span>{kindLabelMap[platform.kind]}</span>
              <span>{loginLabelMap[platform.loginRequirement]}</span>
              <span>{platform.supportsImageToImage ? t('free.platform.supportsImageToImage') : t('free.platform.textToImageFirst')}</span>
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
                title={promptReady ? t('free.action.copyOpenTitleReady', { name: platform.name }) : t('free.action.openTitle', { name: platform.name })}
                aria-label={promptReady ? t('free.action.copyOpenTitleReady', { name: platform.name }) : t('free.action.openTitle', { name: platform.name })}
              >
                <ExternalLink size={13} /> {t('free.action.copyAndOpen')}
              </button>
              <button
                className="miniButton"
                onClick={() => startImportWebResult(platform)}
                title={t('free.action.importTitle', { name: platform.name })}
                aria-label={t('free.action.importTitle', { name: platform.name })}
              >
                <FolderOpen size={13} /> {t('free.action.importResult')}
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
                title={t('free.action.detailsTitle', { name: platform.name })}
                aria-label={t('free.action.detailsTitle', { name: platform.name })}
              >
                <Info size={13} /> {t('free.action.details')}
              </button>
            </div>
            {isListExpanded ? (
              <div className="freePlatformExpandedPanel">
                <div className="freePlatformDetails">
                  <small><strong>{t('free.detail.quota')}</strong>{platform.freeQuota}</small>
                  <small><strong>{t('free.detail.limit')}</strong>{platform.watermarkLimit}</small>
                  <small><strong>{t('free.detail.commercial')}</strong>{platform.commercialNote}</small>
                  <small><strong>{t('free.detail.prompt')}</strong>{platform.promptHint}</small>
                </div>
                <div className="freePlatformDetailControls">
                  <label>
                    {t('free.statusLabel')}
                    <StudioSelect
                      value={platformPrefs.status}
                      onChange={(value) => updatePlatformPrefs(platform.id, { status: value as FreePlatformUsageStatus })}
                      options={statusOptions}
                    />
                  </label>
                </div>
                <label>
                  {t('free.noteLabel')}
                  <textarea
                    value={platformPrefs.note}
                    onChange={(event) => updatePlatformPrefs(platform.id, { note: event.target.value.slice(0, 500) })}
                    placeholder={t('free.notePlaceholder', { name: platform.name })}
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
            <aside className="freePlatformDrawer" role="dialog" aria-modal="true" aria-label={t('free.detailAria', { name: platform.name })} onClick={(event) => event.stopPropagation()}>
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
                <button className="iconButton" onClick={() => setDetailPlatformId(null)} aria-label={t('free.closeDetails')} title={t('free.closeDetails')}>
                  <X size={16} />
                </button>
              </div>
              <div className="freePlatformMeta">
                <span>{regionLabelMap[platform.region]}</span>
                <span>{kindLabelMap[platform.kind]}</span>
                <span>{loginLabelMap[platform.loginRequirement]}</span>
                <span>{platform.supportsImageToImage ? t('free.platform.supportsImageToImage') : t('free.platform.textToImageFirst')}</span>
              </div>
              <p className="freePlatformDrawerSummary">{platform.bestFor}</p>
              <div className="freePlatformDetails">
                <small><strong>{t('free.detail.quota')}</strong>{platform.freeQuota}</small>
                <small><strong>{t('free.detail.limit')}</strong>{platform.watermarkLimit}</small>
                <small><strong>{t('free.detail.commercial')}</strong>{platform.commercialNote}</small>
                <small><strong>{t('free.detail.prompt')}</strong>{platform.promptHint}</small>
              </div>
              <label className="freePlatformDrawerField">
                <span>{t('free.statusLabel')}</span>
                <StudioSelect
                  value={platformPrefs.status}
                  onChange={(value) => updatePlatformPrefs(platform.id, { status: value as FreePlatformUsageStatus })}
                  options={statusOptions}
                />
              </label>
              <div className="freePlatformDrawerActions">
                <button className="miniButton primaryMini" onClick={() => props.onCopyPromptAndOpen(platform)}>
                  <ExternalLink size={13} /> {t('free.action.copyAndOpen')}
                </button>
                <button className="miniButton" disabled={!promptReady} onClick={() => props.onCopyPrompt(platform)}>
                  <Copy size={13} /> {t('free.action.copyOnly')}
                </button>
                <button className="miniButton" onClick={() => props.onOpenPlatform(platform)}>
                  <Globe2 size={13} /> {t('free.action.openOnly')}
                </button>
                <button className="miniButton" onClick={() => startImportWebResult(platform)}>
                  <FolderOpen size={13} /> {t('free.action.importResult')}
                </button>
              </div>
              <label className="freePlatformDrawerField">
                <span>{t('free.noteLabel')}</span>
                <textarea
                  value={platformPrefs.note}
                  onChange={(event) => updatePlatformPrefs(platform.id, { note: event.target.value.slice(0, 500) })}
                  placeholder={t('free.notePlaceholder', { name: platform.name })}
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
  const localizedMatrixColumns = providerMatrixColumns.map((column) => ({ ...column, label: providerMatrixColumnLabel(column.key) }));
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
  const profileFilterOptions = buildProviderProfileFilterOptions(props.providerProfiles);
  const filteredProviderProfiles = props.providerProfiles.filter((profile) => matchesProviderProfileFilter(profile, profileFilter));
  const visibleProviderProfiles = usesProviderProfiles ? filteredProviderProfiles : [];
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
  const imageToImageAdapterDiagnosticText = `${props.providerConfig.imageToImageAdapter === 'auto' ? pt('provider.i2i.autoPrefix', { adapter: pt(`provider.i2i.${resolvedImageToImageAdapter}.label`) }) : pt('provider.i2i.fixedPrefix', { adapter: pt(`provider.i2i.${resolvedImageToImageAdapter}.label`) })}；${pt(`provider.i2i.${resolvedImageToImageAdapter}.field`)}`;
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
          <p className="eyebrow">Platform Access</p>
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
                      <span>{protocolLabel(profile.protocol)}</span>
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
                  {providerServiceStatusLabel[props.selectedServiceTemplate.status]}
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
                  placeholder={defaultBaseUrlPlaceholder(props.selectedProviderId)}
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
                  placeholder={defaultEndpointPlaceholder(props.selectedProviderId)}
                />
                <small className="providerFieldHint">
                  {providerEndpointHint(props.selectedProviderId)}
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

function ComfyUIWorkflowSummaryPanel({ preset, t }: { preset: LocalComfyUIWorkflowPreset; t: Translator }) {
  const summary = preset.summary;
  const pt = (key: string, params?: Record<string, string | number>) => t(key as Parameters<Translator>[0], params);
  const groups: Array<{ label: string; nodes: LocalComfyUIWorkflowNode[] }> = [
    { label: pt('provider.workflow.prompt'), nodes: summary.promptNodes },
    { label: pt('provider.workflow.sampler'), nodes: summary.samplerNodes },
    { label: 'Checkpoint', nodes: summary.checkpointNodes },
    { label: pt('provider.workflow.size'), nodes: summary.sizeNodes },
    { label: pt('provider.workflow.output'), nodes: summary.outputNodes },
    { label: pt('provider.workflow.loader'), nodes: summary.loaderNodes }
  ].filter((group) => group.nodes.length > 0);

  return (
    <div className="localWorkflowSummary">
      <div className="localWorkflowMeta">
        <span>{workflowFormatLabel(summary.format)}</span>
        <span>{comfyUIWorkflowRunStatus(preset)}</span>
        <span>{pt('provider.local.nodes', { count: summary.nodeCount })}</span>
        <span>{pt('provider.workflow.links', { count: summary.linkCount ?? '-' })}</span>
      </div>
      <div className="localWorkflowFile">
        <strong>{preset.name}</strong>
        <small>{summary.fileName} · {preset.rawWorkflow ? pt('provider.workflow.rawSaved') : pt('provider.workflow.summaryOnly')}</small>
      </div>
      {summary.format === 'api' && !preset.rawWorkflow ? (
        <div className="localDiagnosticMessage failed">{pt('provider.workflow.legacyMissingRaw')}</div>
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
                {group.nodes.length > 4 ? <span className="localWorkflowMore">{pt('provider.workflow.moreNodes', { count: group.nodes.length - 4 })}</span> : null}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="localDiagnosticMessage failed">{pt('provider.workflow.noNodes')}</div>
      )}
    </div>
  );
}

function ComfyUIWorkflowManagerModal(props: {
  t: Translator;
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
                <button type="button" className="miniButton dangerMiniButton" onClick={() => props.onDelete(activePreset.id)} title={`删除工作流 ${activePreset.name}`} aria-label={`删除工作流 ${activePreset.name}`}>
                  <Trash2 size={14} /> 删除
                </button>
              </div>
              <ComfyUIWorkflowSummaryPanel preset={activePreset} t={props.t} />
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
  t: Translator;
  providers: ReturnType<typeof listProviders>;
  desktopRuntime: boolean;
  storageSettings: StorageSettings | null;
  systemTheme: 'dark' | 'light';
  promptPolishDraft: PromptPolishSettings;
  promptPolishSecretDraft: string;
  promptPolishSecretAvailable: boolean;
  isSavingPromptPolishSecret: boolean;
  isRefreshingPromptPolishModels: boolean;
  imageReverseDraft: ImagePromptReverseSettings;
  imageReverseSecretDraft: string;
  imageReverseSecretAvailable: boolean;
  isSavingImageReverseSecret: boolean;
  isRefreshingImageReverseModels: boolean;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  onPromptPolishDraftChange: (patch: Partial<PromptPolishSettings>) => void;
  onSavePromptPolishConfig: () => void;
  onRefreshPromptPolishModels: () => void;
  onPromptPolishSecretDraftChange: (value: string) => void;
  onSavePromptPolishSecret: () => void;
  onImageReverseDraftChange: (patch: Partial<ImagePromptReverseSettings>) => void;
  onSaveImageReverseConfig: () => void;
  onRefreshImageReverseModels: () => void;
  onImageReverseSecretDraftChange: (value: string) => void;
  onSaveImageReverseSecret: () => void;
  onSelectLibraryPath: () => void;
  onResetLibraryPath: () => void;
  onOpenLibraryDirectory: () => void;
  onSelectInspirationPath: () => void;
  onResetInspirationPath: () => void;
  onOpenInspirationDirectory: () => void;
  onOpenAppDataDirectory: () => void;
  onOpenBackupsDirectory: () => void;
  onExportSettingsBackup: () => void;
  onExportMigrationGuide: () => void;
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
  const imageReverse = props.imageReverseDraft;
  const promptPolishDefaultMode = resolvePolishMode(promptHistory.defaultPolishMode, promptPolish.engine);
  const promptPolishModeOptions = getPolishModesForEngine(promptPolish.engine);
  const defaultProvider = props.providers.find((provider) => provider.id === generationDefaults.defaultProviderId) ?? props.providers[0];
  const defaultModelOptions = defaultProvider.models.map((model) => ({ value: model.id, label: model.label || model.id }));
  const selectedDefaultModel = defaultModelOptions.some((option) => option.value === generationDefaults.defaultModelId)
    ? generationDefaults.defaultModelId
    : defaultModelOptions[0]?.value ?? generationDefaults.defaultModelId;
  const [developerMode, setDeveloperMode] = useState(false);
  const translatedStartupPageOptions = STARTUP_PAGE_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.startup.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedReferenceRoleOptions = DEFAULT_REFERENCE_ROLE_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.role.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedSizeOptions = DEFAULT_SIZE_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(
      ({
        '1024x1024': 'settings.size.square',
        '1280x720': 'settings.size.landscape',
        '720x1280': 'settings.size.portrait',
        '1024x1536': 'settings.size.poster',
        '1536x1024': 'settings.size.banner'
      } as Record<string, Parameters<Translator>[0]>)[option.value] ?? 'settings.size.square'
    )
  }));
  const translatedCountOptions = DEFAULT_COUNT_OPTIONS.map((option) => ({
    value: String(option.value),
    label: props.t('settings.countImages', { count: option.value })
  }));
  const translatedQualityOptions = DEFAULT_QUALITY_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.quality.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedPromptHistoryLimitOptions = PROMPT_HISTORY_LIMIT_OPTIONS.map((option) => ({
    value: String(option.value),
    label: props.t('settings.historyLimitItems', { count: option.value })
  }));
  const translatedPromptPolishModeOptions = promptPolishModeOptions.map((mode) => ({
    value: mode.id,
    label: props.t(`settings.polishMode.${mode.scope}.${mode.id}` as Parameters<Translator>[0])
  }));
  const translatedPromptPolishEngineOptions = PROMPT_POLISH_ENGINE_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.polishEngine.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedPromptPolishLanguageOptions = PROMPT_POLISH_LANGUAGE_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.polishLanguage.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedPromptPolishStrengthOptions = PROMPT_POLISH_STRENGTH_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.polishStrength.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedPromptPolishProtocolOptions = PROMPT_POLISH_PROTOCOL_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.polishProtocol.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedFileNamingRuleOptions = FILE_NAMING_RULE_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.fileNaming.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedRefreshIntervalOptions = REFRESH_INTERVAL_OPTIONS.map((option) => ({
    value: option.value,
    label: option.value < 60
      ? props.t('settings.refreshSeconds', { count: option.value })
      : props.t('settings.refreshMinutes', { count: option.value / 60 })
  }));
  const translatedImageReverseProtocolOptions = IMAGE_PROMPT_REVERSE_PROTOCOL_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.imageReverseProtocol.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedImageReverseDetailOptions = IMAGE_PROMPT_REVERSE_DETAIL_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.imageReverseDetail.${option.value}` as Parameters<Translator>[0])
  }));
  const translatedImageReverseLanguageOptions = IMAGE_PROMPT_REVERSE_LANGUAGE_OPTIONS.map((option) => ({
    value: option.value,
    label: props.t(`settings.imageReverseLanguage.${option.value}` as Parameters<Translator>[0])
  }));

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

  function updateImageReverse(patch: Partial<ImagePromptReverseSettings>, options?: { commit?: boolean }) {
    const nextImageReverse = { ...imageReverse, ...patch };
    props.onImageReverseDraftChange(patch);
    if (options?.commit) {
      props.onSettingsChange({ imagePromptReverse: nextImageReverse });
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
          <h1>{props.t('settings.title')}</h1>
          <span>{props.t('settings.subtitle')}</span>
        </div>
        <div className="settingsHeaderActions">
          <button type="button" data-tooltip={props.t('settings.systemInfo')} aria-label={props.t('settings.systemInfo')} onClick={props.onOpenSystemInfo}>
            <Info size={16} />
          </button>
          <button type="button" data-tooltip={props.t('settings.shortcuts')} aria-label={props.t('settings.shortcuts')} onClick={props.onOpenShortcuts}>
            <Keyboard size={16} />
          </button>
          <button type="button" data-tooltip={props.t('settings.checkUpdates')} aria-label={props.t('settings.checkUpdates')} onClick={props.onCheckUpdates}>
            <RefreshCcw size={16} />
          </button>
        </div>
      </header>

      <div className="settingsSectionLabel">{props.t('settings.appearance')}</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.theme')}</strong>
          </div>
          <div className="segmentedControl themeSegment">
            <button className={settings.themeMode === 'light' ? 'active' : ''} onClick={() => props.onSettingsChange({ themeMode: 'light' })}>
              <Sun size={14} /> {props.t('settings.themeLight')}
            </button>
            <button className={settings.themeMode === 'dark' ? 'active' : ''} onClick={() => props.onSettingsChange({ themeMode: 'dark' })}>
              <Moon size={14} /> {props.t('settings.themeDark')}
            </button>
            <button className={settings.themeMode === 'system' ? 'active' : ''} onClick={() => props.onSettingsChange({ themeMode: 'system' })}>
              <Monitor size={14} /> {props.t('settings.themeSystem')}
            </button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.language')}</strong>
            <small>{props.t('settings.languageHint')}</small>
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
            <strong>{props.t('settings.primaryColor')}</strong>
            <small>{props.t('settings.primaryColorHint')}</small>
          </div>
          <div className="colorDotRow">
            {PRIMARY_ACCENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`colorDot ${settings.primaryAccent === option.value ? 'active' : ''}`}
                style={{ background: option.value }}
                title={option.label}
                aria-label={`${props.t('settings.primaryColor')}: ${option.label}`}
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
            <strong>{props.t('settings.globalAccent')}</strong>
            <small>{props.t('settings.globalAccentHint')}</small>
          </div>
          <div className="colorDotRow">
            {GENERATOR_ACCENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`colorDot ${settings.generatorAccent === option.value ? 'active' : ''}`}
                style={{ background: option.value }}
                title={option.label}
                aria-label={`${props.t('settings.globalAccent')}: ${option.label}`}
                onClick={() => props.onSettingsChange({ generatorAccent: option.value })}
              />
            ))}
          </div>
        </div>
      </article>

      <div className="settingsSectionLabel">{props.t('settings.interfaceHome')}</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.startupPage')}</strong>
            <small>{props.t('settings.startupPageHint')}</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={settings.startupPage}
              onChange={(value) => props.onSettingsChange({ startupPage: value as AppPage })}
              options={translatedStartupPageOptions}
            />
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.sidebarDefault')}</strong>
            <small>{props.t('settings.sidebarDefaultHint')}</small>
          </div>
          <div className="segmentedControl compactSegment">
            <button className={!settings.sidebarCollapsed ? 'active' : ''} onClick={() => props.onSettingsChange({ sidebarCollapsed: false })}>
              {props.t('settings.sidebarExpanded')}
            </button>
            <button className={settings.sidebarCollapsed ? 'active' : ''} onClick={() => props.onSettingsChange({ sidebarCollapsed: true })}>
              {props.t('settings.sidebarCollapsed')}
            </button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.interfaceDensity')}</strong>
            <small>{props.t('settings.interfaceDensityHint')}</small>
          </div>
          <button
            className={settings.compactMode ? 'settingsTogglePill active' : 'settingsTogglePill'}
            type="button"
            onClick={() => props.onSettingsChange({ compactMode: !settings.compactMode })}
          >
            {settings.compactMode ? props.t('settings.compactMode') : props.t('settings.standardMode')}
          </button>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.homeModules')}</strong>
            <small>{props.t('settings.homeModulesHint')}</small>
          </div>
          <div className="settingsBooleanGrid homeModuleGrid">
            <button className={homeModules.resume ? 'active' : ''} onClick={() => updateHomeModules({ resume: !homeModules.resume })}>{props.t('settings.home.resume')}</button>
            <button className={homeModules.attention ? 'active' : ''} onClick={() => updateHomeModules({ attention: !homeModules.attention })}>{props.t('settings.home.attention')}</button>
            <button className={homeModules.materials ? 'active' : ''} onClick={() => updateHomeModules({ materials: !homeModules.materials })}>{props.t('settings.home.materials')}</button>
            <button className={homeModules.quickActions ? 'active' : ''} onClick={() => updateHomeModules({ quickActions: !homeModules.quickActions })}>{props.t('settings.home.quickActions')}</button>
            <button className={homeModules.roadmap ? 'active' : ''} onClick={() => updateHomeModules({ roadmap: !homeModules.roadmap })}>{props.t('settings.home.roadmap')}</button>
          </div>
        </div>
      </article>

      <div className="settingsSectionLabel">{props.t('settings.generationDefaults')}</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.defaultMode')}</strong>
            <small>{props.t('settings.defaultModeHint')}</small>
          </div>
          <div className="segmentedControl compactSegment">
            <button className={generationDefaults.defaultMode === 'text' ? 'active' : ''} onClick={() => updateGenerationDefaults({ defaultMode: 'text' })}>
              {props.t('settings.modeTextToImage')}
            </button>
            <button className={generationDefaults.defaultMode === 'image' ? 'active' : ''} onClick={() => updateGenerationDefaults({ defaultMode: 'image' })}>
              {props.t('settings.modeImageToImage')}
            </button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.defaultReferenceRole')}</strong>
            <small>{props.t('settings.defaultReferenceRoleHint')}</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={generationDefaults.defaultReferenceRole}
              onChange={(value) => updateGenerationDefaults({ defaultReferenceRole: value as GenerationDefaults['defaultReferenceRole'] })}
              options={translatedReferenceRoleOptions}
            />
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.defaultProviderModel')}</strong>
            <small>{props.t('settings.defaultProviderModelHint')}</small>
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
            <strong>{props.t('settings.defaultImageParams')}</strong>
            <small>{props.t('settings.defaultImageParamsHint')}</small>
          </div>
          <div className="settingsInlineGrid triple">
            <StudioSelect
              value={generationDefaults.defaultSize}
              onChange={(value) => updateGenerationDefaults({ defaultSize: value })}
              options={translatedSizeOptions}
            />
            <StudioSelect
              value={String(generationDefaults.defaultCount)}
              onChange={(value) => updateGenerationDefaults({ defaultCount: Number(value) })}
              options={translatedCountOptions}
            />
            <StudioSelect
              value={generationDefaults.defaultQuality}
              onChange={(value) => updateGenerationDefaults({ defaultQuality: value })}
              options={translatedQualityOptions}
            />
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.outputFormat')}</strong>
            <small>{props.t('settings.outputFormatHint')}</small>
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

      <div className="settingsSectionLabel">{props.t('settings.promptHistory')}</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.reuseHistoryPolicy')}</strong>
            <small>{props.t('settings.reuseHistoryPolicyHint')}</small>
          </div>
          <div className="settingsBooleanGrid">
            <button className={promptHistory.enabled ? 'active' : ''} onClick={() => updatePromptHistory({ enabled: !promptHistory.enabled })}>{props.t('settings.history.save')}</button>
            <button className={promptHistory.dedupe ? 'active' : ''} onClick={() => updatePromptHistory({ dedupe: !promptHistory.dedupe })}>{props.t('settings.history.dedupe')}</button>
            <button className={promptHistory.includeFailed ? 'active' : ''} onClick={() => updatePromptHistory({ includeFailed: !promptHistory.includeFailed })}>{props.t('settings.history.includeFailed')}</button>
            <button className={promptHistory.showThumbnails ? 'active' : ''} onClick={() => updatePromptHistory({ showThumbnails: !promptHistory.showThumbnails })}>{props.t('settings.history.thumbnails')}</button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.historyLimit')}</strong>
            <small>{props.t('settings.historyLimitHint')}</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={String(promptHistory.maxItems)}
              onChange={(value) => updatePromptHistory({ maxItems: Number(value) })}
              options={translatedPromptHistoryLimitOptions}
            />
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.defaultPolishMode')}</strong>
            <small>{props.t('settings.defaultPolishModeHint')}</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={promptPolishDefaultMode.id}
              onChange={(value) => updatePromptHistory({ defaultPolishMode: value })}
              options={translatedPromptPolishModeOptions}
            />
          </div>
        </div>

        <p className="settingsNotice compact">{props.t('settings.promptHistoryNotice')}</p>
      </article>

      <div className="settingsSectionLabel">{props.t('settings.promptTools')}</div>
      <article className="settingsGroupCard promptToolsGroup">
        <div className="promptToolsHero">
          <div>
            <strong>{props.t('settings.promptToolsTitle')}</strong>
            <small>{props.t('settings.promptToolsHint')}</small>
          </div>
          <div className="promptToolBadges" aria-label={props.t('settings.promptToolsCredentialsAria')}>
            <span>prompt-polish:default</span>
            <span>image-reverse:default</span>
          </div>
        </div>

        <section className="promptToolCard" aria-labelledby="prompt-polish-tool-title">
          <div className="promptToolCardHeader">
            <div>
              <strong id="prompt-polish-tool-title">{props.t('settings.promptPolishTitle')}</strong>
              <small>{props.t('settings.promptPolishHint')}</small>
            </div>
            <span>{props.t('settings.promptPolishChannel')}</span>
          </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.promptPolishEngine')}</strong>
            <small>{props.t('settings.promptPolishEngineHint')}</small>
          </div>
          <div className="settingsInlineGrid promptPolishEngineControls">
            <button
              className={promptPolish.fallbackToLocal ? 'settingsTogglePill active' : 'settingsTogglePill'}
              onClick={() => updatePromptPolish({ fallbackToLocal: !promptPolish.fallbackToLocal }, { commit: true })}
            >
              {props.t('settings.promptPolishFallback')}
            </button>
            <StudioSelect
              value={promptPolish.engine}
              onChange={(value) => updatePromptPolish({ engine: value as PromptPolishSettings['engine'] }, { commit: true })}
              options={translatedPromptPolishEngineOptions}
            />
          </div>
        </div>

        <div className="settingsConfigBlock">
          <div className="promptPolishConfigHeader">
            <div className="settingsRowMain promptPolishIntro">
              <strong>{props.t('settings.promptPolishProviderProfile')}</strong>
              <small>{props.t('settings.promptPolishProviderProfileHint')}</small>
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
                  {props.t('settings.presetAggregator')}
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
                  OpenAI {props.t('settings.official')}
                </button>
              </div>
              <div className="settingsStatusPills compact">
                <span className={promptPolish.baseUrl.trim() ? 'ready' : ''}>Base URL</span>
                <span className={promptPolish.modelId.trim() ? 'ready' : ''}>{props.t('settings.modelId')}</span>
                <span className={props.promptPolishSecretAvailable ? 'ready' : ''}>API Key</span>
              </div>
            </div>
          </div>
          <div className="settingsConfigGrid">
            <label>
              {props.t('settings.configName')}
              <input
                value={promptPolish.displayName}
                placeholder={props.t('settings.promptPolishConfigPlaceholder')}
                onChange={(event) => updatePromptPolish({ displayName: event.target.value })}
              />
            </label>
            <label>
              Base URL
              <input
                value={promptPolish.baseUrl}
                placeholder={props.t('settings.exampleBaseUrl')}
                onChange={(event) => updatePromptPolish({ baseUrl: event.target.value })}
              />
            </label>
            <label>
              {props.t('settings.modelSelectManual')}
              <div className="settingsModelSelectRow">
                <input
                  value={promptPolish.modelId}
                  list="prompt-polish-model-options"
                  placeholder={promptPolish.modelOptions.length > 0 ? props.t('settings.promptPolishModelPlaceholderWithOptions') : props.t('settings.promptPolishModelPlaceholderEmpty')}
                  onChange={(event) => updatePromptPolish({ modelId: event.target.value })}
                />
                <datalist id="prompt-polish-model-options">
                  {promptPolish.modelOptions.map((modelId) => <option key={modelId} value={modelId} />)}
                </datalist>
                <button type="button" onClick={props.onRefreshPromptPolishModels} disabled={props.isRefreshingPromptPolishModels}>
                  {props.isRefreshingPromptPolishModels ? props.t('settings.refreshing') : props.t('settings.refresh')}
                </button>
              </div>
              <small>{props.t('settings.refreshModelsHint')}</small>
            </label>
            <label>
              API Key
              <div className="settingsSecretInputRow">
                <input
                  type="password"
                  value={props.promptPolishSecretDraft}
                  placeholder={props.promptPolishSecretAvailable ? props.t('settings.secretSavedReplace') : props.t('settings.promptPolishSecretPlaceholder')}
                  onChange={(event) => props.onPromptPolishSecretDraftChange(event.target.value)}
                />
                <button type="button" onClick={props.onSavePromptPolishSecret} disabled={props.isSavingPromptPolishSecret}>
                  {props.isSavingPromptPolishSecret ? props.t('settings.saving') : props.t('settings.save')}
                </button>
              </div>
              <small>{props.promptPolishSecretAvailable ? props.t('settings.promptPolishSecretReady') : props.t('settings.promptPolishSecretMissing')}</small>
            </label>
            <details className="settingsAdvancedBox settingsWideField">
              <summary>
                <span>{props.t('settings.advancedHeaders')}</span>
                <small>{props.t('settings.keepDefaultObject')}</small>
              </summary>
              <p>{props.t('settings.promptPolishHeadersHint')} <code>{'{"X-Provider":"visionhub"}'}</code></p>
              <textarea
                rows={3}
                value={promptPolish.extraHeadersJson}
                placeholder='{"X-Provider": "visionhub"}'
                onChange={(event) => updatePromptPolish({ extraHeadersJson: event.target.value })}
              />
            </details>
            <div className="settingsConfigActions settingsWideField">
              <button type="button" className="rowActionButton" onClick={props.onSavePromptPolishConfig}>
                <ShieldCheck size={14} /> {props.t('settings.savePolishConfig')}
              </button>
              <small>{props.t('settings.saveConfigNoKeyHint')}</small>
            </div>
            <div className="promptPolishConfigInstances settingsWideField">
              <strong>{props.t('settings.savedConfigInstances')}</strong>
              {promptPolish.savedConfigs.length === 0 ? (
                <p>{props.t('settings.savedConfigInstancesEmpty')}</p>
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
                        <small>{config.modelId || props.t('settings.unsetModel')} · {config.baseUrl || props.t('settings.unsetBaseUrl')}</small>
                      </button>
                      <button type="button" className="promptPolishConfigDelete" data-tooltip={props.t('settings.deleteConfigInstance')} aria-label={props.t('settings.deleteConfigInstanceNamed', { name: config.displayName })} onClick={() => deletePromptPolishConfig(config.id)}>
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
            <strong>{props.t('settings.languageStrengthProtocol')}</strong>
            <small>{props.t('settings.languageStrengthProtocolHint')}</small>
          </div>
          <div className="settingsInlineGrid triple">
            <StudioSelect
              value={promptPolish.language}
              onChange={(value) => updatePromptPolish({ language: value as PromptPolishSettings['language'] })}
              options={translatedPromptPolishLanguageOptions}
            />
            <StudioSelect
              value={promptPolish.strength}
              onChange={(value) => updatePromptPolish({ strength: value as PromptPolishSettings['strength'] })}
              options={translatedPromptPolishStrengthOptions}
            />
            <StudioSelect
              value={promptPolish.protocol}
              onChange={(value) => updatePromptPolish({ protocol: value as PromptPolishSettings['protocol'] })}
              options={translatedPromptPolishProtocolOptions}
            />
          </div>
        </div>

        <p className="settingsNotice">{props.t('settings.promptPolishNotice')}</p>
        </section>

        <section className="promptToolCard" aria-labelledby="image-reverse-tool-title">
          <div className="promptToolCardHeader">
            <div>
              <strong id="image-reverse-tool-title">{props.t('settings.imageReverseTitle')}</strong>
              <small>{props.t('settings.imageReverseHint')}</small>
            </div>
            <span>{props.t('settings.imageReverseChannel')}</span>
          </div>

        <div className="settingsConfigBlock imageReverseConfigBlock">
          <div className="promptPolishConfigHeader">
            <div className="settingsRowMain promptPolishIntro">
              <strong>{props.t('settings.imageReverseProviderProfile')}</strong>
              <small>{props.t('settings.imageReverseProviderProfileHint')}</small>
            </div>
            <div className="promptPolishHeaderTools">
              <div className="settingsPresetRow">
                <button type="button" className={imageReverse.displayName === '\u805a\u5408\u7ad9\u56fe\u7247\u53cd\u63a8' ? 'active' : ''} onClick={() => updateImageReverse({ displayName: '\u805a\u5408\u7ad9\u56fe\u7247\u53cd\u63a8', baseUrl: '', modelId: '', modelOptions: [], protocol: 'chat-completions' })}>{props.t('settings.presetAggregator')}</button>
                <button type="button" className={imageReverse.displayName === 'OpenAI \u5b98\u65b9\u56fe\u7247\u53cd\u63a8' ? 'active' : ''} onClick={() => updateImageReverse({ displayName: 'OpenAI \u5b98\u65b9\u56fe\u7247\u53cd\u63a8', baseUrl: OFFICIAL_OPENAI_BASE_URL, modelId: '', modelOptions: [], protocol: 'responses' })}>OpenAI {props.t('settings.official')}</button>
                <button type="button" className={imageReverse.displayName === 'Gemini \u56fe\u7247\u53cd\u63a8' ? 'active' : ''} onClick={() => updateImageReverse({ displayName: 'Gemini \u56fe\u7247\u53cd\u63a8', baseUrl: 'https://generativelanguage.googleapis.com', modelId: '', modelOptions: [], protocol: 'gemini-generate-content' })}>Gemini</button>
              </div>
              <div className="settingsStatusPills compact">
                <span className={imageReverse.baseUrl.trim() ? 'ready' : ''}>Base URL</span>
                <span className={imageReverse.modelId.trim() ? 'ready' : ''}>{props.t('settings.modelId')}</span>
                <span className={props.imageReverseSecretAvailable ? 'ready' : ''}>API Key</span>
              </div>
            </div>
          </div>
          <div className="settingsConfigGrid">
            <label>
              {props.t('settings.configName')}
              <input value={imageReverse.displayName} placeholder={props.t('settings.imageReverseConfigPlaceholder')} onChange={(event) => updateImageReverse({ displayName: event.target.value })} />
            </label>
            <label>
              Base URL
              <input value={imageReverse.baseUrl} placeholder={props.t('settings.exampleBaseUrl')} onChange={(event) => updateImageReverse({ baseUrl: event.target.value })} />
            </label>
            <label>
              {props.t('settings.modelSelectManual')}
              <div className="settingsModelSelectRow">
                <input value={imageReverse.modelId} list="image-reverse-model-options" placeholder={imageReverse.modelOptions.length > 0 ? props.t('settings.imageReverseModelPlaceholderWithOptions') : props.t('settings.imageReverseModelPlaceholderEmpty')} onChange={(event) => updateImageReverse({ modelId: event.target.value })} />
                <datalist id="image-reverse-model-options">
                  {imageReverse.modelOptions.map((modelId) => <option key={modelId} value={modelId} />)}
                </datalist>
                <button type="button" onClick={props.onRefreshImageReverseModels} disabled={props.isRefreshingImageReverseModels}>{props.isRefreshingImageReverseModels ? props.t('settings.refreshing') : props.t('settings.refresh')}</button>
              </div>
              <small>{props.t('settings.imageReverseModelHint')}</small>
            </label>
            <label>
              API Key
              <div className="settingsSecretInputRow">
                <input type="password" value={props.imageReverseSecretDraft} placeholder={props.imageReverseSecretAvailable ? props.t('settings.secretSavedReplace') : props.t('settings.imageReverseSecretPlaceholder')} onChange={(event) => props.onImageReverseSecretDraftChange(event.target.value)} />
                <button type="button" onClick={props.onSaveImageReverseSecret} disabled={props.isSavingImageReverseSecret}>{props.isSavingImageReverseSecret ? props.t('settings.saving') : props.t('settings.save')}</button>
              </div>
              <small>{props.imageReverseSecretAvailable ? props.t('settings.imageReverseSecretReady') : props.t('settings.imageReverseSecretMissing')}</small>
            </label>
            <div className="settingsListRow settingsTallRow settingsWideField embeddedSettingsRow">
              <div className="settingsRowMain">
                <strong>{props.t('settings.imageReverseProtocolLanguageDetail')}</strong>
                <small>{props.t('settings.imageReverseProtocolLanguageDetailHint')}</small>
              </div>
              <div className="settingsInlineGrid triple">
                <StudioSelect value={imageReverse.protocol} onChange={(value) => updateImageReverse({ protocol: value as ImagePromptReverseSettings['protocol'] })} options={translatedImageReverseProtocolOptions} />
                <StudioSelect value={imageReverse.detail} onChange={(value) => updateImageReverse({ detail: value as ImagePromptReverseSettings['detail'] })} options={translatedImageReverseDetailOptions} />
                <StudioSelect value={imageReverse.language} onChange={(value) => updateImageReverse({ language: value as ImagePromptReverseSettings['language'] })} options={translatedImageReverseLanguageOptions} />
              </div>
            </div>
            <details className="settingsAdvancedBox settingsWideField">
              <summary><span>{props.t('settings.advancedHeaders')}</span><small>{props.t('settings.keepDefaultObject')}</small></summary>
              <p>{props.t('settings.imageReverseHeadersHint')}</p>
              <textarea rows={3} value={imageReverse.extraHeadersJson} placeholder='{"X-Provider": "visionhub"}' onChange={(event) => updateImageReverse({ extraHeadersJson: event.target.value })} />
            </details>
            <div className="settingsConfigActions settingsWideField">
              <button type="button" className="rowActionButton" onClick={props.onSaveImageReverseConfig}><ShieldCheck size={14} /> {props.t('settings.saveImageReverseConfig')}</button>
              <small>{props.t('settings.saveConfigNoKeyHint')}</small>
            </div>
          </div>
        </div>

        <p className="settingsNotice">{props.t('settings.imageReverseNotice')}</p>
        </section>
      </article>

      <div className="settingsSectionLabel">{props.t('settings.savePreferences')}</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.fileNamingRule')}</strong>
            <small>{props.t('settings.fileNamingRuleHint')}</small>
          </div>
          <div className="settingsControlSlim">
            <StudioSelect
              value={savePreferences.fileNamingRule}
              onChange={(value) => updateSavePreferences({ fileNamingRule: value as AppSettings['savePreferences']['fileNamingRule'] })}
              options={translatedFileNamingRuleOptions}
            />
          </div>
        </div>
        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.groupingPolicy')}</strong>
            <small>{props.t('settings.groupingPolicyHint')}</small>
          </div>
          <div className="settingsBooleanGrid compactTwo">
            <button className={savePreferences.groupByDate ? 'active' : ''} onClick={() => updateSavePreferences({ groupByDate: !savePreferences.groupByDate })}>{props.t('settings.groupByDate')}</button>
            <button className={savePreferences.groupByProject ? 'active' : ''} onClick={() => updateSavePreferences({ groupByProject: !savePreferences.groupByProject })}>{props.t('settings.groupByProject')}</button>
          </div>
        </div>
      </article>

      <div className="settingsSectionLabel">{props.t('settings.dataCache')}</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.refreshRate')}</strong>
            <small>{props.t('settings.refreshRateHint')}</small>
          </div>
          <div className="segmentedControl compactSegment">
            {REFRESH_INTERVAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={settings.refreshIntervalSeconds === option.value ? 'active' : ''}
                onClick={() => props.onSettingsChange({ refreshIntervalSeconds: option.value })}
              >
                {translatedRefreshIntervalOptions.find((item) => item.value === option.value)?.label ?? option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.libraryDirectory')}</strong>
            <small>
              {props.storageSettings
                ? props.t('settings.currentPath', { path: props.storageSettings.resolved_library_dir })
                : props.desktopRuntime
                  ? props.t('settings.loadingLibraryPath')
                  : props.t('settings.desktopCustomLibraryPath')}
            </small>
            {props.storageSettings ? (
              <small className="settingsPathMeta">
                {props.t('settings.defaultPath', { path: props.storageSettings.default_library_dir })}
              </small>
            ) : null}
          </div>
          <div className="settingsPathActions">
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onSelectLibraryPath}>
              <FolderOpen size={15} /> {props.t('settings.selectPath')}
            </button>
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onOpenLibraryDirectory}>
              <HardDrive size={15} /> {props.t('settings.open')}
            </button>
            <button className="rowActionButton subtle" disabled={!props.desktopRuntime} onClick={props.onResetLibraryPath}>
              <RefreshCcw size={15} /> {props.t('settings.defaultDirectory')}
            </button>
          </div>
        </div>

        <div className="settingsListRow settingsTallRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.inspirationDirectory')}</strong>
            <small>
              {props.storageSettings
                ? props.t('settings.currentPath', { path: props.storageSettings.resolved_inspiration_dir })
                : props.desktopRuntime
                  ? props.t('settings.loadingInspirationPath')
                  : props.t('settings.desktopCustomInspirationPath')}
            </small>
            {props.storageSettings ? (
              <small className="settingsPathMeta">
                {props.t('settings.defaultPath', { path: props.storageSettings.default_inspiration_dir })}
              </small>
            ) : null}
          </div>
          <div className="settingsPathActions">
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onSelectInspirationPath}>
              <FolderOpen size={15} /> {props.t('settings.selectPath')}
            </button>
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onOpenInspirationDirectory}>
              <HardDrive size={15} /> {props.t('settings.open')}
            </button>
            <button className="rowActionButton subtle" disabled={!props.desktopRuntime} onClick={props.onResetInspirationPath}>
              <RefreshCcw size={15} /> {props.t('settings.defaultDirectory')}
            </button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.appDataDirectory')}</strong>
            <small>{props.t('settings.appDataDirectoryHint')}</small>
          </div>
          <div className="settingsPathActions">
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onOpenAppDataDirectory}>
              <FolderOpen size={15} /> {props.t('settings.openDataDirectory')}
            </button>
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onOpenBackupsDirectory}>
              <HardDrive size={15} /> {props.t('settings.openBackupsDirectory')}
            </button>
          </div>
        </div>

        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.backupMigration')}</strong>
            <small>{props.t('settings.backupMigrationHint')}</small>
          </div>
          <div className="settingsPathActions">
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onExportSettingsBackup}>
              <Download size={15} /> {props.t('settings.exportSettings')}
            </button>
            <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onExportMigrationGuide}>
              <ClipboardPaste size={15} /> {props.t('settings.exportMigrationGuide')}
            </button>
          </div>
        </div>
      </article>

      <div className="settingsSectionLabel">{props.t('settings.softwareUpdate')}</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow versionSettingsRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.version')}</strong>
          </div>
          <span className="settingsValue">{APP_VERSION}</span>
        </div>
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.softwareUpdate')}</strong>
            <small>{props.t('settings.softwareUpdateHint')}</small>
          </div>
          <button className="rowActionButton" type="button" onClick={props.onCheckUpdates}>
            <RefreshCcw size={15} /> {props.t('settings.checkUpdates')}
          </button>
        </div>
        <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.developerMode')}</strong>
            <small>{props.t('settings.developerModeHint')}</small>
          </div>
          <button
            className={developerMode ? 'settingsTogglePill active' : 'settingsTogglePill'}
            type="button"
            onClick={() => setDeveloperMode((current) => !current)}
          >
            {developerMode ? props.t('settings.enabled') : props.t('settings.disabled')}
          </button>
        </div>
        {developerMode ? <div className="settingsListRow">
          <div className="settingsRowMain">
            <strong>{props.t('settings.techStack')}</strong>
            <small>{props.t('settings.techStackHint')}</small>
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
  t: Translator;
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
        t={props.t}
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
          t={props.t}
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
  t: Translator;
  isActive: boolean;
  preview: ImagePreviewState | null;
  onPreview: (imageUrl: string, navigation?: ImagePreviewNavigation) => void;
  onNavigatePreview: (item: ImagePreviewNavigationItem) => void;
  onClosePreview: () => void;
  onUseAsReference: (asset: InspirationAsset) => void;
  onUsePrompt: (prompt: string) => void;
  onCreateTemplate: (title: string, prompt: string, tags: string[]) => string;
  onRequestConfirm: (request: ConfirmDialogRequest) => void;
  imagePromptReverse: ImagePromptReverseSettings;
  imagePromptReverseSecretAvailable: boolean;
  onOpenSettings: () => void;
  importVersion: number;
}) {
  return (
    <section
      className={`workspacePage cachedInspirationPage ${props.isActive ? 'active' : 'inactive'}`}
      aria-hidden={!props.isActive}
    >
      <InspirationPage
        t={props.t}
        onPreview={props.onPreview}
        onUseAsReference={props.onUseAsReference}
        onUsePrompt={props.onUsePrompt}
        onCreateTemplate={props.onCreateTemplate}
        onRequestConfirm={props.onRequestConfirm}
        imagePromptReverse={props.imagePromptReverse}
        imagePromptReverseSecretAvailable={props.imagePromptReverseSecretAvailable}
        onOpenSettings={props.onOpenSettings}
        importVersion={props.importVersion}
      />
      {props.isActive && props.preview ? (
        <ImagePreviewModal
          t={props.t}
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
  t: Translator;
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
  const ct = (key: string, params?: Record<string, string | number>) => props.t(key as Parameters<Translator>[0], params);
  const imageUrl = props.record.imageUrls[0];
  const modeLabel = ct(`library.modeBadge.${(props.record.generationMode ?? 'text-to-image') === 'image-to-image' ? 'image-to-image' : 'text-to-image'}`);
  const referenceCount = props.record.referenceImages?.length ?? 0;
  const referenceSummary = summarizeReferenceSources(props.record.referenceImages);
  const isFavorite = Boolean(props.meta?.favorite);
  const statusLabel = isPotentialBackgroundCompletion(props.record)
    ? ct('library.generationStatus.pendingRecovery')
    : ct(`library.generationStatus.${props.record.status}`);

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
        aria-label={props.isSelected ? ct('library.action.unselectImage') : ct('library.action.selectImage')}
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
          <span><Maximize2 size={15} /> {ct('library.action.preview')}</span>
        </button>
      ) : (
        <div className="libraryFailedThumb">{ct('library.action.failedThumb')}</div>
      )}
      <div className="libraryImageOverlay">
        <button className={`iconMiniButton favoriteButton ${isFavorite ? 'active' : ''}`} type="button" data-tooltip={isFavorite ? ct('library.action.removeFavorite') : ct('library.action.favorite')} aria-label={isFavorite ? ct('library.action.removeFavorite') : ct('library.action.favorite')} onClick={() => props.onToggleFavorite(props.record.id)}>
          <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        <div className="libraryMoreMenuWrap">
          <button className="iconMiniButton" type="button" data-tooltip={ct('library.action.more')} aria-label={ct('library.action.more')}>
            <MoreHorizontal size={15} />
          </button>
          <div className="libraryQuickMenu" aria-label={ct('library.context.imageActions')}>
            <button type="button" onClick={() => props.onOpenDetails(props.record)}><Info size={13} /> {ct('library.detail.title')}</button>
            {props.record.error || props.record.status === 'failed' ? (
              <button type="button" onClick={() => props.onOpenDiagnostics(props.record)}><Gauge size={13} /> {ct('library.action.viewDiagnostics')}</button>
            ) : null}
            <button type="button" disabled={!imageUrl} onClick={() => props.onUseAsReference(props.record)}><ImagePlus size={13} /> {ct('library.action.setReference')}</button>
            <button type="button" onClick={() => props.onCopyPrompt(props.record)}><Copy size={13} /> {ct('library.action.copyPrompt')}</button>
            <button type="button" disabled={!getRecordPrimaryPath(props.record)} onClick={() => props.onCopyPath(props.record)}><Copy size={13} /> {ct('library.action.copyPath')}</button>
            <button type="button" onClick={() => props.onExportRecord(props.record)}><Download size={13} /> {ct('library.action.exportList')}</button>
            <span className="libraryMenuDivider" />
            <button type="button" onClick={() => props.onToggleFavorite(props.record.id)}><Star size={13} /> {isFavorite ? ct('library.action.removeFavorite') : ct('library.action.addFavorite')}</button>
            <button type="button" onClick={() => props.onAssignFolder(props.record.id)}><FolderOpen size={13} /> {ct('library.action.moveFolder')}</button>
            <button type="button" onClick={() => props.onAssignCollection(props.record.id)}><Bookmark size={13} /> {ct('library.action.addCollection')}</button>
            {props.isCurrentScopeRemovable ? (
              <button type="button" onClick={() => props.onRemoveFromCurrentScope(props.record.id)}><X size={13} /> {ct('library.action.removeCurrentScope')}</button>
            ) : null}
            <span className="libraryMenuDivider" />
            <button className="dangerAction" type="button" onClick={() => props.onDelete(props.record.id)}><Trash2 size={13} /> {ct('library.action.deleteRecord')}</button>
          </div>
        </div>
      </div>
      <div className="libraryCardBody">
        <div className="resultTitleRow">
          <strong>{props.displaySettings.showProvider ? props.providerName : formatTime(props.record.createdAt)}</strong>
          <div className="cardTopActions">
            <span className="statusBadge modeBadge">{modeLabel}</span>
            {props.displaySettings.showReferenceBadge && referenceCount > 0 ? <span className="statusBadge referenceBadge" title={ct('library.reference.title', { summary: referenceSummary })}>{ct('library.reference.badge', { count: referenceCount })}</span> : null}
            <span className={`statusBadge ${generationStatusClass(props.record)}`}>{statusLabel}</span>
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
  t: Translator;
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
  const lt = (key: string, params?: Record<string, string | number>) => props.t(key as Parameters<Translator>[0], params);
  const libraryColorLabel = (color: LibraryColorFilter) => lt(`library.color.${color}`);
  const libraryGenerationStatusLabel = (record: Pick<GenerationRecord, 'status' | 'error' | 'raw'>) => (
    isPotentialBackgroundCompletion(record)
      ? lt('library.generationStatus.pendingRecovery')
      : lt(`library.generationStatus.${record.status}`)
  );
  const libraryGenerationModeLabel = (mode: GenerationRecord['generationMode']) => lt(`library.modeBadge.${mode === 'image-to-image' ? 'image-to-image' : 'text-to-image'}`);
  const libraryReferenceSourceLabel = (source: ReferenceImage['source']) => lt(`library.referenceSource.${source}`);
  const libraryReferenceRoleLabel = (role?: ReferenceImage['role']) => lt(`library.referenceRole.${role ?? 'auto'}`);
  const libraryFailureCategoryLabel = (category: GenerationFailureCategory) => lt(`library.failureCategory.${category}`);
  const libraryFailureSeverityLabel = (severity: GenerationFailureSeverity) => lt(`library.failureSeverity.${severity}`);
  const libraryRecoveryAdviceText = (advice: LibraryRecoveryAdvice) => ({
    title: lt(`library.recovery.${advice.key}.title`),
    summary: lt(`library.recovery.${advice.key}.summary`),
    actions: [1, 2, 3].map((index) => lt(`library.recovery.${advice.key}.action${index}`))
  });
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'succeeded' | 'failed'>(() => {
    const status = readUrlSearchParam('status');
    return status === 'all' || status === 'succeeded' || status === 'failed' ? status : 'succeeded';
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
        if (!cancelled) setCopyMessage(lt('library.message.metadataSyncFailed'));
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
      { value: 'all', label: lt('library.filter.providerAll') },
      ...props.providers.map((provider) => ({ value: provider.id, label: providerGenerationLabel(provider) }))
    ],
    [props.providers, props.t]
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
    { value: 'succeeded', label: lt('library.status.succeeded') },
    { value: 'failed', label: lt('library.status.failed') },
    { value: 'all', label: lt('library.status.all') }
  ];
  const modeOptions = [
    { value: 'all', label: lt('library.mode.all') },
    { value: 'text-to-image', label: lt('library.mode.text-to-image') },
    { value: 'image-to-image', label: lt('library.mode.image-to-image') },
    { value: 'with-references', label: lt('library.mode.with-references') }
  ];
  const timeOptions = [
    { value: 'all', label: lt('library.time.all') },
    { value: 'today', label: lt('library.time.today') },
    { value: '7d', label: lt('library.time.7d') },
    { value: '30d', label: lt('library.time.30d') }
  ];
  const translatedLibraryQuickFilters = libraryQuickFilters.map((filter) => ({ ...filter, label: lt(`library.quick.${filter.value}`) }));
  const translatedLibraryViewOptions = libraryViewOptions.map((option) => ({ ...option, label: lt(`library.view.${option.value}`) }));
  const translatedLibrarySortOptions = librarySortOptions.map((option) => ({ ...option, label: lt(`library.sort.${option.value}`) }));
  const translatedLibraryShapeOptions = libraryShapeOptions.map((option) => ({ ...option, label: lt(`library.shape.${option.value}`) }));
  const translatedLibraryFormatOptions = libraryFormatOptions.map((option) => ({ ...option, label: lt(`library.format.${option.value}`) }));
  const translatedLibraryRatingOptions = libraryRatingOptions.map((option) => ({ ...option, label: lt(`library.rating.${option.value}`) }));
  const translatedLibraryColorOptions = libraryColorOptions.map((option) => ({ ...option, label: libraryColorLabel(option.value) }));
  const translatedLibraryAddActions = libraryAddActions.map((action) => ({ ...action, label: lt(`library.add.${action.id}`), detail: lt(`library.add.${action.id}Detail`) }));
  const filteredItems = useMemo(() => sortLibraryRecords(libraryItems.filter((result) => {
    const providerName = providerNameMap.get(result.providerId) ?? result.providerName ?? result.providerId;
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
      (libraryScope.type === 'recent-viewed' && Boolean(meta?.lastViewedAt)) ||
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
          meta?.favorite ? lt('library.searchTokens.favorite') : '',
          ...(meta?.colorFamilies?.map((family) => libraryColorLabel(family)) ?? []),
          ...(meta?.tags ?? [])
        ].join(' ').toLowerCase();
        if (!customText.includes(customQuery)) return false;
      }
      if (criteria.providerFilter && criteria.providerFilter !== 'all' && result.providerId !== criteria.providerFilter) return false;
      if (criteria.statusFilter && criteria.statusFilter !== 'all' && result.status !== criteria.statusFilter) return false;
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
    const statusText = libraryGenerationStatusLabel(result);
    const modeSearchText = generationMode === 'image-to-image' ? `${lt('library.modeBadge.image-to-image')} image-to-image img2img` : `${lt('library.modeBadge.text-to-image')} text-to-image txt2img`;
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
      meta?.favorite ? lt('library.searchTokens.favorite') : '',
      ...(meta?.colorFamilies?.map((family) => libraryColorLabel(family)) ?? []),
      result.localImagePaths?.[0] ? lt('library.searchTokens.local') : '',
      result.referenceImages?.length ? lt('library.searchTokens.reference') : '',
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
  const diagnosticRecordRecoveryAdviceText = diagnosticRecordRecoveryAdvice ? libraryRecoveryAdviceText(diagnosticRecordRecoveryAdvice) : null;
  const selectedRecordRecoveryAdviceText = selectedRecordRecoveryAdvice ? libraryRecoveryAdviceText(selectedRecordRecoveryAdvice) : null;
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
  const { folderCounts, collectionCounts, favoriteScopeCount, recentScopeCount, recentViewedScopeCount, localScopeCount } = useMemo(() => {
    const nextFolderCounts = new Map<string, number>();
    const nextCollectionCounts = new Map<string, number>();
    let favorite = 0;
    let recent = 0;
    let recentViewed = 0;
    let local = 0;
    libraryItems.forEach((record) => {
      const meta = libraryMeta[record.id];
      if (meta?.folderId) nextFolderCounts.set(meta.folderId, (nextFolderCounts.get(meta.folderId) ?? 0) + 1);
      meta?.collectionIds?.forEach((collectionId) => {
        nextCollectionCounts.set(collectionId, (nextCollectionCounts.get(collectionId) ?? 0) + 1);
      });
      if (meta?.favorite) favorite += 1;
      if (getRecordTimeMs(record.createdAt) >= nowMs - 7 * 24 * 60 * 60 * 1000) recent += 1;
      if (meta?.lastViewedAt) recentViewed += 1;
      if (record.localImagePaths?.[0]) local += 1;
    });
    return {
      folderCounts: nextFolderCounts,
      collectionCounts: nextCollectionCounts,
      favoriteScopeCount: favorite,
      recentScopeCount: recent,
      recentViewedScopeCount: recentViewed,
      localScopeCount: local
    };
  }, [libraryItems, libraryMeta, nowMs]);
  const selectedScopeTitle =
    libraryScope.type === 'all' ? lt('library.organizer.all')
      : libraryScope.type === 'favorites' ? lt('library.organizer.favorites')
      : libraryScope.type === 'recent7d' ? lt('library.organizer.recent7d')
      : libraryScope.type === 'recent-viewed' ? lt('library.organizer.recentViewed')
      : libraryScope.type === 'local' ? lt('library.organizer.local')
      : libraryScope.type === 'folder' ? libraryOrganization.folders.find((folder) => folder.id === libraryScope.id)?.name ?? lt('library.organizer.folders')
      : libraryOrganization.collections.find((collection) => collection.id === libraryScope.id)?.name ?? lt('library.organizer.collections');

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
      setCopyMessage(lt('library.message.copied', { label }));
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
    setCopyMessage(isFavorite ? lt('library.message.favoriteRemoved') : lt('library.message.favoriteAdded'));
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
    setCopyMessage(favorite ? lt('library.message.batchFavoriteAdded', { count: uniqueIds.length }) : lt('library.message.batchFavoriteRemoved', { count: uniqueIds.length }));
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
    updateLibraryMeta(record.id, { lastViewedAt: new Date().toISOString() });
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
        label: getRecordFileName(item) || item.prompt || lt('library.title')
      }));
    return items.length > 1 ? { items, currentId: record.id } : undefined;
  }

  function previewRecord(record: GenerationRecord, imageUrl?: string) {
    if (!imageUrl) return;
    updateLibraryMeta(record.id, { lastViewedAt: new Date().toISOString() });
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
      title: lt('library.confirm.deleteRecordTitle'),
      message: lt('library.confirm.deleteRecordMessage'),
      confirmLabel: lt('library.confirm.delete'),
      tone: 'danger',
      onConfirm: async () => {
        try {
          await props.onDelete(recordId);
          setSelectedRecordId((current) => (current === recordId ? null : current));
          setDiagnosticRecordId((current) => (current === recordId ? null : current));
          setSelectedRecordIds((current) => current.filter((item) => item !== recordId));
          setCopyMessage(lt('library.message.deleteRecordSuccess'));
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
      title: lt('library.confirm.deleteRecordsTitle'),
      message: lt('library.confirm.deleteRecordsMessage', { count: uniqueIds.length }),
      confirmLabel: lt('library.confirm.delete'),
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
          setCopyMessage(lt('library.message.deleteRecordsSuccess', { count: uniqueIds.length }));
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
      setCopyMessage(lt('library.message.noPaths'));
      setContextMenu(null);
      return;
    }
    await copyText(paths.length > 1 ? 'Paths' : 'Path', paths.join('\n'));
    setContextMenu(null);
  }

  function buildLibraryRecordList(records: GenerationRecord[]) {
    const exportedAt = new Date().toLocaleString();
    return [
      lt('library.export.title'),
      '',
      lt('library.export.time', { time: exportedAt }),
      lt('library.export.count', { count: records.length }),
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
          lt('library.export.status', { status: libraryGenerationStatusLabel(record) }),
          lt('library.export.provider', { provider: providerName }),
          lt('library.export.model', { model: record.modelId || '-' }),
          lt('library.export.type', { type: libraryGenerationModeLabel(record.generationMode) }),
          lt('library.export.created', { time: formatTime(record.createdAt) }),
          lt('library.export.path', { path: primaryPath }),
          lt('library.export.favorite', { value: meta?.favorite ? lt('library.export.yes') : lt('library.export.no') }),
          lt('library.export.size', { size: getRecordSizeLabel(record, meta) }),
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
          setCopyMessage(lt('library.message.exportCancelled'));
          return;
        }
        setCopyMessage(result.path ? lt('library.message.exportedPath', { path: result.path }) : lt('library.message.exportedCount', { count: records.length }));
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
        setCopyMessage(lt('library.message.exportedCount', { count: records.length }));
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
      setCopyMessage(updated.status === 'succeeded' ? lt('library.message.backgroundRecovered') : lt('library.message.backgroundRechecked'));
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
        ? `${lt('library.dialog.newFolder')} ${libraryOrganization.folders.length + 1}`
        : `${lt('library.dialog.newCollection')} ${libraryOrganization.collections.length + 1}`
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
    setCopyMessage(selectedRecordIds.length ? lt('library.message.createdFolderAssigned', { count: selectedRecordIds.length }) : lt('library.message.createdFolder', { name }));
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
    setCopyMessage(selectedRecordIds.length ? lt('library.message.createdCollectionAssigned', { count: selectedRecordIds.length }) : lt('library.message.createdCollection', { name }));
  }

  function deleteLibraryFolder(folder: LibraryFolder) {
    props.onRequestConfirm({
      title: lt('library.confirm.deleteFolderTitle'),
      message: lt('library.confirm.deleteFolderMessage', { name: folder.name }),
      confirmLabel: lt('library.confirm.delete'),
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
        setCopyMessage(lt('library.message.deletedFolder', { name: folder.name }));
      }
    });
  }

  function deleteLibraryCollection(collection: LibraryCollection) {
    props.onRequestConfirm({
      title: lt('library.confirm.deleteCollectionTitle'),
      message: lt('library.confirm.deleteCollectionMessage', { name: collection.name }),
      confirmLabel: lt('library.confirm.delete'),
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
        setCopyMessage(lt('library.message.deletedCollection', { name: collection.name }));
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
    setCopyMessage(lt('library.message.renamed', { name }));
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
    setCopyMessage(lt('library.message.movedToFolder', { count: recordIds.length }));
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
    setCopyMessage(lt('library.message.addedToCollection', { count: recordIds.length }));
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
    setCopyMessage(lt('library.message.removedFromScope', { count: recordIds.length }));
  }

  async function importLibraryFiles() {
    try {
      const result = await importLibraryImagesFromFiles();
      const records = result.records;
      records.forEach(props.onAddResult);
      attachImportedRecordsToCurrentScope(records);
      setCopyMessage(importLibrarySummary(lt('library.message.importFiles'), records.length, result.skippedDuplicates, result.skippedUnsupported));
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
      setCopyMessage(importLibrarySummary(lt('library.message.importFolder'), records.length, result.skippedDuplicates, result.skippedUnsupported));
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function importLibrarySummary(label: string, imported: number, skippedDuplicates: number, skippedUnsupported: number) {
    if (!imported && !skippedDuplicates && !skippedUnsupported) return lt('library.message.noImport');
    const parts = [lt('library.message.importSummary', { label, count: imported })];
    if (skippedDuplicates) parts.push(lt('library.message.skippedDuplicates', { count: skippedDuplicates }));
    if (skippedUnsupported) parts.push(lt('library.message.skippedUnsupported', { count: skippedUnsupported }));
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
    setStatusFilter('succeeded');
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
    if (filter === 'failed') {
      setStatusFilter((current) => (current === 'failed' ? 'succeeded' : 'failed'));
      return;
    }
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
      criteria.statusFilter !== 'succeeded' ||
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
      setCopyMessage(lt('library.message.needFilter'));
      return;
    }
    const label = quickFilterName.trim() || lt('library.quick.placeholder', { count: customQuickFilters.length + 1 });
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
    setCopyMessage(lt('library.message.addedQuickFilter', { name: label }));
  }

  function deleteCustomQuickFilter(filterId: string) {
    const next = customQuickFilters.filter((filter) => filter.id !== filterId);
    setCustomQuickFilters(next);
    saveLibraryCustomQuickFilters(next);
    setActiveCustomQuickFilterIds((current) => current.filter((id) => id !== filterId));
    setCopyMessage(lt('library.message.deletedQuickFilter'));
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
    statusFilter !== 'succeeded',
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
          <h1>{lt('library.title')}</h1>
          <p>{lt('library.subtitle')}</p>
        </div>
        <div className="statusPills">
          <span><Image size={15} /> {props.isHistoryLoaded ? lt('library.stats.success', { count: successCount }) : lt('library.loading')}</span>
          <span><HardDrive size={15} /> {lt('library.stats.local', { count: localPathCount })}</span>
          <span><Info size={15} /> {lt('library.stats.failed', { count: failedCount })}</span>
        </div>
      </header>

      {filtersVisible ? (
        <section className="libraryInlineFilters" aria-label={lt('library.filter.aria')}>
          <div className="libraryStructuredFilters">
            <label><span>{lt('library.filter.provider')}</span><StudioSelect className="libraryFilterSelect filterIconPlatform" leadingIcon={<Globe2 size={15} />} value={providerFilter} onChange={setProviderFilter} options={providerOptions} /></label>
            <label><span>{lt('library.filter.status')}</span><StudioSelect className="libraryFilterSelect filterIconStatus" leadingIcon={<Info size={15} />} value={statusFilter} onChange={(value) => setStatusFilter(value as 'all' | 'succeeded' | 'failed')} options={statusOptions} /></label>
            <label><span>{lt('library.filter.type')}</span><StudioSelect className="libraryFilterSelect filterIconType" leadingIcon={<Image size={15} />} value={modeFilter} onChange={(value) => setModeFilter(value as typeof modeFilter)} options={modeOptions} /></label>
            <label><span>{lt('library.filter.time')}</span><StudioSelect className="libraryFilterSelect filterIconTime" leadingIcon={<Clock3 size={15} />} value={timeFilter} onChange={(value) => setTimeFilter(value as LibraryTimeFilter)} options={timeOptions} /></label>
            <label className="libraryColorFilter" ref={colorFilterRef}>
              <span>{lt('library.filter.color')}</span>
              <button
                className={`libraryColorFilterButton ${colorMenuOpen ? 'active' : ''}`}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={colorMenuOpen}
                onClick={() => setColorMenuOpen((value) => !value)}
              >
                <span className="libraryColorWheel" />
                <span>{libraryColorLabel(colorFilter) || lt('library.filter.color')}</span>
              </button>
              {colorMenuOpen ? (
                <div className="libraryColorFilterMenu" role="listbox" aria-label={lt('library.filter.colorAria')}>
                  {translatedLibraryColorOptions.map((option) => (
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
            <label><span>{lt('library.filter.shape')}</span><StudioSelect className="libraryFilterSelect filterIconShape" leadingIcon={<Grid2X2 size={15} />} value={shapeFilter} onChange={(value) => setShapeFilter(value as LibraryShapeFilter)} options={translatedLibraryShapeOptions} /></label>
            <label><span>{lt('library.filter.format')}</span><StudioSelect className="libraryFilterSelect filterIconFormat" leadingIcon={<Database size={15} />} value={formatFilter} onChange={(value) => setFormatFilter(value as LibraryFormatFilter)} options={translatedLibraryFormatOptions} /></label>
            <label><span>{lt('library.filter.rating')}</span><StudioSelect className="libraryFilterSelect filterIconRating" leadingIcon={<Star size={15} />} value={ratingFilter} onChange={(value) => setRatingFilter(value as LibraryRatingFilter)} options={translatedLibraryRatingOptions} /></label>
            <button className="miniButton libraryClearFiltersButton" type="button" disabled={!activeFilterCount} onClick={clearLibraryFilters}>
              {activeFilterCount ? lt('library.filter.clearCount', { count: activeFilterCount }) : lt('library.filter.clear')}
            </button>
          </div>
          <div className="libraryQuickFilters" aria-label={lt('library.quick.aria')}>
            {translatedLibraryQuickFilters.map((filter) => {
              const isActive = filter.value === 'failed' ? statusFilter === 'failed' : quickFilters.includes(filter.value);
              return (
                <button
                  className={`libraryQuickFilterChip ${isActive ? 'active' : ''}`}
                  key={filter.value}
                  type="button"
                  onClick={() => toggleQuickFilter(filter.value)}
                >
                  {filter.label}
                </button>
              );
            })}
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
                    aria-label={lt('library.quick.deleteNamed', { name: filter.label })}
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
                aria-label={lt('library.quick.addAria')}
                aria-haspopup="dialog"
                aria-expanded={quickFilterEditorOpen}
                onClick={() => setQuickFilterEditorOpen((value) => !value)}
              >
                <Plus size={14} />
              </button>
              {quickFilterEditorOpen ? (
                <div className="libraryQuickFilterEditor" role="dialog" aria-label={lt('library.quick.dialogAria')}>
                  <div>
                    <strong>{lt('library.quick.title')}</strong>
                    <span>{lt('library.quick.hint')}</span>
                  </div>
                  <input
                    value={quickFilterName}
                    onChange={(event) => setQuickFilterName(event.target.value)}
                    placeholder={lt('library.quick.placeholder', { count: customQuickFilters.length + 1 })}
                    maxLength={16}
                  />
                  <button className="libraryQuickFilterSave" type="button" onClick={addCustomQuickFilter}>
                    {lt('library.quick.save')}
                  </button>
                  {customQuickFilters.length ? (
                    <div className="libraryQuickFilterManage" aria-label={lt('library.quick.manageAria')}>
                      {customQuickFilters.map((filter) => (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => deleteCustomQuickFilter(filter.id)}
                          title={lt('library.quick.deleteTitle', { name: filter.label })}
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
        <section className="librarySelectionBar" aria-label={lt('library.selection.aria')}>
          <strong>{lt('library.selection.count', { count: selectedRecords.length })}</strong>
          <span>{selectedRecords.length === filteredItems.length ? lt('library.selection.allSelected') : lt('library.selection.resultCount', { count: filteredItems.length })}</span>
          <button className="miniButton" type="button" onClick={selectAllFilteredRecords}>{lt('library.selection.selectAll')}</button>
          <button className="miniButton" type="button" onClick={clearSelection}>{lt('library.selection.clear')}</button>
          <div className="libraryBatchMenuWrap">
            <button className="miniButton" type="button"><MoreHorizontal size={13} /> {lt('library.selection.batch')}</button>
            <div className="libraryQuickMenu libraryBatchMenu" aria-label={lt('library.selection.batch')}>
              <button type="button" onClick={() => setRecordsFavorite(selectedRecordIds, true)}><Star size={13} /> {lt('library.action.addFavorite')}</button>
              <button type="button" onClick={() => setRecordsFavorite(selectedRecordIds, false)}><Star size={13} /> {lt('library.action.removeFavorite')}</button>
              <span className="libraryMenuDivider" />
              <button type="button" onClick={() => void copySelectedPrompts(selectedRecords)}><Copy size={13} /> {lt('library.action.copyPrompt')}</button>
              <button type="button" onClick={() => void copySelectedPaths(selectedRecords)}><Copy size={13} /> {lt('library.action.copyPath')}</button>
              <button type="button" onClick={() => exportSelectedRecordList(selectedRecords)}><Download size={13} /> {lt('library.action.exportList')}</button>
              <span className="libraryMenuDivider" />
              <button type="button" onClick={() => setAssignDialog({ type: 'folder', recordIds: selectedRecordIds })}><FolderOpen size={13} /> {lt('library.action.moveFolder')}</button>
              <button type="button" onClick={() => setAssignDialog({ type: 'collection', recordIds: selectedRecordIds })}><Bookmark size={13} /> {lt('library.action.addCollection')}</button>
              {(libraryScope.type === 'folder' || libraryScope.type === 'collection') ? (
                <button type="button" onClick={() => removeRecordsFromCurrentScope(selectedRecordIds)}><X size={13} /> {lt('library.action.removeCurrentScope')}</button>
              ) : null}
            </div>
          </div>
          <button className="miniButton danger" type="button" onClick={() => void deleteRecords(selectedRecordIds)}><Trash2 size={13} /> {lt('library.action.delete')}</button>
        </section>
      ) : null}

      <section className="libraryWorkspace" aria-label={lt('library.workspace.aria')}>
        {libraryOrganizerOpen ? (
          <button className="libraryOrganizerBackdrop" type="button" aria-label={lt('library.organizer.closeAria')} onClick={() => setLibraryOrganizerOpen(false)} />
        ) : null}
        <aside className={`libraryOrganizer ${libraryOrganizerOpen ? 'open' : ''}`} aria-label={lt('library.organizer.aria')} aria-hidden={!libraryOrganizerOpen}>
          <div className="libraryOrganizerHeader">
            <div>
              <strong>{lt('library.organizer.title')}</strong>
              <span>{selectedScopeTitle}</span>
            </div>
            <button className="iconMiniButton" type="button" data-tooltip={lt('library.action.close')} aria-label={lt('library.organizer.closeAria')} onClick={() => setLibraryOrganizerOpen(false)}><X size={14} /></button>
          </div>
          <div className="libraryOrganizerGroup">
            <button className={libraryScope.type === 'all' ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'all' })}>
              <Image size={14} /><span>{lt('library.organizer.all')}</span><em>{libraryItems.length}</em>
            </button>
            <button className={libraryScope.type === 'favorites' ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'favorites' })}>
              <Star size={14} /><span>{lt('library.organizer.favorites')}</span><em>{favoriteScopeCount}</em>
            </button>
            <button className={libraryScope.type === 'recent7d' ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'recent7d' })}>
              <Clock3 size={14} /><span>{lt('library.organizer.recent7d')}</span><em>{recentScopeCount}</em>
            </button>
            <button className={libraryScope.type === 'recent-viewed' ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'recent-viewed' })}>
              <Clock3 size={14} /><span>{lt('library.organizer.recentViewed')}</span><em>{recentViewedScopeCount}</em>
            </button>
            <button className={libraryScope.type === 'local' ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'local' })}>
              <HardDrive size={14} /><span>{lt('library.organizer.local')}</span><em>{localScopeCount}</em>
            </button>
          </div>
          <div className="libraryOrganizerSection">
            <div><strong>{lt('library.organizer.folders')}</strong><button type="button" aria-label={lt('library.organizer.newFolder')} onClick={() => openCreateOrganizerDialog('folder')}><Plus size={13} /></button></div>
            {libraryOrganization.folders.length ? libraryOrganization.folders.map((folder) => (
              <div className="libraryOrganizerItem" key={folder.id}>
                <button className={libraryScope.type === 'folder' && libraryScope.id === folder.id ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'folder', id: folder.id })}>
                  <span className="libraryFolderDot" style={{ background: folder.color }} /><span>{folder.name}</span><em>{folderCounts.get(folder.id) ?? 0}</em>
                </button>
                <span className="libraryOrganizerItemActions">
                  <button
                    className="libraryOrganizerIconAction"
                    type="button"
                    aria-label={lt('library.organizer.renameFolder', { name: folder.name })}
                    onClick={() => openRenameOrganizerDialog('folder', folder.id, folder.name)}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="libraryOrganizerDelete"
                    type="button"
                    aria-label={lt('library.organizer.deleteFolder', { name: folder.name })}
                    onClick={() => deleteLibraryFolder(folder)}
                  >
                    <X size={12} />
                  </button>
                </span>
              </div>
            )) : <p>{lt('library.organizer.noFolders')}</p>}
          </div>
          <div className="libraryOrganizerSection">
            <div><strong>{lt('library.organizer.collections')}</strong><button type="button" aria-label={lt('library.organizer.newCollection')} onClick={() => openCreateOrganizerDialog('collection')}><Plus size={13} /></button></div>
            {libraryOrganization.collections.length ? libraryOrganization.collections.map((collection) => (
              <div className="libraryOrganizerItem" key={collection.id}>
                <button className={libraryScope.type === 'collection' && libraryScope.id === collection.id ? 'active' : ''} type="button" onClick={() => selectLibraryScope({ type: 'collection', id: collection.id })}>
                  <Bookmark size={14} /><span>{collection.name}</span><em>{collectionCounts.get(collection.id) ?? 0}</em>
                </button>
                <span className="libraryOrganizerItemActions">
                  <button
                    className="libraryOrganizerIconAction"
                    type="button"
                    aria-label={lt('library.organizer.renameCollection', { name: collection.name })}
                    onClick={() => openRenameOrganizerDialog('collection', collection.id, collection.name)}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="libraryOrganizerDelete"
                    type="button"
                    aria-label={lt('library.organizer.deleteCollection', { name: collection.name })}
                    onClick={() => deleteLibraryCollection(collection)}
                  >
                    <X size={12} />
                  </button>
                </span>
              </div>
            )) : <p>{lt('library.organizer.noCollections')}</p>}
          </div>
        </aside>

        <div className="libraryContentPane">
          <div className="libraryScopeBar">
            <strong>
              {libraryScope.type === 'favorites' ? <Star size={15} /> :
                libraryScope.type === 'recent7d' ? <Clock3 size={15} /> :
                libraryScope.type === 'recent-viewed' ? <Clock3 size={15} /> :
                libraryScope.type === 'local' ? <HardDrive size={15} /> :
                libraryScope.type === 'folder' ? <FolderOpen size={15} /> :
                libraryScope.type === 'collection' ? <Bookmark size={15} /> :
                <Image size={15} />}
              {selectedScopeTitle}
            </strong>
            <span>{lt('library.count.items', { count: filteredItems.length })}</span>
            {libraryScope.type !== 'all' ? (
              <button className="libraryScopeClearButton" type="button" aria-label={lt('library.organizer.backAll')} onClick={() => selectLibraryScope({ type: 'all' })}>
                <X size={13} />
              </button>
            ) : null}
          </div>

          {!props.isHistoryLoaded ? (
            <div className="emptyState libraryEmpty"><Sparkles size={42} /><h3>{lt('library.empty.loadingTitle')}</h3></div>
          ) : filteredItems.length === 0 ? (
            <div className="emptyState libraryEmpty">
              <Sparkles size={42} />
              <h3>{libraryItems.length === 0 ? lt('library.empty.noImagesTitle') : lt('library.empty.noMatchesTitle')}</h3>
              <p>{libraryItems.length === 0 ? lt('library.empty.noImagesHint') : lt('library.empty.noMatchesHint')}</p>
            </div>
          ) : (
            <section className={`libraryGrid libraryGridV2 view-${viewMode} ${displaySettings.compact ? 'compact' : ''}`} style={gridStyle}>
              {visibleLibraryItems.map((result) => (
                <LibraryRecordCard
                  key={result.id}
                  t={props.t}
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
            <strong>{contextSelection.length > 1 ? lt('library.context.selected', { count: contextSelection.length }) : lt('library.context.imageActions')}</strong>
            <button className="iconMiniButton" type="button" data-tooltip={lt('library.action.close')} aria-label={lt('library.action.close')} onClick={() => setContextMenu(null)}><X size={13} /></button>
          </div>
          {contextSelection.length === 1 ? (
            <>
              <button type="button" role="menuitem" onClick={() => openContextDetails(contextSelection)}>
                <Info size={13} /> {lt('library.action.openDetails')}
              </button>
              {contextSelection[0]?.error || contextSelection[0]?.status === 'failed' ? (
                <button type="button" role="menuitem" onClick={() => openContextDiagnostics(contextSelection)}>
                  <Gauge size={13} /> {lt('library.action.viewDiagnostics')}
                </button>
              ) : null}
              <button type="button" role="menuitem" disabled={!contextSelection[0]?.imageUrls[0]} onClick={() => useContextRecordAsReference(contextSelection)}>
                <ImagePlus size={13} /> {lt('library.action.setReference')}
              </button>
            </>
          ) : null}
          <button type="button" role="menuitem" onClick={() => void copySelectedPrompts(contextSelection)}>
            <Copy size={13} /> {lt('library.action.copyPrompt')}
          </button>
          <button type="button" role="menuitem" onClick={() => void copySelectedPaths(contextSelection)}>
            <Copy size={13} /> {lt('library.action.copyPath')}
          </button>
          <button type="button" role="menuitem" onClick={() => exportSelectedRecordList(contextSelection)}>
            <Download size={13} /> {lt('library.action.exportList')}
          </button>
          <span className="libraryMenuDivider" />
          <button type="button" role="menuitem" onClick={() => setAssignDialog({ type: 'folder', recordIds: contextSelection.map((record) => record.id) })}>
            <FolderOpen size={13} /> {lt('library.action.moveFolder')}
          </button>
          <button type="button" role="menuitem" onClick={() => setAssignDialog({ type: 'collection', recordIds: contextSelection.map((record) => record.id) })}>
            <Bookmark size={13} /> {lt('library.action.addCollection')}
          </button>
          {(libraryScope.type === 'folder' || libraryScope.type === 'collection') ? (
            <button type="button" role="menuitem" onClick={() => removeRecordsFromCurrentScope(contextSelection.map((record) => record.id))}>
              <X size={13} /> {lt('library.action.removeCurrentScope')}
            </button>
          ) : null}
          <span className="libraryMenuDivider" />
          {contextSelection.length === 1 ? (
            <button type="button" role="menuitem" onClick={() => setRecordsFavorite(contextSelection.map((record) => record.id), !libraryMeta[contextSelection[0].id]?.favorite)}>
              <Star size={13} /> {libraryMeta[contextSelection[0].id]?.favorite ? lt('library.action.removeFavorite') : lt('library.action.addFavorite')}
            </button>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => setRecordsFavorite(contextSelection.map((record) => record.id), true)}>
                <Star size={13} /> {lt('library.action.addFavorite')}
              </button>
              <button type="button" role="menuitem" onClick={() => setRecordsFavorite(contextSelection.map((record) => record.id), false)}>
                <Star size={13} /> {lt('library.action.removeFavorite')}
              </button>
            </>
          )}
          <button className="dangerAction" type="button" role="menuitem" onClick={() => void deleteRecords(contextSelection.map((record) => record.id))}>
            <Trash2 size={13} /> {contextSelection.length > 1 ? lt('library.action.deleteSelected') : lt('library.action.deleteRecord')}
          </button>
        </div>
      ) : null}

      {organizerDialog ? (
        <LibraryOrganizerDialog
          t={props.t}
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
          t={props.t}
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
                {activePanel === 'main' ? lt('library.dock.menuTitle') : activePanel === 'view' ? lt('library.dock.viewTitle') : activePanel === 'display' ? lt('library.dock.displayTitle') : activePanel === 'sort' ? lt('library.dock.sortTitle') : lt('library.dock.addTitle')}
              </strong>
              <button
                className="iconMiniButton"
                type="button"
                data-tooltip={isDockSubPanel ? lt('library.dock.backMenu') : lt('library.dock.closePanel')}
                aria-label={isDockSubPanel ? lt('library.dock.backMenu') : lt('library.dock.closePanel')}
                onClick={() => setActivePanel(isDockSubPanel ? 'main' : null)}
              >
                {isDockSubPanel ? <Sidebar size={14} /> : <X size={14} />}
              </button>
            </div>
            {activePanel === 'main' ? (
              <div className="libraryMainMenuGrid">
                <button type="button" onClick={() => setSearchVisible((value) => !value)}>
                  <Sidebar size={15} />
                  <span>{searchVisible ? lt('library.dock.hideSearch') : lt('library.dock.showSearch')}</span>
                </button>
                <button type="button" onClick={() => setFiltersVisible((value) => !value)}>
                  <SlidersHorizontal size={15} />
                  <span>{filtersVisible ? lt('library.dock.hideFilters') : lt('library.dock.showFilters')}{activeFilterCount ? ` (${activeFilterCount})` : ''}</span>
                </button>
                <button className="menuHasChild" type="button" onClick={() => setActivePanel('view')}>
                  <Grid2X2 size={15} />
                  <span>{lt('library.dock.viewTitle')}</span>
                  <ChevronRight className="menuChevron" size={14} />
                </button>
                <button className="menuHasChild" type="button" onClick={() => setActivePanel('display')}>
                  <Settings size={15} />
                  <span>{lt('library.dock.displayTitle')}</span>
                  <ChevronRight className="menuChevron" size={14} />
                </button>
                <button className="menuHasChild" type="button" onClick={() => setActivePanel('sort')}>
                  <Clock3 size={15} />
                  <span>{lt('library.dock.sortTitle')}</span>
                  <ChevronRight className="menuChevron" size={14} />
                </button>
                <button type="button" onClick={() => setThumbnailScale((value) => Math.min(1.28, Number((value + 0.08).toFixed(2))))}>
                  <ZoomIn size={15} />
                  <span>{lt('library.dock.zoomIn')}</span>
                </button>
                <button type="button" onClick={() => setThumbnailScale((value) => Math.max(0.78, Number((value - 0.08).toFixed(2))))}>
                  <ZoomOut size={15} />
                  <span>{lt('library.dock.zoomOut')}</span>
                </button>
              </div>
            ) : null}
            {activePanel === 'view' ? (
              <div className="librarySegmentGrid">
                {translatedLibraryViewOptions.map((option) => (
                  <button className={viewMode === option.value ? 'active' : ''} key={option.value} type="button" onClick={() => setViewMode(option.value)}>{option.label}</button>
                ))}
                <button type="button" onClick={() => setThumbnailScale((value) => Math.min(1.28, Number((value + 0.08).toFixed(2))))}><ZoomIn size={14} /> {lt('library.dock.zoomIn')}</button>
                <button type="button" onClick={() => setThumbnailScale((value) => Math.max(0.78, Number((value - 0.08).toFixed(2))))}><ZoomOut size={14} /> {lt('library.dock.zoomOut')}</button>
              </div>
            ) : null}
            {activePanel === 'display' ? (
              <div className="libraryDisplayList">
                <label><input type="checkbox" checked={displaySettings.showPrompt} onChange={(event) => updateDisplaySettings({ showPrompt: event.target.checked })} /> {lt('library.display.showPrompt')}</label>
                <label><input type="checkbox" checked={displaySettings.showProvider} onChange={(event) => updateDisplaySettings({ showProvider: event.target.checked })} /> {lt('library.display.showProvider')}</label>
                <label><input type="checkbox" checked={displaySettings.showModel} onChange={(event) => updateDisplaySettings({ showModel: event.target.checked })} /> {lt('library.display.showModel')}</label>
                <label><input type="checkbox" checked={displaySettings.showReferenceBadge} onChange={(event) => updateDisplaySettings({ showReferenceBadge: event.target.checked })} /> {lt('library.display.showReferenceBadge')}</label>
                <label><input type="checkbox" checked={displaySettings.compact} onChange={(event) => updateDisplaySettings({ compact: event.target.checked })} /> {lt('library.display.compact')}</label>
              </div>
            ) : null}
            {activePanel === 'sort' ? (
              <div className="librarySegmentGrid">
                {translatedLibrarySortOptions.map((option) => (
                  <button className={sortMode === option.value ? 'active' : ''} key={option.value} type="button" onClick={() => setSortMode(option.value)}>{option.label}</button>
                ))}
              </div>
            ) : null}
            {activePanel === 'add' ? (
              <div className="libraryAddList">
                {translatedLibraryAddActions.map((action) => (
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
          <button className={`libraryDockIcon ${libraryOrganizerOpen ? 'active' : ''}`} type="button" data-tooltip={lt('library.dock.organizer')} aria-label={lt('library.organizer.aria')} onClick={() => setLibraryOrganizerOpen((value) => !value)}>
            <FolderOpen size={18} />
          </button>
          <button className="libraryDockIcon" type="button" data-tooltip={lt('library.dock.menu')} aria-label={lt('library.dock.menu')} onClick={() => setActivePanel((panel) => panel === 'main' ? null : 'main')}>
            <SlidersHorizontal size={18} />{activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
          {searchVisible ? (
            <label className="libraryDockSearch">
              <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={lt('library.search.placeholder')} />
            </label>
          ) : (
            <button className="libraryDockRestore" type="button" onClick={() => setSearchVisible(true)}>{lt('library.dock.showSearch')}</button>
          )}
          <button className="libraryDockAdd" type="button" data-tooltip={lt('library.dock.addTitle')} aria-label={lt('library.dock.addTitle')} onClick={() => setActivePanel((panel) => panel === 'add' ? null : 'add')}><Plus size={19} /></button>
        </div>
      </section>

      {selectedRecord ? (
        <>
          <button
            className="libraryDetailBackdrop"
            type="button"
            aria-label={lt('library.detail.closeAria')}
            onClick={() => setSelectedRecordId(null)}
          />
          <aside className="libraryDetailDrawer" aria-label={lt('library.detail.aria')}>
            <div className="libraryDetailHeader">
              <div className="libraryDetailTitle">
                <p className="eyebrow">Image Details</p>
                <h2>{libraryMeta[selectedRecord.id]?.favorite ? lt('library.detail.favoriteTitle') : lt('library.detail.title')}</h2>
                <small title={selectedRecordFileName}>{selectedRecordFileName}</small>
              </div>
              <div className="libraryDetailHeaderActions">
                <button className="iconMiniButton" type="button" data-tooltip={lt('library.detail.close')} aria-label={lt('library.detail.close')} onClick={() => setSelectedRecordId(null)}><X size={15} /></button>
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
                <div className="libraryRatingControl" aria-label={lt('library.detail.ratingAria')}>
                  {libraryRatingValues.map((rating) => (
                    <button
                      className={(selectedRecordMeta?.rating ?? 0) >= rating ? 'active' : ''}
                      key={rating}
                      type="button"
                      aria-label={lt('library.detail.ratingStar', { count: rating })}
                      title={lt('library.detail.ratingStar', { count: rating })}
                      onClick={() => setRecordRating(selectedRecord.id, rating)}
                    >
                      <Star size={15} fill={(selectedRecordMeta?.rating ?? 0) >= rating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <span className="libraryDetailImageMetaOverlay" aria-label={lt('library.detail.imageInfo')}>
                  {selectedRecordDetailMeta.map((item, index) => (
                    <span key={`${item}-${index}`}>{item}</span>
                  ))}
                </span>
              </div>
            ) : (
              <div className="libraryDetailMissing">{lt('library.detail.noPreview')}</div>
            )}
            <div className="libraryDetailColorSection">
              <span>{lt('library.detail.primaryColor')}</span>
              {selectedRecordMeta?.colorPalette?.length ? (
                <div className="libraryAutoColorPalette" aria-label={lt('library.detail.paletteAria')}>
                  {selectedRecordMeta.colorPalette.map((color) => (
                    <span key={color} title={color} style={{ background: color }} />
                  ))}
                </div>
              ) : (
                <small>{selectedRecordMeta?.colorAnalysisFailed ? lt('library.detail.unrecognized') : lt('library.detail.analyzing')}</small>
              )}
            </div>
            <div className="libraryDetailSection promptDetailSection">
              <div className="libraryPromptHeader">
                <strong>Prompt</strong>
                <button className="miniButton libraryPromptCopyButton" type="button" onClick={() => void copyText('Prompt', selectedRecord.prompt)}>
                  <Copy size={12} /> {lt('library.action.copy')}
                </button>
              </div>
              <p>{selectedRecord.prompt}</p>
            </div>
            <div className="libraryDetailOrganizerSection">
              <div className="libraryDetailOrganizerHeader">
                <div className="libraryDetailOrganizerTitleLine">
                  <strong>{lt('library.detail.organize')}</strong>
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
                      <span><FolderOpen size={13} /> {lt('library.detail.noFolder')}</span>
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
                      <span><Bookmark size={13} /> {lt('library.detail.noCollection')}</span>
                    )}
                  </div>
                </div>
                <div className="libraryDetailOrganizerActions">
                  <button className="iconMiniButton" type="button" data-tooltip={lt('library.action.moveFolder')} aria-label={lt('library.action.moveFolder')} onClick={() => setAssignDialog({ type: 'folder', recordIds: [selectedRecord.id] })}><FolderOpen size={14} /></button>
                  <button className="iconMiniButton" type="button" data-tooltip={lt('library.action.addCollection')} aria-label={lt('library.action.addCollection')} onClick={() => setAssignDialog({ type: 'collection', recordIds: [selectedRecord.id] })}><Bookmark size={14} /></button>
                  {(libraryScope.type === 'folder' || libraryScope.type === 'collection') ? (
                    <button className="iconMiniButton" type="button" data-tooltip={lt('library.action.removeCurrentScope')} aria-label={lt('library.action.removeCurrentScope')} onClick={() => removeRecordsFromCurrentScope([selectedRecord.id])}><X size={14} /></button>
                  ) : null}
                </div>
              </div>
            </div>
            {selectedRecordRecoveryAdviceText ? (
              <div className="libraryDetailSection libraryRecoveryAdvicePanel">
                <div className="generationDiagnosticHeader">
                  <div>
                    <span>{lt('library.detail.recoveryAdvice')}</span>
                    <strong>{selectedRecordRecoveryAdviceText.title}</strong>
                  </div>
                </div>
                <p>{selectedRecordRecoveryAdviceText.summary}</p>
                <ul className="generationErrorActionsList libraryErrorActionsList">
                  {selectedRecordRecoveryAdviceText.actions.map((action) => <li key={action}>{action}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="libraryDetailActions">
              <button className={`miniButton ${libraryMeta[selectedRecord.id]?.favorite ? 'active' : ''}`} type="button" onClick={() => toggleFavorite(selectedRecord.id)}><Star size={13} /> {libraryMeta[selectedRecord.id]?.favorite ? lt('library.action.favorited') : lt('library.action.favorite')}</button>
              <button className="miniButton" type="button" disabled={!selectedRecord.imageUrls[0]} onClick={() => useRecordAsReference(selectedRecord)}><ImagePlus size={13} /> {lt('library.action.setReference')}</button>
              <button className="miniButton" type="button" onClick={() => props.onRetryRecord(selectedRecord)}><RefreshCcw size={13} /> {lt('library.action.retry')}</button>
              {selectedRecord.error || selectedRecord.status === 'failed' ? (
                <button className="miniButton" type="button" onClick={() => openRecordDiagnostics(selectedRecord)}><Gauge size={13} /> {lt('library.action.viewDiagnostics')}</button>
              ) : null}
              <button className="miniButton" type="button" disabled={!getRecordPrimaryPath(selectedRecord)} onClick={() => void copyText('Path', getRecordPrimaryPath(selectedRecord))}><Copy size={13} /> {lt('library.action.path')}</button>
              <button className="miniButton" type="button" disabled={!getRecordRevealPath(selectedRecord)} onClick={() => {
                const path = getRecordRevealPath(selectedRecord);
                if (path) void revealGenerationFile(path);
              }}><FolderOpen size={13} /> {lt('library.action.folder')}</button>
              <button className="miniButton danger" type="button" onClick={() => void deleteRecord(selectedRecord.id)}><Trash2 size={13} /> {lt('library.action.deleteRecord')}</button>
            </div>
            {selectedRecord.referenceImages?.length ? (
              <div
                className="libraryDetailSection libraryReferenceDetailSection"
                style={{ '--reference-detail-list-max-height': `${Math.min(selectedRecord.referenceImages.length * 92 - 10, 358)}px` } as CSSProperties}
              >
                <strong>{lt('library.detail.references')}</strong>
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
                          {previewUrl ? <img src={previewUrl} alt={reference.name ?? lt('library.detail.referenceAlt', { index: index + 1 })} /> : <ImagePlus size={16} />}
                        </button>
                        <div>
                          <strong>{reference.name || lt('library.detail.referenceName', { index: index + 1 })}</strong>
                          <span>{libraryReferenceSourceLabel(reference.source)} · {libraryReferenceRoleLabel(reference.role)}</span>
                          {reference.localPath ? <small title={reference.localPath}>{reference.localPath}</small> : null}
                          {reference.sourceGenerationId ? <small>{lt('library.detail.sourceRecord', { id: reference.sourceGenerationId })}</small> : null}
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
            aria-label={lt('library.diagnostic.closeAria')}
            onClick={() => setDiagnosticRecordId(null)}
          />
          <aside className="libraryDetailDrawer libraryDiagnosticDrawer" aria-label={lt('library.diagnostic.aria')}>
            <div className="libraryDetailHeader">
              <div className="libraryDetailTitle">
                <p className="eyebrow">Error Diagnostics</p>
                <h2>{lt('library.diagnostic.title')}</h2>
                <small title={getRecordFileName(diagnosticRecord) || diagnosticRecord.id}>{getRecordFileName(diagnosticRecord) || diagnosticRecord.id}</small>
              </div>
              <div className="libraryDetailHeaderActions">
                <button className="iconMiniButton" type="button" data-tooltip={lt('library.diagnostic.viewDetails')} aria-label={lt('library.diagnostic.viewDetails')} onClick={() => openRecordDetails(diagnosticRecord)}><Info size={15} /></button>
                <button className="iconMiniButton" type="button" data-tooltip={lt('library.diagnostic.close')} aria-label={lt('library.diagnostic.close')} onClick={() => setDiagnosticRecordId(null)}><X size={15} /></button>
              </div>
            </div>
            <div className={`libraryDetailSection warning generationDiagnosticPanel severity-${diagnosticRecordFailureDiagnosis.severity}`}>
              <div className="generationDiagnosticHeader">
                <div>
                  <span>{lt('library.diagnostic.report')}</span>
                  <strong>{diagnosticRecordFailureDiagnosis.title}</strong>
                </div>
                <em>{libraryFailureCategoryLabel(diagnosticRecordFailureDiagnosis.category)} · {libraryFailureSeverityLabel(diagnosticRecordFailureDiagnosis.severity)}</em>
              </div>
              <p>{diagnosticRecordFailureDiagnosis.summary}</p>
              <div className="generationDiagnosisChips" aria-label={lt('library.diagnostic.paramsAria')}>
                <span>{lt('library.diagnostic.status', { status: libraryGenerationStatusLabel(diagnosticRecord) })}</span>
                <span>{lt('library.diagnostic.provider', { provider: diagnosticRecordProviderName })}</span>
                <span>{lt('library.diagnostic.model', { model: diagnosticRecord.modelId || '-' })}</span>
                {diagnosticRecordFailureDetails.map((detail) => <span key={detail}>{detail}</span>)}
              </div>
              {diagnosticRecordFailureDiagnosis.isPotentialBackgroundCompletion ? (
                <div className="generationBackgroundNotice">
                  <Clock3 size={14} />
                  <span>{lt('library.diagnostic.backgroundNotice')}</span>
                </div>
              ) : null}
              {diagnosticRecordFailureDiagnosis.isPotentialBackgroundCompletion ? (
                <div className="generationRecoveryCallout">
                  <div>
                    <strong>{lt('library.diagnostic.recheckTitle')}</strong>
                    <span>{lt('library.diagnostic.recheckHint')}</span>
                  </div>
                  <button
                    className="miniButton"
                    type="button"
                    disabled={recheckingRecordId === diagnosticRecord.id}
                    onClick={() => void recheckDiagnosticRecord(diagnosticRecord)}
                  >
                    <RefreshCcw size={13} /> {recheckingRecordId === diagnosticRecord.id ? lt('library.diagnostic.rechecking') : lt('library.diagnostic.recheck')}
                  </button>
                </div>
              ) : null}
              {diagnosticRecordRecoveryAdviceText ? (
                <div className="generationDiagnosticBlock libraryRecoveryAdvicePanel compact">
                  <strong>{diagnosticRecordRecoveryAdviceText.title}</strong>
                  <p>{diagnosticRecordRecoveryAdviceText.summary}</p>
                  <ul className="generationErrorActionsList libraryErrorActionsList">
                    {diagnosticRecordRecoveryAdviceText.actions.map((action) => <li key={action}>{action}</li>)}
                  </ul>
                </div>
              ) : null}
              <div className="generationDiagnosticBlock">
                <strong>{lt('library.diagnostic.actions')}</strong>
                <ul className="generationErrorActionsList libraryErrorActionsList">
                  {diagnosticRecordFailureActions.map((action) => <li key={action}>{action}</li>)}
                </ul>
              </div>
              {diagnosticRecordFailureRawText ? (
                <details className="generationRawDetails">
                  <summary>{lt('library.diagnostic.rawSummary')}</summary>
                  <pre>{clipDiagnosticText(diagnosticRecordFailureRawText)}</pre>
                </details>
              ) : null}
              <div className="libraryDetailInlineActions generationDiagnosticActions">
                <button className="miniButton" type="button" onClick={() => props.onRetryRecord(diagnosticRecord)}><RefreshCcw size={13} /> {lt('library.action.retry')}</button>
                <button className="miniButton" type="button" onClick={() => void copyText(lt('library.diagnostic.title'), generationFailureCopyText(diagnosticRecord, diagnosticRecordProviderName))}><Copy size={13} /> {lt('library.diagnostic.copyDiagnosis')}</button>
                <button className="miniButton" type="button" onClick={() => void copyText(lt('library.diagnostic.copyRequest'), generationRequestSummaryCopyText(diagnosticRecord, diagnosticRecordProviderName))}><Copy size={13} /> {lt('library.diagnostic.copyRequest')}</button>
                <button className="miniButton" type="button" disabled={!diagnosticRecordFailureRawText} onClick={() => void copyText('Raw', diagnosticRecordFailureRawText)}><Database size={13} /> {lt('library.diagnostic.copyRaw')}</button>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
});

function PromptTemplatesPage(props: { t: Translator; onUseTemplate: (prompt: string) => void }) {
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

  const t = props.t;

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
    { value: 'all', label: t('templates.sourceFilter.all') },
    { value: 'default', label: t('templates.sourceFilter.default') },
    { value: 'custom', label: t('templates.sourceFilter.custom') },
    { value: 'favorite', label: t('templates.sourceFilter.favorite') },
    { value: 'recent', label: t('templates.sourceFilter.recent') }
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

  const translatedTemplateSourceOptions = useMemo(() => templateSourceOptions.map((option) => ({
    ...option,
    label: translateTemplateLabel('templates.sourceFilter', option.value, option.label)
  })), [t]);
  const translatedTemplateCategoryOptions = useMemo(() => PROMPT_TEMPLATE_CATEGORIES.map((option) => ({
    ...option,
    label: translateTemplateLabel('templates.category', option.value, option.label)
  })), [t]);
  const templateViewOptions = useMemo(() => [
    { value: 'card' as TemplateViewMode, label: t('templates.view.card') },
    { value: 'list' as TemplateViewMode, label: t('templates.view.list') }
  ], [t]);

  function translateTemplateLabel(prefix: string, value: string, fallback: string) {
    const key = `${prefix}.${value}` as Parameters<Translator>[0];
    const translated = t(key);
    return translated === key ? fallback : translated;
  }

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
    const fallback = PROMPT_TEMPLATE_CATEGORIES.find((item) => item.value === value)?.label ?? value;
    return translateTemplateLabel('templates.category', value, fallback);
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
      setCopyMessage(t('templates.needTitlePrompt'));
      return;
    }
    const previous = draft.id ? templates.find((template) => template.id === draft.id) : undefined;
    const shouldUpdateExisting = Boolean(previous?.custom);
    const nextTemplate = createPromptTemplate({
      id: shouldUpdateExisting ? previous?.id : undefined,
      title,
      category: draft.category,
      tone: draft.tone.trim() || t('templates.customTone'),
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
    setCopyMessage(shouldUpdateExisting ? t('templates.updated') : t('templates.savedAsMine'));
  }

  function deleteTemplate(template: PromptTemplate) {
    if (!template.custom) {
      setCopyMessage(t('templates.systemDeleteBlocked'));
      return;
    }
    if (!window.confirm(t('templates.deleteConfirmMessage', { title: template.title }))) return;
    const next = templates.filter((item) => item.id !== template.id);
    persistTemplates(next);
    setSelectedTemplateId(next[0]?.id ?? null);
    setDetailOpen(false);
    if (editingTemplateId === template.id) cancelEditTemplate();
    setCopyMessage(t('templates.deleted'));
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
      setCopyMessage(t('templates.copied', { title: template.title }));
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
          <h1>{t('templates.title')}</h1>
          <p>{t('templates.subtitle')}</p>
        </div>
        <div className="statusPills">
          <span><Layers size={15} /> {t('templates.stats.total', { count: templates.length })}</span>
          <span><Star size={15} /> {t('templates.stats.favorite', { count: favoriteCount })}</span>
          <span><Clock3 size={15} /> {t('templates.stats.recent', { count: recentCount })}</span>
        </div>
      </header>

      <section className="templateToolbar promptLibraryToolbar">
        <label className="templateSearchBox">
          <span>{t('templates.searchLabel')}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('templates.searchPlaceholder')} />
        </label>
        <label>
          <span>{t('templates.categoryLabel')}</span>
          <StudioSelect value={category} onChange={(value) => setCategory(value as 'all' | PromptTemplateCategory)} options={translatedTemplateCategoryOptions} />
        </label>
        <label>
          <span>{t('templates.sourceLabel')}</span>
          <StudioSelect value={sourceFilter} onChange={(value) => setSourceFilter(value as TemplateSourceFilter)} options={translatedTemplateSourceOptions} />
        </label>
        <div className="promptLibraryToolbarActions">
          <button
            className={`miniButton favoriteFilterButton ${sourceFilter === 'favorite' ? 'active' : ''}`}
            type="button"
            onClick={() => setSourceFilter(sourceFilter === 'favorite' ? 'all' : 'favorite')}
            title={sourceFilter === 'favorite' ? t('templates.showAll') : t('templates.onlyFavorites')}
            aria-label={sourceFilter === 'favorite' ? t('templates.showAll') : t('templates.onlyFavorites')}
          >
            <Star size={13} fill={sourceFilter === 'favorite' ? 'currentColor' : 'none'} /> {t('templates.favoriteFilter')}
          </button>
          <div className="segmentedControl compactSegment" aria-label={t('templates.viewAria')}>
            <button className={viewMode === 'card' ? 'active' : ''} onClick={() => setViewMode('card')} type="button"><Grid2X2 size={13} /> {templateViewOptions[0].label}</button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} type="button"><Layers size={13} /> {templateViewOptions[1].label}</button>
          </div>
          <button className="miniButton" type="button" onClick={clearTemplateFilters}><X size={13} /> {t('templates.clear')}</button>
          <button className="miniButton primaryMini" type="button" onClick={startCreateTemplate}><Plus size={13} /> {t('templates.new')}</button>
        </div>
      </section>

      <section className="promptCategoryStrip" aria-label={t('templates.categoryStripAria')}>
          {translatedTemplateCategoryOptions.map((item) => {
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
            <strong>{t('templates.resultCount', { count: filteredTemplates.length })}</strong>
            <span>{sourceFilter === 'all' ? t('templates.sourceFilter.all') : translatedTemplateSourceOptions.find((item) => item.value === sourceFilter)?.label}</span>
          </div>
          {filteredTemplates.length === 0 ? (
            <div className="emptyState templateEmpty">
              <Sparkles size={42} />
              <h3>{t('templates.emptyTitle')}</h3>
          <p>{t('templates.subtitle')}</p>
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
                      title={template.favorite ? t('templates.favoriteRemove') : t('templates.favoriteAdd')}
                      aria-label={template.favorite ? t('templates.favoriteRemoveNamed', { title: template.title }) : t('templates.favoriteAddNamed', { title: template.title })}
                      onClick={(event) => { event.stopPropagation(); toggleTemplateFavorite(template); }}
                    >
                      <Star size={13} fill={template.favorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <strong title={template.title}>{template.title}</strong>
                  <small>{template.tone || t('templates.noTone')}</small>
                  <p>{template.description || template.prompt}</p>
                  <div className="templateTags">
                    {template.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                  <div className="promptTemplateMetaLine">
                    <span>{template.custom ? t('templates.kind.custom') : t('templates.kind.system')}</span>
                    <span>{template.usedCount ? t('templates.usedCount', { count: template.usedCount }) : t('templates.notUsed')}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      {detailOpen ? (
        <div className="templateDrawerBackdrop" onClick={() => { setDetailOpen(false); setEditingTemplateId(null); }}>
        <aside className="promptTemplateDetail templateDetailDrawer" aria-label={t('templates.detailAria')} onClick={(event) => event.stopPropagation()}>
          {editingTemplateId ? (
            <>
              <div className="panelTitleRow">
                <div>
                  <strong>{editingTemplateId === 'new' ? t('templates.editorNew') : t('templates.editorEdit')}</strong>
              <p>{t('templates.emptyHint')}</p>
                </div>
                <button className="iconMiniButton" type="button" onClick={() => { setDetailOpen(false); cancelEditTemplate(); }} title={t('templates.closeEditor')} aria-label={t('templates.closeEditor')}><X size={13} /></button>
              </div>
              <div className="promptTemplateEditor">
                <label><span>{t('templates.fieldTitle')}</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={t('templates.fieldTitlePlaceholder')} /></label>
                <label><span>{t('templates.categoryLabel')}</span><StudioSelect value={draft.category} onChange={(value) => setDraft({ ...draft, category: value as PromptTemplateCategory })} options={translatedTemplateCategoryOptions.filter((item) => item.value !== 'all') as Array<{ value: PromptTemplateCategory; label: string }>} /></label>
                <label><span>{t('templates.fieldTone')}</span><input value={draft.tone} onChange={(event) => setDraft({ ...draft, tone: event.target.value })} placeholder={t('templates.fieldTonePlaceholder')} /></label>
                <label><span>{t('templates.fieldDescription')}</span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={2} placeholder={t('templates.fieldDescriptionPlaceholder')} /></label>
                <label><span>{t('templates.fieldTags')}</span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder={t('templates.fieldTagsPlaceholder')} /></label>
                <label><span>Prompt</span><textarea value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} rows={8} placeholder={t('templates.fieldPromptPlaceholder')} /></label>
              </div>
              <div className="sourceEditorActions">
                <button className="miniButton" type="button" onClick={() => { setDetailOpen(false); cancelEditTemplate(); }}><X size={13} /> {t('templates.cancel')}</button>
                <button className="miniButton primaryMini" type="button" onClick={saveDraftTemplate}><Pencil size={13} /> {t('templates.save')}</button>
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
                    title={selectedTemplate.favorite ? t('templates.favoriteRemove') : t('templates.favoriteAdd')}
                    aria-label={selectedTemplate.favorite ? t('templates.favoriteRemoveTemplate') : t('templates.favoriteAddTemplate')}
                    onClick={() => toggleTemplateFavorite(selectedTemplate)}
                  >
                    <Star size={14} fill={selectedTemplate.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button className="iconMiniButton" type="button" onClick={() => setDetailOpen(false)} title={t('templates.closeDetails')} aria-label={t('templates.closeDetails')}><X size={13} /></button>
                </div>
              </div>

              <div className="promptTemplateDetailMeta">
                <span>{selectedTemplate.custom ? t('templates.kind.custom') : t('templates.kind.system')}</span>
                <span>{selectedTemplate.usedCount ? t('templates.usedCount', { count: selectedTemplate.usedCount }) : t('templates.notUsed')}</span>
                <span>{selectedTemplate.lastUsedAt ? t('templates.recentUsed') : t('templates.notRecent')}</span>
              </div>

              <div className="promptTemplateVariables">
                <div className="sectionHeadingRow">
                  <strong>{t('templates.variablesTitle')}</strong>
                  <small>{t('templates.variableCount', { count: selectedTemplateVariables.length })}</small>
                </div>
                {selectedTemplateVariables.map((variable) => (
                  <label key={variable}>
                    <span>{variable}</span>
                    <input
                      value={variableValues[variable] ?? ''}
                      onChange={(event) => setVariableValues((current) => ({ ...current, [variable]: event.target.value }))}
                      placeholder={t('templates.variablePlaceholder', { name: variable })}
                    />
                  </label>
                ))}
              </div>

              <label className="promptTemplatePreview">
                <span>{t('templates.previewPrompt')}</span>
                <textarea value={renderedPrompt} readOnly rows={9} />
              </label>

              <div className="templateTags promptTemplateDetailTags">
                {selectedTemplate.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>

              <div className="promptTemplateDetailActions">
                <button className="miniButton primaryMini" type="button" onClick={() => useTemplate(selectedTemplate)}><Wand2 size={13} /> {t('templates.apply')}</button>
                <button className="miniButton" type="button" onClick={() => void copyTemplate(selectedTemplate)}><Copy size={13} /> {t('templates.copy')}</button>
                <button className="miniButton" type="button" onClick={() => startEditTemplate(selectedTemplate)}><Pencil size={13} /> {selectedTemplate.custom ? t('templates.edit') : t('templates.saveAs')}</button>
                <button
                  className="miniButton dangerText"
                  type="button"
                  disabled={!selectedTemplate.custom}
                  title={selectedTemplate.custom ? t('templates.deleteTitle') : t('templates.systemDeleteTitle')}
                  onClick={() => deleteTemplate(selectedTemplate)}
                >
                  <Trash2 size={13} /> {t('templates.delete')}
                </button>
              </div>
            </>
          ) : (
            <div className="emptyState templateEmpty">
              <Layers size={42} />
              <h3>{t('templates.selectTitle')}</h3>
              <p>{t('templates.selectHint')}</p>
            </div>
          )}
        </aside>
        </div>
      ) : null}
    </section>
  );
}

function BatchQueueNameDialog(props: {
  t: Translator;
  mode: 'create' | 'rename';
  defaultName: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(props.defaultName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const title = props.mode === 'rename' ? props.t('batch.dialog.renameQueue') : props.t('batch.dialog.newQueue');
  const hint = props.mode === 'rename'
    ? props.t('batch.dialog.renameHint')
    : props.t('batch.dialog.createHint');

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
      <section
        className="organizerDialog batchQueueNameDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-queue-name-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">Batch Queue</p>
            <h2 id="batch-queue-name-dialog-title">{title}</h2>
          </div>
          <button className="iconMiniButton" type="button" data-tooltip={props.t('common.close')} aria-label={props.t('common.close')} onClick={props.onClose}>
            <X size={15} />
          </button>
        </header>
        <label>
          <span>{props.t('batch.dialog.queueName')}</span>
          <input
            ref={inputRef}
            value={name}
            maxLength={32}
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
          <button type="button" className="confirmCancelButton" onClick={props.onClose}>{props.t('common.cancel')}</button>
          <button type="button" className="confirmPrimaryButton" disabled={!name.trim()} onClick={submit}>
            {props.mode === 'rename' ? props.t('common.save') : props.t('common.create')}
          </button>
        </div>
      </section>
    </div>
  );
}

function LibraryOrganizerDialog(props: {
  t: Translator;
  type: 'folder' | 'collection';
  mode: 'create' | 'rename';
  defaultName: string;
  selectedCount: number;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const dt = (key: string, params?: Record<string, string | number>) => props.t(key as Parameters<Translator>[0], params);
  const [name, setName] = useState(props.defaultName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const title = props.mode === 'rename'
    ? props.type === 'folder' ? dt('library.dialog.renameFolder') : dt('library.dialog.renameCollection')
    : props.type === 'folder' ? dt('library.dialog.newFolder') : dt('library.dialog.newCollection');
  const hint = props.mode === 'rename'
    ? dt('library.dialog.renameHint')
    : props.selectedCount
    ? dt('library.dialog.createSelectedHint', { count: props.selectedCount })
    : props.type === 'folder'
      ? dt('library.dialog.folderHint')
      : dt('library.dialog.collectionHint');

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
            <p className="eyebrow">{dt('library.dialog.eyebrow')}</p>
            <h2 id="organizer-dialog-title">{title}</h2>
          </div>
          <button className="iconMiniButton" type="button" data-tooltip={dt('library.action.close')} aria-label={dt('library.action.close')} onClick={props.onClose}><X size={15} /></button>
        </header>
        <label>
          <span>{dt('library.dialog.name')}</span>
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
          <button type="button" className="confirmCancelButton" onClick={props.onClose}>{dt('library.dialog.cancel')}</button>
          <button type="button" className="confirmPrimaryButton" disabled={!name.trim()} onClick={submit}>{props.mode === 'rename' ? dt('library.dialog.save') : dt('library.dialog.create')}</button>
        </div>
      </section>
    </div>
  );
}

function LibraryAssignDialog(props: {
  t: Translator;
  type: 'folder' | 'collection';
  recordCount: number;
  assignedIds: string[];
  folders: LibraryFolder[];
  collections: LibraryCollection[];
  onClose: () => void;
  onCreate: () => void;
  onSelect: (targetId: string) => void;
}) {
  const dt = (key: string, params?: Record<string, string | number>) => props.t(key as Parameters<Translator>[0], params);
  const items: Array<{ id: string; name: string; color?: string }> = props.type === 'folder'
    ? props.folders.map((folder) => ({ id: folder.id, name: folder.name, color: folder.color }))
    : props.collections.map((collection) => ({ id: collection.id, name: collection.name }));
  const title = props.type === 'folder' ? dt('library.dialog.assignFolder') : dt('library.dialog.assignCollection');
  const emptyText = props.type === 'folder' ? dt('library.organizer.noFolders') : dt('library.organizer.noCollections');

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
            <p className="eyebrow">{dt('library.dialog.eyebrow')}</p>
            <h2>{title}</h2>
            <span>{dt('library.count.items', { count: props.recordCount })}</span>
          </div>
          <button className="iconMiniButton" type="button" data-tooltip={dt('library.action.close')} aria-label={dt('library.action.close')} onClick={props.onClose}><X size={15} /></button>
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
              {isAssigned ? <em>{props.recordCount === 1 ? dt('library.dialog.alreadyHere') : dt('library.dialog.partlyHere')}</em> : null}
            </button>
            );
          }) : (
            <p>{emptyText}</p>
          )}
        </div>
        <button className="assignDialogCreate" type="button" onClick={props.onCreate}>
          <Plus size={14} /> {props.type === 'folder' ? dt('library.dialog.newFolder') : dt('library.dialog.newCollection')}
        </button>
      </section>
    </div>
  );
}

function ConfirmDialog(props: {
  t: Translator;
  request: ConfirmDialogState;
  onClose: () => void;
  onError: (error: string) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const confirmLabel = props.request.confirmLabel ?? props.t('common.confirm');
  const cancelLabel = props.request.cancelLabel ?? props.t('common.cancel');
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
            {isSubmitting ? props.t('common.processing') : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}


function UtilityModalShell(props: { t?: Translator; title: string; eyebrow?: string; className?: string; onClose: () => void; children: ReactNode }) {
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
          <button type="button" data-tooltip={props.t ? props.t('common.close') : 'Close'} aria-label={props.t ? props.t('common.close') : 'Close'} onClick={props.onClose}>
            <X size={18} />
          </button>
        </header>
        {props.children}
      </section>
    </div>
  );
}

function ShortcutsModal(props: { t: Translator; onClose: () => void }) {
  return (
    <UtilityModalShell t={props.t} title={props.t('shortcut.title')} eyebrow="Keyboard Shortcuts" onClose={props.onClose}>
      <div className="shortcutModalContent">
        {shortcutGroups.map((group) => (
          <section className="shortcutGroup" key={group.titleKey}>
            <h3>{props.t(group.titleKey)}</h3>
            <div className="shortcutList">
              {group.items.map((item) => (
                <div className="shortcutRow" key={`${group.titleKey}-${item.actionKey}`}>
                  <div className="shortcutKeys">
                    {item.keys.map((key) => <kbd key={key}>{key}</kbd>)}
                  </div>
                  <span>{props.t(item.actionKey)}</span>
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
  t: Translator;
  desktopRuntime: boolean;
  storageSettings: StorageSettings | null;
  settingsMessage: string;
  onClose: () => void;
}) {
  const rows = [
    { label: props.t('systemInfo.version'), value: APP_VERSION },
    { label: props.t('systemInfo.runtime'), value: props.desktopRuntime ? props.t('systemInfo.runtimeDesktop') : props.t('systemInfo.runtimeWeb') },
    { label: props.t('systemInfo.libraryDir'), value: props.storageSettings?.resolved_library_dir ?? (props.desktopRuntime ? props.t('common.loading') : props.t('systemInfo.desktopOnly')) },
    { label: props.t('systemInfo.defaultLibraryDir'), value: props.storageSettings?.default_library_dir ?? '—' },
    { label: props.t('systemInfo.recentAction'), value: props.settingsMessage || props.t('systemInfo.noRecentAction') }
  ];

  return (
    <UtilityModalShell t={props.t} title={props.t('systemInfo.title')} eyebrow="System" onClose={props.onClose}>
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
  t: Translator;
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
          <button type="button" data-tooltip={props.t('imagePreview.zoomOut')} aria-label={props.t('imagePreview.zoomOut')} onClick={() => zoomBy(-0.2)}>
            <ZoomOut size={16} />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button type="button" data-tooltip={props.t('imagePreview.zoomIn')} aria-label={props.t('imagePreview.zoomIn')} onClick={() => zoomBy(0.2)}>
            <ZoomIn size={16} />
          </button>
          <button type="button" data-tooltip={props.t('imagePreview.fit')} aria-label={props.t('imagePreview.fit')} onClick={resetView}>
            <Maximize2 size={16} />
          </button>
          <button type="button" data-tooltip={props.t('imagePreview.close')} aria-label={props.t('imagePreview.close')} onClick={props.onClose}>
            <X size={18} />
          </button>
        </div>
        {hasPreviewNavigation ? (
          <>
            <button
              className="previewNavButton previous"
              type="button"
              disabled={!canNavigatePrevious}
              data-tooltip={props.t('imagePreview.previous')}
              aria-label={props.t('imagePreview.previous')}
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
              data-tooltip={props.t('imagePreview.next')}
              aria-label={props.t('imagePreview.next')}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                navigatePreview(1);
              }}
            >
              <ChevronRight size={30} />
            </button>
            <div className="previewNavCounter" aria-label={props.t('imagePreview.counter')}>
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
            alt={props.t('imagePreview.alt')}
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
  const isGemini = provider.id === 'gemini-image';
  const firstModel = provider.models[0]?.id ?? '';
  return {
    ...defaultOpenAICompatibleConfig,
    displayName: serviceTemplate?.defaultDisplayName ?? '',
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

function providerUsesConfig(providerId: string) {
  return providerId === 'openai-gpt-image' || providerId === 'custom-http-provider' || providerId === 'minimax-image' || providerId === 'gemini-image';
}

function providerSupportsOpenAICompatibleModelList(providerId: string) {
  return providerId === 'openai-gpt-image' || providerId === 'custom-http-provider';
}

function isMiniMaxProvider(providerId: string) {
  return providerId === 'minimax-image';
}

function isGeminiProvider(providerId: string) {
  return providerId === 'gemini-image';
}

function minimaxModelOptions() {
  return ['image-01', 'image-01-live'];
}

function geminiModelOptions() {
  return ['gemini-2.5-flash-image'];
}

function officialFixedModelOptions(providerId: string) {
  if (isMiniMaxProvider(providerId)) return minimaxModelOptions();
  if (isGeminiProvider(providerId)) return geminiModelOptions();
  return [];
}

function buildMiniMaxManualModelProbe(modelId: string, source: string) {
  const normalizedModelId = modelId.trim();
  const options = minimaxModelOptions();
  const available = Boolean(normalizedModelId) && options.includes(normalizedModelId);
  return {
    modelId: normalizedModelId,
    available,
    checkedAt: new Date().toISOString(),
    message: available
      ? `MiniMax 官方模板内置模型「${normalizedModelId}」。${source}`
      : `MiniMax 当前建议使用 ${options.join(' / ')}；「${normalizedModelId || '未填写'}」未在内置模型里。${source}`
  };
}

function buildGeminiManualModelProbe(modelId: string, source: string) {
  const normalizedModelId = modelId.trim();
  const options = geminiModelOptions();
  const available = Boolean(normalizedModelId) && options.includes(normalizedModelId);
  return {
    modelId: normalizedModelId,
    available,
    checkedAt: new Date().toISOString(),
    message: available
      ? `Gemini 官方模板内置模型「${normalizedModelId}」。${source}`
      : `Gemini 当前建议使用 ${options.join(' / ')}；「${normalizedModelId || '未填写'}」未在内置模型里。${source}`
  };
}

function modelListUnsupportedMessage(providerId: string, modelId: string) {
  if (isMiniMaxProvider(providerId)) {
    const modelProbe = buildMiniMaxManualModelProbe(modelId, 'MiniMax 官方图片接口当前按固定模型 ID 配置，不读取 OpenAI-compatible /v1/models。');
    return modelProbe.message;
  }
  if (isGeminiProvider(providerId)) {
    return buildGeminiManualModelProbe(modelId, 'Gemini 官方图片接口当前按固定模型 ID 配置，不读取 OpenAI-compatible /v1/models。').message;
  }
  return '当前官方 API 暂不提供 OpenAI 兼容模型列表；已保留模板内置模型和手动模型 ID，可继续用真实试生图验证。';
}

function defaultBaseUrlPlaceholder(providerId: string) {
  if (providerId === 'openai-gpt-image') return OFFICIAL_OPENAI_BASE_URL;
  if (providerId === 'minimax-image') return 'https://api.minimaxi.com';
  if (providerId === 'gemini-image') return 'https://generativelanguage.googleapis.com';
  return 'https://你的聚合站或中转站';
}

function defaultEndpointPlaceholder(providerId: string) {
  if (providerId === 'minimax-image') return '/v1/image_generation';
  if (providerId === 'gemini-image') return '/v1beta/models/{model}:generateContent';
  return '/v1/images/generations';
}

function providerEndpointHint(providerId: string) {
  if (providerId === 'minimax-image') {
    return 'MiniMax 官方文生图接口默认使用 /v1/image_generation；这是官方图片 API 路径，不是 OpenAI-compatible /v1/images/generations。';
  }
  if (providerId === 'gemini-image') {
    return 'Gemini 官方图片接口默认使用 /v1beta/models/{model}:generateContent；保存后后端会把 {model} 替换为当前模型 ID。';
  }
  return '可按中转站文档自主修改，例如 /images/generations、/v1/images/generations 或 /v1/responses；保存后真实请求会使用这里的路径。';
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
    'images-minimal': 'Images 精简',
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

function safeProviderConfigText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isProviderConnectionProfileLike(value: unknown): value is ProviderConnectionProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<ProviderConnectionProfile>;
  return typeof candidate.id === 'string' && typeof candidate.providerId === 'string';
}

function providerEndpointPreview(config: Partial<OpenAICompatibleConfig>) {
  const protocol = config.protocol ?? 'images';
  const endpointPath = safeProviderConfigText(config.endpointPath);
  const normalizedPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath || defaultEndpointForProtocol(protocol)}`;
  const modelPath = normalizedPath.replace('{model}', encodeURIComponent(safeProviderConfigText(config.modelId) || '{model}'));
  try {
    const baseUrl = new URL(safeProviderConfigText(config.baseUrl));
    const originAndPath = `${baseUrl.origin}${baseUrl.pathname.replace(/\/+$/, '')}`;
    return `${originAndPath}${modelPath}`;
  } catch {
    return modelPath;
  }
}

function endpointRiskHint(config: Partial<OpenAICompatibleConfig>, providerId: string) {
  const protocol = config.protocol ?? 'images';
  const endpointPath = safeProviderConfigText(config.endpointPath);
  const expectedEndpointPath = isGeminiProvider(providerId)
    ? '/v1beta/models/{model}:generateContent'
    : isMiniMaxProvider(providerId)
      ? '/v1/image_generation'
      : defaultEndpointForProtocol(protocol);
  if (!endpointPath.startsWith('/')) {
    return `\u63a5\u53e3\u8def\u5f84\u5efa\u8bae\u4ee5 / \u5f00\u5934\uff1b\u6309\u5f53\u524d\u534f\u8bae\u9ed8\u8ba4\u5e94\u4e3a ${expectedEndpointPath}\u3002`;
  }
  if (endpointPath !== expectedEndpointPath) {
    return `\u5f53\u524d\u4f7f\u7528\u81ea\u5b9a\u4e49\u8def\u5f84 ${endpointPath}\uff1b\u8bf7\u786e\u8ba4\u670d\u52a1\u5546\u6587\u6863\u8981\u6c42\uff0c\u4e0d\u8981\u628a Base URL \u548c\u63a5\u53e3\u8def\u5f84\u91cd\u590d\u62fc\u63a5\u3002`;
  }
  return `\u5f53\u524d\u4f7f\u7528\u8be5\u534f\u8bae\u7684\u9ed8\u8ba4\u8def\u5f84 ${expectedEndpointPath}\u3002`;
}

function referenceSubmissionHint(config: OpenAICompatibleConfig, providerId: string, template?: ProviderServiceTemplate) {
  const resolved = resolveImageToImageAdapterForDisplay(config, providerId);
  if (template?.supportsImageToImage === false) return '\u5f53\u524d\u670d\u52a1\u6a21\u677f\u6807\u8bb0\u4e3a\u4e0d\u652f\u6301\u56fe\u751f\u56fe\uff1bAI \u521b\u4f5c\u53f0\u4e0d\u5e94\u628a\u53c2\u8003\u56fe\u5f53\u4f5c\u771f\u5b9e\u80fd\u529b\u627f\u8bfa\u3002';
  if (isGeminiProvider(providerId)) return 'Gemini \u5b98\u65b9\u4f1a\u628a\u53c2\u8003\u56fe\u4f5c\u4e3a inlineData parts \u63d0\u4ea4\uff1b\u662f\u5426\u652f\u6301\u591a\u56fe\u7f16\u8f91\u9700\u771f\u5b9e\u5e26\u56fe\u6d4b\u8bd5\u3002';
  if (isMiniMaxProvider(providerId)) return 'MiniMax \u5b98\u65b9\u5f53\u524d\u53ea\u63d0\u4ea4\u7b2c\u4e00\u5f20\u53c2\u8003\u56fe\u4f5c\u4e3a subject_reference.character\uff0c\u591a\u5f20\u53c2\u8003\u56fe\u6682\u4e0d\u53d1\u9001\u3002';
  const hints: Record<Exclude<ImageToImageAdapter, 'auto'>, string> = {
    'openai-images-edit': '\u4f1a\u4f7f\u7528 multipart \u4e0a\u4f20\u53c2\u8003\u56fe\uff0c\u9002\u5408\u5b98\u65b9 Images edits \u8def\u7ebf\u3002',
    'responses-input-image': '\u4f1a\u628a\u53c2\u8003\u56fe\u653e\u5165 Responses input_image \u5185\u5bb9\u5757\u3002',
    'chat-image-url': '\u4f1a\u628a\u53c2\u8003\u56fe\u653e\u5165 Chat Completions image_url \u5185\u5bb9\u5757\u3002',
    'json-image-array': '\u4f1a\u63d0\u4ea4 image \u9996\u56fe\u548c images \u6570\u7ec4\uff0c\u9002\u5408\u81ea\u5b9a\u4e49\u4e2d\u8f6c\u7ad9\uff1b\u5b57\u6bb5\u540d\u9700\u4ee5\u670d\u52a1\u5546\u6587\u6863\u4e3a\u51c6\u3002'
  };
  return hints[resolved];
}

function providerCostRiskHint(config: OpenAICompatibleConfig, template?: ProviderServiceTemplate) {
  const parts = ['\u914d\u7f6e\u81ea\u68c0\u4e0d\u63d0\u4ea4\u751f\u56fe\u8bf7\u6c42\uff0c\u4e0d\u6d88\u8017\u989d\u5ea6\uff1b\u53ea\u6709\u201c\u771f\u5b9e\u8bd5\u751f\u56fe\u201d\u3001AI \u521b\u4f5c\u53f0\u751f\u6210\u6216\u6279\u91cf\u961f\u5217\u6267\u884c\u4f1a\u8c03\u7528\u63a5\u53e3\u3002'];
  if (config.protocol === 'responses' || template?.requiresPolling) {
    parts.push('\u5f53\u524d\u8def\u7ebf\u53ef\u80fd\u5b58\u5728\u5f02\u6b65\u4efb\u52a1\u6216\u540e\u53f0\u8f6e\u8be2\uff1b\u540c\u6b65\u8d85\u65f6\u4e0d\u4e00\u5b9a\u4ee3\u8868\u672a\u6263\u8d39\uff0c\u5931\u8d25\u540e\u5efa\u8bae\u5148\u67e5\u540e\u53f0\u4efb\u52a1\u518d\u91cd\u8bd5\u3002');
  }
  if (template?.status === 'planned' || template?.status === 'local-plan') {
    parts.push('\u8be5\u670d\u52a1\u6a21\u677f\u4ecd\u662f\u89c4\u5212\u72b6\u6001\uff0c\u4e0d\u5e94\u5f00\u653e\u4fdd\u5b58\u542f\u7528\u6216\u771f\u5b9e\u8bd5\u751f\u56fe\u3002');
  }
  return parts.join(' ');
}

function buildProviderStabilityDiagnosticItems(input: {
  config: OpenAICompatibleConfig;
  providerId: string;
  template?: ProviderServiceTemplate;
  supportsModelList: boolean;
}): ProviderDiagnosticItem[] {
  const resolvedAdapter = resolveImageToImageAdapterForDisplay(input.config, input.providerId);
  const template = input.template;
  return [
    {
      id: 'endpoint-preview',
      label: '\u76ee\u6807\u63a5\u53e3\u9884\u89c8',
      level: safeProviderConfigText(input.config.baseUrl) && safeProviderConfigText(input.config.endpointPath) ? 'pass' : 'warn',
      detail: `${providerEndpointPreview(input.config)}\uff1b${endpointRiskHint(input.config, input.providerId)}`
    },
    {
      id: 'capability-boundary',
      label: '\u80fd\u529b\u8fb9\u754c',
      level: template?.status === 'planned' || template?.status === 'local-plan' ? 'info' : 'pass',
      detail: template
        ? `${providerServiceStatusLabel[template.status]} \u00b7 \u6587\u751f\u56fe\uff1a${template.supportsTextToImage === false ? '\u672a\u627f\u8bfa' : '\u53ef\u68c0\u67e5'}\uff1b\u56fe\u751f\u56fe\uff1a${template.supportsImageToImage === false ? '\u672a\u627f\u8bfa' : '\u53ef\u68c0\u67e5'}\uff1b${template.requiresPolling ? '\u53ef\u80fd\u5f02\u6b65\u4efb\u52a1\u3002' : '\u672a\u6807\u8bb0\u5f02\u6b65\u4efb\u52a1\u3002'}`
        : '\u672a\u7ed1\u5b9a\u5177\u4f53\u670d\u52a1\u6a21\u677f\uff1b\u6309\u5f53\u524d Provider \u914d\u7f6e\u505a\u901a\u7528 OpenAI-compatible \u68c0\u67e5\u3002'
    },
    {
      id: 'reference-submission',
      label: '\u53c2\u8003\u56fe\u63d0\u4ea4\u65b9\u5f0f',
      level: template?.supportsImageToImage === false ? 'warn' : 'info',
      detail: `${imageToImageAdapterLabel(resolvedAdapter)}\uff1a${referenceSubmissionHint(input.config, input.providerId, template)}`
    },
    {
      id: 'cost-risk-boundary',
      label: '\u6d88\u8017\u4e0e\u91cd\u8bd5\u8fb9\u754c',
      level: 'info',
      detail: providerCostRiskHint(input.config, template)
    },
    {
      id: 'model-list-boundary',
      label: '\u6a21\u578b\u5217\u8868\u8fb9\u754c',
      level: input.supportsModelList ? 'info' : 'pass',
      detail: input.supportsModelList
        ? '\u5f53\u524d Provider \u652f\u6301\u5c1d\u8bd5\u8bfb\u53d6 /v1/models\uff1b\u5982\u679c\u4e2d\u8f6c\u7ad9\u62e6\u622a\u8be5\u63a5\u53e3\uff0c\u53ef\u624b\u52a8\u586b\u5199\u6a21\u578b ID \u540e\u7528\u771f\u5b9e\u8bd5\u751f\u56fe\u9a8c\u8bc1\u3002'
        : '\u5f53\u524d\u5b98\u65b9\u6a21\u677f\u4e0d\u4f9d\u8d56 /v1/models\uff0c\u6309\u5185\u7f6e\u6216\u624b\u52a8\u6a21\u578b ID \u8bca\u65ad\u3002'
    }
  ];
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
  const isMiniMax = isMiniMaxProvider(input.providerId);
  const isGemini = isGeminiProvider(input.providerId);

  if (isMiniMax) {
    const miniMaxProbe = buildMiniMaxManualModelProbe(
      modelId,
      'MiniMax 官方图片接口当前使用固定模型 ID，不读取 /v1/models。'
    );
    return [
      {
        id: 'config-profile',
        label: '配置实例',
        level: input.profile ? 'pass' : 'info',
        detail: input.profile
          ? '已保存为 MiniMax 官方配置实例，并使用当前配置实例的独立密钥。'
          : '当前仍是 MiniMax 编辑草稿；保存后才会绑定独立密钥。'
      },
      {
        id: 'model-list',
        label: '模型列表',
        level: 'info',
        detail: 'MiniMax 官方图片接口不按 OpenAI-compatible /v1/models 刷新；请在内置 image-01 / image-01-live 或官方确认的新模型之间手动选择。'
      },
      {
        id: 'model-probe',
        label: '当前模型',
        level: miniMaxProbe.available ? 'pass' : 'warn',
        detail: miniMaxProbe.message
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
          ? '最近一次 MiniMax 真实试生图成功，说明当前配置至少通过了官方文生图链路。'
          : hasBaseUrl && modelId && hasEndpointPath && input.secretAvailable && input.desktopRuntime
            ? '基础配置已具备；需要手动点击“真实试生图”才会消耗额度并验证 MiniMax 官方文生图。'
            : '需要补齐桌面端、MiniMax API Key、Base URL、模型 ID 和 /v1/image_generation 路径后，才能真实试生图。'
      },
      {
        id: 'image-to-image',
        label: '图生图',
        level: hasBaseUrl && modelId && hasEndpointPath && input.secretAvailable && input.desktopRuntime ? 'info' : 'warn',
        detail: hasBaseUrl && modelId && hasEndpointPath && input.secretAvailable && input.desktopRuntime
          ? 'MiniMax 图生图会把第一张参考图作为 subject_reference.character 提交；多参考图暂不提交。'
          : '需要补齐桌面端、MiniMax API Key、Base URL、模型 ID 和接口路径后，才能带参考图真实试生图。'
      },
      {
        id: 'multi-reference',
        label: '多参考图',
        level: 'info',
        detail: '当前只提交第一张参考图作为人物主体参考；多张参考图会保留在记录里，但本轮不发送给 MiniMax。'
      }
    ];
  }

  if (isGemini) {
    const geminiProbe = buildGeminiManualModelProbe(
      modelId,
      'Gemini 官方图片接口当前使用固定模型 ID，不读取 /v1/models。'
    );
    return [
      {
        id: 'config-profile',
        label: '配置实例',
        level: input.profile ? 'pass' : 'info',
        detail: input.profile
          ? '已保存为 Gemini 官方配置实例，并使用当前配置实例的独立密钥。'
          : '当前仍是 Gemini 编辑草稿；保存后才会绑定独立密钥。'
      },
      {
        id: 'model-list',
        label: '模型列表',
        level: 'info',
        detail: 'Gemini 官方图片接口按模型 ID 直接调用 generateContent；当前不读取 OpenAI-compatible /v1/models。'
      },
      {
        id: 'model-probe',
        label: '当前模型',
        level: geminiProbe.available ? 'pass' : 'warn',
        detail: geminiProbe.message
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
          ? '最近一次 Gemini 真实试生图成功，说明当前配置至少通过了官方文生图链路。'
          : hasBaseUrl && modelId && hasEndpointPath && input.secretAvailable && input.desktopRuntime
            ? '基础配置已具备；需要手动点击“真实试生图”才会消耗额度并验证 Gemini 官方文生图。'
            : '需要补齐桌面端、Gemini API Key、Base URL、模型 ID 和 generateContent 路径后，才能真实试生图。'
      },
      {
        id: 'image-to-image',
        label: '图生图 / 编辑',
        level: hasBaseUrl && modelId && hasEndpointPath && input.secretAvailable && input.desktopRuntime ? 'info' : 'warn',
        detail: hasBaseUrl && modelId && hasEndpointPath && input.secretAvailable && input.desktopRuntime
          ? 'Gemini 图生图会把参考图作为 inlineData parts 与文本提示一起提交；真实效果需要带参考图试生图验证。'
          : '需要补齐桌面端、Gemini API Key、Base URL、模型 ID 和接口路径后，才能带参考图真实试生图。'
      },
      {
        id: 'multi-reference',
        label: '多参考图',
        level: 'info',
        detail: '当前会把已添加参考图作为多个 inlineData parts 提交；多参考效果以后续真实测试为准。'
      }
    ];
  }

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
    return `接口路径可能不匹配：请检查 Base URL、协议和接口路径。原始错误：${message}`;
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

