import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GalleryHorizontal,
  History,
  Library,
  ImagePlus,
  ListChecks,
  Maximize2,
  PanelRight,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  XCircle
} from 'lucide-react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent } from 'react';
import { listProviders } from '../providers/registry';
import type {
  DefaultGenerationMode,
  OutputFormat,
  PromptHistorySettings,
  PromptPolishSettings
} from '../services/appSettings';
import type { GenerationMode, GenerationRecord, ReferenceImage } from '../domain/providerTypes';
import { getDefaultPolishMode, polishPrompt, PROMPT_STYLE_PRESETS, resolvePolishMode, type PromptAssistMode } from '../services/promptAssist';
import { isTauriRuntime, polishPromptWithProvider, referenceImagesFromPaths } from '../services/desktopApi';
import { PROMPT_POLISH_SECRET_ID, promptPolishConfigId } from '../services/appSettings';
import { parseExtraHeaders, type OpenAICompatibleConfig } from '../services/providerConfig';
import type { ProviderConnectionProfile } from '../services/providerProfiles';
import { diagnoseGenerationFailure, isPotentialBackgroundCompletion } from '../services/generationErrorDiagnostics';
import { readStorageValue, writeStorageValue } from '../services/safeStorage';
import { useStudioStore } from '../store/useStudioStore';
import type { ConfirmDialogRequest } from './confirmDialog';
import { PromptAssistModal } from './PromptAssistModal';
import { StudioSelect } from './StudioSelect';

type GenerateSubmitOptions = {
  mode?: GenerationMode;
  references?: ReferenceImage[];
  outputFormat?: OutputFormat;
  outputCompression?: number;
  negativePrompt?: string;
  seed?: number;
  metadata?: Record<string, unknown>;
};

type SizeOption = {
  value: string;
  ratio: string;
  desc: string;
  badge: string;
  experimental?: boolean;
};

const SIZE_OPTIONS: SizeOption[] = [
  { value: '1024x1024', ratio: '1:1', desc: 'AI 绘图标准正方形', badge: '1K' },
  { value: '1280x1280', ratio: '1:1', desc: '高清头像 / 商品主图', badge: '2K' },
  { value: '1536x1536', ratio: '1:1', desc: '艺术插画头像 / 专辑封面', badge: '2K' },
  { value: '2048x2048', ratio: '1:1', desc: '极致高清正方形素材', badge: '4K', experimental: true },

  { value: '1280x720', ratio: '16:9', desc: '720P 标清宽屏', badge: '1K' },
  { value: '1536x864', ratio: '16:9', desc: '常见网页 / 大屏配图', badge: '2K' },
  { value: '2048x1152', ratio: '16:9', desc: '高清横屏壁纸', badge: '2K' },
  { value: '2560x1440', ratio: '16:9', desc: '2K 极清画质，标准上限', badge: '2K' },
  { value: '3840x2160', ratio: '16:9', desc: '4K 顶级画质，极限图像', badge: '4K', experimental: true },

  { value: '720x1280', ratio: '9:16', desc: '手机短视频封面 / 故事', badge: '1K' },
  { value: '864x1536', ratio: '9:16', desc: '移动端高清竖屏', badge: '2K' },
  { value: '1152x2048', ratio: '9:16', desc: '手机超清壁纸', badge: '2K' },
  { value: '1440x2560', ratio: '9:16', desc: '2K 手机屏 / 全面屏', badge: '2K' },
  { value: '2160x3840', ratio: '9:16', desc: '4K 竖屏极限', badge: '4K', experimental: true },

  { value: '1792x768', ratio: '21:9', desc: '电影感宽画幅 / 横版 Banner', badge: '2K' },
  { value: '2240x960', ratio: '21:9', desc: '带鱼屏游戏壁纸 / 宽景概念图', badge: '2K' },
  { value: '2576x1104', ratio: '21:9', desc: '极宽超清场景设计', badge: '2K' },
  { value: '3136x1344', ratio: '21:9', desc: '电影级巨幕宽画幅', badge: '4K', experimental: true },

  { value: '1024x768', ratio: '4:3', desc: '经典平板 / iPad 基础画幅', badge: '1K' },
  { value: '1280x960', ratio: '4:3', desc: '传统演示文档 / 幻灯片', badge: '2K' },
  { value: '2048x1536', ratio: '4:3', desc: '视网膜屏高清画幅', badge: '2K' },
  { value: '2688x2016', ratio: '4:3', desc: '高画质经典插画', badge: '4K', experimental: true },

  { value: '768x1024', ratio: '3:4', desc: '电子书 / 常规竖直排版', badge: '1K' },
  { value: '960x1280', ratio: '3:4', desc: '电商主图 / 详情页首选', badge: '2K' },
  { value: '1536x2048', ratio: '3:4', desc: '高清平板竖屏海报', badge: '2K' },
  { value: '2016x2688', ratio: '3:4', desc: '艺术海报 / 精细出版', badge: '4K', experimental: true },

  { value: '1152x768', ratio: '3:2', desc: '横向摄影 / 基础画幅', badge: '1K' },
  { value: '1536x1024', ratio: '3:2', desc: '横版封面 / 场景图', badge: '2K' },
  { value: '2304x1536', ratio: '3:2', desc: '高清横版摄影比例', badge: '2K' },
  { value: '3072x2048', ratio: '3:2', desc: '4K 横版精细输出', badge: '4K', experimental: true },

  { value: '768x1152', ratio: '2:3', desc: '竖版海报 / 基础画幅', badge: '1K' },
  { value: '1024x1536', ratio: '2:3', desc: '竖版角色图 / 海报', badge: '2K' },
  { value: '1536x2304', ratio: '2:3', desc: '高清竖版人像海报', badge: '2K' },
  { value: '2048x3072', ratio: '2:3', desc: '4K 竖版精细输出', badge: '4K', experimental: true },

  { value: '1280x1024', ratio: '5:4', desc: '传统显示器 / 产品图', badge: '1K' },
  { value: '1600x1280', ratio: '5:4', desc: '高清产品展示画幅', badge: '2K' },
  { value: '2560x2048', ratio: '5:4', desc: '高精细产品海报', badge: '2K' },
  { value: '3200x2560', ratio: '5:4', desc: '4K 产品图精细输出', badge: '4K', experimental: true },

  { value: '1024x1280', ratio: '4:5', desc: '社媒帖子 / 竖版构图', badge: '1K' },
  { value: '1280x1600', ratio: '4:5', desc: '小红书 / 电商竖图', badge: '2K' },
  { value: '2048x2560', ratio: '4:5', desc: '高清竖版商业海报', badge: '2K' },
  { value: '2560x3200', ratio: '4:5', desc: '4K 竖版精细输出', badge: '4K', experimental: true }
];

const REFERENCE_ROLE_OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: 'composition', label: '构图' },
  { value: 'style', label: '风格' },
  { value: 'character', label: '角色' },
  { value: 'color', label: '颜色' }
];

type ReferenceDragState = 'supported' | 'unsupported' | null;
type ReferenceNoticeTone = 'success' | 'warning' | 'error';

type ReferenceNotice = {
  tone: ReferenceNoticeTone;
  text: string;
};
type PromptDraftKind = 'manual' | 'previous' | 'polished' | 'retry';
type PromptDraft = {
  id: string;
  title: string;
  prompt: string;
  kind: PromptDraftKind;
  createdAt: string;
};

type CanvasPreviewBatchMeta = {
  sourceResultId?: string;
  imageIndex?: number;
  total?: number;
};

type CanvasPreviewItem = {
  record: GenerationRecord;
  imageUrl: string;
  localPath?: string;
  imageIndex: number;
  total: number;
};

const SUPPORTED_REFERENCE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const SUPPORTED_REFERENCE_PATH_PATTERN = /\.(png|jpe?g|webp)$/i;
const PROMPT_DRAFT_STORAGE_KEY = 'visionhub.generate.promptDrafts.v1';
const CANVAS_CLEARED_STORAGE_KEY = 'visionhub.generate.canvasClearedAfter.v1';
const CANVAS_GENERATION_MODES = ['text-to-image', 'image-to-image'] as const;
type CanvasGenerationMode = (typeof CANVAS_GENERATION_MODES)[number];

const RATIO_OPTIONS = [
  { label: '1:1', size: '1024x1024', w: 18, h: 18 },
  { label: '16:9', size: '1280x720', w: 24, h: 14 },
  { label: '9:16', size: '720x1280', w: 12, h: 24 },
  { label: '21:9', size: '1792x768', w: 28, h: 12 },
  { label: '4:3', size: '1024x768', w: 22, h: 16 },
  { label: '3:4', size: '768x1024', w: 16, h: 22 },
  { label: '3:2', size: '1152x768', w: 22, h: 15 },
  { label: '2:3', size: '768x1152', w: 15, h: 22 },
  { label: '5:4', size: '1280x1024', w: 22, h: 18 },
  { label: '4:5', size: '1024x1280', w: 18, h: 22 }
];

