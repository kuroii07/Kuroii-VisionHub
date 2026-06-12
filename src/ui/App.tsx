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
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import type { InspirationAsset } from '../domain/inspirationTypes';
import type { GenerationRecord, ImageToImageAdapter, ProviderCapabilityStatus, ReferenceImage } from '../domain/providerTypes';
import { listProviders } from '../providers/registry';
import {
  chooseLibraryDir,
  deleteProviderSecret,
  getProviderSecretStatus,
  exportSettingsBackup,
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
  revealLibraryDir,
  saveGenerationRecord,
  saveLibraryData,
  saveProviderSecret,
  saveTextFileWithDialog,
  saveStorageSettings,
  type LibraryDataPayload,
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
  DEFAULT_SIZE_OPTIONS,
  GENERATOR_ACCENT_OPTIONS,
  getRecommendedGlobalAccent,
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
  type PromptHistorySettings,
  type PromptPolishSettings,
  type ThemeMode
} from '../services/appSettings';
import { getPolishModesForEngine, resolvePolishMode } from '../services/promptAssist';
import {
  PROMPT_TEMPLATE_CATEGORIES,
  loadPromptTemplates,
  savePromptTemplates,
  type PromptTemplate
} from '../services/promptTemplates';
import { FREE_PLATFORMS, type FreePlatform } from '../services/freePlatforms';
import { readStorageValue, writeStorageValue } from '../services/safeStorage';
import { useStudioStore } from '../store/useStudioStore';
import { ModernGeneratePage } from './GeneratePage';
import { InspirationPage } from './InspirationPage';
import { StudioSelect } from './StudioSelect';
import type { ConfirmDialogRequest } from './confirmDialog';
import { appToastEventName, defaultToastDurationMs, useToastMessage, type ToastEventDetail, type ToastLevel } from './toast';

type Page = AppPage;
type ProviderDiagnosticLevel = 'pass' | 'warn' | 'fail' | 'info';
type ProviderPlatformType = 'aggregator' | 'official' | 'local';
type ProviderServiceTemplateStatus = 'connected' | 'configurable' | 'planned' | 'local-plan';
type ProviderMatrixStatus = 'live' | 'configurable' | 'partial' | 'planned' | 'localPlan' | 'unsupported' | 'unknown';
type ProviderMatrixCapabilityKey =
  | 'textToImage'
  | 'imageToImage'
  | 'multiReferenceImage'
  | 'imagesApi'
  | 'responsesApi'
  | 'openAICompatible'
  | 'officialProtocol'
  | 'localService';
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
  providerId?: string;
  defaultDisplayName?: string;
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

