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
import { createPortal } from 'react-dom';
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
import { savePromptExcerpt } from '../services/inspirationApi';
import {
  createPromptTemplate,
  loadPromptTemplates,
  savePromptTemplates,
  type PromptTemplateCategory
} from '../services/promptTemplates';
import { readStorageValue, writeStorageValue } from '../services/safeStorage';
import { useStudioStore } from '../store/useStudioStore';
import type { ConfirmDialogRequest } from './confirmDialog';
import { PromptAssistModal } from './PromptAssistModal';
import { StudioSelect } from './StudioSelect';
import type { Translator } from '../i18n';

type GenerateSubmitOptions = {
  mode?: GenerationMode;
  references?: ReferenceImage[];
  outputFormat?: OutputFormat;
  outputCompression?: number;
  negativePrompt?: string;
  seed?: number;
  metadata?: Record<string, unknown>;
};

type BatchToolTab = 'variants' | 'compare';

type SizeOption = {
  value: string;
  ratio: string;
  desc: string;
  badge: string;
  experimental?: boolean;
};

const SIZE_OPTIONS: SizeOption[] = [
  { value: '1024x1024', ratio: '1:1', desc: 'Standard AI square image', badge: '1K' },
  { value: '1280x1280', ratio: '1:1', desc: 'HD avatar / product hero', badge: '2K' },
  { value: '1536x1536', ratio: '1:1', desc: 'Art avatar / album cover', badge: '2K' },
  { value: '2048x2048', ratio: '1:1', desc: 'Ultra HD square asset', badge: '4K', experimental: true },

  { value: '1280x720', ratio: '16:9', desc: '720P standard widescreen', badge: '1K' },
  { value: '1536x864', ratio: '16:9', desc: 'Common web / large screen image', badge: '2K' },
  { value: '2048x1152', ratio: '16:9', desc: 'HD landscape wallpaper', badge: '2K' },
  { value: '2560x1440', ratio: '16:9', desc: '2K crisp quality, standard upper range', badge: '2K' },
  { value: '3840x2160', ratio: '16:9', desc: '4K top quality, extreme image', badge: '4K', experimental: true },

  { value: '720x1280', ratio: '9:16', desc: 'Mobile short-video cover / story', badge: '1K' },
  { value: '864x1536', ratio: '9:16', desc: 'HD mobile vertical frame', badge: '2K' },
  { value: '1152x2048', ratio: '9:16', desc: 'Ultra HD mobile wallpaper', badge: '2K' },
  { value: '1440x2560', ratio: '9:16', desc: '2K mobile / full-screen frame', badge: '2K' },
  { value: '2160x3840', ratio: '9:16', desc: '4K vertical extreme output', badge: '4K', experimental: true },

  { value: '1792x768', ratio: '21:9', desc: 'Cinematic wide frame / landscape banner', badge: '2K' },
  { value: '2240x960', ratio: '21:9', desc: 'Ultrawide game wallpaper / wide concept', badge: '2K' },
  { value: '2576x1104', ratio: '21:9', desc: 'Ultra-wide high-res scene design', badge: '2K' },
  { value: '3136x1344', ratio: '21:9', desc: 'Cinematic giant-screen wide frame', badge: '4K', experimental: true },

  { value: '1024x768', ratio: '4:3', desc: 'Classic tablet / iPad base frame', badge: '1K' },
  { value: '1280x960', ratio: '4:3', desc: 'Traditional presentation / slide frame', badge: '2K' },
  { value: '2048x1536', ratio: '4:3', desc: 'Retina HD classic frame', badge: '2K' },
  { value: '2688x2016', ratio: '4:3', desc: 'High-quality classic illustration', badge: '4K', experimental: true },

  { value: '768x1024', ratio: '3:4', desc: 'E-book / regular vertical layout', badge: '1K' },
  { value: '960x1280', ratio: '3:4', desc: 'E-commerce hero / detail-page pick', badge: '2K' },
  { value: '1536x2048', ratio: '3:4', desc: 'HD tablet vertical poster', badge: '2K' },
  { value: '2016x2688', ratio: '3:4', desc: 'Art poster / fine publishing', badge: '4K', experimental: true },

  { value: '1152x768', ratio: '3:2', desc: 'Landscape photo / base frame', badge: '1K' },
  { value: '1536x1024', ratio: '3:2', desc: 'Landscape cover / scene image', badge: '2K' },
  { value: '2304x1536', ratio: '3:2', desc: 'HD landscape photography ratio', badge: '2K' },
  { value: '3072x2048', ratio: '3:2', desc: '4K landscape fine output', badge: '4K', experimental: true },

  { value: '768x1152', ratio: '2:3', desc: 'Vertical poster / base frame', badge: '1K' },
  { value: '1024x1536', ratio: '2:3', desc: 'Vertical character image / poster', badge: '2K' },
  { value: '1536x2304', ratio: '2:3', desc: 'HD vertical portrait poster', badge: '2K' },
  { value: '2048x3072', ratio: '2:3', desc: '4K vertical fine output', badge: '4K', experimental: true },

  { value: '1280x1024', ratio: '5:4', desc: 'Traditional monitor / product image', badge: '1K' },
  { value: '1600x1280', ratio: '5:4', desc: 'HD product showcase frame', badge: '2K' },
  { value: '2560x2048', ratio: '5:4', desc: 'High-detail product poster', badge: '2K' },
  { value: '3200x2560', ratio: '5:4', desc: '4K product image fine output', badge: '4K', experimental: true },

  { value: '1024x1280', ratio: '4:5', desc: 'Social post / vertical composition', badge: '1K' },
  { value: '1280x1600', ratio: '4:5', desc: 'Xiaohongshu / e-commerce vertical image', badge: '2K' },
  { value: '2048x2560', ratio: '4:5', desc: 'HD vertical commercial poster', badge: '2K' },
  { value: '2560x3200', ratio: '4:5', desc: '4K vertical fine output', badge: '4K', experimental: true }
];

const BATCH_VARIANT_RATIO_OPTIONS = [
  { ratio: '1:1', label: '1:1 square', size: '1024x1024', hint: 'Avatar / product hero' },
  { ratio: '16:9', label: '16:9 landscape', size: '1536x864', hint: 'Cover / large screen' },
  { ratio: '9:16', label: '9:16 vertical', size: '864x1536', hint: 'Mobile cover / wallpaper' },
  { ratio: '4:3', label: '4:3 landscape', size: '1280x960', hint: 'Slides / classic frame' },
  { ratio: '3:4', label: '3:4 vertical', size: '960x1280', hint: 'E-commerce / detail hero' },
  { ratio: '3:2', label: '3:2 photo landscape', size: '1536x1024', hint: 'Landscape photo / scene' },
  { ratio: '2:3', label: '2:3 poster vertical', size: '1024x1536', hint: 'Character / poster' },
  { ratio: '21:9', label: '21:9 cinematic wide', size: '1792x768', hint: 'Wide scene / banner' },
  { ratio: '4:5', label: '4:5 social vertical', size: '1280x1600', hint: 'Social / commercial poster' }
];

type BatchVariantRatioOption = typeof BATCH_VARIANT_RATIO_OPTIONS[number];

const REFERENCE_ROLE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'composition', label: 'Composition' },
  { value: 'style', label: 'Style' },
  { value: 'character', label: 'Character' },
  { value: 'color', label: 'Color' }
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

function providerAccessLabel(provider: ReturnType<typeof listProviders>[number], t: Translator) {
  if (provider.id === 'custom-http-provider') return t('generate.provider.customLabel');
  if (provider.id === 'openai-gpt-image') return t('generate.provider.openaiLabel');
  if (provider.id === 'minimax-image') return t('generate.provider.minimaxLabel');
  if (provider.id === 'gemini-image') return t('generate.provider.geminiLabel');
  if (provider.phase === 'local-lab') return `${t('generate.provider.localPrefix')} · ${provider.name}`;
  return provider.name;
}

function providerAccessDescription(provider: ReturnType<typeof listProviders>[number], t: Translator) {
  if (provider.id === 'custom-http-provider') return t('generate.provider.customDesc');
  if (provider.id === 'openai-gpt-image') return t('generate.provider.openaiDesc');
  if (provider.id === 'minimax-image') return t('generate.provider.minimaxDesc');
  if (provider.id === 'gemini-image') return t('generate.provider.geminiDesc');
  if (provider.id === 'comfyui-local') return t('generate.provider.comfyDesc');
  if (provider.phase === 'local-lab') return t('generate.provider.localPlannedDesc');
  return provider.notes[0] ?? t('generate.provider.defaultDesc');
}

