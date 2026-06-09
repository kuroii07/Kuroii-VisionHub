import {
  ChevronDown,
  Clock3,
  GalleryHorizontal,
  History,
  ImagePlus,
  Maximize2,
  PanelRight,
  RotateCcw,
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
  PromptPolishSettings,
  ReviewMode
} from '../services/appSettings';
import type { GenerationMode, ReferenceImage } from '../domain/providerTypes';
import { getDefaultPolishMode, polishPrompt, resolvePolishMode, type PromptAssistMode } from '../services/promptAssist';
import { isTauriRuntime, polishPromptWithProvider, referenceImagesFromPaths } from '../services/desktopApi';
import { PROMPT_POLISH_SECRET_ID, promptPolishConfigId } from '../services/appSettings';
import { parseExtraHeaders, type OpenAICompatibleConfig } from '../services/providerConfig';
import { useStudioStore } from '../store/useStudioStore';
import { PromptAssistModal } from './PromptAssistModal';
import { StudioSelect } from './StudioSelect';

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
  { value: '3136x1344', ratio: '21:9', desc: '实验性电影级巨幕', badge: '4K', experimental: true },

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
  { value: '3072x2048', ratio: '3:2', desc: '4K 横版实验尺寸', badge: '4K', experimental: true },

  { value: '768x1152', ratio: '2:3', desc: '竖版海报 / 基础画幅', badge: '1K' },
  { value: '1024x1536', ratio: '2:3', desc: '竖版角色图 / 海报', badge: '2K' },
  { value: '1536x2304', ratio: '2:3', desc: '高清竖版人像海报', badge: '2K' },
  { value: '2048x3072', ratio: '2:3', desc: '4K 竖版实验尺寸', badge: '4K', experimental: true },

  { value: '1280x1024', ratio: '5:4', desc: '传统显示器 / 产品图', badge: '1K' },
  { value: '1600x1280', ratio: '5:4', desc: '高清产品展示画幅', badge: '2K' },
  { value: '2560x2048', ratio: '5:4', desc: '高精细产品海报', badge: '2K' },
  { value: '3200x2560', ratio: '5:4', desc: '4K 产品图实验尺寸', badge: '4K', experimental: true },

  { value: '1024x1280', ratio: '4:5', desc: '社媒帖子 / 竖版构图', badge: '1K' },
  { value: '1280x1600', ratio: '4:5', desc: '小红书 / 电商竖图', badge: '2K' },
  { value: '2048x2560', ratio: '4:5', desc: '高清竖版商业海报', badge: '2K' },
  { value: '2560x3200', ratio: '4:5', desc: '4K 竖版实验尺寸', badge: '4K', experimental: true }
];

const REFERENCE_ROLE_OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: 'composition', label: '构图' },
  { value: 'style', label: '风格' },
  { value: 'character', label: '角色' },
  { value: 'color', label: '颜色' }
];

type ReferenceDragState = 'supported' | 'unsupported' | null;

const SUPPORTED_REFERENCE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const SUPPORTED_REFERENCE_PATH_PATTERN = /\.(png|jpe?g|webp)$/i;

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

function isPotentialBackgroundCompletion(record?: Pick<ReturnType<typeof useStudioStore.getState>['results'][number], 'status' | 'error' | 'raw'>) {
  if (!record || record.status !== 'failed') return false;
  const message = `${record.error ?? ''} ${JSON.stringify(record.raw ?? {})}`.toLowerCase();
  return (
    message.includes('524') ||
    message.includes('408') ||
    message.includes('同步连接超时') ||
    message.includes('background task') ||
    message.includes('poll_error') ||
    message.includes('poll_url') ||
    message.includes('轮询')
  );
}

function providerAccessLabel(provider: ReturnType<typeof listProviders>[number]) {
  if (provider.id === 'custom-http-provider') return '中转站 / 聚合 API · OpenAI 兼容中转';
  if (provider.id === 'openai-gpt-image') return '官方 API · OpenAI 官方';
  if (provider.phase === 'local-lab') return `本地模型 · ${provider.name}`;
  return provider.name;
}