const LIBRARY_META_STORAGE_KEY = 'visionhub.library.meta.v1';
const LIBRARY_DISPLAY_STORAGE_KEY = 'visionhub.library.display.v1';
const LIBRARY_CUSTOM_QUICK_FILTERS_STORAGE_KEY = 'visionhub.library.customQuickFilters.v1';
const LIBRARY_ORGANIZATION_STORAGE_KEY = 'visionhub.library.organization.v1';

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
    providerId: 'custom-http-provider',
    defaultDisplayName: 'OpenAI 兼容中转',
    notes: ['Base URL、模型 ID、协议路径以服务商文档为准。', '旧的中转站配置会自动归到这里，profile id 不会变化。']
  },
  {
    id: 'aggregator-generic-api',
    platformType: 'aggregator',
    label: '聚合网站 API',
    description: '通用聚合站模板；能保存配置，图片能力取决于服务商实际支持。',
    status: 'configurable',
    providerId: 'custom-http-provider',
    defaultDisplayName: '聚合网站 API',
    notes: ['适合没有明确品牌模板的聚合 API。', '保存前请按服务商文档填写 Base URL、模型 ID 和协议。']
  },
  {
    id: 'openrouter',
    platformType: 'aggregator',
    label: 'OpenRouter',
    description: '先作为 OpenAI-compatible 模板；图片能力待按服务商实际接口验证。',
    status: 'configurable',
    providerId: 'custom-http-provider',
    defaultDisplayName: 'OpenRouter',
    notes: ['可保存连接配置；是否能生成图片取决于 OpenRouter 当前模型与图片接口支持。']
  },
  {
    id: 'dmxapi',
    platformType: 'aggregator',
    label: 'DMXAPI',
    description: '先作为聚合站模板；图片能力待验证。',
    status: 'configurable',
    providerId: 'custom-http-provider',
    defaultDisplayName: 'DMXAPI',
    notes: ['可保存连接配置；试生图前请确认服务商文档中的模型 ID 和路径。']
  },
  {
    id: 'siliconflow',
    platformType: 'aggregator',
    label: '硅基流动',
    description: '先作为聚合站模板；图片能力待验证。',
    status: 'configurable',
    providerId: 'custom-http-provider',
    defaultDisplayName: '硅基流动',
    notes: ['可保存连接配置；图片模型和 OpenAI-compatible 兼容程度以服务商为准。']
  },
  {
    id: 'lmrouter',
    platformType: 'aggregator',
    label: 'LMRouter',
    description: '先作为聚合站模板；图片能力待验证。',
    status: 'configurable',
    providerId: 'custom-http-provider',
    defaultDisplayName: 'LMRouter',
    notes: ['可保存连接配置；图片能力需要按实际模型返回验证。']
  },
  {
    id: 'aggregator-custom',
    platformType: 'aggregator',
    label: '其他聚合站',
    description: '通用自定义模板，适合其他 OpenAI-compatible 聚合 API。',
    status: 'configurable',
    providerId: 'custom-http-provider',
    defaultDisplayName: '其他聚合站',
    notes: ['保留最大手动配置空间，适合服务商文档比较特殊的场景。']
  },
  {
    id: 'official-openai',
    platformType: 'official',
    label: 'OpenAI 官方',
    description: '当前真实可用；仅用于 https://api.openai.com。',
    status: 'connected',
    providerId: 'openai-gpt-image',
    defaultDisplayName: 'OpenAI 官方',
    notes: ['ChatGPT Plus 网页额度不等于 API 额度。', '旧官方 OpenAI 配置会自动归到这里，profile id 不会变化。']
  },
  {
    id: 'official-gemini',
    platformType: 'official',
    label: 'Google Gemini / Nano Banana 官方',
    description: '待接入；当前只展示规划，不允许保存启用或试生图。',
    status: 'planned',
    notes: ['后续需要单独实现官方 API adapter、鉴权和图片返回解析。']
  },
  {
    id: 'official-xai',
    platformType: 'official',
    label: 'xAI 官方',
    description: '待接入；当前只展示规划，不允许保存启用或试生图。',
    status: 'planned',
    notes: ['后续按官方图片接口能力接入。']
  },
  {
    id: 'official-volcengine',
    platformType: 'official',
    label: '火山方舟 / Seedream 官方',
    description: '待接入；当前只展示规划，不允许保存启用或试生图。',
    status: 'planned',
    notes: ['后续需要接入火山鉴权、模型参数和结果落盘链路。']
  },
  {
    id: 'official-bailian',
    platformType: 'official',
    label: '阿里百炼 / 通义万相官方',
    description: '待接入；当前只展示规划，不允许保存启用或试生图。',
    status: 'planned',
    notes: ['后续需要接入官方鉴权与异步任务轮询。']
  },
  {
    id: 'official-fal',
    platformType: 'official',
    label: 'fal.ai',
    description: '待接入；当前只展示规划，不允许保存启用或试生图。',
    status: 'planned',
    notes: ['后续按 fal.ai 图片任务接口实现。']
  },
  {
    id: 'official-replicate',
    platformType: 'official',
    label: 'Replicate',
    description: '待接入；当前只展示规划，不允许保存启用或试生图。',
    status: 'planned',
    notes: ['后续需要模型级参数表单和任务轮询。']
  },
  {
    id: 'official-stability',
    platformType: 'official',
    label: 'Stability AI',
    description: '待接入；当前只展示规划，不允许保存启用或试生图。',
    status: 'planned',
    notes: ['后续按官方生图与编辑接口拆分配置。']
  },
  {
    id: 'official-kling',
    platformType: 'official',
    label: '可灵企业 API',
    description: '待接入；当前只展示规划，不允许保存启用或试生图。',
    status: 'planned',
    notes: ['后续可作为图像 / 视频生成企业 API 路线。']
  },
  {
    id: 'official-jimeng',
    platformType: 'official',
    label: '即梦企业 API',
    description: '待接入；当前只展示规划，不允许保存启用或试生图。',
    status: 'planned',
    notes: ['后续可作为国内官方企业 API 路线。']
  },
  {
    id: 'local-comfyui',
    platformType: 'local',
    label: 'ComfyUI',
    description: '本地模型路线规划；暂不允许保存启用或试生图。',
    status: 'local-plan',
    notes: ['后续需要工作流 JSON、节点参数映射和本地队列轮询。']
  },
  {
    id: 'local-sd-webui',
    platformType: 'local',
    label: 'Stable Diffusion WebUI / Forge',
    description: '本地模型路线规划；暂不允许保存启用或试生图。',
    status: 'local-plan',
    notes: ['后续接入本地 endpoint、采样器、尺寸和 ControlNet 参数。']
  },
  {
    id: 'local-invokeai',
    platformType: 'local',
    label: 'InvokeAI',
    description: '本地模型路线规划；暂不允许保存启用或试生图。',
    status: 'local-plan',
    notes: ['后续按 InvokeAI API 能力接入。']
  },
  {
    id: 'local-swarmui',
    platformType: 'local',
    label: 'SwarmUI',
    description: '本地模型路线规划；暂不允许保存启用或试生图。',
    status: 'local-plan',
    notes: ['后续按本地任务队列和模型列表接入。']
  },
  {
    id: 'local-fooocus',
    platformType: 'local',
    label: 'Fooocus',
    description: '本地模型路线规划；暂不允许保存启用或试生图。',
    status: 'local-plan',
    notes: ['后续评估可用 API 与参数覆盖范围。']
  },
  {
    id: 'local-openai-compatible',
    platformType: 'local',
    label: 'LocalAI / OpenAI-compatible 本地服务',
    description: '本地模型路线规划；暂不允许保存启用或试生图。',
    status: 'local-plan',
    notes: ['后续可复用 OpenAI-compatible 调用层，但需要独立本地服务发现和安全提示。']
  },
  {
    id: 'local-ollama',
    platformType: 'local',
    label: 'Ollama',
    description: '本地文本润色优先，不作为生图主入口。',
    status: 'local-plan',
    notes: ['后续优先接入提示词润色，不默认作为图片生成平台。']
  }
];