function parseSize(size: string) {
  const match = /^(\d+)x(\d+)$/.exec(size.trim());
  if (!match) return [1024, 1024] as const;
  return [Number(match[1]), Number(match[2])] as const;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function ratioFromSize(size: string) {
  const known = SIZE_OPTIONS.find((item) => item.value === size);
  if (known) return known.ratio;
  const [width, height] = parseSize(size);
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function isKnown4KUnsupportedModel(providerId: string, modelId: string) {
  const normalizedModel = modelId.trim().toLowerCase();
  if (providerId === 'openai-gpt-image') return true;
  return normalizedModel === 'gpt-image-1';
}

function normalizeDimension(value: number) {
  if (!Number.isFinite(value)) return 1024;
  return Math.max(64, Math.min(4096, Math.round(value)));
}

function generationTimeMs(createdAt: string) {
  const numeric = Number(createdAt);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = new Date(createdAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function readCanvasPreviewBatchMeta(record: GenerationRecord): CanvasPreviewBatchMeta | null {
  const raw = record.raw;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const maybeMeta = (raw as { visionhub_split_image_record?: unknown }).visionhub_split_image_record;
  if (!maybeMeta || typeof maybeMeta !== 'object' || Array.isArray(maybeMeta)) return null;
  const meta = maybeMeta as Record<string, unknown>;
  const imageIndex = typeof meta.imageIndex === 'number' && Number.isFinite(meta.imageIndex) ? meta.imageIndex : undefined;
  const total = typeof meta.total === 'number' && Number.isFinite(meta.total) ? meta.total : undefined;
  return {
    sourceResultId: typeof meta.sourceResultId === 'string' ? meta.sourceResultId : undefined,
    imageIndex: imageIndex && imageIndex > 0 ? imageIndex : undefined,
    total: total && total > 0 ? total : undefined
  };
}

function canvasPreviewBatchKey(record: GenerationRecord) {
  return readCanvasPreviewBatchMeta(record)?.sourceResultId ?? record.id;
}

function canvasPreviewSortIndex(record: GenerationRecord, fallbackIndex: number) {
  return readCanvasPreviewBatchMeta(record)?.imageIndex ?? fallbackIndex + 1;
}

function providerAccessLabel(provider: ReturnType<typeof listProviders>[number]) {
  if (provider.id === 'custom-http-provider') return '中转站 / 聚合 API · OpenAI 兼容中转';
  if (provider.id === 'openai-gpt-image') return '官方 API · OpenAI 官方';
  if (provider.id === 'minimax-image') return '官方 API · MiniMax 官方';
  if (provider.id === 'gemini-image') return '官方 API · Gemini / Nano Banana 官方';
  if (provider.phase === 'local-lab') return `本地模型 · ${provider.name}`;
  return provider.name;
}

function providerAccessDescription(provider: ReturnType<typeof listProviders>[number]) {
  if (provider.id === 'custom-http-provider') return '默认主入口，使用平台接入页保存的中转站 / 聚合 API 配置。';
  if (provider.id === 'openai-gpt-image') return '官方 OpenAI API，使用 https://api.openai.com。';
  if (provider.id === 'minimax-image') return 'MiniMax 官方图片 API，支持文生图和单张人物主体参考图，使用平台接入页保存的 MiniMax API Key 和配置实例。';
  if (provider.id === 'gemini-image') return 'Gemini 官方图片 API，支持文生图和参考图编辑，使用平台接入页保存的 Gemini API Key 和配置实例。';
  if (provider.id === 'comfyui-local') return '本地 ComfyUI：使用平台接入页导入的 API workflow 提交本地生成。';
  if (provider.phase === 'local-lab') return '本地模型路线暂为规划入口，不作为当前生图主通道。';
  return provider.notes[0] ?? '平台能力以当前模板和服务商文档为准。';
}

function profileStatusLabel(status: ProviderConnectionProfile['lastTestStatus']) {
  if (status === 'passed') return '已验证';
  if (status === 'warning') return '注意';
  if (status === 'failed') return '失败';
  return '未测试';
}

function compactModelLabel(modelId: string) {
  const cleaned = modelId.trim();
  return cleaned
    .replace(/^deepseek-/i, 'DS ')
    .replace(/^gpt-/i, '')
    .replace(/^claude-/i, 'Claude ')
    .replace(/^qwen-/i, 'Qwen ')
    .slice(0, 20);
}

function formatDraftTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function promptDraftKindLabel(kind: PromptDraftKind) {
  const labels: Record<PromptDraftKind, string> = {
    manual: '手动',
    previous: '上一版',
    polished: '润色',
    retry: '重试'
  };
  return labels[kind];
}

function normalizePromptDrafts(value: unknown): PromptDraft[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const draft = item as Partial<PromptDraft>;
      const prompt = typeof draft.prompt === 'string' ? draft.prompt.trim() : '';
      if (!prompt) return null;
      const kind: PromptDraftKind =
        draft.kind === 'previous' || draft.kind === 'polished' || draft.kind === 'retry' ? draft.kind : 'manual';
      return {
        id: typeof draft.id === 'string' && draft.id ? draft.id : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: typeof draft.title === 'string' && draft.title.trim() ? draft.title.trim() : prompt.slice(0, 28),
        prompt,
        kind,
        createdAt: typeof draft.createdAt === 'string' && draft.createdAt ? draft.createdAt : new Date().toISOString()
      };
    })
    .filter((item): item is PromptDraft => Boolean(item))
    .slice(0, 20);
}

function loadPromptDrafts() {
  const raw = readStorageValue(PROMPT_DRAFT_STORAGE_KEY);
  if (!raw) return [];
  try {
    return normalizePromptDrafts(JSON.parse(raw));
  } catch (error) {
    console.warn('[VisionHub] prompt draft parse failed; using empty drafts', error);
    return [];
  }
}

function savePromptDrafts(drafts: PromptDraft[]) {
  const normalized = normalizePromptDrafts(drafts).slice(0, 12);
  writeStorageValue(PROMPT_DRAFT_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function normalizeCanvasClearedAfter(value: unknown): Partial<Record<CanvasGenerationMode, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const source = value as Record<string, unknown>;
  const normalized: Partial<Record<CanvasGenerationMode, number>> = {};
  for (const mode of CANVAS_GENERATION_MODES) {
    const raw = source[mode];
    const numeric = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
    if (Number.isFinite(numeric) && numeric > 0) {
      normalized[mode] = numeric;
    }
  }
  return normalized;
}

function loadCanvasClearedAfter(): Partial<Record<CanvasGenerationMode, number>> {
  const raw = readStorageValue(CANVAS_CLEARED_STORAGE_KEY);
  if (!raw) return {};

  try {
    return normalizeCanvasClearedAfter(JSON.parse(raw));
  } catch (error) {
    console.warn('[VisionHub] canvas cleared state parse failed; using empty state', error);
    return {};
  }
}

function saveCanvasClearedAfter(value: Partial<Record<CanvasGenerationMode, number>>) {
  const normalized = normalizeCanvasClearedAfter(value);
  writeStorageValue(CANVAS_CLEARED_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function buildPromptDraft(prompt: string, kind: PromptDraftKind, title?: string): PromptDraft | null {
  const trimmed = prompt.trim();
  if (!trimmed) return null;
  const label = title || `${promptDraftKindLabel(kind)}草稿`;
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `${label} · ${trimmed.slice(0, 22)}`,
    prompt: trimmed,
    kind,
    createdAt: new Date().toISOString()
  };
}

function mergePromptDraft(drafts: PromptDraft[], draft: PromptDraft | null) {
  if (!draft) return drafts;
  const normalizedPrompt = draft.prompt.trim();
  if (!normalizedPrompt) return drafts;
  const deduped = drafts.filter((item) => item.prompt.trim() !== normalizedPrompt);
  return [draft, ...deduped].slice(0, 12);
}

function resolveActivePromptPolishConfigId(settings: PromptPolishSettings) {
  const currentConfigId = promptPolishConfigId(settings.displayName, settings.baseUrl);
  const exactConfig = settings.savedConfigs.find((config) => config.id === currentConfigId);
  return exactConfig?.id ?? settings.savedConfigs[0]?.id ?? '__current__';
}

function referenceSourceLabel(source: ReferenceImage['source']) {
  const labels: Record<ReferenceImage['source'], string> = {
    upload: '本地',
    'generated-result': '作品',
    clipboard: '剪贴板',
    'drag-drop': '拖拽',
    inspiration: '灵感'
  };
  return labels[source] ?? source;
}

export function ModernGeneratePage(props: {
  providers: ReturnType<typeof listProviders>;
  selectedProvider: ReturnType<typeof listProviders>[number];
  selectedProviderId: string;
  supportsOpenAICompatible: boolean;
  isRealProviderReady: boolean;
  providerConfig: OpenAICompatibleConfig;
  activeProfile: Pick<ProviderConnectionProfile, 'id' | 'displayName' | 'enabled' | 'lastTestStatus' | 'lastModelProbe'> | null;
  providerProfiles: Pick<ProviderConnectionProfile, 'id' | 'displayName' | 'modelId' | 'baseUrl' | 'enabled' | 'lastTestStatus'>[];
  activeProfileSecretAvailable: boolean;
  selectedModelId: string;
  prompt: string;
  count: number;
  size: string;
  quality: string;
  isGenerating: boolean;
  isHistoryLoaded: boolean;
  results: ReturnType<typeof useStudioStore.getState>['results'];
  defaultMode: DefaultGenerationMode;
  defaultOutputFormat: OutputFormat;
  defaultReferenceRole: NonNullable<ReferenceImage['role']>;
  promptHistorySettings: PromptHistorySettings;
  promptPolishSettings: PromptPolishSettings;
  sessionStartedAtMs: number;
  onProviderChange: (providerId: string) => void;
  onProfileChange: (profileId: string) => void;
  onModelChange: (modelId: string) => void;
  onPromptChange: (prompt: string) => void;
  onCountChange: (count: number) => void;
  onSizeChange: (size: string) => void;
  onQualityChange: (quality: string) => void;
  onGenerate: (options?: GenerateSubmitOptions) => void;
  onAddToBatchQueue?: (options?: GenerateSubmitOptions) => void;
  onAddCompareGroupToBatchQueue?: (profileIds: string[], options?: GenerateSubmitOptions) => void;
  batchQueueTaskCount?: number;
  onPreview: (imageUrl: string) => void;
  onReloadHistory: () => void | Promise<void>;
  onOpenLibrary: () => void;
  onDeleteResult: (recordId: string) => Promise<void>;
  onRequestConfirm: (request: ConfirmDialogRequest) => void;
  referenceImages: ReferenceImage[];
  onReferenceImagesChange: (references: ReferenceImage[]) => void;
}) {
  const [mode, setMode] = useState<DefaultGenerationMode>(props.defaultMode);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(props.defaultOutputFormat);
  const [compression, setCompression] = useState('');
  const [promptStyleId, setPromptStyleId] = useState('auto');
  const [seedInput, setSeedInput] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [referenceStrength, setReferenceStrength] = useState('auto');
  const [referenceRoles, setReferenceRoles] = useState<Record<string, string>>({});
  const [preserveComposition, setPreserveComposition] = useState(true);
  const [styleTransfer, setStyleTransfer] = useState(false);
  const [customWidth, setCustomWidth] = useState(() => parseSize(props.size)[0]);
  const [customHeight, setCustomHeight] = useState(() => parseSize(props.size)[1]);
  const [assistMode, setAssistMode] = useState<PromptAssistMode | null>(null);
  const [quickPolishConfigId, setQuickPolishConfigId] = useState(() =>
    props.promptPolishSettings.engine === 'local' ? '__local__' : resolveActivePromptPolishConfigId(props.promptPolishSettings)
  );
  const [isQuickPolishing, setIsQuickPolishing] = useState(false);
  const [referenceDragState, setReferenceDragState] = useState<ReferenceDragState>(null);
  const [draggingReferenceId, setDraggingReferenceId] = useState<string | null>(null);
  const [referenceDropTargetId, setReferenceDropTargetId] = useState<string | null>(null);
  const [referenceNotice, setReferenceNotice] = useState<ReferenceNotice | null>(null);
  const [promptDrafts, setPromptDrafts] = useState<PromptDraft[]>(() => loadPromptDrafts());
  const [draftNotice, setDraftNotice] = useState('');
  const [isDraftLibraryOpen, setIsDraftLibraryOpen] = useState(false);
  const [canvasPreviewIndex, setCanvasPreviewIndex] = useState(0);
  const [activeGeneratingMode, setActiveGeneratingMode] = useState<GenerationMode | null>(null);
  const [canvasClearedAfterByMode, setCanvasClearedAfterByMode] = useState<Partial<Record<CanvasGenerationMode, number>>>(() => loadCanvasClearedAfter());
  const [compareProfileIds, setCompareProfileIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const referenceNoticeTimerRef = useRef<number | null>(null);
  const draftNoticeTimerRef = useRef<number | null>(null);
  const modelOptions = props.supportsOpenAICompatible
    ? props.providerConfig.modelOptions.length > 0
      ? props.providerConfig.modelOptions
      : [props.providerConfig.modelId]
    : props.selectedProvider.models.map((model) => model.id);
  const promptPolishConfigOptions = props.promptPolishSettings.savedConfigs.length > 0
    ? props.promptPolishSettings.savedConfigs
    : [{
        id: '__current__',
        displayName: props.promptPolishSettings.displayName,
        baseUrl: props.promptPolishSettings.baseUrl,
        modelId: props.promptPolishSettings.modelId,
        modelOptions: props.promptPolishSettings.modelOptions,
        extraHeadersJson: props.promptPolishSettings.extraHeadersJson,
        protocol: props.promptPolishSettings.protocol
      }];
  const quickPolishOptions = [
    { value: '__local__', label: '本地规则', description: '不调用模型' },
    ...promptPolishConfigOptions.slice(0, 6).map((config) => ({
      value: config.id,
      label: compactModelLabel(config.modelId || config.displayName) || config.displayName,
      description: config.displayName
    }))
  ];
  const selectedQuickPolishValue = quickPolishOptions.some((option) => option.value === quickPolishConfigId)
    ? quickPolishConfigId
    : props.promptPolishSettings.engine === 'local'
      ? '__local__'
      : resolveActivePromptPolishConfigId(props.promptPolishSettings);
  const selectedQuickPolishConfig = promptPolishConfigOptions.find((config) => config.id === selectedQuickPolishValue);
  const providerProfileOptions = props.providerProfiles.map((profile) => ({
    value: profile.id,
    label: profile.displayName || profile.modelId || '未命名配置',
    description: `${profile.modelId || '未设置模型'} · ${profile.enabled ? '当前启用' : profileStatusLabel(profile.lastTestStatus)}`
  }));
  const compareProfileCandidates = useMemo(
    () => props.supportsOpenAICompatible
      ? props.providerProfiles.filter((profile) => profile.modelId.trim())
      : [],
    [props.providerProfiles, props.supportsOpenAICompatible]
  );
  const compareCandidateIdSet = useMemo(
    () => new Set(compareProfileCandidates.map((profile) => profile.id)),
    [compareProfileCandidates]
  );
  const selectedCompareProfileIds = compareProfileIds.filter((profileId) => compareCandidateIdSet.has(profileId));
  const selectedCompareProfileCount = selectedCompareProfileIds.length;
  const canCreateCompareGroup = Boolean(
    props.onAddCompareGroupToBatchQueue &&
    props.supportsOpenAICompatible &&
    selectedCompareProfileCount >= 2 &&
    !props.isGenerating
  );
  const effectivePromptPolishSettings: PromptPolishSettings =
    selectedQuickPolishValue === '__local__'
      ? { ...props.promptPolishSettings, engine: 'local' }
      : {
          ...props.promptPolishSettings,
          engine: 'provider',
          displayName: selectedQuickPolishConfig?.displayName ?? props.promptPolishSettings.displayName,
          baseUrl: selectedQuickPolishConfig?.baseUrl ?? props.promptPolishSettings.baseUrl,
          modelId: selectedQuickPolishConfig?.modelId ?? props.promptPolishSettings.modelId,
          modelOptions: selectedQuickPolishConfig?.modelOptions ?? props.promptPolishSettings.modelOptions,
          extraHeadersJson: selectedQuickPolishConfig?.extraHeadersJson ?? props.promptPolishSettings.extraHeadersJson,
          protocol: selectedQuickPolishConfig?.protocol ?? props.promptPolishSettings.protocol
        };
  const isComfyUILocalProvider = props.selectedProvider.id === 'comfyui-local';
  const modelValue = props.supportsOpenAICompatible ? props.providerConfig.modelId : props.selectedModelId;
  const activeProfileName = isComfyUILocalProvider
    ? 'ComfyUI 本地 workflow'
    : props.activeProfile?.displayName ?? (props.supportsOpenAICompatible ? '未保存配置实例' : props.selectedProvider.name);
  const activeProfileStatus = isComfyUILocalProvider
    ? '本地服务'
    : props.activeProfile
    ? props.activeProfile.lastTestStatus === 'passed'
      ? '已验证'
      : props.activeProfile.lastTestStatus === 'warning'
        ? '注意'
        : props.activeProfile.lastTestStatus === 'failed'
          ? '失败'
          : '未测试'
    : props.supportsOpenAICompatible ? '草稿 / 旧配置' : '内置平台';
  const activeProfileSecretText = isComfyUILocalProvider
    ? '无需密钥'
    : props.activeProfileSecretAvailable ? '密钥已绑定' : '密钥未绑定';
  const activeProfileModelProbeText = isComfyUILocalProvider
    ? props.isRealProviderReady ? 'API workflow 可提交' : '需导入 API workflow'
    : props.activeProfile?.lastModelProbe
    ? props.activeProfile.lastModelProbe.available ? '当前模型已命中' : '当前模型未命中'
    : '模型未探测';
  const topbarProviderSummary = props.supportsOpenAICompatible
    ? `${providerAccessLabel(props.selectedProvider)} · ${activeProfileName} · ${modelValue}`
    : `${providerAccessLabel(props.selectedProvider)} · ${modelValue}`;
  const selectedRatio = ratioFromSize(props.size);
  const selectedSize = SIZE_OPTIONS.find((item) => item.value === props.size);
  const currentRatioSizes = useMemo(() => SIZE_OPTIONS.filter((item) => item.ratio === selectedRatio), [selectedRatio]);
  const sessionResults = useMemo(
    () => props.results.filter((result) => generationTimeMs(result.createdAt) >= props.sessionStartedAtMs),
    [props.results, props.sessionStartedAtMs]
  );
  const currentGenerationMode: CanvasGenerationMode = mode === 'image' ? 'image-to-image' : 'text-to-image';
  const currentModeCanvasClearedAt = canvasClearedAfterByMode[currentGenerationMode] ?? 0;
  const currentModeSessionResults = useMemo(
    () => sessionResults.filter((result) => (
      (result.generationMode ?? 'text-to-image') === currentGenerationMode
      && generationTimeMs(result.createdAt) > currentModeCanvasClearedAt
    )),
    [currentGenerationMode, currentModeCanvasClearedAt, sessionResults]
  );
  const latestCanvasRecord = currentModeSessionResults.find((result) => result.imageUrls[0]);
  const latestCanvasBatchKey = latestCanvasRecord ? canvasPreviewBatchKey(latestCanvasRecord) : null;
  const canvasPreviewItems = useMemo<CanvasPreviewItem[]>(() => {
    if (!latestCanvasBatchKey) return [];
    const sameBatchRecords = currentModeSessionResults.filter((record) => {
      if (!record.imageUrls[0]) return false;
      return canvasPreviewBatchKey(record) === latestCanvasBatchKey;
    });
    const fallbackTotal = sameBatchRecords.reduce((total, record) => total + Math.max(1, record.imageUrls.length), 0);
    const declaredTotal = sameBatchRecords
      .map((record) => readCanvasPreviewBatchMeta(record)?.total)
      .find((total): total is number => typeof total === 'number' && total > 0);

    const items = sameBatchRecords.flatMap((record) =>
      record.imageUrls.map((imageUrl, index) => ({
        record,
        imageUrl,
        localPath: record.localImagePaths?.[index],
        imageIndex: canvasPreviewSortIndex(record, index),
        total: declaredTotal ?? fallbackTotal
      }))
    );

    return items.sort(
      (a, b) => a.imageIndex - b.imageIndex || generationTimeMs(b.record.createdAt) - generationTimeMs(a.record.createdAt)
    );
  }, [currentModeSessionResults, latestCanvasBatchKey]);
  const safeCanvasPreviewIndex = Math.min(canvasPreviewIndex, Math.max(canvasPreviewItems.length - 1, 0));
  const activeCanvasPreviewItem = canvasPreviewItems[safeCanvasPreviewIndex] ?? canvasPreviewItems[0];
  const canvasPreviewTotal = canvasPreviewItems.length;
  const canvasPreviewPosition = activeCanvasPreviewItem ? safeCanvasPreviewIndex + 1 : 0;
  const latestCurrentModeResult = currentModeSessionResults[0];
  const isCurrentModeGenerating = props.isGenerating && activeGeneratingMode === currentGenerationMode;
  const generateButtonLabel = isCurrentModeGenerating
    ? '画布渲染中…'
    : props.isGenerating
      ? '另一模式处理中…'
      : mode === 'image'
        ? '参考重绘'
        : '点亮画布';
  const failedLatest = !isCurrentModeGenerating && latestCurrentModeResult?.status === 'failed'
    ? latestCurrentModeResult
    : undefined;
  const failedLatestDiagnosis = failedLatest ? diagnoseGenerationFailure(failedLatest) : null;
  const failedLatestNeedsCheck = isPotentialBackgroundCompletion(failedLatest);
  const imageToImageStatus = props.selectedProvider.capabilities.imageToImage;
  const multiReferenceStatus = props.selectedProvider.capabilities.multiReferenceImage;
  const advancedImageTuningEnabled = ['supported', 'partial'].includes(imageToImageStatus);
  const multiReferenceAllowed = ['supported', 'partial'].includes(multiReferenceStatus);
  const promptLength = props.prompt.trim().length;
  const promptWidthState =
    promptLength === 0 ? 'promptEmpty' : promptLength < 24 ? 'promptShort' : promptLength < 60 ? 'promptMedium' : 'promptLong';
  const referenceStatusText = referenceNotice?.text
    ?? (props.referenceImages.length >= 4
      ? '已满 4 张，可拖拽排序或清空后再加'
      : props.referenceImages.length > 0
        ? '拖拽缩略图可调整顺序'
        : '拖拽到此处或 Ctrl+V 粘贴');

  useEffect(() => {
    setCanvasPreviewIndex((index) => {
      if (!latestCanvasBatchKey || canvasPreviewItems.length <= 1) return 0;
      return Math.min(index, canvasPreviewItems.length - 1);
    });
  }, [canvasPreviewItems.length, latestCanvasBatchKey]);

  useEffect(() => {
    if (!props.isGenerating) {
      setActiveGeneratingMode(null);
    }
  }, [props.isGenerating]);

  useEffect(() => {
    setMode(props.defaultMode);
  }, [props.defaultMode]);

  useEffect(() => {
    setQuickPolishConfigId(props.promptPolishSettings.engine === 'local' ? '__local__' : resolveActivePromptPolishConfigId(props.promptPolishSettings));
  }, [props.promptPolishSettings.engine, props.promptPolishSettings.displayName, props.promptPolishSettings.baseUrl, props.promptPolishSettings.modelId, props.promptPolishSettings.savedConfigs]);

  useEffect(() => {
    setOutputFormat(props.defaultOutputFormat);
  }, [props.defaultOutputFormat]);

  useEffect(() => {
    setCompareProfileIds((current) => {
      const validCurrent = current.filter((profileId) => compareCandidateIdSet.has(profileId));
      if (validCurrent.length > 0) return validCurrent;
      const activeProfileId = props.activeProfile?.id && compareCandidateIdSet.has(props.activeProfile.id)
        ? props.activeProfile.id
        : compareProfileCandidates[0]?.id;
      if (!activeProfileId) return [];
      const secondProfileId = compareProfileCandidates.find((profile) => profile.id !== activeProfileId)?.id;
      return secondProfileId ? [activeProfileId, secondProfileId] : [activeProfileId];
    });
  }, [compareCandidateIdSet, compareProfileCandidates, props.activeProfile?.id]);

  useEffect(() => {
    if (props.referenceImages.length > 0) {
      setMode('image');
    }
  }, [props.referenceImages.length]);

  useEffect(() => () => {
    if (referenceNoticeTimerRef.current) {
      window.clearTimeout(referenceNoticeTimerRef.current);
    }
    if (draftNoticeTimerRef.current) {
      window.clearTimeout(draftNoticeTimerRef.current);
    }
  }, []);

  function normalizeReferences(nextReferences: ReferenceImage[]) {
    const uniqueReferences: ReferenceImage[] = [];
    const seen = new Set<string>();
    for (const reference of nextReferences) {
      const key = referenceDedupKey(reference);
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueReferences.push(reference);
    }
    return uniqueReferences.slice(0, 4);
  }

  function showReferenceNotice(text: string, tone: ReferenceNoticeTone = 'success') {
    setReferenceNotice({ text, tone });
    if (referenceNoticeTimerRef.current) {
      window.clearTimeout(referenceNoticeTimerRef.current);
    }
    referenceNoticeTimerRef.current = window.setTimeout(() => {
      setReferenceNotice(null);
      referenceNoticeTimerRef.current = null;
    }, tone === 'success' ? 2200 : 3200);
  }

  function showDraftNotice(text: string) {
    setDraftNotice(text);
    if (draftNoticeTimerRef.current) {
      window.clearTimeout(draftNoticeTimerRef.current);
    }
    draftNoticeTimerRef.current = window.setTimeout(() => {
      setDraftNotice('');
      draftNoticeTimerRef.current = null;
    }, 2400);
  }

  function updatePromptDrafts(nextDrafts: PromptDraft[]) {
    setPromptDrafts(savePromptDrafts(nextDrafts));
  }

  function saveCurrentPromptDraft(kind: PromptDraftKind = 'manual', title?: string) {
    const draft = buildPromptDraft(props.prompt, kind, title);
    if (!draft) {
      showDraftNotice('当前 Prompt 为空，未保存草稿。');
      return;
    }
    updatePromptDrafts(mergePromptDraft(promptDrafts, draft));
    showDraftNotice('Prompt 草稿已保存。');
  }

  function applyPromptDraft(draft: PromptDraft) {
    if (props.prompt.trim() && props.prompt.trim() !== draft.prompt.trim()) {
      updatePromptDrafts(mergePromptDraft(promptDrafts, buildPromptDraft(props.prompt, 'previous', '替换前')));
    }
    props.onPromptChange(draft.prompt);
    promptInputRef.current?.focus();
    showDraftNotice('已回填草稿到当前 Prompt。');
  }

  function deletePromptDraft(draftId: string) {
    updatePromptDrafts(promptDrafts.filter((draft) => draft.id !== draftId));
    showDraftNotice('已删除草稿。');
  }

  function applyCustomSize() {
    const width = normalizeDimension(customWidth);
    const height = normalizeDimension(customHeight);
    setCustomWidth(width);
    setCustomHeight(height);
    props.onSizeChange(`${width}x${height}`);
  }

  function applyAssistedPrompt(nextPrompt: string, placement: 'replace' | 'append') {
    const trimmed = nextPrompt.trim();
    if (!trimmed) return;
    if (props.prompt.trim()) {
      updatePromptDrafts(mergePromptDraft(promptDrafts, buildPromptDraft(props.prompt, placement === 'replace' ? 'previous' : 'manual', placement === 'replace' ? '替换前' : '追加前')));
    }
    props.onPromptChange(placement === 'append' && props.prompt.trim() ? `${props.prompt.trim()}\n\n${trimmed}` : trimmed);
    setAssistMode(null);
  }

  async function runQuickPromptPolish() {
    const sourcePrompt = props.prompt.trim();
    if (!sourcePrompt || isQuickPolishing) return;
    const modeId = resolvePolishMode(
      props.promptHistorySettings.defaultPolishMode || getDefaultPolishMode(effectivePromptPolishSettings.engine),
      effectivePromptPolishSettings.engine
    ).id;
    if (selectedQuickPolishValue === '__local__' || effectivePromptPolishSettings.engine === 'local') {
      const polished = polishPrompt(sourcePrompt, modeId, promptStyleId);
      updatePromptDrafts(mergePromptDraft(mergePromptDraft(promptDrafts, buildPromptDraft(sourcePrompt, 'previous', '润色前')), buildPromptDraft(polished, 'polished', '本地润色')));
      props.onPromptChange(polished);
      return;
    }
    if (!effectivePromptPolishSettings.baseUrl.trim() || !effectivePromptPolishSettings.modelId.trim()) {
      const polished = polishPrompt(sourcePrompt, modeId, promptStyleId);
      updatePromptDrafts(mergePromptDraft(mergePromptDraft(promptDrafts, buildPromptDraft(sourcePrompt, 'previous', '润色前')), buildPromptDraft(polished, 'polished', '本地兜底')));
      props.onPromptChange(polished);
      return;
    }
    setIsQuickPolishing(true);
    try {
      const result = await polishPromptWithProvider({
        providerId: 'prompt-polish',
        modelId: effectivePromptPolishSettings.modelId,
        prompt: sourcePrompt,
        modeId,
        styleId: promptStyleId,
        settings: effectivePromptPolishSettings,
        baseUrl: effectivePromptPolishSettings.baseUrl,
        extraHeaders: parseExtraHeaders(effectivePromptPolishSettings.extraHeadersJson),
        secretId: PROMPT_POLISH_SECRET_ID
      });
      const polished = result.polishedPrompt.trim() || sourcePrompt;
      updatePromptDrafts(mergePromptDraft(mergePromptDraft(promptDrafts, buildPromptDraft(sourcePrompt, 'previous', '润色前')), buildPromptDraft(polished, 'polished', '模型润色')));
      props.onPromptChange(polished);
    } catch {
      if (props.promptPolishSettings.fallbackToLocal) {
        const polished = polishPrompt(sourcePrompt, modeId, promptStyleId);
        updatePromptDrafts(mergePromptDraft(mergePromptDraft(promptDrafts, buildPromptDraft(sourcePrompt, 'previous', '润色前')), buildPromptDraft(polished, 'polished', '本地兜底')));
        props.onPromptChange(polished);
      }
    } finally {
      setIsQuickPolishing(false);
    }
  }

  function updateReferences(nextReferences: ReferenceImage[]) {
    props.onReferenceImagesChange(normalizeReferences(nextReferences));
  }

  async function addReferenceFiles(files: FileList | File[] | null, source: Extract<ReferenceImage['source'], 'upload' | 'clipboard' | 'drag-drop'> = 'upload') {
    if (!files?.length || props.isGenerating) return;
    const slots = Math.max(0, 4 - props.referenceImages.length);
    if (slots === 0) {
      showReferenceNotice('参考图已满 4 张，请先移除或清空。', 'warning');
      return;
    }
    const incomingFiles = Array.from(files);
    const supportedFiles = incomingFiles.filter(isReferenceImageFile);
    const selectedFiles = supportedFiles
      .slice(0, slots);
    if (selectedFiles.length === 0) {
      showReferenceNotice('没有可用图片，仅支持 PNG/JPG/WebP。', 'warning');
      return;
    }
    try {
      const references = (await Promise.all(selectedFiles.map((file) => fileToReferenceImage(file, source))))
        .map((reference) => ({ ...reference, role: props.defaultReferenceRole }));
      const nextReferences = normalizeReferences([...props.referenceImages, ...references]);
      props.onReferenceImagesChange(nextReferences);
      setMode('image');
      const addedCount = Math.max(0, nextReferences.length - props.referenceImages.length);
      if (supportedFiles.length > selectedFiles.length) {
        showReferenceNotice(`已加入 ${addedCount} 张，最多保留 4 张参考图。`, 'warning');
      } else if (addedCount < selectedFiles.length) {
        showReferenceNotice(addedCount > 0 ? `已加入 ${addedCount} 张，重复参考图已跳过。` : '重复参考图已跳过。', 'warning');
      } else {
        showReferenceNotice(`已加入 ${addedCount} 张参考图。`);
      }
    } catch {
      showReferenceNotice('参考图读取失败，请换一张图片重试。', 'error');
      return;
    }
  }

  async function addReferencePaths(paths: string[]) {
    if (!paths.length || props.isGenerating) return;
    const slots = Math.max(0, 4 - props.referenceImages.length);
    if (slots === 0) {
      showReferenceNotice('参考图已满 4 张，请先移除或清空。', 'warning');
      return;
    }
    const supportedPaths = paths.filter(isSupportedReferencePath);
    if (!supportedPaths.length) {
      showReferenceNotice('拖入文件不是支持的图片格式。', 'warning');
      return;
    }
    const references = await referenceImagesFromPaths(supportedPaths, slots);
    if (!references.length) {
      showReferenceNotice('未能读取拖入的参考图。', 'error');
      return;
    }
    const nextReferences = normalizeReferences([...props.referenceImages, ...references]);
    props.onReferenceImagesChange(nextReferences);
    setMode('image');
    const addedCount = Math.max(0, nextReferences.length - props.referenceImages.length);
    showReferenceNotice(
      supportedPaths.length > slots
        ? `已加入 ${addedCount} 张，最多保留 4 张参考图。`
        : `已加入 ${addedCount} 张参考图。`,
      supportedPaths.length > slots ? 'warning' : 'success'
    );
  }

  function removeReference(referenceId: string) {
    updateReferences(props.referenceImages.filter((reference) => reference.id !== referenceId));
    showReferenceNotice('已移除 1 张参考图。');
    setReferenceRoles((current) => {
      const next = { ...current };
      delete next[referenceId];
      return next;
    });
  }

  function clearReferences() {
    updateReferences([]);
    setReferenceRoles({});
    showReferenceNotice('已清空参考图。');
  }

  function reorderReference(activeId: string, overId: string) {
    if (activeId === overId || props.isGenerating) return;
    const index = props.referenceImages.findIndex((reference) => reference.id === activeId);
    const nextIndex = props.referenceImages.findIndex((reference) => reference.id === overId);
    if (index < 0 || nextIndex < 0 || index === nextIndex) return;
    const nextReferences = [...props.referenceImages];
    const [item] = nextReferences.splice(index, 1);
    nextReferences.splice(nextIndex, 0, item);
    updateReferences(nextReferences);
    showReferenceNotice('参考图顺序已调整。');
  }

  function handleReferenceSortDragStart(referenceId: string, event: DragEvent<HTMLElement>) {
    if (props.isGenerating) {
      event.preventDefault();
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('.referenceRoleSelect') || target?.closest('.referenceRemove')) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    setDraggingReferenceId(referenceId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', referenceId);
  }

  function handleReferenceSortDragOver(referenceId: string, event: DragEvent<HTMLElement>) {
    const activeId = draggingReferenceId ?? event.dataTransfer.getData('text/plain');
    if (!activeId || activeId === referenceId || props.isGenerating) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setReferenceDropTargetId(referenceId);
  }

  function handleReferenceSortDrop(referenceId: string, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const activeId = draggingReferenceId ?? event.dataTransfer.getData('text/plain');
    if (activeId) reorderReference(activeId, referenceId);
    setDraggingReferenceId(null);
    setReferenceDropTargetId(null);
  }

  function handleReferenceSortDragEnd() {
    setDraggingReferenceId(null);
    setReferenceDropTargetId(null);
  }

  function setReferenceRole(referenceId: string, role: string) {
    setReferenceRoles((current) => ({ ...current, [referenceId]: role }));
    updateReferences(props.referenceImages.map((reference) => (
      reference.id === referenceId
        ? { ...reference, role: role as ReferenceImage['role'] }
        : reference
    )));
  }

  function handleReferenceDrag(event: DragEvent<HTMLElement>) {
    if (props.isGenerating) return;
    if (props.referenceImages.length >= 4) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'none';
      setReferenceDragState('unsupported');
      return;
    }
    const nextDragState = referenceTransferState(event.dataTransfer, referenceDragState);
    if (!nextDragState) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = nextDragState === 'supported' ? 'copy' : 'none';
    setReferenceDragState(nextDragState);
  }

  function handleReferenceDrop(event: DragEvent<HTMLElement>) {
    if (props.isGenerating) return;
    event.preventDefault();
    event.stopPropagation();
    if (props.referenceImages.length >= 4) {
      setReferenceDragState(null);
      showReferenceNotice('参考图已满 4 张，请先移除或清空。', 'warning');
      return;
    }
    const nextDragState = referenceTransferState(event.dataTransfer, referenceDragState);
    setReferenceDragState(null);
    if (nextDragState !== 'supported') {
      showReferenceNotice('拖入文件不是支持的图片格式。', 'warning');
      return;
    }
    const files = referenceFilesFromTransfer(event.dataTransfer);
    if (files.length > 0) void addReferenceFiles(files, 'drag-drop');
  }

  function handleReferencePaste(event: ClipboardEvent<HTMLDivElement>) {
    if (props.isGenerating) return;
    if (props.referenceImages.length >= 4) {
      const hasImage = Array.from(event.clipboardData.items).some((item) => item.kind === 'file' && item.type.startsWith('image/'));
      if (hasImage) showReferenceNotice('参考图已满 4 张，请先移除或清空。', 'warning');
      return;
    }
    const files = Array.from(event.clipboardData.items)
      .map((item) => (item.kind === 'file' ? item.getAsFile() : null))
      .filter((file): file is File => Boolean(file && isReferenceImageFile(file)));
    if (files.length === 0) {
      const hasFile = Array.from(event.clipboardData.items).some((item) => item.kind === 'file');
      if (hasFile) showReferenceNotice('剪贴板图片格式不支持，仅支持 PNG/JPG/WebP。', 'warning');
      return;
    }
    event.preventDefault();
    void addReferenceFiles(files, 'clipboard');
  }

  function useLatestImageAsReference() {
    if (!activeCanvasPreviewItem?.imageUrl) return;
    const sourceRecord = activeCanvasPreviewItem.record;
    const sourceReferenceId = canvasPreviewTotal > 1
      ? `${sourceRecord.id}:${activeCanvasPreviewItem.imageIndex}`
      : sourceRecord.id;
    const hasSameLatestReference = props.referenceImages.some((reference) => reference.sourceGenerationId === sourceReferenceId);
    if (props.referenceImages.length >= 4 && !hasSameLatestReference) {
      setMode('image');
      showReferenceNotice('参考图已满 4 张，请先移除或清空。', 'warning');
      return;
    }
    const imageUrl = activeCanvasPreviewItem.imageUrl;
    const nextReference: ReferenceImage = {
      id: `generated-${sourceRecord.id}-${activeCanvasPreviewItem.imageIndex}-${Date.now()}`,
      name: canvasPreviewTotal > 1 ? `最近生成图 ${canvasPreviewPosition}/${canvasPreviewTotal}` : '最近生成图',
      mimeType: imageUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : imageUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/png',
      dataUrl: imageUrl.startsWith('data:image/') ? imageUrl : undefined,
      localPath: activeCanvasPreviewItem.localPath,
      previewUrl: imageUrl,
      source: 'generated-result',
      sourceGenerationId: sourceReferenceId,
      addedAt: new Date().toISOString()
    };
    updateReferences([nextReference, ...props.referenceImages.filter((reference) => reference.sourceGenerationId !== sourceReferenceId)]);
    setMode('image');
    showReferenceNotice('最近生成图已加入参考。');
  }

  function clearCurrentCanvas() {
    const clearedAt = Date.now();
    setCanvasClearedAfterByMode((current) =>
      saveCanvasClearedAfter({
        ...current,
        [currentGenerationMode]: clearedAt
      })
    );
    setCanvasPreviewIndex(0);
  }

  useEffect(() => {
    function focusPrompt() {
      promptInputRef.current?.focus();
      promptInputRef.current?.select();
    }
    function addReference() {
      if (props.isGenerating || props.referenceImages.length >= 4) return;
      setMode('image');
      window.setTimeout(() => fileInputRef.current?.click(), 0);
    }
    function clearReferenceShortcut() {
      if (props.isGenerating) return;
      clearReferences();
    }
    function switchToImageMode() {
      setMode('image');
    }
    function switchToTextMode() {
      setMode('text');
    }
    window.addEventListener('visionhub:generate-focus-prompt', focusPrompt);
    window.addEventListener('visionhub:generate-add-reference', addReference);
    window.addEventListener('visionhub:generate-clear-references', clearReferenceShortcut);
    window.addEventListener('visionhub:generate-mode-image', switchToImageMode);
    window.addEventListener('visionhub:generate-mode-text', switchToTextMode);
    return () => {
      window.removeEventListener('visionhub:generate-focus-prompt', focusPrompt);
      window.removeEventListener('visionhub:generate-add-reference', addReference);
      window.removeEventListener('visionhub:generate-clear-references', clearReferenceShortcut);
      window.removeEventListener('visionhub:generate-mode-image', switchToImageMode);
      window.removeEventListener('visionhub:generate-mode-text', switchToTextMode);
    };
  }, [props.referenceImages, props.isGenerating]);

  useEffect(() => {
    window.addEventListener('visionhub:generate-submit', runGenerate);
    return () => window.removeEventListener('visionhub:generate-submit', runGenerate);
  });

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload;
      if (payload.type === 'leave') {
        setReferenceDragState(null);
        return;
      }
      if (payload.type === 'enter') {
        if (props.isGenerating || props.referenceImages.length >= 4 || payload.paths.length === 0) return;
        setReferenceDragState(pathsContainSupportedReference(payload.paths) ? 'supported' : 'unsupported');
        return;
      }
      if (payload.type === 'drop') {
        setReferenceDragState(null);
        if (props.isGenerating) return;
        if (props.referenceImages.length >= 4) {
          showReferenceNotice('参考图已满 4 张，请先移除或清空。', 'warning');
          return;
        }
        const supportedPaths = payload.paths.filter(isSupportedReferencePath);
        if (supportedPaths.length > 0) void addReferencePaths(supportedPaths);
        else showReferenceNotice('拖入文件不是支持的图片格式。', 'warning');
      }
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else unlisten = cleanup;
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [props.isGenerating, props.referenceImages]);

  function buildCurrentGenerationOptions(): GenerateSubmitOptions {
    const trimmedCompression = compression.trim();
    const parsedCompression = trimmedCompression ? Number(trimmedCompression) : Number.NaN;
    const outputCompression = trimmedCompression && Number.isFinite(parsedCompression)
      ? Math.max(75, Math.min(100, Math.round(parsedCompression)))
      : undefined;
    const trimmedNegativePrompt = negativePrompt.trim();
    const trimmedSeed = seedInput.trim();
    const parsedSeed = trimmedSeed ? Number(trimmedSeed) : Number.NaN;
    const seed = trimmedSeed && Number.isFinite(parsedSeed) ? Math.max(0, Math.round(parsedSeed)) : undefined;
    const advancedGenerationOptions = {
      negativePrompt: trimmedNegativePrompt || undefined,
      seed
    };
    if (mode === 'image') {
      const referenceRoleMap = Object.fromEntries(props.referenceImages.map((reference) => [
        reference.id,
        referenceRoles[reference.id] ?? reference.role ?? props.defaultReferenceRole
      ]));
      return {
        mode: 'image-to-image',
        references: props.referenceImages,
        outputFormat,
        outputCompression,
        ...advancedGenerationOptions,
        metadata: {
          imageToImageTuning: {
            referenceStrength,
            preserveComposition,
            styleTransfer,
            capabilityStatus: imageToImageStatus,
            multiReferenceStatus,
            referenceRoles: referenceRoleMap
          }
        }
      };
    }
    return { mode: 'text-to-image', references: [], outputFormat, outputCompression, ...advancedGenerationOptions };
  }

  function isCurrentSizeSupportedByModel() {
    const selectedModelForGeneration = props.supportsOpenAICompatible ? props.providerConfig.modelId : props.selectedModelId;
    if (selectedSize?.badge === '4K' && isKnown4KUnsupportedModel(props.selectedProvider.id, selectedModelForGeneration)) {
      window.alert(`当前模型 ${selectedModelForGeneration || '未配置模型'} 不支持 4K 图片。请换成 1K/2K 输出尺寸，或切换到支持 4K 的模型后再生成。`);
      return false;
    }
    return true;
  }

  function runGenerate() {
    if (!isCurrentSizeSupportedByModel()) return;
    const generationOptions = buildCurrentGenerationOptions();
    if (mode === 'image') {
      setActiveGeneratingMode('image-to-image');
      props.onGenerate(generationOptions);
      updatePromptDrafts(mergePromptDraft(promptDrafts, buildPromptDraft(props.prompt, 'retry', '已提交图生图')));
      return;
    }
    setActiveGeneratingMode('text-to-image');
    props.onGenerate(generationOptions);
    updatePromptDrafts(mergePromptDraft(promptDrafts, buildPromptDraft(props.prompt, 'retry', '已提交文生图')));
  }

  function addToBatchQueue() {
    if (!props.onAddToBatchQueue || !isCurrentSizeSupportedByModel()) return;
    props.onAddToBatchQueue(buildCurrentGenerationOptions());
    updatePromptDrafts(mergePromptDraft(promptDrafts, buildPromptDraft(props.prompt, 'manual', '已加入批量队列')));
  }

  function toggleCompareProfile(profileId: string, checked: boolean) {
    setCompareProfileIds((current) => {
      const next = new Set(current.filter((item) => compareCandidateIdSet.has(item)));
      if (checked) next.add(profileId);
      else next.delete(profileId);
      return Array.from(next);
    });
  }

  function addCompareGroupToBatchQueue() {
    if (!props.onAddCompareGroupToBatchQueue || !isCurrentSizeSupportedByModel()) return;
    if (selectedCompareProfileIds.length < 2) {
      showDraftNotice('至少选择 2 个配置实例，才能创建多模型对比队列。');
      return;
    }
    props.onAddCompareGroupToBatchQueue(selectedCompareProfileIds, buildCurrentGenerationOptions());
    updatePromptDrafts(mergePromptDraft(promptDrafts, buildPromptDraft(props.prompt, 'manual', '已加入多模型对比队列')));
  }

  return (
    <div
      className={`generatorStudio ${referenceDragState ? `isReferenceDragActive ${referenceDragState}` : ''}`}
      onPaste={handleReferencePaste}
      onDragEnter={handleReferenceDrag}
      onDragOver={handleReferenceDrag}
      onDragLeave={() => setReferenceDragState(null)}
      onDrop={handleReferenceDrop}
    >
      <section className={`canvasPane ${mode === 'image' ? 'withReferenceRow' : 'textOnlyRow'}`}>
        <header className="generatorTopbar">
          <div className="workspaceTitleBlock">
            <span className="tealLabel">AI 创作工作台</span>
            <div className="workspaceTitleLine">
              <strong>{isCurrentModeGenerating ? '当前模式渲染中' : activeCanvasPreviewItem ? '当前模式最近画面' : '准备生成'}</strong>
              <small>{topbarProviderSummary}</small>
            </div>
          </div>
          <div className="quickToolbar">
            <button className={`modeToggle ${mode === 'text' ? 'active' : ''}`} onClick={() => setMode('text')}>
              <Sparkles size={15} /> 文生图
            </button>
            <button className={`modeToggle ${mode === 'image' ? 'active' : ''}`} onClick={() => setMode('image')}>
              <Upload size={15} /> 图生图
            </button>
            <span>{selectedRatio}</span>
            <span>{props.size}</span>
            <span>{outputFormat}</span>
            <span className="sessionCount">
              <Clock3 size={13} /> {currentModeSessionResults.length}
            </span>
          </div>
        </header>

        <div className="previewStage">
          <svg className="previewSparkleMesh" aria-hidden="true">
            <defs>
              <pattern id="previewSparkleMeshPattern" width="58" height="58" patternUnits="userSpaceOnUse">
                <path
                  className="sparkleMeshLine"
                  d="M29 0 58 29 29 58 0 29Z"
                  fill="none"
                  strokeDasharray="3 7"
                  strokeLinecap="round"
                />
                <path
                  className="sparkleStarLine"
                  d="M29 23c1.1 3.7 2.3 4.9 6 6-3.7 1.1-4.9 2.3-6 6-1.1-3.7-2.3-4.9-6-6 3.7-1.1 4.9-2.3 6-6Z"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#previewSparkleMeshPattern)" />
          </svg>
          {activeCanvasPreviewItem?.imageUrl ? (
            <>
              <button
                className="latestPreview"
                type="button"
                onClick={() => props.onPreview(activeCanvasPreviewItem.imageUrl)}
                aria-label="预览当前生成结果"
              >
                <img src={activeCanvasPreviewItem.imageUrl} alt={activeCanvasPreviewItem.record.prompt} />
                <span className="previewAction">
                  <Maximize2 size={15} /> 预览
                </span>
              </button>
              {canvasPreviewTotal > 1 ? (
                <div className="canvasPreviewSwitcher" aria-label="生成结果切换">
                  <button
                    type="button"
                    className="canvasPreviewNav previous"
                    onClick={() => setCanvasPreviewIndex((index) => (index - 1 + canvasPreviewTotal) % canvasPreviewTotal)}
                    aria-label="上一张生成结果"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span>{canvasPreviewPosition}/{canvasPreviewTotal}</span>
                  <button
                    type="button"
                    className="canvasPreviewNav next"
                    onClick={() => setCanvasPreviewIndex((index) => (index + 1) % canvasPreviewTotal)}
                    aria-label="下一张生成结果"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              ) : null}
              <button
                className="useAsReferenceButton"
                type="button"
                data-tooltip={props.referenceImages.length >= 4 ? '参考图已满 4 张，请先移除或清空' : '将当前预览图加入参考'}
                onClick={useLatestImageAsReference}
                disabled={props.isGenerating || props.referenceImages.length >= 4}
              >
                <ImagePlus size={15} /> 作为参考
              </button>
              <button
                className="clearCanvasButton"
                type="button"
                data-tooltip="只清空当前模式画布，不删除作品画廊记录"
                aria-label="清空当前模式画布"
                onClick={clearCurrentCanvas}
                disabled={isCurrentModeGenerating}
              >
                <XCircle size={15} /> 清空画布
              </button>
            </>
          ) : (
            <div className="previewEmpty">
              <div className="emptyIcon">
                <Sparkles size={25} />
              </div>
              <h2>{mode === 'image' ? '等待参考图' : '画布待点亮'}</h2>
              <p>{mode === 'image' ? '加入参考图后，说明要保留或改变的部分，再开始重绘。' : '写下主体、场景和氛围，选好比例与风格后开始生成。'}</p>
              {isCurrentModeGenerating ? (
                <div className="generationOverlay inlineGenerationOverlay">
                  <span>
                    <Sparkles size={16} /> 画布渲染中
                  </span>
                  <small>任务已发送到当前模型，请稍候…</small>
                </div>
              ) : null}
            </div>
          )}
          {failedLatest && !activeCanvasPreviewItem ? (
            <div className={`previewError ${failedLatestNeedsCheck ? 'pendingRecovery' : ''}`}>
              <div>
                <strong>{failedLatestDiagnosis?.title ?? (failedLatestNeedsCheck ? '上一轮待核查' : '上一轮失败')}</strong>
                <span>{failedLatestDiagnosis?.summary ?? failedLatest.error}</span>
                {failedLatestDiagnosis?.actions.length ? (
                  <ul className="generationErrorActionsList">
                    {failedLatestDiagnosis.actions.slice(0, 3).map((action) => <li key={action}>{action}</li>)}
                  </ul>
                ) : null}
                {failedLatestDiagnosis?.details.length ? <small>{failedLatestDiagnosis.details.join(' · ')}</small> : null}
              </div>
              <div className="previewErrorActions">
                <button type="button" onClick={() => void props.onReloadHistory()}>
                  <RotateCcw size={13} /> 重载历史
                </button>
                <button type="button" onClick={props.onOpenLibrary}>
                  <GalleryHorizontal size={13} /> 作品画廊
                </button>
              </div>
            </div>
          ) : null}
          {isCurrentModeGenerating && activeCanvasPreviewItem?.imageUrl ? (
            <div className="generationOverlay centerGenerationOverlay">
              <span>
                <Sparkles size={16} /> 画布渲染中
              </span>
              <small>任务已发送到当前模型，请稍候…</small>
            </div>
          ) : null}
        </div>

        {mode === 'image' ? (
          <div
            className={`referenceDock ${referenceDragState === 'supported' ? 'isDragActive' : referenceDragState === 'unsupported' ? 'isDragRejected' : ''}`}
            onDragEnter={handleReferenceDrag}
            onDragOver={handleReferenceDrag}
            onDragLeave={() => setReferenceDragState(null)}
            onDrop={handleReferenceDrop}
          >
            <div className="referenceInfo">
              <div>
                <strong>参考图</strong>
                <span>{props.referenceImages.length}/4</span>
              </div>
              <small>
                <span>支持 PNG/JPG/WebP</span>
                <span className={`referenceNotice ${referenceNotice?.tone ?? ''}`}>{referenceStatusText}</span>
              </small>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={(event) => {
                void addReferenceFiles(event.target.files, 'upload');
                event.currentTarget.value = '';
              }}
            />
            <button
              className="referenceAdd"
              type="button"
              disabled={props.isGenerating || props.referenceImages.length >= 4}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={17} /> 加入参考
            </button>
            {props.referenceImages.length > 0 ? (
              <>
                <button
                  className="referenceClear"
                  type="button"
                  data-tooltip="清空全部参考图"
                  aria-label="清空全部参考图"
                  disabled={props.isGenerating}
                  onClick={clearReferences}
                >
                  <XCircle size={15} /> 清空
                </button>
                <div className="referenceStrip">
                  {props.referenceImages.map((reference, index) => {
                    const roleValue = referenceRoles[reference.id] ?? reference.role ?? 'auto';
                    const roleLabel = REFERENCE_ROLE_OPTIONS.find((option) => option.value === roleValue)?.label ?? '自动';
                    const sourceLabel = referenceSourceLabel(reference.source);
                    const referenceTitle = `第 ${index + 1} 张 · ${sourceLabel} · ${roleLabel}${reference.name ? ` · ${reference.name}` : ''}`;
                    return (
                      <article
                        className={`referenceTile ${draggingReferenceId === reference.id ? 'isDragging' : ''} ${referenceDropTargetId === reference.id ? 'isDropTarget' : ''}`}
                        key={reference.id}
                        title={`${referenceTitle}。拖拽缩略图可调整顺序。`}
                        draggable={!props.isGenerating}
                        onDragStart={(event) => handleReferenceSortDragStart(reference.id, event)}
                        onDragOver={(event) => handleReferenceSortDragOver(reference.id, event)}
                        onDrop={(event) => handleReferenceSortDrop(reference.id, event)}
                        onDragEnd={handleReferenceSortDragEnd}
                        onDragLeave={() => setReferenceDropTargetId(null)}
                      >
                        <button
                          type="button"
                          className="referenceThumb"
                          aria-label={`预览${referenceTitle}`}
                          onClick={() => reference.previewUrl && props.onPreview(reference.previewUrl)}
                        >
                          {reference.previewUrl ? <img src={reference.previewUrl} alt={reference.name ?? `第 ${index + 1} 张参考图`} /> : <ImagePlus size={18} />}
                        </button>
                        <span className="referenceSourceBadge" title={reference.name ?? sourceLabel}>
                          #{index + 1} {sourceLabel}
                        </span>
                        <StudioSelect
                          className="referenceRoleSelect"
                          value={roleValue}
                          options={REFERENCE_ROLE_OPTIONS}
                          disabled={props.isGenerating}
                          onChange={(value) => setReferenceRole(reference.id, value)}
                        />
                        <button className="referenceRemove" type="button" data-tooltip="移除参考图" aria-label={`移除第 ${index + 1} 张参考图`} disabled={props.isGenerating} onClick={() => removeReference(reference.id)}>
                          <Trash2 size={13} />
                        </button>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="referenceEmptyState">添加本地图片，或拖拽 / Ctrl+V 粘贴图片作为参考，最多 4 张。</p>
            )}
          </div>
        ) : null}

        <div className={`promptDock ${promptWidthState}`}>
          <div className="promptHeaderRow">
            <div>
              <strong>提示词</strong>
              <span>{promptLength} 字符</span>
            </div>
            <div className="promptActions" aria-label="提示词辅助功能">
              <button type="button" className="chipButton" data-tooltip="打开灵感库" onClick={() => setAssistMode('inspiration')}>
                <Sparkles size={13} /> 模板灵感
              </button>
              <button type="button" className="chipButton promptSaveIconButton" data-tooltip="保存当前 Prompt 草稿" aria-label="保存当前 Prompt 草稿" onClick={() => saveCurrentPromptDraft()}>
                <Save size={14} />
              </button>
              <button type="button" className="chipButton" data-tooltip="打开 Prompt 草稿库" onClick={() => setIsDraftLibraryOpen(true)}>
                <Library size={13} /> 草稿 {promptDrafts.length}/12
              </button>
              <div className="promptPolishQuickGroup">
                <button type="button" className="chipButton" data-tooltip="按右侧模型快速润色并替换当前提示词" disabled={isQuickPolishing || !props.prompt.trim()} onClick={runQuickPromptPolish}>
                  <Wand2 size={13} /> {isQuickPolishing ? '润色中…' : '提示词润色'}
                </button>
                <StudioSelect
                  className="promptPolishQuickSelect noSelectCheck"
                  value={selectedQuickPolishValue}
                  onChange={(value) => setQuickPolishConfigId(value)}
                  options={quickPolishOptions}
                />
                <button type="button" className="promptPolishDetailButton" data-tooltip="打开详细润色窗口" aria-label="打开详细润色窗口" onClick={() => setAssistMode('polish')}>
                  <SlidersHorizontal size={13} />
                </button>
              </div>
              <button type="button" className="chipButton" data-tooltip="复用历史提示词" onClick={() => setAssistMode('reuse')}>
                <History size={13} /> 复用记录
              </button>
            </div>
          </div>
          <div className="promptInputRow">
            <textarea
              ref={promptInputRef}
              className="bottomPromptInput"
              value={props.prompt}
              onChange={(event) => props.onPromptChange(event.target.value)}
              placeholder={mode === 'image' ? '说明要保留什么、改变什么，例如：保留人物姿势，改成电影感夜景和蓝紫色灯光' : '写下主体、场景、镜头、光线与氛围，例如：雨夜霓虹街头，一位披风少女回头看向镜头'}
            />
          </div>
          <div className="promptControlRow">
            <label>
              精度
              <StudioSelect
                value={props.quality}
                onChange={props.onQualityChange}
                options={[
                  { value: 'auto', label: '自动' },
                  { value: 'low', label: '低' },
                  { value: 'medium', label: '中' },
                  { value: 'standard', label: '标准' },
                  { value: 'high', label: '高' }
                ]}
              />
            </label>
            <label>
              格式
              <StudioSelect
                value={outputFormat}
                onChange={(value) => setOutputFormat(value as OutputFormat)}
                options={[
                  { value: 'PNG', label: 'PNG' },
                  { value: 'JPEG', label: 'JPEG' },
                  { value: 'WebP', label: 'WebP' }
                ]}
              />
            </label>
            <label>
              风格
              <StudioSelect
                className="promptStyleQuickSelect noSelectCheck"
                value={promptStyleId}
                onChange={setPromptStyleId}
                options={PROMPT_STYLE_PRESETS.map((style) => ({ value: style.id, label: style.label }))}
              />
            </label>
            <label>
              压缩率
              <input value={compression} placeholder="自动 / 75-100" onChange={(event) => setCompression(event.target.value)} />
            </label>
            <label>
              数量
              <input type="number" min={1} max={4} value={props.count} onChange={(event) => props.onCountChange(Number(event.target.value))} />
            </label>
            <div className="generateStack">
              <button
                className="primaryGenerate"
                type="button"
                onClick={runGenerate}
                disabled={props.isGenerating}
                title={generateButtonLabel}
                aria-label={generateButtonLabel}
              >
                <Sparkles size={17} /> {generateButtonLabel}
              </button>
              <button
                className="secondaryQueueButton"
                type="button"
                onClick={addToBatchQueue}
                disabled={props.isGenerating || !props.onAddToBatchQueue}
                title="把当前 Prompt、模型、尺寸和参考图快照加入批量队列；不会立即消耗额度"
                aria-label="加入批量队列"
              >
                <ListChecks size={15} />
                <span>{props.batchQueueTaskCount ? `加入队列 · ${props.batchQueueTaskCount}` : '加入队列'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <aside className="parameterRail">
        <section className="railCard providerRailCard">
          <label>
            平台
            <StudioSelect
              value={props.selectedProviderId}
              onChange={props.onProviderChange}
              options={props.providers.map((provider) => ({
                value: provider.id,
                label: providerAccessLabel(provider),
                description: providerAccessDescription(provider)
              }))}
            />
          </label>
          {props.supportsOpenAICompatible && providerProfileOptions.length > 0 ? (
            <label>
              配置实例
              <StudioSelect
                value={props.activeProfile?.id ?? providerProfileOptions[0]?.value ?? ''}
                onChange={props.onProfileChange}
                options={providerProfileOptions}
              />
            </label>
          ) : null}
          <label>
            模型
            <StudioSelect
              value={modelValue}
              onChange={props.onModelChange}
              options={modelOptions.map((modelId) => ({ value: modelId, label: modelId }))}
            />
          </label>
          <div className={`connectionState ${props.isRealProviderReady ? 'ready' : ''}`}>
            <ShieldCheck size={14} /> {isComfyUILocalProvider
              ? props.isRealProviderReady ? 'ComfyUI API workflow 已就绪' : '需要 API workflow 才能提交'
              : props.isRealProviderReady ? '真实通道已就绪' : '未配置密钥时使用演示模式'}
          </div>
          <div className="activeProfileSummary">
            <div className="activeProfileLine">
              <span>配置实例</span>
              <strong>{activeProfileName}</strong>
            </div>
            <div className="activeProfileChips" aria-label="当前配置实例状态">
              <span>{activeProfileStatus}</span>
              <span>{activeProfileModelProbeText}</span>
              <span>{activeProfileSecretText}</span>
            </div>
          </div>
          {props.supportsOpenAICompatible && compareProfileCandidates.length > 1 ? (
            <div className="compareProfileBox" aria-label="多模型对比配置实例选择器">
              <div className="compareProfileHeader">
                <div>
                  <strong>多模型对比</strong>
                  <small>可同时选择多个配置实例；无需把它们都设为启用。</small>
                </div>
                <span>{selectedCompareProfileCount}/{compareProfileCandidates.length}</span>
              </div>
              <div className="compareProfileList">
                {compareProfileCandidates.map((profile) => {
                  const checked = selectedCompareProfileIds.includes(profile.id);
                  return (
                    <label className={`compareProfileOption ${checked ? 'active' : ''}`} key={profile.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={props.isGenerating}
                        onChange={(event) => toggleCompareProfile(profile.id, event.target.checked)}
                      />
                      <span>
                        <strong>{profile.displayName || profile.modelId}</strong>
                        <small>{profile.modelId} · {profile.baseUrl || '未配置 Base URL'}</small>
                      </span>
                      <em>{profile.enabled ? '当前' : profileStatusLabel(profile.lastTestStatus)}</em>
                    </label>
                  );
                })}
              </div>
              <div className="compareProfileActions">
                <button
                  type="button"
                  className="miniButton"
                  onClick={() => setCompareProfileIds(compareProfileCandidates.map((profile) => profile.id))}
                  disabled={props.isGenerating}
                  title="选择当前平台下所有可用配置实例"
                  aria-label="全选多模型对比配置实例"
                >
                  全选
                </button>
                <button
                  type="button"
                  className="miniButton"
                  onClick={() => setCompareProfileIds([])}
                  disabled={props.isGenerating}
                  title="清空多模型对比配置实例选择"
                  aria-label="清空多模型对比配置实例选择"
                >
                  清空
                </button>
                <button
                  type="button"
                  className="miniButton primary"
                  onClick={addCompareGroupToBatchQueue}
                  disabled={!canCreateCompareGroup}
                  title="把同一 Prompt 和当前参数分别按所选配置实例创建任务快照；不会立即消耗额度"
                  aria-label="加入多模型对比队列"
                >
                  加入对比队列
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="railCard">
          <div className="railTitle">
            <PanelRight size={15} /> 画面比例
          </div>
          <div className="ratioGrid">
            {RATIO_OPTIONS.map((ratio) => (
              <button
                key={ratio.label}
                className={selectedRatio === ratio.label ? 'active' : ''}
                onClick={() => props.onSizeChange(ratio.size)}
              >
                <span style={{ width: ratio.w, height: ratio.h }} />
                <strong>{ratio.label}</strong>
              </button>
            ))}
          </div>
          <p className="railHint">先选画面比例，再在下方选择该比例对应的输出尺寸。</p>
        </section>

        <section className="railCard">
          <div className="railTitle">
            <SlidersHorizontal size={15} /> 输出尺寸
          </div>
          <div className="resolutionList">
            {currentRatioSizes.map((item) => (
              <button key={item.value} className={props.size === item.value ? 'active' : ''} onClick={() => props.onSizeChange(item.value)}>
                <div>
                  <strong>{item.value}</strong>
                  <small>{item.desc}</small>
                </div>
                <span>{item.badge}</span>
              </button>
            ))}
            {selectedSize ? null : (
              <button className="active customSizeCurrent" onClick={() => undefined}>
                <div>
                  <strong>{props.size}</strong>
                  <small>当前自定义尺寸，将原样传给生成接口</small>
                </div>
                <span>自定义</span>
              </button>
            )}
          </div>
          <div className="customSizeBox">
            <strong>自定义尺寸</strong>
            <div>
              <input value={customWidth} type="number" min={64} max={4096} onChange={(event) => setCustomWidth(Number(event.target.value))} />
              <span>×</span>
              <input value={customHeight} type="number" min={64} max={4096} onChange={(event) => setCustomHeight(Number(event.target.value))} />
              <button onClick={applyCustomSize}>应用</button>
            </div>
            <small>建议 64–4096，具体是否支持取决于当前平台 / 中转模型。</small>
          </div>
        </section>

        {mode === 'image' ? (
          <section className="railCard imageTuningCard">
            <div className="railTitle">
              <SlidersHorizontal size={15} /> 图生图参数
            </div>
            <div className={`capabilityNotice ${advancedImageTuningEnabled ? 'ready' : 'blocked'}`}>
              <strong>{advancedImageTuningEnabled ? '当前平台可尝试图生图参数' : '当前平台未声明图生图参数能力'}</strong>
              <span>图生图：{statusLabel(imageToImageStatus)} ? 多参考：{statusLabel(multiReferenceStatus)}</span>
            </div>
            <label>
              参考强度
              <StudioSelect
                value={referenceStrength}
                onChange={setReferenceStrength}
                options={[
                  { value: 'auto', label: '自动' },
                  { value: 'low', label: '低：只借鉴少量特征' },
                  { value: 'medium', label: '中：平衡参考与改写' },
                  { value: 'high', label: '高：更贴近参考图' }
                ]}
              />
            </label>
            <label className="tuningCheck">
              <input
                type="checkbox"
                checked={preserveComposition}
                disabled={!advancedImageTuningEnabled}
                onChange={(event) => setPreserveComposition(event.target.checked)}
              />
              <span>尽量保留构图</span>
            </label>
            <label className="tuningCheck">
              <input
                type="checkbox"
                checked={styleTransfer}
                disabled={!advancedImageTuningEnabled}
                onChange={(event) => setStyleTransfer(event.target.checked)}
              />
              <span>偏向风格迁移</span>
            </label>
            <small>{multiReferenceAllowed ? '会随生成请求记录为平台参数偏好；真实生效取决于当前接口协议。' : '该平台未声明多参考能力，建议只放 1 张参考图。'}</small>
          </section>
        ) : null}

        <section className="railCard advancedParamsCard">
          <div className="railTitle">
            <ChevronDown size={16} /> 高级参数
          </div>
          <label>
            Seed
            <input
              value={seedInput}
              inputMode="numeric"
              placeholder="随机 / 固定种子"
              onChange={(event) => setSeedInput(event.target.value.replace(/[^\d]/g, '').slice(0, 12))}
            />
          </label>
          <label>
            负面提示词
            <textarea
              value={negativePrompt}
              placeholder="不想出现的元素，可留空"
              rows={3}
              onChange={(event) => setNegativePrompt(event.target.value)}
            />
          </label>
          <small>填写后会随请求记录，并传给支持 Seed / 负面提示词字段的兼容接口。</small>
        </section>
      </aside>
      {assistMode ? (
        <PromptAssistModal
          mode={assistMode}
          prompt={props.prompt}
          results={props.results}
          promptHistorySettings={props.promptHistorySettings}
          promptPolishSettings={effectivePromptPolishSettings}
          promptStyleId={promptStyleId}
          onPromptStyleChange={setPromptStyleId}
          onClose={() => setAssistMode(null)}
          onApplyPrompt={applyAssistedPrompt}
          onDeleteRecord={props.onDeleteResult}
          onRequestConfirm={props.onRequestConfirm}
        />
      ) : null}
      {isDraftLibraryOpen ? (
        <div className="promptDraftBackdrop" onClick={() => setIsDraftLibraryOpen(false)}>
          <section className="promptDraftDialog" role="dialog" aria-modal="true" aria-label="Prompt 草稿" onClick={(event) => event.stopPropagation()}>
            <header className="promptDraftDialogHeader">
              <div>
                <span>Prompt 草稿</span>
                <strong>已保存 {promptDrafts.length}/12</strong>
              </div>
              <button type="button" className="promptAssistClose" aria-label="关闭草稿窗口" onClick={() => setIsDraftLibraryOpen(false)}>
                <XCircle size={18} />
              </button>
            </header>
            <div className="promptDraftDialogBody">
              <button type="button" className="promptDraftSaveButton" onClick={() => saveCurrentPromptDraft()}>
                <Save size={13} /> 保存当前 Prompt
              </button>
              {draftNotice ? <p className="promptDraftNotice">{draftNotice}</p> : null}
              {promptDrafts.length ? (
                <div className="promptDraftDialogList">
                  {promptDrafts.map((draft) => (
                    <article className="promptDraftDialogItem" key={draft.id}>
                      <button
                        type="button"
                        onClick={() => {
                          applyPromptDraft(draft);
                          setIsDraftLibraryOpen(false);
                        }}
                      >
                        <span>{promptDraftKindLabel(draft.kind)} · {formatDraftTime(draft.createdAt)}</span>
                        <strong>{draft.title}</strong>
                        <small>{draft.prompt}</small>
                      </button>
                      <button type="button" className="promptDraftDelete" aria-label={`删除草稿：${draft.title}`} onClick={() => deletePromptDraft(draft.id)}>
                        <XCircle size={14} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="promptDraftEmpty">
                  <strong>暂无草稿</strong>
                  <small>点击「存草稿」或在这里保存当前 Prompt 后，会出现在此窗口。</small>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}


function statusLabel(status: ReturnType<typeof listProviders>[number]['capabilities']['imageToImage']) {
  const labels: Record<string, string> = {
    supported: '支持',
    partial: '部分支持',
    planned: '规划中',
    unknown: '待确认',
    unsupported: '不支持'
  };
  return labels[status] ?? status;
}

function isReferenceImageFile(file: File) {
  if (file.type) return isSupportedReferenceMime(file.type);
  return isSupportedReferencePath(file.name);
}

function isSupportedReferenceMime(mimeType: string) {
  return SUPPORTED_REFERENCE_MIME_TYPES.has(mimeType.toLowerCase());
}

function isSupportedReferencePath(path: string) {
  return SUPPORTED_REFERENCE_PATH_PATTERN.test(path);
}

function pathsContainSupportedReference(paths: string[]) {
  return paths.some(isSupportedReferencePath);
}

function referenceTransferState(dataTransfer: DataTransfer, nativeDragState: ReferenceDragState): ReferenceDragState {
  const files = Array.from(dataTransfer.files ?? []);
  if (files.length > 0) return files.some(isReferenceImageFile) ? 'supported' : 'unsupported';

  const fileItems = Array.from(dataTransfer.items ?? []).filter((item) => item.kind === 'file');
  if (fileItems.length === 0) return null;

  const itemNames = fileItems.map(fileNameFromTransferItem).filter((name): name is string => Boolean(name));
  if (itemNames.length > 0) {
    return itemNames.some(isSupportedReferencePath) ? 'supported' : 'unsupported';
  }

  const typedItems = fileItems.filter((item) => item.type);
  if (typedItems.length > 0) {
    return typedItems.some((item) => isSupportedReferenceMime(item.type)) ? 'supported' : 'unsupported';
  }

  return nativeDragState ?? 'unsupported';
}

function fileNameFromTransferItem(item: DataTransferItem) {
  const entry = (item as DataTransferItem & {
    webkitGetAsEntry?: () => { name?: string; isFile?: boolean } | null;
  }).webkitGetAsEntry?.();
  if (entry?.isFile && entry.name) return entry.name;
  const file = item.getAsFile();
  return file?.name || null;
}

function referenceFilesFromTransfer(dataTransfer: DataTransfer) {
  const files = Array.from(dataTransfer.files ?? []);
  const itemFiles = Array.from(dataTransfer.items ?? [])
    .map((item) => (item.kind === 'file' ? item.getAsFile() : null))
    .filter((file): file is File => Boolean(file));
  const unique = new Map<string, File>();
  for (const file of [...files, ...itemFiles]) {
    if (!isReferenceImageFile(file)) continue;
    unique.set(`${file.name}-${file.size}-${file.lastModified}`, file);
  }
  return Array.from(unique.values());
}

function referenceDedupKey(reference: ReferenceImage) {
  if (reference.localPath) return `path:${reference.localPath.toLowerCase()}`;
  if (reference.dataUrl) return `data:${reference.dataUrl}`;
  if (reference.previewUrl) return `preview:${reference.previewUrl}`;
  return `id:${reference.id}`;
}

function fileToReferenceImage(file: File, source: Extract<ReferenceImage['source'], 'upload' | 'clipboard' | 'drag-drop'> = 'upload'): Promise<ReferenceImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      resolve({
        id: `${source}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name || (source === 'clipboard' ? '剪贴板图片' : '参考图'),
        mimeType: file.type || 'image/png',
        dataUrl,
        previewUrl: dataUrl,
        source,
        role: 'auto',
        addedAt: new Date().toISOString()
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error('无法读取参考图。'));
    reader.readAsDataURL(file);
  });
}