function providerAccessDescription(provider: ReturnType<typeof listProviders>[number]) {
  if (provider.id === 'custom-http-provider') return '默认主入口，使用平台接入页保存的中转站 / 聚合 API 配置。';
  if (provider.id === 'openai-gpt-image') return '官方 OpenAI API，使用 https://api.openai.com。';
  if (provider.phase === 'local-lab') return '本地模型路线暂为规划入口，不作为当前生图主通道。';
  return provider.notes[0] ?? '平台能力以当前模板和服务商文档为准。';
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
  defaultReviewMode: ReviewMode;
  promptHistorySettings: PromptHistorySettings;
  promptPolishSettings: PromptPolishSettings;
  sessionStartedAtMs: number;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onPromptChange: (prompt: string) => void;
  onCountChange: (count: number) => void;
  onSizeChange: (size: string) => void;
  onQualityChange: (quality: string) => void;
  onGenerate: (options?: { mode?: GenerationMode; references?: ReferenceImage[]; outputFormat?: OutputFormat; outputCompression?: number; metadata?: Record<string, unknown> }) => void;
  onPreview: (imageUrl: string) => void;
  onReloadHistory: () => void | Promise<void>;
  onOpenLibrary: () => void;
  onDeleteResult: (recordId: string) => Promise<void>;
  referenceImages: ReferenceImage[];
  onReferenceImagesChange: (references: ReferenceImage[]) => void;
}) {
  const [mode, setMode] = useState<DefaultGenerationMode>(props.defaultMode);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(props.defaultOutputFormat);
  const [compression, setCompression] = useState('');
  const [reviewMode, setReviewMode] = useState<ReviewMode>(props.defaultReviewMode);
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
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
  const modelValue = props.supportsOpenAICompatible ? props.providerConfig.modelId : props.selectedModelId;
  const selectedRatio = ratioFromSize(props.size);
  const selectedSize = SIZE_OPTIONS.find((item) => item.value === props.size);
  const currentRatioSizes = useMemo(() => SIZE_OPTIONS.filter((item) => item.ratio === selectedRatio), [selectedRatio]);
  const sessionResults = useMemo(
    () => props.results.filter((result) => generationTimeMs(result.createdAt) >= props.sessionStartedAtMs),
    [props.results, props.sessionStartedAtMs]
  );
  const latestImage = sessionResults.find((result) => result.imageUrls[0]);
  const failedLatest = sessionResults.find((result) => result.status === 'failed');
  const failedLatestNeedsCheck = isPotentialBackgroundCompletion(failedLatest);
  const imageToImageStatus = props.selectedProvider.capabilities.imageToImage;
  const multiReferenceStatus = props.selectedProvider.capabilities.multiReferenceImage;
  const advancedImageTuningEnabled = ['supported', 'partial'].includes(imageToImageStatus);
  const multiReferenceAllowed = ['supported', 'partial'].includes(multiReferenceStatus);
  const canAttemptImageToImage = !['unsupported', 'unknown'].includes(imageToImageStatus);
  const promptLength = props.prompt.trim().length;
  const promptWidthState =
    promptLength === 0 ? 'promptEmpty' : promptLength < 24 ? 'promptShort' : promptLength < 60 ? 'promptMedium' : 'promptLong';

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
    setReviewMode(props.defaultReviewMode);
  }, [props.defaultReviewMode]);

  useEffect(() => {
    if (props.referenceImages.length > 0) {
      setMode('image');
    }
  }, [props.referenceImages.length]);

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
      props.onPromptChange(polishPrompt(sourcePrompt, modeId));
      return;
    }
    if (!effectivePromptPolishSettings.baseUrl.trim() || !effectivePromptPolishSettings.modelId.trim()) {
      props.onPromptChange(polishPrompt(sourcePrompt, modeId));
      return;
    }
    setIsQuickPolishing(true);
    try {
      const result = await polishPromptWithProvider({
        providerId: 'prompt-polish',
        modelId: effectivePromptPolishSettings.modelId,
        prompt: sourcePrompt,
        modeId,
        settings: effectivePromptPolishSettings,
        baseUrl: effectivePromptPolishSettings.baseUrl,
        extraHeaders: parseExtraHeaders(effectivePromptPolishSettings.extraHeadersJson),
        secretId: PROMPT_POLISH_SECRET_ID
      });
      props.onPromptChange(result.polishedPrompt.trim() || sourcePrompt);
    } catch {
      if (props.promptPolishSettings.fallbackToLocal) {
        props.onPromptChange(polishPrompt(sourcePrompt, modeId));
      }
    } finally {
      setIsQuickPolishing(false);
    }
  }

  function updateReferences(nextReferences: ReferenceImage[]) {
    const uniqueReferences: ReferenceImage[] = [];
    const seen = new Set<string>();
    for (const reference of nextReferences) {
      const key = referenceDedupKey(reference);
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueReferences.push(reference);
    }
    props.onReferenceImagesChange(uniqueReferences.slice(0, 4));
  }

  async function addReferenceFiles(files: FileList | File[] | null, source: Extract<ReferenceImage['source'], 'upload' | 'clipboard' | 'drag-drop'> = 'upload') {
    if (!files?.length || props.isGenerating) return;
    const slots = Math.max(0, 4 - props.referenceImages.length);
    if (slots === 0) return;
    const selectedFiles = Array.from(files)
      .filter(isReferenceImageFile)
      .slice(0, slots);
    if (selectedFiles.length === 0) return;
    try {
      const references = await Promise.all(selectedFiles.map((file) => fileToReferenceImage(file, source)));
      updateReferences([...props.referenceImages, ...references]);
      setMode('image');
    } catch {
      return;
    }
  }

  async function addReferencePaths(paths: string[]) {
    if (!paths.length || props.isGenerating) return;
    const slots = Math.max(0, 4 - props.referenceImages.length);
    if (slots === 0) return;
    const references = await referenceImagesFromPaths(paths, slots);
    if (!references.length) return;
    updateReferences([...props.referenceImages, ...references]);
    setMode('image');
  }

  function removeReference(referenceId: string) {
    updateReferences(props.referenceImages.filter((reference) => reference.id !== referenceId));
    setReferenceRoles((current) => {
      const next = { ...current };
      delete next[referenceId];
      return next;
    });
  }

  function clearReferences() {
    updateReferences([]);
    setReferenceRoles({});
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
  }

  function handleReferenceSortDragStart(referenceId: string, event: DragEvent<HTMLElement>) {
    if (props.isGenerating) {
      event.preventDefault();
      return;
    }
    setDraggingReferenceId(referenceId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', referenceId);
  }

  function handleReferenceSortDragOver(referenceId: string, event: DragEvent<HTMLElement>) {
    const activeId = draggingReferenceId ?? event.dataTransfer.getData('text/plain');
    if (!activeId || activeId === referenceId || props.isGenerating) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleReferenceSortDrop(referenceId: string, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const activeId = draggingReferenceId ?? event.dataTransfer.getData('text/plain');
    if (activeId) reorderReference(activeId, referenceId);
    setDraggingReferenceId(null);
  }

  function handleReferenceSortDragEnd() {
    setDraggingReferenceId(null);
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
      return;
    }
    const nextDragState = referenceTransferState(event.dataTransfer, referenceDragState);
    setReferenceDragState(null);
    if (nextDragState !== 'supported') return;
    const files = referenceFilesFromTransfer(event.dataTransfer);
    if (files.length > 0) void addReferenceFiles(files, 'drag-drop');
  }

  function handleReferencePaste(event: ClipboardEvent<HTMLDivElement>) {
    if (props.isGenerating) return;
    if (props.referenceImages.length >= 4) {
      return;
    }
    const files = Array.from(event.clipboardData.items)
      .map((item) => (item.kind === 'file' ? item.getAsFile() : null))
      .filter((file): file is File => Boolean(file && isReferenceImageFile(file)));
    if (files.length === 0) return;
    event.preventDefault();
    void addReferenceFiles(files, 'clipboard');
  }

  function useLatestImageAsReference() {
    if (!latestImage?.imageUrls[0]) return;
    const imageUrl = latestImage.imageUrls[0];
    const nextReference: ReferenceImage = {
      id: `generated-${latestImage.id}-${Date.now()}`,
      name: '最近生成图',
      mimeType: imageUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : imageUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/png',
      dataUrl: imageUrl.startsWith('data:image/') ? imageUrl : undefined,
      localPath: latestImage.localImagePaths?.[0],
      previewUrl: imageUrl,
      source: 'generated-result',
      sourceGenerationId: latestImage.id,
      addedAt: new Date().toISOString()
    };
    updateReferences([nextReference, ...props.referenceImages.filter((reference) => reference.sourceGenerationId !== latestImage.id)]);
    setMode('image');
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
        if (props.isGenerating || props.referenceImages.length >= 4) return;
        const supportedPaths = payload.paths.filter(isSupportedReferencePath);
        if (supportedPaths.length > 0) void addReferencePaths(supportedPaths);
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

  function runGenerate() {
    const trimmedCompression = compression.trim();
    const parsedCompression = trimmedCompression ? Number(trimmedCompression) : Number.NaN;
    const outputCompression = trimmedCompression && Number.isFinite(parsedCompression)
      ? Math.max(75, Math.min(100, Math.round(parsedCompression)))
      : undefined;
    if (mode === 'image') {
      const referenceRoleMap = Object.fromEntries(props.referenceImages.map((reference) => [
        reference.id,
        referenceRoles[reference.id] ?? reference.role ?? 'auto'
      ]));
      props.onGenerate({
        mode: 'image-to-image',
        references: props.referenceImages,
        outputFormat,
        outputCompression,
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
      });
      return;
    }
    props.onGenerate({ mode: 'text-to-image', references: [], outputFormat, outputCompression });
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
              <strong>{props.isGenerating ? '渲染进行中' : latestImage ? '最近画面' : '准备生成'}</strong>
              <small>{providerAccessLabel(props.selectedProvider)} · {modelValue}</small>
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
              <Clock3 size={13} /> {sessionResults.length}
            </span>
          </div>
        </header>

        <div className="previewStage">
          {latestImage?.imageUrls[0] ? (
            <>
              <button className="latestPreview" onClick={() => props.onPreview(latestImage.imageUrls[0])}>
                <img src={latestImage.imageUrls[0]} alt={latestImage.prompt} />
                <span className="previewAction">
                  <Maximize2 size={15} /> 预览
                </span>
              </button>
              <button className="useAsReferenceButton" type="button" onClick={useLatestImageAsReference} disabled={props.isGenerating}>
                <ImagePlus size={15} /> 作为参考
              </button>
            </>
          ) : (
            <div className="previewEmpty">
              <div className="emptyIcon">
                <Sparkles size={25} />
              </div>
              <h2>还没有图片</h2>
              <p>在底部填写提示词，右侧确认参数后开始生成。</p>
              {props.isGenerating ? (
                <div className="generationOverlay inlineGenerationOverlay">
                  <span>
                    <Sparkles size={16} /> 正在生成画面
                  </span>
                  <small>任务已发送到当前模型，请稍候…</small>
                </div>
              ) : null}
            </div>
          )}
          {failedLatest && !latestImage ? (
            <div className={`previewError ${failedLatestNeedsCheck ? 'pendingRecovery' : ''}`}>
              <div>
                <strong>{failedLatestNeedsCheck ? '上一轮待核查' : '上一轮失败'}</strong>
                <span>
                  {failedLatestNeedsCheck
                    ? '同步连接先断开，中转后台可能仍在继续生成。稍后可重载历史，或到作品画廊查看是否已落盘。'
                    : failedLatest.error}
                </span>
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
          {props.isGenerating && latestImage?.imageUrls[0] ? (
            <div className="generationOverlay centerGenerationOverlay">
              <span>
                <Sparkles size={16} /> 正在生成画面
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
                <span>拖拽、粘贴和最近生成图</span>
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
                  {props.referenceImages.map((reference) => (
                    <article
                      className={`referenceTile ${draggingReferenceId === reference.id ? 'isDragging' : ''}`}
                      key={reference.id}
                      draggable={!props.isGenerating}
                      onDragStart={(event) => handleReferenceSortDragStart(reference.id, event)}
                      onDragOver={(event) => handleReferenceSortDragOver(reference.id, event)}
                      onDrop={(event) => handleReferenceSortDrop(reference.id, event)}
                      onDragEnd={handleReferenceSortDragEnd}
                    >
                      <button type="button" className="referenceThumb" onClick={() => reference.previewUrl && props.onPreview(reference.previewUrl)}>
                        {reference.previewUrl ? <img src={reference.previewUrl} alt={reference.name ?? '参考图'} /> : <ImagePlus size={18} />}
                      </button>
                      <span className="referenceSourceBadge" title={reference.name ?? referenceSourceLabel(reference.source)}>
                        {referenceSourceLabel(reference.source)}
                      </span>
                      <StudioSelect
                        className="referenceRoleSelect"
                        value={referenceRoles[reference.id] ?? reference.role ?? 'auto'}
                        options={REFERENCE_ROLE_OPTIONS}
                        disabled={props.isGenerating}
                        onChange={(value) => setReferenceRole(reference.id, value)}
                      />
                      <button className="referenceRemove" type="button" data-tooltip="移除参考图" aria-label="移除参考图" disabled={props.isGenerating} onClick={() => removeReference(reference.id)}>
                        <Trash2 size={13} />
                      </button>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p>添加本地图片，或拖拽/粘贴图片作为参考。</p>
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
              placeholder={mode === 'image' ? '描述你希望基于参考图改变什么，例如风格、构图、材质或细节' : '描述画面的主体、风格、光线、构图等，越具体效果越好'}
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
              压缩率
              <input value={compression} placeholder="自动 / 75-100" onChange={(event) => setCompression(event.target.value)} />
            </label>
            <label>
              审核
              <StudioSelect
                value={reviewMode}
                onChange={(value) => setReviewMode(value as ReviewMode)}
                options={[
                  { value: 'auto', label: '自动' },
                  { value: 'strict', label: '严格' },
                  { value: 'relaxed', label: '宽松' }
                ]}
              />
            </label>
            <label>
              数量
              <input type="number" min={1} max={4} value={props.count} onChange={(event) => props.onCountChange(Number(event.target.value))} />
            </label>
            <div className="generateStack">
              <button
                className="primaryGenerate"
                onClick={runGenerate}
                disabled={props.isGenerating || !props.prompt.trim() || (mode === 'image' && (!props.referenceImages.length || !canAttemptImageToImage))}
              >
                <Sparkles size={17} /> {props.isGenerating ? '生成中…' : mode === 'image' ? '启动参考生成' : '启动生成'}
              </button>
              {mode === 'image' && !canAttemptImageToImage ? <small className="generateHint">当前平台暂不支持图生图</small> : null}
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
          <label>
            模型
            <StudioSelect
              value={modelValue}
              onChange={props.onModelChange}
              options={modelOptions.map((modelId) => ({ value: modelId, label: modelId }))}
            />
          </label>
          <div className={`connectionState ${props.isRealProviderReady ? 'ready' : ''}`}>
            <ShieldCheck size={14} /> {props.isRealProviderReady ? '真实通道已就绪' : '未配置密钥时使用演示模式'}
          </div>
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
                {ratio.label}
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
                  {item.experimental ? <em>实验性</em> : null}
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

        <section className="railCard collapsedRail">
          <div>
            <ChevronDown size={16} /> 高级参数
          </div>
          <small>Seed、负面提示词、风格锁定、成本策略等会收纳到这里。</small>
        </section>
      </aside>
      {assistMode ? (
        <PromptAssistModal
          mode={assistMode}
          prompt={props.prompt}
          results={props.results}
          promptHistorySettings={props.promptHistorySettings}
          promptPolishSettings={effectivePromptPolishSettings}
          onClose={() => setAssistMode(null)}
          onApplyPrompt={applyAssistedPrompt}
          onDeleteRecord={props.onDeleteResult}
        />
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