const providerServiceStatusLabel: Record<ProviderServiceTemplateStatus, string> = {
  connected: '已接入',
  configurable: '可配置',
  planned: '待接入',
  'local-plan': '本地规划'
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
  { value: 'all', label: '全部颜色', color: 'linear-gradient(135deg, #ef4444, #f59e0b, #22c55e, #38bdf8, #8b5cf6)' },
  { value: 'red', label: '红色', color: '#ef4444' },
  { value: 'orange', label: '橙色', color: '#f97316' },
  { value: 'yellow', label: '黄色', color: '#eab308' },
  { value: 'green', label: '绿色', color: '#22c55e' },
  { value: 'cyan', label: '青色', color: '#06b6d4' },
  { value: 'blue', label: '蓝色', color: '#3b82f6' },
  { value: 'purple', label: '紫色', color: '#8b5cf6' },
  { value: 'pink', label: '粉色', color: '#ec4899' },
  { value: 'mono', label: '黑白', color: 'linear-gradient(135deg, #111827 0 45%, #f8fafc 45% 100%)' }
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
    '安全说明：本报告不会包含 API Key；Provider profile 的密钥仍绑定在系统凭据中，secret id 形如 profile:{profileId}。'
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
  if (status === 'planned') return `${columnLabel} 仅路线展示，当前不会开放保存、启用或试生图。`;
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
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [isRunningTestGeneration, setIsRunningTestGeneration] = useState(false);
  const [providerDiagnostics, setProviderDiagnostics] = useState<ProviderDiagnosticItem[]>([]);
  const [generatePreviewUrl, setGeneratePreviewUrl] = useState<string | null>(null);
  const [libraryPreview, setLibraryPreview] = useState<ImagePreviewState | null>(null);
  const [inspirationPreview, setInspirationPreview] = useState<ImagePreviewState | null>(null);
  const [isLibraryPageMounted, setIsLibraryPageMounted] = useState(() => page === 'library');
  const [isInspirationPageMounted, setIsInspirationPageMounted] = useState(() => page === 'inspiration');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => appSettings.sidebarCollapsed);
  const [storageSettings, setStorageSettings] = useState<StorageSettings | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [generateSessionStartedAt] = useState(() => Date.now());
  const autoRecheckedRecordIdsRef = useRef<Set<string>>(new Set());
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const themeMode = appSettings.themeMode;
  const resolvedThemeMode = themeMode === 'system' ? systemTheme : themeMode;

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
  const desktopRuntime = isTauriRuntime();
  const supportsOpenAICompatible =
    selectedProvider.id === 'openai-gpt-image' || selectedProvider.id === 'custom-http-provider';
  const generationSupportsOpenAICompatible =
    selectedProviderId === 'openai-gpt-image' || selectedProviderId === 'custom-http-provider';
  const isRealProviderReady = desktopRuntime && generationSupportsOpenAICompatible && secretAvailable;
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
      : {
          ...loadProviderConfig(selectedProvider.id),
          displayName: selectedProvider.name
        };
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
    if (template.providerId) {
      setSelectedProvider(template.providerId);
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
      setConfigMessage(`${enabled ? '已启用' : '已停用'}：${profile.displayName}`);
    }
  }

  function updateProviderProfileTestState(
    profileId: string | null,
    status: ProviderConnectionProfile['lastTestStatus'],
    latencyMs: number,
    message: string
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

  async function refreshModels() {
    if (!isSelectedServiceConfigurable) {
      setConfigMessage('当前服务模板尚未接入，暂不能刷新模型。');
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
    try {
      const models = await listOpenAICompatibleModels(
        selectedProvider.id,
        providerConfig.baseUrl,
        parseExtraHeaders(providerConfig.extraHeadersJson),
        activeSecretId()
      );
      const modelOptions = models.map((model) => model.id);
      const nextModelId =
        modelOptions.find((id) => id === providerConfig.modelId) ??
        modelOptions.find((id) => id.toLowerCase().includes('image')) ??
        modelOptions[0] ??
        providerConfig.modelId;
      const nextConfig = { ...providerConfig, modelOptions, modelId: nextModelId };
      setProviderConfig(nextConfig);
      saveProviderConfig(selectedProvider.id, nextConfig);
      if (selectedProfile) {
        persistProfile({ ...selectedProfile, ...nextConfig });
      }
      setSelectedModel(nextModelId);
      setConfigMessage(`已刷新 ${modelOptions.length} 个模型。`);
    } catch (error) {
      if (isModelListUnavailableError(error)) {
        const nextConfig = ensureManualModelOption(providerConfig);
        setProviderConfig(nextConfig);
        saveProviderConfig(selectedProvider.id, nextConfig);
        if (selectedProfile) {
          persistProfile({ ...selectedProfile, ...nextConfig });
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
    const targetSupportsOpenAICompatible =
      targetProviderId === 'openai-gpt-image' || targetProviderId === 'custom-http-provider';
    const startedAt = performance.now();
    let profileStatus: ProviderConnectionProfile['lastTestStatus'] = 'warning';
    let profileMessage = '诊断未完成。';

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
        detail: targetSupportsOpenAICompatible ? '当前平台支持 OpenAI-compatible 官方或聚合站配置。' : '当前平台仍是路线图占位，暂不支持真实连通性诊断。'
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
          ? `当前密钥通道：${targetSecretId}。配置 ID 保持不变，系统凭据不会随文案调整重建。`
          : '当前是临时配置草稿；保存为配置实例后会使用 profile:{profileId} 独立绑定密钥。'
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
        const imageModelCount = models.filter((model) => model.id.toLowerCase().includes('image')).length;
        profileStatus = models.length > 0 ? 'passed' : 'warning';
        profileMessage =
          models.length > 0
            ? `连接成功，延迟 ${latencyMs} ms，读取 ${models.length} 个模型。`
            : `接口可调用，延迟 ${latencyMs} ms，但没有返回模型。`;
        push({
          id: 'models',
          label: '模型列表连通性',
          level: models.length > 0 ? 'pass' : 'warn',
          detail: models.length > 0 ? `成功读取 ${models.length} 个模型，其中 ${imageModelCount} 个 ID 包含 image；延迟 ${latencyMs} ms。` : `接口可调用但没有返回模型；延迟 ${latencyMs} ms，已保留当前手动模型 ID。`
        });
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
        profileMessage
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
      setConfigMessage('当前服务模板尚未接入，暂不能试生图。');
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
      className={`appShell theme-${resolvedThemeMode} ${isSidebarCollapsed ? 'sidebarCollapsed' : ''}`}
      style={appShellStyle}
    >
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark" aria-hidden="true">
            <span className="brandGlyph">VH</span>
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

      <main className={`workspace ${page === 'generate' ? 'workspaceGenerate' : ''}`}>
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
          />
        ) : null}
        {page === 'generate' ? (
          <>
            <ModernGeneratePage
              providers={providers}
              selectedProvider={generationSelectedProvider}
              selectedProviderId={selectedProviderId}
              supportsOpenAICompatible={generationSupportsOpenAICompatible}
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
              onGenerate={generate}
              onPreview={setGeneratePreviewUrl}
              onReloadHistory={loadHistory}
              onOpenLibrary={() => navigateTo('library')}
              onDeleteResult={removeResult}
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
            onImportLibrary={() => {
              navigateTo('library');
              setFreePlatformMessage('请把网页下载的图片拖入或通过后续导入入口加入作品画廊。');
            }}
          />
        ) : page === 'providers' ? (
          <ProviderSettingsPage
            providers={providers}
            selectedProvider={selectedProvider}
            selectedProviderId={selectedProvider.id}
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
            supportsOpenAICompatible={supportsOpenAICompatible}
            onPlatformTypeChange={selectPlatformType}
            onServiceTemplateChange={selectServiceTemplate}
            onSecretDraftChange={setSecretDraft}
            onSaveSecret={saveActiveProviderSecret}
            onConfigChange={handleConfigChange}
            onRefreshModels={refreshModels}
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
        <div className="pageTitleBlock">
          <p className="eyebrow">Free Platform Studio</p>
          <h1>免费平台</h1>
          <p>用网页登录额度试平台；稳定自动生成仍建议走已保存的 API Key 配置。</p>
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

      <section className="freePlatformGrid">
        {filteredPlatforms.map((platform) => (
          <article className="freePlatformCard" key={platform.id}>
            <div className="freePlatformHeader">
              <div
                className="freePlatformLogo"
                style={{ background: platform.brandColor }}
                aria-label={`${platform.name} Logo`}
              >
                <img
                  src={platform.logoUrl}
                  alt=""
                  loading="lazy"
                  onError={(event) => {
                    const image = event.currentTarget;
                    if (image.dataset.fallback !== 'used') {
                      image.dataset.fallback = 'used';
                      image.src = platform.fallbackLogoUrl;
                      return;
                    }
                    image.style.display = 'none';
                  }}
                />
                <span>{platform.logoText}</span>
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
  supportsOpenAICompatible: boolean;
  onPlatformTypeChange: (platformType: ProviderPlatformType) => void;
  onServiceTemplateChange: (templateId: string) => void;
  onSecretDraftChange: (secret: string) => void;
  onSaveSecret: () => void;
  onConfigChange: <K extends keyof OpenAICompatibleConfig>(key: K, value: OpenAICompatibleConfig[K]) => void;
  onRefreshModels: () => void;
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
  isRunningDiagnostics: boolean;
  isRunningTestGeneration: boolean;
  diagnostics: ProviderDiagnosticItem[];
}) {
  const diagnosticsSummary = {
    pass: props.diagnostics.filter((item) => item.level === 'pass').length,
    warn: props.diagnostics.filter((item) => item.level === 'warn').length,
    fail: props.diagnostics.filter((item) => item.level === 'fail').length,
    info: props.diagnostics.filter((item) => item.level === 'info').length
  };
  const selectedPlatform = props.platformOptions.find((item) => item.id === props.selectedPlatformType);
  const serviceTemplateOptions = props.serviceTemplates.map((template) => ({
    value: template.id,
    label: `${template.label} · ${providerServiceStatusLabel[template.status]}`,
    description: template.description
  }));
  const providerMatrixRows = props.serviceTemplates.map((template) => ({
    template,
    cells: providerMatrixColumns.map((column) => getProviderCapabilityMatrixCell(template, column, props.providers))
  }));
  const [isCapabilityMatrixOpen, setIsCapabilityMatrixOpen] = useState(false);
  const summaryColumnKeys: ProviderMatrixCapabilityKey[] = [
    'textToImage',
    'imageToImage',
    'multiReferenceImage',
    props.selectedPlatformType === 'aggregator'
      ? 'openAICompatible'
      : props.selectedPlatformType === 'official'
        ? 'officialProtocol'
        : 'localService'
  ];
  const selectedCapabilitySummary = summaryColumnKeys.map((key) => {
    const column = providerMatrixColumns.find((item) => item.key === key) ?? providerMatrixColumns[0];
    return {
      column,
      cell: getProviderCapabilityMatrixCell(props.selectedServiceTemplate, column, props.providers)
    };
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

  return (
    <>
      <header className="topbar">
        <div className="pageTitleBlock">
          <p className="eyebrow">Platform Access</p>
          <h1>平台接入</h1>
          <p>默认从中转站 / 聚合 API 开始；官方和本地待接入模板只展示规划，不会误触保存、启用或试生图。</p>
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
              <small>{props.providerProfiles.length} 个当前服务模板配置</small>
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
          <div className="profileList">
            {!props.isSelectedServiceConfigurable ? (
              <div className="profileEmpty">
                <strong>{providerServiceStatusLabel[props.selectedServiceTemplate.status]}</strong>
                <span>当前模板只展示规划，暂不开放保存、启用或试生图。</span>
              </div>
            ) : props.providerProfiles.length === 0 ? (
              <div className="profileEmpty">
                <strong>还没有配置</strong>
                <span>点击新增后保存，配置会出现在这里。</span>
              </div>
            ) : (
              props.providerProfiles.map((profile) => (
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
                      {profile.lastLatencyMs ? <span>{profile.lastLatencyMs} ms</span> : null}
                      {profile.enabled ? <span className="enabled">已启用</span> : <span>未启用</span>}
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
          <div className="providerHero">
            <Globe2 size={22} />
            <div>
              <h2>{props.selectedServiceTemplate.label}</h2>
              <p>
                {providerServiceStatusLabel[props.selectedServiceTemplate.status]} · {props.selectedServiceTemplate.description}
              </p>
            </div>
            <span className={`serviceStatusBadge ${props.selectedServiceTemplate.status}`}>
              {providerServiceStatusLabel[props.selectedServiceTemplate.status]}
            </span>
          </div>

          <div className="providerCapabilitySummary">
            <div className="providerCapabilitySummaryText">
              <strong>当前能力</strong>
              <small>完整矩阵按需展开，配置详情保持优先。</small>
            </div>
            <div className="providerCapabilitySummaryCells" aria-label="当前服务模板关键能力">
              {selectedCapabilitySummary.map(({ column, cell }) => (
                <span
                  className={`capabilityCell ${cell.status}`}
                  title={`${column.label}：${cell.label}。${cell.detail}`}
                  key={column.key}
                >
                  {column.label} · {cell.label}
                </span>
              ))}
            </div>
            <button
              type="button"
              className={`capabilityMatrixToggle ${isCapabilityMatrixOpen ? 'open' : ''}`}
              onClick={() => setIsCapabilityMatrixOpen((value) => !value)}
              aria-expanded={isCapabilityMatrixOpen}
            >
              <ChevronRight size={15} /> {isCapabilityMatrixOpen ? '收起矩阵' : '查看矩阵'}
            </button>
          </div>

          {props.isSelectedServiceConfigurable && props.supportsOpenAICompatible ? (
            <div className="relayBox standalone">
              <div className="serviceTemplateNotes">
                {props.selectedServiceTemplate.notes.map((note) => (
                  <span key={note}>{note}</span>
                ))}
              </div>
              <strong>配置详情</strong>
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
                  placeholder={props.selectedProviderId === 'openai-gpt-image' ? OFFICIAL_OPENAI_BASE_URL : 'https://你的聚合站或中转站'}
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
                  <button className="iconButton" onClick={props.onRefreshModels} disabled={props.isRefreshingModels}>
                    {props.isRefreshingModels ? '…' : '刷新'}
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
                  placeholder="/v1/images/generations"
                />
                <small className="providerFieldHint">
                  可按中转站文档自主修改，例如 /images/generations、/v1/images/generations 或 /v1/responses；保存后真实请求会使用这里的路径。
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
              <div className="relaySaveGrid">
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
              </div>
              <div className="providerConfigActions">
                <button className="ghostButton" type="button" onClick={props.onCopyConfig}>
                  <Copy size={15} /> 复制配置
                </button>
                <button className="ghostButton" type="button" onClick={props.onImportConfig}>
                  <ClipboardPaste size={15} /> 粘贴配置
                </button>
              </div>
              <div className="providerDiagnostics">
                <div className="diagnosticsHeader">
                  <div>
                    <strong>配置自检报告</strong>
                    <small>检查配置实例、密钥通道、Base URL、Headers、模型、协议路径、图生图映射、提示词润色凭据、保存目录和模型列表连通性。</small>
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
                      title={!props.secretAvailable ? '请先保存 API Key' : '调用真实接口生成 1 张测试小样'}
                    >
                      <Sparkles size={15} /> {props.isRunningTestGeneration ? '测试中…' : '试生图'}
                    </button>
                  </div>
                </div>
                {props.diagnostics.length === 0 ? (
                  <p className="diagnosticsHint">保存配置后可运行自检；如果没有 API Key，也会先给出本地配置、凭据通道、提示词润色和图库目录检查结果。</p>
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
              <div className="serviceTemplateNotes">
                {props.selectedServiceTemplate.notes.map((note) => (
                  <span key={note}>{note}</span>
                ))}
              </div>
            </div>
          )}

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
                        <small>{providerServiceStatusLabel[row.template.status]} · {row.template.description}</small>
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
        </div>
      </section>
    </>
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
  onOpenAppDataDirectory: () => void;
  onExportSettingsBackup: () => void;
  onOpenSystemInfo: () => void;
  onOpenShortcuts: () => void;
  onCheckUpdates: () => void;
}) {
  const settings = props.appSettings;
  const generationDefaults = settings.generationDefaults;
  const promptHistory = settings.promptHistory;
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
          <div className="settingsInlineGrid">
            <StudioSelect
              value={promptPolish.engine}
              onChange={(value) => updatePromptPolish({ engine: value as PromptPolishSettings['engine'] }, { commit: true })}
              options={PROMPT_POLISH_ENGINE_OPTIONS}
            />
            <button
              className={promptPolish.fallbackToLocal ? 'settingsTogglePill active' : 'settingsTogglePill'}
              onClick={() => updatePromptPolish({ fallbackToLocal: !promptPolish.fallbackToLocal }, { commit: true })}
            >
              失败时本地兜底
            </button>
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
            <div className="settingsConfigActions settingsWideField">
              <button type="button" className="rowActionButton" onClick={props.onSavePromptPolishConfig}>
                <ShieldCheck size={14} /> 保存润色配置
              </button>
              <small>保存配置不会保存 API Key；API Key 仍需单独点击上方“保存”。</small>
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
            <small>{'\u5bfc\u51fa\u5e94\u7528\u8bbe\u7f6e\u3001\u5e73\u53f0\u914d\u7f6e\u548c\u672c\u5730\u5386\u53f2\u3002API Key \u4e0d\u4f1a\u88ab\u5bfc\u51fa\u3002'}</small>
          </div>
          <button className="rowActionButton" disabled={!props.desktopRuntime} onClick={props.onExportSettingsBackup}>
            <Download size={15} /> {'\u5bfc\u51fa\u8bbe\u7f6e'}
          </button>
        </div>
      </article>

      <div className="settingsSectionLabel">软件升级</div>
      <article className="settingsGroupCard">
        <div className="settingsListRow themeSettingsRow">
          <div className="settingsRowMain">
            <strong>版本</strong>
          </div>
          <span className="settingsValue">0.3.0</span>
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
    const menuHeight = 260;
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
            <div className="libraryDetailOrganizerSection">
              <div className="libraryDetailOrganizerHeader">
                <strong>归类</strong>
                <div>
                  <button className="iconMiniButton" type="button" data-tooltip="移至文件夹" aria-label="移至文件夹" onClick={() => setAssignDialog({ type: 'folder', recordIds: [selectedRecord.id] })}><FolderOpen size={14} /></button>
                  <button className="iconMiniButton" type="button" data-tooltip="加入收藏集" aria-label="加入收藏集" onClick={() => setAssignDialog({ type: 'collection', recordIds: [selectedRecord.id] })}><Bookmark size={14} /></button>
                  {(libraryScope.type === 'folder' || libraryScope.type === 'collection') ? (
                    <button className="iconMiniButton" type="button" data-tooltip="移出当前分类" aria-label="移出当前分类" onClick={() => removeRecordsFromCurrentScope([selectedRecord.id])}><X size={14} /></button>
                  ) : null}
                </div>
              </div>
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
            <div className="libraryDetailSection promptDetailSection">
              <strong>Prompt</strong>
              <p>{selectedRecord.prompt}</p>
            </div>
            <div className="libraryDetailActions">
              <button className={`miniButton ${libraryMeta[selectedRecord.id]?.favorite ? 'active' : ''}`} onClick={() => toggleFavorite(selectedRecord.id)}><Star size={13} /> {libraryMeta[selectedRecord.id]?.favorite ? '已收藏' : '收藏'}</button>
              <button className="miniButton" disabled={!selectedRecord.imageUrls[0]} onClick={() => useRecordAsReference(selectedRecord)}><ImagePlus size={13} /> 设为参考图</button>
              <button className="miniButton" onClick={() => props.onRetryRecord(selectedRecord)}><RefreshCcw size={13} /> 重新生成</button>
              {selectedRecord.error || selectedRecord.status === 'failed' ? (
                <button className="miniButton" onClick={() => openRecordDiagnostics(selectedRecord)}><Gauge size={13} /> 查看诊断</button>
              ) : null}
              <button className="miniButton" onClick={() => void copyText('Prompt', selectedRecord.prompt)}><Copy size={13} /> Prompt</button>
              <button className="miniButton" disabled={!getRecordPrimaryPath(selectedRecord)} onClick={() => void copyText('Path', getRecordPrimaryPath(selectedRecord))}><Copy size={13} /> 路径</button>
              <button className="miniButton" disabled={!selectedRecord.localImagePaths?.[0]} onClick={() => selectedRecord.localImagePaths?.[0] && void revealGenerationFile(selectedRecord.localImagePaths[0])}><FolderOpen size={13} /> 文件夹</button>
              <button className="miniButton danger" onClick={() => void deleteRecord(selectedRecord.id)}><Trash2 size={13} /> 删除记录</button>
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
  const templates = useMemo(() => loadPromptTemplates(), []);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [copyMessage, setCopyMessage] = useState('');
  useToastMessage(copyMessage, setCopyMessage);
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
        <div className="pageTitleBlock">
          <p className="eyebrow">Prompt Templates</p>
          <h1>{'\u63d0\u793a\u8bcd\u5e93'}</h1>
          <p>{'\u5feb\u901f\u5957\u7528\u89d2\u8272\u3001\u4ea7\u54c1\u3001\u6d77\u62a5\u3001\u573a\u666f\u548c\u98ce\u683c\u63a2\u7d22\u7684\u5e38\u7528\u63d0\u793a\u8bcd\u3002'}</p>
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
    { label: '版本', value: '0.3.0' },
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
  const firstModel = provider.models[0]?.id ?? '';
  return {
    ...defaultOpenAICompatibleConfig,
    displayName: serviceTemplate?.defaultDisplayName ?? '',
    baseUrl: isOfficialOpenAI ? OFFICIAL_OPENAI_BASE_URL : '',
    modelId: firstModel,
    protocol: 'images',
    endpointPath: defaultEndpointForProtocol('images'),
    extraHeadersJson: '{}',
    modelOptions: provider.models.map((model) => model.id)
  };
}

function getProviderServiceTemplatesForPlatform(platformType: ProviderPlatformType) {
  return providerServiceTemplates.filter((template) => template.platformType === platformType);
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
  return providerServiceTemplates.find((template) => template.providerId === providerId);
}

function providerProfileBelongsToTemplate(
  profile: ProviderConnectionProfile,
  template: ProviderServiceTemplate
) {
  if (!template.providerId || profile.providerId !== template.providerId) return false;
  if (profile.serviceTemplateId) return profile.serviceTemplateId === template.id;
  return template.id === 'aggregator-openai-compatible' || template.id === 'official-openai';
}

function providerGenerationLabel(provider: ReturnType<typeof listProviders>[number]) {
  const template = getDefaultProviderServiceTemplateForProvider(provider.id);
  const platform = template
    ? providerPlatformOptions.find((item) => item.id === template.platformType)
    : undefined;
  return template && platform ? `${platform.label} · ${template.label}` : provider.name;
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
  return `模型列表无法读取，但这不影响手动模型使用。已保留「${modelLabel}」；如果中转站不开放 /v1/models 或被 Cloudflare 拦截，请直接保存，再用左侧延迟测试或右侧试生图验证。原始提示：${mapped}`;
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
    return '模型列表接口返回了网页验证页，而不是 JSON。通常是中转站的 /v1/models 被 Cloudflare 或权限策略拦截；请手动填写模型 ID 后保存，再用左侧延迟测试或右侧试生图验证。';
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