function profileStatusLabel(status: ProviderConnectionProfile['lastTestStatus'], t?: Translator) {
  if (status === 'passed') return t ? t('common.status.passed') : 'Verified';
  if (status === 'warning') return t ? t('common.status.warning') : 'Warning';
  if (status === 'failed') return t ? t('common.status.failed') : 'Failed';
  return t ? t('common.status.untested') : 'Untested';
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

function formatDraftTime(value: string, t?: Translator) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t ? t('common.time.justNow') : 'Just now';
  const locale = t ? t('common.locale') : undefined;
  return date.toLocaleString(locale && locale !== 'common.locale' ? locale : undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function promptDraftKindLabel(kind: PromptDraftKind, t?: Translator) {
  const labels: Record<PromptDraftKind, string> = {
    manual: t ? t('draft.kind.manual') : 'Manual',
    previous: t ? t('draft.kind.previous') : 'Previous',
    polished: t ? t('draft.kind.polished') : 'Polished',
    retry: t ? t('draft.kind.retry') : 'Retry'
  };
  return labels[kind];
}

function referenceRoleOptions(t: Translator) {
  return [
    { value: 'auto', label: t('generate.reference.role.auto') },
    { value: 'composition', label: t('generate.reference.role.composition') },
    { value: 'style', label: t('generate.reference.role.style') },
    { value: 'character', label: t('generate.reference.role.character') },
    { value: 'color', label: t('generate.reference.role.color') }
  ];
}

function qualityOptions(t: Translator) {
  return [
    { value: 'auto', label: t('generate.option.auto') },
    { value: 'low', label: t('generate.option.low') },
    { value: 'medium', label: t('generate.option.medium') },
    { value: 'standard', label: t('generate.option.standard') },
    { value: 'high', label: t('generate.option.high') }
  ];
}

function referenceStrengthOptions(t: Translator) {
  return [
    { value: 'auto', label: t('generate.option.auto') },
    { value: 'low', label: t('generate.imageTuning.strengthLow') },
    { value: 'medium', label: t('generate.imageTuning.strengthMedium') },
    { value: 'high', label: t('generate.imageTuning.strengthHigh') }
  ];
}

function batchRatioLabel(option: BatchVariantRatioOption, t: Translator) {
  const key = `generate.batch.ratioLabel.${option.ratio}` as Parameters<Translator>[0];
  const translated = t(key);
  return translated === key ? option.label : translated;
}

function batchRatioHint(option: BatchVariantRatioOption, t: Translator) {
  const key = `generate.batch.ratioHint.${option.ratio}` as Parameters<Translator>[0];
  const translated = t(key);
  return translated === key ? option.hint : translated;
}

function sizeOptionDescription(option: SizeOption, t: Translator) {
  const key = `generate.size.desc.${option.value}` as Parameters<Translator>[0];
  const translated = t(key);
  return translated === key ? option.desc : translated;
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
  const label = title || `${promptDraftKindLabel(kind)} draft`;
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


function buildSavedPromptTitle(prompt: string, fallback = 'Current Prompt') {
  const firstLine = prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? '';
  const compact = firstLine.replace(/\s+/g, ' ').slice(0, 32).trim();
  return compact || fallback;
}

function inferPromptExcerptLanguage(prompt: string) {
  if (/[\u3040-\u30ff]/.test(prompt)) return 'ja' as const;
  if (/[\u4e00-\u9fff]/.test(prompt)) return 'zh' as const;
  if (/[a-zA-Z]/.test(prompt)) return 'en' as const;
  return 'auto' as const;
}

function inferPromptExcerptCategory(prompt: string) {
  const normalized = prompt.toLowerCase();
  if (/negative|不要|避免|no\s|without/.test(normalized)) return 'negative' as const;
  if (/角色|character|portrait|头像|立绘/.test(normalized)) return 'character' as const;
  if (/产品|商品|product|ecommerce|packshot/.test(normalized)) return 'product' as const;
  if (/海报|poster|kv|cover|封面/.test(normalized)) return 'poster' as const;
  if (/游戏|game|道具|icon|asset/.test(normalized)) return 'game-art' as const;
  if (/摄影|photo|camera|lens|镜头/.test(normalized)) return 'photography' as const;
  if (/场景|scene|landscape|environment/.test(normalized)) return 'scene' as const;
  return 'general' as const;
}

function inferPromptTemplateCategory(prompt: string, mode: DefaultGenerationMode): PromptTemplateCategory {
  if (mode === 'image') return 'image-to-image';
  const normalized = prompt.toLowerCase();
  if (/海报|poster|kv|cover|封面/.test(normalized)) return 'commercial-poster';
  if (/产品|商品|product|ecommerce|packshot/.test(normalized)) return 'ecommerce';
  if (/角色|character|portrait|头像|立绘/.test(normalized)) return 'character';
  if (/游戏|game|道具|icon|asset/.test(normalized)) return 'game-asset';
  if (/ui|图标|icon|logo/.test(normalized)) return 'icon-ui';
  if (/小红书|社媒|social|thumbnail|封面/.test(normalized)) return 'social-cover';
  return 'style';
}

function buildSavedPromptTags(mode: DefaultGenerationMode, t?: Translator) {
  return [
    t ? t('generate.prompt.tagCreateDesk') : 'AI Create',
    mode === 'image' ? (t ? t('generate.prompt.tagImageToImage') : 'Image to image') : (t ? t('generate.prompt.tagTextToImage') : 'Text to image'),
    t ? t('generate.prompt.tagCurrentPrompt') : 'Current Prompt'
  ];
}

function resolveActivePromptPolishConfigId(settings: PromptPolishSettings) {
  const currentConfigId = promptPolishConfigId(settings.displayName, settings.baseUrl);
  const exactConfig = settings.savedConfigs.find((config) => config.id === currentConfigId);
  return exactConfig?.id ?? settings.savedConfigs[0]?.id ?? '__current__';
}

function referenceSourceLabel(source: ReferenceImage['source'], t: Translator) {
  const labels: Record<ReferenceImage['source'], string> = {
    upload: t('generate.reference.source.upload'),
    'generated-result': t('generate.reference.source.generated'),
    clipboard: t('generate.reference.source.clipboard'),
    'drag-drop': t('generate.reference.source.dragDrop'),
    inspiration: t('generate.reference.source.inspiration')
  };
  return labels[source] ?? source;
}

function parseBatchPromptLines(batchPromptText: string, fallbackPrompt: string) {
  const lines = batchPromptText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sourceLines = lines.length > 0 ? lines : [fallbackPrompt.trim()].filter(Boolean);
  return Array.from(new Set(sourceLines)).slice(0, 20);
}

export function ModernGeneratePage(props: {
  t: Translator;
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
  onAddBatchVariantsToBatchQueue?: (prompts: string[], sizes: string[], options?: GenerateSubmitOptions) => void;
  onAddCompareGroupToBatchQueue?: (profileIds: string[], options?: GenerateSubmitOptions) => void;
  batchQueueTaskCount?: number;
  batchQueueCurrentName?: string;
  batchQueueCurrentTaskCount?: number;
  batchQueueCurrentPendingCount?: number;
  onOpenBatchQueue?: () => void;
  onPreview: (imageUrl: string) => void;
  onReloadHistory: () => void | Promise<void>;
  onOpenLibrary: () => void;
  onDeleteResult: (recordId: string) => Promise<void>;
  onRequestConfirm: (request: ConfirmDialogRequest) => void;
  referenceImages: ReferenceImage[];
  onReferenceImagesChange: (references: ReferenceImage[]) => void;
}) {
  const t = props.t;
  const [mode, setMode] = useState<DefaultGenerationMode>(props.defaultMode);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(props.defaultOutputFormat);
  const [compression, setCompression] = useState('');
  const [promptStyleId, setPromptStyleId] = useState('auto');
  const [seedInput, setSeedInput] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [sdSamplerName, setSdSamplerName] = useState('');
  const [sdStepsInput, setSdStepsInput] = useState('20');
  const [sdCfgScaleInput, setSdCfgScaleInput] = useState('7');
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
  const [isPromptSaveMenuOpen, setIsPromptSaveMenuOpen] = useState(false);
  const [promptSaveMenuPosition, setPromptSaveMenuPosition] = useState<{
    top?: number;
    bottom?: number;
    right: number;
    placement: 'above' | 'below';
  } | null>(null);
  const [isSavingPromptAsset, setIsSavingPromptAsset] = useState(false);
  const [isBatchToolsOpen, setIsBatchToolsOpen] = useState(false);
  const [isQueueMenuOpen, setIsQueueMenuOpen] = useState(false);
  const [queueMenuPosition, setQueueMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [batchToolTab, setBatchToolTab] = useState<BatchToolTab>('variants');
  const [canvasPreviewIndex, setCanvasPreviewIndex] = useState(0);
  const [activeGeneratingMode, setActiveGeneratingMode] = useState<GenerationMode | null>(null);
  const [canvasClearedAfterByMode, setCanvasClearedAfterByMode] = useState<Partial<Record<CanvasGenerationMode, number>>>(() => loadCanvasClearedAfter());
  const [compareProfileIds, setCompareProfileIds] = useState<string[]>([]);
  const [batchPromptText, setBatchPromptText] = useState('');
  const [batchRatioValues, setBatchRatioValues] = useState<string[]>(() => [ratioFromSize(props.size)]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const promptSaveMenuRef = useRef<HTMLDivElement | null>(null);
  const promptSaveMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const promptSaveMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const queueMenuRef = useRef<HTMLDivElement | null>(null);
  const queueMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const queueMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const referenceNoticeTimerRef = useRef<number | null>(null);
  const draftNoticeTimerRef = useRef<number | null>(null);
  const activeGeneratingModeRef = useRef<GenerationMode | null>(null);
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
    { value: '__local__', label: t('generate.provider.localRule'), description: t('generate.provider.noModelCall') },
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
    label: profile.displayName || profile.modelId || t('generate.provider.unnamedProfile'),
    description: `${profile.modelId || t('generate.provider.noModel')} · ${profile.enabled ? t('generate.provider.currentEnabled') : profileStatusLabel(profile.lastTestStatus, t)}`
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
  const isSdWebUILocalProvider = props.selectedProvider.id === 'sd-webui-local';
  const isLocalGenerationProvider = isComfyUILocalProvider || isSdWebUILocalProvider;
  const modelValue = props.supportsOpenAICompatible ? props.providerConfig.modelId : props.selectedModelId;
  const activeProfileName = isComfyUILocalProvider
    ? t('generate.provider.localComfyName')
    : isSdWebUILocalProvider
      ? t('generate.provider.localSdName')
      : props.activeProfile?.displayName ?? (props.supportsOpenAICompatible ? t('generate.provider.noSavedProfile') : props.selectedProvider.name);
  const activeProfileStatus = isLocalGenerationProvider
    ? t('generate.provider.localService')
    : props.activeProfile
      ? profileStatusLabel(props.activeProfile.lastTestStatus, t)
      : props.supportsOpenAICompatible ? t('generate.provider.draftLegacy') : t('generate.provider.builtIn');
  const activeProfileSecretText = isLocalGenerationProvider
    ? t('generate.provider.noSecret')
    : props.activeProfileSecretAvailable ? t('generate.provider.secretBound') : t('generate.provider.secretMissing');
  const activeProfileModelProbeText = isComfyUILocalProvider
    ? props.isRealProviderReady ? t('generate.provider.comfyReady') : t('generate.provider.comfyMissing')
    : isSdWebUILocalProvider
      ? props.isRealProviderReady ? t('generate.provider.sdReady') : t('generate.provider.sdMissing')
      : props.activeProfile?.lastModelProbe
        ? props.activeProfile.lastModelProbe.available ? t('generate.provider.modelHit') : t('generate.provider.modelMiss')
        : t('generate.provider.modelNotProbed');
  const selectedRatio = ratioFromSize(props.size);
  const selectedSize = SIZE_OPTIONS.find((item) => item.value === props.size);
  const currentRatioSizes = useMemo(() => SIZE_OPTIONS.filter((item) => item.ratio === selectedRatio), [selectedRatio]);
  const batchRatioOptions = useMemo(() => {
    const options = [...BATCH_VARIANT_RATIO_OPTIONS];
    if (!options.some((option) => option.ratio === selectedRatio)) {
      options.unshift({
        ratio: selectedRatio,
        label: t('generate.batch.ratioCurrentLabel', { ratio: selectedRatio }),
        size: props.size,
        hint: t('generate.batch.ratioCurrentHint')
      });
    }
    return options;
  }, [props.size, selectedRatio, t]);
  const batchRatioCandidateSet = useMemo(() => new Set(batchRatioOptions.map((option) => option.ratio)), [batchRatioOptions]);
  const selectedBatchRatioValues = batchRatioValues.filter((item) => batchRatioCandidateSet.has(item));
  const selectedBatchVariantSizes = selectedBatchRatioValues
    .map((ratio) => batchRatioOptions.find((option) => option.ratio === ratio)?.size)
    .filter((item): item is string => Boolean(item));
  const batchPromptLines = parseBatchPromptLines(batchPromptText, props.prompt);
  const estimatedBatchVariantTasks = batchPromptLines.length * Math.max(selectedBatchVariantSizes.length, 0);
  const canCreateBatchVariants = Boolean(
    props.onAddBatchVariantsToBatchQueue &&
    !props.isGenerating &&
    batchPromptLines.length > 0 &&
    selectedBatchVariantSizes.length > 0 &&
    estimatedBatchVariantTasks <= 40
  );
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
  const effectiveActiveGeneratingMode = activeGeneratingMode ?? activeGeneratingModeRef.current;
  const isCurrentModeGenerating = props.isGenerating && effectiveActiveGeneratingMode === currentGenerationMode;
  const generateButtonLabel = isCurrentModeGenerating
    ? t('generate.action.rendering')
    : props.isGenerating
      ? t('generate.action.otherMode')
      : mode === 'image'
        ? t('generate.action.image')
        : t('generate.action.text');
  const failedLatest = !isCurrentModeGenerating && latestCurrentModeResult?.status === 'failed'
    ? latestCurrentModeResult
    : undefined;
  const failedLatestDiagnosis = failedLatest ? diagnoseGenerationFailure(failedLatest, t) : null;
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
      ? t('generate.reference.status.full')
      : props.referenceImages.length > 0
        ? t('generate.reference.status.sortable')
        : t('generate.reference.status.dropOrPaste'));

  useEffect(() => {
    setCanvasPreviewIndex((index) => {
      if (!latestCanvasBatchKey || canvasPreviewItems.length <= 1) return 0;
      return Math.min(index, canvasPreviewItems.length - 1);
    });
  }, [canvasPreviewItems.length, latestCanvasBatchKey]);

  useEffect(() => {
    if (!props.isGenerating) {
      activeGeneratingModeRef.current = null;
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
    setBatchRatioValues((current) => {
      const validCurrent = current.filter((item) => batchRatioCandidateSet.has(item));
      if (validCurrent.length > 0) return validCurrent;
      return batchRatioCandidateSet.has(selectedRatio) ? [selectedRatio] : batchRatioOptions.slice(0, 1).map((option) => option.ratio);
    });
  }, [batchRatioCandidateSet, batchRatioOptions, selectedRatio]);

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

  function updatePromptSaveMenuPosition() {
    const rect = promptSaveMenuButtonRef.current?.getBoundingClientRect();
    if (!rect) {
      setPromptSaveMenuPosition(null);
      return;
    }
    const viewportPadding = 12;
    const gap = 8;
    const estimatedMenuHeight = 214;
    const right = Math.max(viewportPadding, Math.round(window.innerWidth - rect.right));
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenAbove = spaceBelow < estimatedMenuHeight + gap && rect.top > estimatedMenuHeight + gap;
    if (shouldOpenAbove) {
      setPromptSaveMenuPosition({
        bottom: Math.max(viewportPadding, Math.round(window.innerHeight - rect.top + gap)),
        right,
        placement: 'above'
      });
      return;
    }
    setPromptSaveMenuPosition({
      top: Math.max(viewportPadding, Math.round(rect.bottom + gap)),
      right,
      placement: 'below'
    });
  }

  function updateQueueMenuPosition() {
    const rect = queueMenuButtonRef.current?.getBoundingClientRect();
    if (!rect) {
      setQueueMenuPosition(null);
      return;
    }
    setQueueMenuPosition({
      top: Math.round(rect.bottom + 8),
      right: Math.max(12, Math.round(window.innerWidth - rect.right))
    });
  }

  useEffect(() => {
    if (!isQueueMenuOpen) return undefined;
    updateQueueMenuPosition();

    function closeQueueMenuOnOutsideClick(event: MouseEvent) {
      if (queueMenuRef.current?.contains(event.target as Node)) return;
      if (queueMenuPanelRef.current?.contains(event.target as Node)) return;
      setIsQueueMenuOpen(false);
    }

    function closeQueueMenuOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsQueueMenuOpen(false);
    }

    document.addEventListener('mousedown', closeQueueMenuOnOutsideClick);
    document.addEventListener('keydown', closeQueueMenuOnEscape);
    window.addEventListener('resize', updateQueueMenuPosition);
    window.addEventListener('scroll', updateQueueMenuPosition, true);
    return () => {
      document.removeEventListener('mousedown', closeQueueMenuOnOutsideClick);
      document.removeEventListener('keydown', closeQueueMenuOnEscape);
      window.removeEventListener('resize', updateQueueMenuPosition);
      window.removeEventListener('scroll', updateQueueMenuPosition, true);
    };
  }, [isQueueMenuOpen]);

  useEffect(() => {
    if (!isPromptSaveMenuOpen) return undefined;
    updatePromptSaveMenuPosition();

    function closePromptSaveMenuOnOutsideClick(event: MouseEvent) {
      if (promptSaveMenuRef.current?.contains(event.target as Node)) return;
      if (promptSaveMenuPanelRef.current?.contains(event.target as Node)) return;
      setIsPromptSaveMenuOpen(false);
    }

    function closePromptSaveMenuOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsPromptSaveMenuOpen(false);
    }

    document.addEventListener('mousedown', closePromptSaveMenuOnOutsideClick);
    document.addEventListener('keydown', closePromptSaveMenuOnEscape);
    window.addEventListener('resize', updatePromptSaveMenuPosition);
    window.addEventListener('scroll', updatePromptSaveMenuPosition, true);
    return () => {
      document.removeEventListener('mousedown', closePromptSaveMenuOnOutsideClick);
      document.removeEventListener('keydown', closePromptSaveMenuOnEscape);
      window.removeEventListener('resize', updatePromptSaveMenuPosition);
      window.removeEventListener('scroll', updatePromptSaveMenuPosition, true);
    };
  }, [isPromptSaveMenuOpen]);

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
      showDraftNotice(t('generate.prompt.noticeEmptyDraft'));
      return;
    }
    updatePromptDrafts(mergePromptDraft(promptDrafts, draft));
    showDraftNotice(t('generate.prompt.noticeDraftSaved'));
  }

  function saveCurrentPromptAsTemplate() {
    const prompt = props.prompt.trim();
    if (!prompt) {
      setIsPromptSaveMenuOpen(false);
      showDraftNotice(t('generate.prompt.noticeEmptyTemplate'));
      return;
    }
    const template = createPromptTemplate({
      title: buildSavedPromptTitle(prompt, t('generate.prompt.savedTitleFallback')),
      category: inferPromptTemplateCategory(prompt, mode),
      tone: t('generate.prompt.templateTone'),
      description: t('generate.prompt.templateDesc'),
      prompt,
      tags: buildSavedPromptTags(mode, t)
    });
    const currentTemplates = loadPromptTemplates();
    const nextTemplates = [template, ...currentTemplates.filter((item) => item.prompt.trim() !== prompt)].slice(0, 300);
    savePromptTemplates(nextTemplates);
    setIsPromptSaveMenuOpen(false);
    showDraftNotice(t('generate.prompt.noticeTemplateSaved'));
  }

  async function saveCurrentPromptAsExcerpt() {
    const prompt = props.prompt.trim();
    if (!prompt || isSavingPromptAsset) {
      if (!prompt) {
        setIsPromptSaveMenuOpen(false);
        showDraftNotice(t('generate.prompt.noticeEmptyExcerpt'));
      }
      return;
    }
    const now = String(Date.now());
    setIsSavingPromptAsset(true);
    try {
      await savePromptExcerpt({
        id: `current-prompt-${now}`,
        title: buildSavedPromptTitle(prompt, t('generate.prompt.savedTitleFallback')),
        prompt,
        sourceName: t('generate.prompt.excerptSource'),
        language: inferPromptExcerptLanguage(prompt),
        category: inferPromptExcerptCategory(prompt),
        tags: buildSavedPromptTags(mode, t),
        note: t('generate.prompt.excerptNote'),
        favorite: false,
        createdAt: now,
        updatedAt: now
      });
      setIsPromptSaveMenuOpen(false);
      showDraftNotice(t('generate.prompt.noticeExcerptSaved'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showDraftNotice(t('generate.prompt.noticeExcerptFailed', { message }));
    } finally {
      setIsSavingPromptAsset(false);
    }
  }

  function applyPromptDraft(draft: PromptDraft) {
    if (props.prompt.trim() && props.prompt.trim() !== draft.prompt.trim()) {
      updatePromptDrafts(mergePromptDraft(promptDrafts, buildPromptDraft(props.prompt, 'previous', t('generate.draft.labelBeforeReplace'))));
    }
    props.onPromptChange(draft.prompt);
    promptInputRef.current?.focus();
    showDraftNotice(t('generate.prompt.noticeDraftApplied'));
  }

  function deletePromptDraft(draftId: string) {
    updatePromptDrafts(promptDrafts.filter((draft) => draft.id !== draftId));
    showDraftNotice(t('generate.prompt.noticeDraftDeleted'));
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
      updatePromptDrafts(mergePromptDraft(promptDrafts, buildPromptDraft(props.prompt, placement === 'replace' ? 'previous' : 'manual', placement === 'replace' ? t('generate.draft.labelBeforeReplace') : t('generate.draft.labelBeforeAppend'))));
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
      updatePromptDrafts(mergePromptDraft(mergePromptDraft(promptDrafts, buildPromptDraft(sourcePrompt, 'previous', t('generate.draft.labelBeforePolish'))), buildPromptDraft(polished, 'polished', t('generate.draft.labelLocalPolish'))));
      props.onPromptChange(polished);
      return;
    }
    if (!effectivePromptPolishSettings.baseUrl.trim() || !effectivePromptPolishSettings.modelId.trim()) {
      const polished = polishPrompt(sourcePrompt, modeId, promptStyleId);
      updatePromptDrafts(mergePromptDraft(mergePromptDraft(promptDrafts, buildPromptDraft(sourcePrompt, 'previous', t('generate.draft.labelBeforePolish'))), buildPromptDraft(polished, 'polished', t('generate.draft.labelLocalFallback'))));
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
      updatePromptDrafts(mergePromptDraft(mergePromptDraft(promptDrafts, buildPromptDraft(sourcePrompt, 'previous', t('generate.draft.labelBeforePolish'))), buildPromptDraft(polished, 'polished', t('generate.draft.labelModelPolish'))));
      props.onPromptChange(polished);
    } catch {
      if (props.promptPolishSettings.fallbackToLocal) {
        const polished = polishPrompt(sourcePrompt, modeId, promptStyleId);
        updatePromptDrafts(mergePromptDraft(mergePromptDraft(promptDrafts, buildPromptDraft(sourcePrompt, 'previous', t('generate.draft.labelBeforePolish'))), buildPromptDraft(polished, 'polished', t('generate.draft.labelLocalFallback'))));
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
      showReferenceNotice(t('generate.reference.noticeFull'), 'warning');
      return;
    }
    const incomingFiles = Array.from(files);
    const supportedFiles = incomingFiles.filter(isReferenceImageFile);
    const selectedFiles = supportedFiles
      .slice(0, slots);
    if (selectedFiles.length === 0) {
      showReferenceNotice(t('generate.reference.noticeNoUsableImage'), 'warning');
      return;
    }
    try {
      const references = (await Promise.all(selectedFiles.map((file) => fileToReferenceImage(file, source, t))))
        .map((reference) => ({ ...reference, role: props.defaultReferenceRole }));
      const nextReferences = normalizeReferences([...props.referenceImages, ...references]);
      props.onReferenceImagesChange(nextReferences);
      setMode('image');
      const addedCount = Math.max(0, nextReferences.length - props.referenceImages.length);
      if (supportedFiles.length > selectedFiles.length) {
        showReferenceNotice(t('generate.reference.noticeAddedLimit', { count: addedCount }), 'warning');
      } else if (addedCount < selectedFiles.length) {
        showReferenceNotice(addedCount > 0 ? t('generate.reference.noticeAddedDuplicate', { count: addedCount }) : t('generate.reference.noticeDuplicate'), 'warning');
      } else {
        showReferenceNotice(t('generate.reference.noticeAdded', { count: addedCount }));
      }
    } catch {
      showReferenceNotice(t('generate.reference.noticeReadFailed'), 'error');
      return;
    }
  }

  async function addReferencePaths(paths: string[]) {
    if (!paths.length || props.isGenerating) return;
    const slots = Math.max(0, 4 - props.referenceImages.length);
    if (slots === 0) {
      showReferenceNotice(t('generate.reference.noticeFull'), 'warning');
      return;
    }
    const supportedPaths = paths.filter(isSupportedReferencePath);
    if (!supportedPaths.length) {
      showReferenceNotice(t('generate.reference.noticeUnsupportedDrop'), 'warning');
      return;
    }
    const references = await referenceImagesFromPaths(supportedPaths, slots);
    if (!references.length) {
      showReferenceNotice(t('generate.reference.noticeDropReadFailed'), 'error');
      return;
    }
    const nextReferences = normalizeReferences([...props.referenceImages, ...references]);
    props.onReferenceImagesChange(nextReferences);
    setMode('image');
    const addedCount = Math.max(0, nextReferences.length - props.referenceImages.length);
    showReferenceNotice(
      supportedPaths.length > slots
        ? t('generate.reference.noticeAddedLimit', { count: addedCount })
        : t('generate.reference.noticeAdded', { count: addedCount }),
      supportedPaths.length > slots ? 'warning' : 'success'
    );
  }

  function removeReference(referenceId: string) {
    updateReferences(props.referenceImages.filter((reference) => reference.id !== referenceId));
    showReferenceNotice(t('generate.reference.noticeRemoved'));
    setReferenceRoles((current) => {
      const next = { ...current };
      delete next[referenceId];
      return next;
    });
  }

  function clearReferences() {
    updateReferences([]);
    setReferenceRoles({});
    showReferenceNotice(t('generate.reference.noticeCleared'));
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
    showReferenceNotice(t('generate.reference.noticeSorted'));
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
      showReferenceNotice(t('generate.reference.noticeFull'), 'warning');
      return;
    }
    const nextDragState = referenceTransferState(event.dataTransfer, referenceDragState);
    setReferenceDragState(null);
    if (nextDragState !== 'supported') {
      showReferenceNotice(t('generate.reference.noticeUnsupportedDrop'), 'warning');
      return;
    }
    const files = referenceFilesFromTransfer(event.dataTransfer);
    if (files.length > 0) void addReferenceFiles(files, 'drag-drop');
  }

  function handleReferencePaste(event: ClipboardEvent<HTMLDivElement>) {
    if (props.isGenerating) return;
    if (props.referenceImages.length >= 4) {
      const hasImage = Array.from(event.clipboardData.items).some((item) => item.kind === 'file' && item.type.startsWith('image/'));
      if (hasImage) showReferenceNotice(t('generate.reference.noticeFull'), 'warning');
      return;
    }
    const files = Array.from(event.clipboardData.items)
      .map((item) => (item.kind === 'file' ? item.getAsFile() : null))
      .filter((file): file is File => Boolean(file && isReferenceImageFile(file)));
    if (files.length === 0) {
      const hasFile = Array.from(event.clipboardData.items).some((item) => item.kind === 'file');
      if (hasFile) showReferenceNotice(t('generate.reference.noticeClipboardUnsupported'), 'warning');
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
      showReferenceNotice(t('generate.reference.noticeFull'), 'warning');
      return;
    }
    const imageUrl = activeCanvasPreviewItem.imageUrl;
    const nextReference: ReferenceImage = {
      id: `generated-${sourceRecord.id}-${activeCanvasPreviewItem.imageIndex}-${Date.now()}`,
      name: canvasPreviewTotal > 1 ? t('generate.reference.latestNameWithCount', { index: canvasPreviewPosition, total: canvasPreviewTotal }) : t('generate.reference.latestName'),
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
    showReferenceNotice(t('generate.reference.noticeLatestAdded'));
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
          showReferenceNotice(t('generate.reference.noticeFull'), 'warning');
          return;
        }
        const supportedPaths = payload.paths.filter(isSupportedReferencePath);
        if (supportedPaths.length > 0) void addReferencePaths(supportedPaths);
        else showReferenceNotice(t('generate.reference.noticeUnsupportedDrop'), 'warning');
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
    const parsedSdSteps = sdStepsInput.trim() ? Number(sdStepsInput.trim()) : Number.NaN;
    const parsedSdCfgScale = sdCfgScaleInput.trim() ? Number(sdCfgScaleInput.trim()) : Number.NaN;
    const sdWebUIOptions = isSdWebUILocalProvider
      ? {
          samplerName: sdSamplerName.trim() || undefined,
          steps: Number.isFinite(parsedSdSteps) ? Math.max(1, Math.min(150, Math.round(parsedSdSteps))) : undefined,
          cfgScale: Number.isFinite(parsedSdCfgScale) ? Math.max(1, Math.min(30, Math.round(parsedSdCfgScale * 10) / 10)) : undefined
        }
      : undefined;
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
          },
          ...(sdWebUIOptions ? { sdWebUI: sdWebUIOptions } : {})
        }
      };
    }
    return {
      mode: 'text-to-image',
      references: [],
      outputFormat,
      outputCompression,
      ...advancedGenerationOptions,
      metadata: sdWebUIOptions ? { sdWebUI: sdWebUIOptions } : undefined
    };
  }

  function isCurrentSizeSupportedByModel() {
    const selectedModelForGeneration = props.supportsOpenAICompatible ? props.providerConfig.modelId : props.selectedModelId;
    if (selectedSize?.badge === '4K' && isKnown4KUnsupportedModel(props.selectedProvider.id, selectedModelForGeneration)) {
      window.alert(t('generate.validation.unsupported4k', { model: selectedModelForGeneration || t('generate.validation.noModel') }));
      return false;
    }
    return true;
  }

  function runGenerate() {
    if (!isCurrentSizeSupportedByModel()) return;
    const generationOptions = buildCurrentGenerationOptions();
    if (mode === 'image') {
      activeGeneratingModeRef.current = 'image-to-image';
      setActiveGeneratingMode('image-to-image');
      props.onGenerate(generationOptions);
      updatePromptDrafts(mergePromptDraft(promptDrafts, buildPromptDraft(props.prompt, 'retry', t('generate.draft.labelSubmittedImage'))));
      return;
    }
    activeGeneratingModeRef.current = 'text-to-image';
    setActiveGeneratingMode('text-to-image');
    props.onGenerate(generationOptions);
    updatePromptDrafts(mergePromptDraft(promptDrafts, buildPromptDraft(props.prompt, 'retry', t('generate.draft.labelSubmittedText'))));
  }

  function addToBatchQueue() {
    if (!props.onAddToBatchQueue || !isCurrentSizeSupportedByModel()) return;
    setIsQueueMenuOpen(false);
    props.onAddToBatchQueue(buildCurrentGenerationOptions());
    updatePromptDrafts(mergePromptDraft(promptDrafts, buildPromptDraft(props.prompt, 'manual', t('generate.draft.labelAddedQueue'))));
  }

  function toggleBatchRatio(ratioValue: string, checked: boolean) {
    setBatchRatioValues((current) => {
      const next = new Set(current.filter((item) => batchRatioCandidateSet.has(item)));
      if (checked) next.add(ratioValue);
      else next.delete(ratioValue);
      return Array.from(next);
    });
  }

  function addBatchVariantsToBatchQueue() {
    if (!props.onAddBatchVariantsToBatchQueue || !isCurrentSizeSupportedByModel()) return;
    if (batchPromptLines.length === 0) {
      showDraftNotice(t('generate.batch.noticeNeedPrompt'));
      return;
    }
    if (selectedBatchVariantSizes.length === 0) {
      showDraftNotice(t('generate.batch.noticeNeedRatio'));
      return;
    }
    if (estimatedBatchVariantTasks > 40) {
      showDraftNotice(t('generate.batch.noticeTooMany'));
      return;
    }
    props.onAddBatchVariantsToBatchQueue(batchPromptLines, selectedBatchVariantSizes, buildCurrentGenerationOptions());
    setIsQueueMenuOpen(false);
    updatePromptDrafts(mergePromptDraft(promptDrafts, buildPromptDraft(props.prompt, 'manual', t('generate.draft.labelAddedVariants'))));
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
      showDraftNotice(t('generate.batch.noticeNeedProfiles'));
      return;
    }
    props.onAddCompareGroupToBatchQueue(selectedCompareProfileIds, buildCurrentGenerationOptions());
    setIsQueueMenuOpen(false);
    updatePromptDrafts(mergePromptDraft(promptDrafts, buildPromptDraft(props.prompt, 'manual', t('generate.draft.labelAddedCompare'))));
  }

  const queueMenuPortalHost = typeof document === 'undefined'
    ? null
    : document.querySelector('.appShell') ?? document.body;

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
            <span className="tealLabel">{t('generate.title')}</span>
            <div className="workspaceTitleLine">
              <strong>{isCurrentModeGenerating ? t('generate.status.generating') : activeCanvasPreviewItem ? t('generate.status.recent') : t('generate.status.ready')}</strong>
            </div>
          </div>
          <div className="quickToolbar">
            <button className={`modeToggle ${mode === 'text' ? 'active' : ''}`} onClick={() => setMode('text')} title={t('generate.mode.text')} aria-label={t('generate.mode.text')}>
              <Sparkles size={15} /> <span className="buttonText">{t('generate.mode.text')}</span>
            </button>
            <button className={`modeToggle ${mode === 'image' ? 'active' : ''}`} onClick={() => setMode('image')} title={t('generate.mode.image')} aria-label={t('generate.mode.image')}>
              <Upload size={15} /> <span className="buttonText">{t('generate.mode.image')}</span>
            </button>
            <span>{selectedRatio}</span>
            <span>{props.size}</span>
            <span>{outputFormat}</span>
            <span className="sessionCount">
              <Clock3 size={13} /> {currentModeSessionResults.length}
            </span>
            <div className="quickQueueActions" ref={queueMenuRef} aria-label={t('generate.queue.actionsAria')}>
              <button
                className="quickQueueButton quickQueueMenuTrigger"
                ref={queueMenuButtonRef}
                type="button"
                onClick={() => {
                  updateQueueMenuPosition();
                  setIsQueueMenuOpen((open) => !open);
                }}
                disabled={props.isGenerating || (!props.onAddToBatchQueue && !props.onAddBatchVariantsToBatchQueue && !props.onAddCompareGroupToBatchQueue && !props.onOpenBatchQueue)}
                title={props.batchQueueCurrentName ? t('generate.queue.openTitleWithName', { name: props.batchQueueCurrentName }) : t('generate.queue.openTitle')}
                aria-label={t('generate.queue.openAria')}
                aria-expanded={isQueueMenuOpen}
                aria-haspopup="menu"
              >
                <ListChecks size={14} />
                <span className="buttonText">{props.batchQueueTaskCount ? t('generate.queue.labelWithCount', { count: props.batchQueueTaskCount }) : t('generate.queue.label')}</span>
                <ChevronDown size={13} />
              </button>
              {isQueueMenuOpen && queueMenuPosition && queueMenuPortalHost ? createPortal((
                <div
                  className="quickQueueMenu"
                  ref={queueMenuPanelRef}
                  role="menu"
                  aria-label={t('generate.queue.menuAria')}
                  style={{ top: queueMenuPosition.top, right: queueMenuPosition.right }}
                >
                  <div className="quickQueueMenuInfo" role="presentation">
                    <span>{t('generate.queue.current')}</span>
                    <strong>{props.batchQueueCurrentName ?? t('generate.queue.defaultName')}</strong>
                    <small>
                      {props.batchQueueCurrentName
                        ? t('generate.queue.taskPending', { tasks: props.batchQueueCurrentTaskCount ?? 0, pending: props.batchQueueCurrentPendingCount ?? 0 })
                        : t('generate.queue.autoCreate')}
                    </small>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={addToBatchQueue}
                    disabled={props.isGenerating || !props.onAddToBatchQueue}
                  >
                    <ListChecks size={14} />
                    <span>{t('generate.queue.add')}</span>
                    <small>{t('generate.queue.addHint')}</small>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsQueueMenuOpen(false);
                      setIsBatchToolsOpen(true);
                    }}
                    disabled={props.isGenerating || (!props.onAddBatchVariantsToBatchQueue && !props.onAddCompareGroupToBatchQueue)}
                  >
                    <GalleryHorizontal size={14} />
                    <span>{t('generate.queue.tools')}</span>
                    <small>{t('generate.queue.toolsHint')}</small>
                  </button>
                  {props.onOpenBatchQueue ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsQueueMenuOpen(false);
                        props.onOpenBatchQueue?.();
                      }}
                    >
                      <PanelRight size={14} />
                      <span>{t('generate.queue.openPage')}</span>
                      <small>{props.batchQueueTaskCount ? t('generate.queue.labelWithCount', { count: props.batchQueueTaskCount }) : t('generate.queue.openPageHint')}</small>
                    </button>
                  ) : null}
                </div>
              ), queueMenuPortalHost) : null}
            </div>
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
                aria-label={t('generate.canvas.previewAria')}
              >
                <img src={activeCanvasPreviewItem.imageUrl} alt={activeCanvasPreviewItem.record.prompt} />
                <span className="previewAction">
                  <Maximize2 size={15} /> {t('generate.canvas.preview')}
                </span>
              </button>
              {canvasPreviewTotal > 1 ? (
                <div className="canvasPreviewSwitcher" aria-label={t('generate.canvas.switcherAria')}>
                  <button
                    type="button"
                    className="canvasPreviewNav previous"
                    onClick={() => setCanvasPreviewIndex((index) => (index - 1 + canvasPreviewTotal) % canvasPreviewTotal)}
                    aria-label={t('generate.canvas.previous')}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span>{canvasPreviewPosition}/{canvasPreviewTotal}</span>
                  <button
                    type="button"
                    className="canvasPreviewNav next"
                    onClick={() => setCanvasPreviewIndex((index) => (index + 1) % canvasPreviewTotal)}
                    aria-label={t('generate.canvas.next')}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              ) : null}
              <button
                className="useAsReferenceButton"
                type="button"
                data-tooltip={props.referenceImages.length >= 4 ? t('generate.canvas.fullTooltip') : t('generate.canvas.addReferenceTooltip')}
                onClick={useLatestImageAsReference}
                disabled={props.isGenerating || props.referenceImages.length >= 4}
              >
                <ImagePlus size={15} /> {t('generate.canvas.asReference')}
              </button>
              <button
                className="clearCanvasButton"
                type="button"
                title={t('generate.canvas.clearTooltip')}
                aria-label={t('generate.canvas.clearAria')}
                onClick={clearCurrentCanvas}
                disabled={isCurrentModeGenerating}
              >
                <XCircle size={15} /> {t('generate.canvas.clear')}
              </button>
            </>
          ) : (
            <div className="previewEmpty">
              <div className="emptyIcon">
                <Sparkles size={25} />
              </div>
              <h2>{mode === 'image' ? t('generate.canvas.emptyImageTitle') : t('generate.canvas.emptyTextTitle')}</h2>
              <p>{mode === 'image' ? t('generate.canvas.emptyImageHint') : t('generate.canvas.emptyTextHint')}</p>
              {isCurrentModeGenerating ? (
                <div className="generationOverlay inlineGenerationOverlay">
                  <span>
                    <Sparkles size={16} /> {t('generate.canvas.rendering')}
                  </span>
                  <small>{t('generate.canvas.renderingHint')}</small>
                </div>
              ) : null}
            </div>
          )}
          {failedLatest && !activeCanvasPreviewItem ? (
            <div className={`previewError ${failedLatestNeedsCheck ? 'pendingRecovery' : ''}`}>
              <div>
                <strong>{failedLatestDiagnosis?.title ?? (failedLatestNeedsCheck ? t('generate.canvas.failedPending') : t('generate.canvas.failed'))}</strong>
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
                  <RotateCcw size={13} /> {t('generate.canvas.reloadHistory')}
                </button>
                <button type="button" onClick={props.onOpenLibrary}>
                  <GalleryHorizontal size={13} /> {t('generate.canvas.openGallery')}
                </button>
              </div>
            </div>
          ) : null}
          {isCurrentModeGenerating && activeCanvasPreviewItem?.imageUrl ? (
            <div className="generationOverlay centerGenerationOverlay">
              <span>
                <Sparkles size={16} /> {t('generate.canvas.rendering')}
              </span>
              <small>{t('generate.canvas.renderingHint')}</small>
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
                <strong>{t('generate.reference.title')}</strong>
                <span>{props.referenceImages.length}/4</span>
              </div>
              <small>
                <span>{t('generate.reference.supportedTypes')}</span>
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
              <ImagePlus size={17} /> {t('generate.reference.add')}
            </button>
            {props.referenceImages.length > 0 ? (
              <>
                <button
                  className="referenceClear"
                  type="button"
                  data-tooltip={t('generate.reference.clearTooltip')}
                  aria-label={t('generate.reference.clearAria')}
                  disabled={props.isGenerating}
                  onClick={clearReferences}
                >
                  <XCircle size={15} /> {t('generate.reference.clear')}
                </button>
                <div className="referenceStrip">
                  {props.referenceImages.map((reference, index) => {
                    const roleValue = referenceRoles[reference.id] ?? reference.role ?? 'auto';
                    const roleLabel = referenceRoleOptions(t).find((option) => option.value === roleValue)?.label ?? t('generate.reference.role.auto');
                    const sourceLabel = referenceSourceLabel(reference.source, t);
                    const referenceTitle = t('generate.reference.tileTitle', { index: index + 1, source: sourceLabel, role: roleLabel, name: reference.name ? t('generate.reference.tileTitleName', { name: reference.name }) : '' });
                    return (
                      <article
                        className={`referenceTile ${draggingReferenceId === reference.id ? 'isDragging' : ''} ${referenceDropTargetId === reference.id ? 'isDropTarget' : ''}`}
                        key={reference.id}
                        title={t('generate.reference.tileSortHint', { title: referenceTitle })}
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
                          aria-label={t('generate.reference.previewAria', { title: referenceTitle })}
                          onClick={() => reference.previewUrl && props.onPreview(reference.previewUrl)}
                        >
                          {reference.previewUrl ? <img src={reference.previewUrl} alt={reference.name ?? t('generate.reference.thumbAlt', { index: index + 1 })} /> : <ImagePlus size={18} />}
                        </button>
                        <span className="referenceSourceBadge" title={reference.name ?? sourceLabel}>
                          #{index + 1} {sourceLabel}
                        </span>
                        <StudioSelect
                          className="referenceRoleSelect"
                          value={roleValue}
                          options={referenceRoleOptions(t)}
                          disabled={props.isGenerating}
                          onChange={(value) => setReferenceRole(reference.id, value)}
                        />
                        <button className="referenceRemove" type="button" data-tooltip={t('generate.reference.removeTooltip')} aria-label={t('generate.reference.removeAria', { index: index + 1 })} disabled={props.isGenerating} onClick={() => removeReference(reference.id)}>
                          <Trash2 size={13} />
                        </button>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="referenceEmptyState">{t('generate.reference.empty')}</p>
            )}
          </div>
        ) : null}

        <div className={`promptDock ${promptWidthState}`}>
          <div className="promptHeaderRow">
            <div>
              <strong>{t('generate.prompt.title')}</strong>
              <span>{t('generate.prompt.length', { count: promptLength })}</span>
            </div>
            <div className="promptActions" aria-label={t('generate.prompt.actionsAria')}>
              <button type="button" className="chipButton" data-tooltip={t('generate.prompt.assistTooltip')} onClick={() => setAssistMode('inspiration')}>
                <Sparkles size={13} /> <span className="buttonText">{t('generate.prompt.assist')}</span>
              </button>
              <div className="promptSaveMenuWrap" ref={promptSaveMenuRef}>
                <button
                  type="button"
                  className="chipButton promptSaveIconButton"
                  data-tooltip={t('generate.prompt.saveTooltip')}
                  aria-label={t('generate.prompt.saveAria')}
                  ref={promptSaveMenuButtonRef}
                  aria-haspopup="menu"
                  aria-expanded={isPromptSaveMenuOpen}
                  onClick={() => {
                    updatePromptSaveMenuPosition();
                    setIsPromptSaveMenuOpen((open) => !open);
                  }}
                >
                  <Save size={14} />
                </button>
                {isPromptSaveMenuOpen && promptSaveMenuPosition && queueMenuPortalHost ? createPortal((
                  <div
                    className={`promptSaveFloatingMenu is${promptSaveMenuPosition.placement === 'above' ? 'Above' : 'Below'}`}
                    ref={promptSaveMenuPanelRef}
                    role="menu"
                    aria-label={t('generate.prompt.saveMenuAria')}
                    style={{ top: promptSaveMenuPosition.top, bottom: promptSaveMenuPosition.bottom, right: promptSaveMenuPosition.right }}
                  >
                    <button type="button" role="menuitem" onClick={() => { saveCurrentPromptDraft(); setIsPromptSaveMenuOpen(false); }}>
                      <strong>{t('generate.prompt.saveDraft')}</strong>
                      <small>{t('generate.prompt.saveDraftHint')}</small>
                    </button>
                    <button type="button" role="menuitem" disabled={isSavingPromptAsset} onClick={() => void saveCurrentPromptAsExcerpt()}>
                      <strong>{t('generate.prompt.saveExcerpt')}</strong>
                      <small>{t('generate.prompt.saveExcerptHint')}</small>
                    </button>
                    <button type="button" role="menuitem" onClick={saveCurrentPromptAsTemplate}>
                      <strong>{t('generate.prompt.saveTemplate')}</strong>
                      <small>{t('generate.prompt.saveTemplateHint')}</small>
                    </button>
                  </div>
                ), queueMenuPortalHost) : null}
              </div>
              <button type="button" className="chipButton" data-tooltip={t('generate.prompt.draftTooltip')} onClick={() => setIsDraftLibraryOpen(true)}>
                <Library size={13} /> <span className="buttonText">{t('generate.prompt.draft')} {promptDrafts.length}/12</span>
              </button>
              <div className="promptPolishQuickGroup">
                <button type="button" className="chipButton" data-tooltip={t('generate.prompt.polishTooltip')} disabled={isQuickPolishing || !props.prompt.trim()} onClick={runQuickPromptPolish}>
                  <Wand2 size={13} /> <span className="buttonText">{isQuickPolishing ? t('generate.prompt.polishing') : t('generate.prompt.polish')}</span>
                </button>
                <StudioSelect
                  className="promptPolishQuickSelect noSelectCheck"
                  value={selectedQuickPolishValue}
                  onChange={(value) => setQuickPolishConfigId(value)}
                  options={quickPolishOptions}
                />
                <button type="button" className="promptPolishDetailButton" data-tooltip={t('generate.prompt.polishDetailTooltip')} aria-label={t('generate.prompt.polishDetailAria')} onClick={() => setAssistMode('polish')}>
                  <SlidersHorizontal size={13} />
                </button>
              </div>
              <button type="button" className="chipButton" data-tooltip={t('generate.prompt.reuseTooltip')} onClick={() => setAssistMode('reuse')}>
                <History size={13} /> <span className="buttonText">{t('generate.prompt.reuse')}</span>
              </button>
            </div>
          </div>
          {draftNotice ? <p className="promptSaveNotice" role="status">{draftNotice}</p> : null}
          <div className="promptInputRow">
            <textarea
              ref={promptInputRef}
              className="bottomPromptInput"
              value={props.prompt}
              onChange={(event) => props.onPromptChange(event.target.value)}
              placeholder={mode === 'image' ? t('generate.prompt.placeholderImage') : t('generate.prompt.placeholderText')}
            />
          </div>
          <div className="promptControlRow">
            <label>
              {t('generate.prompt.quality')}
              <StudioSelect
                value={props.quality}
                onChange={props.onQualityChange}
                options={qualityOptions(t)}
              />
            </label>
            <label>
              {t('generate.prompt.format')}
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
              {t('generate.prompt.style')}
              <StudioSelect
                className="promptStyleQuickSelect noSelectCheck"
                value={promptStyleId}
                onChange={setPromptStyleId}
                options={PROMPT_STYLE_PRESETS.map((style) => ({ value: style.id, label: style.label }))}
              />
            </label>
            <label>
              {t('generate.prompt.compression')}
              <input value={compression} placeholder={t('generate.prompt.compressionPlaceholder')} onChange={(event) => setCompression(event.target.value)} />
            </label>
            <label>
              {t('generate.prompt.count')}
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
            </div>
          </div>
        </div>
      </section>

      <aside className="parameterRail">
        <section className="railCard providerRailCard">
          <label>
            {t('generate.provider.platform')}
            <StudioSelect
              value={props.selectedProviderId}
              onChange={props.onProviderChange}
              options={props.providers.map((provider) => ({
                value: provider.id,
                label: providerAccessLabel(provider, t),
                description: providerAccessDescription(provider, t)
              }))}
            />
          </label>
          {props.supportsOpenAICompatible && providerProfileOptions.length > 0 ? (
            <label>
              {t('generate.provider.profile')}
              <StudioSelect
                value={props.activeProfile?.id ?? providerProfileOptions[0]?.value ?? ''}
                onChange={props.onProfileChange}
                options={providerProfileOptions}
              />
            </label>
          ) : null}
          <label>
            {t('generate.provider.model')}
            <StudioSelect
              value={modelValue}
              onChange={props.onModelChange}
              options={modelOptions.map((modelId) => ({ value: modelId, label: modelId }))}
            />
          </label>
          <div className={`connectionState ${props.isRealProviderReady ? 'ready' : ''}`}>
            <ShieldCheck size={14} /> {isComfyUILocalProvider
              ? props.isRealProviderReady ? t('generate.provider.comfyConnectionReady') : t('generate.provider.comfyConnectionMissing')
              : isSdWebUILocalProvider
                ? props.isRealProviderReady ? t('generate.provider.sdConnectionReady') : t('generate.provider.sdConnectionMissing')
                : props.isRealProviderReady ? t('generate.provider.connectionReady') : t('generate.provider.demoMode')}
          </div>
          <div className="activeProfileSummary">
            <div className="activeProfileLine">
              <span>{t('generate.provider.profile')}</span>
              <strong>{activeProfileName}</strong>
            </div>
            <div className="activeProfileChips" aria-label={t('generate.provider.statusAria')}>
              <span>{activeProfileStatus}</span>
              <span>{activeProfileModelProbeText}</span>
              <span>{activeProfileSecretText}</span>
            </div>
          </div>
        </section>

        <section className="railCard">
          <div className="railTitle">
            <PanelRight size={15} /> {t('generate.ratio.title')}
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
          <p className="railHint">{t('generate.ratio.hint')}</p>
        </section>

        <section className="railCard">
          <div className="railTitle">
            <SlidersHorizontal size={15} /> {t('generate.size.title')}
          </div>
          <div className="resolutionList">
            {currentRatioSizes.map((item) => (
              <button key={item.value} className={props.size === item.value ? 'active' : ''} onClick={() => props.onSizeChange(item.value)}>
                <div>
                  <strong>{item.value}</strong>
                  <small>{sizeOptionDescription(item, t)}</small>
                </div>
                <span>{item.badge}</span>
              </button>
            ))}
            {selectedSize ? null : (
              <button className="active customSizeCurrent" onClick={() => undefined}>
                <div>
                  <strong>{props.size}</strong>
                  <small>{t('generate.size.customDesc')}</small>
                </div>
                <span>{t('generate.size.customBadge')}</span>
              </button>
            )}
          </div>
          <div className="customSizeBox">
            <strong>{t('generate.size.customTitle')}</strong>
            <div>
              <input value={customWidth} type="number" min={64} max={4096} onChange={(event) => setCustomWidth(Number(event.target.value))} />
              <span>×</span>
              <input value={customHeight} type="number" min={64} max={4096} onChange={(event) => setCustomHeight(Number(event.target.value))} />
              <button onClick={applyCustomSize}>{t('generate.size.apply')}</button>
            </div>
            <small>{t('generate.size.hint')}</small>
          </div>
        </section>

        {mode === 'image' ? (
          <section className="railCard imageTuningCard">
            <div className="railTitle">
              <SlidersHorizontal size={15} /> {t('generate.imageTuning.title')}
            </div>
            <div className={`capabilityNotice ${advancedImageTuningEnabled ? 'ready' : 'blocked'}`}>
              <strong>{advancedImageTuningEnabled ? t('generate.imageTuning.ready') : t('generate.imageTuning.blocked')}</strong>
              <span>{t('generate.imageTuning.capabilities', { image: statusLabel(imageToImageStatus, t), multi: statusLabel(multiReferenceStatus, t) })}</span>
            </div>
            <label>
              {t('generate.imageTuning.strength')}
              <StudioSelect
                value={referenceStrength}
                onChange={setReferenceStrength}
                options={referenceStrengthOptions(t)}
              />
            </label>
            <label className="tuningCheck">
              <input
                type="checkbox"
                checked={preserveComposition}
                disabled={!advancedImageTuningEnabled}
                onChange={(event) => setPreserveComposition(event.target.checked)}
              />
              <span>{t('generate.imageTuning.keepComposition')}</span>
            </label>
            <label className="tuningCheck">
              <input
                type="checkbox"
                checked={styleTransfer}
                disabled={!advancedImageTuningEnabled}
                onChange={(event) => setStyleTransfer(event.target.checked)}
              />
              <span>{t('generate.imageTuning.styleTransfer')}</span>
            </label>
            <small>{multiReferenceAllowed ? t('generate.imageTuning.hintReady') : t('generate.imageTuning.hintBlocked')}</small>
          </section>
        ) : null}

        <section className="railCard advancedParamsCard">
          <div className="railTitle">
            <ChevronDown size={16} /> {t('generate.advanced.title')}
          </div>
          <label>
            Seed
            <input
              value={seedInput}
              inputMode="numeric"
              placeholder={t('generate.advanced.seedPlaceholder')}
              onChange={(event) => setSeedInput(event.target.value.replace(/[^\d]/g, '').slice(0, 12))}
            />
          </label>
          {isSdWebUILocalProvider ? (
            <>
              <label>
                {t('generate.advanced.sampler')}
                <input
                  value={sdSamplerName}
                  placeholder={t('generate.advanced.samplerPlaceholder')}
                  onChange={(event) => setSdSamplerName(event.target.value.slice(0, 80))}
                />
              </label>
              <label>
                {t('generate.advanced.steps')}
                <input
                  value={sdStepsInput}
                  inputMode="numeric"
                  placeholder="20"
                  onChange={(event) => setSdStepsInput(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                />
              </label>
              <label>
                CFG Scale
                <input
                  value={sdCfgScaleInput}
                  inputMode="decimal"
                  placeholder="7"
                  onChange={(event) => setSdCfgScaleInput(event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 5))}
                />
              </label>
            </>
          ) : null}
          <label>
            {t('generate.advanced.negativePrompt')}
            <textarea
              value={negativePrompt}
              placeholder={t('generate.advanced.negativePlaceholder')}
              rows={3}
              onChange={(event) => setNegativePrompt(event.target.value)}
            />
          </label>
          <small>{isSdWebUILocalProvider ? t('generate.advanced.hintSd') : t('generate.advanced.hintGeneric')}</small>
        </section>
      </aside>
      {isBatchToolsOpen ? (
        <div className="batchToolsBackdrop" onClick={() => setIsBatchToolsOpen(false)}>
          <section className="batchToolsDialog" role="dialog" aria-modal="true" aria-label={t('generate.batch.dialogAria')} onClick={(event) => event.stopPropagation()}>
            <header className="batchToolsHeader">
              <div>
                <span>Batch Tools</span>
                <strong>{t('generate.batch.title')}</strong>
                <small>{t('generate.batch.hint')}</small>
              </div>
              <button type="button" className="promptAssistClose" aria-label={t('generate.batch.closeAria')} onClick={() => setIsBatchToolsOpen(false)}>
                <XCircle size={18} />
              </button>
            </header>
            <div className="batchToolsTabs" role="tablist" aria-label={t('generate.batch.tabsAria')}>
              <button
                type="button"
                role="tab"
                className={batchToolTab === 'variants' ? 'active' : ''}
                aria-selected={batchToolTab === 'variants'}
                onClick={() => setBatchToolTab('variants')}
              >
                {t('generate.batch.variantsTab')}
              </button>
              <button
                type="button"
                role="tab"
                className={batchToolTab === 'compare' ? 'active' : ''}
                aria-selected={batchToolTab === 'compare'}
                onClick={() => setBatchToolTab('compare')}
              >
                {t('generate.batch.compareTab')}
              </button>
            </div>
            <div className="batchToolsBody">
              {batchToolTab === 'variants' ? (
                <div className="batchVariantBox inDialog" aria-label={t('generate.batch.variantsAria')}>
                  <div className="batchVariantHeader">
                    <div>
                      <strong>{t('generate.batch.variantsTitle')}</strong>
                      <small>{t('generate.batch.variantsHint')}</small>
                    </div>
                    <span>{t('generate.batch.taskCount', { count: estimatedBatchVariantTasks || 0 })}</span>
                  </div>
                  <textarea
                    value={batchPromptText}
                    rows={6}
                    placeholder={t('generate.batch.promptPlaceholder')}
                    disabled={props.isGenerating}
                    onChange={(event) => setBatchPromptText(event.target.value)}
                  />
                  <div className="batchVariantRatioList" aria-label={t('generate.batch.ratioAria')}>
                    {batchRatioOptions.map((option) => {
                      const checked = selectedBatchRatioValues.includes(option.ratio);
                      return (
                        <label className={`batchVariantRatioOption ${checked ? 'active' : ''}`} key={option.ratio}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={props.isGenerating}
                            onChange={(event) => toggleBatchRatio(option.ratio, event.target.checked)}
                          />
                          <span>
                            <strong>{batchRatioLabel(option, t)}</strong>
                            <small>{option.size} · {batchRatioHint(option, t)}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="batchVariantActions">
                    <button
                      type="button"
                      className="miniButton"
                      onClick={() => setBatchRatioValues(batchRatioOptions.map((option) => option.ratio))}
                      disabled={props.isGenerating}
                      title={t('generate.batch.selectAllRatiosTitle')}
                      aria-label={t('generate.batch.selectAllRatiosTitle')}
                    >
                      {t('generate.batch.selectAllRatios')}
                    </button>
                    <button
                      type="button"
                      className="miniButton"
                      onClick={() => setBatchRatioValues([selectedRatio])}
                      disabled={props.isGenerating}
                      title={t('generate.batch.currentRatioTitle')}
                      aria-label={t('generate.batch.currentRatioTitle')}
                    >
                      {t('generate.batch.currentRatio')}
                    </button>
                    <button
                      type="button"
                      className="miniButton primary"
                      onClick={addBatchVariantsToBatchQueue}
                      disabled={!canCreateBatchVariants}
                      title={t('generate.batch.addVariantsTitle')}
                      aria-label={t('generate.batch.addVariants')}
                    >
                      {t('generate.batch.addVariants')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="compareProfileBox inDialog" aria-label={t('generate.batch.compareAria')}>
                  <div className="compareProfileHeader">
                    <div>
                      <strong>{t('generate.batch.compareTitle')}</strong>
                      <small>{t('generate.batch.compareHint')}</small>
                    </div>
                    <span>{selectedCompareProfileCount}/{compareProfileCandidates.length}</span>
                  </div>
                  {props.supportsOpenAICompatible && compareProfileCandidates.length > 1 ? (
                    <>
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
                                <small>{profile.modelId} · {profile.baseUrl || t('generate.batch.noBaseUrl')}</small>
                              </span>
                              <em>{profile.enabled ? t('generate.provider.currentEnabled') : profileStatusLabel(profile.lastTestStatus, t)}</em>
                            </label>
                          );
                        })}
                      </div>
                      <div className="batchToolsSummary">
                        <span>{t('generate.batch.summarySize', { size: props.size })}</span>
                        <span>{t('generate.batch.summaryCount', { count: props.count })}</span>
                        <span>{t('generate.batch.summaryQuality', { quality: props.quality })}</span>
                      </div>
                      <div className="compareProfileActions">
                        <button
                          type="button"
                          className="miniButton"
                          onClick={() => setCompareProfileIds(compareProfileCandidates.map((profile) => profile.id))}
                          disabled={props.isGenerating}
                          title={t('generate.batch.selectAllProfilesTitle')}
                          aria-label={t('generate.batch.selectAllProfilesTitle')}
                        >
                          {t('generate.batch.selectAllProfiles')}
                        </button>
                        <button
                          type="button"
                          className="miniButton"
                          onClick={() => setCompareProfileIds([])}
                          disabled={props.isGenerating}
                          title={t('generate.batch.clearProfilesTitle')}
                          aria-label={t('generate.batch.clearProfilesTitle')}
                        >
                          {t('generate.batch.clearProfiles')}
                        </button>
                        <button
                          type="button"
                          className="miniButton primary"
                          onClick={addCompareGroupToBatchQueue}
                          disabled={!canCreateCompareGroup}
                          title={t('generate.batch.addCompareTitle')}
                          aria-label={t('generate.batch.addCompare')}
                        >
                          {t('generate.batch.addCompare')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="batchToolsEmpty">
                      <strong>{t('generate.batch.emptyTitle')}</strong>
                      <small>{t('generate.batch.emptyHint')}</small>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
      {assistMode ? (
        <PromptAssistModal
          t={t}
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
          <section className="promptDraftDialog" role="dialog" aria-modal="true" aria-label={t('generate.draft.dialogAria')} onClick={(event) => event.stopPropagation()}>
            <header className="promptDraftDialogHeader">
              <div>
                <span>{t('generate.draft.title')}</span>
                <strong>{t('generate.draft.savedCount', { count: promptDrafts.length })}</strong>
              </div>
              <button type="button" className="promptAssistClose" aria-label={t('generate.draft.closeAria')} onClick={() => setIsDraftLibraryOpen(false)}>
                <XCircle size={18} />
              </button>
            </header>
            <div className="promptDraftDialogBody">
              <button type="button" className="promptDraftSaveButton" onClick={() => saveCurrentPromptDraft()}>
                <Save size={13} /> {t('generate.draft.saveCurrent')}
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
                        <span>{promptDraftKindLabel(draft.kind, t)} · {formatDraftTime(draft.createdAt, t)}</span>
                        <strong>{draft.title}</strong>
                        <small>{draft.prompt}</small>
                      </button>
                      <button type="button" className="promptDraftDelete" aria-label={t('generate.draft.deleteAria', { title: draft.title })} onClick={() => deletePromptDraft(draft.id)}>
                        <XCircle size={14} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="promptDraftEmpty">
                  <strong>{t('generate.draft.emptyTitle')}</strong>
                  <small>{t('generate.draft.emptyHint')}</small>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}


function statusLabel(status: ReturnType<typeof listProviders>[number]['capabilities']['imageToImage'], t?: Translator) {
  const labels: Record<string, string> = {
    supported: t ? t('common.status.supported') : 'Supported',
    partial: t ? t('common.status.partial') : 'Partial',
    planned: t ? t('common.status.planned') : 'Planned',
    unknown: t ? t('common.status.unknown') : 'Unknown',
    unsupported: t ? t('common.status.unsupported') : 'Unsupported'
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

function fileToReferenceImage(file: File, source: Extract<ReferenceImage['source'], 'upload' | 'clipboard' | 'drag-drop'> = 'upload', t?: Translator): Promise<ReferenceImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      resolve({
        id: `${source}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name || (source === 'clipboard' ? (t ? t('generate.reference.fileNameClipboard') : 'Clipboard image') : (t ? t('generate.reference.fileNameDefault') : 'Reference image')),
        mimeType: file.type || 'image/png',
        dataUrl,
        previewUrl: dataUrl,
        source,
        role: 'auto',
        addedAt: new Date().toISOString()
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error(t ? t('generate.reference.readError') : 'Unable to read reference image.'));
    reader.readAsDataURL(file);
  });
}


